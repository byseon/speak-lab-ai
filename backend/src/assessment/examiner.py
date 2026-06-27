"""Multi-part examiner flow — ONE continuous session covering Part 1 -> 2 -> 3.

This is the structure layer that drives a single Tavus conversation through the
whole test. It wraps the deterministic per-part orchestrators behind one driver,
`ExamSession`:

  - Part 1 -> `Part1Orchestrator` (part1_flow.py): introduce, confirm identity,
    interview on familiar topics with conversational leads, switch on struggle.
  - Part 2 -> `Part2Orchestrator` (here): present cue card + 1-min prep, the
    1-2 min long turn, and a follow-up if the answer is under a minute.
  - Part 3 -> `Part3Orchestrator` (here): rubric-grounded abstract questions that
    extend the Part 2 topic, with 'why / to what extent' probes.

The app calls `start()` once, then `on_user_utterance(text, ...)` after every
candidate turn. Each call returns an `ExamDirective` (what the examiner should do
next + HOW to deliver it: `echo` verbatim vs `instruct` for the LLM to phrase),
and the session records that utterance TAGGED WITH THE ACTIVE PART.

That part-tagged transcript (`ExamSession.utterances`) is the key output: scoring
is done per part from each part's own utterances (see `scoring.score_session`),
never mixed across parts. Cross-part *context* (what the candidate covered in
Part 1) is carried forward only to keep the conversation coherent — topic
threading + Tavus memory — and deliberately NOT into scoring.

Pure stdlib; needs no Tavus keys. This module decides the structure; the transport
layer (webhook / data channel) applies each directive via conversation.echo /
overwrite-context.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from .schema import Part
from . import pal
from .part1_flow import Part1Orchestrator, Stage, _looks_lost
from .parts import get_part


# --------------------------------------------------------------------------- #
# Shared output types                                                          #
# --------------------------------------------------------------------------- #


@dataclass
class ExamDirective:
    """What the examiner should do next, and how to deliver it.

    `deliver="echo"`     -> avatar says `text` verbatim   (conversation.echo)
    `deliver="instruct"` -> LLM phrases `text` into one    (conversation.overwrite-
                            question reacting to context     context / append-context)
    `stage="done"` marks a part's terminal directive (the flow advances after it).
    """

    part: Part
    stage: str
    deliver: str
    text: str
    topic: str | None = None
    meta: dict = field(default_factory=dict)


@dataclass
class TaggedUtterance:
    """One candidate utterance, stamped with the part that was active when it was

    said. `words` carries optional Tavus word-level tokens (text/start/end) so
    fluency/pronunciation can be scored; `text` alone is enough for lexical/grammar.
    """

    part: Part
    text: str
    words: list[dict] = field(default_factory=list)
    duration_s: float | None = None
    role: str = "user"


# --------------------------------------------------------------------------- #
# Part 2 — long turn (cue card): prep, sustained talk, short-answer follow-up   #
# --------------------------------------------------------------------------- #

PART2_PREP_SECONDS = 60
PART2_TALK_SECONDS = 120
# "shorter than a minute" -> the long turn wasn't sustained, so push for more.
SUSTAINED_MIN_SECONDS = 60
# Fallback when we have no audio duration: ~1 min of speech ≈ this many words.
SUSTAINED_MIN_WORDS = 110


class Part2Stage(str, Enum):
    PRESENT = "present"      # cue card shown, prep running
    LONG_TURN = "long_turn"  # candidate delivering the monologue
    FOLLOWUP = "followup"    # asked to extend a too-short answer
    ROUNDING_OFF = "rounding_off"
    DONE = "done"


class Part2Orchestrator:
    """Drive the Part 2 long turn deterministically.

    Sequence: `start()` presents the cue card and announces the 1-min prep +
    2-min talk window (the frontend enforces the actual timers). The first
    `on_user_turn` is the long turn; if it ran under a minute we ask a follow-up
    on an uncovered bullet (using the remembered cue card), then one rounding-off
    question, then finish.
    """

    def __init__(self, topic: str | None = None, rag=None, max_followups: int = 1):
        self.topic = topic
        self.rag = rag
        self.max_followups = max_followups
        self.module = get_part(Part.PART2)
        self.stage = Part2Stage.PRESENT
        self.cue: str = ""
        self.bullets: list[str] = []
        self.followups = 0

    def _cue_card(self) -> dict:
        if self.rag is not None:
            return self.rag.cue_card(self.topic)
        from .parts.part2 import CUE_CARDS
        return CUE_CARDS[0]

    def start(self) -> ExamDirective:
        card = self._cue_card()
        self.cue = card["prompt"]
        self.bullets = list(card["bullets"])
        self.stage = Part2Stage.LONG_TURN
        text = (pal.part_greeting(Part.PART2) + " " + self.cue + " You should say: "
                + "; ".join(self.bullets) + ".")
        return ExamDirective(
            Part.PART2, Part2Stage.PRESENT.value, "echo", text, topic=self.topic,
            meta={"prep_seconds": PART2_PREP_SECONDS, "talk_seconds": PART2_TALK_SECONDS,
                  "cue": self.cue, "bullets": self.bullets})

    def on_user_turn(self, text: str, duration_s: float | None = None) -> ExamDirective:
        if self.stage in (Part2Stage.LONG_TURN, Part2Stage.FOLLOWUP):
            sustained = self._is_sustained(text, duration_s)
            uncovered = self._uncovered_bullets(text)
            if not sustained and self.followups < self.max_followups and uncovered:
                self.followups += 1
                self.stage = Part2Stage.FOLLOWUP
                bullet = uncovered[0]
                return ExamDirective(
                    Part.PART2, Part2Stage.FOLLOWUP.value, "instruct",
                    "The candidate's long turn was brief. Ask ONE short follow-up "
                    f"question inviting them to say more about {bullet!r}. One sentence.",
                    topic=self.topic,
                    meta={"reason": "short_answer", "bullet": bullet,
                          "duration_s": duration_s, "sustained": False})
            # sustained, or out of follow-ups -> a single rounding-off question.
            self.stage = Part2Stage.ROUNDING_OFF
            return ExamDirective(
                Part.PART2, Part2Stage.ROUNDING_OFF.value, "instruct",
                "Ask ONE brief rounding-off question related to what the candidate "
                "just described. One sentence.", topic=self.topic,
                meta={"sustained": sustained})
        # answered the rounding-off question -> close the part.
        self.stage = Part2Stage.DONE
        return ExamDirective(
            Part.PART2, Part2Stage.DONE.value, "instruct",
            "Briefly thank the candidate; Part 2 is complete.", topic=self.topic)

    def _is_sustained(self, text: str, duration_s: float | None) -> bool:
        if duration_s is not None:
            return duration_s >= SUSTAINED_MIN_SECONDS
        return len((text or "").split()) >= SUSTAINED_MIN_WORDS

    def _uncovered_bullets(self, text: str) -> list[str]:
        """Bullets whose key content word doesn't appear in the answer (memory of

        the cue card lets us target what the candidate skipped)."""
        said = (text or "").lower()
        out = []
        for b in self.bullets:
            # the salient word of the bullet (e.g. "why you remember it" -> "remember")
            key = max(b.replace("you", "").split(), key=len, default="")
            if key and key.lower() not in said:
                out.append(b)
        return out


# --------------------------------------------------------------------------- #
# Part 3 — abstract discussion: rubric-grounded question generation            #
# --------------------------------------------------------------------------- #

# Part 3 targets GRAMMATICAL RANGE & ACCURACY (conditionals, complex clauses) and
# the ability to develop and justify ideas, by pushing the concrete Part 2 topic to
# the abstract/general (see prompts/assessor-rubric-judges.md, Judge 3, and
# parts/part3.py). Each frame is chosen to ELICIT a specific grammatical/discourse
# move, so the discussion reliably reveals the criteria Part 3 is meant to measure.
PART3_FRAMES: list[tuple[str, str]] = [
    ("generalisation",
     "How has {area} changed in your country over the past few decades?"),
    ("opinion_justify",
     "Some people believe {area} matters more now than ever before. "
     "What's your view, and why?"),
    ("comparison",
     "What would you say are the main advantages and disadvantages of {area}?"),
    ("speculation",
     "How do you think {area} might change in the future?"),
]

# Map a concrete Part 2 topic word to a general discussion 'area'.
_TOPIC_AREAS: dict[str, str] = {
    "journey": "travel", "travel": "travel", "trip": "travel", "holiday": "travel",
    "skill": "learning new skills", "skills": "learning new skills",
    "book": "reading and books", "reading": "reading and books",
    "place": "the places people live", "city": "city life", "home": "where people live",
    "friend": "friendships", "family": "family life", "food": "food and eating habits",
    "technology": "technology", "work": "work and careers", "job": "work and careers",
}


def _area_for(topic: str | None) -> str:
    if not topic:
        return "this topic"
    key = topic.strip().lower().split()[0] if topic.strip() else ""
    return _TOPIC_AREAS.get(key, topic.strip())


def generate_part3_questions(topic: str | None = None, n: int = 3, rag=None) -> list[str]:
    """Rubric-grounded Part 3 questions extending the Part 2 topic.

    Generates abstract discussion questions (generalisation -> opinion+justification
    -> comparison -> speculation) around the topic's general 'area', which is what
    Part 3 is designed to elicit. Falls back to the curated `PROBE_BANK` when the
    topic matches a known key (better wording), or to a RAG hook if provided.
    """
    if rag is not None:
        return rag.probes(topic)
    from .parts.part3 import PROBE_BANK
    key = (topic or "").strip().lower().split()[0] if topic else ""
    if key in PROBE_BANK:
        return PROBE_BANK[key][:n]
    area = _area_for(topic)
    return [frame.format(area=area) for _, frame in PART3_FRAMES][:n]


class Part3Stage(str, Enum):
    ASK = "ask"
    FOLLOWUP = "followup"
    DONE = "done"


class Part3Orchestrator:
    """Serve generated Part 3 questions one at a time, with up to one reasoning

    follow-up per question ('why?', 'to what extent?', 'what if…?')."""

    def __init__(self, topic: str | None = None, rag=None, max_questions: int = 3,
                 max_followups_per_q: int = 1):
        self.topic = topic
        self.questions = generate_part3_questions(topic, n=max_questions, rag=rag)
        self.max_followups_per_q = max_followups_per_q
        self.i = 0
        self.followups = 0
        self.stage = Part3Stage.ASK

    def start(self) -> ExamDirective:
        q = self.questions[0] if self.questions else "Let's discuss this topic more generally."
        text = pal.part_greeting(Part.PART3, topic=self.topic) + " " + q
        return ExamDirective(Part.PART3, Part3Stage.ASK.value, "echo", text,
                             topic=self.topic, meta={"q_index": 0})

    def on_user_turn(self, text: str, duration_s: float | None = None) -> ExamDirective:
        substantive = len((text or "").split()) >= 8 and not _looks_lost(text)
        if substantive and self.followups < self.max_followups_per_q:
            self.followups += 1
            self.stage = Part3Stage.FOLLOWUP
            return ExamDirective(
                Part.PART3, Part3Stage.FOLLOWUP.value, "instruct",
                "Ask ONE probing follow-up that pushes for reasoning or a hypothetical "
                "('why?', 'to what extent?', 'what would happen if…?') on the "
                "candidate's last point. One sentence.", topic=self.topic)
        # move to the next question (or finish the test).
        self.i += 1
        self.followups = 0
        if self.i >= len(self.questions):
            self.stage = Part3Stage.DONE
            return ExamDirective(
                Part.PART3, Part3Stage.DONE.value, "instruct",
                "Thank the candidate warmly; the test is now complete.", topic=self.topic)
        self.stage = Part3Stage.ASK
        return ExamDirective(Part.PART3, Part3Stage.ASK.value, "echo",
                             self.questions[self.i], topic=self.topic,
                             meta={"q_index": self.i})


# --------------------------------------------------------------------------- #
# ExamSession — the multi-part driver that tags each utterance by part          #
# --------------------------------------------------------------------------- #


class ExamSession:
    """Run Part 1 -> 2 -> 3 (or any subset) in one continuous conversation.

        exam = ExamSession(username="Priya", parts=[1, 2, 3], topic="travel")
        directive = exam.start()                 # apply via Tavus, then:
        directive = exam.on_user_utterance(text) # after each candidate turn
        ...
        exam.utterances                          # part-tagged transcript -> scoring

    `on_user_utterance` stamps every candidate turn with `current_part` BEFORE
    advancing, so the tagged transcript reflects the part the answer belongs to.
    """

    def __init__(self, username: str = "", parts: list[int | Part] | None = None,
                 topic: str | None = None, mode: str = "exam",
                 p1_topics: list[str] | None = None):
        self.username = username
        self.mode = mode
        self.parts = [Part(int(p)) for p in (parts or [1, 2, 3])]
        self.topic = topic
        self.idx = 0
        self.finished = False
        self.utterances: list[TaggedUtterance] = []
        self._p1 = Part1Orchestrator(username=username, topics=p1_topics)
        self._p2 = Part2Orchestrator(topic=topic)
        self._p3 = Part3Orchestrator(topic=topic)

    @property
    def current_part(self) -> Part | None:
        return self.parts[self.idx] if self.idx < len(self.parts) else None

    def start(self) -> ExamDirective:
        if not self.parts:
            self.finished = True
            return self._closing(Part.PART1)
        return self._open_current()

    def on_user_utterance(self, text: str, words: list[dict] | None = None,
                          duration_s: float | None = None) -> ExamDirective:
        part = self.current_part
        if part is None:
            self.finished = True
            return self._closing(self.parts[-1] if self.parts else Part.PART1)
        # Tag FIRST: this utterance belongs to the currently active part.
        self.utterances.append(TaggedUtterance(part, text, list(words or []), duration_s))

        if part == Part.PART1:
            d = self._p1.on_user_turn(text)
            if d.stage == Stage.DONE:
                return self._advance()
            return self._wrap_p1(d)

        orch = self._p2 if part == Part.PART2 else self._p3
        d = orch.on_user_turn(text, duration_s=duration_s)
        if d.stage == "done":
            return self._advance()
        return d

    # ----------------------------------------------------------------- #
    def _open_current(self) -> ExamDirective:
        part = self.current_part
        if part == Part.PART1:
            return self._wrap_p1(self._p1.start())
        if part == Part.PART2:
            return self._p2.start()
        if part == Part.PART3:
            return self._p3.start()
        self.finished = True
        return self._closing(self.parts[-1] if self.parts else Part.PART1)

    def _advance(self) -> ExamDirective:
        self.idx += 1
        if self.current_part is None:
            self.finished = True
            return self._closing(self.parts[-1])
        return self._open_current()

    def _wrap_p1(self, d) -> ExamDirective:
        """Adapt a Part1Orchestrator Directive to the unified ExamDirective."""
        return ExamDirective(Part.PART1, d.stage.value, d.deliver, d.text,
                             topic=d.topic, meta=dict(d.meta))

    def _closing(self, part: Part) -> ExamDirective:
        return ExamDirective(part, "done", "instruct",
                             "The test is complete. Thank the candidate warmly and close.",
                             meta={"finished": True})
