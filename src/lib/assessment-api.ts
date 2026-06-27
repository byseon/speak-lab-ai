// In local dev, prefer VITE_ASSESSMENT_API_URL (Python backend via ngrok or vite proxy).
// In production, route /api/* to the Supabase edge function `assessment`.
const EXPLICIT_BASE = (import.meta.env.VITE_ASSESSMENT_API_URL ?? "").replace(/\/$/, "");
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "") as string;

const USE_EDGE = !EXPLICIT_BASE && !!SUPABASE_URL;
const API_BASE_URL = USE_EDGE ? `${SUPABASE_URL}/functions/v1/assessment` : EXPLICIT_BASE;

export type SpeakingPart = 1 | 2 | 3;

export type AssessmentHealth = {
  ok: boolean;
  configured: Record<string, boolean>;
  missing: string[];
};

export type StartAssessmentResponse = {
  conversation_id?: string;
  conversation_url?: string;
};

export type CriterionScore = {
  band: number;
  criterion?: string;
  rationale?: string;
  evidence?: Array<{ quote?: string; observation?: string; feature?: string }> | string[];
  feedback?: Array<{
    issue?: string;
    suggestion?: string;
    example_from_candidate?: string;
    upgraded_example?: string;
  }>;
  comparative_note?: string;
};

export type CriterionFeedback = {
  criterion: string;
  label: string;
  band: number;
  score_justification: string;
  issue_found?: string;
  area_of_improvement: string;
  example?: string;
};

export type Scorecard = {
  overall_band: number;
  criteria: Record<string, CriterionScore>;
};

export type AssessmentReport = {
  spoken_overview?: string;
  criteria_feedback?: CriterionFeedback[];
  final_summary?: string;
  focus_criterion?: string;
  next_steps?: string[];
};

export type PartScore = {
  part: SpeakingPart;
  scorecard: Scorecard;
  coaching?: Record<string, unknown>;
  raw_transcript?: Record<string, unknown>;
  candidate_text?: string | null;
};

export type ScoreAssessmentResponse = {
  // Overall (average of the parts) — used for the headline display.
  scorecard?: Scorecard;
  // Per-part breakdown — persisted as one row per part (Part 1/2/3).
  by_part?: PartScore[];
  report?: AssessmentReport;
  notes?: Record<string, unknown>;
  transcript_chars?: number;
  error?: string;
};

type RequestOptions = RequestInit & {
  query?: Record<string, string>;
};

function apiUrl(path: string, query?: Record<string, string>) {
  // Edge function exposes routes flat (no /api prefix); strip it when routing there.
  const finalPath = USE_EDGE ? path.replace(/^\/api/, "") : path;
  const url = new URL(`${API_BASE_URL}${finalPath}`, window.location.origin);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return API_BASE_URL ? url.toString() : `${url.pathname}${url.search}`;
}

async function authHeaders(): Promise<Record<string, string>> {
  if (!USE_EDGE) return {};
  const headers: Record<string, string> = {};
  if (SUPABASE_KEY) headers.apikey = SUPABASE_KEY;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? SUPABASE_KEY;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    if (SUPABASE_KEY) headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  }
  return headers;
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { query, headers, ...init } = options;
  const auth = await authHeaders();
  const response = await fetch(apiUrl(path, query), {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...auth,
      ...headers,
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message =
      typeof data?.error === "string" ? data.error : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data as T;
}

export function getAssessmentHealth() {
  return requestJson<AssessmentHealth>("/api/health");
}

export function startAssessment(body: { username: string; parts: SpeakingPart[] }) {
  return requestJson<StartAssessmentResponse>("/api/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function endAssessment(conversationId: string) {
  return requestJson<{ ok: true }>("/api/end", {
    query: { cid: conversationId },
  });
}

export function scoreAssessment(conversationId: string) {
  return requestJson<ScoreAssessmentResponse>("/api/score", {
    query: { cid: conversationId },
  });
}

export function getAssessmentTranscript(conversationId: string) {
  return requestJson<Record<string, unknown>>("/api/transcript", {
    query: { cid: conversationId },
  });
}
