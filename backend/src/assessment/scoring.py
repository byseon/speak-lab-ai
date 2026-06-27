"""One-call orchestration: a Tavus-style turn payload -> full assessment dict.

This is the reusable seam between the assessment engine and any transport
(the FastAPI service in `api.py`, the stdlib demo in `examples/server.py`, or a
test). It takes raw word-timings + transcript and returns a JSON-ready dict with
the Layer-A features, coaching cues, a heuristic scorecard preview, and the
conversational wrap-up.

NOTE: the scorecard here is a transparent *heuristic preview* derived from the
deterministic features so the pipeline is self-contained and key-free. In
production the bands come from the Tavus LLM rubric judges (see `tavus_tools.py`);
this module is the structural contract the frontend persists and renders.

Pure stdlib.
"""

from __future__ import annotations

from collections import OrderedDict
from dataclasses import asdict
from enum import Enum
from typing import Any

from . import (Turn, Scorecard, Criterion, JudgeResult, aggregate, Part,
               TurnFeatures, extract_features)
from .session import CoachingSession
from .parts import get_part, CRITERION_PRIMARY_PART
from .coaching import CueGenerator
from .stt import words_from_tavus_tokens


def _clamp_half(x: float) -> float:
    """IELTS half-band rounding, clamped to the range the heuristic can defend."""
    return max(4.0, min(8.5, round(x * 2) / 2))


def _criteria_raw(f: TurnFeatures) -> dict[Criterion, float]:
    """Raw (unclamped) per-criterion scores for one turn's features.

    Single source of truth for the heuristic preview; fluency/pronunciation lean on
    word timings, so they degrade gracefully (toward neutral) for text-only turns.
    """
    fl = f.fluency
    fc = 7.0 - 0.4 * fl.long_pause_count - 0.05 * fl.fillers_per_100w
    if 0 < fl.effective_speech_rate_wpm < 90:
        fc -= 0.5
    lr = 5.0 + min(2.5, f.lexical.mtld / 30) - 0.4 * len(f.lexical.flagged_basic_overuse)
    g = f.grammar
    gra = 6.0 if g.note else 5.0 + 3 * g.subordination_ratio + (0.5 if g.uses_modality else 0)
    pr = 5.5 + ((f.pronunciation.intelligibility_estimate or 0.7) - 0.7) * 5
    return {
        Criterion.FLUENCY_COHERENCE: fc,
        Criterion.LEXICAL_RESOURCE: lr,
        Criterion.GRAMMATICAL_RANGE_ACCURACY: gra,
        Criterion.PRONUNCIATION: pr,
    }


def heuristic_scorecard_from_features(turns: list[TurnFeatures],
                                      meta_flags: list[str] | None = None) -> Scorecard:
    """Heuristic scorecard preview averaged across a set of turns (e.g. one part)."""
    if not turns:
        raise ValueError("no turns to score")
    acc = {c: 0.0 for c in Criterion}
    for f in turns:
        for c, v in _criteria_raw(f).items():
            acc[c] += v
    n = len(turns)
    results = {c: JudgeResult(c, _clamp_half(acc[c] / n)) for c in Criterion}
    return aggregate(results, meta_flags=meta_flags)


def heuristic_scorecard(session: CoachingSession) -> Scorecard:
    """A feature-derived scorecard preview (production uses the LLM judges)."""
    return heuristic_scorecard_from_features(session.turns)


def json_default(o: Any) -> Any:
    """json.dumps default that handles the engine's Enums and sets.

    FastAPI's encoder already does this; provided so non-FastAPI callers (the
    stdlib demo, tests) can serialize the same dict.
    """
    if isinstance(o, Enum):
        return o.value
    if isinstance(o, set):
        return sorted(o)
    raise TypeError(repr(o))


def score_turn(
    words: list[dict[str, Any]],
    clean_text: str = "",
    part: int = 2,
    mode: str = "coach",
    turn_idx: int = 1,
) -> dict[str, Any]:
    """Score one turn end-to-end and return a JSON-ready assessment dict.

    Keys: ``features``, ``focus``, ``next_question_hint``, ``cues``,
    ``scorecard``, ``report``. Enum values are returned as their ``.value``
    (ints for Part, criterion strings for Criterion) so the payload round-trips
    cleanly through JSON.
    """
    turn = Turn.from_tavus(turn_idx=turn_idx, part=int(part), words=words,
                           clean_text=clean_text)
    session = CoachingSession(mode=mode)
    result = session.process_turn(turn)
    # Part 2 holds its cues until the long turn ends; flush so callers see them.
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
# Per-part session scoring — each part scored from ITS OWN utterances only       #
# --------------------------------------------------------------------------- #


