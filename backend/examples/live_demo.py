"""Live Tavus demo — connect, run a local page, talk to the examiner.

    cp .env.example .env        # set TAVUS_API_KEY, TAVUS_PAL_ID, TAVUS_FACE_ID
    uv run python examples/live_demo.py     # open http://localhost:8000

Click "Start mock test" -> the local backend creates a real Tavus conversation with
the examiner PAL (build_conversation_payload) and embeds the video call in an iframe,
so you can speak with the examiner. "Fetch transcript" pulls the conversation back for
inspection after you end the call.

The Tavus API key stays server-side (never sent to the browser). NOTE: starting a
conversation uses Tavus credits — it only fires when YOU click the button.
"""

from __future__ import annotations

import json
import os
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, HTTPServer

from dataclasses import asdict
from urllib.parse import parse_qs, urlparse

from assessment.config import config
from assessment import pal
from assessment.schema import Part
from assessment.webhook import ConversationStore, handle_event
from assessment.quickscore import score_transcript
from assessment.transcript import candidate_text, transcript_messages, transcript_ready

TAVUS = "https://tavusapi.com/v2"
STORE = ConversationStore()
CORS_ALLOW_ORIGIN = os.environ.get("CORS_ALLOW_ORIGIN", "*")
CONVERSATION_PARTS: dict[str, list[int]] = {}


def health() -> dict:
    required = {
        "TAVUS_API_KEY": bool(config.tavus_api_key),
        "TAVUS_PAL_ID": bool(config.tavus_pal_id),
        "TAVUS_FACE_ID": bool(config.tavus_face_id),
    }
    return {
        "ok": all(required.values()),
        "configured": required,
        "missing": [name for name, ready in required.items() if not ready],
    }


def score_conversation(cid: str) -> dict:
    conv = _tavus("GET", f"/conversations/{cid}?verbose=true")
    text = candidate_text(conv)
    if not text:
        if not transcript_ready(conv):
            return {"error": "transcript not ready yet — wait ~10-20s after ending the "
                             "call, then click Score me again."}
        return {"error": "no candidate speech found in the transcript."}
    card, report, notes = score_transcript(text)
    by_part = score_parts(conv, CONVERSATION_PARTS.get(cid, [1, 2, 3]), text)
    return {"scorecard": card.to_dict(), "report": asdict(report),
            "by_part": by_part, "notes": notes, "transcript_chars": len(text)}


def score_parts(conv: dict, parts: list[int], full_text: str) -> list[dict]:
    """Return one score/transcript payload per selected IELTS part.

    Tavus' post-call transcript is role-based, not part-tagged, so this fallback
    groups candidate turns across the selected parts. If Tavus only gives one long
    user transcript, split it into contiguous word chunks so Supabase still gets
    the required per-part rows.
    """
    selected = parts or [1, 2, 3]
    messages = [
        m.get("content", "").strip()
        for m in transcript_messages(conv)
        if m.get("role") == "user" and isinstance(m.get("content"), str)
        and m.get("content", "").strip()
    ]
    chunks = split_candidate_chunks(messages, selected, full_text)
    out = []
    for part, chunk in zip(selected, chunks):
        part_card, part_report, part_notes = score_transcript(chunk or full_text)
        out.append({
            "part": part,
            "scorecard": part_card.to_dict(),
            "coaching": {"report": asdict(part_report), "notes": part_notes},
            "raw_transcript": {
                "candidate_text": chunk,
                "source": "tavus_transcript_chunk",
                "selected_parts": selected,
            },
            "candidate_text": chunk,
        })
    return out


