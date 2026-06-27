"""Quick transcript-only scoring — closes the live demo's talk -> score loop locally
(no webhook, no recording, no ngrok).

WITHOUT audio/word-timings only LEXICAL and GRAMMATICAL evidence is real; FLUENCY and
PRONUNCIATION need the recording (Charsiu/GOP) and are returned as honest placeholders.
For the full loop, use the webhook + recording + Charsiu path.
"""

from __future__ import annotations

from .schema import Turn, Part, Criterion, JudgeResult, Scorecard
from .aggregate import aggregate
from .session import CoachingSession, ConversationalReport

PLACEHOLDER = "needs audio (recording + Charsiu) — placeholder"


def _half(x: float) -> float:
    return max(4.0, min(8.5, round(x * 2) / 2))


def score_transcript(clean_text: str) -> tuple[Scorecard, ConversationalReport, dict]:
    """Score a transcript (candidate speech). Returns (scorecard, report, notes)."""
    turn = Turn(turn_idx=1, part=Part.PART2, words=[], clean_text=clean_text)
    session = CoachingSession(mode="exam")
    session.process_turn(turn)
    f = session.turns[-1]

    lr = 5.0 + min(2.5, f.lexical.mtld / 30) - 0.4 * len(f.lexical.flagged_basic_overuse)
    g = f.grammar
    gra = 6.0 if g.note else 5.0 + 3 * g.subordination_ratio + (0.5 if g.uses_modality else 0)

    results = {
        # real (from text):
        Criterion.LEXICAL_RESOURCE: JudgeResult(Criterion.LEXICAL_RESOURCE, _half(lr)),
        Criterion.GRAMMATICAL_RANGE_ACCURACY: JudgeResult(
            Criterion.GRAMMATICAL_RANGE_ACCURACY, _half(gra)),
        # placeholders (need audio/timings):
        Criterion.FLUENCY_COHERENCE: JudgeResult(Criterion.FLUENCY_COHERENCE, 6.0),
        Criterion.PRONUNCIATION: JudgeResult(Criterion.PRONUNCIATION, 6.0),
    }
    card = aggregate(results)
    report = session.conversational_summary(card)
    notes = {
        "real_criteria": ["lexical_resource", "grammatical_range_accuracy"],
        "placeholder_criteria": {"fluency_coherence": PLACEHOLDER,
                                 "pronunciation": PLACEHOLDER},
        "mtld": f.lexical.mtld,
        "overused": f.lexical.flagged_basic_overuse,
    }
    return card, report, notes
