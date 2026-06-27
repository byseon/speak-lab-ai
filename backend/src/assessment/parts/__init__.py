"""Part registry — look up the module for a given IELTS Part.

    from assessment.parts import get_part
    p2 = get_part(2)                 # Part2Module
    p2.config.hold_cues              # True (don't interrupt the long turn)
    p2.questions(topic="travel")     # cue card
    p2.assess(turn_features_list)    # part-level assessment
"""

from __future__ import annotations

from ..schema import Part, Criterion
from .base import PartModule, PartConfig, PartAssessment
from .part1 import Part1Module
from .part2 import Part2Module
from .part3 import Part3Module

_REGISTRY: dict[Part, PartModule] = {
    Part.PART1: Part1Module(),
    Part.PART2: Part2Module(),
    Part.PART3: Part3Module(),
}


def get_part(number: int | Part) -> PartModule:
    return _REGISTRY[Part(int(number))]


def all_parts() -> list[PartModule]:
    return [_REGISTRY[p] for p in (Part.PART1, Part.PART2, Part.PART3)]


# Which part is the *primary* evidence source for each criterion — used to weight
# the final per-criterion band toward the part that measures it best.
CRITERION_PRIMARY_PART: dict[Criterion, Part] = {
    Criterion.FLUENCY_COHERENCE: Part.PART2,        # sustained long turn
    Criterion.LEXICAL_RESOURCE: Part.PART2,         # range over extended speech
    Criterion.GRAMMATICAL_RANGE_ACCURACY: Part.PART3,  # abstract -> complex grammar
    Criterion.PRONUNCIATION: Part.PART2,            # longest clean sample
}


__all__ = ["PartModule", "PartConfig", "PartAssessment", "get_part", "all_parts",
           "Part1Module", "Part2Module", "Part3Module", "CRITERION_PRIMARY_PART"]
