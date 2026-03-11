/**
 * Zoom plugin runtime - stores the OpenClaw PluginRuntime for channel access.
 */

import type { PluginRuntime } from "openclaw/plugin-sdk/core";

let zoomRuntime: PluginRuntime | null = null;

export function setZoomRuntime(runtime: PluginRuntime): void {
  zoomRuntime = runtime;
}

export function getZoomRuntime(): PluginRuntime {
  if (!zoomRuntime) {
    throw new Error("Zoom plugin runtime not initialized");
  }
  return zoomRuntime;
}
