"use client";

import * as React from "react";

const listeners = new Set();
// Relative times and freshness only need a coarse clock. Tick at the same
// cadence as the Sensors page polling so "Updated X ago" stays current.
const TICK_INTERVAL_MS = 5000;
let currentTime = null;
let timer = null;

function tick() {
  currentTime = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(listener) {
  if (listeners.size === 0) {
    tick();
    timer = setInterval(tick, TICK_INTERVAL_MS);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot() {
  return currentTime;
}

function getServerSnapshot() {
  return null;
}

export function useNow() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
