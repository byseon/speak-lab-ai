"""Demo: GOP pronunciation scoring on a synthetic posteriorgram.

    uv run python examples/demo_gop.py

The real pipeline gets the posteriorgram + forced alignment from the Charsiu wav2vec2
model on the per-turn audio (install: uv pip install -e ".[pron]" + the charsiu repo).
Here we synthesise posteriors for the word "scenery" (S IY N AH R IY) with the stressed
vowel mispronounced, so you can see GOP flag it — no model or audio needed.
"""

from __future__ import annotations

import math

from assessment.features.gop import (
    gop_from_posteriors, gop_to_accuracy, pronunciation_features_from_gop,
)

# Phone inventory (canonical phones for the word + a couple of distractors).
PHONES = ["S", "IY", "N", "AH", "R", "ER", "IH"]
IDX = {p: i for i, p in enumerate(PHONES)}


def frame(canonical: str, conf: float, distractor: str | None = None,
          distractor_conf: float = 0.0) -> list[float]:
    """One frame's log-posteriors: `conf` on the canonical phone, optional mass on a
    distractor (a wrong phone the model heard), rest spread over the inventory."""
    probs = [0.0] * len(PHONES)
    probs[IDX[canonical]] = conf
    if distractor:
        probs[IDX[distractor]] = distractor_conf
    leftover = max(1e-6, 1.0 - sum(probs))
    spread = leftover / sum(1 for p in probs if p == 0.0)
    probs = [p if p > 0 else spread for p in probs]
    return [math.log(max(p, 1e-6)) for p in probs]


# "scenery" = S IY N AH R IY. The stressed IY is mispronounced -> model hears IH.
spoken = [
    ("S", frame("S", 0.92)),
    ("IY", frame("IY", 0.20, distractor="IH", distractor_conf=0.68)),  # mispronounced
    ("N", frame("N", 0.90)),
    ("AH", frame("AH", 0.88)),
    ("R", frame("R", 0.91)),
    ("IY", frame("IY", 0.85)),
]
log_post = [f for _, f in spoken]
segments = [(ph, i, i + 1) for i, (ph, _) in enumerate(spoken)]

print('Word: "scenery"  (S IY N AH R IY) — stressed vowel deliberately mispronounced\n')
per_phone = gop_from_posteriors(log_post, segments, IDX)
print("  phone   GOP      accuracy")
for ph, g in per_phone:
    flag = "  <-- mispronounced" if gop_to_accuracy(g) < 50 else ""
    print(f"  {ph:4}  {g:7.3f}   {gop_to_accuracy(g):5.1f}{flag}")

feats = pronunciation_features_from_gop(per_phone)
print("\nPronunciationFeatures (what the grading context / Pronunciation judge sees):")
print(f"  source                = {feats.source}")
print(f"  accuracy_score        = {feats.accuracy_score}")
print(f"  intelligibility       = {feats.intelligibility_estimate}")
print(f"  low_accuracy_phonemes = {feats.low_accuracy_phonemes}")
print("\nThis PronunciationFeatures object flows into build_grading_context(), so the "
      "Tavus PAL grades pronunciation from these numbers it cannot otherwise hear.")
