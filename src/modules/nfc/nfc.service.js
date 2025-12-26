import { query } from '../../config/db.js';
import { createAuditLog } from '../audit/audit.service.js';
import { logDb } from '../../utils/logger.js';

/**
 * Link an NFC tag to a device
 * @param {string} firebase_uid - owner user
 * @param {string} device_id
 * @param {string} tag_uid
 */
export async function linkNfcTag(firebase_uid, device_id, tag_uid) {
  // 1️⃣ Ensure device belongs to user
  const { rows: deviceRows } = await query(
    `SELECT id FROM devices WHERE id = $1 AND owner_id = (
      SELECT id FROM users WHERE firebase_uid = $2
    )`,
    [device_id, firebase_uid]
  );

  if (!deviceRows.length) throw new Error('Device not found or not owned by user');

  // 2️⃣ Insert or update NFC tag
  const { rows: tagRows } = await query(
    `INSERT INTO nfc_tags (tag_uid, device_id, paired_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (tag_uid) DO UPDATE
     SET device_id = $2,
         paired_at = NOW()
     RETURNING *`,
    [tag_uid, device_id]
  );

  const tag = tagRows[0];

  // 3️⃣ Audit log
  await createAuditLog({
    actor_type: 'user',
    actor_id: firebase_uid,
    action: 'linked_nfc_tag',
    target_type: 'nfc_tag',
    target_id: tag.id,
    metadata: { device_id, tag_uid },
  });

  logDb(`NFC tag linked: ${tag.id} -> Device: ${device_id}`);

  return tag;
}

/**
 * Fetch NFC tags linked to a device
 */
export async function getNfcTagsByDevice(device_id) {
  const { rows } = await query(`SELECT * FROM nfc_tags WHERE device_id = $1`, [device_id]);
  return rows;
}

/**
 * Fetch device by NFC tag (for access validation)
 */
export async function getDeviceByNfcTag(tag_uid) {
  const { rows } = await query(
    `SELECT d.* 
     FROM devices d
     JOIN nfc_tags n ON n.device_id = d.id
     WHERE n.tag_uid = $1`,
    [tag_uid]
  );
  return rows[0] || null;
}
/**
 * Unlink an NFC tag from a device
 * @param {string} firebase_uid - owner user
 * @param {string} tag_uid
 */
export async function unlinkNfcTag(firebase_uid, tag_uid) {
  // 1️⃣ Ensure tag exists and belongs to a device owned by user
  const { rows: tagRows } = await query(
    `SELECT n.id, n.device_id
     FROM nfc_tags n
     JOIN devices d ON d.id = n.device_id
     JOIN users u ON u.id = d.owner_id
     WHERE n.tag_uid = $1 AND u.firebase_uid = $2`,
    [tag_uid, firebase_uid]
  );

  if (!tagRows.length) throw new Error('NFC tag not found or not owned by user');

  const tag = tagRows[0];

  // 2️⃣ Unlink the tag
  const { rows: updatedRows } = await query(
    `UPDATE nfc_tags
     SET device_id = NULL,
         paired_at = NULL
     WHERE id = $1
     RETURNING *`,
    [tag.id]
  );

  const updatedTag = updatedRows[0];

  // 3️⃣ Audit log
  await createAuditLog({
    actor_type: 'user',
    actor_id: firebase_uid,
    action: 'unlinked_nfc_tag',
    target_type: 'nfc_tag',
    target_id: updatedTag.id,
    metadata: { device_id: tag.device_id, tag_uid },
  });

  logDb(`NFC tag unlinked: ${updatedTag.id} from device ${tag.device_id}`);

  return updatedTag;
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

/**
 * Verify/consume a tag scanned by the device
 */
export async function verifyTag({ device_id, tag_uid }) {
  const { rows } = await query(
    `
    SELECT *
    FROM nfc_tags
    WHERE tag_uid = $1 AND device_id = $2
    `,
    [tag_uid, device_id]
  );

  if (!rows.length) {
    return { valid: false };
  }

  // Optionally: you could mark tag as "used" or log the scan
  return { valid: true };
}
