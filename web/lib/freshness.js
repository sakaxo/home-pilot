// A reading is Live while it is newer than this threshold. Change this single
// value to make freshness stricter or more forgiving across the whole UI.
export const STALE_AFTER_MINUTES = 5;

const STALE_AFTER_MS = STALE_AFTER_MINUTES * 60 * 1000;

export function isStale(iso, now = Date.now()) {
  if (!iso) return true;
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return true;
  return now - timestamp > STALE_AFTER_MS;
}

// Freshness of one sensor, based only on the reading timestamp returned by the
// backend. A successful request with an old timestamp is still "stale".
export function getSensorStatus(sensor, now = Date.now()) {
  if (!sensor?.timestamp) return "no-data";
  return isStale(sensor.timestamp, now) ? "stale" : "live";
}

export const SENSOR_STATUS_LABELS = {
  live: "Live",
  stale: "Stale",
  "no-data": "No data",
  "connection-error": "Connection error",
};

// Overall dashboard status. A failed request wins because it means the readings
// we still show are no longer being confirmed by the backend. "Live" requires
// every sensor to have a recent reading; anything else is shown as stale.
export function getDashboardStatus(sensors, now = null, connectionError = false) {
  if (connectionError) return "connection-error";

  const currentTime = now ?? Date.now();
  const statuses = Object.values(sensors).map((sensor) => getSensorStatus(sensor, currentTime));
  if (statuses.length === 0 || statuses.every((status) => status === "no-data")) {
    return "no-data";
  }
  if (statuses.every((status) => status === "live")) return "live";
  return "stale";
}
