"""Channel Registry - Tracks which channels the bot is connected to."""

import json
import os
from pathlib import Path
from typing import List, Optional, Dict
from datetime import datetime
from dataclasses import dataclass, asdict


CHANNELS_FILE = Path("channels.json")


@dataclass
class Channel:
    """Represents a Zoom channel the bot is in."""
    id: str
    name: str
    joined_at: str
    last_activity: str
    message_count: int = 0


class ChannelRegistry:
    """Registry of channels the bot is connected to."""
    
    def __init__(self, storage_path: Path = CHANNELS_FILE):
        self.storage_path = storage_path
        self.channels: Dict[str, Channel] = {}
        self.load()
    
    def load(self):
        """Load channels from storage."""
        if self.storage_path.exists():
            try:
                with open(self.storage_path) as f:
                    data = json.load(f)
                    self.channels = {
                        c["id"]: Channel(**c) 
                        for c in data.get("channels", [])
                    }
            except (json.JSONDecodeError, TypeError):
                self.channels = {}
    
    def save(self):
        """Save channels to storage."""
        data = {
            "channels": [asdict(c) for c in self.channels.values()],
            "updated_at": datetime.utcnow().isoformat()
        }
        with open(self.storage_path, 'w') as f:
            json.dump(data, f, indent=2)
    
    def add(self, channel_id: str, channel_name: str) -> Channel:
        """Add a channel to the registry."""
        now = datetime.utcnow().isoformat()
        channel = Channel(
            id=channel_id,
            name=channel_name,
            joined_at=now,
            last_activity=now
        )
        self.channels[channel_id] = channel
        self.save()
        return channel
    
    def remove(self, channel_id: str) -> bool:
        """Remove a channel from the registry."""
        if channel_id in self.channels:
            del self.channels[channel_id]
            self.save()
            return True
        return False
    
    def get(self, channel_id: str) -> Optional[Channel]:
        """Get a channel by ID."""
        return self.channels.get(channel_id)
    
    def list_all(self) -> List[Channel]:
        """List all registered channels."""
        return list(self.channels.values())
    
    def update_activity(self, channel_id: str):
        """Update last activity timestamp for a channel."""
        if channel_id in self.channels:
            self.channels[channel_id].last_activity = datetime.utcnow().isoformat()
            self.channels[channel_id].message_count += 1
            self.save()
    
    def get_summary(self) -> str:
        """Get a summary of connected channels."""
        if not self.channels:
            return "No channels connected yet."
        
        lines = ["📋 **Connected Channels:**\n"]
        for ch in self.channels.values():
            lines.append(f"  • #{ch.name} (joined {ch.joined_at[:10]}, {ch.message_count} messages)")
        
        lines.append(f"\n**Total:** {len(self.channels)} channel(s)")
        return "\n".join(lines)


# Global registry instance
registry = ChannelRegistry()
