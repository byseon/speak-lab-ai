import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  ScoreAssessmentResponse,
  Scorecard,
  SpeakingPart,
  StartAssessmentResponse,
} from "@/lib/assessment-api";

type CriterionBands = {
  fluency_band: number | null;
  lexical_band: number | null;
  grammar_band: number | null;
  pronunciation_band: number | null;
};

function toJson(value: unknown): Json {
  return value as Json;
}

function band(scorecard: Scorecard, key: string) {
  const value = scorecard.criteria[key]?.band;
  return typeof value === "number" ? value : null;
}

function criterionBands(scorecard: Scorecard): CriterionBands {
  return {
    fluency_band: band(scorecard, "fluency_coherence"),
    lexical_band: band(scorecard, "lexical_resource"),
    grammar_band: band(scorecard, "grammatical_range_accuracy"),
    pronunciation_band: band(scorecard, "pronunciation"),
  };
}

export async function createMockSession({
  userId,
  parts,
  conversation,
}: {
  userId: string;
  parts: SpeakingPart[];
  conversation: Required<StartAssessmentResponse>;
}) {
  const { data, error } = await supabase
    .from("mock_sessions")
    .insert({
      user_id: userId,
      parts,
      tavus_conversation_id: conversation.conversation_id,
      tavus_conversation_url: conversation.conversation_url,
      status: "started",
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function markMockSessionEnded(mockSessionId: string) {
  const { error } = await supabase
    .from("mock_sessions")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", mockSessionId);

  if (error) throw error;
}

export async function saveAssessmentArtifacts({
  userId,
  mockSessionId,
  conversationId,
  score,
  rawTranscript,
}: {
  userId: string;
  mockSessionId: string;
  conversationId: string;
  score: ScoreAssessmentResponse;
  rawTranscript?: Record<string, unknown>;
}) {
  if (!score.scorecard) return;

  const bands = criterionBands(score.scorecard);
  const now = new Date().toISOString();

  const { data: result, error: resultError } = await supabase
    .from("assessment_results")
    .upsert(
      {
        mock_session_id: mockSessionId,
        user_id: userId,
        overall_band: score.scorecard.overall_band,
        ...bands,
        scorecard: toJson(score.scorecard),
        report: score.report ? toJson(score.report) : null,
        notes: score.notes ? toJson(score.notes) : null,
        transcript_chars: score.transcript_chars ?? null,
      },
      { onConflict: "mock_session_id" },
    )
    .select("id")
    .single();

  if (resultError) throw resultError;

  if (rawTranscript) {
    const { error: transcriptError } = await supabase.from("transcripts").upsert(
      {
        mock_session_id: mockSessionId,
        user_id: userId,
        tavus_conversation_id: conversationId,
        raw_transcript: toJson(rawTranscript),
        candidate_text: null,
        source: "tavus",
        captured_at: now,
      },
      { onConflict: "mock_session_id" },
    );

    if (transcriptError) throw transcriptError;
  }

  const { error: progressError } = await supabase.from("progress_history").upsert(
    {
      user_id: userId,
      assessment_result_id: result.id,
      mock_session_id: mockSessionId,
      overall_band: score.scorecard.overall_band,
      ...bands,
      recorded_at: now,
    },
    { onConflict: "assessment_result_id" },
  );

  if (progressError) throw progressError;

  const { error: sessionError } = await supabase
    .from("mock_sessions")
    .update({
      status: "scored",
      scored_at: now,
      updated_at: now,
    })
    .eq("id", mockSessionId);

  if (sessionError) throw sessionError;
}
