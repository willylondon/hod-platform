"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { User, Bell, Bot, Calendar, Upload, Shield, Save, Check, AlertCircle } from "lucide-react";

type ProfilePreferences = {
  school_name?: string;
  department_name?: string;
  [key: string]: unknown;
};

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState({ full_name: "", email: "", role: "", department: "", school: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileLinks, setProfileLinks] = useState<{ school_id: string | null; department_id: string | null; preferences: ProfilePreferences }>({ school_id: null, department_id: null, preferences: {} });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: p, error: profileError } = await supabase.from("profiles").select("full_name, role, school_id, department_id, preferences").eq("id", user.id).maybeSingle();
      if (profileError) setError(profileError.message);
      let deptName = "";
      let schoolName = "";
      const preferences = (p?.preferences && typeof p.preferences === "object" ? p.preferences : {}) as ProfilePreferences;

      if (p?.department_id) {
        const { data: d } = await supabase.from("departments").select("name").eq("id", p.department_id).maybeSingle();
        deptName = d?.name || "";
      }
      if (p?.school_id) {
        const { data: s } = await supabase.from("schools").select("name").eq("id", p.school_id).maybeSingle();
        schoolName = s?.name || "";
      }

      setProfile({
        full_name: p?.full_name || "",
        email: user.email || "",
        role: p?.role || "head_of_department",
        department: deptName || preferences.department_name || "",
        school: schoolName || preferences.school_name || "",
      });
      setProfileLinks({ school_id: p?.school_id ?? null, department_id: p?.department_id ?? null, preferences });
      setLoading(false);
    }
    load();
  }, []);

  async function saveProfile() {
    const supabase = createClient();
    setSaving(true);
    setSaved(false);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Your session has expired. Please sign in again.");
      setSaving(false);
      return;
    }

    const preferences: ProfilePreferences = {
      ...profileLinks.preferences,
      school_name: profile.school.trim(),
      department_name: profile.department.trim(),
    };
    const { error: saveError } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: profile.full_name,
      role: profile.role,
      email: user.email ?? profile.email,
      preferences,
    });

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    const { data: organizationData, error: orgError } = await supabase.rpc("set_profile_organization", {
      p_school_name: profile.school.trim(),
      p_department_name: profile.department.trim(),
    }).maybeSingle();

    if (orgError) {
      setError(orgError.message);
      setSaving(false);
      return;
    }

    const organization = organizationData as { school_id: string; department_id: string } | null;

    setProfileLinks(current => ({
      school_id: organization?.school_id ?? current.school_id,
      department_id: organization?.department_id ?? current.department_id,
      preferences,
    }));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="p-6"><div className="skeleton h-8 w-32 mb-6" /><div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-16" />)}</div></div>;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {error && <div className="mb-4 flex items-start gap-2 rounded-md border border-error/30 bg-error/5 px-4 py-3 text-sm text-error" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      {/* Profile */}
      <div className="card mb-6">
        <div className="flex-between mb-4">
          <div className="flex items-center gap-4"><User className="w-5 h-5 text-muted" /><h2 className="text-lg font-semibold">Profile</h2></div>
          <button onClick={saveProfile} disabled={saving} className="btn btn-primary btn-sm">
            {saving ? <><Save className="w-3.5 h-3.5 animate-spin" /> Saving...</> : saved ? <><Check className="w-3.5 h-3.5" /> Saved</> : <><Save className="w-3.5 h-3.5" /> Save</>}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="form-label">Full Name</label><input className="form-input" value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} /></div>
          <div><label className="form-label">Email</label><input className="form-input" value={profile.email} disabled /></div>
          <div><label htmlFor="settings-department" className="form-label">Department</label><input id="settings-department" className="form-input" value={profile.department} onChange={e => setProfile(p => ({ ...p, department: e.target.value }))} placeholder="Enter your department" /></div>
          <div><label htmlFor="settings-school" className="form-label">School</label><input id="settings-school" className="form-input" value={profile.school} onChange={e => setProfile(p => ({ ...p, school: e.target.value }))} placeholder="Enter your school" /></div>
        </div>
      </div>

      {/* Notifications */}
      <div className="card mb-6">
        <div className="flex items-center gap-4 mb-4"><Bell className="w-5 h-5 text-muted" /><h2 className="text-lg font-semibold">Notifications</h2></div>
        <div className="space-y-3">
          {["In-app notifications", "Email notifications", "Push notifications"].map((label, i) => (
            <div key={i} className="flex-between py-2"><span className="text-sm">{label}</span><div className="w-10 h-6 rounded-full bg-border relative cursor-pointer"><div className={`w-5 h-5 rounded-full bg-surface absolute top-0.5 transition-all ${i === 0 ? "left-[18px] bg-primary" : "left-0.5"}`} /></div></div>
          ))}
        </div>
      </div>

      {/* AI Provider */}
      <div className="card mb-6">
        <div className="flex items-center gap-4 mb-4"><Bot className="w-5 h-5 text-muted" /><h2 className="text-lg font-semibold">AI Provider</h2></div>
        <select className="form-select w-full max-w-xs" defaultValue="mock">
          <option value="mock">Mock AI Mode</option>
          <option value="openai" disabled>OpenAI (requires API key)</option>
        </select>
        <p className="text-xs text-muted mt-2">Add OPENAI_API_KEY to your environment to enable OpenAI.</p>
      </div>

      {/* Integrations */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Integrations</h2>
        <div className="space-y-4">
          {[
            { name: "Google Calendar", desc: "Import or export calendar events", icon: Calendar, available: true },
            { name: "Microsoft Outlook", desc: "Import or export calendar events", icon: Calendar, available: true },
            { name: "Timetable Upload", desc: "CSV / XLSX import", icon: Upload, available: false },
          ].map((int, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-md border border-border bg-surface-alt">
              <int.icon className="w-5 h-5 text-muted shrink-0" />
              <div className="flex-1"><p className="text-sm font-medium">{int.name}</p><p className="text-xs text-muted">{int.desc}</p></div>
              {int.available ? <Link href="/calendar" className="btn btn-secondary btn-sm">Open</Link> : <><span className="badge badge-low text-xs shrink-0">Coming soon</span><button className="btn btn-secondary btn-sm" disabled>Connect</button></>}
            </div>
          ))}
        </div>
      </div>

      {/* Privacy */}
      <div className="card p-4 border-l-4 border-l-warning bg-warning-bg/10">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-warning mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Privacy & Data Protection</p>
            <p className="text-xs text-muted mt-1">This is a prototype. A production deployment requires formal school privacy approval, data retention policies, and compliance with local education authority data protection rules. Staff consent is required for observations and performance data.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
