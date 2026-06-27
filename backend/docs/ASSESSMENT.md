# ASSESSMENT.md — System Architecture & Design Decisions

Canonical reference for the IELTS Speaking assessment subsystem (the voice-ML
backend). For long-form rationale see [`ielts-speaking-coach-design.md`](ielts-speaking-coach-design.md);
for prompts see [`../prompts/`](../prompts/).

---

## 1. What we're building (from the user story)

A web app where a learner talks to a randomly-chosen Tavus examiner, practices any
subset of the IELTS Speaking parts, and gets a band-scored report card with
specific, quoted, pronunciation-aware feedback.

| User-story requirement | How the system delivers it |
|---|---|
| Click "Start mock test" → Tavus examiner on video | Create a Conversation from the Examiner **PAL** + a **Face**; render with CVI |
| Customize which part(s) to practice | **Per-Part modules** (`parts/`); app passes a `TestPlan` = ordered subset of parts |
| Examiner random every time | Pick a random **Face id** from a curated pool per session (PAL stays constant) |
| Username, no password; history saved & viewable | App DB keyed by username + Tavus `memory_stores:["ielts_{username}"]` for continuity |
| Real 3-part structure in PAL prompt | Structure lives in the **system prompt** (Objectives unavailable; greeting/Knowledge/Guardrails set in UI, the rest via API); see `pal.py` |
| Parts modular; multiple parts = continuous convo | One Conversation; app selects the part subset via `conversational_context` / `overwrite-context` |
| Call ends → transcript → LLM grades 4 criteria, band 0–9 + quoted feedback | **Tavus PAL calls `submit_ielts_assessment`** (its own LLM); we parse the tool-call into a `Scorecard` — no own LLM |
| "Transcript is not enough — pronunciation matters" | **Charsiu GOP** measurements injected into the call as grading context (`build_grading_context`) |
| Clean report card | `Scorecard` JSON → report UI; `CoachingSession.conversational_summary()` |

---

## 2. Architecture — two brains

Conversation quality (low latency, natural) and assessment rigor (slow, analytic)
have conflicting requirements, and the in-call LLM degrades past ~5k tokens — so we
**decouple** them.

```
 IN-CALL (Tavus CVI, low latency)            ASYNC ASSESSMENT ENGINE (no latency budget)
 ┌───────────────────────────┐               ┌────────────────────────────────────────┐
 │ Examiner PAL              │  utterances   │ A. features  (fluency/lexical/grammar/   │
 │  • structure in prompt    │──events──────▶│    pronunciation/GOP) from timings+audio │
 │  • Guardrails (in prompt) │  + recording  │ C. aggregate (IELTS half-band rounding)  │
 │  • Knowledge Base (RAG)   │   (MP4 audio) │ coaching: features → 1 warm spoken cue   │
 │  • STT tavus-soniox       │◀─grading ctx──│ (Charsiu/feature measurements injected   │
 │  • hosted LLM grades via  │  append-ctx   │  as context so the PAL can grade         │
 │    submit_ielts_assessment│◀──cues────────│  pronunciation it cannot hear)           │
 └───────────────────────────┘  / tool_call  └────────────────────────────────────────┘
   B. grade: the PAL's own LLM calls submit_ielts_assessment → we parse it (no own LLM)
                                / echo                         │
                                                               ▼  Scorecard + report card
```

- **Examiner PAL** only elicits speech and runs the structure. Never scores in-call.
- **Assessment Engine** does all numeric/analytic work off-call (this repo).
- **Coaching loop** (Coach mode) sends one distilled cue back into the call so the
  learner feels heard, without breaking flow or the token budget.

---

## 3. The assessment pipeline (3 layers)

**A — Deterministic features** (`src/assessment/features/`, mostly pure stdlib):
the objective evidence base. Fluency from word/phone timings (speech rate, pauses,
runs, fillers, repetitions, discourse markers); Lexical (MTLD, rare-word ratio,
basic-word overuse); Grammar (clause complexity, subordination, T-units via spaCy);
Pronunciation (Charsiu GOP, or a confidence proxy fallback).

