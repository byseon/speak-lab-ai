import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { SkipLink } from "@/components/SkipLink";
import { TavusEmbedSession } from "@/components/TavusEmbedSession";

export const Route = createFileRoute("/demo")({
  ssr: false,
  head: () => ({ meta: [{ title: "Live demo — SpeakLab" }] }),
  component: DemoPage,
});

function DemoPage() {
  return (
    <div className="min-h-screen bg-background px-5 py-8 font-sans text-foreground antialiased">
      <SkipLink />
      <main id="main" className="mx-auto w-full max-w-4xl">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to home
        </Link>
        <TavusEmbedSession
          title="SpeakLab live demo"
          description="Talk to Mary, your IELTS examiner — no login required. Allow camera and microphone to start."
          mode="exam"
        />
      </main>
    </div>
  );
}
