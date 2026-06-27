import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthFormAlert, AuthFormField } from "@/components/AuthFormField";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/AuthShell";
import {
  firstErrorField,
  hasFieldErrors,
  parseAuthError,
  validateAuthForm,
  type AuthFieldErrors,
} from "@/lib/auth-errors";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — SpeakLab" },
      { name: "description", content: "Log in to SpeakLab to continue your IELTS Speaking practice plan and review your latest mock band score." },
      { property: "og:title", content: "Log in — SpeakLab" },
      { property: "og:description", content: "Log in to continue your IELTS Speaking plan on SpeakLab." },
      { property: "og:url", content: "https://ielts-pal-ai.lovable.app/login" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://ielts-pal-ai.lovable.app/login" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [loading, setLoading] = useState(false);

  function clearFieldError(field: keyof AuthFieldErrors) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function applyErrors(errors: AuthFieldErrors) {
    setFieldErrors(errors);
    const focusTarget = firstErrorField(errors);
    if (focusTarget === "email" || focusTarget === "password") {
      document.getElementById(focusTarget)?.focus();
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validateAuthForm({ email, password }, "login");
    if (hasFieldErrors(validationErrors)) {
      applyErrors(validationErrors);
      return;
    }

    setFieldErrors({});
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      applyErrors(parseAuthError(error.message, "login"));
      return;
    }

    navigate({ to: "/home" });
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to continue your IELTS Speaking plan."
      footer={
        <>
          New to SpeakLab?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Take your free mock
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate aria-labelledby="auth-title">
        <AuthFormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          error={fieldErrors.email}
          onChange={(value) => {
            setEmail(value);
            clearFieldError("email");
            clearFieldError("form");
          }}
        />
        <AuthFormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          error={fieldErrors.password}
          onChange={(value) => {
            setPassword(value);
            clearFieldError("password");
            clearFieldError("form");
          }}
        />
        {fieldErrors.form ? <AuthFormAlert message={fieldErrors.form} /> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Logging in…" : "Log in"}
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link to="/demo">Continue with live demo</Link>
        </Button>
      </form>
    </AuthShell>
  );
}
