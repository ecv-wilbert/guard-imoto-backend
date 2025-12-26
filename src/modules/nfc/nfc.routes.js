import express from 'express';
import { linkTag, unlinkTag, verifyDeviceTag } from './nfc.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireDeviceAuth } from '../../middlewares/device-auth.middleware.js';

const router = express.Router();

// User must be authenticated
router.post('/link', authMiddleware, linkTag);
router.post('/unlink', authMiddleware, unlinkTag);
router.post('/verify', requireDeviceAuth, verifyDeviceTag);

export default router;
