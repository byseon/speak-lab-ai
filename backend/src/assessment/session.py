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
import re

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
class CriterionReport:
    criterion: str
    label: str
    band: float
    score_justification: str
    issue_found: str
    area_of_improvement: str
    example: str = ""


@dataclass
class ConversationalReport:
    """A wrap-up the PAL can *say*, plus interactive choices for what to do next."""

    spoken_overview: str
    overall_band: float
    criteria_feedback: list[CriterionReport] = field(default_factory=list)
    final_summary: str = ""
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
        self.candidate_texts: list[str] = []

    def process_turn(self, turn: Turn) -> TurnResult:
        feats = extract_features(turn, pron=self._pron)
        self.turns.append(feats)
        if turn.clean_text.strip():
            self.candidate_texts.append(turn.clean_text.strip())
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
            criteria_feedback=self._criterion_feedback(card),
            final_summary=self._final_summary(card, strongest, weakest, priorities),
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

    def _criterion_feedback(self, card: Scorecard) -> list[CriterionReport]:
        labels = {
            Criterion.FLUENCY_COHERENCE: "Fluency & Coherence",
            Criterion.LEXICAL_RESOURCE: "Lexical Resource",
            Criterion.GRAMMATICAL_RANGE_ACCURACY: "Grammatical Range & Accuracy",
            Criterion.PRONUNCIATION: "Pronunciation",
        }
        out: list[CriterionReport] = []
        for crit in Criterion:
            result = card.criteria.get(crit.value)
            if not result:
                continue
            band = result.band
            if result.feedback:
                first = result.feedback[0]
                out.append(CriterionReport(
                    criterion=crit.value,
                    label=labels[crit],
                    band=band,
                    score_justification=first.issue,
                    issue_found=first.upgraded_example or result.comparative_note or
                    "The main issue is the same one targeted in the improvement step.",
                    area_of_improvement=first.suggestion or first.upgraded_example,
                    example=first.example_from_candidate,
                ))
                continue

            quote = self._quote_for(crit)
            if crit == Criterion.FLUENCY_COHERENCE:
                why = (f"Band {band} reflects speech that is understandable and mostly coherent.")
                issue = "The answer needs clearer linking language so the structure is easier to hear."
                improve = (f"Use {self._quote_or_answer(quote)} as a base, then add a signpost such as "
                           "'The main reason is...', 'For example...', or 'As a result...'.")
            elif crit == Criterion.LEXICAL_RESOURCE:
                if self.overused:
                    words = ", ".join(sorted(self.overused))
                    why = (f"Band {band} is supported by some topic vocabulary, but repeated basic words "
                           f"such as {words} hold the range back.")
                    issue = f"Repeated basic vocabulary such as {words} makes the answer sound less precise."
                    improve = (f"In {self._quote_or_answer(quote)}, replace repeated basic wording like "
                               f"{words} with one precise phrase tied to the topic.")
                else:
                    why = (f"Band {band} suggests vocabulary is one of the stronger parts of this answer.")
                    issue = "Some wording still stays safe rather than sharply specific."
                    improve = (f"Take {self._quote_or_answer(quote)} and add one stronger collocation or exact "
                               "noun/adjective pair instead of a safe general word.")
            elif crit == Criterion.GRAMMATICAL_RANGE_ACCURACY:
                why = (f"Band {band} suggests your grammar communicates the message, but range and control can improve.")
                issue = "The answer relies too much on simple sentence patterns, which caps the grammar band."
                improve = (f"Expand {self._quote_or_answer(quote)} into one accurate complex sentence with "
                           "'because', 'although', or 'which', then check the verb tense.")
            else:
                why = (f"Band {band} is a cautious pronunciation estimate from the available transcript path.")
                issue = "There is not enough recording-level evidence here to diagnose exact pronunciation errors."
                improve = ("For a stronger pronunciation score, keep sentence stress clear and record a full answer "
                           "so the system can evaluate timing, clarity, and prosody.")

            out.append(CriterionReport(
                criterion=crit.value,
                label=labels[crit],
                band=band,
                score_justification=why,
                issue_found=issue,
                area_of_improvement=improve,
                example=quote,
            ))
        return out

    def _final_summary(self, card: Scorecard, strongest: Criterion, weakest: Criterion,
                       priorities: list[str]) -> str:
        if card.overall_band >= 7:
            opener = "This was a solid performance with enough control to sound confident."
        elif card.overall_band >= 6:
            opener = "This was a competent performance: your message came through, but the answer still needs more control and range."
        else:
            opener = "This response is understandable in places, but it needs more development before it feels exam-ready."
        return (
            f"{opener} Your strongest area is {_LABEL[strongest]}, while {_LABEL[weakest]} is the clearest lever "
            f"for improvement. {priorities[0]} For the next mock, focus on one concrete upgrade rather than trying "
            "to fix everything at once.")

    def _candidate_text(self) -> str:
        return " ".join(t for t in self.candidate_texts if t).strip()

    def _sentences(self) -> list[str]:
        text = self._candidate_text()
        if not text:
            return []
        parts = [p.strip(" ,") for p in re.split(r"(?<=[.!?])\s+", text) if p.strip(" ,")]
        if len(parts) == 1 and len(parts[0].split()) > 28:
            words = parts[0].split()
            return [" ".join(words[i:i + 18]) for i in range(0, len(words), 18)]
        return parts

    def _quote_for(self, criterion: Criterion) -> str:
        sents = self._sentences()
        if not sents:
            return ""
        if criterion == Criterion.LEXICAL_RESOURCE and self.overused:
            targets = {w.lower() for w in self.overused}
            for sent in sents:
                if any(t in sent.lower().split() for t in targets):
                    return self._trim_quote(sent)
        if criterion == Criterion.GRAMMATICAL_RANGE_ACCURACY:
            return self._trim_quote(max(sents, key=lambda s: len(s.split())))
        return self._trim_quote(sents[0])

    @staticmethod
    def _trim_quote(text: str, max_words: int = 22) -> str:
        words = text.strip().split()
        if len(words) <= max_words:
            return text.strip()
        return " ".join(words[:max_words]).strip() + "..."

    @staticmethod
    def _quote_or_answer(quote: str) -> str:
        return f"'{quote}'" if quote else "one sentence from your answer"
