import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Loader2, Mic } from "lucide-react";
import { startConversation } from "@/lib/tavus";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/session/preview")({
  head: () => ({ meta: [{ title: "Session preview — SpeakLab" }] }),
  component: SessionPreview,
});

function SessionPreview() {
  const { t } = useTranslation("mock");
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  const handleBegin = async () => {
    setStarting(true);
    try {
      const res = await startConversation({ parts: [2, 3], kind: "practice" });
      navigate({
        to: "/mock/live",
        search: { c: res.conversation_id, s: res.session_id, u: res.conversation_url },
      });
    } catch (err) {
      const e = err as Error & { code?: string };
      toast.error(
        e.code === "missing_config" ? t("errors.missingConfig") : e.message || t("errors.generic"),
      );
      setStarting(false);
    }
  };

  return (
    <AppShell>
      <Link
        to="/home"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Today's session</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A short focused block targeting your weakest criterion.
      </p>

      <Card className="mt-6 border-border/70 p-5">
        <div className="flex items-center gap-3 text-sm">
          <Clock className="h-4 w-4 text-primary" />
          <span className="font-medium">12 minutes</span>
          <span className="text-muted-foreground">· 2 activities</span>
        </div>
        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-primary">
              Activity 1
            </div>
            <div className="mt-1 font-semibold">Part 2 cue card</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Describe a place where you like to read. 1 min prep, 2 min speak.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-primary">
              Activity 2
            </div>
            <div className="mt-1 font-semibold">Part 3 discussion</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Follow-up questions about reading habits and learning.
            </p>
          </div>
        </div>
        <Button
          className="mt-6 w-full"
          size="lg"
          onClick={handleBegin}
          disabled={starting}
        >
          {starting ? (
            <>
              <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 motion-safe:animate-spin" />
              {t("actions.starting")}
            </>
          ) : (
            <>
              <Mic className="mr-2 h-4 w-4" /> Begin
            </>
          )}
        </Button>
      </Card>
    </AppShell>
  );
}
