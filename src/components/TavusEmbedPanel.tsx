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
  onReady?: () => void;
};

export type TavusEmbedPanelHandle = {
  endConversation: () => void;
};

/**
 * Inline Tavus CVI via the <tavus-embed> web component.
 * Client-only — must not render during SSR.
 */
export const TavusEmbedPanel = React.forwardRef<TavusEmbedPanelHandle, TavusEmbedPanelProps>(
  function TavusEmbedPanel(
    { conversationalContext, customGreeting, className, onConversationStarted, onConversationEnded, onReady },
    ref,
  ) {
    const [ready, setReady] = React.useState(false);
    const integrationRef = React.useRef<import("@tavus/embed").TavusIntegration | null>(null);
    const onReadyRef = React.useRef(onReady);
    onReadyRef.current = onReady;

    React.useEffect(() => {
      void import("@tavus/embed").then((mod) => {
        integrationRef.current = new mod.TavusIntegration("tavus-embed");
        setReady(true);
        onReadyRef.current?.();
      });
    }, []);

    React.useImperativeHandle(ref, () => ({
      endConversation: () => integrationRef.current?.endConversation(),
    }));

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
        role="region"
        aria-label="AI IELTS speaking examiner video"
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
          <div
            role="status"
            aria-live="polite"
            className="grid h-full w-full place-items-center rounded-lg border border-border bg-muted"
          >
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />
              Loading examiner…
            </span>
          </div>
        )}
      </div>
    );
  },
);