def split_candidate_chunks(messages: list[str], parts: list[int], full_text: str) -> list[str]:
    if not parts:
        return []
    if len(messages) >= len(parts):
        chunks = [[] for _ in parts]
        for i, msg in enumerate(messages):
            chunks[min(i * len(parts) // len(messages), len(parts) - 1)].append(msg)
        return [" ".join(chunk).strip() for chunk in chunks]
    words = (full_text or " ".join(messages)).split()
    if not words:
        return ["" for _ in parts]
    size = max(1, (len(words) + len(parts) - 1) // len(parts))
    chunks = [" ".join(words[i * size:(i + 1) * size]).strip()
              for i in range(len(parts))]
    return [chunk or full_text for chunk in chunks]


def _tavus(method: str, path: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{TAVUS}{path}", data=data, method=method,
        headers={"Content-Type": "application/json", "x-api-key": config.tavus_api_key})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read() or b"{}")


def start_conversation(username: str, parts: list[int]) -> dict:
    config.require("tavus_api_key", "tavus_pal_id", "tavus_face_id")
    payload = pal.build_conversation_payload(
        pal_id=config.tavus_pal_id, face_id=config.tavus_face_id,
        username=username or "guest",
        parts=[Part(p) for p in parts] or [Part.PART1, Part.PART2, Part.PART3],
        callback_url=config.tavus_callback_url or None,
        use_memory=config.tavus_use_memory)
    try:
        out = _tavus("POST", "/conversations", payload)
    except urllib.error.HTTPError:
        if not config.tavus_use_memory:
            raise
        payload.pop("memory_stores", None)
        out = _tavus("POST", "/conversations", payload)
    cid = out.get("conversation_id")
    if cid:
        CONVERSATION_PARTS[cid] = [int(p) for p in parts] or [1, 2, 3]
    return {"conversation_url": out.get("conversation_url"),
            "conversation_id": cid}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        data = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", CORS_ALLOW_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        return self._send(204, b"")

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            return self._send(200, PAGE, "text/html; charset=utf-8")
        if self.path.startswith("/api/health"):
            return self._send(200, json.dumps(health()))
        if self.path.startswith("/api/transcript"):
            cid = parse_qs(urlparse(self.path).query).get("cid", [""])[0]
            try:
                out = _tavus("GET", f"/conversations/{cid}?verbose=true")
                return self._send(200, json.dumps(out))
            except Exception as e:
                return self._send(400, json.dumps({"error": str(e)}))
        if self.path.startswith("/api/result"):
            cid = parse_qs(urlparse(self.path).query).get("cid", [""])[0]
            return self._send(200, json.dumps(asdict(STORE.get(cid))))
        if self.path.startswith("/api/score"):
            cid = parse_qs(urlparse(self.path).query).get("cid", [""])[0]
            try:
                return self._send(200, json.dumps(score_conversation(cid)))
            except Exception as e:
                return self._send(400, json.dumps({"error": str(e)}))
        if self.path.startswith("/api/end"):
            cid = parse_qs(urlparse(self.path).query).get("cid", [""])[0]
            try:  # ending makes status=ended so transcription_ready fires in ~seconds
                _tavus("POST", f"/conversations/{cid}/end")
                return self._send(200, json.dumps({"ok": True}))
            except Exception as e:
                return self._send(400, json.dumps({"error": str(e)}))
        self._send(404, json.dumps({"error": "not found"}))

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(n) or b"{}"
        # Tavus posts call/recording/tool events here (set TAVUS_CALLBACK_URL).
        if self.path == "/webhook":
            try:
                ack = handle_event(json.loads(raw), STORE)
                return self._send(200, json.dumps(ack))
            except Exception as e:
                return self._send(400, json.dumps({"error": str(e)}))
        if self.path != "/api/start":
            return self._send(404, json.dumps({"error": "not found"}))
        try:
            body = json.loads(raw)
            out = start_conversation(body.get("username", ""),
                                     [int(p) for p in body.get("parts", [])])
            self._send(200, json.dumps(out))
        except urllib.error.HTTPError as e:
            self._send(e.code, json.dumps({"error": e.read().decode()[:500]}))
        except Exception as e:
            self._send(400, json.dumps({"error": str(e)}))

    def log_message(self, *a):
        pass


# user-derived text routed through esc() before being inserted into the DOM
PAGE = """<!doctype html><html><head><meta charset=utf-8>
<title>IELTS Examiner — Live Tavus Demo</title>
<style>
 body{font:15px/1.5 system-ui,sans-serif;max-width:900px;margin:24px auto;padding:0 16px}
 .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0}
 button{padding:8px 14px;border:1px solid #1463ff;background:#1463ff;color:#fff;border-radius:8px;cursor:pointer}
 button.sec{background:#fafafa;color:#1463ff}
 input{padding:7px;border:1px solid #ccc;border-radius:7px}
 iframe{width:100%;height:540px;border:1px solid #ddd;border-radius:12px;margin-top:12px;background:#000}
 #status{color:#555} pre{background:#f6f6f6;padding:10px;border-radius:8px;max-height:260px;overflow:auto}
 small{color:#888}
</style></head><body>
<h2>IELTS Examiner — Live Tavus Demo</h2>
<small>Starting a test creates a real Tavus conversation (uses credits). Key stays server-side.</small>
<div class=row>
  <label>Username <input id=user value=guest></label>
  <label><input type=checkbox class=part value=1 checked> Part 1</label>
  <label><input type=checkbox class=part value=2 checked> Part 2</label>
  <label><input type=checkbox class=part value=3 checked> Part 3</label>
  <button onclick=start()>Start mock test</button>
</div>
<div id=status></div>
<div id=frame></div>
<div class=row>
  <button onclick=endAndScore()>End test &amp; score</button>
  <button class=sec onclick=scoreMe()>Score me (if already ended)</button>
  <button class=sec onclick=fetchTranscript()>Fetch transcript</button>
  <button class=sec onclick=resetTest()>New test</button>
</div>
<div id=score></div>
<pre id=transcript></pre>
<script>
let CID=null;
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function start(){
 const parts=[...document.querySelectorAll('.part:checked')].map(c=>+c.value);
 const username=document.getElementById('user').value;
 document.getElementById('status').textContent='Creating conversation…';
 const r=await fetch('/api/start',{method:'POST',body:JSON.stringify({username,parts})});
 const d=await r.json();
 if(d.error){document.getElementById('status').textContent='Error: '+d.error;return;}
 CID=d.conversation_id;
 document.getElementById('status').textContent='Conversation '+esc(CID||'')+' — allow camera & mic.';
 const f=document.createElement('iframe');
 f.allow='camera; microphone; autoplay; fullscreen; display-capture';
 f.src=d.conversation_url;
 document.getElementById('frame').replaceChildren(f);
}
async function fetchTranscript(){
 if(!CID){alert('start a test first');return;}
 const r=await fetch('/api/transcript?cid='+encodeURIComponent(CID));
 const d=await r.json();
 document.getElementById('transcript').textContent=JSON.stringify(d,null,2);
}
function resetTest(){location.reload();}  // back to the landing page
function renderScore(d){
 const box=document.getElementById('score'), sc=d.scorecard, crit=sc.criteria;
 const pill=(k)=>'<span class=pill style="display:inline-block;background:#eee;border-radius:20px;padding:2px 9px;margin:2px">'
   +esc(k)+': '+esc(crit[k].band)+'</span>';
 const h=document.createElement('div');
 h.innerHTML='<h3>Overall band: '+esc(sc.overall_band)+'</h3>'
   +Object.keys(crit).map(pill).join('')
   +'<p><b>Summary:</b> '+esc(d.report.spoken_overview)+'</p>'
   +'<p><small>Real from transcript: lexical, grammar. Placeholders (need audio): '
   +'fluency, pronunciation.</small></p>';
 box.replaceChildren(h);
}
async function scoreMe(){
 if(!CID){alert('start a test first');return;}
 const box=document.getElementById('score'); box.textContent='Scoring…';
 const d=await (await fetch('/api/score?cid='+encodeURIComponent(CID))).json();
 if(d.error){box.textContent='Error: '+esc(d.error);return;}
 renderScore(d);
}
async function endAndScore(){
 if(!CID){alert('start a test first');return;}
 const box=document.getElementById('score'); box.textContent='Ending the call…';
 await fetch('/api/end?cid='+encodeURIComponent(CID));
 for(let i=0;i<8;i++){
   await new Promise(r=>setTimeout(r,4000));
   const d=await (await fetch('/api/score?cid='+encodeURIComponent(CID))).json();
   if(!d.error){renderScore(d);return;}
   box.textContent='Waiting for the transcript… ('+((i+1)*4)+'s)';
 }
 box.textContent='Transcript still not ready — click "Score me" in a few seconds.';
}
</script></body></html>"""


def run(port: int | None = None) -> None:
    port = port or config.port
    print(f"Live demo at http://localhost:{port}  (Ctrl-C to stop)")
    print("Needs TAVUS_API_KEY + TAVUS_PAL_ID + TAVUS_FACE_ID in .env.")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()


if __name__ == "__main__":
    run()
