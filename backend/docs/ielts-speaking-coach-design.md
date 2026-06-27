# IELTS Speaking Coach on Tavus CVI — Architecture & Assessment Policy

> A conversational experience where a learner talks to a Tavus PAL (the "examiner"),
> and an asynchronous assessment engine scores every turn against the official IELTS
> Speaking criteria and returns evidence-grounded, speech-feature feedback.

---

## 0. Product framing

Two modes, same engine:

| Mode | Examiner behaviour | Feedback timing | Use |
|---|---|---|---|
| **Exam Simulation** | Neutral, strict 3-part timing, never helps | Full scorecard *after* the test | Authentic mock test, get a band |
| **Coach / Practice** | Encouraging, can hint, lets you retry Part 2 | Micro-feedback between turns + report | Targeted drilling of weak criteria |

The mode split matters: a real examiner does **not** coach, so coaching must be an explicit, separate mode — not bleed into the simulation.

---

## 1. Tavus CVI primitives we build on

CVI pipeline order: **Perception (Raven) → Conversational Flow (Sparrow) → STT → LLM → TTS → Replica (Phoenix)**. ([overview](https://docs.tavus.io/sections/conversational-video-interface/overview-cvi))

| Concept | Tavus name | What we use it for |
|---|---|---|
| Persona (behaviour, prompt, layers) | **PAL** | The Examiner. One PAL, two prompt variants (exam vs coach). |
| Visual avatar (Phoenix) | **Face** | A calm, professional examiner face. |
| Live session | **Conversation** | One IELTS test = one conversation. |
| Speech-to-text | `layers.stt.stt_engine` | **`tavus-soniox`** — keeps fillers/disfluencies (which Fluency is scored on). Word/phone timings come from forced alignment (§6), not the STT. ([stt](https://docs.tavus.io/sections/conversational-video-interface/pal/stt)) |
| Reasoning | `layers.llm` | Tavus hosts an OpenAI-compatible LLM (default Llama 3.3 70B). Used for the examiner dialogue **and** reusable for the off-call judges — one Tavus key. ([llm](https://docs.tavus.io/sections/conversational-video-interface/pal/llm)) |
| Real-time events | Daily WebRTC data channel (`app-message`) | Receive `conversation.utterance`, `started/stopped_speaking`; send `echo`, `respond`, `overwrite_context`. ([interactions](https://docs.tavus.io/sections/conversational-video-interface/interactions-protocols/overview)) |
| Cross-session memory | `memory_stores: ["ielts_{userId}"]` | Learner's recurring errors, target band, topics done. ([memories](https://docs.tavus.io/sections/conversational-video-interface/memories)) |
| Knowledge base / RAG | **Tavus Knowledge Base** — `POST /v2/documents` → `document_ids`/`document_tags` | Question bank + official band descriptors uploaded as Tavus documents, ~30 ms retrieval. **No separate vector DB.** ([knowledge-base](https://docs.tavus.io/sections/conversational-video-interface/knowledge-base)) |
| Recording / captions | `properties.enable_recording`, `enable_closed_captions` | Per-turn audio (MP4 via `application.recording_ready`) → feeds forced alignment + pronunciation. |

### STT engines available
`tavus-auto` (router), `tavus-parakeet` (English, min latency), **`tavus-soniox`** (keeps fillers — our pick for assessment), `tavus-whisper` (43 langs), `tavus-deepgram-medical`. Configure with `stt_engine` + `hotwords`. The in-call transcript is utterance-level; per-word timing is recovered by forced alignment on the recording (§6).

### LLM layer — bring-your-own
```json
{ "layers": { "llm": {
  "model": "your-model",
  "base_url": "https://your-endpoint",   // OpenAI-compatible, SSE, /chat/completions
  "api_key": "…",
  "speculative_inference": true,
  "extra_body": { "temperature": 0.4 }
}}}
```
> ⚠️ Keep in-call context **< 5,000 tokens**. Degrades at 15k–20k. This is *why* the scorer must live outside the call.

---

## 2. The core decision: two brains

```
                    ┌───────────────────────── IN-CALL (low latency) ─────────────────────────┐
   learner mic ──►  │  Tavus CVI  ──►  Examiner PAL  ──►  Phoenix face  ──►  learner sees/hears │
                    └───────────────┬──────────────────────────────────────────────────────────┘
                                    │ data channel: utterance + speaking events (per turn)
                                    │ + local mic capture (isolated user audio per turn)
                                    ▼
   ┌────────────────────────── ASYNC ASSESSMENT ENGINE (no latency budget) ──────────────────────┐
   │  A. Deterministic feature extraction   B. Rubric judges (LLM)   C. Calibrate + aggregate     │
   │  (timings, lexical, syntactic, prosody) (1 per criterion, RAG)  (exemplar-anchored, rounding) │
   └──────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                   ▼
                              Scorecard + speech-feature feedback + progress memory
```

**Examiner PAL** = elicit good speech, manage the 3-part flow & timing, stay in character. It never computes scores during the call.
**Assessment Engine** = everything numeric and analytic, runs turn-by-turn in parallel and never blocks the conversation.

---

## 3. Data capture

1. `enable_recording: true`, `enable_closed_captions: true`.
2. Subscribe to the Daily data channel:
   - `conversation.utterance` → `{ turn_idx, role, properties.text, timestamp }` per finalized turn.
   - `conversation.started/stopped_speaking` (`role: "user"`) → **turn boundaries** (start/end wall-clock).
3. **Capture the user's mic locally** in the browser (you already hold the `MediaStreamTrack`) and slice it on the speaking boundaries → you get **clean, isolated per-turn audio**. This is essential — pronunciation/prosody cannot be recovered from a clean transcript, and the post-call recording is mixed.
4. `tavus-parakeet` gives **word-level timestamps** → the backbone of all fluency metrics.

> Insight: a transcript is *lossy for assessment*. It auto-punctuates, drops fillers, and erases timing — exactly the signals IELTS Fluency & Pronunciation are made of. Keep the audio + word timings, not just text.

---

## 4. Assessment Engine

### Layer A — Deterministic features (cheap, reliable, no LLM)
Computed from word-timings + per-turn audio. These are the **evidence base** that grounds the judges.

| IELTS criterion | Objective features |
|---|---|
| **Fluency & Coherence** | speech rate (wpm), articulation rate, mean length of run (words between pauses ≥250 ms), silent-pause count/duration, filled pauses (um/uh), false starts & functionless repetitions (use *raw* STT before cleanup), phonation-time ratio, discourse-marker density |
| **Lexical Resource** | MTLD / vocd-D (length-robust type-token ratio), % words beyond top-2000 frequency band (SUBTLEX), Academic Word List coverage, collocation/idiom hits, successful-paraphrase detection |
| **Grammatical Range & Accuracy** | clauses/sentence & subordination ratio (spaCy), mean length of T-unit, verb-form/tense variety, modality & passive use, error density + error-gravity flags |
| **Pronunciation** | **needs audio + a pronunciation model** — see §6 |

### Layer B — Rubric judges (LLM-as-judge, one per criterion)
Four specialized judges beat one generalist: each focuses, and each gets *the right evidence*. Every judge receives:
- the relevant transcript spans for the turn/section,
- the Layer-A features for **its** criterion only,
- the **official band descriptors** + **2–3 retrieved band-anchor exemplars** (RAG, §5),

and returns **structured output**: `{ band, confidence, evidence[] (quotes + which feature), feedback[] }`. Evidence citations are mandatory — no un-grounded numbers.

### Layer C — Calibration & aggregation
- **Anchor by comparison, not abstraction.** LLMs score far more consistently when asked "is this closer to the band-6 or band-7 exemplar?" than "give a band." Retrieve exemplars at the candidate band ± 1 and force a comparative judgment.
- **Aggregate → overall band.** Mean of the four criterion bands, rounded to the nearest half-band per IELTS rule: `.25 → round up to .5`, `.75 → round up to next whole`. (e.g., 6.25→6.5, 6.75→7.0).
- Optional **head-examiner meta-judge** reconciles when a criterion judge's band contradicts its own features (e.g., claims band-7 fluency but speech rate is 80 wpm with 12 long pauses).

---

## 5. Where RAG actually earns its place

RAG here is **not** "answer questions." Three concrete jobs:

Implemented with the **Tavus Knowledge Base** (`POST /v2/documents` → `document_tags`) — no separate vector DB:

1. **Descriptor grounding** — upload the full public **band 1–9 descriptors** as a Tavus document so judges (and the examiner) quote real standards instead of inventing them. Tag: `ielts-rubric`.
2. **Exemplar calibration** — upload a small corpus of **sample answers labelled with official bands**; the judge LLM retrieves nearest exemplars to the learner's answer → few-shot anchoring. *Biggest reliability lever.* Tag: `ielts-exemplars`.
3. **Question bank** — authentic **Part 1 / cue cards / Part 3** questions by topic so the examiner asks realistic, non-repeating questions and Part 3 extends the Part 2 topic. Tag: `ielts-questions`.

---

## 6. Pronunciation — the hard part (don't hand-wave it)

A transcript can't score pronunciation. You need acoustics. Our pick:

- **Charsiu GOP** (MIT, local, recommended): `lingjzhu/charsiu` is a wav2vec2
  forced aligner whose frame-classification model yields per-phoneme posteriors →
  **Goodness-of-Pronunciation** per phoneme/word, plus aligned durations for word
  stress; add an F0 contour for intonation. **Double duty:** the same alignment
  gives the word/phone timings the Fluency layer needs — so no separate STT for timing.
- **Weak proxy** (fallback): STT word-confidence + timing irregularity. Cheap and
  coarse — flags problems, doesn't truly score. Keeps the pipeline runnable until
  the model is wired (`source="proxy"` tells the judge to down-weight it).

The pronunciation model's outputs become Layer-A features for the Pronunciation judge.

---

## 7. Memory management — three tiers

1. **In-conversation working memory (tiny).** The PAL holds only: current part, current question, topics covered, time budget, last few turns. Drive transitions by **pushing compact state** into the call via `conversation.overwrite-context` / `append-context` (e.g., *"Move to Part 2. Cue card: Describe a journey…"*). Do **not** stream the whole transcript into the PAL — let CVI own dialogue context and keep us under the 5k-token line.
2. **Cross-session learner memory** (`memory_stores: ["ielts_{userId}"]`, stable id). Persists recurring errors, weak criteria, target band, topics already practiced, last scores → continuity greeting (*"Last time grammar held you at 6 — let's push complex sentences"*) and longitudinal tracking.
3. **Assessment record store (your DB).** Source of truth: per-turn features, judge outputs, scores, audio clips. `memory_stores` holds only the distilled summary; the DB holds the evidence trail for reports and progress charts.

---

## 8. Speech-feature feedback (the differentiator)

Turn coaching from "you got a 6" into specific, actionable, rubric-anchored guidance:

- **Fluency:** "95 wpm, 8 silent pauses >1 s while word-searching; target 120–150. You hesitated here: '…[quote]…'." + filler tally.
- **Lexical:** flag over-used basic words → offer upgrades ("'good' ×6 → *beneficial / worthwhile / rewarding*"); **praise successful paraphrase** (the rubric explicitly rewards it).
- **Grammar:** 2–3 concrete corrections + the rule; clause-complexity note ("90% simple sentences — try a relative clause: 'The city, which I'd visited as a child, …'").
- **Pronunciation:** per-phoneme heatmap, word-stress misses, flat-intonation flags; play learner clip vs model pronunciation.

Delivery: **post-test report** (primary) = scorecard + drill-downs + a 1-minute "next focus" plan. **In-call micro-coaching** = Coach mode only, Part-1 only, gentle recasts, never in Exam mode.

---

## 9. Suggested build plan (hackathon-sized)

1. **Spin up CVI:** create Face + Examiner PAL (exam prompt), start a conversation, render with the CVI React components. Wire the data channel; log `utterance` + speaking events. *(half day)*
2. **Capture pipeline:** isolated per-turn user audio + word-timings → object store. *(½ day)*
3. **Layer A features:** fluency + lexical + syntactic metrics from timings/transcript. *(1 day)*
4. **Layer B judges + RAG:** 4 structured judges, descriptor + exemplar retrieval, comparative scoring. *(1 day)*
5. **Pronunciation:** Charsiu forced alignment + GOP on per-turn audio. *(½ day)*
6. **Report UI + memory:** scorecard, drill-downs, progress; `memory_stores` continuity. *(1 day)*

Stack: Tavus CVI (front) — STT + hosted LLM + Knowledge Base under one key; Python backend; spaCy + word-frequency lists for Layer A; Charsiu (MIT) for pronunciation + word timings; the judge LLM is OpenAI-compatible (per the user story, point it at **Claude**) for Layer B.

---

## 10. Risks / open questions

- **Score calibration** is the make-or-break: invest in the exemplar corpus early; validate against any human-rated samples you can find.
- **Examiner naturalness vs control:** too much scripted state-injection feels robotic; too little and timing/structure drift. Tune the `overwrite_context` cadence.
- **Pronunciation vendor** choice (Azure vs open GOP) — decide by accuracy needs vs lock-in.
- **Half-band per criterion**: examiners report whole bands per criterion; our engine can emit half-bands — present clearly so users aren't confused vs official scoring.

## References
- CVI overview, STT, LLM, Interactions, Memories, Create-Conversation — all under `https://docs.tavus.io`.
- IELTS Speaking Key Assessment Criteria (official PDF) — the four criteria & key indicators are encoded in `prompts/assessor-rubric-judges.md`.
