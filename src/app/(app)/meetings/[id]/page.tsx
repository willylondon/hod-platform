"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Clock, MapPin, Users, CheckCheck, Sparkles, Plus } from "lucide-react";

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [meeting, setMeeting] = useState<any>(null);
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: m } = await supabase.from("meetings").select("*").eq("id", id).single();
      if (m) {
        setMeeting(m);
        const { data: a } = await supabase.from("meeting_actions").select("*").eq("meeting_id", m.id);
        setActions(a || []);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="p-6"><div className="skeleton h-8 w-48 mb-6" /><div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-20" />)}</div></div>;
  if (!meeting) return <div className="p-6 text-center"><p className="text-muted">Meeting not found</p></div>;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto animate-fade-in">
      <a href="/meetings" className="text-sm text-muted hover:text-text flex items-center gap-1 mb-4"><ArrowLeft className="w-4 h-4" /> Back to Meetings</a>
      <div className="flex-between mb-2"><h1 className="text-2xl font-bold">{meeting.title}</h1><span className="badge badge-medium text-xs">{meeting.meeting_type.replace("_", " ")}</span></div>
      <div className="flex flex-wrap gap-3 mb-6 text-sm text-muted">
        <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {meeting.date} · {meeting.start_time} – {meeting.end_time}</span>
        {meeting.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {meeting.location}</span>}
      </div>

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
            {!a.converted_to_task_id && <button className="btn btn-ghost btn-sm text-xs">Convert to Task</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
