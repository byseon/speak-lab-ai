-- Per-part assessment: 3 rows per session (one per IELTS part) for both
-- assessment_results and transcripts. The session overall (overall + 4 bands) is
-- the average of the three parts and lives on mock_sessions + progress_history.
-- Tables are empty, so the in-place ALTERs lose no data.

-- 1. assessment_results -> per part (mock_session_id, part), add `coaching`.
ALTER TABLE public.assessment_results
  ADD COLUMN IF NOT EXISTS part SMALLINT,
  ADD COLUMN IF NOT EXISTS coaching JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.assessment_results ALTER COLUMN part SET NOT NULL;
ALTER TABLE public.assessment_results
  ADD CONSTRAINT assessment_results_part_chk CHECK (part IN (1, 2, 3));
ALTER TABLE public.assessment_results
  DROP CONSTRAINT IF EXISTS assessment_results_mock_session_id_key;
ALTER TABLE public.assessment_results
  ADD CONSTRAINT assessment_results_session_part_key UNIQUE (mock_session_id, part);

-- 2. transcripts -> per part (mock_session_id, part).
ALTER TABLE public.transcripts
  ADD COLUMN IF NOT EXISTS part SMALLINT;
ALTER TABLE public.transcripts ALTER COLUMN part SET NOT NULL;
ALTER TABLE public.transcripts
  ADD CONSTRAINT transcripts_part_chk CHECK (part IN (1, 2, 3));
ALTER TABLE public.transcripts
  DROP CONSTRAINT IF EXISTS transcripts_mock_session_id_key;
ALTER TABLE public.transcripts
  ADD CONSTRAINT transcripts_session_part_key UNIQUE (mock_session_id, part);

-- 3. progress_history -> one row per session holding the OVERALL (average) trend.
--    Drop the per-result uniqueness; the headline is keyed by session now.
ALTER TABLE public.progress_history
  DROP CONSTRAINT IF EXISTS progress_history_assessment_result_id_key;
ALTER TABLE public.progress_history
  ALTER COLUMN assessment_result_id DROP NOT NULL;
ALTER TABLE public.progress_history
  ADD CONSTRAINT progress_history_session_key UNIQUE (mock_session_id);

-- 4. mock_sessions -> store the session overall (average of the 3 parts) for quick
--    "last mock" reads on home/progress without re-aggregating the part rows.
ALTER TABLE public.mock_sessions
  ADD COLUMN IF NOT EXISTS overall_band NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS fluency_band NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS lexical_band NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS grammar_band NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS pronunciation_band NUMERIC(2,1);
