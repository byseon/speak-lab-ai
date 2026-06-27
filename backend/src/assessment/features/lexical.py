"""Lexical Resource features.

Diversity (MTLD, TTR) is pure stdlib. Sophistication (rare-word ratio, mean log
frequency) needs a frequency list, so it is gated behind the optional `wordfreq`
dependency and degrades to None when absent — never crashes the pipeline.
"""

from __future__ import annotations

from collections import Counter
from ..schema import LexicalFeatures

try:  # optional: pip install "ielts-assessment[lexical]"
    from wordfreq import zipf_frequency
    _HAS_WORDFREQ = True
except Exception:  # pragma: no cover - depends on env
    _HAS_WORDFREQ = False

# Common function words excluded from "content word" overuse analysis.
_STOP = {
    "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "at",
    "for", "with", "as", "by", "is", "are", "was", "were", "be", "been", "being",
    "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "them", "my",
    "your", "this", "that", "these", "those", "do", "does", "did", "have", "has",
    "had", "will", "would", "can", "could", "should", "so", "not", "no", "yes",
    "there", "here", "what", "which", "who", "how", "when", "where", "very", "just",
}
# "basic" high-frequency words IELTS candidates lean on; flag overuse.
_BASIC = {"good", "bad", "nice", "thing", "things", "stuff", "really", "very", "a lot",
          "people", "get", "got", "make", "made", "big", "small", "like", "lot"}

# Zipf frequency >= this counts as "common" (top ~2000 band ~ zipf 4.0+).
_COMMON_ZIPF = 4.0


def _tokens(text: str) -> list[str]:
    return ["".join(c for c in t.lower() if c.isalpha()) for t in text.split()
            if any(c.isalpha() for c in t)]


def _mtld_one_direction(tokens: list[str], ttr_threshold: float = 0.72) -> float:
    """One pass of the MTLD factor count (McCarthy & Jarvis, 2010)."""
    if not tokens:
        return 0.0
    factors = 0.0
    types: set[str] = set()
    count = 0
    for tok in tokens:
        types.add(tok)
        count += 1
        ttr = len(types) / count
        if ttr <= ttr_threshold:
            factors += 1
            types, count = set(), 0
    if count > 0:  # partial factor for the trailing segment
        ttr = len(types) / count
        factors += (1 - ttr) / (1 - ttr_threshold)
    return len(tokens) / factors if factors else float(len(tokens))


def mtld(tokens: list[str]) -> float:
    """Length-robust lexical diversity = mean of forward and backward MTLD."""
    if len(tokens) < 10:
        return 0.0  # MTLD is unstable on very short samples
    fwd = _mtld_one_direction(tokens)
    bwd = _mtld_one_direction(list(reversed(tokens)))
    return round((fwd + bwd) / 2, 1)


def extract_lexical(text: str) -> LexicalFeatures:
    lx = LexicalFeatures()
    tokens = _tokens(text)
    if not tokens:
        return lx

    lx.token_count = len(tokens)
    lx.type_count = len(set(tokens))
    lx.type_token_ratio = round(lx.type_count / lx.token_count, 3)
    lx.mtld = mtld(tokens)

    content = [t for t in tokens if t not in _STOP]
    counts = Counter(content)
    lx.most_repeated_content_words = counts.most_common(5)
    lx.flagged_basic_overuse = sorted(
        {t for t, c in Counter(tokens).items() if t in _BASIC and c >= 3}
    )

    if _HAS_WORDFREQ:
        zipfs = [zipf_frequency(t, "en") for t in tokens]
        zipfs = [z for z in zipfs if z > 0]
        if zipfs:
            rare = sum(1 for z in zipfs if z < _COMMON_ZIPF)
            lx.rare_word_ratio = round(rare / len(zipfs), 3)
            lx.mean_word_log_frequency = round(sum(zipfs) / len(zipfs), 3)

    return lx
