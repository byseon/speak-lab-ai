// Tavus CVI edge function — single endpoint with path routing.
// POST /tavus/start                       -> create conversation + mock_sessions row
// POST /tavus/end                         -> end conversation + update session
// GET  /tavus/transcript?conversation_id  -> fetch verbose conversation
//
// Secrets required: TAVUS_API_KEY, TAVUS_FACE_ID. TAVUS_PAL_ID has a default.
// Mirrors backend/src/assessment/pal.py build_conversation_payload.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const TAVUS_BASE = "https://tavusapi.com/v2";

const EXAMINER_GREETING =
  "Hello, I'm Aria, and I'll be your examiner today for this IELTS speaking practice. Before we begin, could you tell me your full name, please?";
const DOCUMENT_TAGS = ["ielts-rubric", "ielts-questions"];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function partName(p: number): string {
  return `Part ${p}`;
}

function buildConversationPayload(opts: {
  palId: string;
  faceId: string;
  username: string;
  parts: number[];
  mode: "exam" | "practice";
  callbackUrl?: string;
}) {
  const ctx =
    `IELTS Speaking practice (${opts.mode} mode). Run ONLY these parts, in order: ` +
    opts.parts.map(partName).join(", ") +
    ".";
  const payload: Record<string, unknown> = {
    pal_id: opts.palId,
    face_id: opts.faceId,
    conversation_name: `IELTS ${opts.mode} — ${opts.username}`,
    conversational_context: ctx,
    custom_greeting: EXAMINER_GREETING,
    document_tags: DOCUMENT_TAGS,
    properties: {
      enable_recording: true,
      enable_closed_captions: true,
      max_call_duration: 1200,
    },
  };
  if (opts.callbackUrl) payload.callback_url = opts.callbackUrl;
  return payload;
}

async function getAuthedUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Missing Authorization header" as const };

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_PUBLISHABLE_KEY =
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return { error: "Server misconfigured: Supabase env missing" as const };
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return { error: "Unauthorized" as const };
  return { user: data.user, sb };
}

