/**
 * Assessment API for production (Lovable Cloud).
 * Mirrors backend/examples/live_demo.py — end + score Tavus conversations.
 *
 * Routes (path suffix after /functions/v1/assessment):
 *   GET /health
 *   GET /end?cid=
 *   GET /score?cid=
 *   GET /transcript?cid=
 *
 * Secrets: TAVUS_API_KEY
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TAVUS_BASE = "https://tavusapi.com/v2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function tavusKey(): string {
  return Deno.env.get("TAVUS_API_KEY") ?? "";
}

async function tavusGet(path: string): Promise<Record<string, unknown>> {
  const key = tavusKey();
  if (!key) throw new Error("TAVUS_API_KEY not configured");
  const res = await fetch(`${TAVUS_BASE}${path}`, {
    headers: { "x-api-key": key },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof (data as { message?: string }).message === "string"
        ? (data as { message: string }).message
        : `Tavus error ${res.status}`,
    );
  }
  return data as Record<string, unknown>;
}

async function tavusPost(path: string): Promise<void> {
  const key = tavusKey();
  if (!key) throw new Error("TAVUS_API_KEY not configured");
  const res = await fetch(`${TAVUS_BASE}${path}`, {
    method: "POST",
    headers: { "x-api-key": key },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Tavus end failed (${res.status})`);
  }
}

type TranscriptMsg = { role?: string; content?: string };

function transcriptMessages(conv: Record<string, unknown>): TranscriptMsg[] {
  const events = (conv.events as Array<Record<string, unknown>>) ?? [];
  for (const e of events) {
    if (e.event_type === "application.transcription_ready") {
      const props = e.properties as Record<string, unknown> | undefined;
      return (props?.transcript as TranscriptMsg[]) ?? [];
    }
  }
  return [];
}

function candidateText(conv: Record<string, unknown>): string {
  return transcriptMessages(conv)
    .filter((m) => m.role === "user" && typeof m.content === "string" && m.content.trim())
    .map((m) => m.content!.trim())
    .join(" ");
}

function transcriptReady(conv: Record<string, unknown>): boolean {
  const events = (conv.events as Array<Record<string, unknown>>) ?? [];
  return events.some((e) => e.event_type === "application.transcription_ready");
}

function ieltsHalfBand(value: number): number {
  return Math.max(4, Math.min(8.5, Math.round(value * 2) / 2));
}

/** Transcript-only quick score (matches backend quickscore.py intent). */
function scoreTranscript(text: string) {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  const unique = new Set(words);
  const mtldProxy = words.length ? (unique.size / words.length) * 50 : 0;
  const lexical = ieltsHalfBand(5 + Math.min(2.5, mtldProxy / 30));
  const grammar = ieltsHalfBand(words.length > 80 ? 6.5 : words.length > 40 ? 6 : 5.5);
  const fluency = 6;
  const pronunciation = 6;

  const criteria = {
    fluency_coherence: {
      band: fluency,
      rationale: "Estimated from transcript length; full fluency scoring needs audio.",
    },
    lexical_resource: {
      band: lexical,
      rationale: `Vocabulary diversity proxy from ${words.length} words (${unique.size} unique).`,
    },
    grammatical_range_accuracy: {
      band: grammar,
      rationale: `Grammar proxy from response length (${words.length} words).`,
    },
    pronunciation: {
      band: pronunciation,
      rationale: "Placeholder — pronunciation needs audio analysis.",
    },
  };

  const overall = ieltsHalfBand(
    (fluency + lexical + grammar + pronunciation) / 4,
  );

  const scorecard = { overall_band: overall, criteria };

  return {
    scorecard,
    by_part: [
      {
        part: 2 as const,
        scorecard,
        candidate_text: text,
      },
    ],
    report: {
      spoken_overview: `You spoke ${words.length} words across your session. Lexical and grammar bands are estimated from your transcript; fluency and pronunciation will improve once audio scoring is wired up.`,
    },
    notes: {
      real_criteria: ["lexical_resource", "grammatical_range_accuracy"],
      placeholder_criteria: ["fluency_coherence", "pronunciation"],
    },
    transcript_chars: text.length,
  };
}

function health() {
  const hasKey = Boolean(tavusKey());
  return {
    ok: hasKey,
    configured: { TAVUS_API_KEY: hasKey },
    missing: hasKey ? [] : ["TAVUS_API_KEY"],
  };
}

async function handleScore(cid: string) {
  const conv = await tavusGet(`/conversations/${cid}?verbose=true`);
  const text = candidateText(conv);
  if (!text) {
    if (!transcriptReady(conv)) {
      return json({
        error:
          "Transcript not ready yet — wait ~10–20s after ending the call, then try again.",
      });
    }
    return json({ error: "No candidate speech found in the transcript." });
  }
  return json(scoreTranscript(text));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/assessment/, "") || "/";

  try {
    if (req.method === "GET" && path === "/health") {
      return json(health());
    }

    const cid = url.searchParams.get("cid") ?? "";

    if (req.method === "GET" && path === "/end") {
      if (!cid) return json({ error: "cid required" }, 400);
      await tavusPost(`/conversations/${cid}/end`);
      return json({ ok: true });
    }

    if (req.method === "GET" && path === "/score") {
      if (!cid) return json({ error: "cid required" }, 400);
      return await handleScore(cid);
    }

    if (req.method === "GET" && path === "/transcript") {
      if (!cid) return json({ error: "cid required" }, 400);
      const conv = await tavusGet(`/conversations/${cid}?verbose=true`);
      return json(conv);
    }

    return json({ error: "not_found", path }, 404);
  } catch (err) {
    console.error("[assessment]", err);
    return json(
      { error: err instanceof Error ? err.message : "internal_error" },
      500,
    );
  }
});
