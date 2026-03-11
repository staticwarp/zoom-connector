/**
 * Zoom account resolution.
 */

import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk";
import { resolveZoomCredentials, type ZoomChannelConfig } from "./send.js";

export type ResolvedZoomAccount = {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  config: ZoomChannelConfig;
};

export function listZoomAccountIds(cfg: OpenClawConfig): string[] {
  const zoomCfg = (cfg.channels as Record<string, ZoomChannelConfig>)?.["zoom"];
  if (!zoomCfg) return [];
  return [DEFAULT_ACCOUNT_ID];
}

export function resolveZoomAccount(
  cfg: OpenClawConfig,
  accountId?: string
): ResolvedZoomAccount {
  const zoomCfg = (cfg.channels as Record<string, ZoomChannelConfig>)?.["zoom"];
  const id = accountId ?? DEFAULT_ACCOUNT_ID;
  const enabled = zoomCfg?.enabled !== false;
  const configured = Boolean(resolveZoomCredentials(zoomCfg));
  return {
    accountId: id,
    enabled,
    configured,
    config: zoomCfg ?? {},
  };
}