def _utt_dict(u: Any) -> dict:
    """Normalize a TaggedUtterance (examiner.py) or a plain dict to a dict."""
    if isinstance(u, dict):
        return u
    return {"part": getattr(u, "part"), "text": getattr(u, "text", ""),
            "words": getattr(u, "words", None), "duration_s": getattr(u, "duration_s", None)}


def _split_feedback(turns: list[TurnFeatures]) -> tuple[list[dict], list[dict]]:
    """Coaching for a part's turns, kept SEPARATE from the bands.

    Returns (strengths, improvements), each deduped by message.
    """
    gen = CueGenerator()
    seen_s: set = set()
    seen_i: set = set()
    strengths: list[dict] = []
    improvements: list[dict] = []
    for f in turns:
        for cue in gen.generate(f, mode="coach"):
            if cue.kind == "praise":
                if cue.message not in seen_s:
                    seen_s.add(cue.message)
                    strengths.append({"criterion": cue.target.value, "message": cue.message})
            else:
                key = (cue.target.value, cue.message)
                if key not in seen_i:
                    seen_i.add(key)
                    improvements.append({"criterion": cue.target.value, "kind": cue.kind,
                                         "message": cue.message, "evidence": cue.evidence})
    return strengths, improvements


def _overall_from_parts(per_criterion: dict[Criterion, dict[Part, float]]) -> Scorecard:
    """Combine per-part criterion bands into one overall scorecard.

    Each criterion is taken from its primary (most-revealing) part when present,
    else the mean of the parts where it was observed. Combines NUMBERS only — no
    transcript crosses a part boundary.
    """
    results: dict[Criterion, JudgeResult] = {}
    for crit in Criterion:
        bands = per_criterion.get(crit, {})
        if not bands:
            continue
        primary = CRITERION_PRIMARY_PART[crit]
        band = bands[primary] if primary in bands else sum(bands.values()) / len(bands)
        results[crit] = JudgeResult(crit, _clamp_half(band))
    if not results:
        raise ValueError("no parts to score")
    return aggregate(results)


def score_session(utterances: list[Any], mode: str = "exam") -> dict:
    """Score a whole test PER PART, from each part's own utterances only.

    `utterances` is a list of part-tagged turns — `examiner.TaggedUtterance` objects
    or plain dicts ``{part, text, words?, duration_s?}``. Returns a structure that
    SEPARATES scoring (bands/evidence) from feedback (coaching), each broken down by
    part, plus a combined overall band. Part transcripts never mix; the overall band
    takes each criterion from the part that best reveals it (CRITERION_PRIMARY_PART).
    """
    by_part: "OrderedDict[Part, list[dict]]" = OrderedDict()
    for raw in utterances:
        u = _utt_dict(raw)
        p = Part(int(u["part"]))
        by_part.setdefault(p, []).append(u)
    if not by_part:
        raise ValueError("no utterances to score")

    scoring_by_part: dict[str, Any] = {}
    feedback_by_part: dict[str, Any] = {}
    per_criterion: dict[Criterion, dict[Part, float]] = {}

    for part, us in by_part.items():
        turns_feats: list[TurnFeatures] = []
        has_timings = False
        for i, u in enumerate(us):
            tokens = u.get("words") or []
            words = words_from_tavus_tokens(tokens) if tokens else []
            if words:
                has_timings = True
            turn = Turn(turn_idx=i, part=part, words=words, clean_text=u.get("text", ""))
            turns_feats.append(extract_features(turn))

        flags = [] if has_timings else [
            "fluency_coherence and pronunciation are placeholders (no audio word "
            "timings for this part) — provide word timings for real acoustic bands."]
        card = heuristic_scorecard_from_features(turns_feats, meta_flags=flags)
        pa = get_part(part).assess(turns_feats)
        strengths, improvements = _split_feedback(turns_feats)

        scoring_by_part[str(int(part))] = {
            "scorecard": card.to_dict(),
            "assessment": asdict(pa),
            "has_audio_timings": has_timings,
        }
        feedback_by_part[str(int(part))] = {
            "strengths": strengths,
            "improvements": improvements,
        }
        for crit_key, jr in card.criteria.items():
            per_criterion.setdefault(Criterion(crit_key), {})[part] = jr.band

    overall = _overall_from_parts(per_criterion)
    return {
        "overall_band": overall.overall_band,
        "parts_scored": [int(p) for p in by_part],
        "scoring": {"overall": overall.to_dict(), "by_part": scoring_by_part},
        "feedback": {"by_part": feedback_by_part},
    }


