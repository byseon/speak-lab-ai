# Assessor — Rubric Judge Prompts (async, off-call)

> One judge per IELTS criterion. Each runs over a section (Part 1 / 2 / 3) or the whole test,
> receives the transcript spans + the Layer-A features for its criterion + retrieved band
> descriptors and exemplars, and returns **structured JSON**. Use a low-hallucination model
> (e.g. Claude Haiku/Sonnet or `tavus-claude-haiku-4.5`) at low temperature.
>
> Criteria & key indicators below are the official IELTS Speaking criteria
> (Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation).

---

## Shared output schema (all judges)

```json
{
  "criterion": "fluency_coherence | lexical_resource | grammatical_range_accuracy | pronunciation",
  "band": 6.5,
  "confidence": 0.0,
  "evidence": [
    { "quote": "exact words from transcript", "observation": "what it shows", "feature": "speech_rate_wpm=95" }
  ],
  "feedback": [
    { "issue": "…", "example_from_candidate": "…", "suggestion": "…", "upgraded_example": "…" }
  ],
  "comparative_note": "Closer to band-6 exemplar than band-7 because …"
}
```

Rules for every judge:
- **Cite evidence for the band.** No quote/feature → not allowed to move the band.
- **Anchor by comparison.** You are given 2–3 labelled exemplars near the candidate band;
  decide which the candidate most resembles and justify in `comparative_note`.
- Score in **half-bands**. Be calibrated, not lenient. Reserve 8–9 for genuinely
  near-native performance.

---

## Judge 1 — Fluency & Coherence

```
Assess FLUENCY AND COHERENCE: the ability to talk with normal continuity, rate and effort,
and to link ideas into coherent connected speech.

Weigh these official indicators against the provided FEATURES and TRANSCRIPT:
- Speech rate (not too slow). FEATURE: speech_rate_wpm, articulation_rate_wpm.
- Speech continuity: false starts, backtracking, functionless repetition, word-search pauses.
  FEATURES: silent_pauses[], filled_pauses, false_starts, mean_length_of_run.
- Logical sequencing of spoken sentences; relevance to the turn's purpose.
- Clear marking of stages with appropriate pausing and discourse markers/fillers.
- Cohesive devices within/between sentences (connectors, pronouns, conjunctions).
  FEATURE: discourse_marker_density.

Note: natural fillers used to MARK discourse are fine; only penalise pausing/repetition that
reflects word-searching or breakdown. Reward smooth, well-sequenced, well-connected speech.

FEATURES: {features}
TRANSCRIPT (raw, pre-cleanup — keeps fillers/repeats): {raw_transcript}
BAND DESCRIPTORS: {retrieved_descriptors}
EXEMPLARS near candidate band: {retrieved_exemplars}
Return the shared JSON schema.
```

## Judge 2 — Lexical Resource

```
Assess LEXICAL RESOURCE: range of vocabulary, and precision with which meanings/attitudes
are expressed.

Weigh these official indicators:
- Variety of words used. FEATURES: mtld, vocd_d, type_token_ratio.
- Adequacy & appropriacy for: referential meaning (correct labelling), style (formal/informal),
  collocation (incl. idiomatic expressions), conveying the speaker's attitude.
  FEATURES: rare_word_ratio (beyond top-2000), awl_coverage, collocation_hits, idiom_hits.
- Ability to PARAPHRASE around a vocabulary gap (with or without hesitation) — reward this.
  FEATURE: paraphrase_events[].

Penalise repetition of basic words, misused collocations, and register errors. Credit precise,
flexible, idiomatic usage. Quote the exact words you reward or penalise.

FEATURES: {features}
TRANSCRIPT (cleaned): {clean_transcript}
BAND DESCRIPTORS: {retrieved_descriptors}
EXEMPLARS near candidate band: {retrieved_exemplars}
Return the shared JSON schema.
```

## Judge 3 — Grammatical Range & Accuracy

```
Assess GRAMMATICAL RANGE AND ACCURACY: accurate, appropriate syntax and the range of
grammatical resources used.

RANGE indicators:
- Length of spoken sentences. FEATURE: mean_length_of_t_unit.
- Subordinate clauses within clauses/phrases. FEATURE: subordination_ratio, clauses_per_sentence.
- Verb-phrase complexity (continuous/perfect aspect, modality, passive). FEATURE: verb_form_variety.
- Phrase complexity (pre-/post-modification) and varied sentence structures for focus.

ACCURACY indicators:
- Error density (grammatical errors per amount of speech). FEATURE: error_density.
- Communicative effect of error — does it harm intelligibility/precision? FEATURE: error_gravity[].

Balance the two: wide range with frequent serious errors is NOT high; consistently accurate but
only simple structures is also capped. List 2–3 concrete corrections in feedback with the rule.

FEATURES: {features}
TRANSCRIPT (cleaned): {clean_transcript}
PARSE METRICS: {parse_metrics}
BAND DESCRIPTORS: {retrieved_descriptors}
EXEMPLARS near candidate band: {retrieved_exemplars}
Return the shared JSON schema.
```

## Judge 4 — Pronunciation

```
Assess PRONUNCIATION: accurate, sustained use of phonological features to convey meaning.
You CANNOT hear audio directly — you are given outputs from a pronunciation-assessment model
plus word timings. Base the band on those, not on the spelling of the transcript.

Indicators (map to the provided model outputs):
- Chunking speech into meaningful units. FEATURE: prosody_score, pause_placement.
- Rhythm & stress timing, linking/elision (connected speech). FEATURE: prosody_score, fluency_score.
- Stress (emphatic/contrastive) & intonation to enhance meaning. FEATURE: intonation_flags[].
- Sounds at word/phoneme level (word stress, vowels, consonants) and listener effort.
  FEATURES: phoneme_accuracy[], word_stress_errors[], accuracy_score.
- Overall effect of accent on intelligibility. FEATURE: intelligibility_estimate.

Accent itself is NOT penalised — only the degree to which features reduce intelligibility or
listener effort. Identify the 2–3 highest-impact sounds/patterns to fix.

PRONUNCIATION MODEL OUTPUT: {pron_features}
WORD TIMINGS: {word_timings}
BAND DESCRIPTORS: {retrieved_descriptors}
EXEMPLARS near candidate band: {retrieved_exemplars}
Return the shared JSON schema.
```

---

## Aggregation (deterministic, after the four judges)

```
overall = mean(fc.band, lr.band, gra.band, p.band)
round to nearest half-band, IELTS rule:
  fractional .25  -> round UP to .5      (e.g. 6.25 -> 6.5)
  fractional .75  -> round UP to next whole (e.g. 6.75 -> 7.0)
```

Optional **head-examiner meta-judge**: if any criterion judge's band contradicts its own
features (e.g. claims 7.0 fluency with speech_rate_wpm=80 and 12 long pauses), flag and
request a re-judgement with the discrepancy highlighted before aggregating.
