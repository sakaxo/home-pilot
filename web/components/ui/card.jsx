import { cn } from "cn";

function Card({ className, ...props }) {
  return (
    <section
      className={cn("min-w-0 rounded-xl border border-line bg-surface shadow-card", className)}
      {...props}
    />
  );
}

function CardHeader({ className, divider = false, ...props }) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 px-5 py-4",
        divider && "border-b border-line",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }) {
  return <h2 className={cn("text-sm font-semibold text-ink", className)} {...props} />;
}

function CardDescription({ className, ...props }) {
  return <p className={cn("mt-1 text-xs text-ink-muted", className)} {...props} />;
}

function CardContent({ className, ...props }) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

function CardFooter({ className, ...props }) {
  return (
    <div
      className={cn("border-t border-line px-5 py-3", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
