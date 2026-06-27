"""Grade with Tavus's own LLM via tool-calling — no separate LLM key.

We register a `submit_ielts_assessment` tool (Tavus tools registry) and attach it to
the PAL. At the end of the test the PAL calls it; we receive a `conversation.tool_call`
event and parse it into our `Scorecard`. Tavus's LLM does the reasoning.

The user story's "transcript is not enough, pronunciation matters" is handled by
`build_grading_context()`: we inject our deterministic Layer-A features — especially
the **Charsiu** pronunciation (GOP) and fluency timings the LLM cannot hear — as
context right before grading, so the bands are grounded in real measurements. Band
descriptors live in the Knowledge base (custom text), so grading follows real criteria.

Contract verified against docs.tavus.io:
  - tool def is FLAT (name/description/parameters/origin/on_call/on_resolve/delivery),
    created via POST /v2/tools, attached via POST /v2/pals/{id}/tools {tool_ids:[...]}
  - the event is type "conversation.tool_call" with tool_name + arguments (object)

Flow:
  1. backend computes Layer-A features from the recording (fluency/lexical/grammar/GOP)
  2. append build_grading_context(features) + GRADING_INSTRUCTION to the call
  3. PAL calls submit_ielts_assessment(...) -> conversation.tool_call event
  4. scorecard_from_event(event) -> Scorecard for the report card
"""

from __future__ import annotations

from .schema import (TurnFeatures, Criterion, JudgeResult, Evidence, FeedbackItem,
                     Scorecard)
from .aggregate import aggregate

TOOL_NAME = "submit_ielts_assessment"

_CRIT_PARAM = {
    "type": "object",
    "properties": {
        "band": {"type": "number", "description": "0–9, half-bands allowed"},
        "feedback": {"type": "string",
                     "description": "specific, e.g. 'you said X; a band-7 answer would say Y'"},
        "evidence": {"type": "array", "items": {"type": "string"},
                     "description": "short verbatim quotes from the candidate"},
    },
    "required": ["band", "feedback"],
}

# Body for POST /v2/tools (flat schema, per the Tavus tools registry).
ASSESSMENT_TOOL = {
    "name": TOOL_NAME,
    "description": ("Submit the final IELTS Speaking assessment when the test ends. "
                    "Use the band descriptors from your Knowledge and the objective "
                    "speech measurements provided in context. Do not say scores aloud."),
    "parameters": {
        "type": "object",
        "properties": {
            "fluency_coherence": _CRIT_PARAM,
            "lexical_resource": _CRIT_PARAM,
            "grammatical_range_accuracy": _CRIT_PARAM,
            "pronunciation": _CRIT_PARAM,
        },
        "required": ["fluency_coherence", "lexical_resource",
                     "grammatical_range_accuracy", "pronunciation"],
    },
    "origin": "llm",
    "on_call": "silent",            # don't speak filler while grading
    "on_resolve": "fire_and_forget",  # scores aren't read aloud; just capture them
    "delivery": {"type": "app_message"},  # receive via the data channel
}

GRADING_INSTRUCTION = (
    "The test is now complete. Using the IELTS band descriptors in your Knowledge and "
    "the OBJECTIVE SPEECH MEASUREMENTS provided, call submit_ielts_assessment with a "
    "band (0–9, half-bands allowed) and specific, quoted feedback for each of the four "
    "criteria. Weight the measurements heavily for Pronunciation, which you cannot hear "
    "directly. Do not read the scores aloud to the candidate.")

_KEY_TO_CRITERION = {
    "fluency_coherence": Criterion.FLUENCY_COHERENCE,
    "lexical_resource": Criterion.LEXICAL_RESOURCE,
    "grammatical_range_accuracy": Criterion.GRAMMATICAL_RANGE_ACCURACY,
    "pronunciation": Criterion.PRONUNCIATION,
}


def build_grading_context(features: TurnFeatures | list[TurnFeatures]) -> str:
    """Compact text of Layer-A (Charsiu/feature) measurements to inject before grading.

    The Pronunciation and Fluency lines are the point — they give the LLM the acoustic
    and temporal evidence (Charsiu GOP + word timings) it otherwise lacks.
    """
    feats = features if isinstance(features, list) else [features]
    n = len(feats) or 1
    rep = feats[-1]  # representative turn (e.g. the Part 2 long turn)
    fl, lx, g, p = rep.fluency, rep.lexical, rep.grammar, rep.pronunciation
    return "\n".join([
        "OBJECTIVE SPEECH MEASUREMENTS (ground your bands in these):",
        f"- Fluency: speech_rate={fl.speech_rate_wpm} wpm, long_pauses={fl.long_pause_count}, "
        f"fillers/100w={fl.fillers_per_100w}, mean_run={fl.mean_length_of_run} words.",
        f"- Lexical: MTLD={lx.mtld}, overused={lx.flagged_basic_overuse or 'none'}.",
        f"- Grammar: subordination_ratio={g.subordination_ratio}"
        + ("" if g.note else f", verb_form_variety={g.verb_form_variety}") + ".",
        f"- Pronunciation (Charsiu/acoustic, source={p.source}): accuracy={p.accuracy_score}, "
        f"prosody={p.prosody_score}, intelligibility={p.intelligibility_estimate}, "
        f"hard-to-understand words={p.low_accuracy_phonemes or 'none'}.",
        f"(measurements across {n} scored turn(s))",
    ])


def scorecard_from_arguments(args: dict) -> Scorecard:
    """Parse submit_ielts_assessment arguments -> Scorecard."""
    results: dict[Criterion, JudgeResult] = {}
    for key, crit in _KEY_TO_CRITERION.items():
        part = args.get(key)
        if not part:
            continue
        results[crit] = JudgeResult(
            criterion=crit,
            band=float(part.get("band", 0.0)),
            evidence=[Evidence(quote=q) for q in part.get("evidence", [])],
            feedback=[FeedbackItem(issue=part.get("feedback", ""))],
        )
    return aggregate(results)


def scorecard_from_event(event: dict) -> Scorecard:
    """Parse a `conversation.tool_call` event -> Scorecard.

    `arguments` may arrive as a dict or a JSON string depending on delivery.
    """
    if event.get("tool_name") != TOOL_NAME:
        raise ValueError(f"not a {TOOL_NAME} tool_call event")
    args = event.get("arguments", {})
    if isinstance(args, str):
        import json
        args = json.loads(args or "{}")
    return scorecard_from_arguments(args)
