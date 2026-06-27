"""Fluency & Coherence features from word-level timings.

This is the heart of the voice-ML contribution: IELTS Fluency lives in the
*timing* of speech (rate, pauses, runs, hesitation) — signals a clean transcript
throws away. Everything here is derived from `Word(start, end)` timestamps, which
tavus-parakeet provides. Pure stdlib; no numpy required.

Indicators implemented (mapped to the official criteria):
  - speech rate           -> speech_rate_wpm, effective_speech_rate_wpm
  - articulation rate     -> articulation_rate_wpm, phonation_time_ratio
  - speech continuity     -> silent/long pauses, mean length of run
  - hesitation / search   -> filled pauses, functionless repetitions
  - coherence marking      -> discourse-marker density
"""

from __future__ import annotations

from ..schema import Word, FluencyFeatures

# Tunables (seconds). 0.25s is a common boundary for a perceptible silent pause;
# >=1.0s strongly implies word-searching / breakdown.
SHORT_PAUSE_S = 0.25
LONG_PAUSE_S = 1.0

FILLED_PAUSES = {
    "um", "uh", "er", "erm", "uhm", "hmm", "mm", "mmm", "ah", "eh", "uhh", "umm",
}

# Single- and multi-word discourse markers (coherence signposting).
DISCOURSE_UNIGRAMS = {
    "well", "so", "actually", "basically", "anyway", "however", "therefore",
    "because", "although", "though", "firstly", "secondly", "thirdly", "finally",
    "moreover", "furthermore", "besides", "meanwhile", "consequently", "thus",
    "nevertheless", "nonetheless", "overall", "honestly", "personally",
}
DISCOURSE_BIGRAMS = {
    ("you", "know"), ("for", "example"), ("for", "instance"), ("in", "addition"),
    ("on", "the"), ("in", "fact"), ("of", "course"), ("as", "well"),
    ("first", "of"), ("to", "sum"), ("in", "conclusion"), ("that", "said"),
}


def _norm(text: str) -> str:
    return "".join(c for c in text.lower() if c.isalpha())


def extract_fluency(words: list[Word]) -> FluencyFeatures:
    f = FluencyFeatures()
    if not words:
        return f

    words = sorted(words, key=lambda w: w.start)
    norm = [_norm(w.text) for w in words]

    total_time = max(1e-6, words[-1].end - words[0].start)
    phonation = sum(w.duration for w in words)
    word_count = len(words)

    # --- pauses & runs --------------------------------------------------- #
    gaps = [max(0.0, words[i + 1].start - words[i].end) for i in range(word_count - 1)]
    silent = [
        (round(words[i].end, 3), round(words[i + 1].start, 3), round(g, 3))
        for i, g in enumerate(gaps)
        if g >= SHORT_PAUSE_S
    ]
    long_pauses = [g for g in gaps if g >= LONG_PAUSE_S]
    # runs = stretches of speech between silent pauses
    num_runs = sum(1 for g in gaps if g >= SHORT_PAUSE_S) + 1

    # --- hesitation markers ---------------------------------------------- #
    filled = sum(1 for n in norm if n in FILLED_PAUSES)
    repetitions = sum(
        1 for i in range(word_count - 1)
        if norm[i] and norm[i] == norm[i + 1] and norm[i] not in FILLED_PAUSES
    )
    # effective word count strips fillers and the duplicated copies
    effective_count = word_count - filled - repetitions

    # --- discourse markers (coherence) ----------------------------------- #
    dm = sum(1 for n in norm if n in DISCOURSE_UNIGRAMS)
    dm += sum(
        1 for i in range(word_count - 1)
        if (norm[i], norm[i + 1]) in DISCOURSE_BIGRAMS
    )

    per_100 = (word_count / 100.0) or 1e-6

    f.duration_s = round(total_time, 3)
    f.word_count = word_count
    f.speech_rate_wpm = round(word_count / total_time * 60, 1)
    f.effective_speech_rate_wpm = round(max(0, effective_count) / total_time * 60, 1)
    f.articulation_rate_wpm = round(word_count / max(1e-6, phonation) * 60, 1)
    f.phonation_time_ratio = round(phonation / total_time, 3)
    f.mean_length_of_run = round(word_count / num_runs, 2)
    f.silent_pause_count = len(silent)
    f.total_silent_pause_s = round(sum(g for *_, g in silent), 3)
    f.long_pause_count = len(long_pauses)
    f.filled_pause_count = filled
    f.fillers_per_100w = round(filled / per_100, 2)
    f.repetition_count = repetitions
    f.discourse_marker_count = dm
    f.discourse_markers_per_100w = round(dm / per_100, 2)
    f.silent_pauses = silent
    return f
