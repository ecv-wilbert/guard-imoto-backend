import { query } from '../../config/db.js';
import { grantDeviceAccess } from '../../config/pubnub.js';
import { createAuditLog } from '../audit/audit.service.js';
import { logDb } from '../../utils/logger.js';
import { revokeDeviceAccess } from '../../config/pubnub.js';

export async function pairDevice(firebase_uid, { serial_number, pairing_code }) {
  const { rows } = await query(
    `SELECT id FROM devices
     WHERE serial_number = $1
       AND pairing_code = $2
       AND paired_at IS NULL`,
    [serial_number, pairing_code]
  );

  if (!rows.length) {
    throw new Error('Invalid pairing code or device already paired');
  }

  const device_id = rows[0].id;

  const { rows: userRows } = await query(`SELECT id FROM users WHERE firebase_uid = $1`, [
    firebase_uid,
  ]);

  const user_id = userRows[0].id;

  const { rows: updated } = await query(
    `UPDATE devices
     SET user_id = $1,
         paired_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [user_id, device_id]
  );

  await grantDeviceAccess(device_id);

  await createAuditLog({
    actor_type: 'user',
    actor_id: firebase_uid,
    action: 'paired_device',
    target_type: 'device',
    target_id: device_id,
    metadata: { serial_number },
  });

  logDb(`Device paired: ${device_id}`);
  return updated[0];
}

/**
 * Unpair a device
 */
export async function unpairDevice(firebase_uid, device_id) {
  // Ensure ownership
  const { rows } = await query(
    `SELECT d.id
     FROM devices d
     JOIN users u ON u.id = d.owner_id
     WHERE d.id = $1 AND u.firebase_uid = $2`,
    [device_id, firebase_uid]
  );

  if (!rows.length) throw new Error('Device not found or not owned by user');

  const { rows: updated } = await query(
    `UPDATE devices
     SET paired = FALSE
     WHERE id = $1
     RETURNING *`,
    [device_id]
  );

  await revokeDeviceAccess(device_id);

  await createAuditLog({
    actor_type: 'user',
    actor_id: firebase_uid,
    action: 'unpaired_device',
    target_type: 'device',
    target_id: device_id,
  });

  logDb(`Device unpaired: ${device_id}`);
  return updated[0];
}
