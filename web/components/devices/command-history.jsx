import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { COMMAND_ACTIONS, COMMAND_STATUSES } from "@/lib/data/definitions";
import { Icon } from "@/components/common/icon";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";

function CommandHistory({ commands, now }) {
  if (!commands.length) {
    return (
      <EmptyState
        icon="history"
        title="No commands sent yet"
        description="Commands sent from a device card appear here with their real backend status."
        className="border-0 bg-transparent"
      />
    );
  }

  return (
    <ul className="divide-y divide-line">
      {commands.map((command) => {
        const action = COMMAND_ACTIONS[command.action];
        const status = COMMAND_STATUSES[command.status] || {
          label: command.status || "Unknown",
          tone: "neutral",
        };

        return (
          <li key={command.id} className="flex items-start gap-3 px-5 py-3.5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-mint-soft text-brand-dark">
              <Icon name={command.action === "turn_on" ? "power" : "zap"} className="size-4" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="min-w-0 text-sm text-ink">
                  {action ? action.label : command.action} · {command.device}
                </p>
                <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                <time dateTime={command.created_at} title={formatDateTime(command.created_at)}>
                  Requested {formatRelativeTime(command.created_at, now)}
                </time>
                {command.completed_at ? (
                  <time dateTime={command.completed_at} title={formatDateTime(command.completed_at)}>
                    Completed {formatRelativeTime(command.completed_at, now)}
                  </time>
                ) : null}
                {command.result_message ? <span>{command.result_message}</span> : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export { CommandHistory };
