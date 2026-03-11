# OpenClaw Zoom Team Chat Plugin

Connect Zoom Team Chat to your OpenClaw agent via the Zoom Rivet chatbot API.

## Installation

```bash
openclaw plugins install ./zoom-plugin
```

Or from npm (when published):

```bash
openclaw plugins install @openclaw/zoom
```

## Prerequisites

1. **Zoom account** with access to [Zoom Marketplace](https://marketplace.zoom.us/)
2. **Zoom OAuth app** created in the Marketplace (see Setup below)
3. **Public URL** for webhooks (ngrok, Tailscale Funnel, or reverse proxy for local dev)

## Zoom Marketplace Setup

1. Go to [Zoom Marketplace](https://marketplace.zoom.us/)
2. Sign in and click **Develop** → **Build App**
3. Choose **OAuth** app type
4. Fill in app details and create
5. In **App Credentials**, copy:
   - **Client ID**
   - **Client Secret**
6. In **Feature** → **Event Subscriptions**:
   - Enable **Event subscription**
   - Set **Event notification endpoint URL** to `https://your-public-url/` (Zoom Rivet handles the path)
   - Add **Subscribe to bot events**: `bot_notification`
   - Copy the **Secret Token** (webhooks secret)
7. In **Scopes**, add:
   - `chat:write` - Send messages
   - `chat:read` - Read messages
   - `channel:read` - List channels
   - `user:read` - Get user info

## Configuration

Add to `~/.openclaw/openclaw.json`:

```json5
{
  channels: {
    zoom: {
      enabled: true,
      clientId: "<CLIENT_ID>",
      clientSecret: "<CLIENT_SECRET>",
      webhooksSecretToken: "<WEBHOOK_SECRET_TOKEN>",
      webhook: { port: 3980, path: "/" },
      dmPolicy: "pairing",
      allowFrom: [],
      requireMention: true,
    },
  },
}
```

- **clientId**, **clientSecret**, **webhooksSecretToken**: From Zoom Marketplace app
- **webhook.port**: Port for Zoom webhook server (default 3980)
- **dmPolicy**: `pairing` | `allowlist` | `open` | `disabled`
- **allowFrom**: User JIDs for allowlist when using `allowlist` or `open`
- **robotJid**, **accountId**: Set after first inbound (for proactive outbound). Get from Zoom app or first webhook payload.

## Local Development

Zoom cannot reach localhost. Use a tunnel:

```bash
ngrok http 3980
```

Set the ngrok HTTPS URL as your Event notification endpoint in the Zoom app. The Zoom Rivet server runs on the configured port and handles webhook verification automatically.

## Usage

1. Start the OpenClaw gateway: `openclaw gateway`
2. In Zoom Team Chat, find your bot and send a message
3. First-time DMs may require pairing (approve in OpenClaw)
4. In channels, @mention the bot to trigger responses

## Architecture

```
Zoom User → Zoom Team Chat → Zoom Webhook → Zoom Plugin → OpenClaw Agent
                                                              ↓
Zoom User ← Zoom Team Chat ← Zoom API ← Zoom Plugin ← Response
```

## References

- [Zoom Rivet JavaScript](https://developers.zoom.us/docs/rivet/javascript/)
- [Zoom create chatbot](https://developers.zoom.us/docs/team-chat/create-chatbot/)
- [OpenClaw Plugins](https://docs.openclaw.ai/tools/plugin.md)
