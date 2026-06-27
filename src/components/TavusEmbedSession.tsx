import * as React from "react";
import { Mic } from "lucide-react";

import { Card } from "@/components/ui/card";
import { TavusEmbedPanel } from "@/components/TavusEmbedPanel";

type TavusEmbedSessionProps = {
  title: string;
  description: string;
  /** Shown in conversational-context when set (e.g. candidate name). */
  username?: string;
  mode?: "exam" | "practice";
};

export function TavusEmbedSession({
  title,
  description,
  username,
  mode = "exam",
}: TavusEmbedSessionProps) {
  const [conversationId, setConversationId] = React.useState("");
  const [status, setStatus] = React.useState("Allow camera and microphone when prompted.");

  const context = React.useMemo(() => {
    const who = username ? ` Candidate: ${username}.` : "";
    return `IELTS Speaking ${mode} mode.${who} Run the full speaking test with examiner Mary.`;
  }, [username, mode]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>

      <Card className="border-border/70 p-4">
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <Mic aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p role="status" aria-live="polite">
            {status}
            {conversationId ? (
              <span className="mt-1 block text-xs opacity-70">Session: {conversationId}</span>
            ) : null}
          </p>
        </div>
      </Card>

      <div className="overflow-hidden rounded-lg border border-border bg-black">
        <TavusEmbedPanel
          conversationalContext={context}
          onConversationStarted={(id) => {
            setConversationId(id);
            setStatus("Live with Mary — your IELTS examiner.");
          }}
          onConversationEnded={() => {
            setStatus("Session ended. Your conversation was saved by Tavus.");
          }}
        />
      </div>
    </div>
  );
}
