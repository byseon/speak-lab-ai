import pytest

from assessment import Turn, Criterion
from assessment.features import extract_features
from assessment.tavus_tools import (
    ASSESSMENT_TOOL, TOOL_NAME, build_grading_context, scorecard_from_arguments,
    scorecard_from_event,
)


def _args(fc=6.0, lr=6.0, gra=6.0, pr=7.0):
    mk = lambda b: {
        "band": b,
        "feedback": "be more precise",
        "score_justification": "The answer is clear but sometimes general.",
        "area_of_improvement": "Use more precise examples.",
        "issue_found": "The answer relies on safe wording.",
        "evidence": ['"it was good"'],
    }
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
    assert pr.band == 7.0 and pr.evidence[0].quote == '"it was good"'
    assert pr.feedback[0].suggestion == "Use more precise examples."
    assert pr.feedback[0].example_from_candidate == "it was good"


def test_scorecard_from_event_checks_tool_name():
    ev = {"type": "conversation.tool_call", "tool_name": TOOL_NAME, "arguments": _args()}
    assert scorecard_from_event(ev).overall_band > 0
    with pytest.raises(ValueError):
        scorecard_from_event({"tool_name": "something_else", "arguments": {}})


def test_event_arguments_may_be_json_string():
    import json
    ev = {"tool_name": TOOL_NAME, "arguments": json.dumps(_args(7, 7, 7, 7))}
    assert scorecard_from_event(ev).overall_band == 7.0


def test_existing_tavus_flat_schema_is_supported():
    card = scorecard_from_arguments({
        "overall_band": 6.5,
        "fc_band": 6.0,
        "fc_evidence": 'The candidate said "I like this place because it is peaceful."',
        "fc_improvement": "Add clearer signposting.",
        "lr_band": 7.0,
        "lr_evidence": 'The phrase "peaceful and memorable" shows useful description.',
        "lr_improvement": "Add stronger collocations.",
        "gra_band": 6.0,
        "gra_evidence": 'The line "I went there because my friend invited me" is accurate but simple.',
        "gra_improvement": "Use more controlled complex clauses.",
        "pron_band": 6.0,
        "pron_evidence": "Speech appeared understandable.",
        "pron_improvement": "Work on sentence stress.",
        "summary": "Overall band 6.5.",
    })
    assert card.overall_band == 6.5
    assert card.part_summaries["llm_summary"] == "Overall band 6.5."
    assert card.criteria["lexical_resource"].band == 7.0
    assert card.criteria["fluency_coherence"].feedback[0].suggestion == "Add clearer signposting."
    assert card.criteria["fluency_coherence"].feedback[0].example_from_candidate.startswith("I like")


def test_grading_context_surfaces_pronunciation():
    words = [{"text": "scenery", "start": 0.0, "end": 0.5, "confidence": 0.55},
             {"text": "was", "start": 0.6, "end": 0.8, "confidence": 0.95}]
    feats = extract_features(Turn.from_tavus(1, 2, words, clean_text="scenery was"))
    ctx = build_grading_context(feats)
    assert "Pronunciation" in ctx and "Charsiu/acoustic" in ctx
    assert "MEASUREMENTS" in ctx
