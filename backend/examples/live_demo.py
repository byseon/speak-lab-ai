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
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, HTTPServer

from dataclasses import asdict

from assessment.config import config
from assessment import pal
from assessment.schema import Part
from assessment.webhook import ConversationStore, handle_event
from assessment.quickscore import score_transcript
from assessment.transcript import candidate_text, transcript_ready

TAVUS = "https://tavusapi.com/v2"
STORE = ConversationStore()


def score_conversation(cid: str) -> dict:
    conv = _tavus("GET", f"/conversations/{cid}?verbose=true")
    text = candidate_text(conv)
    if not text:
        if not transcript_ready(conv):
            return {"error": "transcript not ready yet — wait ~10-20s after ending the "
                             "call, then click Score me again."}
        return {"error": "no candidate speech found in the transcript."}
    card, report, notes = score_transcript(text)
    return {"scorecard": card.to_dict(), "report": asdict(report),
            "notes": notes, "transcript_chars": len(text)}


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
        callback_url=config.tavus_callback_url or None)
    out = _tavus("POST", "/conversations", payload)
    return {"conversation_url": out.get("conversation_url"),
            "conversation_id": out.get("conversation_id")}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        data = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            return self._send(200, PAGE, "text/html; charset=utf-8")
        if self.path.startswith("/api/transcript"):
            from urllib.parse import urlparse, parse_qs
            cid = parse_qs(urlparse(self.path).query).get("cid", [""])[0]
            try:
                out = _tavus("GET", f"/conversations/{cid}?verbose=true")
                return self._send(200, json.dumps(out))
            except Exception as e:
                return self._send(400, json.dumps({"error": str(e)}))
        if self.path.startswith("/api/result"):
            from urllib.parse import urlparse, parse_qs
            cid = parse_qs(urlparse(self.path).query).get("cid", [""])[0]
            return self._send(200, json.dumps(asdict(STORE.get(cid))))
        if self.path.startswith("/api/score"):
            from urllib.parse import urlparse, parse_qs
            cid = parse_qs(urlparse(self.path).query).get("cid", [""])[0]
            try:
                return self._send(200, json.dumps(score_conversation(cid)))
            except Exception as e:
                return self._send(400, json.dumps({"error": str(e)}))
        if self.path.startswith("/api/end"):
            from urllib.parse import urlparse, parse_qs
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
