CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.mock_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  tavus_conversation_id TEXT NOT NULL,
  tavus_conversation_url TEXT,
  parts SMALLINT[] NOT NULL DEFAULT ARRAY[1, 2, 3]::SMALLINT[],
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'ended', 'scored', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  scored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tavus_conversation_id)
);

CREATE TABLE public.assessment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_session_id UUID NOT NULL REFERENCES public.mock_sessions ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  overall_band NUMERIC(2,1) NOT NULL,
  fluency_band NUMERIC(2,1),
  lexical_band NUMERIC(2,1),
  grammar_band NUMERIC(2,1),
  pronunciation_band NUMERIC(2,1),
  scorecard JSONB NOT NULL,
  report JSONB,
  notes JSONB,
  transcript_chars INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mock_session_id)
);

CREATE TABLE public.transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_session_id UUID NOT NULL REFERENCES public.mock_sessions ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  tavus_conversation_id TEXT NOT NULL,
  raw_transcript JSONB NOT NULL,
  candidate_text TEXT,
  source TEXT NOT NULL DEFAULT 'tavus',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mock_session_id)
);

CREATE TABLE public.progress_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  assessment_result_id UUID NOT NULL REFERENCES public.assessment_results ON DELETE CASCADE,
  mock_session_id UUID NOT NULL REFERENCES public.mock_sessions ON DELETE CASCADE,
  overall_band NUMERIC(2,1) NOT NULL,
  fluency_band NUMERIC(2,1),
  lexical_band NUMERIC(2,1),
  grammar_band NUMERIC(2,1),
  pronunciation_band NUMERIC(2,1),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_result_id)
);

CREATE INDEX mock_sessions_user_started_idx ON public.mock_sessions (user_id, started_at DESC);
CREATE INDEX assessment_results_user_created_idx ON public.assessment_results (user_id, created_at DESC);
CREATE INDEX transcripts_user_captured_idx ON public.transcripts (user_id, captured_at DESC);
CREATE INDEX progress_history_user_recorded_idx ON public.progress_history (user_id, recorded_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mock_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transcripts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_history TO authenticated;

GRANT ALL ON public.mock_sessions TO service_role;
GRANT ALL ON public.assessment_results TO service_role;
GRANT ALL ON public.transcripts TO service_role;
GRANT ALL ON public.progress_history TO service_role;

ALTER TABLE public.mock_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own mock sessions"
  ON public.mock_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own mock sessions"
  ON public.mock_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own mock sessions"
  ON public.mock_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own mock sessions"
  ON public.mock_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users view own assessment results"
  ON public.assessment_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own assessment results"
  ON public.assessment_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own assessment results"
  ON public.assessment_results FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own assessment results"
  ON public.assessment_results FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users view own transcripts"
  ON public.transcripts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own transcripts"
  ON public.transcripts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own transcripts"
  ON public.transcripts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own transcripts"
  ON public.transcripts FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users view own progress history"
  ON public.progress_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own progress history"
  ON public.progress_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own progress history"
  ON public.progress_history FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own progress history"
  ON public.progress_history FOR DELETE
  USING (auth.uid() = user_id);
