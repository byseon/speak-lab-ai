"""Near-deterministic Part 1 flow — a backend state machine the app uses to drive the
examiner via Tavus API calls.

The LLM handles phrasing; THIS owns the structure:
    (1) introduce -> (2) confirm identity -> (3) topic interview
        open question -> follow-ups on a conversational lead -> switch topic on struggle

Each step returns a `Directive` saying what the examiner should do next and HOW to
deliver it:
    deliver="echo"     -> make the avatar say `text` verbatim   (conversation.echo)
    deliver="instruct" -> inject `text` as an instruction the   (conversation.overwrite
                          LLM phrases into one question           -context / append)

Two determinism layers:
  - This orchestrator is authoritative WHEN the app has the data channel (CVI/Daily
    SDK) to receive user turns and send echo / overwrite-context.
  - The system-prompt protocol (pal.PART_INSTRUCTIONS[PART1]) is the fallback that
    keeps even the plain iframe demo near-deterministic.

Fixed lines (intro, identity, topic openings) are delivered as `echo` for true
determinism; only follow-ups — which depend on what the candidate just said — are
`instruct`, so the LLM can react to a 'conversational lead'.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from .pal import EXAMINER_INTRO, IDENTITY_PROMPT

try:  # optional NLP for lead extraction; falls back to a heuristic
    import spacy
    _NLP = spacy.load("en_core_web_sm")
except Exception:  # pragma: no cover - depends on env
    _NLP = None


class Stage(str, Enum):
    INTRO = "intro"
    CONFIRM_IDENTITY = "confirm_identity"
    INTERVIEW = "interview"
    DONE = "done"


@dataclass
class Directive:
    stage: Stage
    deliver: str            # "echo" | "instruct"
    text: str
    topic: str | None = None
    meta: dict = field(default_factory=dict)


# Topic bank: the deterministic opening question per topic.
TOPIC_BANK: dict[str, str] = {
    "home": "Let's talk about your home. Do you live in a house or an apartment?",
    "family": "Now, tell me a little about your family. Is it large or small?",
    "work_study": "Do you work, or are you a student?",
    "hobbies": "What do you like to do in your free time?",
    "hometown": "Where are you from originally?",
}
DEFAULT_TOPICS = ["home", "work_study", "hobbies", "family"]

_LOST = ("i don't know", "i dont know", "not sure", "no idea", "dunno", "sorry",
         "can you repeat", "pardon", "i can't", "i cannot", "i have no")


def _looks_lost(text: str) -> bool:
    t = text.lower().strip()
    return (not t) or any(p in t for p in _LOST)


def extract_lead(text: str) -> str | None:
    """A 'conversational lead' — a thing the candidate mentioned, to dig into."""
    if _NLP is not None:
        doc = _NLP(text)
        chunks = [c.text.strip() for c in doc.noun_chunks
                  if c.root.pos_ in ("NOUN", "PROPN") and not c.root.is_stop]
        if chunks:
            return max(chunks, key=len)
    words = [w.strip(".,!?;:'\"").lower() for w in text.split()]
    content = [w for w in words if w.isalpha() and len(w) > 4]
    return max(content, key=len) if content else None


class Part1Orchestrator:
    """Drive Part 1 deterministically. Call `start()` once, then `on_user_turn(text)`
    after each candidate utterance; apply each Directive via the matching Tavus call."""

    def __init__(self, username: str = "", topics: list[str] | None = None,
                 max_followups: int = 2, max_topics: int = 3, struggle_min_words: int = 4):
        self.username = username
        self.topic_queue = [t for t in (topics or DEFAULT_TOPICS) if t in TOPIC_BANK]
        self.max_followups = max_followups
        self.max_topics = max_topics
        self.struggle_min_words = struggle_min_words
        self.stage = Stage.INTRO
        self.current_topic: str | None = None
        self.followups = 0
        self.topics_done = 0
        self.name: str | None = None

    # (1) introduce + (2) ask identity — verbatim, fully deterministic.
    def start(self) -> Directive:
        self.stage = Stage.CONFIRM_IDENTITY
        return Directive(Stage.INTRO, "echo", f"{EXAMINER_INTRO} {IDENTITY_PROMPT}")

    def on_user_turn(self, text: str) -> Directive:
        if self.stage == Stage.CONFIRM_IDENTITY:
            self.name = (text.strip().rstrip(".").split(" and ")[0].strip()
                         or self.username or "")
            self.stage = Stage.INTERVIEW
            self._advance_topic()
            ack = f"Thank you, {self.name}. " if self.name else "Thank you. "
            return Directive(Stage.INTERVIEW, "echo", ack + self._open(),
                             topic=self.current_topic)
        if self.stage == Stage.INTERVIEW:
            return self._interview(text)
        return self._done()

    # (3) topic interview: follow-up on a lead, or switch topic on struggle.
    def _interview(self, text: str) -> Directive:
        struggled = _looks_lost(text) or len(text.split()) < self.struggle_min_words
        if not struggled and self.followups < self.max_followups:
            self.followups += 1
            lead = extract_lead(text)
            focus = f"what they said about \"{lead}\"" if lead else "their last answer"
            return Directive(
                Stage.INTERVIEW, "instruct",
                f"Ask ONE short follow-up question that digs into {focus}, staying on "
                f"the topic of {self.current_topic}. One sentence only.",
                topic=self.current_topic, meta={"lead": lead})
        # struggled, or enough follow-ups -> next topic (or finish)
        self.topics_done += 1
        if self.topics_done >= self.max_topics or not self.topic_queue:
            return self._done()
        self._advance_topic()
        bridge = "Let's move on. " if struggled else "Thank you. "
        return Directive(Stage.INTERVIEW, "echo", bridge + self._open(),
                         topic=self.current_topic,
                         meta={"switched_because": "struggle" if struggled else "covered"})

    def _advance_topic(self) -> None:
        self.current_topic = self.topic_queue.pop(0)
        self.followups = 0

    def _open(self) -> str:
        return TOPIC_BANK[self.current_topic]

    def _done(self) -> Directive:
        self.stage = Stage.DONE
        return Directive(Stage.DONE, "instruct",
                         "Part 1 is complete. Briefly thank the candidate, then stop.")
