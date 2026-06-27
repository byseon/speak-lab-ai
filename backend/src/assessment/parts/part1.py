"""Part 1 — Introduction & interview (4–5 min).

Short Q&A on familiar topics. Reveals everyday fluency and lexical resource; light
on sustained coherence. Owner: build out the question bank and short-answer checks.
"""

from __future__ import annotations

from ..schema import Part, Criterion, TurnFeatures
from .base import PartModule, PartConfig, PartAssessment

# Replace with a RAG-backed bank keyed by topic.
QUESTION_BANK = {
    "home": ["Do you live in a house or an apartment?",
             "What's your favourite room in your home?",
             "Would you like to move somewhere else in the future? Why?"],
    "work_study": ["Do you work or are you a student?",
                   "What do you enjoy most about it?",
                   "Is there anything you'd like to change about it?"],
    "hobbies": ["What do you like to do in your free time?",
                "Have your hobbies changed since you were a child?",
                "Is there a new hobby you'd like to try?"],
}


class Part1Module(PartModule):
    config = PartConfig(
        number=Part.PART1, name="Introduction & interview", target_duration_s=270,
        hold_cues=False,
        primary_criteria=(Criterion.FLUENCY_COHERENCE, Criterion.LEXICAL_RESOURCE),
        description="Short Q&A on familiar topics; 3–4 topics, 2–3 questions each.",
    )

    def questions(self, topic: str | None = None, rag=None) -> list[str]:
        if rag is not None:
            return rag.questions(self.config.number, topic)
        return QUESTION_BANK.get(topic or "home", QUESTION_BANK["home"])

    def _part_notes(self, turns: list[TurnFeatures], pa: PartAssessment) -> None:
        # Part 1 answers should still be developed, not one-word.
        short = [t for t in turns if t.fluency.word_count < 8]
        if len(short) >= max(2, len(turns) // 2):
            pa.notes.append(
                "Several Part 1 answers were very short — encourage one extra "
                "sentence of detail/reason to show range.")
