import { query } from '../../config/db.js';
import { enforceTelemetryAllowed } from '../../utils/enforce-telemetry.js';
import { insertTelemetry } from '../../utils/insert-telemetry.js';
import { runDetections } from '../detection/detection.engine.js';

export async function ingestTelemetryData({ device, type, data, timestamp }) {
  const { rows } = await query(`SELECT * FROM device_config WHERE device_id = $1`, [device.id]);

  if (!rows.length) {
    throw new Error('Device config missing');
  }

  const config = rows[0];

  enforceTelemetryAllowed(type, config);

  await insertTelemetry(device.id, type, data, timestamp);

  await runDetections({
    device_id: device.id,
    type,
    data,
  });
}
