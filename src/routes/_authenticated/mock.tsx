import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mock")({
  head: () => ({ meta: [{ title: "Mock — SpeakLab" }] }),
  component: MockPage,
});

function MockPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Free mock</h1>
      <p className="mt-2 text-sm text-muted-foreground">A full 14-minute IELTS Speaking simulation.</p>
      <Card className="mt-6 border-border/70 p-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Video className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">AI video examiner coming next</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We'll plug in Tavus to run your live mock with face-to-face video conversation.
        </p>
        <Button className="mt-6 w-full" disabled>
          Start mock (soon)
        </Button>
      </Card>
    </AppShell>
  );
}