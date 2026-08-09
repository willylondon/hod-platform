"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CalendarSync,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Info,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Unplug,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

type CalendarSource = "event" | "meeting" | "observation" | "task" | "google";
type DisplayEvent = {
  id: string;
  title: string;
  date: string;
  source: CalendarSource;
  start?: string;
  end?: string | null;
  allDay?: boolean;
  description?: string | null;
  location?: string | null;
  htmlLink?: string | null;
};
type GoogleCalendarPayload = {
  configured: boolean;
  connected: boolean;
  lastSyncedAt?: string | null;
  events?: Array<{
    id: string;
    title: string;
    date: string;
    start?: string;
    end?: string | null;
    allDay?: boolean;
    description?: string | null;
    location?: string | null;
    htmlLink?: string | null;
  }>;
  error?: string;
};

const SOURCE_STYLES: Record<CalendarSource, string> = {
  event: "bg-info-bg text-info",
  meeting: "bg-accent-light/40 text-text",
  observation: "bg-success-bg text-success",
  task: "bg-warning-bg text-warning",
  google: "bg-[#e8f0fe] text-[#1967d2]",
};

const SOURCE_LABELS: Record<CalendarSource, string> = {
  event: "HoD event",
  meeting: "Meeting",
  observation: "Observation",
  task: "Task deadline",
  google: "Google Calendar",
};

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function displayDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    .format(new Date(year, month - 1, day, 12));
}

function displayTiming(event: DisplayEvent) {
  if (event.allDay || !event.start || !event.start.includes("T")) return `${displayDate(event.date)} · All day`;
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : null;
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  return `${displayDate(event.date)} · ${time.format(start)}${end && Number.isFinite(end.getTime()) ? `–${time.format(end)}` : ""}`;
}

function sourceHref(event: DisplayEvent) {
  if (event.source === "meeting") return `/meetings/${event.id.slice("meeting-".length)}`;
  if (event.source === "observation") return `/observations/${event.id.slice("observation-".length)}`;
  if (event.source === "task") return "/tasks";
  return null;
}

