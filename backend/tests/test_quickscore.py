from assessment.quickscore import score_transcript
from assessment.schema import Criterion


def test_score_transcript_returns_full_scorecard():
    text = ("The journey that stands out most was a trip across the Highlands, which "
            "I took because the scenery was absolutely breathtaking and I wanted to "
            "experience somewhere remote.")
    card, report, notes = score_transcript(text)
    assert 4.0 <= card.overall_band <= 9.0
    assert set(card.criteria) == {c.value for c in Criterion}
    assert report.spoken_overview
    # lexical/grammar are real evidence; fluency/pronunciation are placeholders
    assert "lexical_resource" in notes["real_criteria"]
    assert "fluency_coherence" in notes["placeholder_criteria"]


def test_basic_overuse_lowers_lexical():
    rich = score_transcript("I find the experience genuinely rewarding and worthwhile.")[0]
    poor = score_transcript("it was good and good and good and really good good")[0]
    assert (poor.criteria["lexical_resource"].band
            <= rich.criteria["lexical_resource"].band)
