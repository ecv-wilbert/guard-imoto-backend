import { detectionRules } from './detection.rules.js';
import { query } from '../../config/db.js';

export async function runDetections({ device_id, type, data }) {
  const rules = detectionRules[type];
  if (!rules) return;

  const context = await loadDetectionContext(device_id, type);

  // Load previous telemetry before the current row
  const previous = await loadPreviousTelemetry(device_id, type);

  // Assign previous into context for rules that expect it
  if (type === 'gyro') context.prevGyro = previous;

  const findings = [];

  for (const rule of rules) {
    const result = await rule({
      device_id,
      data,
      previous,
      context,
    });

    if (Array.isArray(result)) {
      findings.push(...result);
    }
  }

  if (findings.length) {
    await persistDetections(device_id, findings);
  }

  console.log('[DETECTION]', { type, previous, data, findings });
}

async function loadPreviousTelemetry(device_id, type) {
  const tableMap = {
    gps: 'gps_history',
    gyro: 'gyro_history',
    battery: 'battery_history',
    rfid: 'rfid_history',
  };

  const table = tableMap[type];
  if (!table) return null;

  const { rows } = await query(
    `
    SELECT *
    FROM ${table}
    WHERE device_id = $1
    ORDER BY recorded_at DESC
    LIMIT 1 OFFSET 1
    `,
    [device_id]
  );

  return rows[0] || null;
}

async function loadDetectionContext(device_id, type) {
  const context = {};

  if (type === 'rfid') {
    const { rows } = await query(`SELECT tag_uid FROM nfc_tags WHERE device_id = $1`, [device_id]);
    context.allowed_tags = rows.map((r) => r.tag_uid);
  }

  if (type === 'gps') {
    // Placeholder – implement geofences if needed
    context.geofences = [];
  }

  return context;
}

async function persistDetections(device_id, findings) {
  for (const d of findings) {
    await query(
      `
      INSERT INTO detections (device_id, type, severity, metadata)
      VALUES ($1, $2, $3, $4)
      `,
      [device_id, d.type, d.severity, d.metadata]
    );
  }
}
