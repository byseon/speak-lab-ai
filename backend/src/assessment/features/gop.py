"""Goodness-of-Pronunciation (GOP) scoring from phoneme posteriors.

Deliberately separated from the model: the scoring MATH lives here (pure Python,
fully testable without torch/audio), while `CharsiuGopAssessor` runs the wav2vec2
model to produce the posteriorgram + forced alignment and then calls these functions.

GOP (Witt & Young, 2000; modern posterior variant):
    GOP(p) = (1/T_p) * sum_{t in p} [ log P(p | o_t) - max_q log P(q | o_t) ]
i.e. over the frames aligned to phone p, how much the canonical phone's posterior
trails the best-scoring phone. GOP <= 0; 0 == native-like, very negative == likely
mispronounced. We map a phone's GOP to a 0–100 accuracy via exp(GOP) * 100.
"""

from __future__ import annotations

import math
from ..schema import PronunciationFeatures

# A phone whose mapped accuracy is below this (0–100) is flagged as mispronounced.
LOW_ACCURACY_THRESHOLD = 50.0


def gop_from_posteriors(
    log_posteriors: list[list[float]],
    segments: list[tuple[str, int, int]],
    phone_to_index: dict[str, int],
) -> list[tuple[str, float]]:
    """Per-phone GOP from a frame×phone log-posterior matrix + forced alignment.

    - log_posteriors[t][k] = log P(phone_k | frame_t)
    - segments = [(phone_symbol, start_frame, end_frame), ...] from alignment
    - phone_to_index maps a phone symbol to its column in log_posteriors

    Returns [(phone_symbol, gop), ...] aligned to `segments`.
    """
    out: list[tuple[str, float]] = []
    n = len(log_posteriors)
    for phone, start, end in segments:
        idx = phone_to_index.get(phone)
        if idx is None:
            continue
        s, e = max(0, start), min(n, end)
        diffs = [log_posteriors[t][idx] - max(log_posteriors[t]) for t in range(s, e)]
        gop = sum(diffs) / len(diffs) if diffs else 0.0
        out.append((phone, gop))
    return out


def gop_to_accuracy(gop: float) -> float:
    """Map a (log-domain, <=0) GOP to a 0–100 accuracy score."""
    return max(0.0, min(100.0, math.exp(gop) * 100.0))


def pronunciation_features_from_gop(
    per_phone_gop: list[tuple[str, float]],
    *,
    word_stress_errors: list[str] | None = None,
    prosody_score: float | None = None,
    intonation_flags: list[str] | None = None,
) -> PronunciationFeatures:
    """Aggregate per-phone GOP (+ optional prosody) into PronunciationFeatures.

    `prosody_score`/`word_stress_errors`/`intonation_flags` come from duration/energy
    and an F0 contour computed alongside alignment; pass them when available.
    """
    feats = PronunciationFeatures(source="gop")
    feats.word_stress_errors = word_stress_errors or []
    feats.prosody_score = prosody_score
    feats.intonation_flags = intonation_flags or []
    if not per_phone_gop:
        return feats

    accs = [(p, gop_to_accuracy(g)) for p, g in per_phone_gop]
    mean_acc = sum(a for _, a in accs) / len(accs)
    feats.accuracy_score = round(mean_acc, 1)
    feats.intelligibility_estimate = round(mean_acc / 100.0, 3)
    # distinct phones whose accuracy fell below the threshold, worst first
    worst: dict[str, float] = {}
    for phone, acc in accs:
        if acc < LOW_ACCURACY_THRESHOLD:
            worst[phone] = min(acc, worst.get(phone, 100.0))
    feats.low_accuracy_phonemes = [p for p, _ in sorted(worst.items(), key=lambda kv: kv[1])]
    return feats
