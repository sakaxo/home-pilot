import { LoaderCircle } from "lucide-react";

import { cn } from "cn";

function Spinner({ className }) {
  return <LoaderCircle className={cn("size-4 animate-spin", className)} aria-hidden="true" />;
}

function LoadingState({ label = "Loading room data…", className }) {
  return (
    <div
      className={cn("flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-6 py-10", className)}
      role="status"
    >
      <Spinner className="text-brand" />
      <span className="text-sm text-ink-muted">{label}</span>
    </div>
  );
}

function Skeleton({ className }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} aria-hidden="true" />;
}

function SkeletonCard({ className }) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface p-5", className)} aria-hidden="true">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="mt-4 h-8 w-20" />
      <Skeleton className="mt-4 h-10 w-full" />
    </div>
  );
}

export { LoadingState, Skeleton, SkeletonCard, Spinner };
