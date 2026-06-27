"""Layer A — deterministic feature extraction (the evidence base)."""

from ..schema import Turn, TurnFeatures
from .fluency import extract_fluency
from .lexical import extract_lexical
from .grammar import extract_grammar
from .pronunciation import (
    PronunciationAssessor,
    ProxyPronunciationAssessor,
    CharsiuGopAssessor,
    default_assessor,
)


def extract_features(turn: Turn,
                     pron: PronunciationAssessor | None = None) -> TurnFeatures:
    """Run all Layer-A extractors for one turn."""
    pron = pron or ProxyPronunciationAssessor()
    return TurnFeatures(
        turn_idx=turn.turn_idx,
        part=turn.part,
        fluency=extract_fluency(turn.words),
        lexical=extract_lexical(turn.clean_text or turn.raw_text),
        grammar=extract_grammar(turn.clean_text or turn.raw_text),
        pronunciation=pron.assess(turn),
    )


__all__ = [
    "extract_features", "extract_fluency", "extract_lexical", "extract_grammar",
    "PronunciationAssessor", "ProxyPronunciationAssessor", "CharsiuGopAssessor",
    "default_assessor",
]
