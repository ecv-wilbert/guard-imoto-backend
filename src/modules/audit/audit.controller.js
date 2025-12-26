import { createAuditLog, getAuditLogsByUser, getAuditLogById } from './audit.service.js';
import { logAuth } from '../../utils/logger.js';

/**
 * POST /audit
 * Log a custom audit event manually
 * Assumes authMiddleware has already run and set req.user
 */
export async function logEvent(req, res, next) {
  try {
    const actor_id = req.user.uid; // from middleware
    const { action, target_type, target_id, metadata } = req.body;

    const log = await createAuditLog({
      actor_type: 'user',
      actor_id,
      action,
      target_type,
      target_id,
      metadata,
    });

    logAuth(`Audit log created for user ${actor_id}: ${action}`);
    return res.json({ success: true, log });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /audit/me
 * Get logs for authenticated user
 */
export async function getMyAuditLogs(req, res, next) {
  try {
    const actor_id = req.user.uid; // from middleware
    const limit = parseInt(req.query.limit) || 100;

    const logs = await getAuditLogsByUser(actor_id, limit);
    return res.json({ success: true, logs });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /audit/:id
 * Get single log by ID
 */
export async function getAuditLog(req, res, next) {
  try {
    const log = await getAuditLogById(req.params.id);
    if (!log) return res.status(404).json({ success: false, message: 'Log not found' });
    return res.json({ success: true, log });
  } catch (err) {
    next(err);
  }
}
