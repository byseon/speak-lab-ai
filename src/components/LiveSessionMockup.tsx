import { useTranslation } from "react-i18next";

const SCORES = [
  ["fluency", "6.0"],
  ["lexical", "5.5"],
  ["grammar", "6.0"],
  ["pronunciation", "6.5"],
] as const;

export function LiveSessionMockup() {
  const { t } = useTranslation("landing");

  return (
    <figure
      className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none"
      aria-label={t("hero.session.previewLabel", {
        defaultValue: "Example live speaking session with band scores",
      })}
    >
      <div
        className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-primary/30 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -inset-3 rounded-3xl bg-[var(--primary-glow)]/25 blur-2xl"
        aria-hidden
      />

      <div
        className="relative overflow-hidden rounded-2xl border border-primary/35 p-5 shadow-[var(--shadow-session)] ring-1 ring-primary/20 sm:p-6"
        style={{ background: "var(--gradient-session)" }}
      >
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/25 blur-2xl"
          aria-hidden
        />

        <div className="relative flex items-center gap-2 text-sm text-primary-foreground/90">
          <span
            className="h-2 w-2 motion-safe:animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_oklch(0.72_0.17_155_/_0.85)] motion-reduce:animate-none"
            aria-hidden
          />
          <span>{t("hero.session.liveLabel")}</span>
        </div>

        <div className="relative mt-6 rounded-xl border border-primary-foreground/15 bg-black/20 p-4 backdrop-blur-sm sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-foreground/70">
            {t("hero.session.examinerLabel")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-primary-foreground sm:text-base">
            {t("hero.session.examinerPrompt")}
          </p>
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SCORES.map(([key, value]) => (
            <div
              key={key}
              className="rounded-lg border border-primary-foreground/10 bg-black/15 px-2 py-2 text-center"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">
                {t(`hero.session.criteria.${key}`)}
              </p>
              <p className="mt-0.5 text-sm font-bold text-primary-foreground">
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}
