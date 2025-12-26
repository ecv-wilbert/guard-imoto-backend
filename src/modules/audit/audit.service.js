import { query } from '../../config/db.js';
import { logDb } from '../../utils/logger.js';

/**
 * Create an audit log entry
 */
export async function createAuditLog({
  actor_type,
  actor_id,
  action,
  target_type,
  target_id,
  metadata = {},
}) {
  const { rows } = await query(
    `INSERT INTO audit_logs (actor_type, actor_id, action, target_type, target_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [actor_type, actor_id, action, target_type, target_id, metadata]
  );
  logDb(`Audit log created: ${actor_type} ${actor_id} -> ${action} on ${target_type} ${target_id}`);
  return rows[0];
}

/**
 * Fetch audit logs for a specific actor (user)
 * @param {string} actor_id - Firebase UID
 * @param {number} [limit=50]
 */
export async function getAuditLogsByUser(actor_id, limit = 100) {
  const { rows } = await query(
    `SELECT *
     FROM audit_logs
     WHERE actor_type = 'user' AND actor_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [actor_id, limit]
  );
  return rows;
}

/**
 * Fetch a single audit log by its ID
 */
export async function getAuditLogById(id) {
  const { rows } = await query(`SELECT * FROM audit_logs WHERE id = $1`, [id]);
  return rows[0] || null;
}
