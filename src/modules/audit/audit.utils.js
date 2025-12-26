import { createAuditLog } from './audit.service.js';
import { initFirebase } from '../../config/firebase-admin.js';
const admin = initFirebase();

/**
 * Middleware to log an action
 * @param {string} action - action description, e.g., 'updated first_name'
 * @param {string} target_type - e.g., 'user'
 * @param {Function} getTargetId - function (req) => string
 */
export function audit(action, target_type, getTargetId) {
  return async (req, res, next) => {
    try {
      const idToken = req.headers.authorization?.split(' ')[1];
      let actor_id = 'system';
      if (idToken) {
        const decoded = await admin.auth().verifyIdToken(idToken);
        actor_id = decoded.uid;
      }

      const target_id = typeof getTargetId === 'function' ? getTargetId(req) : null;

      await createAuditLog({
        actor_type: 'user',
        actor_id,
        action,
        target_type,
        target_id,
        metadata: {
          body: req.body,
          params: req.params,
          query: req.query,
        },
      });
    } catch (err) {
      console.error('[AUDIT] Failed to log:', err);
    } finally {
      next();
    }
  };
}
