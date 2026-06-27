import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { AppShell } from "@/components/BottomNav";
import { ConversationShell, type ConversationStatus } from "@/components/ConversationShell";
import { endConversation } from "@/lib/tavus";
import { toast } from "@/components/ui/sonner";

const searchSchema = z.object({
  c: z.string().min(1),
  s: z.string().min(1),
  u: z.string().url(),
});

export const Route = createFileRoute("/_authenticated/mock/live")({
  head: () => ({ meta: [{ title: "Live mock — SpeakLab" }] }),
  validateSearch: searchSchema,
  component: MockLivePage,
});

function MockLivePage() {
  const { t } = useTranslation("mock");
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [status, setStatus] = useState<ConversationStatus>("connecting");

  // Mark live shortly after mount so the status reflects the iframe being shown.
  // The iframe handles the actual handshake; this is a UX-level state.
  useState(() => {
    const id = window.setTimeout(() => {
      setStatus((s) => (s === "connecting" ? "live" : s));
    }, 2500);
    return () => window.clearTimeout(id);
  });

  const handleEnd = async () => {
    setStatus("ending");
    try {
      await endConversation({
        session_id: search.s,
        conversation_id: search.c,
      });
    } catch (err) {
      // Still continue to the report — the row is updated on best-effort.
      toast.error((err as Error).message);
    } finally {
      setStatus("ended");
      navigate({
        to: "/mock/report",
        search: { s: search.s, c: search.c },
      });
    }
  };

  return (
    <AppShell>
      <h1 className="sr-only">{t("live.title")}</h1>
      <ConversationShell
        conversationUrl={search.u}
        status={status}
        onEnd={handleEnd}
      />
    </AppShell>
  );
}
