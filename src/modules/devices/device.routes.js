import express from 'express';
import {
  listMyDevices,
  getDevice,
  updateConfig,
  createMyDevice,
  pairMyDevice,
  unpairMyDevice,
  heartbeat,
  bootstrapDeviceController,
  scanNfcMode,
  getTagsForDevice,
  getGPSTelemetry,
  getGyroTelemetry,
  getBatteryTelemetry,
  getRFIDTelemetry,
} from './device.controller.js';
import { requireDeviceAuth } from '../../middlewares/device-auth.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { getDeviceDetections } from './device.service.js';

const router = express.Router();

router.get('/', authMiddleware, listMyDevices);
router.post('/', authMiddleware, createMyDevice);
router.get('/:id', authMiddleware, getDevice);
router.patch('/:id/config', authMiddleware, updateConfig);
router.get('/:device_id/nfc', authMiddleware, getTagsForDevice);

router.post('/pair', pairMyDevice);
router.post('/unpair/:device_id', unpairMyDevice);
router.post('/heartbeat', requireDeviceAuth, heartbeat);

router.post('/bootstrap', requireDeviceAuth, bootstrapDeviceController);
router.post('/:id/scan-nfc', requireDeviceAuth, scanNfcMode);

/* ======================
   USER → SERVER
   ====================== */

router.get('/:device_id/telemetry/gps', authMiddleware, getGPSTelemetry);
router.get('/:device_id/telemetry/gyro', authMiddleware, getGyroTelemetry);
router.get('/:device_id/telemetry/battery', authMiddleware, getBatteryTelemetry);
router.get('/:device_id/telemetry/rfid', authMiddleware, getRFIDTelemetry);
router.get('/:device_id/detections', authMiddleware, getDeviceDetections);

export default router;
