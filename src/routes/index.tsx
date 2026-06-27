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
  Sparkles,
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
  const badges = t("socialProof.badges", { returnObjects: true }) as string[];
  const steps = t("howItWorks.steps", { returnObjects: true }) as Array<{
    n: string; title: string; body: string;
  }>;
  const chartRows = t("personalization.chart.rows", { returnObjects: true }) as Array<{
    label: string; value: number;
  }>;
  const mvpRows = t("mockVsPractice.rows", { returnObjects: true }) as Array<{
    label: string; mock: string; practice: string;
  }>;
  const faqItems = t("faq.items", { returnObjects: true }) as Array<{
    q: string; a: string;
  }>;
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

      {/* 2. Social proof strip */}
      <Section className="!py-10">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {t("socialProof.line")}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {badges.map((b) => (
            <span
              key={b}
              className="rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              {b}
            </span>
          ))}
        </div>
      </Section>

      {/* 3. Problem */}
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("problem.headline")}
          </h2>
          <p className="mt-4 text-muted-foreground">{t("problem.body")}</p>
        </div>
      </Section>

      {/* 4. How it works */}
      <Section className="bg-card/40">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("howItWorks.headline")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("howItWorks.subhead")}</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.n} className="border-border/70 p-6">
              <span className="text-xs font-medium text-muted-foreground">{step.n}</span>
              <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </Card>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <CTA />
        </div>
      </Section>

      {/* 5. Differentiator */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <Card className="order-2 border-border/70 p-6 lg:order-1">
            <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-primary/15 via-accent/40 to-background p-5">
              <div className="flex h-full flex-col justify-end gap-3">
                <div className="rounded-lg border border-border bg-card/80 p-3 text-sm">
                  "{t("differentiator.visual.prompt")}"
                </div>
                <div className="ml-auto max-w-[80%] rounded-lg bg-primary p-3 text-sm text-primary-foreground">
                  {t("differentiator.visual.answer")}
                </div>
              </div>
            </div>
          </Card>
          <div className="order-1 lg:order-2">
            <span className="text-xs font-medium uppercase tracking-wide text-primary">
              {t("differentiator.eyebrow")}
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {t("differentiator.headline")}
            </h2>
            <p className="mt-4 text-muted-foreground">{t("differentiator.body")}</p>
          </div>
        </div>
      </Section>

      {/* 6. Personalization */}
      <Section className="bg-card/40">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("personalization.headline")}
            </h2>
            <p className="mt-4 text-muted-foreground">{t("personalization.body")}</p>
          </div>
          <Card className="border-border/70 p-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">
                  {t("personalization.chart.weakestLabel")}
                </div>
                <div className="text-lg font-semibold">
                  {t("personalization.chart.weakestValue")}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">
                  {t("personalization.chart.currentLabel")}
                </div>
                <div className="text-lg font-semibold">
                  {t("personalization.chart.currentValue")}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {chartRows.map((row) => (
                <div key={row.label}>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>{row.label}</span>
                    <span>{row.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${(row.value / 9) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      {/* 7. Mock vs Practice */}
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("mockVsPractice.headline")}
          </h2>
        </div>
        <div className="mt-10 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">{t("mockVsPractice.columns.mock")}</th>
                <th className="px-4 py-3">{t("mockVsPractice.columns.practice")}</th>
              </tr>
            </thead>
            <tbody>
              {mvpRows.map((row) => (
                <tr key={row.label} className="border-t border-border align-top">
                  <td className="px-4 py-3 font-medium">{row.label}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.mock}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.practice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 8. For students */}
      <Section className="bg-card/40">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("forStudents.headline")}
          </h2>
          <p className="mt-4 text-muted-foreground">{t("forStudents.body")}</p>
        </div>
      </Section>

      {/* 9. Pricing teaser */}
      <Section>
        <Card className="mx-auto max-w-3xl border-border/70 p-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("pricing.headline")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{t("pricing.body")}</p>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/signup">
                {tCommon("cta.getStarted")} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Card>
      </Section>

      {/* 10. FAQ */}
      <Section className="bg-card/40">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            {t("faq.headline")}
          </h2>
          <Accordion type="single" collapsible className="mt-8">
            {faqItems.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Section>

      {/* 11. Footer CTA */}
      <section className="border-t border-border bg-card/40">
        <Section className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("footer.headline")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{t("footer.subhead")}</p>
          <div className="mt-8 flex justify-center">
            <CTA />
          </div>
        </Section>
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 border-t border-border px-5 py-6 text-xs text-muted-foreground sm:flex-row">
          <div>{t("footer.copyright", { year: new Date().getFullYear() })}</div>
          <div className="flex gap-4">
            <a href="#">{t("footer.links.privacy")}</a>
            <a href="#">{t("footer.links.terms")}</a>
            <a href="#">{t("footer.links.contact")}</a>
          </div>
        </div>
      </section>
    </div>
  );
}