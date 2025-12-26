export function enforceTelemetryAllowed(type, config) {
  const map = {
    gps: config.gps_enabled,
    gyro: config.gyroscope_enabled,
    battery: true, // battery always allowed
    rfid: true, // RFID always allowed (paired tags enforced elsewhere)
  };

  if (!map[type]) {
    throw new Error(`Telemetry type '${type}' is disabled`);
  }
}
