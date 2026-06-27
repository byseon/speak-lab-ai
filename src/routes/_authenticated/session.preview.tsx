import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/BottomNav";
import { LiveAssessmentSession } from "@/components/LiveAssessmentSession";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/session/preview")({
  head: () => ({ meta: [{ title: "Session preview — SpeakLab" }] }),
  component: SessionPreview,
});

function SessionPreview() {
  const { user } = Route.useRouteContext();
  const username = user.email?.split("@")[0] ?? "guest";

  return (
    <AppShell wide>
      <Link
        to="/home"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to home
      </Link>
      <LiveAssessmentSession
        username={username}
        userId={user.id}
        title="Today's session"
        description="A shorter live Tavus session for the daily speaking block. End the call when you are done, then score the transcript through the assessment backend."
        defaultParts={[2, 3]}
      />
    </AppShell>
  );
}
