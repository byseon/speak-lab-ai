from assessment import Turn
from assessment.session import CoachingSession
from assessment.coaching import CueGenerator
from assessment.features import extract_features
from assessment.schema import Criterion


def _hesitant_turn(part=1):
    # long word-search pause (1.4s) + filler + overused 'good' x3
    script = [("um", 0.0, 0.3, 0.9), ("it", 0.4, 0.55, 0.95), ("was", 0.55, 0.75, 0.95),
              ("good", 0.75, 1.05, 0.9),               # then 1.4s gap:
              ("really", 2.45, 2.75, 0.9), ("good", 2.75, 3.05, 0.9),
              ("and", 3.05, 3.2, 0.95), ("good", 3.2, 3.5, 0.9)]
    words = [{"text": t, "start": s, "end": e, "confidence": c} for t, s, e, c in script]
    return Turn.from_tavus(1, part, words,
                           clean_text="Um it was good really good and good.")


def test_exam_mode_is_silent():
    feats = extract_features(_hesitant_turn())
    assert CueGenerator().generate(feats, mode="exam") == []


def test_coach_mode_emits_cue():
    feats = extract_features(_hesitant_turn())
    cues = CueGenerator().generate(feats, mode="coach")
    assert cues  # at least one improvement cue
    targets = {c.target for c in cues}
    assert targets & {Criterion.FLUENCY_COHERENCE, Criterion.LEXICAL_RESOURCE}


def test_part2_holds_cues_then_flushes():
    s = CoachingSession(mode="coach")
    res = s.process_turn(_hesitant_turn(part=2))
    assert res.cues == []            # no interruption during the long turn
    held = s.flush_held_cues()
    assert held                      # delivered after the monologue
    assert s.flush_held_cues() == []  # cleared


def test_session_tracks_focus_and_summary():
    s = CoachingSession(mode="coach")
    s.process_turn(_hesitant_turn(part=1))
    assert s.total_fillers >= 1

    from assessment import Criterion as C, JudgeResult, aggregate
    card = aggregate({
        C.FLUENCY_COHERENCE: JudgeResult(C.FLUENCY_COHERENCE, 5.0),
        C.LEXICAL_RESOURCE: JudgeResult(C.LEXICAL_RESOURCE, 6.0),
        C.GRAMMATICAL_RANGE_ACCURACY: JudgeResult(C.GRAMMATICAL_RANGE_ACCURACY, 6.0),
        C.PRONUNCIATION: JudgeResult(C.PRONUNCIATION, 7.0),
    })
    report = s.conversational_summary(card)
    assert str(card.overall_band) in report.spoken_overview
    assert report.followup_options
    assert report.priorities