# --------------------------------------------------------------------------- #
# Schema row mappers — shape backend output for the Supabase tables             #
#                                                                               #
# Pure functions: they produce DB-ready dicts that match the table columns but  #
# do NOT touch Supabase. The persistence layer (the plumbing) adds session_id / #
# user_id and runs the insert. Keeping the SHAPE here means the per-part         #
# transcription + scoring log straight into the schema with no reshaping.        #
# --------------------------------------------------------------------------- #

_PART_SPEAKER = {"examiner", "candidate"}


def to_transcript_rows(utterances: list[Any], start_turn_idx: int = 0) -> list[dict]:
    """Map part-tagged utterances to `public.transcripts` rows.

    Columns: turn_idx, part, speaker, prompt, text, words, started_at_s, ended_at_s.
    `session_id` / `user_id` are added by the persistence layer.
    """
    rows = []
    for i, raw in enumerate(utterances):
        u = _utt_dict(raw)
        role = u.get("role", "candidate")
        speaker = "examiner" if role in ("examiner", "assistant") else "candidate"
        rows.append({
            "turn_idx": start_turn_idx + i,
            "part": int(u["part"]),
            "speaker": speaker,
            "prompt": u.get("prompt"),
            "text": u.get("text", ""),
            "words": u.get("words") or [],
            "started_at_s": u.get("started_at_s"),
            "ended_at_s": u.get("ended_at_s"),
        })
    return rows


def to_assessment_result(score_out: dict) -> dict:
    """Map `score_session()` output to a `public.assessment_results` row.

    Overall criterion bands -> the band columns; the full per-part scoring and
    feedback -> the `scorecard` / `coaching` jsonb columns (so the per-part detail
    is preserved even though the table is one row per session).
    """
    row = _bands_from_card(score_out["scoring"]["overall"])
    row["scorecard"] = score_out["scoring"]
    row["coaching"] = score_out["feedback"]
    return row


def to_progress_row(score_out: dict) -> dict:
    """Map `score_session()` output to a `public.progress_history` row (band columns)."""
    a = to_assessment_result(score_out)
    return {k: a[k] for k in ("overall_band", "fluency_band", "lexical_band",
                              "grammar_band", "pronunciation_band")}


def _bands_from_card(scorecard: dict) -> dict:
    """Pull the four IELTS band columns out of a scorecard dict."""
    criteria = scorecard["criteria"]

    def band(key: str):
        c = criteria.get(key)
        return c["band"] if c else None

    return {
        "overall_band": scorecard["overall_band"],
        "fluency_band": band("fluency_coherence"),
        "lexical_band": band("lexical_resource"),
        "grammar_band": band("grammatical_range_accuracy"),
        "pronunciation_band": band("pronunciation"),
    }


def to_part_result_rows(score_out: dict) -> list[dict]:
    """Map `score_session()` to PER-PART `assessment_results` rows — one per part

    (3 per session). Each row: part, the 4 band columns + overall_band for that
    part, and that part's `scorecard` / `coaching` jsonb. Matches a results table
    keyed on (mock_session_id, part). `mock_session_id` / `user_id` are added by
    persistence.
    """
    feedback = score_out["feedback"]["by_part"]
    rows = []
    for part_key, sc in score_out["scoring"]["by_part"].items():
        row = {"part": int(part_key)}
        row.update(_bands_from_card(sc["scorecard"]))
        row["scorecard"] = sc
        row["coaching"] = feedback.get(part_key, {})
        rows.append(row)
    return rows


def to_part_transcript_rows(utterances: list[Any]) -> list[dict]:
    """Group part-tagged utterances into PER-PART `transcripts` rows — one per part

    (3 per session). Each row: part, `raw_transcript` (that part's turns + word
    timings, as jsonb) and `candidate_text` (that part's speech concatenated).
    Matches a transcripts table keyed on (mock_session_id, part).
    """
    by_part: "OrderedDict[int, list[dict]]" = OrderedDict()
    for raw in utterances:
        u = _utt_dict(raw)
        by_part.setdefault(int(u["part"]), []).append(u)
    rows = []
    for part, us in by_part.items():
        turns = [{"turn_idx": i, "text": u.get("text", ""),
                  "words": u.get("words") or [], "duration_s": u.get("duration_s")}
                 for i, u in enumerate(us)]
        candidate_text = " ".join(u.get("text", "").strip() for u in us if u.get("text"))
        rows.append({"part": part, "raw_transcript": {"turns": turns},
                     "candidate_text": candidate_text})
    return rows
