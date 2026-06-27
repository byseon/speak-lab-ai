import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Video,
  Sparkles,
  Target,
  GraduationCap,
  Check,
  X,
  ArrowRight,
  MessageSquareQuote,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SpeakLab — Practice IELTS Speaking with a real AI examiner" },
      {
        name: "description",
        content:
          "Face-to-face video practice for IELTS Speaking Parts 1, 2 and 3. Get a band score and a personalized plan from your mock.",
      },
      { property: "og:title", content: "SpeakLab — Practice IELTS Speaking with a real AI examiner" },
      {
        property: "og:description",
        content: "Face-to-face video practice for IELTS Speaking Parts 1, 2 and 3.",
      },
    ],
  }),
  component: Landing,
});

function CTA({ className = "" }: { className?: string }) {
  const { t } = useTranslation("common");
  return (
    <Button asChild size="lg" className={`w-full sm:w-auto shadow-[var(--shadow-soft)] ${className}`}>
      <Link to="/signup">
        {t("cta.takeFreeMock")} <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </Button>
  );
}

function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mx-auto w-full max-w-6xl px-5 py-16 sm:py-24 ${className}`}>
      {children}
    </section>
  );
}

function Landing() {
  const { t } = useTranslation("landing");
  const { t: tCommon } = useTranslation("common");
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <MessageSquareQuote className="h-4 w-4" />
          </span>
          <span className="text-lg font-semibold tracking-tight">SpeakLab</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
            {tCommon("cta.logIn")}
          </Link>
          <Button asChild variant="default" size="sm">
            <Link to="/signup">{tCommon("cta.startFree")}</Link>
          </Button>
        </div>
      </header>

      <section className="relative" style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:py-20 lg:py-28 lg:grid-cols-2 lg:items-center">
          <div className="min-w-0">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary" /> {t("hero.eyebrow")}
            </div>
            <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {t("hero.headlinePrefix")}{" "}
              <span className="text-primary">{t("hero.headlineHighlight")}</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              {t("hero.subhead")}
            </p>
            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <CTA />
              <span className="text-center text-xs text-muted-foreground sm:text-left">
                {t("hero.ctaNote")}
              </span>
            </div>
          </div>

          <div className="relative">
            <Card className="overflow-hidden border-border/70 shadow-[var(--shadow-soft)]">
              <div className="aspect-video bg-gradient-to-br from-primary/15 via-accent/40 to-background">
                <div className="flex h-full flex-col justify-between p-5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    {t("hero.session.liveLabel")}
                  </div>
                  <div className="rounded-xl border border-border bg-card/85 p-4 backdrop-blur">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("hero.session.examinerLabel")}
                    </div>
                    <p className="mt-1 text-sm font-medium">
                      {t("hero.session.examinerPrompt")}
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3 p-5 text-center">
                {([
                  ["fluency", "6.0"],
                  ["lexical", "5.5"],
                  ["grammar", "6.0"],
                  ["pronunciation", "6.5"],
                ] as const).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-muted px-2 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t(`hero.session.criteria.${k}`)}
                    </div>
                    <div className="text-lg font-semibold text-foreground">{v}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      <Section className="!py-10">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Trusted by learners preparing at
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm font-medium text-muted-foreground/80">
          <span>British Council partners</span><span>·</span>
          <span>IDP test centres</span><span>·</span>
          <span>University foundation programs</span><span>·</span>
          <span>10,000+ practice minutes</span>
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              You don't need more flashcards. You need to <em>speak.</em>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Most IELTS apps test you on grammar fill-ins and vocabulary quizzes. The actual exam is a live conversation with an examiner — and that's where learners freeze up, run out of words, and lose half a band.
            </p>
          </div>
          <Card className="border-border/70 p-6">
            <ul className="space-y-3 text-sm">
              {[
                "You panic when the timer starts in Part 2.",
                "You repeat \"things like that\" because you can't find the word.",
                "You don't know which of the four criteria is actually holding you back.",
                "You can't tell if you're a band 5.5 or a band 6.5.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Section>

      <Section className="bg-card/40">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
          <p className="mt-3 text-muted-foreground">Three steps. Start in under a minute.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { n: "01", t: "Take a free mock", d: "A real 14-minute video conversation through Parts 1, 2, and 3.", i: Video },
            { n: "02", t: "Get your band score", d: "Scored on Fluency, Lexical, Grammar, and Pronunciation — the official 4 criteria.", i: Target },
            { n: "03", t: "Follow your plan", d: "Daily 10–15 min sessions targeted at the criterion holding you back.", i: Sparkles },
          ].map(({ n, t, d, i: Icon }) => (
            <Card key={n} className="border-border/70 p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-medium text-muted-foreground">{n}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </Card>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <CTA />
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <Card className="order-2 border-border/70 p-6 lg:order-1">
            <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-primary/15 via-accent/40 to-background p-5">
              <div className="flex h-full flex-col justify-end gap-3">
                <div className="rounded-lg border border-border bg-card/80 p-3 text-sm">
                  "Tell me about a time you helped someone."
                </div>
                <div className="ml-auto max-w-[80%] rounded-lg bg-primary p-3 text-sm text-primary-foreground">
                  Well, last month my neighbour…
                </div>
              </div>
            </div>
          </Card>
          <div className="order-1 lg:order-2">
            <span className="text-xs font-medium uppercase tracking-wide text-primary">The difference</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              An AI examiner you can <em>see</em> — not another flashcard deck.
            </h2>
            <p className="mt-4 text-muted-foreground">
              SpeakLab uses video conversation, not text drills. You're looking at a face, answering follow-ups, getting interrupted just like the real exam. That's the only way speaking gets better.
            </p>
          </div>
        </div>
      </Section>

      <Section className="bg-card/40">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              A plan built from your real mock — not a generic course
            </h2>
            <p className="mt-4 text-muted-foreground">
              We don't guess what you need. Your first mock pinpoints your weakest criterion. Every daily session targets that exact gap, then re-tests as you improve.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              {["Daily session under 15 minutes.", "Every activity tied to one of the 4 IELTS criteria.", "Re-mock weekly to track your real band."].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <Card className="border-border/70 p-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Your weakest area</div>
                <div className="text-lg font-semibold">Lexical resource</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Current band</div>
                <div className="text-lg font-semibold">5.0</div>
              </div>
            </div>
            <div className="space-y-3">
              {[["Fluency", 5.5], ["Lexical", 5.0], ["Grammar", 5.5], ["Pronunciation", 6.0]].map(([k, v]) => (
                <div key={k as string}>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>{k}</span><span>{v}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${((v as number) / 9) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      <Section>
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Mock vs. daily practice</h2>
          <p className="mt-3 text-muted-foreground">Both matter. Here's how they work together.</p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Card className="border-border/70 p-6">
            <div className="text-xs font-medium uppercase tracking-wide text-primary">Mock</div>
            <h3 className="mt-1 text-xl font-semibold">Where am I right now?</h3>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> Full 14-minute exam simulation</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> Scored on all 4 IELTS criteria</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> Weekly, to track your band</li>
            </ul>
          </Card>
          <Card className="border-border/70 bg-primary/5 p-6">
            <div className="text-xs font-medium uppercase tracking-wide text-primary">Daily practice</div>
            <h3 className="mt-1 text-xl font-semibold">How do I get better tomorrow?</h3>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> 10–15 min focused session</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> Targets your weakest criterion</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> New cue cards every day</li>
            </ul>
          </Card>
        </div>
      </Section>

      <Section className="bg-card/40">
        <div className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:items-center">
          <div>
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-primary">
              <GraduationCap className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">For students</h2>
            <p className="mt-3 text-muted-foreground">
              Built around the way you actually study — on your phone, in short focused blocks, between classes.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Mobile-first", "Practice on the bus, in bed, between lectures."],
              ["Exam-realistic", "Real timing, real follow-ups, real pressure."],
              ["Honest feedback", "Band scores you'd actually get on test day."],
              ["Affordable", "Cheaper than a single hour with a private tutor."],
            ].map(([t, d]) => (
              <Card key={t} className="border-border/70 p-4">
                <div className="font-semibold">{t}</div>
                <div className="mt-1 text-sm text-muted-foreground">{d}</div>
              </Card>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Questions</h2>
          <Accordion type="single" collapsible className="mt-8">
            {[
              ["Is the AI examiner really like a real one?", "It uses the official IELTS Speaking rubric, follows the Part 1–2–3 structure, and asks real follow-up questions. It won't replace a human examiner on test day, but it's the closest practice you can do alone."],
              ["How is my band score calculated?", "Each response is scored on the four IELTS criteria — Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, and Pronunciation — then averaged using the official IELTS rounding rules."],
              ["Do I need to install anything?", "No. SpeakLab runs in your browser. You'll need a microphone and camera."],
              ["Is my voice data private?", "Recordings are only used to score your session. You can delete them any time from your account."],
              ["How much does it cost?", "Your first mock is free. After that, daily practice starts at less than a cup of coffee per week."],
            ].map(([q, a], i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left">{q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Section>

      <section className="border-t border-border bg-card/40">
        <Section className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Find out your band today.</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Your free mock takes 14 minutes. You'll know exactly where you stand and what to fix first.
          </p>
          <div className="mt-8 flex justify-center">
            <CTA />
          </div>
        </Section>
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 border-t border-border px-5 py-6 text-xs text-muted-foreground sm:flex-row">
          <div>© {new Date().getFullYear()} SpeakLab</div>
          <div className="flex gap-4">
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
          </div>
        </div>
      </section>
    </div>
  );
}