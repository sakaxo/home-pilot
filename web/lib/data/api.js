// Thin client for the HomePilot Django API.
//
// The base URL is configurable through NEXT_PUBLIC_API_BASE_URL so deployments
// do not need to edit source files. The fallback only exists for local
// development convenience.

const DEFAULT_API_BASE_URL = "http://127.0.0.1:9000";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

const SENSOR_HISTORY_LIMIT = 30;

async function apiRequest(path, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;
    try {
      const body = await response.json();
      if (body && typeof body === "object") {
        const detail = body.detail || body.error;
        if (typeof detail === "string") message = detail;
      }
    } catch {
      // Keep the status-based message when the body is not JSON.
    }
    throw new Error(message);
  }

  return response.json();
}

export function fetchSensorReadings(limit = SENSOR_HISTORY_LIMIT) {
  return apiRequest(`/api/sensors/readings/?limit=${encodeURIComponent(limit)}`);
}

// The single room device. Its response carries the desired states
// (light_state / fan_state) and the hardware-reported states
// (reported_light_state / reported_fan_state), which may be null (unknown).
export function fetchDevice() {
  return apiRequest("/api/device/");
}

// Change the desired state of the light and/or the fan. `updates` is a partial
// object such as { light_state: true } or { fan_state: false }.
export function updateDeviceState(updates) {
  return apiRequest("/api/device/", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}
