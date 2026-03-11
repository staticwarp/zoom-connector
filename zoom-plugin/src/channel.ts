/**
 * Zoom Team Chat channel plugin for OpenClaw.
 */

import {
  buildAccountScopedDmSecurityPolicy,
  collectAllowlistProviderGroupPolicyWarnings,
  createAccountStatusSink,
  createDefaultChannelRuntimeState,
  buildProbeChannelStatusSummary,
  buildRuntimeAccountStatusSnapshot,
  formatAllowFromLowercase,
  DEFAULT_ACCOUNT_ID,
  type ChannelPlugin,
  type OpenClawConfig,
} from "openclaw/plugin-sdk";
import { resolveZoomCredentials } from "./send.js";
import { listZoomAccountIds, resolveZoomAccount, type ResolvedZoomAccount } from "./accounts.js";
import { getZoomRuntime } from "./runtime.js";
import { monitorZoomProvider } from "./monitor.js";
import type { ZoomChannelConfig } from "./send.js";

const meta = {
  id: "zoom",
  label: "Zoom Team Chat",
  selectionLabel: "Zoom Team Chat (Chatbot)",
  docsPath: "/channels/zoom",
  docsLabel: "zoom",
  blurb: "Connect Zoom Team Chat to OpenClaw via Zoom Rivet chatbot.",
  aliases: ["zoom-chat"],
  order: 70,
} as const;

function normalizeZoomTarget(to: string): string {
  const t = String(to).trim();
  if (t.startsWith("zoom:") || t.startsWith("user:")) return t;
  return `zoom:${t}`;
}

