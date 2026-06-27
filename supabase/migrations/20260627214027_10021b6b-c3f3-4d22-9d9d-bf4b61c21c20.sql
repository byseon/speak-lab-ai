
-- mock_sessions: one row per mock/practice session a user starts
CREATE TABLE public.mock_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'mock' CHECK (kind IN ('mock','practice')),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  tavus_conversation_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_s integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mock_sessions TO authenticated;
GRANT ALL ON public.mock_sessions TO service_role;
ALTER TABLE public.mock_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own sessions" ON public.mock_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sessions" ON public.mock_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sessions" ON public.mock_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own sessions" ON public.mock_sessions FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX mock_sessions_user_id_idx ON public.mock_sessions(user_id, started_at DESC);

-- assessment_results: scorecard for a completed session
CREATE TABLE public.assessment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.mock_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_band numeric(2,1),
  fluency_band numeric(2,1),
  lexical_band numeric(2,1),
  grammar_band numeric(2,1),
  pronunciation_band numeric(2,1),
  scorecard jsonb NOT NULL DEFAULT '{}'::jsonb,
  coaching jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_results TO authenticated;
GRANT ALL ON public.assessment_results TO service_role;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own results" ON public.assessment_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own results" ON public.assessment_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own results" ON public.assessment_results FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own results" ON public.assessment_results FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX assessment_results_user_idx ON public.assessment_results(user_id, created_at DESC);
CREATE INDEX assessment_results_session_idx ON public.assessment_results(session_id);

-- transcripts: per-turn transcript rows for a session
CREATE TABLE public.transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.mock_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turn_idx integer NOT NULL,
  part smallint NOT NULL CHECK (part IN (1,2,3)),
  speaker text NOT NULL CHECK (speaker IN ('examiner','candidate')),
  prompt text,
  text text NOT NULL DEFAULT '',
  words jsonb NOT NULL DEFAULT '[]'::jsonb,
  audio_url text,
  started_at_s numeric,
  ended_at_s numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transcripts TO authenticated;
GRANT ALL ON public.transcripts TO service_role;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transcripts" ON public.transcripts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own transcripts" ON public.transcripts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own transcripts" ON public.transcripts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own transcripts" ON public.transcripts FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX transcripts_session_idx ON public.transcripts(session_id, turn_idx);
CREATE INDEX transcripts_user_idx ON public.transcripts(user_id);

-- progress_history: time series of band scores for charting progress
CREATE TABLE public.progress_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.mock_sessions(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  overall_band numeric(2,1),
  fluency_band numeric(2,1),
  lexical_band numeric(2,1),
  grammar_band numeric(2,1),
  pronunciation_band numeric(2,1),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_history TO authenticated;
GRANT ALL ON public.progress_history TO service_role;
ALTER TABLE public.progress_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own progress" ON public.progress_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own progress" ON public.progress_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own progress" ON public.progress_history FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own progress" ON public.progress_history FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX progress_history_user_idx ON public.progress_history(user_id, recorded_at DESC);

-- updated_at trigger function (shared)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_mock_sessions_updated_at BEFORE UPDATE ON public.mock_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assessment_results_updated_at BEFORE UPDATE ON public.assessment_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
