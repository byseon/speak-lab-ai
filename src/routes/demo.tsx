import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { LiveAssessmentSession } from "@/components/LiveAssessmentSession";

export const Route = createFileRoute("/demo")({
  ssr: false,
  head: () => ({ meta: [{ title: "Live demo — SpeakLab" }] }),
  component: DemoPage,
});

function DemoPage() {
  return (
    <div className="min-h-screen bg-background px-5 py-8 font-sans text-foreground antialiased">
      <div className="mx-auto w-full max-w-4xl">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <LiveAssessmentSession
          username="guest"
          title="SpeakLab live demo"
          description="Start a real Tavus IELTS Speaking examiner session without logging in. End the call when you are done, then score the transcript through the Python backend."
          defaultParts={[1, 2, 3]}
        />
      </div>
    </div>
  );
}
