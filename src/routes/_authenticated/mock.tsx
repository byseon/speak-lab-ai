import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/BottomNav";
import { TavusEmbedSession } from "@/components/TavusEmbedSession";

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
      <TavusEmbedSession
        username={username}
        userId={user.id}
        title="Free mock"
        description="A full IELTS Speaking simulation with Mary, your AI examiner. Allow camera and microphone to join the video call."
        mode="exam"
      />
    </AppShell>
  );
}
