/**
 * Zoom webhook payload types.
 * Based on Zoom Rivet bot_notification event structure.
 */

export type ZoomBotNotificationPayload = {
  event?: string;
  payload?: {
    userId?: string;
    user_id?: string;
    userName?: string;
    user_name?: string;
    userJid?: string;
    user_jid?: string;
    toJid?: string;
    to_jid?: string;
    robotJid?: string;
    robot_jid?: string;
    accountId?: string;
    account_id?: string;
    cmd?: string;
    plainText?: string;
    plain_text?: string;
    messageId?: string;
    message_id?: string;
    channelId?: string;
    channel_id?: string;
    channelName?: string;
    channel_name?: string;
    isChannel?: boolean;
    [key: string]: unknown;
  };
  userId?: string;
  user_id?: string;
  userName?: string;
  user_name?: string;
  userJid?: string;
  user_jid?: string;
  toJid?: string;
  to_jid?: string;
  robotJid?: string;
  robot_jid?: string;
  accountId?: string;
  account_id?: string;
  cmd?: string;
  plainText?: string;
  plain_text?: string;
  messageId?: string;
  message_id?: string;
  channelId?: string;
  channel_id?: string;
  channelName?: string;
  channel_name?: string;
  isChannel?: boolean;
  [key: string]: unknown;
};
