"""Stateful coaching session — turns a sequence of turns into an interactive
experience: live cues, adaptive focus, and a conversational wrap-up.

The session is the thing the conversation backend drives:
  on each finalized user turn  -> session.process_turn(turn)  -> cues to inject + focus
  when Part 2 long turn ends   -> session.flush_held_cues()   -> held reflections
  at the end of the test       -> session.conversational_summary(scorecard)

It also tracks running evidence so the final summary can be specific
("you hesitated 8 times across the test") without re-reading every turn.

Pure stdlib.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .schema import Turn, Part, Criterion, TurnFeatures, Scorecard
from .features import extract_features, PronunciationAssessor, ProxyPronunciationAssessor
from .coaching import CueGenerator, CoachingCue, NEXT_QUESTION_HINT
from .parts import get_part

_LABEL = {
    Criterion.FLUENCY_COHERENCE: "fluency",
    Criterion.LEXICAL_RESOURCE: "vocabulary",
    Criterion.GRAMMATICAL_RANGE_ACCURACY: "grammar",
    Criterion.PRONUNCIATION: "pronunciation",
}


@dataclass
class TurnResult:
    features: TurnFeatures
    cues: list[CoachingCue]            # to inject now (empty during a Part 2 long turn)
    focus: Criterion                   # weakest criterion so far
    next_question_hint: str


@dataclass
class ConversationalReport:
    """A wrap-up the PAL can *say*, plus interactive choices for what to do next."""

    spoken_overview: str
    overall_band: float
    strengths: list[str] = field(default_factory=list)
    priorities: list[str] = field(default_factory=list)
    suggested_drill: str = ""
    followup_options: list[str] = field(default_factory=list)


class CoachingSession:
    def __init__(self, mode: str = "coach",
                 pron: PronunciationAssessor | None = None):
        self.mode = mode
        self._pron = pron or ProxyPronunciationAssessor()
        self._gen = CueGenerator()
        self.turns: list[TurnFeatures] = []
        self.held: list[CoachingCue] = []
        self._severity: dict[Criterion, float] = {c: 0.0 for c in Criterion}
        # running evidence for a specific final summary
        self.total_long_pauses = 0
        self.total_fillers = 0
        self.overused: set[str] = set()
        self.pron_flags: set[str] = set()
        self.complex_sentence_seen = False

    def process_turn(self, turn: Turn) -> TurnResult:
        feats = extract_features(turn, pron=self._pron)
        self.turns.append(feats)
        self._accumulate(feats)

        cues = self._gen.generate(feats, mode=self.mode)
        # Respect the part's cue policy: hold cues during a no-interrupt part
        # (e.g. the Part 2 long turn) and deliver them afterwards.
        deliver_now = cues
        if get_part(turn.part).config.hold_cues:
            self.held.extend(cues)
            deliver_now = []

        for c in cues:
            self._severity[c.target] += c.severity
        focus = self._weakest()
        return TurnResult(feats, deliver_now, focus, NEXT_QUESTION_HINT[focus])

    def flush_held_cues(self) -> list[CoachingCue]:
        """Call when the Part 2 long turn ends to deliver held reflections."""
        out, self.held = self.held, []
        return out

    def _accumulate(self, feats: TurnFeatures) -> None:
        self.total_long_pauses += feats.fluency.long_pause_count
        self.total_fillers += feats.fluency.filled_pause_count
        self.overused.update(feats.lexical.flagged_basic_overuse)
        self.pron_flags.update(feats.pronunciation.low_accuracy_phonemes)
        g = feats.grammar
        if not g.note and (g.uses_passive or g.uses_modality or g.subordination_ratio >= 0.4):
            self.complex_sentence_seen = True

    def _weakest(self) -> Criterion:
        return max(self._severity, key=lambda c: self._severity[c])

    # ----------------------------------------------------------------- #
    def conversational_summary(self, card: Scorecard) -> ConversationalReport:
        """Build a warm, specific spoken wrap-up from the scorecard + evidence."""
        bands = {c: r.band for c, r in
                 [(Criterion(k), v) for k, v in card.criteria.items()]}
        strongest = max(bands, key=lambda c: bands[c])
        weakest = min(bands, key=lambda c: bands[c])

        strengths, priorities = [], []
        strengths.append(
            f"Your {_LABEL[strongest]} is your strong point (band {bands[strongest]}).")
        if self.complex_sentence_seen:
            strengths.append("You used some genuinely complex sentence structures.")

        if weakest == Criterion.FLUENCY_COHERENCE or self.total_long_pauses >= 3:
            priorities.append(
                f"Fluency is the main thing to work on — you had {self.total_long_pauses} "
                f"long word-search pauses and {self.total_fillers} fillers across the test.")
        if self.overused:
            priorities.append(
                f"Vary your vocabulary: you reused {', '.join(sorted(self.overused))}.")
        if self.pron_flags:
            priorities.append(
                f"A few words were hard to catch: {', '.join(sorted(self.pron_flags))}.")
        if not priorities:
            priorities.append(f"Push your {_LABEL[weakest]} a little further to reach the next band.")

        drill_map = {
            Criterion.FLUENCY_COHERENCE: "a 1-minute smooth-speaking drill (no fillers, paraphrase freely)",
            Criterion.LEXICAL_RESOURCE: "a vocabulary-upgrade drill on a familiar topic",
            Criterion.GRAMMATICAL_RANGE_ACCURACY: "a complex-sentence drill using 'although/which/because'",
            Criterion.PRONUNCIATION: "a say-it-with-me drill on your tricky words",
        }
        suggested = drill_map[weakest]

        overview = (
            f"Overall you're around band {card.overall_band}. "
            f"{strengths[0]} The biggest opportunity is your {_LABEL[weakest]} "
            f"(band {bands[weakest]}). {priorities[0]} "
            f"Want to try {suggested}?")

        return ConversationalReport(
            spoken_overview=overview,
            overall_band=card.overall_band,
            strengths=strengths,
            priorities=priorities,
            suggested_drill=suggested,
            followup_options=[
                f"Drill {_LABEL[weakest]} now",
                "Try another Part 2 cue card",
                "See the full scorecard breakdown",
                "End session",
            ],
        )
