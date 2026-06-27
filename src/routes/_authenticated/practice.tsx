import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Mic } from "lucide-react";

export const Route = createFileRoute("/_authenticated/practice")({
  head: () => ({ meta: [{ title: "Practice — SpeakLab" }] }),
  component: PracticePage,
});

function PracticePage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Practice</h1>
      <p className="mt-2 text-sm text-muted-foreground">Short focused drills between mocks.</p>
      <Card className="mt-6 border-border/70 p-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Mic className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">Daily practice library</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Targeted Part 1/2/3 drills land here once Tavus AI video is wired in.
        </p>
      </Card>
    </AppShell>
  );
}