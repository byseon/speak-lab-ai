import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthFormAlert, AuthFormField } from "@/components/AuthFormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/AuthShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Set up your profile — SpeakLab" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [targetBand, setTargetBand] = useState("");
  const [examDate, setExamDate] = useState("");
  const [nameError, setNameError] = useState("");
  const [bandError, setBandError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNameError("");
    setBandError("");
    setFormError("");

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setNameError("Enter your display name.");
      document.getElementById("name")?.focus();
      return;
    }

    if (targetBand) {
      const band = Number(targetBand);
      if (Number.isNaN(band) || band < 4 || band > 9) {
        setBandError("Enter a band between 4.0 and 9.0.");
        document.getElementById("band")?.focus();
        return;
      }
    }

    setLoading(true);
    const { error } = await supabase.from("profiles").upsert({
      user_id: user.id,
      display_name: trimmedName,
      target_band: targetBand ? Number(targetBand) : null,
      exam_date: examDate || null,
      updated_at: new Date().toISOString(),
    });
    setLoading(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    navigate({ to: "/mock" });
  }

  return (
    <AuthShell title="Tell us about you" subtitle="Two quick questions to personalize your plan.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate aria-labelledby="auth-title">
        <AuthFormField
          id="name"
          label="Display name"
          autoComplete="name"
          required
          value={displayName}
          error={nameError}
          onChange={(value) => {
            setDisplayName(value);
            setNameError("");
            setFormError("");
          }}
        />
        <div className="space-y-2">
          <Label htmlFor="band" className={bandError ? "text-destructive" : undefined}>
            Target band <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="band"
            type="number"
            step="0.5"
            min="4"
            max="9"
            value={targetBand}
            placeholder="e.g. 7.0"
            aria-invalid={bandError ? true : undefined}
            aria-describedby={bandError ? "band-error" : undefined}
            className={cn(
              bandError &&
                "border-destructive focus-visible:ring-destructive/40 aria-invalid:border-destructive",
            )}
            onChange={(e) => {
              setTargetBand(e.target.value);
              setBandError("");
              setFormError("");
            }}
          />
          {bandError ? (
            <p id="band-error" role="alert" className="text-sm text-destructive">
              {bandError}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">
            Exam date <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="date"
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
          />
        </div>
        {formError ? <AuthFormAlert message={formError} /> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Saving…" : "Continue to free mock"}
        </Button>
      </form>
    </AuthShell>
  );
}
