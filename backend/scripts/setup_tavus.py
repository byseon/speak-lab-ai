"""Configure the Tavus Examiner PAL + assessment tool + Knowledge from the CLI.

    uv run python scripts/setup_tavus.py faces                       # list face ids (random pool)
    uv run python scripts/setup_tavus.py pal --face <face_id> --execute     # patch the examiner PAL
    uv run python scripts/setup_tavus.py tool --execute                     # register + attach grading tool
    uv run python scripts/setup_tavus.py upload docs/knowledge/rubric.txt --tags ielts-rubric --execute

Reads TAVUS_API_KEY from .env (see .env.example). DRY-RUN by default — prints the
request it would send; pass --execute to actually call the API. Stdlib only.

Contracts verified against docs.tavus.io. Prompts/tool come from the code
(`assessment.pal`, `assessment.tavus_tools`) so config lives in git, not the dashboard.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from assessment.config import config          # noqa: E402
from assessment import pal                     # noqa: E402
from assessment.tavus_tools import ASSESSMENT_TOOL  # noqa: E402

BASE = "https://tavusapi.com/v2"


def _call(method: str, path: str, body: dict | None, execute: bool) -> dict | None:
    url = f"{BASE}{path}"
    if not execute:
        print(f"[dry-run] {method} {url}")
        if body is not None:
            print(json.dumps(body, indent=2)[:2000])
        print("  (pass --execute to send)\n")
        return None
    config.require("tavus_api_key")
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"Content-Type": "application/json", "x-api-key": config.tavus_api_key})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read() or b"{}")


def cmd_faces(args) -> None:
    """List faces so you can build the random-examiner pool."""
    out = _call("GET", "/faces", None, args.execute)
    if out:
        for f in out.get("data", out if isinstance(out, list) else []):
            print(f"{f.get('face_id', '?')}  {f.get('face_name', '')}")


def cmd_pal(args) -> None:
    """Patch the Examiner PAL with the system prompt + face (from assessment.pal).

    /v2/pals PATCH uses JSON Patch (RFC 6902): a list of {op,path,value} operations,
    not a full object. We replace the essential fields; set the STT engine in the UI
    (or via a separate patch) to avoid clobbering default layers.
    """
    face = args.face or config.tavus_face_id
    if not face:
        sys.exit("need a default face id: --face <id> (or set TAVUS_FACE_ID)")
    full = pal.build_pal_payload(default_face_id=face, stt_engine=config.tavus_stt_engine)
    # NOTE: custom_greeting is a CONVERSATION field (not a PAL field) — set it via
    # build_conversation_payload, not here. The PAL patch carries prompt + face.
    patch = [
        {"op": "replace", "path": "/system_prompt", "value": full["system_prompt"]},
        {"op": "replace", "path": "/default_face_id", "value": face},
    ]
    _call("PATCH", f"/pals/{args.pal}", patch, args.execute)


def cmd_tool(args) -> None:
    """Register the assessment tool, then attach it to the PAL."""
    created = _call("POST", "/tools", ASSESSMENT_TOOL, args.execute)
    tool_id = (created or {}).get("tool_id", "<tool_id>")
    print("tool_id:", tool_id)
    _call("POST", f"/pals/{args.pal}/tools", {"tool_ids": [tool_id]}, args.execute)


def cmd_upload(args) -> None:
    """Upload a Knowledge Base document (file path or --text) under tag(s)."""
    if args.text:
        body = {"document_name": args.name or "custom-text", "tags": args.tags,
                "document_text": args.text}            # VERIFY field for custom text
    else:
        path = Path(args.file)
        body = {"document_name": path.name, "tags": args.tags}  # VERIFY: file vs document_url
    out = _call("POST", "/documents", body, args.execute)
    if out:
        print("document_id:", out.get("document_id"))


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    # shared --execute so it works either before OR after the subcommand
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--execute", action="store_true", help="actually call the API")
    p.add_argument("--execute", action="store_true", help=argparse.SUPPRESS)
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("faces", parents=[common]).set_defaults(func=cmd_faces)

    palp = sub.add_parser("pal", parents=[common])
    palp.add_argument("--pal", default="pece42dab07f")
    palp.add_argument("--face", help="default face id (else TAVUS_FACE_ID)")
    palp.set_defaults(func=cmd_pal)

    toolp = sub.add_parser("tool", parents=[common])
    toolp.add_argument("--pal", default="pece42dab07f")
    toolp.set_defaults(func=cmd_tool)

    up = sub.add_parser("upload", parents=[common])
    up.add_argument("file", nargs="?")
    up.add_argument("--text", help="custom knowledge text instead of a file")
    up.add_argument("--name")
    up.add_argument("--tags", nargs="+", default=["ielts-rubric"])
    up.set_defaults(func=cmd_upload)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
