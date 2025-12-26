import { ingestTelemetryData } from './telemetry.service.js';

const ALLOWED_TYPES = ['gps', 'gyro', 'battery', 'rfid'];

export async function ingestTelemetry(req, res, next) {
  try {
    const device = req.device;
    const { type, data, timestamp } = req.body;

    if (!type || !data) {
      return res.status(400).json({ error: 'Invalid telemetry payload' });
    }

    if (!ALLOWED_TYPES.includes(type)) {
      throw new Error(`Unsupported telemetry type: ${type}`);
    }
    await ingestTelemetryData({
      device,
      type,
      data,
      timestamp,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
