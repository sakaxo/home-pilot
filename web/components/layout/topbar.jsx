"use client";

import { usePathname } from "next/navigation";

import { getPageMeta } from "@/lib/navigation";
import { formatRelativeTime } from "@/lib/format";
import { getDashboardStatus, SENSOR_STATUS_LABELS } from "@/lib/freshness";
import { useNow } from "@/hooks/use-now";
import { useHomePilot } from "@/components/providers/homepilot-provider";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Icon } from "@/components/common/icon";
import { StatusBadge } from "@/components/common/status-badge";

const STATUS_TONES = {
  live: "mint",
  stale: "warning",
  "no-data": "neutral",
  "connection-error": "danger",
};

function latestReadingTimestamp(sensors) {
  return (
    Object.values(sensors)
      .map((sensor) => sensor?.timestamp)
      .filter(Boolean)
      .sort()
      .pop() || null
  );
}

export function Topbar() {
  const pathname = usePathname();
  const { sensors, sensorsStatus, sensorsError, refreshing, refresh } = useHomePilot();
  const now = useNow();
  const page = getPageMeta(pathname);

  const dashboardStatus =
    sensorsStatus === "loading"
      ? "loading"
      : getDashboardStatus(sensors, now, Boolean(sensorsError));

  const connection =
    dashboardStatus === "loading"
      ? { tone: "neutral", label: "Connecting" }
      : {
          tone: STATUS_TONES[dashboardStatus],
          label: SENSOR_STATUS_LABELS[dashboardStatus],
        };

  const lastReading = latestReadingTimestamp(sensors);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="flex h-14 items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <SidebarTrigger className="size-10 rounded-lg border border-line bg-surface text-ink hover:border-brand/40 hover:text-brand sm:size-9" />

        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden text-xs font-medium text-ink-muted sm:inline">HomePilot</span>
          <span className="hidden text-line sm:inline" aria-hidden="true">
            /
          </span>
          <span className="truncate text-sm font-semibold text-ink">{page.title}</span>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <StatusBadge tone={connection.tone} dot>
            {connection.label}
          </StatusBadge>
          <span className="hidden text-xs text-ink-muted xl:inline">
            {lastReading ? `Updated ${formatRelativeTime(lastReading, now)}` : "Waiting for readings"}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            aria-label="Refresh dashboard data"
            title="Refresh dashboard data"
            className="flex size-10 items-center justify-center rounded-lg border border-line bg-surface text-ink-muted outline-none transition hover:border-brand/40 hover:text-brand focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 sm:size-9"
          >
            <Icon name="refresh-cw" className={refreshing ? "size-4.5 animate-spin" : "size-4.5"} />
          </button>
        </div>
      </div>

      {sensorsStatus === "ready" && sensorsError ? (
        <div className="border-t border-danger/20 bg-danger-soft px-4 py-1.5 text-center text-[11px] text-danger sm:px-6 lg:px-8">
          Connection lost: {sensorsError} Showing the last successful readings.
        </div>
      ) : null}
    </header>
  );
}
