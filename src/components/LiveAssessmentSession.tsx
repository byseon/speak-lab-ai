import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mic,
  Play,
  RotateCcw,
  Square,
  Target,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  endAssessment,
  getAssessmentTranscript,
  getAssessmentHealth,
  scoreAssessment,
  startAssessment,
  type AssessmentHealth,
  type ScoreAssessmentResponse,
  type SpeakingPart,
} from "@/lib/assessment-api";
import {
  createMockSession,
  markMockSessionEnded,
  saveAssessmentArtifacts,
} from "@/lib/assessment-storage";

type LiveAssessmentSessionProps = {
  username: string;
  userId?: string;
  title: string;
  description: string;
  defaultParts: SpeakingPart[];
};

const partOptions: Array<{ value: SpeakingPart; label: string }> = [
  { value: 1, label: "Part 1" },
  { value: 2, label: "Part 2" },
  { value: 3, label: "Part 3" },
];

function criterionLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function LiveAssessmentSession({
  username,
  userId,
  title,
  description,
  defaultParts,
}: LiveAssessmentSessionProps) {
  const [health, setHealth] = React.useState<AssessmentHealth | null>(null);
  const [parts, setParts] = React.useState<SpeakingPart[]>(defaultParts);
  const [conversationId, setConversationId] = React.useState("");
  const [conversationUrl, setConversationUrl] = React.useState("");
  const [mockSessionId, setMockSessionId] = React.useState("");
  const [score, setScore] = React.useState<ScoreAssessmentResponse | null>(null);
  const [status, setStatus] = React.useState("Checking backend...");
  const [error, setError] = React.useState("");
  const [saveMessage, setSaveMessage] = React.useState("");
  const [isBusy, setIsBusy] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    getAssessmentHealth()
      .then((result) => {
        if (!active) return;
        setHealth(result);
        setStatus(result.ok ? "Backend ready" : "Backend needs Tavus configuration");
      })
      .catch((cause) => {
        if (!active) return;
        setStatus("Backend not reachable");
        setError(renderErrorMessage(cause));
      });

    return () => {
      active = false;
    };
  }, []);

  const togglePart = (part: SpeakingPart) => {
    setParts((current) => {
      if (current.includes(part)) {
        const next = current.filter((value) => value !== part);
        return next.length ? next : current;
      }
      return [...current, part].sort() as SpeakingPart[];
    });
  };

  const start = async () => {
    setIsBusy(true);
    setError("");
    setSaveMessage("");
    setScore(null);
    setStatus("Creating Tavus conversation...");

    try {
      const result = await startAssessment({ username, parts });
      if (!result.conversation_id || !result.conversation_url) {
        throw new Error("Backend did not return a Tavus conversation URL.");
      }
      setConversationId(result.conversation_id);
      setConversationUrl(result.conversation_url);
      if (userId) {
        try {
          const savedId = await createMockSession({
            userId,
            parts,
            conversation: {
              conversation_id: result.conversation_id,
              conversation_url: result.conversation_url,
            },
          });
          setMockSessionId(savedId);
          setSaveMessage("Session saved.");
        } catch (saveError) {
          setSaveMessage(`Session is live, but saving failed: ${renderErrorMessage(saveError)}`);
        }
      }
      setStatus("Conversation live. Allow camera and microphone access.");
    } catch (cause) {
      setError(renderErrorMessage(cause));
      setStatus("Could not start conversation");
    } finally {
      setIsBusy(false);
    }
  };

  const scoreConversation = async () => {
    if (!conversationId) return null;
    const result = await scoreAssessment(conversationId);
    if (result.error) throw new Error(result.error);
    setScore(result);
    setStatus("Score ready");
    if (userId && mockSessionId && result.scorecard) {
      try {
        let rawTranscript: Record<string, unknown> | undefined;
        try {
          rawTranscript = await getAssessmentTranscript(conversationId);
        } catch {
          rawTranscript = undefined;
        }

        await saveAssessmentArtifacts({
          userId,
          mockSessionId,
          conversationId,
          score: result,
          rawTranscript,
        });
        setSaveMessage("Scorecard, transcript, and progress saved.");
      } catch (saveError) {
        setSaveMessage(`Score ready, but saving failed: ${renderErrorMessage(saveError)}`);
      }
    }
    return result;
  };

  const scoreNow = async () => {
    setIsBusy(true);
    setError("");
    setSaveMessage("");
    setStatus("Scoring transcript...");

    try {
      await scoreConversation();
    } catch (cause) {
      setError(renderErrorMessage(cause));
      setStatus("Score not ready");
    } finally {
      setIsBusy(false);
    }
  };

  const endAndScore = async () => {
    if (!conversationId) return;

    setIsBusy(true);
    setError("");
    setSaveMessage("");
    setStatus("Ending the call...");

    try {
      await endAssessment(conversationId);
      if (mockSessionId) {
        try {
          await markMockSessionEnded(mockSessionId);
        } catch (saveError) {
          setSaveMessage(`Call ended, but status save failed: ${renderErrorMessage(saveError)}`);
        }
      }
      for (let attempt = 1; attempt <= 8; attempt += 1) {
        setStatus(`Waiting for transcript... ${attempt * 4}s`);
        await new Promise((resolve) => setTimeout(resolve, 4000));
        try {
          await scoreConversation();
          return;
        } catch (cause) {
          if (attempt === 8) throw cause;
        }
      }
    } catch (cause) {
      setError(renderErrorMessage(cause));
      setStatus("Transcript still processing");
    } finally {
      setIsBusy(false);
    }
  };

  const reset = () => {
    setConversationId("");
    setConversationUrl("");
    setMockSessionId("");
    setScore(null);
    setError("");
    setSaveMessage("");
    setStatus(health?.ok ? "Backend ready" : "Backend needs Tavus configuration");
  };

  const isReady = health?.ok === true;
  const missing = health?.missing ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant={isReady ? "default" : "secondary"} className="w-fit">
          {isReady ? (
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
          ) : (
            <AlertCircle className="mr-1 h-3.5 w-3.5" />
          )}
          {status}
        </Badge>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!isReady && missing.length ? (
        <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Missing backend env: {missing.join(", ")}
        </div>
      ) : null}

      {saveMessage ? (
        <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {saveMessage}
        </div>
      ) : null}

      <Card className="border-border/70 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Target className="h-4 w-4 text-primary" />
              Speaking parts
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {partOptions.map((part) => (
                <label
                  key={part.value}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={parts.includes(part.value)}
                    onChange={() => togglePart(part.value)}
                    disabled={Boolean(conversationId) || isBusy}
                    className="h-4 w-4 accent-primary"
                  />
                  {part.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!conversationId ? (
              <Button onClick={start} disabled={!isReady || isBusy}>
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Start
              </Button>
            ) : (
              <>
                <Button onClick={endAndScore} disabled={isBusy}>
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  End and score
                </Button>
                <Button variant="outline" onClick={scoreNow} disabled={isBusy}>
                  <Mic className="h-4 w-4" />
                  Score
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={reset}
                  disabled={isBusy}
                  aria-label="Reset session"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {conversationUrl ? (
        <div className="overflow-hidden rounded-lg border border-border bg-black">
          <iframe
            title="Tavus IELTS speaking conversation"
            src={conversationUrl}
            allow="camera; microphone; autoplay; fullscreen; display-capture"
            className="h-[68vh] min-h-[460px] w-full"
          />
        </div>
      ) : (
        <div className="grid min-h-[360px] place-items-center rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <div>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
              <Mic className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">Ready for a live examiner</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Start creates a real Tavus video conversation from the Python backend.
            </p>
          </div>
        </div>
      )}

      {score?.scorecard ? (
        <Card className="border-border/70 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
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
        </Card>
      ) : null}
    </div>
  );
}