export default function CalendarPage() {
  const [today] = useState(() => new Date());
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<DisplayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<DisplayEvent | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [eventEdit, setEventEdit] = useState({ title: "", date: "" });
  const [newEvent, setNewEvent] = useState({ title: "", date: dateKey(today.getFullYear(), today.getMonth(), today.getDate()) });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [googleCalendar, setGoogleCalendar] = useState<GoogleCalendarPayload>({ configured: false, connected: false });

  const loadEvents = useCallback(async (showSyncMessage = false) => {
    if (showSyncMessage) setSyncing(true);
    else setLoading(true);
    setError(null);
    const supabase = createClient();
    const timeMin = new Date(Date.UTC(year, month, 1)).toISOString();
    const timeMax = new Date(Date.UTC(year, month + 1, 1)).toISOString();
    const googleRequest = fetch(`/api/google-calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, {
      cache: "no-store",
    });
    const [customResult, meetingsResult, observationsResult, tasksResult, staffResult, googleResponse] = await Promise.all([
      supabase.from("calendar_events").select("id, title, start_date"),
      supabase.from("meetings").select("id, title, date"),
      supabase.from("observations").select("id, scheduled_date, teacher_id"),
      supabase.from("tasks").select("id, title, deadline").not("deadline", "is", null),
      supabase.from("staff").select("id, full_name"),
      googleRequest,
    ]);

    const googlePayload = await googleResponse.json() as GoogleCalendarPayload;
    setGoogleCalendar(googlePayload);
    const firstError = [customResult.error, meetingsResult.error, observationsResult.error, tasksResult.error, staffResult.error].find(Boolean);
    if (firstError) setError(firstError.message);
    else if (!googleResponse.ok && googlePayload.error) setError(googlePayload.error);
    const staffById = new Map((staffResult.data ?? []).map(member => [member.id, member.full_name]));

    const combined: DisplayEvent[] = [
      ...(customResult.data ?? []).map(row => ({ id: `event-${row.id}`, title: row.title, date: row.start_date, start: row.start_date, allDay: true, source: "event" as const })),
      ...(meetingsResult.data ?? []).map(row => ({ id: `meeting-${row.id}`, title: row.title, date: row.date, start: row.date, allDay: true, source: "meeting" as const })),
      ...(observationsResult.data ?? []).filter(row => row.scheduled_date).map(row => {
        const teacherName = staffById.get(row.teacher_id);
        return { id: `observation-${row.id}`, title: `Observation${teacherName ? `: ${teacherName}` : ""}`, date: row.scheduled_date as string, start: row.scheduled_date as string, allDay: true, source: "observation" as const };
      }),
      ...(tasksResult.data ?? []).filter(row => row.deadline).map(row => ({ id: `task-${row.id}`, title: row.title, date: row.deadline!.slice(0, 10), start: row.deadline, allDay: false, source: "task" as const })),
      ...(googlePayload.events ?? []).map(event => ({ ...event, id: `google-${event.id}`, source: "google" as const })),
    ];

    setEvents(combined);
    if (showSyncMessage && googlePayload.connected && googleResponse.ok) {
      setMessage("Google Calendar is up to date.");
    }
    setLoading(false);
    setSyncing(false);
  }, [month, year]);

  useEffect(() => {
    queueMicrotask(() => void loadEvents());
  }, [loadEvents]);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("googleCalendar");
    if (!result) return;
    queueMicrotask(() => {
      if (result === "connected") setMessage("Google Calendar connected. Your events now sync automatically.");
      else if (result === "cancelled") setMessage("Google Calendar connection was cancelled.");
      else if (result === "not_configured") setError("Google Calendar setup is not complete yet.");
      else if (result === "session_expired") setError("Your session expired. Sign in and connect Google Calendar again.");
      else setError("Google Calendar could not be connected. Please try again.");
    });
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, DisplayEvent[]>();
    for (const event of events) grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
    return grouped;
  }, [events]);

  const monthEvents = useMemo(() => events
    .filter(event => event.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`))
    .toSorted((a, b) => (a.start || a.date).localeCompare(b.start || b.date)), [events, month, year]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const isToday = (day: number) => year === today.getFullYear() && month === today.getMonth() && day === today.getDate();

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newEvent.title.trim() || !newEvent.date || saving) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Your session has expired. Please sign in again.");
      setSaving(false);
      return;
    }
    const { data, error: insertError } = await supabase.from("calendar_events").insert({
      title: newEvent.title.trim(),
      start_date: newEvent.date,
      all_day: true,
      event_type: "custom",
      created_by: user.id,
    }).select("id, title, start_date").single();
    if (insertError || !data) {
      setError(insertError?.message ?? "The event could not be saved.");
      setSaving(false);
      return;
    }
    setEvents(current => [...current, { id: `event-${data.id}`, title: data.title, date: data.start_date, source: "event" }]);
    setNewEvent(current => ({ ...current, title: "" }));
    setShowForm(false);
    setSaving(false);
    setMessage("Event added to your HoD calendar.");
  }

  function exportCalendar() {
    const body = events.filter(event => event.source !== "google").map(event => {
      const compactDate = event.date.replaceAll("-", "");
      return ["BEGIN:VEVENT", `UID:${escapeIcs(event.id)}@hod-platform`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`, `DTSTART;VALUE=DATE:${compactDate}`, `SUMMARY:${escapeIcs(event.title)}`, "END:VEVENT"].join("\r\n");
    }).join("\r\n");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HoD Platform//Calendar//EN", "CALSCALE:GREGORIAN", body, "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `hod-calendar-${new Date().toISOString().slice(0, 10)}.ics`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Exported your HoD calendar items.");
  }

  async function disconnectGoogleCalendar() {
    setDisconnecting(true);
    setError(null);
    const response = await fetch("/api/google-calendar/connection", { method: "DELETE" });
    const payload = await response.json() as { error?: string };
    if (!response.ok) {
      setError(payload.error || "Could not disconnect Google Calendar.");
      setDisconnecting(false);
      return;
    }
    setGoogleCalendar(current => ({ ...current, connected: false, events: [] }));
    setEvents(current => current.filter(event => event.source !== "google"));
    setMessage("Google Calendar disconnected.");
    setDisconnecting(false);
  }

  function openEvent(event: DisplayEvent) {
    setSelectedDay(null);
    setSelectedEvent(event);
    setEditingEvent(false);
    setEventEdit({ title: event.title, date: event.date });
  }

  async function saveEventEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEvent || selectedEvent.source !== "event" || !eventEdit.title.trim() || !eventEdit.date) return;
    setSavingEdit(true);
    setError(null);
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("calendar_events")
      .update({ title: eventEdit.title.trim(), start_date: eventEdit.date })
      .eq("id", selectedEvent.id.slice("event-".length))
      .select("id, title, start_date")
      .single();
    if (updateError || !data) {
      setError(updateError?.message || "The event could not be updated.");
      setSavingEdit(false);
      return;
    }
    const updated = { ...selectedEvent, title: data.title, date: data.start_date, start: data.start_date };
    setEvents(current => current.map(item => item.id === selectedEvent.id ? updated : item));
    setSelectedEvent(updated);
    setEditingEvent(false);
    setSavingEdit(false);
    setMessage("HoD event updated.");
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div><h1 className="text-2xl font-bold">Calendar</h1><p className="text-sm text-muted">{MONTHS[month]} {year} · HoD work and Google events together</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" onClick={exportCalendar} disabled={!events.some(event => event.source !== "google")}><Download className="w-4 h-4" /> Export HoD calendar</button>
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New Event</button>
        </div>
      </div>

      <div className="card mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <CalendarSync className="mt-0.5 h-5 w-5 shrink-0 text-[#1967d2]" aria-hidden />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">Google Calendar</h2>
              {googleCalendar.connected && <span className="badge badge-low"><Check className="h-3 w-3" /> Connected</span>}
            </div>
            <p className="mt-1 text-sm text-muted">
              {googleCalendar.connected
                ? "Events sync automatically. Select one to view details or open it in Google Calendar to edit."
                : googleCalendar.configured
                  ? "Connect once—no calendar files or repeated uploads required."
                  : "Google Calendar is awaiting administrator setup."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:shrink-0">
          {googleCalendar.connected ? <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadEvents(true)} disabled={syncing}><RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Syncing…" : "Sync now"}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={disconnectGoogleCalendar} disabled={disconnecting}><Unplug className="h-4 w-4" />{disconnecting ? "Disconnecting…" : "Disconnect"}</button>
          </> : googleCalendar.configured
            ? <a className="btn btn-primary btn-sm" href="/api/google-calendar/connect"><CalendarSync className="h-4 w-4" />Connect Google</a>
            : <button type="button" className="btn btn-primary btn-sm" disabled><CalendarSync className="h-4 w-4" />Connect Google</button>}
        </div>
      </div>

      {showForm && <form className="card mb-4" onSubmit={createEvent}>
        <div className="mb-3 flex-between"><h2 className="text-base font-semibold">New HoD Event</h2><button type="button" className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)} aria-label="Close new event form"><X className="w-4 h-4" /></button></div>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <div><label htmlFor="calendar-event-title" className="form-label">Event title</label><input id="calendar-event-title" className="form-input" value={newEvent.title} onChange={event => setNewEvent(value => ({ ...value, title: event.target.value }))} required autoFocus /></div>
          <div><label htmlFor="calendar-event-date" className="form-label">Date</label><input id="calendar-event-date" type="date" className="form-input" value={newEvent.date} onChange={event => setNewEvent(value => ({ ...value, date: event.target.value }))} required /></div>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Add event"}</button>
        </div>
      </form>}

      {error && <div className="mb-4 rounded-md border border-error/30 bg-error/5 px-4 py-3 text-sm text-error" role="alert">{error}</div>}
      {message && <div className="mb-4 rounded-md border border-success/30 bg-success-bg px-4 py-3 text-sm text-success" role="status">{message}</div>}

      <div className="card mb-4 p-3 flex items-center justify-center gap-4">
        <button onClick={prevMonth} className="btn btn-ghost btn-icon" aria-label="Previous month"><ChevronLeft className="w-5 h-5" /></button>
        <span className="font-semibold text-lg min-w-[180px] text-center">{MONTHS[month]} {year}</span>
        <button onClick={nextMonth} className="btn btn-ghost btn-icon" aria-label="Next month"><ChevronRight className="w-5 h-5" /></button>
      </div>

      {loading ? <div className="skeleton h-[520px] w-full" /> : <>
      <div className="space-y-2 sm:hidden">
        {monthEvents.length ? monthEvents.map(event => (
          <button key={event.id} type="button" onClick={() => openEvent(event)} className="flex w-full items-start gap-3 rounded-lg border border-border bg-surface p-3 text-left">
            <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md bg-surface-alt text-xs font-semibold">
              <span className="uppercase text-muted">{new Date(`${event.date}T12:00:00`).toLocaleDateString(undefined, { month: "short" })}</span>
              <span className="text-base text-text">{Number(event.date.slice(-2))}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{event.title}</span>
              <span className="mt-1 block text-xs text-muted">{SOURCE_LABELS[event.source]} · {displayTiming(event).split(" · ").at(-1)}</span>
            </span>
            <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted" aria-hidden />
          </button>
        )) : <div className="card py-10 text-center text-sm text-muted">No events this month.</div>}
      </div>

      <div className="hidden grid-cols-7 gap-px overflow-hidden rounded-lg bg-border sm:grid">
        {DAYS.map(day => <div key={day} className="p-2 text-center text-xs font-semibold bg-surface text-muted">{day}</div>)}
        {Array.from({ length: startOffset }).map((_, index) => <div key={`empty-${index}`} className="min-h-[112px] bg-surface-alt p-2" />)}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          const dayDate = dateKey(year, month, day);
          const dayEvents = eventsByDate.get(dayDate) ?? [];
          return (
            <div key={day} className={`min-h-[112px] bg-surface p-2 text-sm ${isToday(day) ? "ring-2 ring-primary ring-inset" : ""}`}>
              <span className={`font-medium ${isToday(day) ? "text-primary" : ""}`}>{day}</span>
              {dayEvents.slice(0, 3).map(event => <button type="button" onClick={() => openEvent(event)} key={event.id} title={`View ${event.title}`} className={`mt-1 block w-full truncate rounded px-1.5 py-1 text-left text-xs transition-opacity hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${SOURCE_STYLES[event.source]}`}>{event.title}</button>)}
              {dayEvents.length > 3 && <button type="button" onClick={() => setSelectedDay(dayDate)} className="mt-1 text-xs font-medium text-primary hover:underline">+{dayEvents.length - 3} more</button>}
            </div>
          );
        })}
      </div></>}

      <div className="mt-6 card p-4 flex items-start gap-3 bg-surface-alt">
        <Info className="w-5 h-5 text-muted mt-0.5 shrink-0" />
        <div className="text-sm text-muted"><p className="font-medium text-text">Select any calendar item</p><p className="mt-1">Open an item to see its full date, time, location and notes. Google events remain securely synced and can be edited through their direct Google Calendar link.</p></div>
      </div>

      {selectedDay && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedDay(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="day-events-title" className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:max-w-lg sm:rounded-xl">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div><p className="text-sm text-muted">Daily agenda</p><h2 id="day-events-title" className="text-xl font-semibold">{displayDate(selectedDay)}</h2></div>
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setSelectedDay(null)} aria-label="Close daily agenda"><X className="h-5 w-5" /></button>
          </div>
          <div className="space-y-2">
            {(eventsByDate.get(selectedDay) ?? []).map(event => <button key={event.id} type="button" onClick={() => openEvent(event)} className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-surface-alt">
              <span className={`h-9 w-1 rounded-full ${SOURCE_STYLES[event.source].split(" ")[0]}`} aria-hidden />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{event.title}</span><span className="mt-0.5 block text-xs text-muted">{SOURCE_LABELS[event.source]} · {displayTiming(event).split(" · ").at(-1)}</span></span>
              <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
            </button>)}
          </div>
        </section>
      </div>}

      {selectedEvent && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedEvent(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="event-details-title" className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:max-w-xl sm:rounded-xl sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{SOURCE_LABELS[selectedEvent.source]}</p><h2 id="event-details-title" className="text-xl font-semibold leading-tight sm:text-2xl">{selectedEvent.title}</h2></div>
            <button type="button" className="btn btn-ghost btn-icon shrink-0" onClick={() => setSelectedEvent(null)} aria-label="Close event details"><X className="h-5 w-5" /></button>
          </div>

          {editingEvent ? <form onSubmit={saveEventEdit} className="space-y-4">
            <div><label htmlFor="edit-event-title" className="form-label">Event title</label><input id="edit-event-title" className="form-input" value={eventEdit.title} onChange={event => setEventEdit(current => ({ ...current, title: event.target.value }))} required autoFocus /></div>
            <div><label htmlFor="edit-event-date" className="form-label">Date</label><input id="edit-event-date" type="date" className="form-input" value={eventEdit.date} onChange={event => setEventEdit(current => ({ ...current, date: event.target.value }))} required /></div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="btn btn-secondary" onClick={() => setEditingEvent(false)} disabled={savingEdit}>Cancel</button><button type="submit" className="btn btn-primary" disabled={savingEdit}>{savingEdit ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Save changes"}</button></div>
          </form> : <>
            <div className="space-y-4 rounded-lg bg-surface-alt p-4">
              <div className="flex items-start gap-3"><Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden /><div><p className="text-xs font-medium uppercase tracking-wide text-muted">When</p><p className="mt-0.5 text-sm">{displayTiming(selectedEvent)}</p></div></div>
              {selectedEvent.location && <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden /><div><p className="text-xs font-medium uppercase tracking-wide text-muted">Location</p><p className="mt-0.5 whitespace-pre-wrap text-sm">{selectedEvent.location}</p></div></div>}
              {selectedEvent.description && <div className="flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden /><div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wide text-muted">Notes</p><p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{selectedEvent.description}</p></div></div>}
              {!selectedEvent.location && !selectedEvent.description && <div className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden /><p className="text-sm text-muted">No location or notes were added to this event.</p></div>}
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              {selectedEvent.source === "event" && <button type="button" className="btn btn-secondary" onClick={() => setEditingEvent(true)}><Pencil className="h-4 w-4" />Edit HoD event</button>}
              {sourceHref(selectedEvent) && <Link className="btn btn-secondary" href={sourceHref(selectedEvent)!}><ExternalLink className="h-4 w-4" />Open {SOURCE_LABELS[selectedEvent.source].toLowerCase()}</Link>}
              {selectedEvent.source === "google" && selectedEvent.htmlLink && <a className="btn btn-primary" href={selectedEvent.htmlLink} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Edit in Google Calendar</a>}
            </div>
          </>}
        </section>
      </div>}
    </div>
  );
}
