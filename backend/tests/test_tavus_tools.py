import pytest

from assessment import Turn, Criterion
from assessment.features import extract_features
from assessment.tavus_tools import (
    ASSESSMENT_TOOL, TOOL_NAME, build_grading_context, scorecard_from_arguments,
    scorecard_from_event,
)


def _args(fc=6.0, lr=6.0, gra=6.0, pr=7.0):
    mk = lambda b: {"band": b, "feedback": "be more precise", "evidence": ["it was good"]}
    return {
        "fluency_coherence": mk(fc), "lexical_resource": mk(lr),
        "grammatical_range_accuracy": mk(gra), "pronunciation": mk(pr),
    }


def test_tool_schema_is_flat_and_complete():
    # flat registry shape (no {type:function} wrapper), with the 4 criteria required
    assert ASSESSMENT_TOOL["name"] == TOOL_NAME
    assert ASSESSMENT_TOOL["origin"] == "llm"
    props = ASSESSMENT_TOOL["parameters"]["properties"]
    assert set(props) == {"fluency_coherence", "lexical_resource",
                          "grammatical_range_accuracy", "pronunciation"}


def test_scorecard_from_arguments_aggregates():
    card = scorecard_from_arguments(_args(6, 6, 6, 7))   # mean 6.25 -> 6.5
    assert card.overall_band == 6.5
    assert set(card.criteria) == {c.value for c in Criterion}
    pr = card.criteria[Criterion.PRONUNCIATION.value]
    assert pr.band == 7.0 and pr.evidence[0].quote == "it was good"


def test_scorecard_from_event_checks_tool_name():
    ev = {"type": "conversation.tool_call", "tool_name": TOOL_NAME, "arguments": _args()}
    assert scorecard_from_event(ev).overall_band > 0
    with pytest.raises(ValueError):
        scorecard_from_event({"tool_name": "something_else", "arguments": {}})


def test_event_arguments_may_be_json_string():
    import json
    ev = {"tool_name": TOOL_NAME, "arguments": json.dumps(_args(7, 7, 7, 7))}
    assert scorecard_from_event(ev).overall_band == 7.0


def test_grading_context_surfaces_pronunciation():
    words = [{"text": "scenery", "start": 0.0, "end": 0.5, "confidence": 0.55},
             {"text": "was", "start": 0.6, "end": 0.8, "confidence": 0.95}]
    feats = extract_features(Turn.from_tavus(1, 2, words, clean_text="scenery was"))
    ctx = build_grading_context(feats)
    assert "Pronunciation" in ctx and "Charsiu/acoustic" in ctx
    assert "MEASUREMENTS" in ctx
