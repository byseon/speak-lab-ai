// Production scoring endpoint backing TavusEmbedSession / LiveAssessmentSession.
// Mirrors the contract in backend/examples/live_demo.py:
//   GET /health
//   GET /end?cid=<conversation_id>
//   GET /score?cid=<conversation_id>
//   GET /transcript?cid=<conversation_id>
//
// Scoring is a lightweight TypeScript port of backend/src/assessment/quickscore.py:
// real lexical + grammar signals from the candidate transcript; fluency &
// pronunciation are honest placeholders (need audio + alignment).

const TAVUS_BASE = "https://tavusapi.com/v2";
const TAVUS_API_KEY = Deno.env.get("TAVUS_API_KEY") ?? "";
const TAVUS_PAL_ID = Deno.env.get("TAVUS_PAL_ID") ?? "";
const TAVUS_FACE_ID = Deno.env.get("TAVUS_FACE_ID") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function tavus(method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${TAVUS_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": TAVUS_API_KEY,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Tavus ${method} ${path} failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : {};
}

const TRANSCRIPT_KEYS = [
  "transcript",
  "transcripts",
  "messages",
  "conversation_history",
  "conversation",
  "turns",
  "utterances",
];

function textValue(value: any): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.map(textValue).filter(Boolean).join(" ").trim();
  }
  if (value && typeof value === "object") {
    for (const key of ["content", "text", "transcript", "message"]) {
      const out = textValue(value[key]);
      if (out) return out;
    }
  }
  return "";
}

function roleValue(value: any): string {
  return String(value?.role ?? value?.speaker ?? value?.type ?? "").toLowerCase();
}

function isCandidateRole(role: string): boolean {
  const normalized = role.trim().toLowerCase();
  const candidateRoles = new Set([
    "user",
    "candidate",
    "participant",
    "human",
    "customer",
    "caller",
    "student",
    "guest",
    "speaker_0",
    "speaker 0",
  ]);
  const examinerRoles = new Set([
    "assistant",
    "system",
    "examiner",
    "agent",
    "replica",
    "ai",
    "bot",
    "pal",
    "speaker_1",
    "speaker 1",
  ]);

  if (candidateRoles.has(normalized)) return true;
  if (examinerRoles.has(normalized)) return false;
  return Boolean(
    normalized && !Array.from(examinerRoles).some((marker) => normalized.includes(marker)),
  );
}

function coerceMessages(value: any): Array<{ role: string; content: string }> {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item && typeof item === "object")
      .map((item) => ({ role: roleValue(item), content: textValue(item) }))
      .filter((item) => item.role && item.content);
  }

  if (value && typeof value === "object") {
    const role = roleValue(value);
    const content = textValue(value);
    if (role && content) return [{ role, content }];
  }
  return [];
}

function findTranscriptMessages(value: any): Array<{ role: string; content: string }> {
  if (!value || typeof value !== "object") return [];

  for (const key of TRANSCRIPT_KEYS) {
    const messages = coerceMessages(value[key]);
    if (messages.length) return messages;
  }

  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object") {
      const messages = findTranscriptMessages(nested);
      if (messages.length) return messages;
    }
  }
  return [];
}

function transcriptMessages(conv: any): Array<{ role: string; content: string }> {
  const events = Array.isArray(conv?.events) ? conv.events : [];
  for (const e of events) {
    if (e?.event_type === "application.transcription_ready") {
      const messages = findTranscriptMessages(e?.properties);
      if (messages.length) return messages;
    }
  }

  const messages = findTranscriptMessages(conv);
  if (messages.length) return messages;

  for (const e of events) {
    const eventMessages = findTranscriptMessages(e?.properties ?? e);
    if (eventMessages.length) return eventMessages;
  }
  return [];
}

function transcriptReady(conv: any): boolean {
  const events = Array.isArray(conv?.events) ? conv.events : [];
  return events.some((e: any) => e?.event_type === "application.transcription_ready");
}

function candidateText(conv: any): string {
  return transcriptMessages(conv)
    .filter((m) => isCandidateRole(m.role) && m.content.trim())
    .map((m) => m.content.trim())
    .join(" ");
}

// ---------------- Scoring ----------------

