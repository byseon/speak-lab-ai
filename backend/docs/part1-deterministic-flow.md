# Part 1 — Near-Deterministic Examiner Flow

Part 1 must behave predictably (introduce → confirm identity → topic interview with
follow-ups → switch on struggle). We get there by **separating structure from phrasing**:
a backend state machine owns *what happens*; the LLM only handles *how it's worded*.

## Requirements → how they're met

| Requirement | Mechanism |
|---|---|
| (1) Examiner introduces themselves | `EXAMINER_INTRO`, delivered as `echo` (verbatim) — `pal.py` / orchestrator `start()` |
| (2) Examiner confirms the user's identity | `IDENTITY_PROMPT` ("…your full name, please?") in the same opening turn; the name is captured and echoed back ("Thank you, Sam.") |
| (3) General topics (home/family/work/hobbies…) | `TOPIC_BANK` opening questions, asked one topic at a time |
| → dive deeper via "conversational leads" | after an answer, `extract_lead()` pulls a noun the candidate mentioned; the follow-up is an `instruct` directive: *"ask a follow-up that digs into 'balcony'…"* |
| → switch topic if the user struggles | `_looks_lost()` + a min-word threshold; on struggle the orchestrator advances `TOPIC_BANK` immediately with a fresh opening |

## Two layers of determinism

1. **`Part1Orchestrator`** (`src/assessment/part1_flow.py`) — **authoritative**. A state
   machine (`INTRO → CONFIRM_IDENTITY → INTERVIEW → DONE`) that decides stage, topic,
   follow-up count, and switches. The app calls `start()` once, then `on_user_turn(text)`
   after each candidate utterance, and applies the returned `Directive`.
2. **System-prompt protocol** (`pal.PART_INSTRUCTIONS[PART1]`) — **fallback** that
   encodes the same procedure in the prompt, so even the plain iframe demo (no data
   channel) is near-deterministic without the orchestrator.

## The `Directive` → Tavus API contract

`on_user_turn` returns a `Directive(stage, deliver, text, topic, meta)`:

| `deliver` | Meaning | Tavus call | Used for |
|---|---|---|---|
| `echo` | Avatar says `text` **verbatim** (fully deterministic) | `conversation.echo` | intro, identity, topic openings, switches |
| `instruct` | LLM phrases `text` into one question (reacts to the lead) | `conversation.overwrite-context` / `append-context` | follow-ups, "Part 1 complete" |

Only follow-ups are `instruct`, because they must react to what the candidate just
said; everything structural is `echo`, so it can't drift.

## What the app must wire (frontend)

The orchestrator needs the candidate's turns in real time and a way to send echo/
context — i.e. the **Daily/CVI SDK** (not the bare iframe), subscribing to
`conversation.utterance` and calling `sendAppMessage` with the echo/overwrite events.
Backend contract is unchanged: feed each user utterance to `on_user_turn`, apply the
`Directive`. Until the SDK is wired, the system-prompt protocol carries the structure.

## Try it
```bash
uv run python examples/demo_part1_flow.py    # prints the full directive sequence
```
Tuning: `Part1Orchestrator(max_followups=2, max_topics=3, struggle_min_words=4, topics=[...])`.
