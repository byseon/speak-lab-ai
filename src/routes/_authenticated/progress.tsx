import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { LineChart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({ meta: [{ title: "Progress — SpeakLab" }] }),
  component: ProgressPage,
});

function ProgressPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your band over time and weak-spot trends.</p>
      <Card className="mt-6 border-border/70 p-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <LineChart className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">Charts unlock after your first mock</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Once Tavus AI video scoring is connected, you'll see a band trend per criterion here.
        </p>
      </Card>
    </AppShell>
  );
}