"""Per-part scoring: each part scored from its OWN utterances, with scoring
(bands) separated from feedback (coaching)."""

import pytest

from assessment.scoring import (
    score_session, to_transcript_rows, to_assessment_result, to_progress_row,
    to_part_result_rows, to_part_transcript_rows,
)
from assessment.examiner import ExamSession, TaggedUtterance
from assessment.schema import Part

# A fluent-ish Part 2 long turn and a Part 3 discussion answer (text-only here).
P2_TEXT = ("The journey that stands out most was a trip across the Scottish Highlands, "
           "which I took with my family because the scenery was absolutely breathtaking "
           "and we wanted to spend time together away from the city.")
P3_TEXT = ("I think tourism has changed considerably, mainly because budget airlines "
           "have made travel far more accessible than it used to be, although that has "
           "put real pressure on popular destinations.")


def test_score_session_separates_parts_and_scoring_from_feedback():
    utterances = [
        {"part": 1, "text": "I live in a small apartment near the centre of the city."},
        {"part": 2, "text": P2_TEXT},
        {"part": 3, "text": P3_TEXT},
    ]
    out = score_session(utterances)

    # Scoring and feedback are separate top-level sections.
    assert "scoring" in out and "feedback" in out
    assert set(out["scoring"]["by_part"]) == {"1", "2", "3"}
    assert set(out["feedback"]["by_part"]) == {"1", "2", "3"}
    assert out["parts_scored"] == [1, 2, 3]

    # Each part carries its own four-criterion scorecard.
    for p in ("1", "2", "3"):
        card = out["scoring"]["by_part"][p]["scorecard"]
        assert set(card["criteria"]) == {
            "fluency_coherence", "lexical_resource",
            "grammatical_range_accuracy", "pronunciation"}
        fb = out["feedback"]["by_part"][p]
        assert "strengths" in fb and "improvements" in fb

    assert 0 <= out["overall_band"] <= 9


def test_text_only_parts_flag_acoustic_placeholders():
    out = score_session([{"part": 2, "text": P2_TEXT}])
    part2 = out["scoring"]["by_part"]["2"]
    assert part2["has_audio_timings"] is False
    # Honest about which criteria are placeholders without word timings.
    assert any("placeholder" in f for f in part2["scorecard"]["meta_flags"])


def test_word_timings_enable_real_acoustic_features():
    words = [{"text": "the", "start": 0.0, "end": 0.12, "confidence": 0.97},
             {"text": "scenery", "start": 0.12, "end": 0.6, "confidence": 0.9},
             {"text": "was", "start": 0.6, "end": 0.78, "confidence": 0.95},
             {"text": "breathtaking", "start": 0.78, "end": 1.4, "confidence": 0.92}]
    out = score_session([{"part": 2, "text": "The scenery was breathtaking.",
                          "words": words}])
    assert out["scoring"]["by_part"]["2"]["has_audio_timings"] is True


def test_scoring_is_isolated_per_part():
    # Only parts 1 and 3 present -> part 2 is simply absent; no cross-contamination.
    out = score_session([
        {"part": 1, "text": "I work as a software engineer in a small startup."},
        {"part": 3, "text": P3_TEXT},
    ])
    assert out["parts_scored"] == [1, 3]
    assert set(out["scoring"]["by_part"]) == {"1", "3"}
    # Overall still resolves (criteria fall back to available parts).
    assert 0 <= out["overall_band"] <= 9


def test_score_session_accepts_tagged_utterances_from_examsession():
    # The objects ExamSession produces flow straight into scoring.
    utts = [
        TaggedUtterance(Part.PART1, "I live with my family in a coastal town."),
        TaggedUtterance(Part.PART2, P2_TEXT),
        TaggedUtterance(Part.PART3, P3_TEXT),
    ]
    out = score_session(utts)
    assert out["parts_scored"] == [1, 2, 3]


def test_empty_utterances_rejected():
    with pytest.raises(ValueError):
        score_session([])


# --- Schema row mappers (per-part transcription -> Supabase tables) --------- #

def test_to_transcript_rows_matches_transcripts_columns():
    utts = [
        TaggedUtterance(Part.PART1, "I live by the sea."),
        TaggedUtterance(Part.PART2, P2_TEXT, words=[{"text": "the", "start": 0.0,
                                                     "end": 0.1, "confidence": 0.9}]),
        TaggedUtterance(Part.PART3, P3_TEXT),
    ]
    rows = to_transcript_rows(utts)
    assert [r["turn_idx"] for r in rows] == [0, 1, 2]      # session-sequential
    assert [r["part"] for r in rows] == [1, 2, 3]          # tagged per part
    assert all(r["speaker"] == "candidate" for r in rows)  # CHECK (examiner|candidate)
    assert rows[1]["words"]                                # word timings preserved
    # Exactly the column set persistence will insert (it adds session_id/user_id).
    assert set(rows[0]) == {"turn_idx", "part", "speaker", "prompt", "text",
                            "words", "started_at_s", "ended_at_s"}


def test_to_assessment_result_matches_columns():
    out = score_session([
        {"part": 2, "text": P2_TEXT},
        {"part": 3, "text": P3_TEXT},
    ])
    row = to_assessment_result(out)
    assert set(row) == {"overall_band", "fluency_band", "lexical_band",
                        "grammar_band", "pronunciation_band", "scorecard", "coaching"}
    assert row["overall_band"] == out["overall_band"]
    # Full per-part detail survives in the jsonb columns.
    assert "by_part" in row["scorecard"] and "by_part" in row["coaching"]


def test_to_progress_row_is_band_columns_only():
    out = score_session([{"part": 2, "text": P2_TEXT}])
    row = to_progress_row(out)
    assert set(row) == {"overall_band", "fluency_band", "lexical_band",
                        "grammar_band", "pronunciation_band"}


def test_to_part_result_rows_is_one_row_per_part():
    out = score_session([
        {"part": 1, "text": "I live near the coast with my family."},
        {"part": 2, "text": P2_TEXT},
        {"part": 3, "text": P3_TEXT},
    ])
    rows = to_part_result_rows(out)
    # Each part (1, 2, 3) becomes its own row -> 3 rows for one session.
    assert [r["part"] for r in rows] == [1, 2, 3]
    for r in rows:
        assert {"part", "overall_band", "fluency_band", "lexical_band",
                "grammar_band", "pronunciation_band", "scorecard", "coaching"} == set(r)
        assert 0 <= r["overall_band"] <= 9


def test_to_part_transcript_rows_is_one_row_per_part():
    utts = [
        TaggedUtterance(Part.PART1, "First part answer one."),
        TaggedUtterance(Part.PART1, "First part answer two."),
        TaggedUtterance(Part.PART2, P2_TEXT,
                        words=[{"text": "the", "start": 0.0, "end": 0.1}]),
        TaggedUtterance(Part.PART3, P3_TEXT),
    ]
    rows = to_part_transcript_rows(utts)
    assert [r["part"] for r in rows] == [1, 2, 3]               # 3 rows, one per part
    assert set(rows[0]) == {"part", "raw_transcript", "candidate_text"}
    # Part 1's two turns are grouped into that single part row.
    assert len(rows[0]["raw_transcript"]["turns"]) == 2
    assert "First part answer one." in rows[0]["candidate_text"]
    # Word timings are preserved inside the part's transcript blob.
    assert rows[1]["raw_transcript"]["turns"][0]["words"]
