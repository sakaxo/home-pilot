"use client";

import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { COMMAND_ACTIONS, COMMAND_STATUSES, DEVICE_STATE_LABELS } from "@/lib/data/definitions";
import { Icon } from "@/components/common/icon";
import { StatusBadge } from "@/components/common/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "cn";

function stateLabel(value) {
  if (value === true || value === false) return DEVICE_STATE_LABELS[value];
  return DEVICE_STATE_LABELS.unknown;
}

function stateTone(value) {
  if (value === true) return "success";
  if (value === false) return "neutral";
  return "warning";
}

function CommandLifecycle({ command, now, deviceName }) {
  if (!command) return null;

  const meta = COMMAND_STATUSES[command.status] || {
    label: command.status || "Unknown",
    tone: "neutral",
  };
  const confirmed = command.status === "confirmed";
  const failed = command.status === "failed";
  const executing = command.status === "in_progress";

  return (
    <div className="rounded-lg border border-line bg-app/60 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Last command
        </span>
        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-ink-muted">
        {confirmed
          ? `${deviceName} confirmed the new state.`
          : failed
            ? command.result_message || `${deviceName} did not apply the command.`
            : executing
              ? `${deviceName} acknowledged the command and is applying it.`
              : `Waiting for ${deviceName} to acknowledge the command.`}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="send" className="size-3" />
          <time dateTime={command.created_at} title={formatDateTime(command.created_at)}>
            Requested {formatRelativeTime(command.created_at, now)}
          </time>
        </span>
        {command.completed_at ? (
          <span className="inline-flex items-center gap-1.5">
            <Icon name={confirmed ? "check" : "x"} className="size-3" />
            {confirmed ? "Confirmed" : "Failed"} {formatRelativeTime(command.completed_at, now)}
          </span>
        ) : null}
      </div>

      {failed ? (
        <p
          className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-danger"
          role="status"
        >
          <Icon name="circle-alert" className="size-3.5" />
          The reported state was not changed by this command.
        </p>
      ) : null}
    </div>
  );
}

function DeviceCard({ device, command, definition, now, onSend, sending = false, className }) {
  const reportedState = device?.reported_state;
  const isOn = reportedState === true;
  const icon = definition?.icon || "cpu";
  const typeLabel = definition?.name || device?.device_type || "Device";

  function handleSelect(actionId) {
    if (sending) return;
    onSend?.(actionId);
  }

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              isOn ? "bg-mint-soft text-brand" : "bg-muted text-ink-muted",
            )}
          >
            <Icon name={icon} className="size-4.5" />
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate">{device?.name || "Unnamed device"}</CardTitle>
            <CardDescription className="truncate">{typeLabel}</CardDescription>
          </div>
        </div>
        <StatusBadge tone={stateTone(reportedState)} dot>
          {stateLabel(reportedState)}
        </StatusBadge>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-line bg-app/60 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              Requested
            </p>
            <p className="mt-0.5 text-sm font-semibold text-ink">
              {stateLabel(device?.desired_state)}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-app/60 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              Reported
            </p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{stateLabel(reportedState)}</p>
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

        <CommandLifecycle command={command} now={now} deviceName={device?.name} />

        <div className="mt-auto flex flex-col gap-2">
          <div
            className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface p-1"
            role="group"
            aria-label={`${device?.name || "Device"} control`}
          >
            {[COMMAND_ACTIONS.turn_on, COMMAND_ACTIONS.turn_off].map((action) => {
              const selected = device?.desired_state === action.target;
              return (
                <button
                  key={action.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={sending}
                  onClick={() => handleSelect(action.id)}
                  className={cn(
                    "flex-1 rounded-md px-3 py-2.5 text-xs font-medium outline-none transition sm:py-1.5",
                    "focus-visible:ring-2 focus-visible:ring-ring/40",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    selected
                      ? "bg-brand text-white"
                      : "text-ink-muted hover:bg-muted hover:text-ink",
                  )}
                >
                  {action.label}
                </button>
              );
            })}
          </div>

          {sending ? (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-brand" role="status">
              <span className="size-3 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
              Sending command to the backend…
            </p>
          ) : command?.status === "in_progress" ? (
            <p className="text-[11px] text-ink-muted">
              The device is applying the command. Reported state updates when it reports back.
            </p>
          ) : command?.status === "pending" ? (
            <p className="text-[11px] text-ink-muted">
              Waiting for the device to claim the pending command.
            </p>
          ) : (
            <p className="text-[11px] text-ink-muted">
              Reported state changes only when the device reports back.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export { DeviceCard };
