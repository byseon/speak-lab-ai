"""Tavus webhook handler — closes the call -> report loop.

Tavus POSTs events to your `callback_url`. This routes them:
  - `conversation.tool_call` (submit_ielts_assessment) -> Scorecard (tavus_tools)
  - `application.recording_ready` -> stash the audio URI for the pronunciation pipeline
  - `application.transcription_ready` / others -> recorded for visibility

A `ConversationStore` keeps per-conversation state. Pure stdlib; no network here —
the HTTP plumbing lives in examples/live_demo.py (`/webhook`).

Local testing: expose the server with a tunnel (`ngrok http 8000`) and set
TAVUS_CALLBACK_URL to the https URL. NOTE: for the assessment tool_call to reach this
webhook (rather than the browser), register it with API delivery; with the default
`app_message` delivery the tool_call goes to the client over the data channel.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from .schema import Scorecard
from .tavus_tools import scorecard_from_event, TOOL_NAME


@dataclass
class ConversationState:
    conversation_id: str
    scorecard: Optional[Scorecard] = None
    recording_uri: str = ""
    events: list[str] = field(default_factory=list)


class ConversationStore:
    """In-memory per-conversation state. Swap for a DB keyed by username in prod."""

    def __init__(self) -> None:
        self._d: dict[str, ConversationState] = {}

    def get(self, cid: str) -> ConversationState:
        return self._d.setdefault(cid, ConversationState(cid))

    def all(self) -> dict[str, ConversationState]:
        return self._d


def _event_type(e: dict) -> str:
    return e.get("event_type") or e.get("type") or e.get("message_type") or ""


def _conversation_id(e: dict) -> str:
    return (e.get("conversation_id")
            or e.get("properties", {}).get("conversation_id", "")
            or "")


def handle_event(event: dict, store: ConversationStore) -> dict[str, Any]:
    """Route one Tavus webhook event; update `store`; return a small ack dict."""
    et = _event_type(event)
    cid = _conversation_id(event)
    state = store.get(cid) if cid else None
    if state and et:
        state.events.append(et)

    # The PAL's assessment tool call -> Scorecard
    is_toolcall = et in ("conversation.tool_call", "conversation.toolcall") \
        or event.get("tool_name") == TOOL_NAME
    if is_toolcall:
        payload = event if event.get("tool_name") else event.get("properties", event)
        try:
            card = scorecard_from_event(payload)
        except Exception as e:  # not our tool, or malformed args
            return {"ok": False, "handled": "tool_call", "error": str(e)}
        if state:
            state.scorecard = card
        return {"ok": True, "handled": "tool_call",
                "conversation_id": cid, "overall_band": card.overall_band}

    # Recording is ready -> the audio the pronunciation/GOP pipeline needs
    if et == "application.recording_ready":
        uri = (event.get("properties", {}).get("storage_uri")
               or event.get("storage_uri", ""))
        if state:
            state.recording_uri = uri
        return {"ok": True, "handled": "recording_ready",
                "conversation_id": cid, "recording_uri": uri}

    return {"ok": True, "handled": et or "unknown", "conversation_id": cid}
