# Zoom OpenClaw Plugin

An OpenClaw channel plugin that connects Zoom Team Chat to your OpenClaw agent. Chat with your AI assistant directly from Zoom Team Chat (DMs and channels).

## What This Does

- Connect your OpenClaw agent to **Zoom Team Chat**
- Two-way messaging in channels and DMs
- Uses [Zoom Rivet](https://developers.zoom.us/docs/rivet/javascript/) chatbot API
- All messages forwarded to OpenClaw for AI responses

## Quick Start

### 1. Install the Plugin

```bash
openclaw plugins install ./zoom-plugin
```

### 2. Create Zoom OAuth App

1. Go to [Zoom Marketplace](https://marketplace.zoom.us/) → **Develop** → **Build App** → **OAuth**
2. Create the app and copy **Client ID**, **Client Secret**
3. Enable **Event Subscriptions**, add `bot_notification`, copy **Secret Token**
4. Add scopes: `chat:write`, `chat:read`, `channel:read`, `user:read`

### 3. Configure OpenClaw

Add to `~/.openclaw/openclaw.json`:

```json5
{
  channels: {
    zoom: {
      enabled: true,
      clientId: "<CLIENT_ID>",
      clientSecret: "<CLIENT_SECRET>",
      webhooksSecretToken: "<WEBHOOK_SECRET>",
      webhook: { port: 3980 },
      dmPolicy: "pairing",
    },
  },
}
```

### 4. Expose Webhook (for remote server or local dev)

- **Production**: Point Zoom Event URL to your server (e.g. `https://your-server/`)
- **Local dev**: Use `ngrok http 3980` and set the ngrok URL in Zoom

### 5. Start OpenClaw

```bash
openclaw gateway
```

Then message your bot in Zoom Team Chat. In channels, @mention the bot to trigger responses.

## Project Structure

```
zoom-connector/
├── README.md           # This file
└── zoom-plugin/        # OpenClaw Zoom channel plugin
    ├── package.json
    ├── openclaw.plugin.json
    ├── index.ts
    ├── README.md       # Detailed plugin docs
    └── src/
        ├── channel.ts
        ├── monitor.ts
        ├── inbound.ts
        ├── send.ts
        ├── accounts.ts
        ├── runtime.ts
        └── types.ts
```

## Documentation

- [Zoom Plugin README](zoom-plugin/README.md) — Setup, config, and Zoom Marketplace details
- [Zoom Rivet Docs](https://developers.zoom.us/docs/rivet/javascript/)
- [OpenClaw Plugins](https://docs.openclaw.ai/tools/plugin.md)