export const zoomPlugin: ChannelPlugin = {
  id: "zoom",
  meta: { ...meta, aliases: [...meta.aliases] },
  capabilities: {
    chatTypes: ["direct", "channel"],
    threads: false,
    media: false,
  },
  reload: { configPrefixes: ["channels.zoom"] },
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      enabled: { type: "boolean" },
      clientId: { type: "string" },
      clientSecret: { type: "string" },
      webhooksSecretToken: { type: "string" },
      webhook: {
        type: "object",
        properties: {
          port: { type: "number" },
          path: { type: "string" },
        },
      },
      robotJid: { type: "string" },
      accountId: { type: "string" },
      dmPolicy: { type: "string" },
      allowFrom: { type: "array", items: { type: "string" } },
      groupPolicy: { type: "string" },
      groupAllowFrom: { type: "array", items: { type: "string" } },
      requireMention: { type: "boolean" },
    },
  },
  config: {
    listAccountIds: (cfg) => listZoomAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveZoomAccount(cfg, accountId),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    setAccountEnabled: ({ cfg, enabled }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        zoom: {
          ...(cfg.channels as Record<string, ZoomChannelConfig>)?.["zoom"],
          enabled,
        },
      },
    }),
    deleteAccount: ({ cfg }) => {
      const next = { ...cfg } as OpenClawConfig;
      const nextChannels = { ...cfg.channels } as Record<string, unknown>;
      delete nextChannels.zoom;
      if (Object.keys(nextChannels).length > 0) {
        next.channels = nextChannels as OpenClawConfig["channels"];
      } else {
        delete next.channels;
      }
      return next;
    },
    isConfigured: (_account, cfg) => Boolean(resolveZoomCredentials((cfg.channels as Record<string, ZoomChannelConfig>)?.["zoom"])),
    describeAccount: (account: ResolvedZoomAccount) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
    }),
    resolveAllowFrom: ({ cfg }) => (cfg.channels as Record<string, ZoomChannelConfig>)?.["zoom"]?.allowFrom ?? [],
    formatAllowFrom: ({ allowFrom }) => formatAllowFromLowercase({ allowFrom }),
  },
  security: {
    collectWarnings: ({ cfg }) =>
      collectAllowlistProviderGroupPolicyWarnings({
        cfg,
        providerConfigPresent: (cfg.channels as Record<string, unknown>)?.["zoom"] !== undefined,
        configuredGroupPolicy: (cfg.channels as Record<string, ZoomChannelConfig>)?.["zoom"]?.groupPolicy,
        surface: "Zoom channels",
        openScope: "any member",
        groupPolicyPath: "channels.zoom.groupPolicy",
        groupAllowFromPath: "channels.zoom.groupAllowFrom",
      }),
    resolveDmPolicy: ({ cfg }) =>
      buildAccountScopedDmSecurityPolicy({
        cfg,
        channelKey: "zoom",
        accountId: DEFAULT_ACCOUNT_ID,
        fallbackAccountId: DEFAULT_ACCOUNT_ID,
        policy: (cfg.channels as Record<string, ZoomChannelConfig>)?.["zoom"]?.dmPolicy as string | undefined,
        allowFrom: (cfg.channels as Record<string, ZoomChannelConfig>)?.["zoom"]?.allowFrom ?? [],
        policyPathSuffix: "dmPolicy",
        normalizeEntry: (raw) => raw.replace(/^zoom:/i, "").trim(),
      }),
  },
  messaging: {
    normalizeTarget: (raw) => normalizeZoomTarget(raw),
    targetResolver: {
      looksLikeId: (raw) => {
        const t = raw.trim();
        return t.length > 0 && (t.includes("@") || t.includes(":") || /^[a-zA-Z0-9_-]+$/.test(t));
      },
      hint: "user JID or channel ID",
    },
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 4000,
    sendText: async ({ cfg, to, text }) => {
      const zoomCfg = (cfg.channels as Record<string, ZoomChannelConfig>)?.["zoom"];
      const creds = resolveZoomCredentials(zoomCfg);
      if (!creds) {
        return { channel: "zoom", ok: false, error: "Zoom not configured" };
      }
      const robotJid = zoomCfg?.robotJid?.trim();
      const accountId = zoomCfg?.accountId?.trim();
      if (!robotJid || !accountId) {
        return {
          channel: "zoom",
          ok: false,
          error: "Zoom robotJid and accountId required for outbound (set from first inbound or app dashboard)",
        };
      }

      const { ChatbotClient } = await import("@zoom/rivet/chatbot");
      const chatbotClient = new ChatbotClient({
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        webhooksSecretToken: creds.webhooksSecretToken,
      });

      const toJid = to.replace(/^zoom:/i, "").replace(/^user:/i, "").trim() || to;
      const { sendMessageZoom } = await import("./send.js");
      const result = await sendMessageZoom(chatbotClient, {
        toJid,
        robotJid,
        accountId,
        userJid: toJid,
        text,
      });

      return { channel: "zoom", ...result };
    },
  },
  status: {
    defaultRuntime: createDefaultChannelRuntimeState(DEFAULT_ACCOUNT_ID, { port: null }),
    buildChannelSummary: ({ snapshot }) =>
      buildProbeChannelStatusSummary(snapshot, {
        port: snapshot.port ?? null,
      }),
    probeAccount: async ({ cfg }) => {
      const creds = resolveZoomCredentials((cfg.channels as Record<string, ZoomChannelConfig>)?.["zoom"]);
      return { configured: Boolean(creds), port: (cfg.channels as Record<string, ZoomChannelConfig>)?.["zoom"]?.webhook?.port ?? 3980 };
    },
    buildAccountSnapshot: ({ account, runtime, probe }) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      ...buildRuntimeAccountStatusSnapshot({ runtime, probe }),
      port: runtime?.port ?? null,
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const { monitorZoomProvider } = await import("./monitor.js");
      const port = (ctx.cfg.channels as Record<string, ZoomChannelConfig>)?.["zoom"]?.webhook?.port ?? 3980;
      ctx.setStatus({ accountId: ctx.accountId, port });
      ctx.log?.info(`starting Zoom provider (port ${port})`);
      const statusSink = createAccountStatusSink({
        accountId: ctx.accountId,
        setStatus: ctx.setStatus,
      });
      return monitorZoomProvider({
        cfg: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        statusSink,
      });
    },
  },
};
