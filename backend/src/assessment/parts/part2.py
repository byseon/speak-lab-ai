"""Part 2 — Long turn / cue card (3–4 min).

1 minute prep, then a 1–2 minute monologue. THE key sample for *sustained* Fluency
& Coherence and lexical range. Never interrupted (hold_cues=True). Owner: cue-card
bank + bullet-coverage and sustained-speech checks.
"""

from __future__ import annotations

from ..schema import Part, Criterion, TurnFeatures
from .base import PartModule, PartConfig, PartAssessment

# Each cue card: a prompt + the bullet points the candidate should cover.
CUE_CARDS = [
    {"prompt": "Describe a journey that you remember well.",
     "bullets": ["where you went", "who you went with", "what you did",
                 "why you remember it well"]},
    {"prompt": "Describe a skill you would like to learn.",
     "bullets": ["what the skill is", "why you want to learn it",
                 "how you would learn it", "how it would help you"]},
]

# A turn shorter than this (words) is not a sustained long turn.
SUSTAINED_MIN_WORDS = 110
SUSTAINED_MIN_RUN = 7.0  # mean words between pauses


class Part2Module(PartModule):
    config = PartConfig(
        number=Part.PART2, name="Long turn (cue card)", target_duration_s=240,
        hold_cues=True,
        primary_criteria=(Criterion.FLUENCY_COHERENCE, Criterion.LEXICAL_RESOURCE),
        description="1 min prep then a 1–2 min monologue; do not interrupt.",
    )

    def questions(self, topic: str | None = None, rag=None) -> list[str]:
        card = CUE_CARDS[0] if rag is None else rag.cue_card(topic)
        return [card["prompt"] + " You should say: " + "; ".join(card["bullets"]) + "."]

    def _part_notes(self, turns: list[TurnFeatures], pa: PartAssessment) -> None:
        if pa.total_words < SUSTAINED_MIN_WORDS:
            pa.notes.append(
                f"Long turn was short ({pa.total_words} words) — aim to sustain "
                "speech for the full 1–2 minutes.")
        if pa.mean_length_of_run < SUSTAINED_MIN_RUN:
            pa.notes.append(
                "Speech was choppy (short runs between pauses) — work on linking "
                "ideas into longer, smoother stretches.")
