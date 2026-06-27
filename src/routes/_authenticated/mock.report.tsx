import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { AppShell } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

const searchSchema = z.object({
  s: z.string().min(1),
  c: z.string().min(1),
});

export const Route = createFileRoute("/_authenticated/mock/report")({
  head: () => ({ meta: [{ title: "Mock report — SpeakLab" }] }),
  validateSearch: searchSchema,
  component: MockReportPage,
});

function MockReportPage() {
  const { t } = useTranslation("mock");
  const search = Route.useSearch();
  return (
    <AppShell>
      <Card className="border-border/70 p-6 text-center">
        <span
          aria-hidden="true"
          className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"
        >
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-xl font-semibold">{t("report.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("report.subtitle")}</p>
        <p className="mt-4 break-all text-xs text-muted-foreground">
          {t("report.session")}: <span className="font-mono">{search.s}</span>
        </p>
        <Button asChild className="mt-6 w-full">
          <Link to="/home">{t("report.backHome")}</Link>
        </Button>
      </Card>
    </AppShell>
  );
}
