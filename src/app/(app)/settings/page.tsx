"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notification-preferences";
import Link from "next/link";
import { User, Bell, Bot, Calendar, Upload, Shield, Save, Check, AlertCircle, Mail, Smartphone, Send } from "lucide-react";

type ProfilePreferences = {
  school_name?: string;
  department_name?: string;
  [key: string]: unknown;
};

type TelegramConnection = {
  configured: boolean;
  connected: boolean;
  botUsername?: string;
  telegramUsername?: string | null;
  firstName?: string | null;
};

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [notificationsSaved, setNotificationsSaved] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState({ full_name: "", email: "", role: "", department: "", school: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileLinks, setProfileLinks] = useState<{ school_id: string | null; department_id: string | null; preferences: ProfilePreferences }>({ school_id: null, department_id: null, preferences: {} });
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [telegramConnection, setTelegramConnection] = useState<TelegramConnection>({ configured: false, connected: false });
  const [telegramBusy, setTelegramBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [{ data: p, error: profileError }, { data: savedSettings }] = await Promise.all([
        supabase.from("profiles").select("full_name, role, school_id, department_id, preferences").eq("id", user.id).maybeSingle(),
        supabase.from("settings").select("notification_preferences").eq("user_id", user.id).maybeSingle(),
      ]);
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
      setNotificationPreferences(normalizeNotificationPreferences(savedSettings?.notification_preferences));
      setLoading(false);
    }
    load();
    fetch("/api/notifications/capabilities")
      .then((response) => response.ok ? response.json() : null)
      .then((capabilities: { emailConfigured?: boolean } | null) => setEmailConfigured(Boolean(capabilities?.emailConfigured)))
      .catch(() => setEmailConfigured(false));
  }, []);

  useEffect(() => {
    async function refreshTelegramConnection() {
      const response = await fetch("/api/telegram/connection");
      if (!response.ok) return;
      const connection = await response.json() as TelegramConnection;
      setTelegramConnection(connection);
      if (connection.connected) {
        setNotificationPreferences((current) => current.telegram ? current : { ...current, telegram: true });
      }
    }

    refreshTelegramConnection().catch(() => null);
    const handleFocus = () => refreshTelegramConnection().catch(() => null);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") handleFocus();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    queueMicrotask(() => {
      setIsIOS(ios);
      setIsStandalone(standalone);
    });

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(async (registration) => {
        setPushSupported(true);
        const subscription = await registration.pushManager.getSubscription();
        setPushSubscribed(Boolean(subscription));
      })
      .catch(() => setPushSupported(false));
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

  async function persistNotificationPreferences(preferences: NotificationPreferences) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    const { error: saveError } = await supabase.from("settings").upsert({
      user_id: user.id,
      notification_preferences: preferences,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (saveError) throw saveError;
  }

  async function saveNotificationPreferences() {
    setSavingNotifications(true);
    setNotificationsSaved(false);
    setError(null);

    try {
      await persistNotificationPreferences(notificationPreferences);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save reminder settings.");
      setSavingNotifications(false);
      return;
    }

    setSavingNotifications(false);
    setNotificationsSaved(true);
    setTimeout(() => setNotificationsSaved(false), 2000);
  }

  function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    const bytes = new Uint8Array(new ArrayBuffer(raw.length));
    for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
    return bytes;
  }

  async function enablePhoneNotifications() {
    setPushBusy(true);
    setError(null);
    try {
      const keyResponse = await fetch("/api/push/subscriptions");
      const keyPayload = await keyResponse.json() as { publicKey?: string; error?: string };
      if (!keyResponse.ok || !keyPayload.publicKey) throw new Error(keyPayload.error || "Phone notifications are not available.");

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyPayload.publicKey),
      });
      const saveResponse = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const savePayload = await saveResponse.json() as { error?: string };
      if (!saveResponse.ok) throw new Error(savePayload.error || "Could not enable phone notifications.");

      const next = { ...notificationPreferences, push: true };
      await persistNotificationPreferences(next);
      setNotificationPreferences(next);
      setPushSubscribed(true);
    } catch (pushError) {
      if (pushError instanceof DOMException && pushError.name === "NotAllowedError") {
        setError("Notification permission was declined. Allow notifications for this site in your phone settings, then try again.");
      } else {
        setError(pushError instanceof Error ? pushError.message : "Could not enable phone notifications.");
      }
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePhoneNotifications() {
    setPushBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) {
          const payload = await response.json() as { error?: string };
          throw new Error(payload.error || "Could not disable phone notifications.");
        }
        await subscription.unsubscribe();
      }
      const next = { ...notificationPreferences, push: false };
      await persistNotificationPreferences(next);
      setNotificationPreferences(next);
      setPushSubscribed(false);
    } catch (pushError) {
      setError(pushError instanceof Error ? pushError.message : "Could not disable phone notifications.");
    } finally {
      setPushBusy(false);
    }
  }

  async function connectTelegram() {
    setTelegramBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/telegram/connection", { method: "POST" });
      const payload = await response.json() as { connectUrl?: string; error?: string };
      if (!response.ok || !payload.connectUrl) {
        throw new Error(payload.error || "Could not start the Telegram connection.");
      }
      window.location.assign(payload.connectUrl);
    } catch (telegramError) {
      setError(telegramError instanceof Error ? telegramError.message : "Could not connect Telegram.");
      setTelegramBusy(false);
    }
  }

  async function disconnectTelegram() {
    setTelegramBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/telegram/connection", { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not disconnect Telegram.");
      setTelegramConnection((current) => ({ ...current, connected: false, telegramUsername: null, firstName: null }));
      setNotificationPreferences((current) => ({ ...current, telegram: false }));
    } catch (telegramError) {
      setError(telegramError instanceof Error ? telegramError.message : "Could not disconnect Telegram.");
    } finally {
      setTelegramBusy(false);
    }
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
        <div className="flex-between mb-4 gap-4">
          <div className="flex items-center gap-4"><Bell className="w-5 h-5 text-muted" /><div><h2 className="text-lg font-semibold">Task Reminders</h2><p className="text-xs text-muted">Choose where and when deadline reminders are delivered.</p></div></div>
          <button onClick={saveNotificationPreferences} disabled={savingNotifications} className="btn btn-primary btn-sm shrink-0">
            {savingNotifications ? <><Save className="w-3.5 h-3.5 animate-spin" /> Saving...</> : notificationsSaved ? <><Check className="w-3.5 h-3.5" /> Saved</> : <><Save className="w-3.5 h-3.5" /> Save</>}
          </button>
        </div>
        <div className="space-y-3">
          <NotificationToggle
            label="In-app notifications"
            description="Show reminders in the notification bell."
            checked={notificationPreferences.in_app}
            onChange={(checked) => setNotificationPreferences((current) => ({ ...current, in_app: checked }))}
          />
          <NotificationToggle
            label="Email reminders"
            description={emailConfigured ? `Send deadline reminders to ${profile.email}.` : "Email provider setup is awaiting a verified sending domain."}
            checked={notificationPreferences.email}
            icon={Mail}
            disabled={!emailConfigured}
            onChange={(checked) => setNotificationPreferences((current) => ({ ...current, email: checked }))}
          />
          <div className="rounded-md border border-border px-3 py-3">
            <div className="flex-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <div>
                  <p className="text-sm font-medium">Phone push notifications</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {pushSubscribed ? "Enabled on this device. Deadline alerts can appear on your lock screen." : "Get a ping on this device when a deadline is approaching or overdue."}
                  </p>
                </div>
              </div>
              {pushSubscribed ? (
                <button type="button" className="btn btn-secondary btn-sm shrink-0" disabled={pushBusy} onClick={disablePhoneNotifications}>{pushBusy ? "Working…" : "Disable"}</button>
              ) : (
                <button type="button" className="btn btn-primary btn-sm shrink-0" disabled={pushBusy || !pushSupported || (isIOS && !isStandalone)} onClick={enablePhoneNotifications}>{pushBusy ? "Enabling…" : "Enable"}</button>
              )}
            </div>
            {isIOS && !isStandalone && (
              <p className="mt-3 rounded-md bg-warning-bg px-3 py-2 text-xs text-warning">On iPhone, open this page in Safari, tap Share, choose <strong>Add to Home Screen</strong>, then open the installed app to enable notifications.</p>
            )}
            {!pushSupported && <p className="mt-2 text-xs text-muted">This browser does not support phone notifications.</p>}
          </div>
          <div className={`rounded-md border border-border px-3 py-3 ${!telegramConnection.configured ? "opacity-50" : ""}`}>
            <div className="flex-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <Send className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <div>
                  <p className="text-sm font-medium">Telegram reminders</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {telegramConnection.connected
                      ? `Connected${telegramConnection.telegramUsername ? ` as @${telegramConnection.telegramUsername}` : telegramConnection.firstName ? ` as ${telegramConnection.firstName}` : ""}. Task reminders will arrive in this private chat.`
                      : telegramConnection.configured
                        ? "Connect the HoD Platform bot, then press Start in Telegram."
                        : "The Telegram reminder bot is awaiting setup."}
                  </p>
                </div>
              </div>
              {telegramConnection.connected ? (
                <button type="button" className="btn btn-secondary btn-sm shrink-0" disabled={telegramBusy} onClick={disconnectTelegram}>{telegramBusy ? "Working…" : "Disconnect"}</button>
              ) : (
                <button type="button" className="btn btn-primary btn-sm shrink-0" disabled={telegramBusy || !telegramConnection.configured} onClick={connectTelegram}>{telegramBusy ? "Connecting…" : "Connect"}</button>
              )}
            </div>
          </div>
          <NotificationToggle
            label="Deadline alerts"
            description="Alert 7 days before, 1 day before, on the due date, and each day overdue."
            checked={notificationPreferences.deadline_reminders}
            onChange={(checked) => setNotificationPreferences((current) => ({ ...current, deadline_reminders: checked }))}
          />
          <NotificationToggle
            label="Daily outstanding-task reminder"
            description="Create one outstanding-task summary each day."
            checked={notificationPreferences.daily_task_digest}
            onChange={(checked) => setNotificationPreferences((current) => ({ ...current, daily_task_digest: checked }))}
          />
          <NotificationToggle
            label="Weekly outstanding-task reminder"
            description="Send a broader outstanding-task overview every Monday."
            checked={notificationPreferences.weekly_task_digest}
            onChange={(checked) => setNotificationPreferences((current) => ({ ...current, weekly_task_digest: checked }))}
          />
        </div>
      </div>

      {/* AI Provider */}
      <div className="card mb-6">
        <div className="flex items-center gap-4 mb-4"><Bot className="w-5 h-5 text-muted" /><h2 className="text-lg font-semibold">AI Provider</h2></div>
        <select className="form-select w-full max-w-xs" defaultValue="mock">
          <option value="mock">Mock AI Mode</option>
          <option value="openrouter" disabled>OpenRouter (requires API key)</option>
        </select>
        <p className="text-xs text-muted mt-2">Add OPENROUTER_API_KEY to your environment to enable live AI.</p>
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

function NotificationToggle({
  label,
  description,
  checked,
  disabled = false,
  icon: Icon,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  icon?: typeof Bell;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className={`flex-between gap-4 rounded-md border border-border px-3 py-3 ${disabled ? "opacity-50" : ""}`}>
      <div className={Icon ? "flex min-w-0 items-start gap-3" : ""}>
        {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />}
        <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-border"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-sm transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
