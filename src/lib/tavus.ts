import { supabase } from "@/integrations/supabase/client";

export type TavusPart = 1 | 2 | 3;
export type SessionKind = "mock" | "practice";

export interface StartResponse {
  conversation_url: string;
  conversation_id: string;
  session_id: string;
}

export interface TavusError {
  error: string;
  message?: string;
}

async function invoke<T>(
  path: "start" | "end" | "transcript",
  init: { method: "GET" | "POST"; body?: unknown; query?: Record<string, string> },
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const baseUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, "");
  const url = new URL(`${baseUrl}/functions/v1/tavus/${path}`);
  if (init.query) {
    Object.entries(init.query).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  const json = (await res.json().catch(() => ({}))) as T & Partial<TavusError>;
  if (!res.ok) {
    const err = json as TavusError;
    const message = err.message ?? err.error ?? `Tavus request failed (${res.status})`;
    const e = new Error(message) as Error & { code?: string };
    e.code = err.error;
    throw e;
  }
  return json as T;
}

export function startConversation(opts: { parts?: TavusPart[]; kind?: SessionKind }) {
  return invoke<StartResponse>("start", { method: "POST", body: opts });
}

export function endConversation(opts: { session_id: string; conversation_id: string }) {
  return invoke<{ ok: true }>("end", { method: "POST", body: opts });
}

export function fetchTranscript(conversationId: string) {
  return invoke<Record<string, unknown>>("transcript", {
    method: "GET",
    query: { conversation_id: conversationId },
  });
}
