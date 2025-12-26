import PubNub from 'pubnub';
import { PUBNUB_PUBLISH_KEY, PUBNUB_SUBSCRIBE_KEY, PUBNUB_SECRET_KEY } from './env.js';
import { logPubNub } from '../utils/logger.js';

let pubnub;

export function initPubNub() {
  if (!pubnub) {
    pubnub = new PubNub({
      publishKey: PUBNUB_PUBLISH_KEY,
      subscribeKey: PUBNUB_SUBSCRIBE_KEY,
      secretKey: PUBNUB_SECRET_KEY,
      uuid: 'backend-server',
    });
  }
  return pubnub;
}

// Helper to publish messages
export async function publishMessage(channel, message) {
  if (!pubnub) initPubNub();
  try {
    const response = await pubnub.publish({ channel, message });
    logPubNub(`Published message to channel "${channel}"`);
    return response;
  } catch (err) {
    logPubNub(`Publish failed: ${err.message}`, '\x1b[31m'); // red for errors
    throw err;
  }
}

export async function grantDeviceAccess(device_id) {
  const channel = `device.${device_id}`;

  await pubnub.grant({
    channels: [channel],
    read: true,
    write: true,
    ttl: 0, // permanent until revoked
  });

  logPubNub(`Access granted for ${channel}`);
}

export async function revokeDeviceAccess(device_id) {
  const channel = `device.${device_id}`;

  await pubnub.grant({
    channels: [channel],
    read: false,
    write: false,
  });

  logPubNub(`Access revoked for ${channel}`);
}

export default pubnub;
