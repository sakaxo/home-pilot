"use client"

import * as React from "react"

import { useNow } from "@/hooks/use-now"
import { DEVICE_CONTROLS } from "@/lib/data/definitions"
import { fetchDevice, updateDeviceState } from "@/lib/data/api"
import { PageHeader } from "@/components/common/page-header"
import { SectionHeading } from "@/components/common/section-heading"
import { LoadingState, SkeletonCard } from "@/components/common/loading-state"
import { ErrorState } from "@/components/common/error-state"
import { Icon } from "@/components/common/icon"
import { StatusBadge } from "@/components/common/status-badge"
import { DeviceCard } from "@/components/devices/device-card"

const POLL_INTERVAL_MS = 2000

export default function ControlsPage() {
  const now = useNow()
  const [device, setDevice] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [loaded, setLoaded] = React.useState(false)
  const [loadError, setLoadError] = React.useState(null)
  const [requestError, setRequestError] = React.useState(null)
  const [sending, setSending] = React.useState({})

  const mountedRef = React.useRef(false)
  const inFlightRef = React.useRef(false)

  const loadDevice = React.useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true

    try {
      const nextDevice = await fetchDevice()
      if (!mountedRef.current) return
      setDevice(nextDevice)
      setLoadError(null)
      setLoaded(true)
    } catch (error) {
      if (!mountedRef.current) return
      setLoadError(error?.message || "Could not reach the HomePilot API.")
    } finally {
      inFlightRef.current = false
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    mountedRef.current = true
    const initialTimer = setTimeout(loadDevice, 0)
    const pollTimer = setInterval(loadDevice, POLL_INTERVAL_MS)

    return () => {
      mountedRef.current = false
      clearTimeout(initialTimer)
      clearInterval(pollTimer)
    }
  }, [loadDevice])

  const requestState = React.useCallback(
    async (controlId, target) => {
      setRequestError(null)
      setSending((current) => ({ ...current, [controlId]: true }))

      try {
        await updateDeviceState({ [`${controlId}_state`]: target })
        await loadDevice()
      } catch (error) {
        if (!mountedRef.current) return
        setRequestError(
          error?.message || "The request could not be sent to the backend."
        )
      } finally {
        if (mountedRef.current) {
          setSending((current) => ({ ...current, [controlId]: false }))
        }
      }
    },
    [loadDevice]
  )

  const connection = loading
    ? { tone: "neutral", label: "Connecting" }
    : loadError
      ? { tone: "danger", label: "Connection lost" }
      : { tone: "neutral", label: "Backend connected" }

  const statusBadge = (
    <StatusBadge tone={connection.tone} dot>
      {connection.label}
    </StatusBadge>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Device Control"
          description="Loading the room device from the HomePilot API."
          actions={statusBadge}
        />
        <LoadingState label="Loading the room device…" />
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (loadError && !loaded) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Device Control"
          description="Device data could not be loaded."
          actions={statusBadge}
        />
        <ErrorState
          title="Device data is unavailable"
          description={loadError}
          onRetry={loadDevice}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Device Control"
        description="Control the room device and view its current state."
        actions={statusBadge}
      />

      {loadError ? (
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
              {loadError} Showing the last successfully retrieved state. Polling
              retries automatically every 5 seconds.
            </p>
          </div>
          <button
            type="button"
            onClick={loadDevice}
            className="shrink-0 rounded-md border border-danger/25 bg-surface px-2.5 py-1 text-xs font-medium text-danger outline-none hover:bg-danger-soft focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            Retry now
          </button>
        </div>
      ) : null}

      {requestError ? (
        <div
          className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3"
          role="alert"
        >
          <Icon
            name="circle-alert"
            className="mt-0.5 size-4 shrink-0 text-danger"
          />
          <p className="text-xs leading-relaxed text-ink">
            The request could not be sent: {requestError}
          </p>
        </div>
      ) : null}

      <section aria-labelledby="controls-devices">
        <SectionHeading
          id="controls-devices"
          title="Devices"
          description="Updates automatically every 5 seconds."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {DEVICE_CONTROLS.map((control) => (
            <DeviceCard
              key={control.id}
              control={control}
              device={device}
              now={now}
              sending={Boolean(sending[control.id])}
              onRequest={(target) => requestState(control.id, target)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
