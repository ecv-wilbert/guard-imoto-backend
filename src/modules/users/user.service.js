import { query } from '../../config/db.js';
import { logDb } from '../../utils/logger.js';
import { createAuditLog } from '../audit/audit.service.js';

/**
 * Get user by Firebase UID
 * @param {string} firebase_uid
 */
export async function getUserByUid(firebase_uid) {
  const { rows } = await query(`SELECT * FROM users WHERE firebase_uid = $1`, [firebase_uid]);
  return rows[0] || null;
}

/**
 * Update user profile
 * @param {string} firebase_uid
 * @param {Object} updates
 * @param {string} [updates.first_name]
 * @param {string} [updates.last_name]
 * @param {string} [updates.phone]
 * @param {string} [updates.photo_url]
 * @param {boolean} [updates.notifications_enabled]
 * @param {string} [actor_id] - Firebase UID performing the update
 */
export async function updateUser(firebase_uid, updates, actor_id = 'system') {
  const { first_name, last_name, phone, photo_url, notifications_enabled } = updates;

  const oldUser = await getUserByUid(firebase_uid);

  const { rows } = await query(
    `UPDATE users
     SET first_name = COALESCE($1, first_name),
         last_name = COALESCE($2, last_name),
         phone = COALESCE($3, phone),
         photo_url = COALESCE($4, photo_url),
         notifications_enabled = COALESCE($5, notifications_enabled),
         updated_at = NOW()
     WHERE firebase_uid = $6
     RETURNING *`,
    [first_name, last_name, phone, photo_url, notifications_enabled, firebase_uid]
  );

  const updatedUser = rows[0];
  logDb(`User updated: ${firebase_uid}`);

  // Create audit log
  try {
    await createAuditLog({
      actor_type: 'user',
      actor_id,
      action: 'updated_profile',
      target_type: 'user',
      target_id: firebase_uid,
      metadata: {
        old: oldUser,
        new: updatedUser,
      },
    });
    logDb(`Audit log created for user update: ${firebase_uid}`);
  } catch (err) {
    console.error('[AUDIT] Failed to log user update:', err);
  }

  return updatedUser;
}
