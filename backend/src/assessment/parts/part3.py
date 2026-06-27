"""Part 3 — Two-way discussion (4–5 min).

Abstract questions extending the Part 2 topic. This is where Grammatical Range
(conditionals, complex clauses) and the ability to develop and justify ideas show
most clearly. Owner: probe bank + argument-development checks.
"""

from __future__ import annotations

from ..schema import Part, Criterion, TurnFeatures
from .base import PartModule, PartConfig, PartAssessment

PROBE_BANK = {
    "travel": ["How has tourism changed in your country over the years?",
               "Do you think people travel for the right reasons these days?",
               "What are the advantages and disadvantages of mass tourism?"],
    "skills": ["Why do some skills become less valued over time?",
               "How might the skills people need change in the future?",
               "Should governments fund skills training? Why or why not?"],
}


class Part3Module(PartModule):
    config = PartConfig(
        number=Part.PART3, name="Two-way discussion", target_duration_s=300,
        hold_cues=False,
        primary_criteria=(Criterion.GRAMMATICAL_RANGE_ACCURACY,
                          Criterion.FLUENCY_COHERENCE),
        description="Abstract discussion; deeper 'why/how/to what extent' questions.",
    )

    def questions(self, topic: str | None = None, rag=None) -> list[str]:
        if rag is not None:
            return rag.probes(topic)
        return PROBE_BANK.get(topic or "travel", PROBE_BANK["travel"])

    def _part_notes(self, turns: list[TurnFeatures], pa: PartAssessment) -> None:
        # Part 3 should elicit complex grammar; flag if it didn't.
        complex_seen = any(
            (not t.grammar.note) and
            (t.grammar.uses_modality or t.grammar.subordination_ratio >= 0.3)
            for t in turns)
        if turns and not complex_seen:
            pa.notes.append(
                "Few complex structures in the discussion — push for conditionals "
                "('if…would'), relative clauses, and justified opinions.")
