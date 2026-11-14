// UI metadata for the real HomePilot API entities.
//
// The grouped sensor endpoint returns the keys temperature, humidity and light.
// Every `id` below matches one of those keys, so the UI can look up a sensor
// directly from the API response without renaming anything.

export const SENSOR_CATEGORIES = [
  { id: "environment", label: "Environment" },
  { id: "light", label: "Light" },
]

// One entry per sensor group returned by GET /api/sensors/readings/.
export const SENSOR_DEFINITIONS = [
  {
    id: "temperature",
    name: "Temperature",
    category: "environment",
    icon: "thermometer",
    unit: "°C",
    precision: 1,
    description: "Room air temperature.",
  },
  {
    id: "humidity",
    name: "Relative Humidity",
    category: "environment",
    icon: "droplets",
    unit: "%",
    precision: 0,
    description: "Relative humidity of the room air.",
  },
  {
    id: "light",
    name: "Ambient Light",
    category: "light",
    icon: "sun",
    unit: "raw",
    precision: 0,
    uncalibrated: true,
    description: "Uncalibrated photoresistor reading.",
  },
]

// Device types supported by the backend. The device name itself always comes
// from the API; these definitions only supply an icon and a type label.
export const DEVICE_DEFINITIONS = [
  {
    id: "light",
    device_type: "light",
    name: "Light",
    icon: "lightbulb",
  },
  {
    id: "fan",
    device_type: "fan",
    name: "Fan",
    icon: "fan",
  },
]

export const DEVICE_TYPE_MAP = Object.fromEntries(
  DEVICE_DEFINITIONS.map((definition) => [definition.device_type, definition])
)

// DeviceCommand actions, exactly as the backend names them.
export const COMMAND_ACTIONS = {
  turn_on: { id: "turn_on", label: "Turn on", target: true },
  turn_off: { id: "turn_off", label: "Turn off", target: false },
}

// DeviceCommand statuses, exactly as the backend names them. `pending` means
// the device has not claimed the command yet; `in_progress` means it has
// claimed it and is applying it. `confirmed` is only set by a device report.
export const COMMAND_STATUSES = {
  pending: { id: "pending", label: "Pending", tone: "warning" },
  in_progress: { id: "in_progress", label: "Executing", tone: "info" },
  confirmed: { id: "confirmed", label: "Confirmed", tone: "success" },
  failed: { id: "failed", label: "Failed", tone: "danger" },
}

export const DEVICE_STATE_LABELS = {
  true: "On",
  false: "Off",
  unknown: "Unknown",
}
