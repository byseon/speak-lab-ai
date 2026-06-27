"""Examiner flow: modular greeting, Part 2 long-turn logic, Part 3 generation,
and the multi-part ExamSession that tags each utterance by the active part."""

from assessment.schema import Part
from assessment import pal
from assessment.parts import get_part
from assessment.examiner import (
    ExamSession, Part2Orchestrator, Part2Stage,
    generate_part3_questions, PART2_PREP_SECONDS,
)


# --- Modular greeting ------------------------------------------------------- #

def test_part_greetings_are_modular_and_distinct():
    g1 = pal.part_greeting(Part.PART1)
    g2 = pal.part_greeting(Part.PART2)
    g3 = pal.part_greeting(Part.PART3, topic="travel")
    assert "Aria" in g1                      # Part 1 introduces the examiner
    assert "Part 2" in g2                    # "Let's move on to Part 2"
    assert "travel" in g3                    # Part 3 ties back to the Part 2 topic
    assert g1 != g2 != g3
    # PartModule exposes the same greeting (modular access).
    assert get_part(2).greeting() == g2


# --- Part 2: 1-min prep, then follow-up if the long turn is under a minute --- #

def test_part2_short_answer_triggers_followup():
    p2 = Part2Orchestrator(topic="travel")
    opening = p2.start()
    assert opening.deliver == "echo"
    assert opening.meta["prep_seconds"] == PART2_PREP_SECONDS
    assert "You should say" in opening.text          # cue card + bullets presented

    # A 15-second long turn is NOT sustained -> ask the candidate to extend.
    d = p2.on_user_turn("It was good.", duration_s=15)
    assert d.stage == Part2Stage.FOLLOWUP.value
    assert d.deliver == "instruct"
    assert d.meta["reason"] == "short_answer"


def test_part2_sustained_answer_goes_to_rounding_off():
    p2 = Part2Orchestrator(topic="travel")
    p2.start()
    d = p2.on_user_turn("...", duration_s=95)          # >= 60s -> sustained
    assert d.stage == Part2Stage.ROUNDING_OFF.value
    assert d.meta["sustained"] is True


def test_part2_falls_back_to_word_count_without_duration():
    p2 = Part2Orchestrator(topic="travel")
    p2.start()
    long_text = " ".join(["word"] * 150)               # > SUSTAINED_MIN_WORDS
    d = p2.on_user_turn(long_text)                     # no duration given
    assert d.stage == Part2Stage.ROUNDING_OFF.value


# --- Part 3: rubric-grounded generation from the Part 2 topic ---------------- #

def test_part3_generation_uses_curated_bank_for_known_topic():
    qs = generate_part3_questions("travel", n=3)
    assert len(qs) == 3
    assert any("tourism" in q.lower() for q in qs)     # curated PROBE_BANK


def test_part3_generation_extends_unknown_topic_abstractly():
    qs = generate_part3_questions("gardening", n=3)
    assert len(qs) == 3
    # Abstract frames: generalisation / opinion / comparison about the topic area.
    assert any("?" in q for q in qs)
    assert any("gardening" in q.lower() for q in qs)


# --- ExamSession: one continuous session, utterances tagged by part ---------- #

def _name_then_struggle_through_part1(exam):
    """Drive Part 1 to completion quickly (struggle => switch => finish)."""
    exam.on_user_utterance("My name is Priya.")   # confirm identity
    # 3 struggles exhaust max_topics and end Part 1, returning the Part 2 opener.
    d = None
    for _ in range(3):
        d = exam.on_user_utterance("I don't know.")
    return d


def test_examsession_runs_all_parts_and_tags_utterances():
    exam = ExamSession(username="Priya", parts=[1, 2, 3], topic="travel")
    intro = exam.start()
    assert intro.part == Part.PART1 and intro.deliver == "echo" and "Aria" in intro.text

    d = _name_then_struggle_through_part1(exam)
    assert d.part == Part.PART2, "Part 1 should hand off to the Part 2 opener"
    assert "Part 2" in d.text

    # Part 2: one sustained long turn, then answer the rounding-off question.
    exam.on_user_utterance(" ".join(["travelled"] * 130), duration_s=95)
    d = exam.on_user_utterance("Yes, I'd recommend it.")
    assert d.part == Part.PART3, "Part 2 should hand off to Part 3"

    # Part 3: keep answering until the test closes.
    steps = 0
    while not exam.finished and steps < 30:
        d = exam.on_user_utterance("I think it has changed a great deal over time.",
                                   duration_s=40)
        steps += 1
    assert exam.finished

    tagged_parts = {int(u.part) for u in exam.utterances}
    assert tagged_parts == {1, 2, 3}
    # Every Part 1 utterance is tagged 1, etc. — no leakage across boundaries.
    assert all(u.part == Part.PART1 for u in exam.utterances[:4])
