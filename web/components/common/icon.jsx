import {
  CircleAlert,
  Clock,
  Droplets,
  Fan,
  Gauge,
  Home,
  Info,
  Lightbulb,
  RefreshCw,
  SlidersHorizontal,
  Sun,
  Thermometer,
} from "lucide-react";

const ICONS = {
  clock: Clock,
  "circle-alert": CircleAlert,
  droplets: Droplets,
  fan: Fan,
  gauge: Gauge,
  home: Home,
  lightbulb: Lightbulb,
  "refresh-cw": RefreshCw,
  "sliders-horizontal": SlidersHorizontal,
  sun: Sun,
  thermometer: Thermometer,
};

export function Icon({ name, className, ...props }) {
  const Component = ICONS[name] || Info;
  return <Component className={className} aria-hidden="true" focusable="false" {...props} />;
}
