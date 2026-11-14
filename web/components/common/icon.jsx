import {
  Check,
  CircleAlert,
  Clock,
  Droplets,
  Fan,
  Filter,
  Gauge,
  History,
  Home,
  Info,
  Lightbulb,
  Plug,
  Power,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Sun,
  Thermometer,
  X,
  Zap,
} from "lucide-react";

const ICONS = {
  check: Check,
  clock: Clock,
  "circle-alert": CircleAlert,
  droplets: Droplets,
  fan: Fan,
  filter: Filter,
  gauge: Gauge,
  history: History,
  home: Home,
  info: Info,
  lightbulb: Lightbulb,
  plug: Plug,
  power: Power,
  "refresh-cw": RefreshCw,
  send: Send,
  "sliders-horizontal": SlidersHorizontal,
  sun: Sun,
  thermometer: Thermometer,
  x: X,
  zap: Zap,
};

export function Icon({ name, className, ...props }) {
  const Component = ICONS[name] || Info;
  return <Component className={className} aria-hidden="true" focusable="false" {...props} />;
}
