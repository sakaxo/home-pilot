"use client"

import * as React from "react"

import { useNow } from "@/hooks/use-now"
import { useHomePilot } from "@/components/providers/homepilot-provider"
import { SENSOR_DEFINITIONS } from "@/lib/data/definitions"
import { getDashboardStatus, SENSOR_STATUS_LABELS } from "@/lib/freshness"
import { PageHeader } from "@/components/common/page-header"
import { LoadingState, SkeletonCard } from "@/components/common/loading-state"
import { ErrorState } from "@/components/common/error-state"
import { Icon } from "@/components/common/icon"
import { StatusBadge } from "@/components/common/status-badge"
import { SensorCard } from "@/components/sensors/sensor-card"

const PAGE_TITLE = "Sensor monitoring"
const PAGE_DESCRIPTION =
  "Temperature, humidity and ambient light from the HomePilot controller."

// Polling interval for sensor refresh loop
const SENSOR_POLL_INTERVAL_MS = 2000

const STATUS_TONES = {
  live: "success",
  stale: "warning",
  "no-data": "neutral",
  "connection-error": "danger",
}

export default function SensorsPage() {
  const { sensorsStatus, sensorsError, refreshSensors, sensors } =
    useHomePilot()
  const now = useNow()

  React.useEffect(() => {
    refreshSensors()
    const timer = setInterval(refreshSensors, SENSOR_POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [refreshSensors])

  const connectionError = Boolean(sensorsError)
  const pageStatus =
    sensorsStatus === "loading"
      ? "loading"
      : connectionError
        ? "connection-error"
        : getDashboardStatus(sensors, now)

  const statusBadge = (
    <StatusBadge
      tone={pageStatus === "loading" ? "neutral" : STATUS_TONES[pageStatus]}
      dot
    >
      {pageStatus === "loading"
        ? "Connecting"
        : SENSOR_STATUS_LABELS[pageStatus]}
    </StatusBadge>
  )

  if (sensorsStatus === "loading") {
    return (
      <div className="space-y-6">
        <PageHeader
          title={PAGE_TITLE}
          description="Loading the latest readings from the HomePilot API."
          actions={statusBadge}
        />
        <LoadingState label="Loading sensor readings…" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {SENSOR_DEFINITIONS.map((definition) => (
            <SkeletonCard key={definition.id} />
          ))}
        </div>
      </div>
    )
  }

  if (sensorsStatus === "error") {
    return (
      <div className="space-y-6">
        <PageHeader
          title={PAGE_TITLE}
          description="Sensor readings could not be loaded."
          actions={statusBadge}
        />
        <ErrorState
          title="Sensor data is unavailable"
          description={sensorsError}
          onRetry={refreshSensors}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        actions={statusBadge}
      />

      {connectionError ? (
        <div
          className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3"
          role="alert"
        >
          <Icon
            name="circle-alert"
            className="mt-0.5 size-4 shrink-0 text-danger"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink">Connection error</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              {sensorsError} Showing the last successfully retrieved readings.
              Polling retries automatically every 5 seconds.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshSensors}
            className="shrink-0 rounded-md border border-danger/25 bg-surface px-2.5 py-1 text-xs font-medium text-danger outline-none hover:bg-danger-soft focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            Retry now
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SENSOR_DEFINITIONS.map((definition) => (
          <SensorCard
            key={definition.id}
            definition={definition}
            sensor={sensors[definition.id]}
            now={now}
            connectionError={connectionError}
          />
        ))}
      </div>
    </div>
  )
}
