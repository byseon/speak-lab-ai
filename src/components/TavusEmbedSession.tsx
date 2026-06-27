import * as React from "react";
import { Loader2, Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TavusEmbedPanel } from "@/components/TavusEmbedPanel";
import {
  endAssessment,
  getAssessmentTranscript,
  scoreAssessment,
  type ScoreAssessmentResponse,
} from "@/lib/assessment-api";
import {
  createMockSession,
  markMockSessionEnded,
  saveAssessmentArtifacts,
} from "@/lib/assessment-storage";

type TavusEmbedSessionProps = {
  title: string;
  description: string;
  /** Shown in conversational-context when set (e.g. candidate name). */
  username?: string;
  /** Authenticated user id — required to persist the session to Supabase. */
  userId?: string;
  mode?: "exam" | "practice";
};

export function TavusEmbedSession({
  title,
  description,
  username,
  userId,
  mode = "exam",
}: TavusEmbedSessionProps) {
  const [conversationId, setConversationId] = React.useState("");
  const [mockSessionId, setMockSessionId] = React.useState("");
  const [score, setScore] = React.useState<ScoreAssessmentResponse | null>(null);
  const [status, setStatus] = React.useState("Allow camera and microphone when prompted.");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const context = React.useMemo(() => {
    const who = username ? ` Candidate: ${username}.` : "";
    return `IELTS Speaking ${mode} mode.${who} Run the full speaking test with examiner Mary.`;
  }, [username, mode]);

  const handleStop = React.useCallback(async () => {
    if (!conversationId) return;
    setBusy(true);
    setError("");
    setStatus("Ending the call…");
    try {
      await endAssessment(conversationId);
      if (mockSessionId) {
        try {
          await markMockSessionEnded(mockSessionId);
        } catch {
          /* non-fatal */
        }
      }
      for (let attempt = 1; attempt <= 8; attempt += 1) {
        setStatus(`Waiting for transcript… ${attempt * 4}s`);
        await new Promise((r) => setTimeout(r, 4000));
        try {
          const result = await scoreAssessment(conversationId);
          if (result.error) throw new Error(result.error);
          setScore(result);
          setStatus("Score ready.");
          if (userId && mockSessionId) {
            let raw: Record<string, unknown> | undefined;
            try {
              raw = await getAssessmentTranscript(conversationId);
            } catch {
              raw = undefined;
            }
            try {
              await saveAssessmentArtifacts({
                userId,
                mockSessionId,
                conversationId,
                parts: [1, 2, 3],
                score: result,
                rawTranscript: raw,
              });
            } catch (e) {
              setError(`Score ready but saving failed: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
          return;
        } catch (e) {
          if (attempt === 8) throw e;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not score the session.");
      setStatus("Transcript still processing — try again in a few seconds.");
    } finally {
      setBusy(false);
    }
  }, [conversationId, mockSessionId, userId]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>

      <Card className="border-border/70 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Mic aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p role="status" aria-live="polite">
              {status}
              {conversationId ? (
                <span className="mt-1 block text-xs opacity-70">Session: {conversationId}</span>
              ) : null}
            </p>
          </div>
          {conversationId ? (
            <Button onClick={handleStop} disabled={busy} className="w-full sm:w-auto">
              {busy ? (
                <Loader2 aria-hidden className="mr-2 h-4 w-4 motion-safe:animate-spin" />
              ) : (
                <Square aria-hidden className="mr-2 h-4 w-4" />
              )}
              Stop &amp; get score
            </Button>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </Card>

      <div className="overflow-hidden rounded-lg border border-border bg-black">
        <TavusEmbedPanel
          conversationalContext={context}
          onConversationStarted={async (id) => {
            setConversationId(id);
            setScore(null);
            setError("");
            setStatus("Live with Mary — your IELTS examiner.");
            if (userId) {
              try {
                const saved = await createMockSession({
                  userId,
                  parts: [1, 2, 3],
                  conversation: { conversation_id: id, conversation_url: "" },
                });
                setMockSessionId(saved);
              } catch {
                /* non-fatal: scoring still works, just won't persist */
              }
            }
          }}
          onConversationEnded={() => {
            setStatus("Session ended. Your conversation was saved by Tavus.");
          }}
        />
      </div>

      {score?.scorecard ? (
        <Card className="border-border/70 p-5">
          <div className="text-sm text-muted-foreground">Overall band</div>
          <div className="text-4xl font-semibold tracking-tight">
            {score.scorecard.overall_band.toFixed(1)}
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {Object.entries(score.scorecard.criteria).map(([key, value]) => (
              <div key={key} className="rounded-md border border-border bg-background p-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {key.replace(/_/g, " ")}
                </dt>
                <dd className="mt-1 text-2xl font-semibold">{Number(value.band).toFixed(1)}</dd>
              </div>
            ))}
          </dl>
          {score.report?.final_summary ? (
            <p className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              {score.report.final_summary}
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
