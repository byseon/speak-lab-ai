import { Link } from "@tanstack/react-router";
import { MessageSquareQuote } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10"
      style={{ background: "var(--gradient-hero)" }}
    >
      <Link to="/" className="mb-8 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
          <MessageSquareQuote className="h-4 w-4" />
        </span>
        <span className="text-lg font-semibold tracking-tight">SpeakLab</span>
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)]">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}