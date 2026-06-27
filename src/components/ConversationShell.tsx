import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PhoneOff, Radio } from "lucide-react";

export type ConversationStatus = "connecting" | "live" | "ending" | "ended";

interface Props {
  conversationUrl: string | null;
  status: ConversationStatus;
  onEnd: () => void;
  endLabel?: string;
}

export function ConversationShell({ conversationUrl, status, onEnd, endLabel }: Props) {
  const { t } = useTranslation("mock");
  const [iframeReady, setIframeReady] = useState(false);

  useEffect(() => {
    setIframeReady(false);
  }, [conversationUrl]);

  const statusText = t(`live.status.${status}`);
  const ending = status === "ending" || status === "ended";

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Status bar */}
      <div
        className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          {status === "live" ? (
            <Radio
              aria-hidden="true"
              className="h-4 w-4 text-primary motion-safe:animate-pulse"
            />
          ) : (
            <Loader2
              aria-hidden="true"
              className={`h-4 w-4 text-muted-foreground ${
                status === "ended" ? "" : "motion-safe:animate-spin"
              }`}
            />
          )}
          <span>{statusText}</span>
        </div>
        <span className="text-xs text-muted-foreground">{t("live.allowPrompt")}</span>
      </div>

      {/* Video frame */}
      <Card className="overflow-hidden border-border/70 p-0">
        <div className="relative aspect-video w-full max-h-[50dvh] bg-muted md:max-h-none">
          {conversationUrl ? (
            <iframe
              key={conversationUrl}
              src={conversationUrl}
              title={t("live.iframeLabel")}
              aria-label={t("live.iframeLabel")}
              allow="camera; microphone; autoplay; fullscreen; display-capture"
              className="absolute inset-0 h-full w-full"
              onLoad={() => setIframeReady(true)}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted-foreground">
              {t("live.noUrl")}
            </div>
          )}
          {conversationUrl && !iframeReady && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/70 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
                {t("live.status.connecting")}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Actions */}
      <Button
        variant="destructive"
        size="lg"
        className="w-full"
        onClick={onEnd}
        disabled={ending}
      >
        <PhoneOff aria-hidden="true" className="mr-2 h-4 w-4" />
        {ending ? t("actions.ending") : (endLabel ?? t("actions.end"))}
      </Button>
    </div>
  );
}
