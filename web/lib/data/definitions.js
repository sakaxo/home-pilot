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

// The two controllable outputs on the single room device. Each `stateKey`
// matches a desired-state field and each `reportedKey` a reported-state field
// returned by GET /api/device/.
export const DEVICE_CONTROLS = [
  {
    id: "light",
    name: "Light",
    icon: "lightbulb",
    stateKey: "light_state",
    reportedKey: "reported_light_state",
  },
  {
    id: "fan",
    name: "Fan",
    icon: "fan",
    stateKey: "fan_state",
    reportedKey: "reported_fan_state",
  },
]

// A reported state can be true, false, or null (the hardware has not reported
// yet, which is not the same as off).
export const DEVICE_STATE_LABELS = {
  true: "On",
  false: "Off",
  unknown: "Unknown",
}
