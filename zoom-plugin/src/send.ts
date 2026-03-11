/**
 * Send messages to Zoom Team Chat via the Chatbot API.
 */

import type { OpenClawConfig } from "openclaw/plugin-sdk/core";

export type ZoomChannelConfig = {
  enabled?: boolean;
  clientId?: string;
  clientSecret?: string;
  webhooksSecretToken?: string;
  /** Bot JID from Zoom app (e.g. from first inbound or app dashboard). Required for outbound. */
  robotJid?: string;
  /** Account ID from Zoom. Required for outbound. */
  accountId?: string;
  webhook?: { port?: number; path?: string };
  dmPolicy?: string;
  allowFrom?: string[];
  groupPolicy?: string;
  groupAllowFrom?: string[];
  requireMention?: boolean;
};

export type ResolvedZoomCredentials = {
  clientId: string;
  clientSecret: string;
  webhooksSecretToken: string;
};

export function resolveZoomCredentials(
  cfg: ZoomChannelConfig | undefined
): ResolvedZoomCredentials | null {
  if (!cfg?.clientId?.trim() || !cfg?.clientSecret?.trim() || !cfg?.webhooksSecretToken?.trim()) {
    return null;
  }
  return {
    clientId: cfg.clientId.trim(),
    clientSecret: cfg.clientSecret.trim(),
    webhooksSecretToken: cfg.webhooksSecretToken.trim(),
  };
}

export type SendZoomMessageParams = {
  cfg: OpenClawConfig;
  to: string;
  text: string;
  robotJid?: string;
  accountId?: string;
  userJid?: string;
};

export type SendZoomMessageResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

/**
 * Send a text message to Zoom. The `to` can be a user JID (for DM) or channel ID.
 * Requires a Zoom ChatbotClient instance - we pass the send function from the monitor.
 */
export async function sendMessageZoom(
  chatbotClient: { endpoints: { messages: { sendChatbotMessage: (opts: { body: Record<string, unknown> }) => Promise<{ data?: { id?: string } }> } } },
  params: {
    toJid: string;
    robotJid: string;
    accountId: string;
    userJid: string;
    text: string;
  }
): Promise<SendZoomMessageResult> {
  try {
    const content = {
      head: { text: "" },
      body: [{ type: "message" as const, text: params.text }],
    };
    const response = await chatbotClient.endpoints.messages.sendChatbotMessage({
      body: {
        robot_jid: params.robotJid,
        account_id: params.accountId,
        to_jid: params.toJid,
        user_jid: params.userJid,
        content,
      },
    });
    return {
      ok: true,
      messageId: response.data?.id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
