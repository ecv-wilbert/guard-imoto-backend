import { Router } from 'express';
import { logEvent, getMyAuditLogs, getAuditLog } from './audit.controller.js';

const router = Router();

// User can log custom events
router.post('/', logEvent);

// Get logs for the authenticated user
router.get('/me', getMyAuditLogs);

// Get specific log by ID
router.get('/:id', getAuditLog);

export default router;
