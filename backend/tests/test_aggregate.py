import pytest

from assessment.aggregate import ielts_round, aggregate
from assessment.schema import Criterion, JudgeResult


@pytest.mark.parametrize("raw,expected", [
    (6.0, 6.0),
    (6.1, 6.0),
    (6.2, 6.0),
    (6.25, 6.5),   # .25 rounds UP
    (6.4, 6.5),
    (6.5, 6.5),
    (6.6, 6.5),
    (6.74, 6.5),
    (6.75, 7.0),   # .75 rounds UP to next whole
    (6.8, 7.0),
    (5.875, 6.0),
])
def test_ielts_round(raw, expected):
    assert ielts_round(raw) == expected


def test_aggregate_overall():
    res = {
        Criterion.FLUENCY_COHERENCE: JudgeResult(Criterion.FLUENCY_COHERENCE, 6.0),
        Criterion.LEXICAL_RESOURCE: JudgeResult(Criterion.LEXICAL_RESOURCE, 6.0),
        Criterion.GRAMMATICAL_RANGE_ACCURACY: JudgeResult(
            Criterion.GRAMMATICAL_RANGE_ACCURACY, 6.0),
        Criterion.PRONUNCIATION: JudgeResult(Criterion.PRONUNCIATION, 7.0),
    }
    card = aggregate(res)
    assert card.overall_band == 6.5   # mean 6.25 -> 6.5
    assert len(card.criteria) == 4


def test_aggregate_empty_raises():
    with pytest.raises(ValueError):
        aggregate({})
