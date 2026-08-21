"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Meeting, MeetingAction } from "@/lib/types";
import { ArrowLeft, Clock, MapPin, CheckCheck, Sparkles, Plus, AlertCircle } from "lucide-react";

const MEETING_TYPES = [
  { label: "Department Meeting", value: "department" },
  { label: "Parent Meeting", value: "parent" },
  { label: "Teacher Coaching", value: "coaching" },
  { label: "One-to-One", value: "one_to_one" },
  { label: "Standardisation Meeting", value: "standardization" },
  { label: "Professional Development", value: "professional_development" },
  { label: "Senior Leadership", value: "senior_leadership" },
  { label: "Other", value: "other" },
];

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [actions, setActions] = useState<MeetingAction[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [newMeeting, setNewMeeting] = useState({
    title: "",
    meeting_type: "department",
    date: "",
    start_time: "",
    end_time: "",
    location: "",
    agenda: "",
  });
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function load() {
      if (isNew) { setLoading(false); return; }
      const { data: m } = await supabase.from("meetings").select("*").eq("id", id).single();
      if (m) {
        setMeeting(m as Meeting);
        const { data: a } = await supabase.from("meeting_actions").select("*").eq("meeting_id", m.id);
        setActions((a as MeetingAction[]) || []);
      }
      setLoading(false);
    }
    load();
  }, [id, isNew, supabase]);

  async function saveMeeting(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newMeeting.title.trim();
    if (!title || !newMeeting.date || !newMeeting.start_time || !newMeeting.end_time || saving) return;

    setSaving(true);
    setError(null);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setError("Your session has expired. Please sign in again.");
      setSaving(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("meetings")
      .insert({
        title,
        meeting_type: newMeeting.meeting_type,
        date: newMeeting.date,
        start_time: newMeeting.start_time,
        end_time: newMeeting.end_time,
        location: newMeeting.location.trim() || null,
        agenda: newMeeting.agenda.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    router.push(`/meetings/${data.id}`);
  }

  async function convertToTask(action: MeetingAction) {
    setError(null);
    setConvertingId(action.id);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setError("Your session has expired. Please sign in again.");
      setConvertingId(null);
      return;
    }

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        title: action.title,
        priority: "medium",
        status: "not_started",
        is_recurring: false,
        deadline: action.deadline || null,
        assigned_to: action.assigned_to || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (taskError) {
      setError(`Couldn't create task: ${taskError.message}`);
      setConvertingId(null);
      return;
    }

    const { error: updateError } = await supabase
      .from("meeting_actions")
      .update({ converted_to_task_id: task.id })
      .eq("id", action.id);

    if (updateError) {
      setError(`Task created, but couldn't link it back to this action: ${updateError.message}`);
      setConvertingId(null);
      return;
    }

    setActions(prev => prev.map(a => a.id === action.id ? { ...a, converted_to_task_id: task.id } : a));
    setConvertingId(null);
  }

  if (loading) return <div className="p-6"><div className="skeleton h-8 w-48 mb-6" /><div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-20" />)}</div></div>;

  // New meeting form
  if (isNew) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto animate-fade-in">
        <Link href="/meetings" className="text-sm text-muted hover:text-text flex items-center gap-1 mb-4"><ArrowLeft className="w-4 h-4" /> Back to Meetings</Link>
        <h1 className="text-2xl font-bold mb-6">New Meeting</h1>
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-error/30 bg-error/5 px-3 py-2.5 mb-4 text-sm text-error" role="alert">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <form onSubmit={saveMeeting} className="card">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="form-label">Meeting Title</label><input className="form-input" placeholder="e.g. Department Planning Meeting" value={newMeeting.title} onChange={e => setNewMeeting(m => ({ ...m, title: e.target.value }))} required /></div>
            <div><label className="form-label">Meeting Type</label><select className="form-select" value={newMeeting.meeting_type} onChange={e => setNewMeeting(m => ({ ...m, meeting_type: e.target.value }))}>
              {MEETING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select></div>
            <div><label className="form-label">Date</label><input type="date" className="form-input" value={newMeeting.date} onChange={e => setNewMeeting(m => ({ ...m, date: e.target.value }))} required /></div>
            <div><label className="form-label">Start Time</label><input type="time" className="form-input" value={newMeeting.start_time} onChange={e => setNewMeeting(m => ({ ...m, start_time: e.target.value }))} required /></div>
            <div><label className="form-label">End Time</label><input type="time" className="form-input" value={newMeeting.end_time} onChange={e => setNewMeeting(m => ({ ...m, end_time: e.target.value }))} required /></div>
            <div><label className="form-label">Location</label><input className="form-input" placeholder="e.g. Conference Room A" value={newMeeting.location} onChange={e => setNewMeeting(m => ({ ...m, location: e.target.value }))} /></div>
            <div className="sm:col-span-2"><label className="form-label">Agenda</label><textarea className="form-input" rows={4} placeholder="Enter agenda items..." value={newMeeting.agenda} onChange={e => setNewMeeting(m => ({ ...m, agenda: e.target.value }))} /></div>
          </div>
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={saving || !newMeeting.title.trim() || !newMeeting.date || !newMeeting.start_time || !newMeeting.end_time} className="btn btn-primary">{saving ? "Saving..." : "Save Meeting"}</button>
            <Link href="/meetings" className="btn btn-secondary">Cancel</Link>
          </div>
        </form>
      </div>
    );
  }

  if (!meeting) return <div className="p-6 text-center"><p className="text-muted">Meeting not found</p></div>;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto animate-fade-in">
      <Link href="/meetings" className="text-sm text-muted hover:text-text flex items-center gap-1 mb-4"><ArrowLeft className="w-4 h-4" /> Back to Meetings</Link>
      <div className="flex-between mb-2"><h1 className="text-2xl font-bold">{meeting.title}</h1><span className="badge badge-medium text-xs">{meeting.meeting_type.replace("_", " ")}</span></div>
      <div className="flex flex-wrap gap-3 mb-6 text-sm text-muted">
        <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {meeting.date} · {meeting.start_time} – {meeting.end_time}</span>
        {meeting.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {meeting.location}</span>}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-error/30 bg-error/5 px-3 py-2.5 mb-4 text-sm text-error" role="alert">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {meeting.agenda && (
        <div className="card mb-6">
          <div className="flex-between mb-3"><h2 className="text-lg font-semibold">Agenda</h2><button className="btn btn-ghost btn-sm"><Sparkles className="w-4 h-4" /> AI: Generate</button></div>
          <pre className="text-sm whitespace-pre-wrap font-sans">{meeting.agenda}</pre>
        </div>
      )}

      {meeting.notes && (
        <div className="card mb-6">
          <div className="flex-between mb-3"><h2 className="text-lg font-semibold">Notes</h2><button className="btn btn-ghost btn-sm"><Sparkles className="w-4 h-4" /> AI: Summarize</button></div>
          <pre className="text-sm whitespace-pre-wrap font-sans">{meeting.notes}</pre>
        </div>
      )}

      {meeting.decisions && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-3">Decisions</h2>
          <pre className="text-sm whitespace-pre-wrap font-sans">{meeting.decisions}</pre>
        </div>
      )}

      <div className="card">
        <div className="flex-between mb-3"><h2 className="text-lg font-semibold">Action Items</h2><button className="btn btn-ghost btn-sm"><Plus className="w-4 h-4" /> Add</button></div>
        {actions.length === 0 ? <p className="text-sm text-muted py-4 text-center">No action items</p> : actions.map(a => (
          <div key={a.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
            <CheckCheck className={`w-4 h-4 ${a.completed ? "text-success" : "text-muted"}`} />
            <span className="flex-1 text-sm">{a.title}</span>
            {a.converted_to_task_id ? (
              <span className="text-xs text-muted">Converted</span>
            ) : (
              <button onClick={() => convertToTask(a)} disabled={convertingId === a.id} className="btn btn-ghost btn-sm text-xs">{convertingId === a.id ? "Converting..." : "Convert to Task"}</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
