import { cn } from "cn";
import { Icon } from "@/components/common/icon";

function EmptyState({ icon = "inbox", title, description, action, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-ink-muted">
        <Icon name={icon} className="size-5" />
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-sm text-xs leading-relaxed text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