async function handleStart(req: Request) {
  const auth = await getAuthedUser(req);
  if ("error" in auth) return json({ error: auth.error }, 401);

  const TAVUS_API_KEY = Deno.env.get("TAVUS_API_KEY");
  const TAVUS_PAL_ID = Deno.env.get("TAVUS_PAL_ID") ?? "pece42dab07f";
  const TAVUS_FACE_ID = Deno.env.get("TAVUS_FACE_ID");
  const TAVUS_CALLBACK_URL = Deno.env.get("TAVUS_CALLBACK_URL") || undefined;

  if (!TAVUS_API_KEY || !TAVUS_FACE_ID) {
    return json(
      {
        error: "missing_config",
        message:
          "Tavus is not fully configured. Add TAVUS_API_KEY and TAVUS_FACE_ID in Project Settings → Secrets.",
      },
      400,
    );
  }

  let body: { parts?: number[]; kind?: "mock" | "practice" } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  const parts =
    Array.isArray(body.parts) && body.parts.length > 0
      ? body.parts.filter((p) => [1, 2, 3].includes(p))
      : [1, 2, 3];
  const kind: "mock" | "practice" = body.kind === "practice" ? "practice" : "mock";
  const mode = kind === "mock" ? "exam" : "practice";

  // Resolve a friendly username from profile.display_name, fallback to email local-part.
  let username = auth.user.email?.split("@")[0] ?? "candidate";
  const { data: profile } = await auth.sb
    .from("profiles")
    .select("display_name")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (profile?.display_name) username = profile.display_name as string;

  const payload = buildConversationPayload({
    palId: TAVUS_PAL_ID,
    faceId: TAVUS_FACE_ID,
    username,
    parts,
    mode,
    callbackUrl: TAVUS_CALLBACK_URL,
  });

  const tavusRes = await fetch(`${TAVUS_BASE}/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": TAVUS_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const tavusJson = await tavusRes.json().catch(() => ({}));
  if (!tavusRes.ok) {
    console.error("[tavus] create conversation failed", tavusRes.status, tavusJson);
    return json(
      { error: "tavus_error", status: tavusRes.status, details: tavusJson },
      502,
    );
  }

  const conversationId =
    (tavusJson.conversation_id as string | undefined) ??
    (tavusJson.id as string | undefined);
  const conversationUrl = tavusJson.conversation_url as string | undefined;

  if (!conversationId || !conversationUrl) {
    return json(
      { error: "tavus_bad_response", details: tavusJson },
      502,
    );
  }

  const { data: session, error: insertErr } = await auth.sb
    .from("mock_sessions")
    .insert({
      user_id: auth.user.id,
      kind,
      status: "in_progress",
      tavus_conversation_id: conversationId,
      metadata: { parts, mode },
    })
    .select("id")
    .single();

  if (insertErr || !session) {
    console.error("[tavus] failed to insert mock_sessions row", insertErr);
    return json({ error: "db_error", details: insertErr?.message }, 500);
  }

  return json({
    conversation_url: conversationUrl,
    conversation_id: conversationId,
    session_id: session.id,
  });
}

async function handleEnd(req: Request) {
  const auth = await getAuthedUser(req);
  if ("error" in auth) return json({ error: auth.error }, 401);

  const TAVUS_API_KEY = Deno.env.get("TAVUS_API_KEY");
  if (!TAVUS_API_KEY) return json({ error: "missing_config" }, 400);

  let body: { session_id?: string; conversation_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* noop */
  }
  if (!body.session_id || !body.conversation_id) {
    return json({ error: "session_id and conversation_id required" }, 400);
  }

  // Best-effort: tell Tavus to end the call.
  const endRes = await fetch(
    `${TAVUS_BASE}/conversations/${body.conversation_id}/end`,
    {
      method: "POST",
      headers: { "x-api-key": TAVUS_API_KEY },
    },
  );
  if (!endRes.ok && endRes.status !== 404) {
    const detail = await endRes.text().catch(() => "");
    console.warn("[tavus] end conversation non-OK", endRes.status, detail);
  }

  // Compute duration from started_at
  const { data: existing } = await auth.sb
    .from("mock_sessions")
    .select("started_at")
    .eq("id", body.session_id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const completedAt = new Date();
  let durationS: number | null = null;
  if (existing?.started_at) {
    durationS = Math.max(
      0,
      Math.floor(
        (completedAt.getTime() - new Date(existing.started_at).getTime()) / 1000,
      ),
    );
  }

  const { error: updErr } = await auth.sb
    .from("mock_sessions")
    .update({
      status: "completed",
      completed_at: completedAt.toISOString(),
      duration_s: durationS,
    })
    .eq("id", body.session_id)
    .eq("user_id", auth.user.id);

  if (updErr) {
    console.error("[tavus] failed to update session", updErr);
    return json({ error: "db_error", details: updErr.message }, 500);
  }

  return json({ ok: true });
}

async function handleTranscript(req: Request, url: URL) {
  const auth = await getAuthedUser(req);
  if ("error" in auth) return json({ error: auth.error }, 401);

  const TAVUS_API_KEY = Deno.env.get("TAVUS_API_KEY");
  if (!TAVUS_API_KEY) return json({ error: "missing_config" }, 400);

  const conversationId = url.searchParams.get("conversation_id");
  if (!conversationId) {
    return json({ error: "conversation_id required" }, 400);
  }

  // Authorize: this conversation must belong to this user via mock_sessions.
  const { data: owned } = await auth.sb
    .from("mock_sessions")
    .select("id")
    .eq("tavus_conversation_id", conversationId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!owned) return json({ error: "not_found" }, 404);

  const tRes = await fetch(
    `${TAVUS_BASE}/conversations/${conversationId}?verbose=true`,
    { headers: { "x-api-key": TAVUS_API_KEY } },
  );
  const tJson = await tRes.json().catch(() => ({}));
  if (!tRes.ok) {
    return json(
      { error: "tavus_error", status: tRes.status, details: tJson },
      502,
    );
  }
  return json(tJson);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  // Path will be like /tavus/start or /functions/v1/tavus/start — match suffix.
  const path = url.pathname.replace(/^.*\/tavus/, "") || "/";

  try {
    if (req.method === "POST" && path === "/start") return await handleStart(req);
    if (req.method === "POST" && path === "/end") return await handleEnd(req);
    if (req.method === "GET" && path === "/transcript")
      return await handleTranscript(req, url);
    return json({ error: "not_found", path }, 404);
  } catch (err) {
    console.error("[tavus] unhandled error", err);
    return json(
      { error: "internal_error", message: (err as Error).message },
      500,
    );
  }
});