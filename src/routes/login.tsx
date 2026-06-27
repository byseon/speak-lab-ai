import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/AuthShell";
import { toast } from "sonner";

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
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const message = error.message.toLowerCase().includes("confirm")
        ? "Please confirm your email first, then log in again."
        : error.message;
      setErrorMessage(message);
      return toast.error(message);
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
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {errorMessage ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
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
