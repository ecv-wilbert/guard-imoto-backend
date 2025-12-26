import PubNub from 'pubnub';
import { PUBNUB_PUBLISH_KEY, PUBNUB_SUBSCRIBE_KEY } from '../src/config/env.js';

// 🔧 CHANGE THIS to the exact device channel you want to test
const DEVICE_CHANNEL = 'device-ESP32-ABC-002-1766593236794';

const pubnub = new PubNub({
  publishKey: PUBNUB_PUBLISH_KEY,
  subscribeKey: PUBNUB_SUBSCRIBE_KEY,
  uuid: 'test-device-listener'
});

pubnub.addListener({
  message: (event) => {
    console.log('📡 Device Message Received');
    console.log('Channel:', event.channel);
    console.log('Payload:', JSON.stringify(event.message, null, 2));
  },
  status: (status) => {
    if (status.category === 'PNConnectedCategory') {
      console.log(`✅ Connected to PubNub`);
      console.log(`👂 Listening on channel: ${DEVICE_CHANNEL}`);
    }
  }
});

pubnub.subscribe({
  channels: [DEVICE_CHANNEL],
  withPresence: false
});

console.log('🚀 Test device listener started...');
