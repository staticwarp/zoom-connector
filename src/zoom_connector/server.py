"""
Main FastAPI server for Zoom Connector.

Handles:
- Webhooks from Zoom
- OAuth callbacks
- Message processing
- Channel management
"""

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
import httpx
import json
import logging
from typing import Optional
from datetime import datetime

from .config import config
from .channels import registry
from .zoom_client import ZoomClient


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


app = FastAPI(title="Zoom Connector", version="1.0.0")

# Global state
access_token: Optional[str] = None
zoom_client: Optional[ZoomClient] = None


def get_zoom_client() -> ZoomClient:
    """Get or create Zoom client."""
    global zoom_client, access_token
    
    if zoom_client is None:
        zoom_client = ZoomClient()
    
    # Get fresh token if needed
    if not access_token:
        try:
            access_token = zoom_client.get_access_token()
            zoom_client.access_token = access_token
        except Exception as e:
            logger.error(f"Failed to get access token: {e}")
    
    return zoom_client


# === Webhook Endpoints ===

@app.get("/")
async def root():
    """Health check."""
    return {
        "status": "running",
        "bot_name": config.bot_name,
        "channels": len(registry.list_all()),
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/webhook")
async def webhook_verify(request: Request):
    """
    Zoom sends a GET request to verify the webhook endpoint.
    Must return the challenge param.
    """
    challenge = request.query_params.get("challenge")
    if challenge:
        return challenge
    return {"error": "No challenge provided"}


@app.post("/webhook")
async def webhook_handler(request: Request):
    """Handle incoming Zoom webhook events."""
    try:
        payload = await request.json()
        logger.info(f"Received webhook: {payload}")
        
        event_type = payload.get("event")
        
        if event_type == "endpoint_url_validation":
            # Validate webhook URL
            return {"plainToken": payload.get("plainToken")}
        
        elif event_type == "bot_notification":
            # Bot received a message
            return await handle_bot_notification(payload)
        
        elif event_type == "channel_notification":
            # Message in a channel where bot is present
            return await handle_channel_message(payload)
        
        elif event_type == "chat_notification":
            # Direct message to bot
            return await handle_dm(payload)
        
        else:
            logger.info(f"Unhandled event type: {event_type}")
        
        return {"status": "ok"}
    
    except Exception as e:
        logger.error(f"Error handling webhook: {e}")
        return {"status": "error", "message": str(e)}


async def handle_bot_notification(payload: dict) -> dict:
    """Handle when bot is @mentioned or receives a message."""
    message_data = payload.get("payload", {}).get("message", {})
    sender = payload.get("payload", {}).get("sender", {})
    
    channel_id = message_data.get("channel_id")
    message_text = message_data.get("body", "")
    message_id = message_data.get("id")
    
    # Update channel activity
    if channel_id:
        registry.update_activity(channel_id)
    
    # Process the message
    await process_message(
        text=message_text,
        sender_id=sender.get("id"),
        sender_name=sender.get("name"),
        channel_id=channel_id,
        message_id=message_id
    )
    
    return {"status": "processed"}


async def handle_channel_message(payload: dict) -> dict:
    """Handle message in a channel."""
    message_data = payload.get("payload", {}).get("message", {})
    channel_id = message_data.get("channel_id")
    
    # Update activity
    if channel_id:
        registry.update_activity(channel_id)
    
    return {"status": "ok"}


async def handle_dm(payload: dict) -> dict:
    """Handle direct message to bot."""
    message_data = payload.get("payload", {}).get("message", {})
    sender = payload.get("payload", {}).get("sender", {})
    
    message_text = message_data.get("body", "")
    sender_id = sender.get("id")
    
    await process_message(
        text=message_text,
        sender_id=sender_id,
        sender_name=sender.get("name"),
        channel_id=None,
        message_id=message_data.get("id"),
        is_dm=True
    )
    
    return {"status": "ok"}


async def process_message(
    text: str,
    sender_id: str,
    sender_name: str,
    channel_id: Optional[str],
    message_id: Optional[str],
    is_dm: bool = False
):
    """Process incoming message and generate response."""
    client = get_zoom_client()
    
    # Strip @mention if present
    if text.startswith(f"@{config.bot_name}"):
        text = text[len(config.bot_name):].strip()
    
    # Parse command
    response_text = ""
    
    if text.lower() in ("help", "?"):
        response_text = get_help_text()
    
    elif text.lower().startswith("join "):
        # Join a channel
        channel_name = text[5:].strip().lstrip("#")
        try:
            # In reality, would need to add bot to channel via API
            channel_id = f"channel_{channel_name}"  # Placeholder
            registry.add(channel_id, channel_name)
            response_text = f"✅ Joined channel #{channel_name}"
        except Exception as e:
            response_text = f"❌ Failed to join channel: {e}"
    
    elif text.lower() in ("leave", "part"):
        if channel_id:
            registry.remove(channel_id)
            response_text = "✅ Left channel"
        else:
            response_text = "❌ Not in a channel"
    
    elif text.lower() in ("channels", "list channels"):
        response_text = registry.get_summary()
    
    elif text.lower() in ("status", "ping"):
        response_text = f"✅ {config.bot_name} is running!\n"
        response_text += f"Connected to {len(registry.list_all())} channel(s)\n"
        response_text += f"Uptime: {datetime.utcnow().isoformat()}"
    
    else:
        # Forward to OpenClaw for AI response
        try:
            response_text = await forward_to_openclaw(text, sender_name)
        except Exception as e:
            logger.error(f"OpenClaw request failed: {e}")
            response_text = f"Sorry, I couldn't process that request. Error: {e}"
    
    # Send response
    try:
        if is_dm:
            client.send_dm(sender_id, response_text)
        elif channel_id:
            client.send_message(channel_id, response_text)
    except Exception as e:
        logger.error(f"Failed to send response: {e}")


async def forward_to_openclaw(message: str, user_name: str) -> str:
    """Forward message to OpenClaw and get response."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{config.openclaw.url}/api/message",
                json={
                    "message": f"From {user_name} via Zoom: {message}",
                    "channel": "zoom"
                },
                headers={"Authorization": f"Bearer {config.openclaw.api_key}"} if config.openclaw.api_key else {}
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get("response", "OK")
            else:
                return f"OpenClaw returned: {response.status_code}"
    
    except Exception as e:
        # Fallback - return a message indicating OpenClaw is not connected
        return f"I received your message but couldn't reach OpenClaw. ({e})"


def get_help_text() -> str:
    """Get help text for bot commands."""
    return f"""**{config.bot_name} Commands:**

• `@{config.bot_name} help` - Show this help
• `@{config.bot_name} status` - Show bot status
• `@{config.bot_name} join #channel` - Join a channel
• `@{config.bot_name} leave` - Leave current channel
• `@{config.bot_name} channels` - List connected channels
• `@{config.bot_name} <message>` - Chat with me!

**Note:** I can also forward messages to OpenClaw for AI responses."""


# === OAuth Endpoints ===

@app.get("/oauth/callback")
async def oauth_callback(code: str, state: Optional[str] = None):
    """Handle OAuth callback from Zoom."""
    global access_token, zoom_client
    
    try:
        # Exchange code for token
        zoom_client = ZoomClient()
        
        # In a real implementation, you'd exchange the code for tokens
        # This is simplified
        
        return {
            "status": "success",
            "message": "Authentication successful! You can close this window."
        }
    
    except Exception as e:
        logger.error(f"OAuth error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# === Channel Management ===

@app.get("/api/channels")
async def list_channels():
    """List all connected channels."""
    return {
        "channels": [
            {
                "id": ch.id,
                "name": ch.name,
                "joined_at": ch.joined_at,
                "message_count": ch.message_count
            }
            for ch in registry.list_all()
        ]
    }


@app.post("/api/channels/{channel_id}/join")
async def join_channel(channel_id: str, name: str):
    """Manually add a channel."""
    registry.add(channel_id, name)
    return {"status": "joined", "channel_id": channel_id, "name": name}


@app.post("/api/channels/{channel_id}/leave")
async def leave_channel(channel_id: str):
    """Leave a channel."""
    registry.remove(channel_id)
    return {"status": "left", "channel_id": channel_id}


# === Main ===

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.server.host, port=config.server.port)
