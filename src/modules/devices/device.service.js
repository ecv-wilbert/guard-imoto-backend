import { query } from '../../config/db.js';
import { grantDeviceAccess, publishMessage } from '../../config/pubnub.js';
import { createAuditLog } from '../audit/audit.service.js';
import { logDb } from '../../utils/logger.js';

import bcrypt from 'bcrypt';
import { generateDeviceSecret } from '../../utils/hmac.js';
import { withTransaction } from '../../utils/with-transaction.js';

const ALLOWED_FIELDS = [
  'relay1_enabled',
  'relay1_override',
  'relay1_alarm_type',
  'relay1_interval_sec',
  'relay1_trigger_mode',
  'relay1_delay_sec',
  'relay2_enabled',
  'relay2_override',
  'battery_saver_enabled',
  'battery_saver_threshold',
  'gyroscope_enabled',
  'gps_enabled',
  'sms_alerts_enabled',
];

const DEVICE_FIELDS = ['device_name', 'device_color', 'paired'];
const CONFIG_FIELDS = ALLOWED_FIELDS; // your existing allowed config fields

/**
 * Create a device linked to user
 */
export async function createDevice(firebase_uid, { name, serial_number }) {
  const { rows: userRows } = await query(`SELECT id FROM users WHERE firebase_uid = $1`, [
    firebase_uid,
  ]);

  if (!userRows.length) throw new Error('User not found');
  const owner_id = userRows[0].id;

  // Generate device secret
  const device_secret = generateDeviceSecret(serial_number);
  const device_secret_hash = await bcrypt.hash(device_secret, 10);

  const pubnub_channel = `device-${serial_number}-${Date.now()}`;
  const { rows: deviceRows } = await query(
    `INSERT INTO devices (owner_id, device_name, pubnub_channel, device_secret_hash, paired, last_seen_at, serial_number)
     VALUES ($1, $2, $3, $4, TRUE, NOW(), $5)
     RETURNING *`,
    [owner_id, name, pubnub_channel, device_secret_hash, serial_number]
  );

  const device = deviceRows[0];

  // Create default config
  await query(`INSERT INTO device_config (device_id) VALUES ($1)`, [device.id]);

  await grantDeviceAccess(device.id);

  logDb(`Device created & paired: ${device.id}`);

  await createAuditLog({
    actor_type: 'user',
    actor_id: firebase_uid,
    action: 'created_and_paired_device',
    target_type: 'device',
    target_id: device.id,
    metadata: { name, pubnub_channel },
  });

  return { ...device };
}

/**
 * Get all devices for user, including latest telemetry
 */
export async function getDevicesByUser(firebase_uid) {
  const { rows } = await query(
    `
    SELECT 
      d.*,
      dc.*,
      gps.lat AS latest_lat,
      gps.lng AS latest_lng,
      gps.accuracy AS latest_gps_accuracy,
      gyro.x AS latest_gyro_x,
      gyro.y AS latest_gyro_y,
      gyro.z AS latest_gyro_z,
      battery.level AS latest_battery_level,
      battery.charging AS latest_battery_charging,
      rfid.tag_uid AS latest_rfid
    FROM devices d
    LEFT JOIN device_config dc ON dc.device_id = d.id
    -- Latest GPS
    LEFT JOIN LATERAL (
      SELECT lat, lng, accuracy
      FROM gps_history
      WHERE device_id = d.id
      ORDER BY recorded_at DESC
      LIMIT 1
    ) gps ON true
    -- Latest Gyro
    LEFT JOIN LATERAL (
      SELECT x, y, z
      FROM gyro_history
      WHERE device_id = d.id
      ORDER BY recorded_at DESC
      LIMIT 1
    ) gyro ON true
    -- Latest Battery
    LEFT JOIN LATERAL (
      SELECT level, charging
      FROM battery_history
      WHERE device_id = d.id
      ORDER BY recorded_at DESC
      LIMIT 1
    ) battery ON true
    -- Latest RFID
    LEFT JOIN LATERAL (
      SELECT tag_uid
      FROM rfid_history
      WHERE device_id = d.id
      ORDER BY recorded_at DESC
      LIMIT 1
    ) rfid ON true
    WHERE d.owner_id = (
      SELECT id FROM users WHERE firebase_uid = $1
    )
  `,
    [firebase_uid]
  );

  return rows;
}

