"""Score aggregation and the official IELTS half-band rounding rule.

Overall Speaking band = mean of the four criterion bands, rounded to the nearest
half band, where a .25 average rounds UP to .5 and a .75 average rounds UP to the
next whole band (e.g. 6.25 -> 6.5, 6.75 -> 7.0).

Implemented as round-half-up on (value * 2) / 2, which reproduces that rule
exactly while avoiding Python's banker's rounding.
"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from .schema import Criterion, JudgeResult, Scorecard


def ielts_round(value: float) -> float:
    """Round a raw mean to the nearest IELTS half-band (.25/.75 round up)."""
    halves = Decimal(str(value * 2)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return float(halves) / 2.0


def aggregate(results: dict[Criterion, JudgeResult],
              meta_flags: list[str] | None = None) -> Scorecard:
    """Combine the four criterion judges into a Scorecard with an overall band."""
    if not results:
        raise ValueError("no judge results to aggregate")
    bands = [r.band for r in results.values()]
    overall = ielts_round(sum(bands) / len(bands))
    return Scorecard(
        overall_band=overall,
        criteria={c.value: r for c, r in results.items()},
        meta_flags=list(meta_flags or []),
    )


def feature_consistency_flags(results: dict[Criterion, JudgeResult]) -> list[str]:
    """Light sanity checks: a judge band that contradicts its own cited features.

    Returns human-readable flags for the optional head-examiner meta-judge to
    reconcile before the score is trusted. Heuristic, not authoritative.
    """
    flags: list[str] = []
    fc = results.get(Criterion.FLUENCY_COHERENCE)
    if fc and fc.band >= 7.0:
        for ev in fc.evidence:
            if "speech_rate_wpm=" in ev.feature:
                try:
                    rate = float(ev.feature.split("speech_rate_wpm=")[1].split()[0])
                    if rate < 90:
                        flags.append(
                            f"FC band {fc.band} but speech_rate_wpm={rate} (<90) — re-check")
                except (ValueError, IndexError):
                    pass
    return flags
