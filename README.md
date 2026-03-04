# zoom-connector

A chatbot connector for Zoom Team Chat and OpenClaw. This enables full two-way communication between your OpenClaw agent and Zoom Team Chat.

## What This Does

- Connect your OpenClaw agent to **Zoom Team Chat**
- Two-way messaging in channels and DMs
- Channel management (join, leave, list)
- All messages forwarded to OpenClaw for AI responses

## Prerequisites

1. **Zoom account** with access to [Zoom Marketplace](https://marketplace.zoom.us/)
2. **ngrok** for local development (to expose your local server to Zoom)
3. **Python 3.9+** on your machine

## Setup Guide

### Step 1: Create Zoom Chatbot App

1. Go to [Zoom Marketplace](https://marketplace.zoom.us/)
2. Sign in with your Zoom account
3. Click **Develop** → **Build App**
4. Choose **Chatbot** app type
5. Fill in the details:
   - **App Name:** OpenClaw Connector (or your preferred name)
   - **App Type:** Chatbot
6. Click **Create**

### Step 2: Configure App Settings

In your Chatbot app settings:

1. **Basic Information:**
   - Add a short description
   - Upload an icon (optional)

2. **OAuth:**
   - Set **Redirect URL:** `https://your-ngrok-url.ngrok-free.app/oauth/callback`
   - (You'll update this after starting ngrok)

3. **Whitelist:**
   - Add: `https://your-ngrok-url.ngrok-free.app`

4. **Scopes:** Enable these:
   - `chat:write` - Send messages
   - `chat:read` - Read messages
   - `channel:read` - List channels
   - `user:read` - Get user info

5. **App ID:** Copy this (you'll provide it to the config)

### Step 3: Get Your App ID

After creating the app, you'll see an **App ID** (also called Client ID). Copy it.

### Step 4: Configure the Connector

```bash
# Clone and enter the project
git clone https://github.com/staticwarp/zoom-connector.git
cd zoom-connector

# Copy the example config
cp .env.example .env
```

Edit `.env`:
```bash
# Required: Your Zoom App ID (from Step 2)
ZOOM_APP_ID=your_app_id_here

# Optional: Bot name (default: "Zoom Team Chat Integration")
BOT_NAME=OpenClaw

# OpenClaw Gateway (if different)
OPENCLAW_URL=http://localhost:8080
OPENCLAW_API_KEY=

# Server (usually fine as-is)
HOST=0.0.0.0
PORT=8000
```

### Step 5: Start ngrok

```bash
# Start ngrok to expose your local server
ngrok http 8000
```

Copy your ngrok URL (e.g., `https://abc123.ngrok-free.app`).

### Step 6: Update Zoom App with ngrok URL

1. Go back to your Zoom Chatbot app in Marketplace
2. Update **Redirect URL** to: `https://your-ngrok-url.ngrok-free.app/oauth/callback`
3. Add to **Whitelist**: `https://your-ngrok-url.ngrok-free.app`
4. Save settings

### Step 7: Start the Server

```bash
# Install dependencies (if not already)
pip install -r requirements.txt

# Run the server
python -m zoom_connector.server
```

### Step 8: Authorize the App

1. The server should now be running and listening for Zoom webhooks
2. Go to your Zoom Team Chat
3. Search for your bot by name and start a chat
4. Or add the bot to a channel

**First time:** You'll be prompted to authorize the app via OAuth. Click Accept/Authorize.

---

## Bot Commands

In any channel or DM with the bot:

| Command | Description |
|---------|-------------|
| `@bot help` | Show available commands |
| `@bot status` | Show bot status |
| `@bot channels` | List connected channels |
| `@bot join #channel` | Join a channel |
| `@bot leave` | Leave current channel |
| `@bot <message>` | Chat with OpenClaw! |

## Updating Configuration

To update later:

```bash
# Edit .env file
nano .env

# Restart the server
# (Ctrl+C to stop, then python -m zoom_connector.server)
```

To change App ID or ngrok URL, just update `.env` and restart.

## Architecture

```
Zoom Team Chat Users
        │
        ▼ (Webhooks)
   Zoom Chatbot API
        │
        ▼
   zoom-connector Server (your machine)
        │
        ▼ (HTTP)
   OpenClaw Gateway
        │
        ▼
   AI Response
```

## Troubleshooting

### "Failed to send message"
- Check that the bot is in the channel
- Verify OAuth token is valid (try restarting the server)

### "Webhook verification failed"
- Make sure ngrok is running
- Check Zoom app has correct Redirect URL and Whitelist

### "Channel not found"
- Use the channel ID, not the channel name
- Bot must be added to the channel first

## Development

```bash
# Run in debug mode
DEBUG=true python -m zoom_connector.server

# Check logs
# The server outputs to stdout
```

## Files

```
zoom-connector/
├── README.md
├── requirements.txt
├── .env.example
├── .env                 # Your config (create from example)
└── src/
    └── zoom_connector/
        ├── __init__.py
        ├── config.py       # Configuration
        ├── channels.py    # Channel registry
        ├── zoom_client.py # Zoom API client
        └── server.py      # Main server
```

## Need Help?

- Zoom Developer Docs: https://developers.zoom.us/
- ngrok docs: https://ngrok.com/docs
