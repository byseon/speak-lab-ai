import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthFormAlert, AuthFormField } from "@/components/AuthFormField";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/AuthShell";
import { toast } from "sonner";
import {
  firstErrorField,
  hasFieldErrors,
  parseAuthError,
  validateAuthForm,
  type AuthFieldErrors,
} from "@/lib/auth-errors";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — SpeakLab" },
      {
        name: "description",
        content:
          "Create your free SpeakLab account and take a full IELTS Speaking mock with an AI examiner. Get a band score and a personalized plan.",
      },
      { property: "og:title", content: "Sign up — SpeakLab" },
      {
        property: "og:description",
        content: "Take your free IELTS Speaking mock with an AI examiner and get a band score.",
      },
      { property: "og:url", content: "https://ielts-pal-ai.lovable.app/signup" },
    ],
    links: [{ rel: "canonical", href: "https://ielts-pal-ai.lovable.app/signup" }],
  }),
  component: SignupPage,
});

function SignupPage() {
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
    const validationErrors = validateAuthForm({ email, password }, "signup");
    if (hasFieldErrors(validationErrors)) {
      applyErrors(validationErrors);
      return;
    }

    setFieldErrors({});
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/onboarding` },
    });
    setLoading(false);

    if (error) {
      applyErrors(parseAuthError(error.message, "signup"));
      return;
    }

    if (data.session) {
      toast.success("Account created!");
      navigate({ to: "/onboarding" });
      return;
    }

    toast.success("Account created. Check your email to confirm it before logging in.");
    navigate({ to: "/login" });
  }

  return (
    <AuthShell
      title="Take your free mock"
      subtitle="Create an account to start your first IELTS Speaking mock."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
          autoComplete="new-password"
          minLength={6}
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
          {loading ? "Creating account…" : "Create account"}
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link to="/demo">Continue with live demo</Link>
        </Button>
      </form>
    </AuthShell>
  );
}
