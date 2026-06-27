import { supabase } from "@/integrations/supabase/client";

const CUSTOM_API = (import.meta.env.VITE_ASSESSMENT_API_URL ?? "").replace(/\/$/, "");
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/** Use Supabase edge function on deployed Lovable; local /api proxy in dev. */
function useEdgeFunction() {
  if (CUSTOM_API) return false;
  if (import.meta.env.VITE_USE_ASSESSMENT_EDGE === "false") return false;
  return Boolean(SUPABASE_URL && typeof window !== "undefined");
}

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
  scorecard?: Scorecard;
  by_part?: PartScore[];
  report?: AssessmentReport;
  notes?: Record<string, unknown>;
  transcript_chars?: number;
  error?: string;
};

type RequestOptions = RequestInit & {
  query?: Record<string, string>;
};

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (useEdgeFunction() && SUPABASE_KEY) {
    headers.apikey = SUPABASE_KEY;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function apiUrl(path: string, query?: Record<string, string>) {
  if (useEdgeFunction()) {
    const suffix = path.replace(/^\/api/, "");
    const url = new URL(`${SUPABASE_URL}/functions/v1/assessment${suffix}`);
    Object.entries(query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
    return url.toString();
  }

  const base = CUSTOM_API || "";
  const url = new URL(`${base}${path}`, window.location.origin);
  Object.entries(query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return base ? url.toString() : `${url.pathname}${url.search}`;
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { query, headers, ...init } = options;
  const response = await fetch(apiUrl(path, query), {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(await authHeaders()),
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
