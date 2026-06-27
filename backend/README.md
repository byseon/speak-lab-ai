# IELTS Speaking Coach — Assessment Backend

A voice-ML backend that scores **IELTS Speaking** turns against the official
criteria and turns the result into an **interactive coaching conversation** with a
Tavus PAL (the "examiner"). Built for the Tavus Labs hackathon.

> **This is the Python service for the SpeakLab app.** The Vite/React frontend (repo
> root) talks to it over HTTP — see `examples/live_demo.py` for the Tavus
> conversation + `/api/score` + `/webhook` endpoints. It runs as a separate process
> (Python/uv) because the NLP/acoustic stack (spaCy, Charsiu/GOP) can't run inside
> Supabase edge functions. Keep secrets in `backend/.env` (gitignored).

> **Architecture & decisions: [`docs/ASSESSMENT.md`](docs/ASSESSMENT.md)** ·
> long-form rationale: [`docs/ielts-speaking-coach-design.md`](docs/ielts-speaking-coach-design.md) ·
> prompts: [`prompts/`](prompts/) · Tavus setup: [`scripts/setup_tavus.py`](scripts/setup_tavus.py)

## The idea in one picture

```
in-call (Tavus CVI):   Examiner PAL  ──►  elicits speech  ──► utterance + speaking events
                                                                +  isolated per-turn audio
                                  │
   async (this backend):         ▼
   A. features (fluency/lexical/grammar/pronunciation)   ← from word-timings + audio
   B. rubric judges (1 per criterion, RAG-anchored)      → bands + evidence
   C. aggregate (IELTS half-band rounding)               → scorecard
   coaching: features → ONE warm cue → injected back into the call (append-context / echo)
```

Two brains on purpose: the in-call PAL stays lean and low-latency (just talks); all
scoring/analysis happens off-call so it never slows the conversation.

## Layout

| Path | What |
|---|---|
| `src/assessment/schema.py` | Data contracts: `Turn`, `*Features`, `JudgeResult`, `Scorecard` |
| `src/assessment/features/` | **Layer A** — fluency (timings), lexical (MTLD), grammar (spaCy), pronunciation (Charsiu GOP / proxy) |
| `src/assessment/aggregate.py` | **Layer C** — IELTS half-band rounding + overall band |
| `src/assessment/coaching.py` | features → conversational coaching cue (mode/part gated) |
| `src/assessment/session.py` | stateful session: live cues, adaptive focus, conversational wrap-up |
| `src/assessment/stt.py` | word/phone timings via Charsiu forced alignment on the recording |
| `src/assessment/tavus_tools.py` | **Layer B** — grading via the Tavus PAL tool-call (no own LLM) + Charsiu/feature grading context |
| `src/assessment/pal.py` | examiner PAL config + create-PAL / create-conversation payloads (API-level) |
| `examples/demo.py` | end-to-end Layer-A demo (no deps) |
| `examples/server.py` | zero-dependency browser demo for functionality testing |

## Run it (with [uv](https://docs.astral.sh/uv/))

```bash
uv venv && uv pip install -e ".[dev]"   # core is pure stdlib; this just adds pytest

uv run pytest -q                         # unit tests
uv run python examples/demo.py           # CLI demo: features + scorecard for a turn
uv run python examples/demo_gop.py       # GOP pronunciation scoring on synthetic posteriors
uv run python examples/demo_part1_flow.py # near-deterministic Part 1 examiner flow (directive sequence)
uv run python examples/server.py         # assessment browser demo — http://localhost:8000
uv run python examples/live_demo.py      # LIVE Tavus call (needs .env keys) — talk to the examiner
```

No-install option (core is **pure stdlib** — schema, fluency, lexical, aggregation,
coaching): `PYTHONPATH=src python examples/demo.py`.

Heavier capabilities are optional extras, gated so they never block the core:

```bash
uv pip install -e ".[lexical]"   # rare-word frequency bands (wordfreq)
uv pip install -e ".[nlp]"       # grammar parsing (spaCy) + uv run python -m spacy download en_core_web_sm
uv pip install -e ".[pron]"      # Charsiu GOP pronunciation + forced alignment (torch/transformers)
uv pip install -e ".[env]"       # optional .env auto-loading (python-dotenv)
```

**Grading uses the Tavus LLM, not ours.** The PAL calls a `submit_ielts_assessment`
tool at the end of the test; we parse the `conversation.tool_call` event into a
`Scorecard`. One `TAVUS_API_KEY` covers STT, the LLM, and the Knowledge Base — no
own-LLM key. See [`.env.example`](.env.example).

## Key engineering decisions

- **Grading via Tavus tool-calling.** No second LLM. Pronunciation (which the LLM
  can't hear) is grounded by injecting Charsiu/feature measurements into the call as
  context (`tavus_tools.build_grading_context`) before the PAL calls the tool.
- **In-call STT keeps fillers** (`tavus-soniox`); word/phone timings come from
  **Charsiu forced alignment** on the recording — Whisper-family ASR normalises
  fillers away and must not be used for assessment.
- **Pronunciation needs acoustics.** Primary path: **Charsiu** (MIT, wav2vec2)
  forced alignment → Goodness-of-Pronunciation. A zero-dep proxy (STT confidence)
  keeps the pipeline runnable until the model is wired.
- **Deterministic features are the rigor backbone** — every band the Tavus LLM
  produces is anchored to objective measurements + Knowledge-base band descriptors.
