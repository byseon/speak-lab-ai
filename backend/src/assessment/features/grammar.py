"""Grammatical Range & Accuracy features.

Range (clause complexity, T-unit length, verb-form variety) is computed with
spaCy when available. Accuracy (error density / gravity) is best left to the LLM
judge — rule-based grammar-error detection is brittle for spoken English — so we
surface range metrics here and hand error analysis to the judge with the transcript.

spaCy is optional: if absent, we return an honest note and the judge falls back to
transcript-only analysis.
"""

from __future__ import annotations

from ..schema import GrammarFeatures

try:  # optional: pip install "ielts-assessment[nlp]" && python -m spacy download en_core_web_sm
    import spacy
    _NLP = spacy.load("en_core_web_sm")
except Exception:  # pragma: no cover - depends on env
    _NLP = None

_SUBORDINATE_DEPS = {"advcl", "acl", "relcl", "ccomp", "xcomp", "csubj", "csubjpass"}
_CLAUSE_DEPS = {"ROOT", "advcl", "acl", "relcl", "ccomp", "xcomp", "csubj",
                "csubjpass", "conj"}


def extract_grammar(clean_text: str) -> GrammarFeatures:
    g = GrammarFeatures()
    if _NLP is None:
        g.note = "spaCy not installed — range metrics skipped; judge uses transcript + LLM."
        return g
    if not clean_text.strip():
        return g

    doc = _NLP(clean_text)
    sents = list(doc.sents)
    g.sentence_count = len(sents)

    clause_heads = [t for t in doc if t.pos_ in ("VERB", "AUX") and t.dep_ in _CLAUSE_DEPS]
    n_clauses = max(1, len(clause_heads))
    n_sub = sum(1 for t in doc if t.dep_ in _SUBORDINATE_DEPS)

    # T-unit ~ one main clause plus any subordinate clauses attached to it.
    n_main = sum(1 for t in doc if t.dep_ in ("ROOT", "conj") and t.pos_ in ("VERB", "AUX"))
    n_main = max(1, n_main)
    tokens_alpha = [t for t in doc if t.is_alpha]

    g.clauses_per_sentence = round(n_clauses / max(1, g.sentence_count), 2)
    g.subordination_ratio = round(n_sub / n_clauses, 2)
    g.mean_length_of_t_unit = round(len(tokens_alpha) / n_main, 2)
    g.verb_form_variety = len({t.tag_ for t in doc if t.pos_ in ("VERB", "AUX")})
    g.uses_passive = any(t.dep_ in ("nsubjpass", "auxpass") for t in doc)
    g.uses_modality = any(t.tag_ == "MD" for t in doc)
    return g
