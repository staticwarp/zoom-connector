/**
 * OpenClaw Zoom Team Chat channel plugin.
 *
 * Connects Zoom Team Chat to OpenClaw via Zoom Rivet chatbot.
 * Install: openclaw plugins install ./zoom-plugin
 * Config: channels.zoom in ~/.openclaw/openclaw.json
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { zoomPlugin } from "./src/channel.js";
import { setZoomRuntime } from "./src/runtime.js";

const plugin = {
  id: "zoom",
  name: "Zoom Team Chat",
  description: "Zoom Team Chat channel plugin (Zoom Rivet chatbot)",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setZoomRuntime(api.runtime);
    api.registerChannel({ plugin: zoomPlugin });
  },
};

export default plugin;
