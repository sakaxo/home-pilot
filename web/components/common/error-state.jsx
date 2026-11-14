import { Button } from "@/components/ui/button";
import { Icon } from "@/components/common/icon";

function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  retryLabel = "Try again",
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-danger/25 bg-danger-soft px-6 py-10 text-center"
      role="alert"
    >
      <span className="flex size-10 items-center justify-center rounded-lg bg-surface text-danger">
        <Icon name="circle-alert" className="size-5" />
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-md text-xs leading-relaxed text-ink-muted">{description}</p> : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-2 bg-surface" onClick={onRetry}>
          <Icon name="refresh-cw" className="size-3.5" />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

export { ErrorState };
