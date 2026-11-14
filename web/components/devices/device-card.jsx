"use client";

import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { DEVICE_STATE_LABELS } from "@/lib/data/definitions";
import { Icon } from "@/components/common/icon";
import { StatusBadge } from "@/components/common/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "cn";

const STATE_OPTIONS = [
  { label: "Turn on", target: true },
  { label: "Turn off", target: false },
];

function stateLabel(value) {
  if (value === true || value === false) return DEVICE_STATE_LABELS[value];
  return DEVICE_STATE_LABELS.unknown;
}

function reportedTone(value) {
  if (value === true) return "success";
  if (value === false) return "neutral";
  return "warning";
}

// One control for a single output (light or fan). The reported state is what
// the hardware last said; the requested state is what the app asked for. A
// request is only "pending" once the hardware has reported at least once and
// the two differ, so an unreported output shows as unknown, never off.
function DeviceCard({ control, device, now, sending = false, onRequest, className }) {
  const requested = device?.[control.stateKey] ?? false;
  const reported = device?.[control.reportedKey];
  const hasReport = reported === true || reported === false;
  const pending = hasReport && requested !== reported;

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              reported === true ? "bg-mint-soft text-brand" : "bg-muted text-ink-muted",
            )}
          >
            <Icon name={control.icon} className="size-4.5" />
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate">{control.name}</CardTitle>
            <CardDescription className="truncate">Reported by the controller</CardDescription>
          </div>
        </div>
        <StatusBadge tone={reportedTone(reported)} dot>
          {stateLabel(reported)}
        </StatusBadge>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-line bg-app/60 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              Requested
            </p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{stateLabel(requested)}</p>
          </div>
          <div className="rounded-lg border border-line bg-app/60 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              Reported
            </p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{stateLabel(reported)}</p>
          </div>
        </div>

        <p className="text-[11px] text-ink-muted">
          {device?.last_reported_at ? (
            <time dateTime={device.last_reported_at} title={formatDateTime(device.last_reported_at)}>
              Last reported {formatRelativeTime(device.last_reported_at, now)}
            </time>
          ) : (
            "No state report received yet."
          )}
        </p>

        <div className="mt-auto flex flex-col gap-2">
          <div
            className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface p-1"
            role="group"
            aria-label={`${control.name} control`}
          >
            {STATE_OPTIONS.map((option) => {
              const selected = requested === option.target;
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={selected}
                  disabled={sending}
                  onClick={() => onRequest?.(option.target)}
                  className={cn(
                    "flex-1 rounded-md px-3 py-2.5 text-xs font-medium outline-none transition sm:py-1.5",
                    "focus-visible:ring-2 focus-visible:ring-ring/40",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    selected
                      ? "bg-brand text-white"
                      : "text-ink-muted hover:bg-muted hover:text-ink",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {sending ? (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-brand" role="status">
              <span className="size-3 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
              Sending request to the backend…
            </p>
          ) : pending ? (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-warning" role="status">
              <span className="size-3 animate-spin rounded-full border-2 border-warning/30 border-t-warning" />
              Waiting for the controller to report {stateLabel(requested).toLowerCase()}.
            </p>
          ) : hasReport ? (
            <p className="text-[11px] text-ink-muted">
              The requested and reported states match.
            </p>
          ) : (
            <p className="text-[11px] text-ink-muted">
              The controller has not reported this output yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export { DeviceCard };
