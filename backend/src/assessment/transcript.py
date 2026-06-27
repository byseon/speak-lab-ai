"""Pull candidate (user) speech out of a Tavus conversation.

Verified shape (GET /v2/conversations/{id}?verbose=true): the transcript arrives in
the `application.transcription_ready` event as
    properties.transcript = [{"role": "system|user|assistant", "content": "..."}, ...]
The candidate's speech is the `role == "user"` messages.
"""

from __future__ import annotations


def transcript_messages(conv: dict) -> list[dict]:
    """Return the [{role, content}, ...] transcript, or [] if not ready yet."""
    for e in conv.get("events", []):
        if e.get("event_type") == "application.transcription_ready":
            return e.get("properties", {}).get("transcript") or []
    return []


def candidate_text(conv: dict) -> str:
    """Concatenate the candidate's (user) utterances into one string."""
    parts = []
    for m in transcript_messages(conv):
        if m.get("role") == "user":
            c = m.get("content")
            if isinstance(c, str) and c.strip():
                parts.append(c.strip())
    return " ".join(parts)


def transcript_ready(conv: dict) -> bool:
    """True once the post-call transcription event is present."""
    return any(e.get("event_type") == "application.transcription_ready"
               for e in conv.get("events", []))
