"""Zero-dependency demo frontend for functionality testing.

    uv run python examples/server.py   # then open http://localhost:8000

Pick a preset answer (with real word timings), choose exam/coach mode, and see the
full backend output: Layer-A features, the coaching cues the PAL would say, a
heuristic scorecard, and the conversational wrap-up. Uses only the stdlib
http.server so it runs anywhere Python does — no npm, no Flask.

NOTE: the scorecard here is a transparent *heuristic preview* from the features so
the demo is self-contained. In production the bands come from the LLM rubric judges.
"""

from __future__ import annotations

import json
from dataclasses import asdict
from enum import Enum
from http.server import BaseHTTPRequestHandler, HTTPServer

from assessment import Turn, Scorecard, Criterion, JudgeResult
from assessment.session import CoachingSession


# --------------------------------------------------------------------------- #
# Preset sample turns (word timings baked in) so fluency features are real      #
# --------------------------------------------------------------------------- #

def _lay(script):
    words, t = [], 0.0
    for text, dur, gap, conf in script:
        words.append({"text": text, "start": round(t, 3), "end": round(t + dur, 3),
                      "confidence": conf})
        t += dur + gap
    return words


HESITANT = _lay([
    ("um", 0.3, 0.4, 0.9), ("when", 0.2, 0.0, 0.95), ("I", 0.15, 0.0, 0.95),
    ("was", 0.2, 0.0, 0.95), ("a", 0.1, 0.0, 0.95), ("teenager", 0.5, 0.6, 0.9),
    ("I", 0.15, 0.05, 0.9), ("I", 0.15, 0.0, 0.9), ("travelled", 0.4, 0.0, 0.9),
    ("to", 0.15, 0.0, 0.95), ("Japan", 0.5, 0.3, 0.9), ("with", 0.2, 0.0, 0.95),
    ("my", 0.15, 0.0, 0.95), ("family", 0.45, 1.3, 0.9), ("uh", 0.3, 0.3, 0.9),
    ("it", 0.15, 0.0, 0.95), ("was", 0.2, 0.0, 0.95), ("really", 0.3, 0.0, 0.9),
    ("good", 0.3, 0.0, 0.9), ("the", 0.15, 0.1, 0.95), ("the", 0.15, 0.0, 0.95),
    ("scenery", 0.5, 0.0, 0.55), ("was", 0.2, 0.0, 0.95), ("good", 0.5, 0.7, 0.9),
    ("and", 0.2, 0.0, 0.95), ("good", 0.3, 0.0, 0.9), ("food", 0.4, 0.0, 0.9),
    ("too", 0.3, 0.0, 0.9), ("abroad", 0.5, 0.0, 0.55),
])
HESITANT_TEXT = ("When I was a teenager I travelled to Japan with my family. It was "
                 "really good, the scenery was good and good food too, abroad.")

FLUENT = _lay([
    ("the", 0.12, 0.0, 0.97), ("journey", 0.35, 0.0, 0.95), ("that", 0.12, 0.0, 0.96),
    ("stands", 0.3, 0.0, 0.95), ("out", 0.2, 0.0, 0.96), ("most", 0.25, 0.0, 0.95),
    ("vividly", 0.45, 0.15, 0.92), ("was", 0.18, 0.0, 0.96), ("a", 0.08, 0.0, 0.97),
    ("trip", 0.3, 0.0, 0.95), ("which", 0.25, 0.0, 0.94), ("I", 0.12, 0.0, 0.96),
    ("took", 0.25, 0.0, 0.95), ("across", 0.3, 0.0, 0.94), ("the", 0.1, 0.0, 0.97),
    ("Scottish", 0.4, 0.0, 0.93), ("Highlands", 0.5, 0.2, 0.92), ("because", 0.4, 0.0, 0.94),
    ("the", 0.1, 0.0, 0.97), ("scenery", 0.45, 0.0, 0.9), ("was", 0.18, 0.0, 0.96),
    ("absolutely", 0.5, 0.0, 0.93), ("breathtaking", 0.6, 0.0, 0.91),
])
FLUENT_TEXT = ("The journey that stands out most vividly was a trip which I took across "
               "the Scottish Highlands, because the scenery was absolutely breathtaking.")

PRESETS = {
    "hesitant (target band ~5.5)": {"words": HESITANT, "clean_text": HESITANT_TEXT, "part": 2},
    "fluent (target band ~7.5)": {"words": FLUENT, "clean_text": FLUENT_TEXT, "part": 2},
}


# --------------------------------------------------------------------------- #
# Heuristic scorecard (preview only; production uses the LLM judges)            #
# --------------------------------------------------------------------------- #

