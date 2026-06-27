"""Central config from environment variables (see .env.example).

Tavus-centric: ONE TAVUS_API_KEY covers STT, TTS, the hosted LLM, and the Knowledge
Base (RAG). Grading is done by the Tavus LLM via tool-calling (see tavus_tools.py),
so there is no separate judge-LLM key.

Reads os.environ; if python-dotenv is installed it also loads a local .env.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

def _load_env_files() -> None:
    """Load backend/.env, then repo-root .env (Lovable puts Tavus keys there)."""
    try:
        from dotenv import load_dotenv
    except Exception:  # pragma: no cover
        return
    from pathlib import Path

    backend_root = Path(__file__).resolve().parents[2]
    repo_root = backend_root.parent
    for path in (repo_root / ".env", backend_root / ".env"):
        if path.is_file():
            load_dotenv(path, override=True)


_load_env_files()


def _get(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


@dataclass(frozen=True)
class Config:
    # Tavus CVI (conversation + STT + Knowledge Base)
    tavus_api_key: str = _get("TAVUS_API_KEY")
    tavus_pal_id: str = _get("TAVUS_PAL_ID")
    tavus_face_id: str = _get("TAVUS_FACE_ID")
    tavus_stt_engine: str = _get("TAVUS_STT_ENGINE", "tavus-soniox")
    tavus_document_tags: tuple[str, ...] = tuple(
        t.strip() for t in _get("TAVUS_DOCUMENT_TAGS").split(",") if t.strip())
    tavus_callback_url: str = _get("TAVUS_CALLBACK_URL")

    # Pronunciation + word-timing backbone (local Charsiu)
    charsiu_model: str = _get("CHARSIU_MODEL", "charsiu/en_w2v2_fc_10ms")

    # Demo
    port: int = int(_get("PORT", "8000"))

    def require(self, *names: str) -> None:
        """Raise if any named field is empty — call at the edge that needs them."""
        missing = [n for n in names if not getattr(self, n)]
        if missing:
            raise RuntimeError(
                f"Missing config: {', '.join(missing)}. Copy .env.example -> .env "
                f"and fill them in.")


config = Config()
