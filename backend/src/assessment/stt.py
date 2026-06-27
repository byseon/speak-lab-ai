"""Where the word/phone timings come from (the fluency layer's backbone).

We do NOT need a separate STT vendor. Tavus handles in-call transcription
(`tavus-soniox`) and delivers the recording (MP4) via the
`application.recording_ready` webhook. But the Tavus transcript is utterance-level,
and fluency features need per-word timing. So:

  Tavus transcript text  +  recording audio  --Charsiu forced alignment-->  Word[]
                                                (word + phone boundaries; MIT)

Charsiu does double duty: the same alignment that yields GOP for pronunciation
(see features/pronunciation.py) also yields the word timings used here. One local
model, no extra API key.

`words_from_tavus_tokens` adapts any word-level export Tavus may provide directly;
`align_words` is the forced-alignment path. `Transcriber` is the contract.
"""

from __future__ import annotations

from typing import Protocol, Any
from .schema import Word


class Transcriber(Protocol):
    def transcribe(self, audio_path: str, reference_text: str = "") -> list[Word]: ...


class CharsiuAligner:
    """Forced-alignment 'transcriber': align reference text to audio -> Word timings.

    Requires torch + the charsiu repo (lingjzhu/charsiu). Lazy import so this module
    needs no heavy deps. Returns word-level Words; phone-level timings/GOP are
    produced alongside by features/pronunciation.CharsiuGopAssessor.
    """

    def __init__(self, model: str | None = None):
        from .config import config
        self.model = model or config.charsiu_model
        self._aligner = None

    def transcribe(self, audio_path: str, reference_text: str = "") -> list[Word]:
        if not reference_text:
            raise ValueError("forced alignment needs the Tavus transcript as reference_text")
        if self._aligner is None:
            from Charsiu import charsiu_forced_aligner  # lazy
            self._aligner = charsiu_forced_aligner(aligner=self.model)
        # alignment = self._aligner.align(audio=audio_path, text=reference_text)
        # -> map each word segment to Word(text, start, end); confidence from the
        #    frame posteriors. Wire to the installed charsiu version.
        raise NotImplementedError(
            "Run charsiu align(audio, reference_text) and map word segments to Word(...).")


def words_from_tavus_tokens(tokens: list[dict[str, Any]]) -> list[Word]:
    """Adapt a word-level transcript export (if available) to Word objects.

    Expected token shape: {text|word, start|start_ms, end|end_ms, confidence?}.
    Use this if a Tavus transcript ever exposes word timings directly; otherwise
    use CharsiuAligner on the recording audio.
    """
    out: list[Word] = []
    for t in tokens:
        start = t.get("start", t.get("start_ms", 0))
        end = t.get("end", t.get("end_ms", 0))
        if start > 1000 or end > 1000:  # normalise ms -> s
            start, end = start / 1000.0, end / 1000.0
        out.append(Word(t.get("text", t.get("word", "")), float(start), float(end),
                        t.get("confidence")))
    return out
