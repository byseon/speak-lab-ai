import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/BottomNav";
import { LiveAssessmentSession } from "@/components/LiveAssessmentSession";

export const Route = createFileRoute("/_authenticated/mock")({
  ssr: false,
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
        description="A full IELTS Speaking simulation with Mary, your AI examiner. Choose the parts, start the call, then end and score through the assessment backend."
        defaultParts={[1, 2, 3]}
      />
    </AppShell>
  );
}
