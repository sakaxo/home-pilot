import { cn } from "cn";

const badgeTones = {
  success: "border-success/25 bg-success-soft text-success",
  warning: "border-warning/30 bg-warning-soft text-warning",
  danger: "border-danger/25 bg-danger-soft text-danger",
  info: "border-brand/25 bg-info-soft text-brand",
  mint: "border-mint-hover/40 bg-mint-soft text-brand-dark",
  neutral: "border-line bg-muted text-ink-muted",
};

const dotTones = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-brand",
  mint: "bg-mint-hover",
  neutral: "bg-ink-muted",
};

function StatusBadge({ tone = "neutral", dot = false, className, children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        badgeTones[tone] || badgeTones.neutral,
        className,
      )}
      {...props}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", dotTones[tone])} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

function StatusDot({ tone = "neutral", pulse = false, className }) {
  return (
    <span
      className={cn("inline-block size-2 rounded-full", dotTones[tone] || dotTones.neutral, pulse && "animate-pulse", className)}
      aria-hidden="true"
    />
  );
}

export { StatusBadge, StatusDot, badgeTones, dotTones };
