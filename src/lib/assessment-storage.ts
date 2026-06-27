import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  PartScore,
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

type OverallBands = CriterionBands & { overall_band: number | null };

// Session overall = the simple average of the parts, rounded to the nearest
// IELTS half-band. (A primary-part weighting can replace this later.)
function averageBands(parts: PartScore[]): OverallBands {
  const rows = parts.map((p) => ({
    overall_band: p.scorecard.overall_band,
    ...criterionBands(p.scorecard),
  }));
  const mean = (key: keyof OverallBands): number | null => {
    const vals = rows
      .map((r) => r[key])
      .filter((v): v is number => typeof v === "number");
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 2) / 2;
  };
  return {
    overall_band: mean("overall_band"),
    fluency_band: mean("fluency_band"),
    lexical_band: mean("lexical_band"),
    grammar_band: mean("grammar_band"),
    pronunciation_band: mean("pronunciation_band"),
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
  // Per-part model: one assessment_results + one transcripts row per part.
  const parts = score.by_part ?? [];
  if (!parts.length) return;

  const now = new Date().toISOString();

  const resultRows = parts.map((p) => ({
    mock_session_id: mockSessionId,
    user_id: userId,
    part: p.part,
    overall_band: p.scorecard.overall_band,
    ...criterionBands(p.scorecard),
    scorecard: toJson(p.scorecard),
    coaching: toJson(p.coaching ?? {}),
  }));
  const { error: resultError } = await supabase
    .from("assessment_results")
    .upsert(resultRows, { onConflict: "mock_session_id,part" });
  if (resultError) throw resultError;

  const transcriptRows = parts.map((p) => ({
    mock_session_id: mockSessionId,
    user_id: userId,
    tavus_conversation_id: conversationId,
    part: p.part,
    raw_transcript: toJson(p.raw_transcript ?? rawTranscript ?? {}),
    candidate_text: p.candidate_text ?? null,
    source: "tavus",
    captured_at: now,
  }));
  const { error: transcriptError } = await supabase
    .from("transcripts")
    .upsert(transcriptRows, { onConflict: "mock_session_id,part" });
  if (transcriptError) throw transcriptError;

  // Session headline = average of the parts (one progress row per session).
  const overall = averageBands(parts);

  const { error: progressError } = await supabase.from("progress_history").upsert(
    {
      user_id: userId,
      mock_session_id: mockSessionId,
      ...overall,
      recorded_at: now,
    },
    { onConflict: "mock_session_id" },
  );
  if (progressError) throw progressError;

  const { error: sessionError } = await supabase
    .from("mock_sessions")
    .update({
      status: "scored",
      scored_at: now,
      updated_at: now,
      ...overall,
    })
    .eq("id", mockSessionId);

  if (sessionError) throw sessionError;
}
