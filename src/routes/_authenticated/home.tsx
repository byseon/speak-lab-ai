import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, BookOpen, Clock, Play } from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Today — SpeakLab" }] }),
  component: HomePage,
});

const criteria = [
  { label: "Fluency", value: 5.5 },
  { label: "Lexical", value: 5.0 },
  { label: "Grammar", value: 5.5 },
  { label: "Pronunciation", value: 6.0 },
];

const mockFocus = {
  mockNumber: 1,
  criterion: "Lexical",
  score: 5.0,
};

function expectedFocusScore(targetBand: number | null) {
  if (targetBand != null) return targetBand;
  return Math.min(9, mockFocus.score + 0.5);
}

function HomePage() {
  const { user } = Route.useRouteContext();
  const name = user.email?.split("@")[0] ?? "there";
  const [targetBand, setTargetBand] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    supabase
      .from("profiles")
      .select("target_band")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setTargetBand(data?.target_band ?? null);
      });

    return () => {
      active = false;
    };
  }, [user.id]);

  const expectedScore = expectedFocusScore(targetBand);
  const focusReason = `Mock #${mockFocus.mockNumber}: ${mockFocus.criterion} score ${mockFocus.score.toFixed(1)} · below ${expectedScore.toFixed(1)} target`;

  return (
    <AppShell>
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">Day 1 of your plan</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Hi {name} 👋</h1>
      </div>

      {/* Today focus */}
      <Card className="border-border/70 bg-gradient-to-br from-primary/10 to-background p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
          <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Today's focus
        </div>
        <h2 className="mt-2 text-lg font-semibold leading-snug">Build vocabulary for Part 2</h2>
        <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted-foreground">
          <span className="truncate">{focusReason}</span>
        </div>
      </Card>

      {/* Criteria bars */}
      <div className="mt-6">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Your last mock</h3>
        <Card className="border-border/70 p-5">
          <div className="space-y-3">
            {criteria.map((c) => (
              <div key={c.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="font-semibold text-foreground">{c.value.toFixed(1)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${(c.value / 9) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Session preview */}
      <div className="mt-6">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Today's session</h3>
        <Card className="border-border/70 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Lexical sprint</div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3 shrink-0" aria-hidden="true" /> 12 min
                </span>
                <span>· 2 activities</span>
              </div>
            </div>
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
              aria-hidden="true"
            >
              <Play className="h-4 w-4" />
            </span>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="rounded-lg bg-muted px-3 py-2">1. Part 2 cue card — describe a place</li>
            <li className="rounded-lg bg-muted px-3 py-2">2. Part 3 discussion — follow-ups</li>
          </ul>
          <Button asChild className="mt-5 w-full">
            <Link to="/session/preview">
              Start today's session <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
