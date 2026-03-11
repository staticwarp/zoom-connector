/**
 * Handle inbound Zoom bot_notification webhook events.
 */

import {
  dispatchInboundReplyWithBase,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithCommandGate,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
  GROUP_POLICY_BLOCKED_LABEL,
  createScopedPairingAccess,
  issuePairingChallenge,
  logInboundDrop,
  DEFAULT_ACCOUNT_ID,
  type OpenClawConfig,
  type OutboundReplyPayload,
  type RuntimeEnv,
} from "openclaw/plugin-sdk";
import { getZoomRuntime } from "./runtime.js";
import { sendMessageZoom } from "./send.js";
import type { ResolvedZoomAccount } from "./accounts.js";
import type { ZoomBotNotificationPayload } from "./types.js";

const CHANNEL_ID = "zoom" as const;

function isAllowedSender(allowFrom: string[], senderId: string): boolean {
  const normalized = senderId.trim().toLowerCase();
  for (const entry of allowFrom) {
    const e = String(entry).trim().toLowerCase();
    if (e === "*" || e === normalized) return true;
    if (e.endsWith("*") && normalized.startsWith(e.slice(0, -1))) return true;
  }
  return false;
}

export async function handleZoomInbound(params: {
  payload: ZoomBotNotificationPayload;
  account: ResolvedZoomAccount;
  config: OpenClawConfig;
  runtime: RuntimeEnv;
  chatbotClient: { endpoints: { messages: { sendChatbotMessage: (opts: { body: Record<string, unknown> }) => Promise<{ data?: { id?: string } }> } } };
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
}): Promise<void> {
  const { payload, account, config, runtime, chatbotClient, statusSink } = params;
  const core = getZoomRuntime();

  const rawBody = (payload.cmd || payload.plainText || "").trim();
  if (!rawBody) return;

  const senderId = payload.userId ?? payload.user_jid ?? "";
  const senderName = payload.userName ?? payload.user_name ?? "";
  const toJid = payload.toJid ?? payload.to_jid ?? senderId;
  const robotJid = payload.robotJid ?? payload.robot_jid ?? "";
  const accountId = payload.accountId ?? payload.account_id ?? "";
  const isGroup = Boolean(payload.isChannel ?? payload.channelId ?? payload.channel_id);
  const channelId = payload.channelId ?? payload.channel_id ?? toJid;
  const messageId = payload.messageId ?? payload.message_id ?? "";

  statusSink?.({ lastInboundAt: Date.now() });

  const dmPolicy = (account.config.dmPolicy as string) ?? "pairing";
  const defaultGroupPolicy = resolveDefaultGroupPolicy(config);
  const { groupPolicy, providerMissingFallbackApplied } = resolveAllowlistProviderRuntimeGroupPolicy({
    providerConfigPresent: (config.channels as Record<string, unknown>)?.["zoom"] !== undefined,
    groupPolicy: account.config.groupPolicy as string | undefined,
    defaultGroupPolicy,
  });
  warnMissingProviderGroupPolicyFallbackOnce({
    providerMissingFallbackApplied,
    providerKey: "zoom",
    accountId: account.accountId,
    blockedLabel: GROUP_POLICY_BLOCKED_LABEL.channel,
    log: (msg) => runtime.log?.(msg),
  });

  const configAllowFrom = (account.config.allowFrom ?? []).map(String).filter(Boolean);
  const configGroupAllowFrom = (account.config.groupAllowFrom ?? configAllowFrom).map(String).filter(Boolean);
  const pairing = createScopedPairingAccess({
    core,
    channel: CHANNEL_ID,
    accountId: account.accountId,
  });
  const storeAllowFrom = await readStoreAllowFromForDmPolicy({
    provider: CHANNEL_ID,
    accountId: account.accountId,
    dmPolicy,
    readStore: pairing.readStoreForDmPolicy,
  });

  const access = resolveDmGroupAccessWithCommandGate({
    isGroup,
    dmPolicy,
    groupPolicy,
    allowFrom: configAllowFrom,
    groupAllowFrom: configGroupAllowFrom,
    storeAllowFrom: storeAllowFrom.map(String).filter(Boolean),
    isSenderAllowed: (allowFrom) => isAllowedSender(allowFrom, senderId),
    command: {
      useAccessGroups: (config.commands as Record<string, unknown>)?.useAccessGroups !== false,
      allowTextCommands: core.channel.commands.shouldHandleTextCommands({
        cfg: config,
        surface: CHANNEL_ID,
      }),
      hasControlCommand: core.channel.text.hasControlCommand(rawBody, config),
    },
  });

  if (isGroup) {
    if (access.decision !== "allow") {
      runtime.log?.(`zoom: drop channel sender ${senderId} (reason=${access.reason})`);
      return;
    }
    const groupAllowFrom = configGroupAllowFrom.length > 0 ? configGroupAllowFrom : configAllowFrom;
    if (groupAllowFrom.length > 0 && !isAllowedSender(groupAllowFrom, senderId)) {
      runtime.log?.(`zoom: drop channel sender ${senderId} (not in groupAllowFrom)`);
      return;
    }
  } else {
    if (access.decision !== "allow") {
      if (access.decision === "pairing") {
        await issuePairingChallenge({
          channel: CHANNEL_ID,
          senderId,
          senderIdLine: `Your Zoom user ID: ${senderId}`,
          meta: { name: senderName || undefined },
          upsertPairingRequest: pairing.upsertPairingRequest,
          sendPairingReply: async (text) => {
            const result = await sendMessageZoom(chatbotClient, {
              toJid,
              robotJid,
              accountId,
              userJid: senderId,
              text,
            });
            if (result.ok) statusSink?.({ lastOutboundAt: Date.now() });
          },
          onReplyError: (err) => {
            runtime.error?.(`zoom: pairing reply failed for ${senderId}: ${String(err)}`);
          },
        });
      }
      runtime.log?.(`zoom: drop DM sender ${senderId} (reason=${access.reason})`);
      return;
    }
  }

  if (access.shouldBlockControlCommand) {
    logInboundDrop({
      log: (msg) => runtime.log?.(msg),
      channel: CHANNEL_ID,
      reason: "control command (unauthorized)",
      target: senderId,
    });
    return;
  }

  const requireMention = isGroup && (account.config.requireMention !== false);
  const mentionRegexes = core.channel.mentions.buildMentionRegexes(config);
  const wasMentioned = mentionRegexes.length
    ? core.channel.mentions.matchesMentionPatterns(rawBody, mentionRegexes)
    : false;
  if (isGroup && requireMention && !wasMentioned && !access.commandAuthorized) {
    runtime.log?.(`zoom: drop channel (no mention)`);
    return;
  }

  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: CHANNEL_ID,
    accountId: account.accountId,
    peer: {
      kind: isGroup ? "group" : "direct",
      id: isGroup ? channelId : senderId,
    },
  });

  const fromLabel = isGroup ? `channel:${channelId}` : senderName || `user:${senderId}`;
  const storePath = core.channel.session.resolveStorePath(
    (config.session as Record<string, unknown>)?.store as string | undefined,
    { agentId: route.agentId }
  );
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });
  const body = core.channel.reply.formatAgentEnvelope({
    channel: "Zoom",
    from: fromLabel,
    timestamp: Date.now(),
    previousTimestamp,
    envelope: envelopeOptions,
    body: rawBody,
  });

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    BodyForAgent: rawBody,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: isGroup ? `zoom:channel:${channelId}` : `zoom:${senderId}`,
    To: `zoom:${toJid}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: isGroup ? "group" : "direct",
    ConversationLabel: fromLabel,
    SenderName: senderName || undefined,
    SenderId: senderId,
    GroupSubject: isGroup ? channelId : undefined,
    Provider: CHANNEL_ID,
    Surface: CHANNEL_ID,
    WasMentioned: isGroup ? wasMentioned : undefined,
    MessageSid: messageId,
    Timestamp: Date.now(),
    OriginatingChannel: CHANNEL_ID,
    OriginatingTo: `zoom:${toJid}`,
    CommandAuthorized: access.commandAuthorized,
  });

  async function deliver(payload: OutboundReplyPayload): Promise<void> {
    const combined = formatTextWithAttachmentLinks(
      payload.text,
      resolveOutboundMediaUrls(payload)
    );
    if (!combined) return;
    const result = await sendMessageZoom(chatbotClient, {
      toJid,
      robotJid,
      accountId,
      userJid: senderId,
      text: combined,
    });
    if (result.ok) statusSink?.({ lastOutboundAt: Date.now() });
  }

  await dispatchInboundReplyWithBase({
    cfg: config,
    channel: CHANNEL_ID,
    accountId: account.accountId,
    route,
    storePath,
    ctxPayload,
    core,
    deliver,
    onRecordError: (err) => {
      runtime.error?.(`zoom: failed updating session meta: ${String(err)}`);
    },
    onDispatchError: (err, info) => {
      runtime.error?.(`zoom ${info.kind} reply failed: ${String(err)}`);
    },
  });
}