/**
 * Get single device by ID including latest telemetry
 */
export async function getDeviceById(device_id, firebase_uid) {
  const { rows } = await query(
    `
    SELECT 
      d.*,
      dc.*,
      gps.lat AS latest_lat,
      gps.lng AS latest_lng,
      gps.accuracy AS latest_gps_accuracy,
      gyro.x AS latest_gyro_x,
      gyro.y AS latest_gyro_y,
      gyro.z AS latest_gyro_z,
      battery.level AS latest_battery_level,
      battery.charging AS latest_battery_charging,
      rfid.tag_uid AS latest_rfid
    FROM devices d
    LEFT JOIN device_config dc ON dc.device_id = d.id
    -- Latest GPS
    LEFT JOIN LATERAL (
      SELECT lat, lng, accuracy
      FROM gps_history
      WHERE device_id = d.id
      ORDER BY recorded_at DESC
      LIMIT 1
    ) gps ON true
    -- Latest Gyro
    LEFT JOIN LATERAL (
      SELECT x, y, z
      FROM gyro_history
      WHERE device_id = d.id
      ORDER BY recorded_at DESC
      LIMIT 1
    ) gyro ON true
    -- Latest Battery
    LEFT JOIN LATERAL (
      SELECT level, charging
      FROM battery_history
      WHERE device_id = d.id
      ORDER BY recorded_at DESC
      LIMIT 1
    ) battery ON true
    -- Latest RFID
    LEFT JOIN LATERAL (
      SELECT tag_uid
      FROM rfid_history
      WHERE device_id = d.id
      ORDER BY recorded_at DESC
      LIMIT 1
    ) rfid ON true
    WHERE d.id = $1
      AND d.owner_id = (
        SELECT id FROM users WHERE firebase_uid = $2
      )
  `,
    [device_id, firebase_uid]
  );

  return rows[0] || null;
}

/**
 * Update device + device config
 */
export async function updateDeviceConfig(device_id, firebase_uid, updates) {
  return await withTransaction(async (client) => {
    // 🔎 Fetch device + config
    const { rows } = await client.query(
      `
      SELECT 
        d.id,
        d.device_name,
        d.device_color,
        d.device_enabled,
        d.pubnub_channel,
        dc.*
      FROM devices d
      LEFT JOIN device_config dc ON dc.device_id = d.id
      WHERE d.id = $1
      `,
      [device_id]
    );

    if (!rows.length) {
      throw new Error('Device not found');
    }

    const row = rows[0];
    const { pubnub_channel, ...oldState } = row;

    /* ----------------------------
     * Split updates by table
     * ---------------------------- */
    const deviceUpdates = {};
    const configUpdates = {};

    for (const [key, value] of Object.entries(updates)) {
      if (DEVICE_FIELDS.includes(key)) {
        deviceUpdates[key] = value;
      } else if (CONFIG_FIELDS.includes(key)) {
        configUpdates[key] = value;
      }
    }

    let newDevice = null;
    let newConfig = null;

    /* ----------------------------
     * Update devices table
     * ---------------------------- */
    if (Object.keys(deviceUpdates).length) {
      const fields = Object.keys(deviceUpdates);
      const setClause = fields.map((k, i) => `${k} = $${i + 1}`).join(', ');

      const values = [...fields.map((f) => deviceUpdates[f]), device_id];

      const { rows } = await client.query(
        `
        UPDATE devices
        SET ${setClause},
            updated_at = NOW()
        WHERE id = $${fields.length + 1}
        RETURNING *
        `,
        values
      );

      newDevice = rows[0];
    }

    /* ----------------------------
     * Update device_config table
     * ---------------------------- */
    if (Object.keys(configUpdates).length) {
      const fields = Object.keys(configUpdates);
      const setClause = fields.map((k, i) => `${k} = $${i + 1}`).join(', ');

      const values = [...fields.map((f) => configUpdates[f]), device_id];

      const { rows } = await client.query(
        `
        UPDATE device_config
        SET ${setClause},
            updated_at = NOW()
        WHERE device_id = $${fields.length + 1}
        RETURNING *
        `,
        values
      );

      newConfig = rows[0];
    }

    /* ----------------------------
     * Publish unified update
     * ---------------------------- */
    await publishMessage(pubnub_channel, {
      event: 'device_update',
      payload: {
        device: newDevice,
        config: newConfig,
      },
    });

    /* ----------------------------
     * Audit
     * ---------------------------- */
    await createAuditLog({
      actor_type: 'user',
      actor_id: firebase_uid,
      action: 'updated_device',
      target_type: 'device',
      target_id: device_id,
      metadata: {
        old: oldState,
        new: {
          ...(newDevice || {}),
          ...(newConfig || {}),
        },
      },
    });

    return {
      device: newDevice,
      config: newConfig,
    };
  });
}

