import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Mic } from "lucide-react";

export const Route = createFileRoute("/_authenticated/session/preview")({
  head: () => ({ meta: [{ title: "Session preview — SpeakLab" }] }),
  component: SessionPreview,
});

function SessionPreview() {
  return (
    <AppShell>
      <Link to="/home" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Today's session</h1>
      <p className="mt-2 text-sm text-muted-foreground">A short focused block targeting your weakest criterion.</p>

      <Card className="mt-6 border-border/70 p-5">
        <div className="flex items-center gap-3 text-sm">
          <Clock className="h-4 w-4 text-primary" />
          <span className="font-medium">12 minutes</span>
          <span className="text-muted-foreground">· 2 activities</span>
        </div>
        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-primary">Activity 1</div>
            <div className="mt-1 font-semibold">Part 2 cue card</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Describe a place where you like to read. 1 min prep, 2 min speak.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-primary">Activity 2</div>
            <div className="mt-1 font-semibold">Part 3 discussion</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Follow-up questions about reading habits and learning.
            </p>
          </div>
        </div>
        <Button className="mt-6 w-full" size="lg">
          <Mic className="mr-2 h-4 w-4" /> Begin
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          AI video examiner (Tavus) wires up next.
        </p>
      </Card>
    </AppShell>
  );
}