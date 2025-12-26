import crypto from 'crypto';
import { DEVICE_SECRET } from '../config/env.js'; // your global secret

/**
 * Generate deterministic device secret using HMAC
 * @param {string} serialNumber
 * @returns {string} device secret
 */
export function generateDeviceSecret(serialNumber) {
  return crypto.createHmac('sha256', DEVICE_SECRET).update(serialNumber).digest('hex'); // 64-char hex string
}
