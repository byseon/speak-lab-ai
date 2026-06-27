
-- All four tables are empty; drop and recreate to match the app's save code.
DROP TABLE IF EXISTS public.progress_history CASCADE;
DROP TABLE IF EXISTS public.transcripts CASCADE;
DROP TABLE IF EXISTS public.assessment_results CASCADE;
DROP TABLE IF EXISTS public.mock_sessions CASCADE;

-- mock_sessions
CREATE TABLE public.mock_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parts SMALLINT[] NOT NULL DEFAULT '{}',
  tavus_conversation_id TEXT,
  tavus_conversation_url TEXT,
  status TEXT NOT NULL DEFAULT 'started',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  scored_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mock_sessions TO authenticated;
GRANT ALL ON public.mock_sessions TO service_role;
ALTER TABLE public.mock_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_select_own" ON public.mock_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ms_insert_own" ON public.mock_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ms_update_own" ON public.mock_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ms_delete_own" ON public.mock_sessions FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX mock_sessions_user_id_idx ON public.mock_sessions(user_id);
CREATE TRIGGER mock_sessions_set_updated_at BEFORE UPDATE ON public.mock_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- assessment_results
CREATE TABLE public.assessment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_session_id UUID NOT NULL UNIQUE REFERENCES public.mock_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_band NUMERIC,
  fluency_band NUMERIC,
  lexical_band NUMERIC,
  grammar_band NUMERIC,
  pronunciation_band NUMERIC,
  scorecard JSONB NOT NULL DEFAULT '{}'::jsonb,
  report JSONB,
  notes JSONB,
  transcript_chars INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_results TO authenticated;
GRANT ALL ON public.assessment_results TO service_role;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ar_select_own" ON public.assessment_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ar_insert_own" ON public.assessment_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ar_update_own" ON public.assessment_results FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ar_delete_own" ON public.assessment_results FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX assessment_results_user_id_idx ON public.assessment_results(user_id);
CREATE TRIGGER assessment_results_set_updated_at BEFORE UPDATE ON public.assessment_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- transcripts
CREATE TABLE public.transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_session_id UUID NOT NULL UNIQUE REFERENCES public.mock_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tavus_conversation_id TEXT,
  raw_transcript JSONB NOT NULL DEFAULT '{}'::jsonb,
  candidate_text TEXT,
  source TEXT NOT NULL DEFAULT 'tavus',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transcripts TO authenticated;
GRANT ALL ON public.transcripts TO service_role;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tr_select_own" ON public.transcripts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tr_insert_own" ON public.transcripts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tr_update_own" ON public.transcripts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tr_delete_own" ON public.transcripts FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX transcripts_user_id_idx ON public.transcripts(user_id);

-- progress_history
CREATE TABLE public.progress_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_result_id UUID NOT NULL UNIQUE REFERENCES public.assessment_results(id) ON DELETE CASCADE,
  mock_session_id UUID REFERENCES public.mock_sessions(id) ON DELETE SET NULL,
  overall_band NUMERIC,
  fluency_band NUMERIC,
  lexical_band NUMERIC,
  grammar_band NUMERIC,
  pronunciation_band NUMERIC,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_history TO authenticated;
GRANT ALL ON public.progress_history TO service_role;
ALTER TABLE public.progress_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ph_select_own" ON public.progress_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ph_insert_own" ON public.progress_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ph_update_own" ON public.progress_history FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ph_delete_own" ON public.progress_history FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX progress_history_user_id_idx ON public.progress_history(user_id);
