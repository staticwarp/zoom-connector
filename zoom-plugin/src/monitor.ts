/**
 * Zoom Rivet ChatbotClient monitor - starts webhook server and handles events.
 */

import { ChatbotClient } from "@zoom/rivet/chatbot";
import {
  createAccountStatusSink,
  keepHttpServerTaskAlive,
  runPassiveAccountLifecycle,
} from "openclaw/plugin-sdk";
import { resolveZoomCredentials } from "./send.js";
import { resolveZoomAccount } from "./accounts.js";
import { handleZoomInbound } from "./inbound.js";
import { getZoomRuntime } from "./runtime.js";
import type { ZoomBotNotificationPayload } from "./types.js";
import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import type { RuntimeEnv } from "openclaw/plugin-sdk";

export type MonitorZoomOpts = {
  cfg: OpenClawConfig;
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
};

export async function monitorZoomProvider(opts: MonitorZoomOpts): Promise<{ stop: () => void }> {
  const core = getZoomRuntime();
  const cfg = opts.cfg;
  const zoomCfg = (cfg.channels as Record<string, { clientId?: string; clientSecret?: string; webhooksSecretToken?: string; webhook?: { port?: number } }>)?.["zoom"];

  if (!zoomCfg?.enabled) {
    core.logging.getChildLogger({ name: "zoom" }).debug?.("zoom provider disabled");
    return { stop: () => {} };
  }

  const creds = resolveZoomCredentials(zoomCfg);
  if (!creds) {
    core.logging.getChildLogger({ name: "zoom" }).error("zoom credentials not configured");
    return { stop: () => {} };
  }

  const account = resolveZoomAccount(cfg);
  const port = zoomCfg.webhook?.port ?? 3980;
  const log = core.logging.getChildLogger({ name: "zoom", accountId: account.accountId });

  log.info(`starting Zoom Rivet chatbot (port ${port})`);

  const chatbotClient = new ChatbotClient({
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    webhooksSecretToken: creds.webhooksSecretToken,
    port,
  });

  chatbotClient.webEventConsumer.event("bot_notification", (response: { payload?: ZoomBotNotificationPayload }) => {
    const payload = response.payload ?? response as unknown as ZoomBotNotificationPayload;
    if (!payload) return;

    const flattened: ZoomBotNotificationPayload = {
      ...payload,
      ...(typeof payload.payload === "object" ? payload.payload : {}),
    };

    void handleZoomInbound({
      payload: flattened,
      account,
      config: cfg,
      runtime: opts.runtime ?? {
        log: (msg) => log.info(String(msg)),
        error: (msg) => log.error(String(msg)),
        exit: (code: number): never => {
          throw new Error(`exit ${code}`);
        },
      },
      chatbotClient,
      statusSink: opts.statusSink,
    }).catch((err) => {
      log.error(`zoom inbound error: ${String(err)}`);
    });
  });

  const server = await chatbotClient.start();
  log.info(`zoom provider started on port ${port}`);

  const shutdown = async (): Promise<void> => {
    log.info("shutting down zoom provider");
    return new Promise((resolve) => {
      if (server && typeof server.close === "function") {
        server.close((err?: Error) => {
          if (err) log.debug?.(`zoom server close error: ${String(err)}`);
          resolve();
        });
      } else {
        resolve();
      }
    });
  };

  await keepHttpServerTaskAlive({
    server: server as import("node:http").Server,
    abortSignal: opts.abortSignal,
    onAbort: shutdown,
  });

  return {
    stop: () => {
      void shutdown();
    },
  };
}
