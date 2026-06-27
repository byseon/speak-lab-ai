import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, Clock, Loader2, Volume2 } from "lucide-react";
import { startConversation, type TavusPart } from "@/lib/tavus";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mock")({
  head: () => ({ meta: [{ title: "Mock — SpeakLab" }] }),
  component: MockPage,
});

const PART_KEYS: { id: TavusPart; titleKey: string; descKey: string }[] = [
  { id: 1, titleKey: "parts.part1", descKey: "parts.part1Desc" },
  { id: 2, titleKey: "parts.part2", descKey: "parts.part2Desc" },
  { id: 3, titleKey: "parts.part3", descKey: "parts.part3Desc" },
];

function MockPage() {
  const { t } = useTranslation("mock");
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<TavusPart>>(new Set([1, 2, 3]));
  const [starting, setStarting] = useState(false);

  const toggle = (id: TavusPart) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleStart = async () => {
    if (selected.size === 0) {
      toast.error(t("actions.selectAtLeastOne"));
      return;
    }
    setStarting(true);
    try {
      const parts = [...selected].sort() as TavusPart[];
      const res = await startConversation({ parts, kind: "mock" });
      navigate({
        to: "/mock/live",
        search: {
          c: res.conversation_id,
          s: res.session_id,
          u: res.conversation_url,
        },
      });
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === "missing_config") {
        toast.error(t("errors.missingConfig"));
      } else {
        toast.error(e.message || t("errors.generic"));
      }
      setStarting(false);
    }
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">{t("intro.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("intro.subtitle")}</p>

      <Card className="mt-6 border-border/70 p-5">
        <h2 className="text-base font-semibold">{t("parts.title")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("parts.subtitle")}</p>
        <ul className="mt-4 space-y-3">
          {PART_KEYS.map(({ id, titleKey, descKey }) => {
            const checked = selected.has(id);
            return (
              <li key={id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary/40">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(id)}
                    className="mt-1"
                    aria-label={t(titleKey)}
                  />
                  <span className="flex-1">
                    <span className="block font-medium">{t(titleKey)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t(descKey)}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="mt-4 border-border/70 p-5">
        <h2 className="text-base font-semibold">{t("ready.title")}</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <Camera aria-hidden="true" className="mt-0.5 h-4 w-4 text-primary" />
            <span>{t("ready.camera")}</span>
          </li>
          <li className="flex items-start gap-2">
            <Volume2 aria-hidden="true" className="mt-0.5 h-4 w-4 text-primary" />
            <span>{t("ready.quiet")}</span>
          </li>
          <li className="flex items-start gap-2">
            <Clock aria-hidden="true" className="mt-0.5 h-4 w-4 text-primary" />
            <span>{t("ready.duration")}</span>
          </li>
        </ul>
      </Card>

      <Button
        className="mt-6 w-full"
        size="lg"
        onClick={handleStart}
        disabled={starting || selected.size === 0}
      >
        {starting ? (
          <>
            <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 motion-safe:animate-spin" />
            {t("actions.starting")}
          </>
        ) : (
          t("actions.start")
        )}
      </Button>
    </AppShell>
  );
}
