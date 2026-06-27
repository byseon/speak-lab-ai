const API_BASE_URL = (import.meta.env.VITE_ASSESSMENT_API_URL ?? "").replace(/\/$/, "");

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
  rationale?: string;
  evidence?: string[];
};

export type Scorecard = {
  overall_band: number;
  criteria: Record<string, CriterionScore>;
};

export type AssessmentReport = {
  spoken_overview?: string;
  focus_criterion?: string;
  next_steps?: string[];
};

export type ScoreAssessmentResponse = {
  scorecard?: Scorecard;
  report?: AssessmentReport;
  notes?: Record<string, unknown>;
  transcript_chars?: number;
  error?: string;
};

type RequestOptions = RequestInit & {
  query?: Record<string, string>;
};

function apiUrl(path: string, query?: Record<string, string>) {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return API_BASE_URL ? url.toString() : `${url.pathname}${url.search}`;
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { query, headers, ...init } = options;
  const response = await fetch(apiUrl(path, query), {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
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
