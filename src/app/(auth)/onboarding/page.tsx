"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronRight, ChevronLeft, Check, AlertCircle } from "lucide-react";

const STEPS = ["Profile", "School", "Preferences"];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "", school_name: "Kingston College", department_name: "English Department",
    academic_year: "2026-2027", current_term: "Term 1",
    working_days: ["Monday","Tuesday","Wednesday","Thursday","Friday"],
    preferred_hours_start: "08:00", preferred_hours_end: "16:00",
    notifications_in_app: true, notifications_email: true,
    priorities: "",
  });

  function update<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  const toggleDay = (day: string) => update("working_days", form.working_days.includes(day) ? form.working_days.filter(d => d !== day) : [...form.working_days, day]);

  async function finish() {
    setSaving(true);
    setError(null);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setError("Your session has expired. Please sign in again.");
      setSaving(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email!,
      full_name: form.full_name,
      role: "head_of_department",
      preferences: {
        notifications: { in_app: form.notifications_in_app, email: form.notifications_email },
        academic_year: form.academic_year,
        current_term: form.current_term,
        working_days: form.working_days,
        preferred_hours_start: form.preferred_hours_start,
        preferred_hours_end: form.preferred_hours_end,
        priorities: form.priorities,
      },
    });
    if (profileError) {
      setError(`We couldn't save your profile: ${profileError.message}`);
      setSaving(false);
      return;
    }

    const { error: orgError } = await supabase.rpc("set_profile_organization", {
      p_school_name: form.school_name,
      p_department_name: form.department_name,
    });
    if (orgError) {
      setError(`We couldn't set up your school: ${orgError.message}`);
      setSaving(false);
      return;
    }

    const { error: settingsError } = await supabase.from("settings").upsert({
      user_id: user.id,
      notification_preferences: {
        email: form.notifications_email,
        in_app: true,
        push: false,
        telegram: false,
        deadline_reminders: true,
        daily_task_digest: true,
        weekly_task_digest: true,
        timezone: "America/Jamaica",
      },
    });
    if (settingsError) {
      setError(`We couldn't save your settings: ${settingsError.message}`);
      setSaving(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i <= step ? "bg-primary text-white" : "bg-border text-muted"}`}>{i + 1}</div>
              <span className={`text-sm ${i <= step ? "font-medium" : "text-muted"}`}>{s}</span>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
            </div>
          ))}
        </div>

        <div className="card p-6">
          {step === 0 && (
            <>
              <h1 className="text-xl font-bold mb-4">Welcome, Head of Department</h1>
              <p className="text-sm text-muted mb-6">Let&apos;s set up your leadership platform in a few steps.</p>
              <div><label className="form-label">Your Full Name</label><input className="form-input" value={form.full_name} onChange={e => update("full_name", e.target.value)} placeholder="Dr. Sarah Williams" /></div>
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="text-xl font-bold mb-4">Your School & Department</h2>
              <div className="space-y-4">
                <div><label className="form-label">School Name</label><input className="form-input" value={form.school_name} onChange={e => update("school_name", e.target.value)} /></div>
                <div><label className="form-label">Department Name</label><input className="form-input" value={form.department_name} onChange={e => update("department_name", e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="form-label">Academic Year</label><input className="form-input" value={form.academic_year} onChange={e => update("academic_year", e.target.value)} /></div>
                  <div><label className="form-label">Current Term</label><select className="form-select" value={form.current_term} onChange={e => update("current_term", e.target.value)}><option>Term 1</option><option>Term 2</option><option>Term 3</option></select></div>
                </div>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="text-xl font-bold mb-4">Preferences</h2>
              <div className="space-y-4">
                <div>
                  <label className="form-label">Working Days</label>
                  <div className="flex flex-wrap gap-2">{[..."Mon Tue Wed Thu Fri".split(" ")].map(d => <button key={d} onClick={() => toggleDay(d)} className={`btn btn-sm ${form.working_days.includes(d) ? "btn-primary" : "btn-secondary"}`}>{d}</button>)}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="form-label">Day Starts</label><input type="time" className="form-input" value={form.preferred_hours_start} onChange={e => update("preferred_hours_start", e.target.value)} /></div>
                  <div><label className="form-label">Day Ends</label><input type="time" className="form-input" value={form.preferred_hours_end} onChange={e => update("preferred_hours_end", e.target.value)} /></div>
                </div>
                <div><label className="form-label">Leadership Priorities (optional)</label><textarea className="form-input" rows={3} value={form.priorities} onChange={e => update("priorities", e.target.value)} placeholder="e.g. Improve GCSE results, develop NQTs, curriculum redesign" /></div>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-error/30 bg-error/5 px-3 py-2.5 mt-6 text-sm text-error" role="alert">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 mt-8 pt-4 border-t border-border">
            {step > 0 && <button onClick={() => setStep(s => s - 1)} className="btn btn-secondary"><ChevronLeft className="w-4 h-4" /> Back</button>}
            <div className="flex-1" />
            {step < 2 ? (
              <button onClick={() => setStep(s => s + 1)} className="btn btn-primary" disabled={step === 0 && !form.full_name}>Next <ChevronRight className="w-4 h-4" /></button>
            ) : (
              <button onClick={finish} disabled={saving} className="btn btn-accent"><Check className="w-4 h-4" /> {saving ? "Setting up..." : "Complete Setup"}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
