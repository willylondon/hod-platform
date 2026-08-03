"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Download, Info, Loader2, Plus, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

type CalendarSource = "event" | "meeting" | "observation" | "task";
type DisplayEvent = {
  id: string;
  title: string;
  date: string;
  source: CalendarSource;
};

const SOURCE_STYLES: Record<CalendarSource, string> = {
  event: "bg-info-bg text-info",
  meeting: "bg-accent-light/40 text-text",
  observation: "bg-success-bg text-success",
  task: "bg-warning-bg text-warning",
};

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function unescapeIcs(value: string) {
  return value.replace(/\\n/gi, "\n").replace(/\\([\\,;])/g, "$1");
}

function parseIcs(text: string): { title: string; date: string }[] {
  const lines = text.replace(/\r\n[ \t]/g, "").split(/\r?\n/);
  const parsed: { title: string; date: string }[] = [];
  let current: { title?: string; date?: string } | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") current = {};
    else if (line === "END:VEVENT") {
      if (current?.title && current.date) parsed.push({ title: current.title, date: current.date });
      current = null;
    } else if (current && line.startsWith("SUMMARY")) {
      current.title = unescapeIcs(line.slice(line.indexOf(":") + 1)).trim();
    } else if (current && line.startsWith("DTSTART")) {
      const raw = line.slice(line.indexOf(":") + 1).trim();
      const match = raw.match(/^(\d{4})(\d{2})(\d{2})/);
      if (match) current.date = `${match[1]}-${match[2]}-${match[3]}`;
    }
  }
  return parsed;
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<DisplayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", date: dateKey(today.getFullYear(), today.getMonth(), today.getDate()) });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    const supabase = createClient();
    const [customResult, meetingsResult, observationsResult, tasksResult, staffResult] = await Promise.all([
      supabase.from("calendar_events").select("id, title, start_date"),
      supabase.from("meetings").select("id, title, date"),
      supabase.from("observations").select("id, scheduled_date, teacher_id"),
      supabase.from("tasks").select("id, title, deadline").not("deadline", "is", null),
      supabase.from("staff").select("id, full_name"),
    ]);

    const firstError = [customResult.error, meetingsResult.error, observationsResult.error, tasksResult.error, staffResult.error].find(Boolean);
    if (firstError) setError(firstError.message);
    const staffById = new Map((staffResult.data ?? []).map(member => [member.id, member.full_name]));

    const combined: DisplayEvent[] = [
      ...(customResult.data ?? []).map(row => ({ id: `event-${row.id}`, title: row.title, date: row.start_date, source: "event" as const })),
      ...(meetingsResult.data ?? []).map(row => ({ id: `meeting-${row.id}`, title: row.title, date: row.date, source: "meeting" as const })),
      ...(observationsResult.data ?? []).filter(row => row.scheduled_date).map(row => {
        const teacherName = staffById.get(row.teacher_id);
        return { id: `observation-${row.id}`, title: `Observation${teacherName ? `: ${teacherName}` : ""}`, date: row.scheduled_date as string, source: "observation" as const };
      }),
      ...(tasksResult.data ?? []).filter(row => row.deadline).map(row => ({ id: `task-${row.id}`, title: row.title, date: row.deadline!.slice(0, 10), source: "task" as const })),
    ];

    setEvents(combined);
    setLoading(false);
  }

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, DisplayEvent[]>();
    for (const event of events) grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
    return grouped;
  }, [events]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const isToday = (d: number) => year === today.getFullYear() && month === today.getMonth() && d === today.getDate();

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
    setMessage("Event added to your calendar.");
  }

  function exportCalendar() {
    const body = events.map(event => {
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
    setMessage(`Exported ${events.length} calendar item${events.length === 1 ? "" : "s"}.`);
  }

  async function importCalendar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    setError(null);
    setMessage(null);
    const parsed = parseIcs(await file.text());
    if (!parsed.length) {
      setError("No calendar events were found in that .ics file.");
      setImporting(false);
      return;
    }
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Your session has expired. Please sign in again.");
      setImporting(false);
      return;
    }
    const { error: importError } = await supabase.from("calendar_events").insert(parsed.map(item => ({
      title: item.title,
      start_date: item.date,
      all_day: true,
      event_type: "custom",
      created_by: user.id,
    })));
    if (importError) {
      setError(importError.message);
      setImporting(false);
      return;
    }
    await loadEvents();
    setImporting(false);
    setMessage(`Imported ${parsed.length} calendar event${parsed.length === 1 ? "" : "s"}.`);
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div><h1 className="text-2xl font-bold">Calendar</h1><p className="text-sm text-muted">{MONTHS[month]} {year} · tasks, meetings and observations included</p></div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileInputRef} type="file" accept=".ics,text/calendar" className="hidden" onChange={importCalendar} />
          <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>{importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import .ics</button>
          <button type="button" className="btn btn-secondary" onClick={exportCalendar} disabled={!events.length}><Download className="w-4 h-4" /> Export .ics</button>
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New Event</button>
        </div>
      </div>

      {showForm && <form className="card mb-4" onSubmit={createEvent}>
        <div className="mb-3 flex-between"><h2 className="text-base font-semibold">New Event</h2><button type="button" className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)} aria-label="Close new event form"><X className="w-4 h-4" /></button></div>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <div><label htmlFor="calendar-event-title" className="form-label">Event title</label><input id="calendar-event-title" className="form-input" value={newEvent.title} onChange={e => setNewEvent(value => ({ ...value, title: e.target.value }))} required autoFocus /></div>
          <div><label htmlFor="calendar-event-date" className="form-label">Date</label><input id="calendar-event-date" type="date" className="form-input" value={newEvent.date} onChange={e => setNewEvent(value => ({ ...value, date: e.target.value }))} required /></div>
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

      {loading ? <div className="skeleton h-[520px] w-full" /> : <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {DAYS.map(d => <div key={d} className="p-2 text-center text-xs font-semibold bg-surface text-muted">{d}</div>)}
        {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} className="p-2 min-h-[80px] bg-surface-alt" />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayEvents = eventsByDate.get(dateKey(year, month, day)) ?? [];
          return (
            <div key={day} className={`p-2 min-h-[80px] bg-surface border-t border-border text-sm ${isToday(day) ? "ring-2 ring-primary ring-inset" : ""}`}>
              <span className={`font-medium ${isToday(day) ? "text-primary" : ""}`}>{day}</span>
              {dayEvents.slice(0, 3).map(event => <div key={event.id} title={event.title} className={`text-xs mt-0.5 px-1 py-0.5 rounded truncate ${SOURCE_STYLES[event.source]}`}>{event.title}</div>)}
              {dayEvents.length > 3 && <div className="mt-1 text-xs text-muted">+{dayEvents.length - 3} more</div>}
            </div>
          );
        })}
      </div>}

      <div className="mt-6 card p-4 flex items-start gap-3 bg-surface-alt">
        <Info className="w-5 h-5 text-muted mt-0.5 shrink-0" />
        <div className="text-sm text-muted"><p className="font-medium text-text">Calendar transfer is ready</p><p className="mt-1">Export this calendar as an .ics file for Google Calendar, Outlook or Apple Calendar, or import an .ics file from any of those services. Tasks, meetings and scheduled observations appear automatically.</p></div>
      </div>
    </div>
  );
}
