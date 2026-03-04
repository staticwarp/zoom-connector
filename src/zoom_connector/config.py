"""Configuration for Zoom Connector."""

import os
from pathlib import Path
from typing import Optional
from pydantic import BaseModel
from dotenv import load_dotenv


# Load .env file
load_dotenv()


class ZoomConfig(BaseModel):
    """Zoom API configuration."""
    # For OAuth flow - just need the App ID
    app_id: str = os.getenv("ZOOM_APP_ID", "")
    
    # Optional: Client secret if not using pure OAuth flow
    client_secret: Optional[str] = os.getenv("ZOOM_CLIENT_SECRET", "")
    
    redirect_uri: str = os.getenv("ZOOM_REDIRECT_URI", "http://localhost:8000/oauth/callback")
    
    # OAuth settings
    oauth_url: str = "https://zoom.us/oauth/authorize"
    token_url: str = "https://zoom.us/oauth/token"


class OpenClawConfig(BaseModel):
    """OpenClaw gateway configuration."""
    url: str = os.getenv("OPENCLAW_URL", "http://localhost:8080")
    api_key: Optional[str] = os.getenv("OPENCLAW_API_KEY", "")


class ServerConfig(BaseModel):
    """Server configuration."""
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    debug: bool = os.getenv("DEBUG", "true").lower() == "true"


class Config(BaseModel):
    """Main configuration."""
    zoom: ZoomConfig = ZoomConfig()
    openclaw: OpenClawConfig = OpenClawConfig()
    server: ServerConfig = ServerConfig()
    bot_name: str = os.getenv("BOT_NAME", "Zoom Team Chat Integration")


# Global config instance
config = Config()
