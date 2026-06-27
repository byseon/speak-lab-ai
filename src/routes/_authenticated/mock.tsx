import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/BottomNav";
import { LiveAssessmentSession } from "@/components/LiveAssessmentSession";

export const Route = createFileRoute("/_authenticated/mock")({
  head: () => ({ meta: [{ title: "Mock — SpeakLab" }] }),
  component: MockPage,
});

function MockPage() {
  const { user } = Route.useRouteContext();
  const username = user.email?.split("@")[0] ?? "guest";

  return (
    <AppShell wide>
      <LiveAssessmentSession
        username={username}
        userId={user.id}
        title="Free mock"
        description="Run a full IELTS Speaking simulation with a live Tavus examiner, then score the ended transcript through the Python assessment backend."
        defaultParts={[1, 2, 3]}
      />
    </AppShell>
  );
}