**B — Grading via the Tavus PAL** (`src/assessment/tavus_tools.py`): we register a
`submit_ielts_assessment` tool and attach it to the PAL; at the end of the test the
PAL's own LLM calls it and we parse the `conversation.tool_call` event into a
`Scorecard` (no own LLM). Before grading we inject `build_grading_context(features)`
— the Charsiu/Layer-A measurements — and the Knowledge-base band descriptors, so each
band is grounded ("you said X; a band-7 answer would say Y") and **pronunciation
(which the LLM can't hear) is scored from the GOP measurements**.

**C — Aggregate** (`src/assessment/aggregate.py`): mean of the four bands, rounded
to the nearest half-band by the official rule (.25→.5, .75→next whole). Each
criterion is weighted toward the part that reveals it best (`CRITERION_PRIMARY_PART`:
Fluency←Part 2, Grammar←Part 3).

---

## 4. Decision log

| # | Decision | Why | Rejected |
|---|---|---|---|
| D1 | **Two brains** (in-call examiner vs async assessor) | Latency vs rigor conflict; Tavus LLM degrades >5k tokens | Scoring inside the conversation |
| D2 | **All-Tavus** for STT + LLM + Knowledge Base (one key) | Bundled with hackathon credits; fewer secrets | Separate Soniox / vector DB / LLM keys |
| D3 | **Charsiu (MIT)** for pronunciation **and** word timings | Open, local, no key; alignment does double duty (GOP + timings) | Azure Speech (lock-in, extra key) |
| D4 | **Grade via the Tavus PAL's tool-call** (`submit_ielts_assessment`) | Reuse Tavus's LLM → zero extra keys; features injected as context keep it grounded | Running our own (Claude) judge LLM |
| D5 | **STT = tavus-soniox** | Keeps fillers/disfluencies that Fluency is scored on | Whisper (normalises fillers away) |
| D6 | **Per-Part modules** | Team builds one part at a time; parts reveal different criteria | One monolithic assessor |
| D7 | **Evidence-grounded + exemplar calibration** | LLMs are uncalibrated scoring in the abstract; citations enable feedback | "Just ask the LLM for a band" |
| D8 | **Deterministic Layer-A features** | Objective, reproducible evidence; cheap; STT-robust (timings from alignment) | LLM-only feature inference |
| D9 | **Coaching cue loop** (append-context/echo) | Interactive, tutor-like experience | Static end-only report |

---

## 5. Module map

```
src/assessment/
  schema.py        data contracts: Turn, *Features, JudgeResult, Scorecard
  config.py        env config (one TAVUS_API_KEY covers STT/LLM/RAG)
  features/        Layer A: fluency, lexical, grammar, pronunciation
  tavus_tools.py   Layer B: submit_ielts_assessment tool + grading context + event parser
  pal.py           examiner PAL config + create-PAL/create-conversation payloads
  aggregate.py     Layer C: IELTS half-band rounding
  parts/           per-Part modules (Part1/2/3): structure, questions, cue policy
  coaching.py      features → conversational coaching cue (mode/part gated)
  session.py       stateful session: live cues, adaptive focus, spoken wrap-up
  stt.py           word/phone timings via Charsiu forced alignment on the recording
examples/
  demo.py          end-to-end Layer-A demo (no deps)
  server.py        zero-dependency browser demo for functionality testing
scripts/
  setup_tavus.py   patch the Examiner PAL, register+attach the assessment tool
```

Status: Layers A & C, coaching/session/parts, PAL payloads, and the Tavus grading
tool (schema + event parser + grading context) are implemented and tested. The
Charsiu forced-alignment/GOP backend is scaffolded behind a clean interface (a
zero-dep proxy keeps everything runnable now).

---

## 6. What you need to do on your end (Tavus setup)

You already have an Examiner PAL: **`pece42dab07f`** ("test examiner"). To make it
exam-ready, configure it in the PAL editor (or run `scripts/setup_tavus.py`):

The prompts live in code (`src/assessment/pal.py`) so they're set **at the API
level**, not hand-edited in the dashboard. `scripts/setup_tavus.py` automates this.

1. **System prompt** → `pal.build_pal_payload()` sends the examiner prompt (persona
   + 3-part structure + guardrails folded in, since Objectives/Guardrails are gated)
   and **STT = `tavus-soniox`**. (`uv run python scripts/setup_tavus.py pal --execute`)
2. **Assessment tool** → register `submit_ielts_assessment` (`POST /v2/tools`) and
   attach it to the PAL (`POST /v2/pals/{id}/tools`).
   (`uv run python scripts/setup_tavus.py tool --execute`)
3. **Knowledge** → add the band descriptors + question bank as **custom text** (the
   Knowledge field accepts text) or upload files; tag `ielts-rubric` / `ielts-questions`.
4. **Faces** → collect a **pool of Face ids** (stock faces fine) for the random
   examiner. `setup_tavus.py faces` lists them.
5. **Per conversation** (`pal.build_conversation_payload()`): pick a random `face_id`,
   pass the selected `parts`, `username` (→ `memory_stores`), `enable_recording=true`,
   and a `callback_url` so we receive `application.recording_ready` (the audio the
   pronunciation layer needs). At the end, append `build_grading_context(features)` +
   `GRADING_INSTRUCTION` so the PAL calls the assessment tool.
6. **`.env`** → `cp .env.example .env`; set `TAVUS_API_KEY`,
   `TAVUS_PAL_ID=pece42dab07f`, `TAVUS_FACE_ID` (or the pool in app config). No LLM key.

Grading uses the Tavus LLM via the tool-call, so there is **no separate LLM key**.

---

## 7. Data contract (the integration boundary)

The app/backend gives us `Turn`s (from utterance events + the recording) and gets
back a `Scorecard`. Both are plain dataclasses (`schema.py`), JSON-serialisable.
This is the seam between the voice-ML backend and the rest of the app — keep it
stable; everything else can change behind it.
