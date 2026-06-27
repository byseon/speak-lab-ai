import math

from assessment.features.gop import (
    gop_from_posteriors, gop_to_accuracy, pronunciation_features_from_gop,
)

# Inventory: phone 0 = "AH", phone 1 = "S".
PHONE_INDEX = {"AH": 0, "S": 1}


def _lp(*probs):
    return [math.log(p) for p in probs]


def test_gop_perfect_phone_is_zero():
    # AH frame: model is confident it's AH -> GOP == 0
    log_post = [_lp(0.9, 0.1)]
    gop = gop_from_posteriors(log_post, [("AH", 0, 1)], PHONE_INDEX)
    assert gop[0][0] == "AH"
    assert abs(gop[0][1]) < 1e-9


def test_gop_mispronounced_phone_is_negative():
    # S frame: model thinks it's AH, not S -> GOP < 0
    log_post = [_lp(0.8, 0.2)]
    gop = gop_from_posteriors(log_post, [("S", 0, 1)], PHONE_INDEX)
    assert gop[0][1] == math.log(0.2) - math.log(0.8)  # ~ -1.386
    assert gop_to_accuracy(gop[0][1]) < 50


def test_gop_averages_over_frames():
    log_post = [_lp(0.5, 0.5), _lp(0.5, 0.5)]  # two frames, AH tied with S
    gop = gop_from_posteriors(log_post, [("AH", 0, 2)], PHONE_INDEX)
    assert abs(gop[0][1]) < 1e-9  # log0.5 - max(log0.5,log0.5) = 0


def test_features_flag_low_accuracy_phonemes():
    log_post = [_lp(0.95, 0.05), _lp(0.2, 0.8)]
    segments = [("AH", 0, 1), ("S", 1, 2)]   # AH good, S good too here
    per_phone = gop_from_posteriors(log_post, segments, PHONE_INDEX)
    feats = pronunciation_features_from_gop(per_phone)
    assert feats.source == "gop"
    assert feats.accuracy_score is not None and 0 <= feats.accuracy_score <= 100
    assert feats.intelligibility_estimate is not None


def test_features_identify_the_bad_phone():
    # AH well pronounced, S badly (model says AH) -> S flagged, not AH
    log_post = [_lp(0.95, 0.05), _lp(0.85, 0.15)]
    segments = [("AH", 0, 1), ("S", 1, 2)]
    feats = pronunciation_features_from_gop(
        gop_from_posteriors(log_post, segments, PHONE_INDEX))
    assert feats.low_accuracy_phonemes == ["S"]


def test_empty_gop_returns_neutral_features():
    feats = pronunciation_features_from_gop([])
    assert feats.source == "gop"
    assert feats.accuracy_score is None
