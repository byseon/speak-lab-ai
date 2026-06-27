import * as React from "react";
import { Loader2 } from "lucide-react";

const DEFAULT_DEPLOYMENT_ID = "b4810f82-46bd-4a1b-bf51-cf18295f653e";

function deploymentId() {
  return (import.meta.env.VITE_TAVUS_DEPLOYMENT_ID as string | undefined) || DEFAULT_DEPLOYMENT_ID;
}

export type TavusEmbedPanelProps = {
  /** Per-call context forwarded to Tavus /start */
  conversationalContext?: string;
  /** Optional greeting override */
  customGreeting?: string;
  className?: string;
  onConversationStarted?: (conversationId: string) => void;
  onConversationEnded?: (conversationId: string) => void;
};

/**
 * Inline Tavus CVI via the <tavus-embed> web component.
 * Client-only — must not render during SSR.
 */
export function TavusEmbedPanel({
  conversationalContext,
  customGreeting,
  className,
  onConversationStarted,
  onConversationEnded,
}: TavusEmbedPanelProps) {
  const [ready, setReady] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    void import("@tavus/embed").then(() => setReady(true));
  }, []);

  React.useEffect(() => {
    if (!ready) return;

    const onStarted = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId: string }>).detail;
      if (detail?.conversationId) onConversationStarted?.(detail.conversationId);
    };
    const onEnded = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId: string }>).detail;
      if (detail?.conversationId) onConversationEnded?.(detail.conversationId);
    };

    window.addEventListener("tavus:conversation-started", onStarted);
    window.addEventListener("tavus:conversation-ended", onEnded);
    return () => {
      window.removeEventListener("tavus:conversation-started", onStarted);
      window.removeEventListener("tavus:conversation-ended", onEnded);
    };
  }, [ready, onConversationStarted, onConversationEnded]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "min(68vh, 720px)", minHeight: 360 }}
    >
      {ready ? (
        <tavus-embed
          deployment-id={deploymentId()}
          {...(conversationalContext
            ? { "conversational-context": conversationalContext }
            : {})}
          {...(customGreeting ? { "custom-greeting": customGreeting } : {})}
        />
      ) : (
        <div className="grid h-full w-full place-items-center rounded-lg border border-border bg-muted">
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />
            Loading examiner…
          </span>
        </div>
      )}
    </div>
  );
}
