import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/AuthShell";
import { toast } from "sonner";

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
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("profiles").upsert({
      user_id: user.id,
      display_name: displayName || null,
      target_band: targetBand ? Number(targetBand) : null,
      exam_date: examDate || null,
      updated_at: new Date().toISOString(),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/mock" });
  }

  return (
    <AuthShell title="Tell us about you" subtitle="Two quick questions to personalize your plan.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Display name</Label>
          <Input id="name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Priya" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="band">Target band <span className="text-muted-foreground">(optional)</span></Label>
          <Input id="band" type="number" step="0.5" min="4" max="9" value={targetBand} onChange={(e) => setTargetBand(e.target.value)} placeholder="e.g. 7.0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Exam date <span className="text-muted-foreground">(optional)</span></Label>
          <Input id="date" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Saving…" : "Continue to free mock"}
        </Button>
      </form>
    </AuthShell>
  );
}