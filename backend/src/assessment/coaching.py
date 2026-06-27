"""Turn features -> conversational coaching cues (the interactive loop).

This is what makes the experience feel like talking to a tutor instead of taking
a test. After each turn the async feature layer calls `CueGenerator.generate(...)`,
which picks the SINGLE most impactful thing to say (good tutors don't dump metrics)
and phrases it warmly. The cue is injected back into the live Tavus call:

  inject_via="append_context"  -> conversation.append-context  (PAL weaves it in)
  inject_via="echo"            -> conversation.echo            (PAL says it verbatim)

Gating:
  - mode="exam"  -> no cues at all (authentic test; collect silently, report later)
  - mode="coach" -> cues allowed
  - Part 2 long turn -> never interrupt; cues are HELD and delivered as a
    rounding-off reflection after the monologue (see CoachingSession).

Pure stdlib.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional

from .schema import TurnFeatures, Part, Criterion


CueKind = Literal["praise", "tip", "correction", "retry"]
InjectVia = Literal["append_context", "echo"]


@dataclass
class CoachingCue:
    target: Criterion
    kind: CueKind
    severity: float            # 0-1; used to pick the most impactful cue
    message: str               # the conversational line the PAL delivers
    evidence: str = ""         # the feature that triggered it (for logs/UI)
    inject_via: InjectVia = "append_context"
    offer_retry: bool = False  # invite the learner to try that bit again


# Upgrades for over-used "basic" words (Lexical Resource).
_UPGRADES = {
    "good": ["rewarding", "worthwhile", "enjoyable"],
    "bad": ["disappointing", "unpleasant", "frustrating"],
    "nice": ["lovely", "pleasant", "delightful"],
    "big": ["enormous", "substantial", "considerable"],
    "small": ["tiny", "modest", "compact"],
    "really": ["genuinely", "particularly", "remarkably"],
    "like": ["enjoy", "appreciate", "am fond of"],
    "thing": ["aspect", "factor", "element"],
    "stuff": ["belongings", "material", "things"],
    "people": ["individuals", "the public", "folks"],
}

# Thresholds — tuned for a typical turn; adjust per part if needed.
LONG_PAUSE_TRIGGER = 2
FILLERS_PER_100W_TRIGGER = 5.0
SLOW_RATE_WPM = 90.0
LOW_SUBORDINATION = 0.15


class CueGenerator:
    """Stateless: features for one turn -> at most one praise + one improvement cue."""

    def generate(self, feats: TurnFeatures, *, mode: str = "coach") -> list[CoachingCue]:
        if mode == "exam":
            return []
        praise = self._praise(feats)
        improve = self._top_improvement(feats)
        cues: list[CoachingCue] = []
        if praise:
            cues.append(praise)         # lead with a win (praise sandwich)
        if improve:
            cues.append(improve)
        return cues

    # --- improvement: score each criterion, return the most severe ---------- #
    def _top_improvement(self, feats: TurnFeatures) -> Optional[CoachingCue]:
        candidates = [c for c in (
            self._fluency_cue(feats), self._lexical_cue(feats),
            self._grammar_cue(feats), self._pronunciation_cue(feats),
        ) if c]
        if not candidates:
            return None
        return max(candidates, key=lambda c: c.severity)

    def _fluency_cue(self, feats: TurnFeatures) -> Optional[CoachingCue]:
        f = feats.fluency
        sev = 0.0
        if f.long_pause_count >= LONG_PAUSE_TRIGGER:
            sev = max(sev, min(1.0, f.long_pause_count / 4))
        if f.fillers_per_100w >= FILLERS_PER_100W_TRIGGER:
            sev = max(sev, min(1.0, f.fillers_per_100w / 12))
        slow = 0 < f.effective_speech_rate_wpm < SLOW_RATE_WPM
        if slow:
            sev = max(sev, 0.5)
        if sev == 0.0:
            return None
        if f.long_pause_count >= LONG_PAUSE_TRIGGER and f.silent_pauses:
            return CoachingCue(
                Criterion.FLUENCY_COHERENCE, "tip", sev,
                "Nice content! You paused a few times searching for words there — "
                "try keeping the flow going and paraphrasing instead of reaching for "
                "the perfect word. Want to give that part another go?",
                evidence=f"long_pause_count={f.long_pause_count}",
                offer_retry=True,
            )
        return CoachingCue(
            Criterion.FLUENCY_COHERENCE, "tip", sev,
            f"You used filler sounds like 'um' about {f.filled_pause_count} times. "
            "A quick tip: a short silent pause sounds more confident than 'um'.",
            evidence=f"fillers_per_100w={f.fillers_per_100w}",
        )

    def _lexical_cue(self, feats: TurnFeatures) -> Optional[CoachingCue]:
        over = feats.lexical.flagged_basic_overuse
        if not over:
            return None
        word = over[0]
        alts = _UPGRADES.get(word)
        alt_txt = f" Maybe '{alts[0]}' or '{alts[1]}'?" if alts else ""
        return CoachingCue(
            Criterion.LEXICAL_RESOURCE, "tip", 0.5 + 0.1 * len(over),
            f"You leaned on the word '{word}' quite a bit. Could you express that a "
            f"different way?{alt_txt}",
            evidence=f"flagged_basic_overuse={over}",
        )

    def _grammar_cue(self, feats: TurnFeatures) -> Optional[CoachingCue]:
        g = feats.grammar
        if g.sentence_count < 2 or g.note:   # no parse (spaCy absent) -> skip
            return None
        if g.subordination_ratio < LOW_SUBORDINATION:
            return CoachingCue(
                Criterion.GRAMMATICAL_RANGE_ACCURACY, "tip", 0.55,
                "Your ideas were clear, but mostly in short, simple sentences. Try "
                "linking two together — for example with 'which', 'because', or "
                "'although' — to show off a wider range of grammar.",
                evidence=f"subordination_ratio={g.subordination_ratio}",
            )
        return None

    def _pronunciation_cue(self, feats: TurnFeatures) -> Optional[CoachingCue]:
        p = feats.pronunciation
        words = p.low_accuracy_phonemes
        if not words:
            return None
        # proxy source is weak — soften to a gentle check, not a correction
        soft = p.source == "proxy"
        word = words[0]
        sev = 0.45 if soft else 0.6
        return CoachingCue(
            Criterion.PRONUNCIATION, "tip", sev,
            f"The word '{word}' was a little hard to catch — let's say it together "
            "slowly so it's crystal clear.",
            evidence=f"low_accuracy={words} source={p.source}",
            inject_via="echo", offer_retry=True,
        )

    # --- praise: reinforce what the rubric rewards -------------------------- #
    def _praise(self, feats: TurnFeatures) -> Optional[CoachingCue]:
        f, lx, g = feats.fluency, feats.lexical, feats.grammar
        if f.mean_length_of_run >= 8 and f.long_pause_count == 0:
            return CoachingCue(
                Criterion.FLUENCY_COHERENCE, "praise", 0.0,
                "That was lovely and smooth — you kept a really natural flow.",
                evidence=f"mean_length_of_run={f.mean_length_of_run}")
        if lx.mtld >= 60:
            return CoachingCue(
                Criterion.LEXICAL_RESOURCE, "praise", 0.0,
                "Great range of vocabulary in that answer — that's exactly what "
                "examiners look for.", evidence=f"mtld={lx.mtld}")
        if not g.note and (g.uses_passive or g.uses_modality or g.subordination_ratio >= 0.4):
            return CoachingCue(
                Criterion.GRAMMATICAL_RANGE_ACCURACY, "praise", 0.0,
                "Nice — you used some more complex sentence structures there.",
                evidence=f"subordination_ratio={g.subordination_ratio}")
        return None


# Maps the learner's weakest criterion -> what kind of question to ask next, so
# the PAL adapts to elicit more of what needs work.
NEXT_QUESTION_HINT = {
    Criterion.FLUENCY_COHERENCE:
        "Ask an open narrative question ('Tell me about a time when…') to build flow.",
    Criterion.LEXICAL_RESOURCE:
        "Ask a descriptive question needing rich vocabulary (places, food, feelings).",
    Criterion.GRAMMATICAL_RANGE_ACCURACY:
        "Ask a hypothetical/comparison question ('How would things change if…') to "
        "elicit conditionals and complex clauses.",
    Criterion.PRONUNCIATION:
        "Ask a follow-up reusing the tricky words so they can re-attempt them.",
}
