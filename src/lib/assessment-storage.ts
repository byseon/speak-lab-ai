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

function extractCandidateText(value: unknown): string | null {
  const lines: string[] = [];

  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    const record = node as Record<string, unknown>;
    const role = String(record.role ?? record.speaker ?? "").toLowerCase();
    const text = record.text ?? record.transcript ?? record.message;

    if (
      typeof text === "string" &&
      text.trim() &&
      (role.includes("user") || role.includes("candidate") || role.includes("participant"))
    ) {
      lines.push(text.trim());
    }

    Object.values(record).forEach(visit);
  };

  visit(value);
  return lines.length ? lines.join("\n") : null;
}

function partsForStorage({
  selectedParts,
  score,
  rawTranscript,
}: {
  selectedParts: SpeakingPart[];
  score: ScoreAssessmentResponse;
  rawTranscript?: Record<string, unknown>;
}): PartScore[] {
  if (score.by_part?.length) return score.by_part;
  if (!score.scorecard) return [];

  const compatibleParts = selectedParts.length ? selectedParts : ([1] as SpeakingPart[]);
  const candidateText = extractCandidateText(rawTranscript);

  return compatibleParts.map((part) => ({
    part,
    scorecard: score.scorecard as Scorecard,
    coaching: score.report
      ? {
          report: score.report,
          notes: score.notes ?? null,
        }
      : (score.notes ?? {}),
    raw_transcript: rawTranscript,
    candidate_text: candidateText,
  }));
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
    const vals = rows.map((r) => r[key]).filter((v): v is number => typeof v === "number");
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
  parts: selectedParts,
  score,
  rawTranscript,
}: {
  userId: string;
  mockSessionId: string;
  conversationId: string;
  parts: SpeakingPart[];
  score: ScoreAssessmentResponse;
  rawTranscript?: Record<string, unknown>;
}) {
  // One row per session: aggregate all parts into a single assessment_results /
  // transcripts row keyed by mock_session_id (matches current schema).
  const parts = partsForStorage({ selectedParts, score, rawTranscript });
  if (!parts.length && !score.scorecard) return;

  const now = new Date().toISOString();
  const overall: OverallBands = score.scorecard
    ? {
        overall_band: score.scorecard.overall_band,
        ...criterionBands(score.scorecard),
      }
    : averageBands(parts);

  const aggregatedScorecard = score.scorecard ?? (parts[0]?.scorecard as Scorecard | undefined);
  const aggregatedCandidateText =
    parts
      .map((p) => p.candidate_text)
      .filter((t): t is string => typeof t === "string" && !!t.trim())
      .join("\n\n") || extractCandidateText(rawTranscript);

  const { data: savedResult, error: resultError } = await supabase
    .from("assessment_results")
    .upsert(
      {
        mock_session_id: mockSessionId,
        user_id: userId,
        overall_band: overall.overall_band,
        fluency_band: overall.fluency_band,
        lexical_band: overall.lexical_band,
        grammar_band: overall.grammar_band,
        pronunciation_band: overall.pronunciation_band,
        scorecard: toJson(aggregatedScorecard ?? {}),
        report: score.report ? toJson({ ...score.report, by_part: parts }) : null,
        notes: score.notes ? toJson(score.notes) : null,
        transcript_chars: score.transcript_chars ?? null,
        updated_at: now,
      },
      { onConflict: "mock_session_id" },
    )
    .select("id")
    .single();
  if (resultError) throw resultError;

  const { error: transcriptError } = await supabase.from("transcripts").upsert(
    {
      mock_session_id: mockSessionId,
      user_id: userId,
      tavus_conversation_id: conversationId,
      raw_transcript: toJson(rawTranscript ?? { by_part: parts }),
      candidate_text: aggregatedCandidateText,
      source: "tavus",
      captured_at: now,
    },
    { onConflict: "mock_session_id" },
  );
  if (transcriptError) throw transcriptError;

  const { error: progressError } = await supabase.from("progress_history").upsert(
    {
      user_id: userId,
      mock_session_id: mockSessionId,
      assessment_result_id: savedResult.id,
      overall_band: overall.overall_band,
      fluency_band: overall.fluency_band,
      lexical_band: overall.lexical_band,
      grammar_band: overall.grammar_band,
      pronunciation_band: overall.pronunciation_band,
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
