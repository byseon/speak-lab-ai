import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/practice/part-2/speak")({
  head: () => ({ meta: [{ title: "Part 2 — Speak — SpeakLab" }] }),
  component: Part2SpeakPage,
});

const TOTAL_SECONDS = 120;

function formatTime(total: number) {
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return { mm, ss };
}

function Part2SpeakPage() {
  const { t } = useTranslation("practice");
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState(TOTAL_SECONDS);
  const [cueOpen, setCueOpen] = useState(false);
  const [announcement, setAnnouncement] = useState(
    t("part2.speak.announcements.started"),
  );
  const endedRef = useRef(false);

  // Countdown
  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Threshold announcements + auto-advance
  useEffect(() => {
    if (remaining === 60) setAnnouncement(t("part2.speak.announcements.halfway"));
    if (remaining === 30) setAnnouncement(t("part2.speak.announcements.thirtySeconds"));
    if (remaining === 0 && !endedRef.current) {
      endedRef.current = true;
      setAnnouncement(t("part2.speak.announcements.complete"));
      const id = window.setTimeout(() => {
        navigate({ to: "/practice" });
      }, 1500);
      return () => window.clearTimeout(id);
    }
  }, [remaining, navigate, t]);

  const { mm, ss } = formatTime(remaining);
  const elapsed = TOTAL_SECONDS - remaining;
  const pct = (elapsed / TOTAL_SECONDS) * 100;
  // Red until ~1:30 elapsed, green from 2:00 — interpolate via classes
  const barColorClass =
    remaining <= 0
      ? "bg-emerald-500"
      : elapsed >= 90
        ? "bg-amber-500"
        : "bg-red-500";

  const cueBullets = t("part2.speak.cueBullets", {
    returnObjects: true,
  }) as string[];

  return (
    <div className="min-h-dvh bg-background pb-28 font-sans text-foreground antialiased">
      <div className="mx-auto w-full max-w-md px-4 pt-6 sm:px-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">
            {t("part2.speak.title")}
          </h1>
          <span
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium"
            aria-live="polite"
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-red-500 motion-safe:animate-pulse"
            />
            <Mic aria-hidden="true" className="h-3 w-3" />
            {t("part2.speak.recording")}
            <span className="sr-only"> · {t("part2.speak.phase")}</span>
          </span>
        </header>

        {/* Examiner video (dominant) */}
        <div
          role="img"
          aria-label={t("part2.speak.examinerVideoLabel")}
          className="mt-4 flex min-h-[40dvh] w-full items-end overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-accent/40 to-background p-4 shadow-[var(--shadow-soft)]"
        >
          <div className="rounded-lg bg-card/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
            {t("part2.speak.examinerName")}
          </div>
        </div>

        {/* Collapsed cue card */}
        <section aria-labelledby="cue-heading" className="mt-4">
          <Card className="border-border/70">
            <button
              type="button"
              onClick={() => setCueOpen((v) => !v)}
              aria-expanded={cueOpen}
              aria-controls="cue-body"
              aria-label={cueOpen ? t("part2.speak.cueCollapse") : t("part2.speak.cueExpand")}
              className="flex w-full items-center justify-between gap-3 rounded-md px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span id="cue-heading" className="text-sm font-medium">
                {t("part2.speak.cueHeading")}
              </span>
              {cueOpen ? (
                <ChevronUp aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {cueOpen && (
              <div id="cue-body" className="border-t border-border px-4 py-3 text-sm">
                <p className="font-medium">{t("part2.speak.cuePrompt")}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  {cueBullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </section>

        {/* Progress + timer */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-medium">{t("part2.speak.phase")}</span>
            <span
              role="timer"
              aria-live="off"
              className="font-mono tabular-nums text-foreground"
            >
              {mm}:{ss}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={remaining}
            aria-valuemin={0}
            aria-valuemax={TOTAL_SECONDS}
            aria-label={t("part2.speak.progressLabel")}
            aria-valuetext={t("part2.speak.timeRemaining", { mm, ss })}
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className={`h-full ${barColorClass} transition-all duration-1000 ease-linear`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* SR-only live region for threshold announcements */}
        <div role="status" aria-live="polite" className="sr-only">
          {announcement}
        </div>
      </div>

      {/* Sticky End turn CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:px-6">
        <div className="mx-auto w-full max-w-md">
          <Button
            size="lg"
            className="min-h-11 w-full"
            onClick={() => navigate({ to: "/practice" })}
          >
            {t("part2.speak.endTurn")}
          </Button>
        </div>
      </div>
    </div>
  );
}