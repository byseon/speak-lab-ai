"""IELTS Speaking assessment engine (voice-ML backend).

Layered, install-free core:
  schema    — data contracts (Turn, *Features, JudgeResult, Scorecard)
  features  — Layer A: deterministic features (fluency/lexical/grammar/pronunciation)
  aggregate  — Layer C: IELTS half-band rounding + overall band
  stt        — word/phone timings via Charsiu forced alignment on the recording
  tavus_tools— Layer B: grading via the Tavus PAL's tool-call (no own LLM)
  pal        — examiner PAL config + create-PAL/create-conversation payloads
"""

from .schema import (
    Word, Turn, Part,
    FluencyFeatures, LexicalFeatures, GrammarFeatures, PronunciationFeatures,
    TurnFeatures, Criterion, JudgeResult, Scorecard, Evidence, FeedbackItem,
)
from .features import extract_features
from .aggregate import ielts_round, aggregate

__all__ = [
    "Word", "Turn", "Part",
    "FluencyFeatures", "LexicalFeatures", "GrammarFeatures", "PronunciationFeatures",
    "TurnFeatures", "Criterion", "JudgeResult", "Scorecard", "Evidence", "FeedbackItem",
    "extract_features", "ielts_round", "aggregate",
]
