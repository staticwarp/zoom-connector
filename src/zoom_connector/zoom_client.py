"""Zoom API client for interacting with Zoom Team Chat."""

import httpx
from typing import Optional, Dict, Any, List
from config import config


class ZoomClient:
    """Client for Zoom Team Chat API."""
    
    BASE_URL = "https://api.zoom.us/v2"
    
    def __init__(self, access_token: Optional[str] = None):
        self.access_token = access_token
        self.client = httpx.Client(timeout=30.0)
    
    def _headers(self) -> Dict[str, str]:
        """Get headers with authorization."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        return headers
    
    def get_access_token(self) -> str:
        """Get OAuth access token using Client Credentials."""
        # For Chatbot apps, we need user OAuth or Server-to-Server OAuth
        # This is a simplified version - full implementation would handle token refresh
        url = f"{self.BASE_URL}/oauth/token"
        
        auth = (config.zoom.client_id, config.zoom.client_secret)
        
        # For Server-to-Server OAuth
        if config.zoom.account_id:
            data = {
                "grant_type": "account_credentials",
                "account_id": config.zoom.account_id
            }
        else:
            # For user-level OAuth, would need authorization code
            # This is a placeholder
            data = {
                "grant_type": "client_credentials"
            }
        
        response = self.client.post(
            url,
            auth=auth,
            data=data
        )
        
        if response.status_code == 200:
            return response.json()["access_token"]
        else:
            raise Exception(f"Failed to get access token: {response.text}")
    
    def send_message(
        self,
        channel_id: str,
        message: str,
        rich_text: Optional[Dict] = None
    ) -> Dict:
        """Send a message to a channel or user."""
        if not self.access_token:
            self.access_token = self.get_access_token()
        
        url = f"{self.BASE_URL}/chat/channels/{channel_id}/messages"
        
        payload = {
            "message": message
        }
        
        if rich_text:
            payload["rich_text"] = rich_text
        
        response = self.client.post(
            url,
            headers=self._headers(),
            json=payload
        )
        
        if response.status_code in (200, 201):
            return response.json()
        else:
            raise Exception(f"Failed to send message: {response.text}")
    
    def send_dm(self, user_id: str, message: str) -> Dict:
        """Send a direct message to a user."""
        if not self.access_token:
            self.access_token = self.get_access_token()
        
        url = f"{self.BASE_URL}/chat/users/me/messages"
        
        payload = {
            "to_user": user_id,
            "message": message
        }
        
        response = self.client.post(
            url,
            headers=self._headers(),
            json=payload
        )
        
        if response.status_code in (200, 201):
            return response.json()
        else:
            raise Exception(f"Failed to send DM: {response.text}")
    
    def list_channels(self) -> List[Dict]:
        """List channels the bot is in."""
        if not self.access_token:
            self.access_token = self.get_access_token()
        
        url = f"{self.BASE_URL}/chat/channels"
        
        response = self.client.get(
            url,
            headers=self._headers()
        )
        
        if response.status_code == 200:
            return response.json().get("channels", [])
        else:
            raise Exception(f"Failed to list channels: {response.text}")
    
    def get_channel(self, channel_id: str) -> Dict:
        """Get channel details."""
        if not self.access_token:
            self.access_token = self.get_access_token()
        
        url = f"{self.BASE_URL}/chat/channels/{channel_id}"
        
        response = self.client.get(
            url,
            headers=self._headers()
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to get channel: {response.text}")
    
    def get_user(self, user_id: str = "me") -> Dict:
        """Get user info."""
        if not self.access_token:
            self.access_token = self.get_access_token()
        
        url = f"{self.BASE_URL}/users/{user_id}"
        
        response = self.client.get(
            url,
            headers=self._headers()
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to get user: {response.text}")
    
    def create_rich_message(
        self,
        channel_id: str,
        title: str,
        subtitle: str,
        content: str,
        buttons: Optional[List[Dict]] = None
    ) -> Dict:
        """Create a rich message with cards."""
        if not self.access_token:
            self.access_token = self.get_access_token()
        
        url = f"{self.BASE_URL}/chat/channels/{channel_id}/messages"
        
        # Build rich text structure
        rich_text = {
            "head": {
                "type": "section",
                "sections": [
                    {
                        "type": "message",
                        "text": f"**{title}**\n_{subtitle}_"
                    }
                ]
            },
            "body": {
                "type": "message",
                "text": content
            }
        }
        
        if buttons:
            # Add actions/buttons
            rich_text["actions"] = {
                "type": "button",
                "buttons": [
                    {
                        "text": btn["text"],
                        "value": btn.get("value", ""),
                        "command": btn.get("command", "")
                    }
                    for btn in buttons
                ]
            }
        
        payload = {
            "rich_text": rich_text
        }
        
        response = self.client.post(
            url,
            headers=self._headers(),
            json=payload
        )
        
        if response.status_code in (200, 201):
            return response.json()
        else:
            raise Exception(f"Failed to send rich message: {response.text}")
    
    def reply_to_thread(
        self,
        channel_id: str,
        message_id: str,
        message: str
    ) -> Dict:
        """Reply to a message in a thread."""
        if not self.access_token:
            self.access_token = self.get_access_token()
        
        url = f"{self.BASE_URL}/chat/channels/{channel_id}/messages/{message_id}/reply"
        
        payload = {
            "message": message
        }
        
        response = self.client.post(
            url,
            headers=self._headers(),
            json=payload
        )
        
        if response.status_code in (200, 201):
            return response.json()
        else:
            raise Exception(f"Failed to reply to thread: {response.text}")
