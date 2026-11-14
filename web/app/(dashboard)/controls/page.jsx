"use client";

import * as React from "react";

import { useNow } from "@/hooks/use-now";
import { COMMAND_ACTIONS, DEVICE_TYPE_MAP } from "@/lib/data/definitions";
import { fetchCommands, fetchDevices, updateDeviceDesiredState } from "@/lib/data/api";
import { PageHeader } from "@/components/common/page-header";
import { SectionHeading } from "@/components/common/section-heading";
import { LoadingState, SkeletonCard } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { Icon } from "@/components/common/icon";
import { StatusBadge } from "@/components/common/status-badge";
import { DeviceCard } from "@/components/devices/device-card";
import { CommandHistory } from "@/components/devices/command-history";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const POLL_INTERVAL_MS = 5000;

function latestCommandByDevice(commands) {
  const byDevice = {};
  for (const command of commands) {
    if (!byDevice[command.device_id]) byDevice[command.device_id] = command;
  }
  return byDevice;
}

export default function ControlsPage() {
  const now = useNow();
  const [devices, setDevices] = React.useState([]);
  const [commands, setCommands] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loaded, setLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState(null);
  const [commandError, setCommandError] = React.useState(null);
  const [sending, setSending] = React.useState({});

  const mountedRef = React.useRef(false);
  const inFlightRef = React.useRef(false);

  const loadDevices = React.useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const [nextDevices, nextCommands] = await Promise.all([fetchDevices(), fetchCommands()]);
      if (!mountedRef.current) return;
      setDevices(nextDevices);
      setCommands(nextCommands);
      setLoadError(null);
      setLoaded(true);
    } catch (error) {
      if (!mountedRef.current) return;
      setLoadError(error?.message || "Could not reach the HomePilot API.");
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    mountedRef.current = true;
    const initialTimer = setTimeout(loadDevices, 0);
    const pollTimer = setInterval(loadDevices, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearTimeout(initialTimer);
      clearInterval(pollTimer);
    };
  }, [loadDevices]);

  const sendCommand = React.useCallback(
    async (deviceId, actionId) => {
      const action = COMMAND_ACTIONS[actionId];
      if (!action) return;

      setCommandError(null);
      setSending((current) => ({ ...current, [deviceId]: true }));

      try {
        await updateDeviceDesiredState(deviceId, action.target);
        await loadDevices();
      } catch (error) {
        if (!mountedRef.current) return;
        setCommandError(error?.message || "The command could not be sent to the backend.");
      } finally {
        if (mountedRef.current) {
          setSending((current) => ({ ...current, [deviceId]: false }));
        }
      }
    },
    [loadDevices],
  );

  const commandsByDevice = React.useMemo(
    () => latestCommandByDevice(commands),
    [commands],
  );

  const connection = loading
    ? { tone: "neutral", label: "Connecting" }
    : loadError
      ? { tone: "danger", label: "Connection lost" }
      : { tone: "neutral", label: "Backend connected" };

  const statusBadge = (
    <StatusBadge tone={connection.tone} dot>
      {connection.label}
    </StatusBadge>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Device Control"
          description="Loading devices from the HomePilot API."
          actions={statusBadge}
        />
        <LoadingState label="Loading devices…" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
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
          onRetry={loadDevices}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Device Control"
        description="Send on/off requests and see the state each device has actually reported."
        actions={statusBadge}
      />

      {loadError ? (
        <div
          className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3"
          role="alert"
        >
          <Icon name="circle-alert" className="mt-0.5 size-4 shrink-0 text-danger" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink">Connection error</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              {loadError} Showing the last successfully retrieved devices. Polling
              retries automatically every 5 seconds.
            </p>
          </div>
          <button
            type="button"
            onClick={loadDevices}
            className="shrink-0 rounded-md border border-danger/25 bg-surface px-2.5 py-1 text-xs font-medium text-danger outline-none hover:bg-danger-soft focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            Retry now
          </button>
        </div>
      ) : null}

      {commandError ? (
        <div
          className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3"
          role="alert"
        >
          <Icon name="circle-alert" className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-xs leading-relaxed text-ink">
            The command could not be sent: {commandError}
          </p>
        </div>
      ) : null}

      <section aria-labelledby="controls-devices">
        <SectionHeading
          id="controls-devices"
          title="Devices"
          description="Updates automatically every 5 seconds."
        />
        {devices.length === 0 ? (
          <EmptyState
            icon="plug"
            title="No devices registered"
            description="The backend did not return any devices. Register a device in Django, then retry."
            action={
              <button
                type="button"
                onClick={loadDevices}
                className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white outline-none hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                Retry
              </button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                command={commandsByDevice[device.id] || null}
                definition={DEVICE_TYPE_MAP[device.device_type]}
                now={now}
                sending={Boolean(sending[device.id])}
                onSend={(actionId) => sendCommand(device.id, actionId)}
              />
            ))}
          </div>
        )}
      </section>

      <Card>
        <CardHeader divider>
          <div>
            <CardTitle>Command history</CardTitle>
            <CardDescription>Newest first. Status comes from the backend.</CardDescription>
          </div>
          <StatusBadge tone="neutral">
            {commands.length} command{commands.length === 1 ? "" : "s"}
          </StatusBadge>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <CommandHistory commands={commands} now={now} />
        </CardContent>
      </Card>
    </div>
  );
}
