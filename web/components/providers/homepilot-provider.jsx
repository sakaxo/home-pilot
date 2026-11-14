"use client";

import * as React from "react";

import { fetchSensorReadings } from "@/lib/data/api";

const HomePilotContext = React.createContext(null);

const INITIAL_STATE = {
  sensors: {},
  sensorsLoading: true,
  sensorsLoaded: false,
  sensorsError: null,
};

function sessionReducer(state, action) {
  switch (action.type) {
    case "sensors/success":
      return {
        ...state,
        sensors: action.sensors,
        sensorsLoading: false,
        sensorsLoaded: true,
        sensorsError: null,
      };

    case "sensors/error":
      // Keep the last successful readings when a poll fails. The next poll
      // clears the error automatically.
      return { ...state, sensorsLoading: false, sensorsError: action.message };

    default:
      return state;
  }
}

export function HomePilotProvider({ children }) {
  const [session, dispatch] = React.useReducer(sessionReducer, INITIAL_STATE);
  const [refreshing, setRefreshing] = React.useState(false);
  const mountedRef = React.useRef(false);
  const sensorsInFlightRef = React.useRef(false);

  const loadSensors = React.useCallback(async () => {
    if (sensorsInFlightRef.current) return;
    sensorsInFlightRef.current = true;

    try {
      const sensors = await fetchSensorReadings();
      if (!mountedRef.current) return;
      dispatch({ type: "sensors/success", sensors });
    } catch (error) {
      if (!mountedRef.current) return;
      dispatch({
        type: "sensors/error",
        message: error?.message || "Could not reach the HomePilot API.",
      });
    } finally {
      sensorsInFlightRef.current = false;
    }
  }, []);

  // Load once so the shared header always has something to show. The Sensors
  // page owns the recurring poll and cleans it up when that page unmounts.
  React.useEffect(() => {
    mountedRef.current = true;
    loadSensors();

    return () => {
      mountedRef.current = false;
    };
  }, [loadSensors]);

  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await loadSensors();
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, [loadSensors]);

  const value = React.useMemo(
    () => ({
      sensors: session.sensors,
      sensorsStatus: session.sensorsLoading
        ? "loading"
        : session.sensorsError && !session.sensorsLoaded
          ? "error"
          : "ready",
      sensorsError: session.sensorsError,
      refreshing,
      refresh,
      refreshSensors: loadSensors,
    }),
    [session, refreshing, refresh, loadSensors],
  );

  return <HomePilotContext.Provider value={value}>{children}</HomePilotContext.Provider>;
}

export function useHomePilot() {
  const context = React.useContext(HomePilotContext);
  if (!context) {
    throw new Error("useHomePilot must be used within a HomePilotProvider");
  }
  return context;
}
