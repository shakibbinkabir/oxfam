"""WebSocket endpoint for real-time updates."""

import asyncio
import json
import logging
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

# Active WebSocket connections
active_connections: Set[WebSocket] = set()


@router.websocket("/api/v1/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time score and data update notifications."""
    await websocket.accept()
    active_connections.add(websocket)
    logger.info(f"WebSocket connected. Active connections: {len(active_connections)}")
    try:
        while True:
            # Keep connection alive, listen for pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        active_connections.discard(websocket)
        logger.info(f"WebSocket disconnected. Active connections: {len(active_connections)}")
    except Exception:
        active_connections.discard(websocket)


async def broadcast_event(event_type: str, payload: dict):
    """Broadcast an event to all connected WebSocket clients."""
    if not active_connections:
        return

    message = json.dumps({"type": event_type, "data": payload})
    disconnected = set()

    for connection in active_connections:
        try:
            await connection.send_text(message)
        except Exception:
            disconnected.add(connection)

    active_connections.difference_update(disconnected)
