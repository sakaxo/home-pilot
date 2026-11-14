import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { getSensorStatus, SENSOR_STATUS_LABELS } from "@/lib/freshness";
import { SENSOR_CATEGORIES } from "@/lib/data/definitions";
import { Icon } from "@/components/common/icon";
import { StatusBadge } from "@/components/common/status-badge";
import { SensorSparkline } from "@/components/sensors/sensor-sparkline";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "cn";

const STATUS_TONES = {
  live: "success",
  stale: "warning",
  "no-data": "neutral",
  "connection-error": "danger",
};

function sensorStatus(sensor, now, connectionError) {
  const status = connectionError ? "connection-error" : getSensorStatus(sensor, now ?? Date.now());
  return { tone: STATUS_TONES[status], label: SENSOR_STATUS_LABELS[status] };
}

function formatValue(sensor, definition) {
  if (!sensor || sensor.current === null || sensor.current === undefined) return null;

  const numeric = Number(sensor.current);
  if (!Number.isFinite(numeric)) return null;

  const formatted = numeric.toFixed(definition.precision ?? 1);
  const unit = sensor.unit ?? definition.unit;
  if (definition.uncalibrated || unit === "raw") return `${formatted} raw`;
  return `${formatted}${unit ? ` ${unit}` : ""}`;
}

function historyPoints(sensor) {
  if (!sensor || !Array.isArray(sensor.history)) return [];
  return sensor.history.filter((point) => {
    if (!point || point.value === null || point.value === undefined) return false;
    return Number.isFinite(Number(point.value)) && !Number.isNaN(new Date(point.timestamp).getTime());
  });
}

function SensorCard({
  sensor,
  definition,
  now,
  showChart = true,
  className,
  connectionError = false,
}) {
  const status = sensorStatus(sensor, now, connectionError);
  const hasValue = sensor && sensor.current !== null && sensor.current !== undefined;
  const display = formatValue(sensor, definition);
  const category = SENSOR_CATEGORIES.find((entry) => entry.id === definition.category)?.label;
  const history = historyPoints(sensor);
  const unit =
    sensor?.unit === "raw" || definition.uncalibrated
      ? "Raw value"
      : sensor?.unit || definition.unit || "—";

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-mint-soft text-brand">
            <Icon name={definition.icon} className="size-4.5" />
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate">{definition.name}</CardTitle>
            <CardDescription className="truncate">{definition.description}</CardDescription>
          </div>
        </div>
        <StatusBadge tone={status.tone} dot>
          {status.label}
        </StatusBadge>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p
              className={cn(
                "text-2xl font-semibold tracking-tight text-ink tabular-nums",
                !hasValue && "text-base font-medium text-ink-muted",
              )}
            >
              {display ?? "No reading available"}
            </p>
          </div>
          <div className="text-right text-[11px] text-ink-muted">
            <p>{unit}</p>
            <p>{category}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[11px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="clock" className="size-3.5" />
            {sensor?.timestamp ? (
              <time dateTime={sensor.timestamp} title={formatDateTime(sensor.timestamp)}>
                Updated {formatRelativeTime(sensor.timestamp, now)}
              </time>
            ) : (
              "No reading received yet"
            )}
          </span>
        </div>

        {showChart ? (
          history.length > 1 ? (
            <div className="mt-3">
              <SensorSparkline
                points={history}
                label={`Historical readings for ${definition.name}`}
              />
              <p className="mt-1 text-[11px] text-ink-muted">
                Last {history.length} readings
              </p>
            </div>
          ) : (
            <p className="mt-3 border-t border-line pt-3 text-[11px] text-ink-muted">
              {history.length === 1
                ? "One reading so far. The trend appears after the next reading."
                : "No historical readings yet."}
            </p>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

export { SensorCard };
