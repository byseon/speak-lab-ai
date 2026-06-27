"""Per-Part modularization.

Each IELTS Speaking Part is its own module so the team can build them
independently. A PartModule owns everything specific to that part:

  - config         : structure, timing, cue policy
  - questions()    : the question bank / cue card for that part (RAG-pluggable)
  - assess()       : part-level aggregation + which criteria it best reveals

The final scorer uses `primary_criteria` to weight each criterion toward the part
that measures it most reliably (e.g. Fluency from Part 2's long turn, Grammatical
Range from Part 3's abstract discussion).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..schema import Part, Criterion, TurnFeatures


@dataclass(frozen=True)
class PartConfig:
    number: Part
    name: str
    target_duration_s: int
    hold_cues: bool                       # True => never interrupt (Part 2 long turn)
    primary_criteria: tuple[Criterion, ...]  # criteria this part reveals best
    description: str


@dataclass
class PartAssessment:
    part: Part
    n_turns: int
    total_words: int
    mean_speech_rate_wpm: float
    mean_length_of_run: float
    total_long_pauses: int
    mean_mtld: float
    primary_criteria: list[Criterion]
    notes: list[str] = field(default_factory=list)


class PartModule:
    """Base class with a sensible default aggregation; override per part."""

    config: PartConfig

    def questions(self, topic: str | None = None, rag=None) -> list[str]:
        """Return question(s) / cue card for this part. Override; RAG-pluggable."""
        raise NotImplementedError

    def greeting(self, *, topic: str | None = None) -> str:
        """The deterministic line that opens this part (the modular 'greeting').

        Canonical wording lives in `pal.PART_GREETINGS`; imported lazily to keep
        the part modules free of an import-time dependency on the PAL config.
        """
        from ..pal import part_greeting
        return part_greeting(self.config.number, topic=topic)

    def assess(self, turns: list[TurnFeatures]) -> PartAssessment:
        if not turns:
            return PartAssessment(self.config.number, 0, 0, 0.0, 0.0, 0, 0.0,
                                  list(self.config.primary_criteria),
                                  ["no turns recorded for this part"])
        words = sum(t.fluency.word_count for t in turns)
        rate = sum(t.fluency.speech_rate_wpm for t in turns) / len(turns)
        mlr = sum(t.fluency.mean_length_of_run for t in turns) / len(turns)
        longp = sum(t.fluency.long_pause_count for t in turns)
        mtld = sum(t.lexical.mtld for t in turns) / len(turns)
        pa = PartAssessment(
            part=self.config.number, n_turns=len(turns), total_words=words,
            mean_speech_rate_wpm=round(rate, 1), mean_length_of_run=round(mlr, 2),
            total_long_pauses=longp, mean_mtld=round(mtld, 1),
            primary_criteria=list(self.config.primary_criteria),
        )
        self._part_notes(turns, pa)
        return pa

    def _part_notes(self, turns: list[TurnFeatures], pa: PartAssessment) -> None:
        """Hook for part-specific observations. Override as needed."""