function tokens(text: string): string[] {
  return text.toLowerCase().match(/[a-z']+/g) ?? [];
}

/** Very simple MTLD approximation: avg run length until type-token ratio falls below 0.72. */
function mtld(words: string[], threshold = 0.72): number {
  if (words.length < 10) return 10;
  let factors = 0;
  let typesSet = new Set<string>();
  let tokenCount = 0;
  for (const w of words) {
    tokenCount += 1;
    typesSet.add(w);
    const ttr = typesSet.size / tokenCount;
    if (ttr <= threshold) {
      factors += 1;
      typesSet = new Set();
      tokenCount = 0;
    }
  }
  if (tokenCount > 0) {
    const ttr = typesSet.size / tokenCount;
    factors += (1 - ttr) / (1 - threshold);
  }
  return factors > 0 ? words.length / factors : words.length;
}

const BASIC_OVERUSE = new Set([
  "good",
  "bad",
  "nice",
  "thing",
  "things",
  "stuff",
  "very",
  "really",
  "a lot",
  "lots",
  "get",
  "got",
  "do",
  "make",
]);

const SUBORDINATORS = new Set([
  "because",
  "although",
  "though",
  "while",
  "whereas",
  "if",
  "unless",
  "when",
  "whenever",
  "since",
  "after",
  "before",
  "until",
  "as",
  "that",
  "which",
  "who",
  "whom",
  "whose",
  "where",
]);

const MODALS = new Set([
  "can",
  "could",
  "may",
  "might",
  "shall",
  "should",
  "will",
  "would",
  "must",
  "ought",
]);

function half(x: number): number {
  return Math.max(4.0, Math.min(8.5, Math.round(x * 2) / 2));
}

type Criterion =
  "fluency_coherence" | "lexical_resource" | "grammatical_range_accuracy" | "pronunciation";

function scoreTranscript(text: string) {
  const words = tokens(text);
  const lowerText = ` ${text.toLowerCase()} `;

  // Lexical resource
  const lex = mtld(words);
  const overused = Array.from(BASIC_OVERUSE).filter((w) => lowerText.includes(` ${w} `));
  const lr = 5.0 + Math.min(2.5, lex / 30) - 0.4 * overused.length;

  // Grammar
  const subCount = words.filter((w) => SUBORDINATORS.has(w)).length;
  const sentences = Math.max(1, (text.match(/[.!?]+/g) ?? []).length);
  const subRatio = subCount / sentences;
  const usesModality = words.some((w) => MODALS.has(w));
  const gra = 5.0 + 3 * Math.min(1, subRatio) + (usesModality ? 0.5 : 0);

  const criteria: Record<Criterion, { band: number; rationale: string; evidence: string[] }> = {
    lexical_resource: {
      band: half(lr),
      rationale: `MTLD ${lex.toFixed(1)}; ${overused.length} overused basic items.`,
      evidence: overused.slice(0, 5),
    },
    grammatical_range_accuracy: {
      band: half(gra),
      rationale: `Subordination ratio ${subRatio.toFixed(2)}; modality ${usesModality ? "present" : "absent"}.`,
      evidence: [],
    },
    fluency_coherence: {
      band: 6.0,
      rationale: "Placeholder — needs audio + word timings.",
      evidence: [],
    },
    pronunciation: {
      band: 6.0,
      rationale: "Placeholder — needs audio + alignment.",
      evidence: [],
    },
  };

  const overall = half(
    (criteria.lexical_resource.band +
      criteria.grammatical_range_accuracy.band +
      criteria.fluency_coherence.band +
      criteria.pronunciation.band) /
      4,
  );

  return {
    overall_band: overall,
    criteria,
    mtld: lex,
    overused,
  };
}

function splitChunks(messages: string[], parts: number[], full: string): string[] {
  if (!parts.length) return [];
  if (messages.length >= parts.length) {
    const chunks: string[][] = parts.map(() => []);
    for (let i = 0; i < messages.length; i += 1) {
      const idx = Math.min(Math.floor((i * parts.length) / messages.length), parts.length - 1);
      chunks[idx].push(messages[i]);
    }
    return chunks.map((c) => c.join(" ").trim());
  }
  const words = (full || messages.join(" ")).split(/\s+/).filter(Boolean);
  if (!words.length) return parts.map(() => "");
  const size = Math.max(1, Math.ceil(words.length / parts.length));
  return parts.map(
    (_p, i) =>
      words
        .slice(i * size, (i + 1) * size)
        .join(" ")
        .trim() || full,
  );
}

function scoreConversationFromConv(conv: any, selectedParts: number[]) {
  const text = candidateText(conv);
  if (!text) {
    if (!transcriptReady(conv)) {
      return {
        error: "transcript not ready yet — try again in a few seconds.",
      };
    }
    return { error: "no candidate speech found in the transcript." };
  }

  const parts = selectedParts.length ? selectedParts : [1, 2, 3];
  const score = scoreTranscript(text);

  // Build scorecard shape consumed by the UI
  const scorecard = {
    overall_band: score.overall_band,
    criteria: Object.fromEntries(
      Object.entries(score.criteria).map(([k, v]) => [
        k,
        {
          band: v.band,
          criterion: k,
          rationale: v.rationale,
          evidence: v.evidence,
        },
      ]),
    ),
  };

  const report = {
    spoken_overview: `Overall band ${score.overall_band.toFixed(1)} based on transcript-only analysis.`,
    final_summary:
      "Lexical and grammar bands are derived from your transcript. Fluency and pronunciation are placeholders until audio-level scoring is wired in.",
    criteria_feedback: Object.entries(scorecard.criteria).map(([k, v]) => ({
      criterion: k,
      label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      band: v.band as number,
      score_justification: (v as any).rationale ?? "",
      area_of_improvement:
        k === "lexical_resource"
          ? "Vary basic vocabulary; introduce topic-specific collocations."
          : k === "grammatical_range_accuracy"
            ? "Use more complex sentences with subordination and modal verbs."
            : "Practice with audio-enabled scoring for targeted feedback.",
    })),
  };

  // Per-part breakdown — same shape as the Python backend
  const userMessages = transcriptMessages(conv)
    .filter((m) => isCandidateRole(m.role) && m.content.trim())
    .map((m) => m.content.trim());
  const chunks = splitChunks(userMessages, parts, text);
  const by_part = parts.map((p, i) => {
    const chunk = chunks[i] || text;
    const partScore = scoreTranscript(chunk);
    return {
      part: p,
      scorecard: {
        overall_band: partScore.overall_band,
        criteria: Object.fromEntries(
          Object.entries(partScore.criteria).map(([k, v]) => [
            k,
            { band: v.band, criterion: k, rationale: v.rationale, evidence: v.evidence },
          ]),
        ),
      },
      coaching: { report, notes: { mtld: partScore.mtld, overused: partScore.overused } },
      raw_transcript: {
        candidate_text: chunk,
        source: "tavus_transcript_chunk",
        selected_parts: parts,
      },
      candidate_text: chunk,
    };
  });

  return {
    scorecard,
    report,
    by_part,
    notes: {
      real_criteria: ["lexical_resource", "grammatical_range_accuracy"],
      placeholder_criteria: {
        fluency_coherence: "needs audio (recording + alignment) — placeholder",
        pronunciation: "needs audio (recording + alignment) — placeholder",
      },
      mtld: score.mtld,
      overused: score.overused,
    },
    transcript_chars: text.length,
  };
}

// ---------------- HTTP ----------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  // Match trailing path segment regardless of mount prefix.
  const path = url.pathname.replace(/^.*\/assessment/, "");
  const cid = url.searchParams.get("cid") ?? "";

  try {
    if (req.method === "GET" && (path === "/health" || path === "" || path === "/")) {
      const configured = {
        TAVUS_API_KEY: !!TAVUS_API_KEY,
        TAVUS_PAL_ID: !!TAVUS_PAL_ID,
        TAVUS_FACE_ID: !!TAVUS_FACE_ID,
      };
      return json(200, {
        ok: Object.values(configured).every(Boolean),
        configured,
        missing: Object.entries(configured)
          .filter(([, v]) => !v)
          .map(([k]) => k),
      });
    }

    if (!TAVUS_API_KEY) {
      return json(500, { error: "TAVUS_API_KEY is not configured on the server." });
    }

    if (req.method === "GET" && path === "/transcript") {
      if (!cid) return json(400, { error: "missing cid" });
      const conv = await tavus("GET", `/conversations/${cid}?verbose=true`);
      return json(200, conv);
    }

    if (req.method === "GET" && path === "/end") {
      if (!cid) return json(400, { error: "missing cid" });
      await tavus("POST", `/conversations/${cid}/end`);
      return json(200, { ok: true });
    }

    if (req.method === "GET" && path === "/score") {
      if (!cid) return json(400, { error: "missing cid" });
      const conv = await tavus("GET", `/conversations/${cid}?verbose=true`);
      const partsParam = url.searchParams.get("parts");
      const parts = partsParam
        ? partsParam
            .split(",")
            .map((p) => parseInt(p, 10))
            .filter((p) => [1, 2, 3].includes(p))
        : [1, 2, 3];
      const out = scoreConversationFromConv(conv, parts);
      return json(200, out);
    }

    return json(404, { error: `not found: ${req.method} ${path}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json(400, { error: message });
  }
});
