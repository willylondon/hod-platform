"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TIMEZONE_OPTIONS } from "@/lib/notification-preferences";
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
    notifications_in_app: true, notifications_email: false, timezone: "America/Jamaica",
    priorities: "",
  });

  useEffect(() => {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detectedTimezone) queueMicrotask(() => setForm(current => ({ ...current, timezone: detectedTimezone })));
  }, []);

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

    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setError(payload.error || "We couldn't complete your setup. Please try again.");
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
                <div>
                  <label htmlFor="onboarding-timezone" className="form-label">Timezone</label>
                  <select id="onboarding-timezone" className="form-select" value={form.timezone} onChange={e => update("timezone", e.target.value)}>
                    {!TIMEZONE_OPTIONS.some(option => option.value === form.timezone) && <option value={form.timezone}>{form.timezone.replaceAll("_", " ")}</option>}
                    {TIMEZONE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-muted">Deadline reminders use this timezone.</p>
                </div>
                <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
                  <input type="checkbox" className="mt-0.5" checked={form.notifications_in_app} onChange={e => update("notifications_in_app", e.target.checked)} />
                  <span><span className="block font-medium">In-app task reminders</span><span className="text-xs text-muted">Show daily, weekly and deadline reminders in the notification bell.</span></span>
                </label>
                <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
                  <input type="checkbox" className="mt-0.5" checked={form.notifications_email} onChange={e => update("notifications_email", e.target.checked)} />
                  <span><span className="block font-medium">Email task reminders</span><span className="text-xs text-muted">Send reminders to the email address used to sign in. This is off until you choose it.</span></span>
                </label>
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
