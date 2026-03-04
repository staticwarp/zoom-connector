# zoom-connector
A chatbot connector for Zoom Team Chat and OpenClaw.

## Setup

1. **Create Zoom Chatbot App** in Zoom Marketplace:
   - Go to https://marketplace.zoom.us/
   - Create "Chatbot" app
   - Get Client ID + Client Secret
   - Set Redirect URL: `https://your-domain.com/oauth/callback`
   - Setwhitelist: `https://your-domain.com`

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure:**
   ```bash
   cp .env.example .env
   # Edit .env with your Zoom credentials
   ```

4. **Run with ngrok for development:**
   ```bash
   ngrok http 8000
   # Update Zoom app with your ngrok URL
   ```

5. **Start the server:**
   ```bash
   python -m zoom_connector.server
   ```

## Bot Commands

| Command | Description |
|---------|-------------|
| `@bot help` | Show available commands |
| `@bot list channels` | List connected channels |
| `@bot join #channel` | Join a channel |
| `@bot leave` | Leave current channel |
| `@bot status` | Show bot status |

## Architecture

```
Users in Zoom Team Chat
         │
         ▼
   Zoom Chatbot API
         │
         ▼
   zoom-connector Server
         │
         ▼
   OpenClaw Gateway
```

## Requirements

- Python 3.9+
- Zoom Chatbot App credentials
- ngrok (for local development)

## Development

```bash
# Run tests
pytest tests/

# Format code
black src/
```
