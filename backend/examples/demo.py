"""End-to-end Layer-A demo on a synthetic Part-2 answer. Runs with zero deps:

    uv run python examples/demo.py        # (or: PYTHONPATH=src python examples/demo.py)

Shows what the voice-ML backend produces per turn (the evidence the judges score),
plus an illustrative aggregation with example criterion bands.
"""

from __future__ import annotations

import json
from dataclasses import asdict

from assessment import Turn, Part, Criterion, JudgeResult, aggregate
from assessment.features import extract_features


def build_turn() -> Turn:
    """A hesitant ~40-word Part-2 monologue with realistic timing.

    Each entry: (word, duration_s, gap_after_s). Gaps >= 0.25s become silent
    pauses; 'um'/'uh' are filled pauses; the repeated 'I I' is a false start.
    """
    script = [
        ("um", 0.3, 0.4), ("when", 0.2, 0.0), ("I", 0.15, 0.0), ("was", 0.2, 0.0),
        ("a", 0.1, 0.0), ("teenager", 0.5, 0.6),
        ("I", 0.15, 0.05), ("I", 0.15, 0.0), ("travelled", 0.4, 0.0),
        ("to", 0.15, 0.0), ("Japan", 0.5, 0.3), ("with", 0.2, 0.0),
        ("my", 0.15, 0.0), ("family", 0.45, 1.3),  # long word-search pause
        ("uh", 0.3, 0.3), ("it", 0.15, 0.0), ("was", 0.2, 0.0), ("a", 0.1, 0.0),
        ("really", 0.3, 0.0), ("long", 0.3, 0.0), ("flight", 0.4, 0.5),
        ("but", 0.2, 0.0), ("the", 0.15, 0.1), ("the", 0.15, 0.0),
        ("scenery", 0.5, 0.0), ("was", 0.2, 0.0), ("beautiful", 0.6, 0.7),
        ("and", 0.2, 0.0), ("we", 0.15, 0.0), ("visited", 0.4, 0.0),
        ("many", 0.3, 0.0), ("temples", 0.5, 0.6),
        ("because", 0.4, 0.0), ("it", 0.15, 0.0), ("was", 0.2, 0.0),
        ("my", 0.15, 0.0), ("first", 0.3, 0.0), ("time", 0.3, 0.0),
        ("abroad", 0.5, 0.0),
    ]
    words, t = [], 0.0
    for text, dur, gap in script:
        words.append({"text": text, "start": round(t, 3), "end": round(t + dur, 3),
                      "confidence": 0.92 if text not in ("scenery", "abroad") else 0.55})
        t += dur + gap
    turn = Turn.from_tavus(turn_idx=4, part=2, words=words,
                           prompt="Describe a journey that you remember well.")
    turn.clean_text = (
        "When I was a teenager I travelled to Japan with my family. It was a really "
        "long flight but the scenery was beautiful and we visited many temples, "
        "because it was my first time abroad.")
    return turn


def main() -> None:
    turn = build_turn()
    feats = extract_features(turn)

    print("=" * 68)
    print(f"TURN {feats.turn_idx}  (Part {feats.part.value})  prompt: {turn.prompt}")
    print("=" * 68)
    print("\n--- Fluency & Coherence (from word timings) ---")
    for k, v in asdict(feats.fluency).items():
        if k != "silent_pauses":
            print(f"  {k:28} {v}")
    print(f"  {'silent_pauses (start,end,dur)':28} {feats.fluency.silent_pauses}")

    print("\n--- Lexical Resource ---")
    for k, v in asdict(feats.lexical).items():
        print(f"  {k:28} {v}")

    print("\n--- Grammatical Range & Accuracy ---")
    for k, v in asdict(feats.grammar).items():
        print(f"  {k:28} {v}")

    print("\n--- Pronunciation ---")
    for k, v in asdict(feats.pronunciation).items():
        print(f"  {k:28} {v}")

    # Illustrative aggregation (judges would produce these from the features above).
    mock = {
        Criterion.FLUENCY_COHERENCE: JudgeResult(Criterion.FLUENCY_COHERENCE, 6.0, 0.8),
        Criterion.LEXICAL_RESOURCE: JudgeResult(Criterion.LEXICAL_RESOURCE, 6.5, 0.7),
        Criterion.GRAMMATICAL_RANGE_ACCURACY: JudgeResult(
            Criterion.GRAMMATICAL_RANGE_ACCURACY, 6.0, 0.7),
        Criterion.PRONUNCIATION: JudgeResult(Criterion.PRONUNCIATION, 7.0, 0.6),
    }
    card = aggregate(mock)
    print("\n--- Illustrative Scorecard (bands are placeholders) ---")
    print(f"  per-criterion: "
          f"{ {c: r.band for c, r in card.criteria.items()} }")
    print(f"  OVERALL BAND (mean 6.375 -> IELTS round): {card.overall_band}")
    print("\n(JSON-serialisable scorecard ready for the API layer.)")
    json.dumps(card.to_dict())  # prove it serialises


if __name__ == "__main__":
    main()
