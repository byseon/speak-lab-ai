from assessment import Turn
from assessment.features import extract_features
from assessment.parts import get_part, all_parts, CRITERION_PRIMARY_PART
from assessment.schema import Part, Criterion


def _turn(part, n_words=5):
    words = [{"text": f"w{i}", "start": i * 0.3, "end": i * 0.3 + 0.2, "confidence": 0.9}
             for i in range(n_words)]
    return extract_features(Turn.from_tavus(1, part, words, clean_text=" ".join(
        f"w{i}" for i in range(n_words))))


def test_registry_and_configs():
    assert get_part(1).config.number == Part.PART1
    assert get_part(2).config.hold_cues is True        # long turn: no interrupt
    assert get_part(1).config.hold_cues is False
    assert len(all_parts()) == 3


def test_questions_provided_per_part():
    assert get_part(1).questions(topic="home")
    assert "You should say" in get_part(2).questions()[0]
    assert get_part(3).questions(topic="travel")


def test_part2_flags_short_long_turn():
    pa = get_part(2).assess([_turn(2, n_words=20)])   # well under 110 words
    assert any("short" in n.lower() for n in pa.notes)
    assert Criterion.FLUENCY_COHERENCE in pa.primary_criteria


def test_part1_flags_short_answers():
    pa = get_part(1).assess([_turn(1, 3), _turn(1, 4)])  # one-word-ish answers
    assert any("short" in n.lower() for n in pa.notes)


def test_criterion_primary_part_mapping():
    assert CRITERION_PRIMARY_PART[Criterion.GRAMMATICAL_RANGE_ACCURACY] == Part.PART3
    assert CRITERION_PRIMARY_PART[Criterion.FLUENCY_COHERENCE] == Part.PART2
