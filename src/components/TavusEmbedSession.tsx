import * as React from "react";
import { Loader2, Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TavusEmbedPanel, type TavusEmbedPanelHandle } from "@/components/TavusEmbedPanel";
import {
  endAssessment,
  getAssessmentTranscript,
  scoreAssessment,
  type ScoreAssessmentResponse,
  type SpeakingPart,
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
  parts?: SpeakingPart[];
  mode?: "exam" | "practice";
};

function criterionLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function TavusEmbedSession({
  title,
  description,
  username,
  userId,
  parts = [1, 2, 3],
  mode = "exam",
}: TavusEmbedSessionProps) {
  const embedRef = React.useRef<TavusEmbedPanelHandle>(null);
  const [conversationId, setConversationId] = React.useState("");
  const [mockSessionId, setMockSessionId] = React.useState("");
  const [status, setStatus] = React.useState("Allow camera and microphone when prompted.");
  const [score, setScore] = React.useState<ScoreAssessmentResponse | null>(null);
  const [error, setError] = React.useState("");
  const [saveMessage, setSaveMessage] = React.useState("");
  const [isBusy, setIsBusy] = React.useState(false);
  const [embedReady, setEmbedReady] = React.useState(false);

  const context = React.useMemo(() => {
    const who = username ? ` Candidate: ${username}.` : "";
    return `IELTS Speaking ${mode} mode.${who} Run the full speaking test with examiner Mary.`;
  }, [username, mode]);

  const onConversationStarted = React.useCallback(
    async (id: string) => {
      setConversationId(id);
      setStatus("Live with Mary — your IELTS examiner.");
      setScore(null);
      setError("");

      if (!userId) return;
      try {
        const savedId = await createMockSession({
          userId,
          parts,
          conversation: { conversation_id: id, conversation_url: "" },
        });
        setMockSessionId(savedId);
      } catch (saveError) {
        setSaveMessage(`Session live, but saving failed: ${renderErrorMessage(saveError)}`);
      }
    },
    [userId, parts],
  );

  const scoreConversation = async (cid: string) => {
    const result = await scoreAssessment(cid, parts);
    if (result.error) throw new Error(result.error);
    setScore(result);
    setStatus("Your band score is ready.");

    if (userId && mockSessionId && result.scorecard) {
      try {
        let rawTranscript: Record<string, unknown> | undefined;
        try {
          rawTranscript = await getAssessmentTranscript(cid);
        } catch {
          rawTranscript = undefined;
        }
        await saveAssessmentArtifacts({
          userId,
          mockSessionId,
          conversationId: cid,
          parts,
          score: result,
          rawTranscript,
        });
        setSaveMessage("Score saved to your profile.");
      } catch (saveError) {
        setSaveMessage(`Score ready, but saving failed: ${renderErrorMessage(saveError)}`);
      }
    }
    return result;
  };

  const stopAndScore = async () => {
    setIsBusy(true);
    setError("");
    setSaveMessage("");
    setStatus("Stopping session…");

    try {
      embedRef.current?.endConversation();

      if (conversationId) {
        try {
          await endAssessment(conversationId);
        } catch {
          // Embed may already have ended the call; backend end is best-effort.
        }
        if (mockSessionId) {
          try {
            await markMockSessionEnded(mockSessionId);
          } catch (saveError) {
            setSaveMessage(`Call ended, but status save failed: ${renderErrorMessage(saveError)}`);
          }
        }

        setStatus("Scoring your answers…");
        await scoreConversation(conversationId);
      } else {
        setStatus("Session stopped. Start speaking with Mary to receive a score.");
      }
    } catch (cause) {
      setError(renderErrorMessage(cause));
      setStatus("Could not score yet — try again in a few seconds.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>

      <Card className="border-border/70 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Mic aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p role="status" aria-live="polite">
              {status}
              {conversationId && !score ? (
                <span className="mt-1 block text-xs opacity-70">Session: {conversationId}</span>
              ) : null}
            </p>
          </div>
          <Button
            variant="destructive"
            size="lg"
            className="w-full shrink-0 sm:w-auto"
            onClick={stopAndScore}
            disabled={!embedReady || isBusy}
          >
            {isBusy ? (
              <>
                <Loader2 aria-hidden className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                Scoring…
              </>
            ) : (
              <>
                <Square aria-hidden className="mr-2 h-4 w-4" />
                Stop &amp; get score
              </>
            )}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </Card>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {saveMessage ? (
        <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {saveMessage}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border bg-black">
        <TavusEmbedPanel
          ref={embedRef}
          conversationalContext={context}
          onReady={() => setEmbedReady(true)}
          onConversationStarted={onConversationStarted}
          onConversationEnded={() => {
            if (!isBusy) setStatus("Session ended.");
          }}
        />
      </div>

      {score?.scorecard ? (
        <Card className="border-border/70 p-5">
          <h2 className="text-lg font-semibold tracking-tight">Your band score</h2>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Overall band</div>
              <div className="text-4xl font-semibold tracking-tight">
                {score.scorecard.overall_band.toFixed(1)}
              </div>
            </div>
            {score.transcript_chars ? (
              <div className="text-sm text-muted-foreground">
                {score.transcript_chars} transcript characters scored
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(score.scorecard.criteria).map(([key, value]) => (
              <div key={key} className="rounded-md border border-border bg-background p-3">
                <div className="text-xs text-muted-foreground">{criterionLabel(key)}</div>
                <div className="mt-1 text-xl font-semibold">{Number(value.band).toFixed(1)}</div>
                {value.rationale ? (
                  <p className="mt-2 line-clamp-4 text-xs text-muted-foreground">
                    {value.rationale}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          {score.report?.spoken_overview ? (
            <p className="mt-5 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              {score.report.spoken_overview}
            </p>
          ) : null}
          {score.report?.final_summary ? (
            <p className="mt-3 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              {score.report.final_summary}
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
