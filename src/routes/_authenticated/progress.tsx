import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ScoreProgressBar } from "@/components/ScoreProgressBar";
import { CalendarDays, LineChart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({ meta: [{ title: "Progress — SpeakLab" }] }),
  component: ProgressPage,
});

type ProgressRow = {
  id: string;
  recorded_at: string;
  overall_band: number;
  fluency_band: number | null;
  lexical_band: number | null;
  grammar_band: number | null;
  pronunciation_band: number | null;
};

const criteria = [
  ["Fluency", "fluency_band"],
  ["Lexical", "lexical_band"],
  ["Grammar", "grammar_band"],
  ["Pronunciation", "pronunciation_band"],
] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function ProgressPage() {
  const { user } = Route.useRouteContext();
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const latest = rows[0];

  useEffect(() => {
    let active = true;

    supabase
      .from("progress_history")
      .select(
        "id, recorded_at, overall_band, fluency_band, lexical_band, grammar_band, pronunciation_band",
      )
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: false })
      .limit(10)
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError(queryError.message);
        setRows((data ?? []) as ProgressRow[]);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user.id]);

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your band over time and weak-spot trends.
      </p>

      {loading ? (
        <Card
          role="status"
          aria-live="polite"
          className="mt-6 border-border/70 p-6 text-center text-sm text-muted-foreground"
        >
          Loading progress...
        </Card>
      ) : error ? (
        <Card
          role="alert"
          className="mt-6 border-border/70 p-6 text-sm text-destructive"
        >
          {error}
        </Card>
      ) : latest ? (
        <>
          <Card className="mt-6 border-border/70 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Latest overall band</div>
                <div className="mt-1 text-4xl font-semibold tracking-tight">
                  {latest.overall_band.toFixed(1)}
                </div>
              </div>
              <span
                aria-hidden="true"
                className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary"
              >
                <LineChart className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-5 space-y-3">
              {criteria.map(([label, key]) => (
                <ScoreProgressBar
                  key={key}
                  label={label}
                  value={latest[key]}
                />
              ))}
            </div>
          </Card>

          <div className="mt-6 space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Recent mocks</h2>
            {rows.map((row) => (
              <Card key={row.id} className="border-border/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{formatDate(row.recorded_at)}</span>
                  </div>
                  <div className="text-lg font-semibold">{row.overall_band.toFixed(1)}</div>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card className="mt-6 border-border/70 p-6 text-center">
          <span
            aria-hidden="true"
            className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"
          >
            <LineChart className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Charts unlock after your first saved mock</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Start a mock while logged in, end the call, and score it to save your history.
          </p>
        </Card>
      )}
    </AppShell>
  );
}
