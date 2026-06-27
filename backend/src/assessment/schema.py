"""Core data contracts for the IELTS Speaking assessment engine.

These types are the integration boundary between the voice-ML feature layer,
the LLM rubric judges, and whatever backend/API consumes the results. Keep them
stable; everything else can change behind them.

Pure stdlib (dataclasses) so this module imports with zero dependencies.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Optional


# --------------------------------------------------------------------------- #
# Input: what the capture layer hands us per turn                             #
# --------------------------------------------------------------------------- #


class Part(int, Enum):
    """The three sections of an IELTS Speaking test."""

    PART1 = 1  # introduction & interview (familiar topics)
    PART2 = 2  # long turn (cue card monologue)
    PART3 = 3  # two-way discussion (abstract)


@dataclass
class Word:
    """A single recognised word with timing, as emitted by tavus-parakeet.

    Times are seconds from the start of the conversation (or the turn — be
    consistent; the feature layer only uses relative gaps).
    """

    text: str
    start: float
    end: float
    confidence: Optional[float] = None  # STT posterior, if available

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)


@dataclass
class Turn:
    """One candidate turn: the unit the feature layer scores.

    `words` come from the *raw* STT stream (fillers/repetitions intact) so
    fluency signals are preserved. `clean_text` is the punctuated/cleaned
    transcript used by the lexical/grammar judges.
    """

    turn_idx: int
    part: Part
    words: list[Word] = field(default_factory=list)
    clean_text: str = ""
    audio_path: Optional[str] = None  # isolated per-turn user audio (wav)
    prompt: str = ""  # the examiner question / cue card that elicited this turn

    @property
    def raw_text(self) -> str:
        return " ".join(w.text for w in self.words)

    @classmethod
    def from_tavus(cls, turn_idx: int, part: int, words: list[dict[str, Any]],
                   **kw: Any) -> "Turn":
        """Build a Turn from Tavus-style word dicts ({text,start,end,confidence})."""
        return cls(
            turn_idx=turn_idx,
            part=Part(part),
            words=[Word(w["text"], float(w["start"]), float(w["end"]),
                        w.get("confidence")) for w in words],
            **kw,
        )


# --------------------------------------------------------------------------- #
# Layer A output: deterministic features (the evidence base)                   #
# --------------------------------------------------------------------------- #


@dataclass
class FluencyFeatures:
    duration_s: float = 0.0
    word_count: int = 0
    speech_rate_wpm: float = 0.0           # all tokens / total time
    effective_speech_rate_wpm: float = 0.0  # excludes fillers + immediate repeats
    articulation_rate_wpm: float = 0.0     # tokens / phonation time (excludes pauses)
    phonation_time_ratio: float = 0.0      # speaking time / total time
    mean_length_of_run: float = 0.0        # words between silent pauses
    silent_pause_count: int = 0
    total_silent_pause_s: float = 0.0
    long_pause_count: int = 0              # pauses >= long threshold (word-search)
    filled_pause_count: int = 0            # um / uh / er ...
    fillers_per_100w: float = 0.0
    repetition_count: int = 0              # immediate functionless repetitions
    discourse_marker_count: int = 0
    discourse_markers_per_100w: float = 0.0
    silent_pauses: list[tuple[float, float, float]] = field(default_factory=list)


@dataclass
class LexicalFeatures:
    token_count: int = 0
    type_count: int = 0
    type_token_ratio: float = 0.0
    mtld: float = 0.0                       # length-robust lexical diversity
    rare_word_ratio: Optional[float] = None  # share beyond top-2000 band (needs wordfreq)
    mean_word_log_frequency: Optional[float] = None
    most_repeated_content_words: list[tuple[str, int]] = field(default_factory=list)
    flagged_basic_overuse: list[str] = field(default_factory=list)


@dataclass
class GrammarFeatures:
    sentence_count: int = 0
    clauses_per_sentence: float = 0.0
    subordination_ratio: float = 0.0
    mean_length_of_t_unit: float = 0.0
    verb_form_variety: int = 0             # distinct tense/aspect/modal forms
    uses_passive: bool = False
    uses_modality: bool = False
    note: str = ""                         # e.g. "spaCy not installed"


@dataclass
class PronunciationFeatures:
    """Acoustic features. Filled by a real model (Azure/GOP) or a weak proxy.

    `source` records which; judges must know not to over-trust the proxy.
    """

    source: str = "proxy"  # "azure" | "gop" | "proxy"
    accuracy_score: Optional[float] = None      # 0-100 phoneme accuracy
    fluency_score: Optional[float] = None       # 0-100
    completeness_score: Optional[float] = None  # 0-100
    prosody_score: Optional[float] = None       # 0-100 rhythm/stress/intonation
    intelligibility_estimate: Optional[float] = None  # 0-1
    word_stress_errors: list[str] = field(default_factory=list)
    low_accuracy_phonemes: list[str] = field(default_factory=list)
    intonation_flags: list[str] = field(default_factory=list)


@dataclass
class TurnFeatures:
    """All Layer-A features for one turn — the payload handed to the judges."""

    turn_idx: int
    part: Part
    fluency: FluencyFeatures
    lexical: LexicalFeatures
    grammar: GrammarFeatures
    pronunciation: PronunciationFeatures


# --------------------------------------------------------------------------- #
# Layer B/C output: judge verdicts and the final scorecard                     #
# --------------------------------------------------------------------------- #


class Criterion(str, Enum):
    FLUENCY_COHERENCE = "fluency_coherence"
    LEXICAL_RESOURCE = "lexical_resource"
    GRAMMATICAL_RANGE_ACCURACY = "grammatical_range_accuracy"
    PRONUNCIATION = "pronunciation"


@dataclass
class Evidence:
    quote: str
    observation: str = ""
    feature: str = ""  # e.g. "speech_rate_wpm=95"


@dataclass
class FeedbackItem:
    issue: str
    example_from_candidate: str = ""
    suggestion: str = ""
    upgraded_example: str = ""


@dataclass
class JudgeResult:
    criterion: Criterion
    band: float  # half-band granularity, 0-9
    confidence: float = 0.0
    evidence: list[Evidence] = field(default_factory=list)
    feedback: list[FeedbackItem] = field(default_factory=list)
    comparative_note: str = ""


@dataclass
class Scorecard:
    overall_band: float
    criteria: dict[str, JudgeResult] = field(default_factory=dict)
    part_summaries: dict[str, str] = field(default_factory=dict)
    meta_flags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
