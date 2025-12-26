import {
  getDevicesByUser,
  getDeviceById,
  updateDeviceConfig,
  createDevice,
  bootstrapDevice,
  getTelemetryByType,
  getDetectionsByDevice,
} from './device.service.js';
import { logAuth } from '../../utils/logger.js';
import { pairDevice, unpairDevice } from './pairing.service.js';
import { markDeviceOnline } from './device.service.js';
import { getNfcTagsByDevice } from '../nfc/nfc.service.js';

/**
 * POST /devices
 * body: { name, serial_number }
 */
export async function createMyDevice(req, res, next) {
  try {
    const user = req.user;
    const { name, serial_number } = req.body;

    if (!serial_number) {
      return res.status(400).json({
        success: false,
        message: 'serial_number is required',
      });
    }

    const device = await createDevice(user.uid, { name, serial_number });

    logAuth(`Device created: ${device.id}`);
    res.status(201).json({ success: true, device });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /devices
 */
export async function listMyDevices(req, res, next) {
  try {
    const user = req.user;
    const devices = await getDevicesByUser(user.uid);
    res.json({ success: true, devices });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /devices/:id
 */
export async function getDevice(req, res, next) {
  try {
    const user = req.user;
    const device = await getDeviceById(req.params.id, user.uid);

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    res.json({ success: true, device });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /devices/:id/config
 */
export async function updateConfig(req, res, next) {
  try {
    const user = req.user;
    const config = await updateDeviceConfig(req.params.id, user.uid, req.body);

    logAuth(`Device config updated: ${req.params.id}`);
    res.json({ success: true, config });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /devices/pair
 * body: { serial_number, pairing_code }
 */
export async function pairMyDevice(req, res, next) {
  try {
    const user = req.user;
    const { serial_number, pairing_code } = req.body;

    if (!serial_number || !pairing_code) {
      return res.status(400).json({
        success: false,
        message: 'serial_number and pairing_code are required',
      });
    }

    const device = await pairDevice(user.uid, { serial_number, pairing_code });

    logAuth(`Device paired: ${device.id}`);
    res.json({ success: true, device });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /devices/unpair/:device_id
 */
export async function unpairMyDevice(req, res, next) {
  try {
    const user = req.user;
    const { device_id } = req.params;

    const device = await unpairDevice(user.uid, device_id);
    res.json({ success: true, device });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /devices/heartbeat
 */
export async function heartbeat(req, res, next) {
  try {
    const { device_id } = req.device;
    await markDeviceOnline(device_id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /devices/bootstrap
 * Used by ESP32 to fetch PubNub channel + config
 */
export async function bootstrapDeviceController(req, res) {
  try {
    const { serial_number } = req.body;

    if (!serial_number) {
      return res.status(400).json({
        message: 'serial_number is required',
      });
    }

    const result = await bootstrapDevice(serial_number);

    return res.json(result);
  } catch (err) {
    return res.status(401).json({
      message: err.message || 'Device bootstrap failed',
    });
  }
}

/**
 * POST /devices/:id/scan-nfc
 */
export async function scanNfcMode(req, res, next) {
  try {
    const firebase_uid = req.user.firebase_uid;
    const { id } = req.params;

    const result = await enableDeviceScanMode(id, firebase_uid);

    return res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /nfc/device/:device_id
 */
export async function getTagsForDevice(req, res, next) {
  try {
    const { device_id } = req.params;
    const tags = await getNfcTagsByDevice(device_id);

    return res.json({ success: true, tags });
  } catch (err) {
    next(err);
  }
}

export async function getGPSTelemetry(req, res) {
  const rows = await getTelemetryByType('gps', req.params.device_id);
  res.json(rows);
}

export async function getGyroTelemetry(req, res) {
  const rows = await getTelemetryByType('gyro', req.params.device_id);
  res.json(rows);
}

export async function getBatteryTelemetry(req, res) {
  const rows = await getTelemetryByType('battery', req.params.device_id);
  res.json(rows);
}

export async function getRFIDTelemetry(req, res) {
  const rows = await getTelemetryByType('rfid', req.params.device_id);
  res.json(rows);
}

export async function getDeviceDetections(req, res) {
  const rows = await getDetectionsByDevice(req.params.device_id);
  res.json(rows);
}
