import { query } from '../config/db.js';

export async function insertTelemetry(device_id, type, data, timestamp) {
  switch (type) {
    case 'gps':
      return query(
        `
        INSERT INTO gps_history (device_id, lat, lng, accuracy, recorded_at)
        VALUES ($1, $2, $3, $4, to_timestamp($5))
        `,
        [device_id, data.lat, data.lng, data.accuracy, timestamp ?? Date.now() / 1000]
      );

    case 'gyro':
      return query(
        `
        INSERT INTO gyro_history (device_id, x, y, z, recorded_at)
        VALUES ($1, $2, $3, $4, to_timestamp($5))
        `,
        [device_id, data.x, data.y, data.z, timestamp ?? Date.now() / 1000]
      );

    case 'battery':
      return query(
        `
        INSERT INTO battery_history (device_id, level, charging, recorded_at)
        VALUES ($1, $2, $3, to_timestamp($4))
        `,
        [device_id, data.level, data.charging, timestamp ?? Date.now() / 1000]
      );

    case 'rfid':
      return query(
        `
        INSERT INTO rfid_history (device_id, tag_uid, recorded_at)
        VALUES ($1, $2, to_timestamp($3))
        `,
        [device_id, data.tag_uid, timestamp ?? Date.now() / 1000]
      );

    default:
      throw new Error(`Unsupported telemetry type: ${type}`);
  }
}