def _clamp_half(x: float) -> float:
    return max(4.0, min(8.5, round(x * 2) / 2))


def heuristic_scorecard(session: CoachingSession) -> Scorecard:
    f = session.turns[-1]
    fl = f.fluency
    fc = 7.0 - 0.4 * fl.long_pause_count - 0.05 * fl.fillers_per_100w
    if 0 < fl.effective_speech_rate_wpm < 90:
        fc -= 0.5
    lr = 5.0 + min(2.5, f.lexical.mtld / 30) - 0.4 * len(f.lexical.flagged_basic_overuse)
    g = f.grammar
    gra = 6.0 if g.note else 5.0 + 3 * g.subordination_ratio + (0.5 if g.uses_modality else 0)
    pr = 5.5 + ((f.pronunciation.intelligibility_estimate or 0.7) - 0.7) * 5
    results = {
        Criterion.FLUENCY_COHERENCE: JudgeResult(Criterion.FLUENCY_COHERENCE, _clamp_half(fc)),
        Criterion.LEXICAL_RESOURCE: JudgeResult(Criterion.LEXICAL_RESOURCE, _clamp_half(lr)),
        Criterion.GRAMMATICAL_RANGE_ACCURACY: JudgeResult(
            Criterion.GRAMMATICAL_RANGE_ACCURACY, _clamp_half(gra)),
        Criterion.PRONUNCIATION: JudgeResult(Criterion.PRONUNCIATION, _clamp_half(pr)),
    }
    from assessment import aggregate
    return aggregate(results)


def _default(o):
    if isinstance(o, Enum):
        return o.value
    if isinstance(o, set):
        return sorted(o)
    raise TypeError(repr(o))


def assess_payload(body: dict) -> dict:
    turn = Turn.from_tavus(turn_idx=body.get("turn_idx", 1),
                           part=int(body.get("part", 2)),
                           words=body["words"],
                           clean_text=body.get("clean_text", ""))
    session = CoachingSession(mode=body.get("mode", "coach"))
    result = session.process_turn(turn)
    # part-2 holds cues; flush so the demo can show them
    cues = result.cues or session.flush_held_cues()
    card = heuristic_scorecard(session)
    report = session.conversational_summary(card)
    return {
        "features": asdict(result.features),
        "focus": result.focus.value,
        "next_question_hint": result.next_question_hint,
        "cues": [asdict(c) for c in cues],
        "scorecard": card.to_dict(),
        "report": asdict(report),
    }


# --------------------------------------------------------------------------- #
# HTTP handler                                                                 #
# --------------------------------------------------------------------------- #

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
            self._send(200, PAGE, "text/html; charset=utf-8")
        elif self.path == "/presets":
            self._send(200, json.dumps(PRESETS))
        else:
            self._send(404, json.dumps({"error": "not found"}))

    def do_POST(self):
        if self.path != "/assess":
            return self._send(404, json.dumps({"error": "not found"}))
        try:
            n = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(n) or b"{}")
            out = assess_payload(body)
            self._send(200, json.dumps(out, default=_default))
        except Exception as e:  # surface errors to the UI for debugging
            self._send(400, json.dumps({"error": str(e)}))

    def log_message(self, *a):  # quieter console
        pass


