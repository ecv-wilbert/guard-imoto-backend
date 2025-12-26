// detection.rules.js

export const detectionRules = {
  gps: [gpsMovementAndGeofence],

  gyro: [gyroSuddenMovement],

  rfid: [rfidUnknownTag],
  battery: [batterySuddenDrop],
};

/* ---------------- RULES ---------------- */

function gpsMovementAndGeofence({ data, previous, context }) {
  const { lat, lng } = data;
  const findings = [];

  if (previous) {
    const drift = distanceBetween(lat, lng, previous.lat, previous.lng);

    // Idle → movement detection
    const MOVEMENT_THRESHOLD = 0.00005; // ~5m
    if (drift > MOVEMENT_THRESHOLD) {
      findings.push({
        type: 'gps_idle_to_movement',
        severity: 2,
        metadata: {
          previous: { lat: previous.lat, lng: previous.lng },
          current: { lat, lng },
          drift,
        },
      });
    }
  }

  // Geofence breach detection
  if (context.geofences?.length) {
    for (const fence of context.geofences) {
      if (!isPointInsideFence(lat, lng, fence)) {
        findings.push({
          type: 'gps_geofence_breach',
          severity: 3,
          metadata: { lat, lng, fence_id: fence.id },
        });
      }
    }
  }

  return findings;
}
function distanceBetween(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // distance in meters
}

function gyroSuddenMovement({ data, previous, context }) {
  const x = Number(data.x);
  const y = Number(data.y);
  const z = Number(data.z);

  const magnitude = Math.sqrt(x * x + y * y + z * z);

  const prev = context.prevGyro;
  if (!prev) return [];

  const px = Number(prev.x);
  const py = Number(prev.y);
  const pz = Number(prev.z);
  const prevMagnitude = Math.sqrt(px * px + py * py + pz * pz);

  const IDLE_THRESHOLD = 2.0;
  const MOVEMENT_THRESHOLD = 5.0;
  const DELTA_THRESHOLD = 100; // trigger if change > 100

  if (
    (prevMagnitude < IDLE_THRESHOLD && magnitude > MOVEMENT_THRESHOLD) ||
    Math.abs(magnitude - prevMagnitude) > DELTA_THRESHOLD
  ) {
    return [
      {
        type: 'gyro_sudden_movement',
        severity: magnitude > 1000 ? 4 : 3,
        metadata: { prevMagnitude, magnitude },
      },
    ];
  }

  return [];
}

function rfidUnknownTag({ data, context, previous }) {
  const { tag_uid } = data;

  if (context.allowed_tags?.includes(tag_uid)) {
    return [];
  }

  // Same unknown tag repeatedly = escalation
  const severity = previous?.tag_uid === tag_uid ? 4 : 3;

  return [
    {
      type: 'rfid_unknown_tag',
      severity,
      metadata: { tag_uid },
    },
  ];
}

/* ---------------- HELPERS ---------------- */

function isPointInsideFence(lat, lng, fence) {
  // Placeholder: circular fence
  const dx = lat - fence.lat;
  const dy = lng - fence.lng;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance <= fence.radius;
}

function batterySuddenDrop({ data, previous }) {
  if (!previous) return [];

  const delta = previous.level - data.level;

  if (delta >= 15) {
    return [
      {
        type: 'battery_sudden_drop',
        severity: delta >= 30 ? 4 : 2,
        metadata: {
          previous: previous.level,
          current: data.level,
          delta,
        },
      },
    ];
  }

  return [];
}
