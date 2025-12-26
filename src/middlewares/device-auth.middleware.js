import bcrypt from 'bcrypt';
import { query } from '../config/db.js';
import { generateDeviceSecret } from '../utils/hmac.js';

export async function requireDeviceAuth(req, res, next) {
  try {
    const serialNumber = (req.headers['x-device-serial'] || req.body?.serial_number)?.trim();

    if (!serialNumber)
      return res.status(401).json({ error: 'Missing serial_number or device_secret' });

    const { rows } = await query(
      `SELECT id, paired, device_secret_hash, pubnub_channel
       FROM devices
       WHERE serial_number = $1`,
      [serialNumber]
    );

    if (!rows.length) return res.status(401).json({ error: 'Device not found' });

    const device = rows[0];

    if (!device.paired) return res.status(403).json({ error: 'Device not paired' });

    // 🔑 Compare HMAC deterministic secret
    const expectedSecret = generateDeviceSecret(serialNumber);
    const valid = await bcrypt.compare(expectedSecret, device.device_secret_hash);

    if (!valid) return res.status(401).json({ error: 'Invalid device secret' });

    req.device = {
      id: device.id,
      serial_number: serialNumber,
      pubnub_channel: device.pubnub_channel,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Device authentication failed' });
  }
}