export async function markDeviceOnline(device_id) {
  await query(
    `UPDATE devices
     SET last_seen_at = NOW(),
         is_online = true
     WHERE id = $1`,
    [device_id]
  );
}

/**
 * Bootstrap device (first-time secure handshake)
 * @param {string} serial_number
 */
export async function bootstrapDevice(serial_number) {
  // 1️⃣ Fetch device + config
  const { rows } = await query(
    `SELECT 
      d.id,
      d.paired,
      d.device_secret_hash,
      d.pubnub_channel,
      dc.*
    FROM devices d
    JOIN device_config dc ON dc.device_id = d.id
    WHERE d.serial_number = $1
    `,
    [serial_number]
  );

  if (!rows.length) {
    throw new Error('Device not found');
  }

  const device = rows[0];

  // 2️⃣ Verify pairing state
  if (!device.paired) {
    throw new Error('Device is not paired');
  }

  // 3️⃣ Generate HMAC secret for comparison
  const expectedSecret = generateDeviceSecret(serial_number);

  const valid = await bcrypt.compare(expectedSecret, device.device_secret_hash);
  if (!valid) {
    throw new Error('Invalid device secret');
  }

  // 4️⃣ Return only what device must know
  logDb(`Device bootstrapped: ${device.id}`);

  return {
    pubnub_channel: device.pubnub_channel,
    config: sanitizeDeviceConfig(device),
  };
}

/**
 * Remove internal / sensitive fields before returning to device
 */
function sanitizeDeviceConfig(row) {
  const {
    device_secret_hash,
    paired,
    pubnub_channel,
    id,
    owner_id,
    created_at,
    updated_at,
    ...config
  } = row;

  return config;
}

/**
 * Set device to NFC scan mode
 */
export async function enableDeviceScanMode(device_id, firebase_uid) {
  // 1️⃣ Fetch device and ensure ownership
  const { rows } = await query(`SELECT id, pubnub_channel, owner_id FROM devices WHERE id = $1`, [
    device_id,
  ]);

  if (!rows.length) throw new Error('Device not found');

  const device = rows[0];

  // 2️⃣ Verify user owns this device
  const { rows: userRows } = await query(`SELECT id FROM users WHERE firebase_uid = $1`, [
    firebase_uid,
  ]);

  if (!userRows.length || userRows[0].id !== device.owner_id) {
    throw new Error('Unauthorized');
  }

  // 3️⃣ Publish to device to enter scan mode
  await publishMessage(device.pubnub_channel, {
    event: 'enter_scan_mode',
    timestamp: Date.now(),
  });

  // 4️⃣ Audit
  await createAuditLog({
    actor_type: 'user',
    actor_id: firebase_uid,
    action: 'enabled_scan_mode',
    target_type: 'device',
    target_id: device_id,
  });

  logDb(`Device ${device_id} set to scan mode`);

  return { success: true, device_id, pubnub_channel: device.pubnub_channel };
}

export async function getDeviceDetections(req, res) {
  const { device_id } = req.params;

  const { rows } = await query(
    `
    SELECT *
    FROM detections
    WHERE device_id = $1
    ORDER BY created_at DESC
    LIMIT 100
    `,
    [device_id]
  );

  res.json(rows);
}

export async function getTelemetryByType(type, device_id) {
  const tableMap = {
    gps: 'gps_history',
    gyro: 'gyro_history',
    battery: 'battery_history',
    rfid: 'rfid_history',
  };

  const { rows } = await query(
    `
    SELECT *
    FROM ${tableMap[type]}
    WHERE device_id = $1
    ORDER BY recorded_at DESC
    LIMIT 100
    `,
    [device_id]
  );

  return rows;
}

export async function getDetectionsByDevice(device_id) {
  const { rows } = await query(
    `
    SELECT *
    FROM detections
    WHERE device_id = $1
    ORDER BY created_at DESC
    LIMIT 100
    `,
    [device_id]
  );

  return rows;
}
