"""Pull candidate (user) speech out of a Tavus conversation.

Verified shape (GET /v2/conversations/{id}?verbose=true): the transcript arrives in
the `application.transcription_ready` event as
    properties.transcript = [{"role": "system|user|assistant", "content": "..."}, ...]
The candidate's speech is the `role == "user"` messages.
"""

from __future__ import annotations

from typing import Any

_TRANSCRIPT_KEYS = (
    "transcript",
    "transcripts",
    "messages",
    "conversation_history",
    "conversation",
    "turns",
    "utterances",
)


def _text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        for key in ("content", "text", "transcript", "message"):
            out = _text(value.get(key))
            if out:
                return out
    if isinstance(value, list):
        return " ".join(part for part in (_text(item) for item in value) if part).strip()
    return ""


def _role(value: dict) -> str:
    return str(value.get("role") or value.get("speaker") or value.get("type") or "").lower()


def _coerce_messages(value: Any) -> list[dict]:
    """Normalize Tavus transcript-like shapes to [{role, content}, ...]."""
    out: list[dict] = []
    if isinstance(value, list):
        for item in value:
            if not isinstance(item, dict):
                continue
            role = _role(item)
            content = _text(item)
            if role and content:
                out.append({"role": role, "content": content})
        return out

    if isinstance(value, dict):
        role = _role(value)
        content = _text(value)
        if role and content:
            return [{"role": role, "content": content}]
    return []


def _find_transcript_messages(value: Any) -> list[dict]:
    if not isinstance(value, dict):
        return []

    for key in _TRANSCRIPT_KEYS:
        messages = _coerce_messages(value.get(key))
        if messages:
            return messages

    for nested in value.values():
        if isinstance(nested, dict):
            messages = _find_transcript_messages(nested)
            if messages:
                return messages
    return []


def transcript_messages(conv: dict) -> list[dict]:
    """Return [{role, content}, ...] as soon as Tavus exposes transcript text."""
    for e in conv.get("events", []):
        if e.get("event_type") == "application.transcription_ready":
            messages = _find_transcript_messages(e.get("properties", {}))
            if messages:
                return messages

    messages = _find_transcript_messages(conv)
    if messages:
        return messages

    for e in conv.get("events", []):
        messages = _find_transcript_messages(e.get("properties", e))
        if messages:
            return messages
    return []


def candidate_text(conv: dict) -> str:
    """Concatenate the candidate's (user) utterances into one string."""
    parts = []
    for m in transcript_messages(conv):
        if m.get("role") in {"user", "candidate", "participant", "human"}:
            c = m.get("content")
            if isinstance(c, str) and c.strip():
                parts.append(c.strip())
    return " ".join(parts)


def transcript_ready(conv: dict) -> bool:
    """True once the post-call transcription event is present."""
    return any(e.get("event_type") == "application.transcription_ready"
               for e in conv.get("events", []))