# Note: all dynamic, user-derived values are routed through esc() before being
# inserted into the DOM to avoid reflected-XSS from transcript text.
PAGE = """<!doctype html><html><head><meta charset=utf-8>
<title>IELTS Speaking — Assessment Backend Demo</title>
<style>
 body{font:15px/1.5 system-ui,sans-serif;max-width:980px;margin:24px auto;padding:0 16px;color:#1a1a1a}
 h1{font-size:20px} h2{font-size:15px;margin:18px 0 6px;color:#444}
 .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}
 button{padding:7px 12px;border:1px solid #ccc;border-radius:7px;background:#fafafa;cursor:pointer}
 button.primary{background:#1463ff;color:#fff;border-color:#1463ff}
 textarea{width:100%;min-height:60px;font:13px ui-monospace,monospace;border:1px solid #ddd;border-radius:7px;padding:8px}
 .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
 .card{border:1px solid #e6e6e6;border-radius:10px;padding:12px;background:#fff}
 .k{color:#666} .v{font-weight:600}
 .band{font-size:28px;font-weight:700;color:#1463ff}
 .cue{border-left:3px solid #1463ff;padding:6px 10px;margin:6px 0;background:#f4f8ff;border-radius:0 7px 7px 0}
 .cue.praise{border-color:#16a34a;background:#f1fbf4}
 .pill{display:inline-block;font-size:12px;background:#eee;border-radius:20px;padding:2px 9px;margin-right:4px}
 small{color:#888} table{border-collapse:collapse} td{padding:2px 10px 2px 0;vertical-align:top}
</style></head><body>
<h1>IELTS Speaking — Assessment Backend Demo</h1>
<small>Voice-ML feature layer · coaching cues · heuristic scorecard preview</small>
<div class=row id=presets></div>
<div class=row>
  <label>Part <select id=part><option value=1>1</option><option value=2 selected>2</option><option value=3>3</option></select></label>
  <label>Mode <select id=mode><option value=coach selected>coach</option><option value=exam>exam</option></select></label>
  <button class=primary onclick=run()>Assess turn</button>
</div>
<h2>Transcript</h2><textarea id=text></textarea>
<h2>Word timings (JSON: text,start,end,confidence)</h2><textarea id=words></textarea>
<div id=out></div>
<script>
let PRESETS={};
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
fetch('/presets').then(r=>r.json()).then(p=>{PRESETS=p;const d=document.getElementById('presets');
 Object.keys(p).forEach((k,i)=>{const b=document.createElement('button');b.textContent='Load: '+k;
  b.onclick=()=>load(k);d.appendChild(b);if(i==0)load(k);});});
function load(k){const p=PRESETS[k];document.getElementById('text').value=p.clean_text;
 document.getElementById('words').value=JSON.stringify(p.words);document.getElementById('part').value=p.part;}
function row(k,v){return '<tr><td class=k>'+esc(k)+'</td><td class=v>'+esc(v)+'</td></tr>';}
function feats(f){let h='<table>';for(const k in f){if(k=='silent_pauses')continue;
 h+=row(k,Array.isArray(f[k])?JSON.stringify(f[k]):f[k]);}return h+'</table>';}
async function run(){
 let words;try{words=JSON.parse(document.getElementById('words').value);}catch(e){alert('bad words JSON');return;}
 const body={words,clean_text:document.getElementById('text').value,
  part:+document.getElementById('part').value,mode:document.getElementById('mode').value};
 const r=await fetch('/assess',{method:'POST',body:JSON.stringify(body)});
 const d=await r.json();if(d.error){document.getElementById('out').innerHTML='<p style=color:red>'+esc(d.error)+'</p>';return;}
 const F=d.features, sc=d.scorecard, rep=d.report;
 let cues=d.cues.map(c=>'<div class="cue '+esc(c.kind)+'"><b>'+esc(c.kind.toUpperCase())+
  ' · '+esc(c.target)+'</b><br>“'+esc(c.message)+'”<br><small>via '+esc(c.inject_via)+
  (c.offer_retry?' · offers retry':'')+' — '+esc(c.evidence)+'</small></div>').join('')||'<small>(no cues — exam mode or clean turn)</small>';
 let crit=Object.entries(sc.criteria).map(([k,v])=>'<span class=pill>'+esc(k)+': '+esc(v.band)+'</span>').join('');
 document.getElementById('out').innerHTML=
  '<h2>Coaching cues (what the PAL says)</h2>'+cues+
  '<div class=row><span class=pill>focus: '+esc(d.focus)+'</span><span class=pill>next: '+esc(d.next_question_hint)+'</span></div>'+
  '<h2>Scorecard <span class=band>'+esc(sc.overall_band)+'</span></h2>'+crit+
  '<h2>Conversational wrap-up</h2><div class=card>“'+esc(rep.spoken_overview)+'”<br><br>'+
   '<b>Strengths</b><ul><li>'+rep.strengths.map(esc).join('</li><li>')+'</li></ul>'+
   '<b>Priorities</b><ul><li>'+rep.priorities.map(esc).join('</li><li>')+'</li></ul>'+
   '<b>Next:</b> '+rep.followup_options.map(o=>'<span class=pill>'+esc(o)+'</span>').join('')+'</div>'+
  '<div class=grid><div class=card><h2>Fluency &amp; Coherence</h2>'+feats(F.fluency)+'</div>'+
   '<div class=card><h2>Lexical Resource</h2>'+feats(F.lexical)+'</div>'+
   '<div class=card><h2>Grammatical Range</h2>'+feats(F.grammar)+'</div>'+
   '<div class=card><h2>Pronunciation</h2>'+feats(F.pronunciation)+'</div></div>';
}
</script></body></html>"""


def run(port: int = 8000) -> None:
    print(f"Demo at http://localhost:{port}  (Ctrl-C to stop)")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()


if __name__ == "__main__":
    run()
