import { cn } from "cn";

// Keep only points that have a finite numeric value and a valid timestamp, then
// order them chronologically.
function usablePoints(points) {
  return points
    .map((point) => {
      if (!point || point.value === null || point.value === undefined) return null;
      const value = Number(point.value);
      const time = new Date(point.timestamp).getTime();
      if (!Number.isFinite(value) || Number.isNaN(time)) return null;
      return { value, time };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);
}

function buildPaths(points) {
  const usable = usablePoints(points);
  if (usable.length < 2) return null;

  const values = usable.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const firstTime = usable[0].time;
  const lastTime = usable[usable.length - 1].time;
  const timeRange = lastTime - firstTime || 1;

  const coords = usable.map((point, index) => {
    const x =
      lastTime === firstTime
        ? (index / (usable.length - 1)) * 100
        : ((point.time - firstTime) / timeRange) * 100;
    const y = 28 - ((point.value - min) / range) * 24;
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
  });

  const line = `M ${coords.map((point) => `${point.x},${point.y}`).join(" L ")}`;
  const firstX = coords[0].x;
  const lastX = coords[coords.length - 1].x;
  const area = `${line} L ${lastX},32 L ${firstX},32 Z`;

  return { line, area };
}

function SensorSparkline({ points, label, className, tone = "var(--chart-1)" }) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const paths = buildPaths(points);
  if (!paths) return null;

  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className={cn("h-10 w-full", className)}
      role="img"
      aria-label={label || "Historical readings"}
    >
      <path d={paths.area} fill={tone} opacity="0.12" />
      <path
        d={paths.line}
        fill="none"
        stroke={tone}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export { SensorSparkline };
