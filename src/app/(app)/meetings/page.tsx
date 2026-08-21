"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Meeting } from "@/lib/types";
import { Plus, Clock, MapPin } from "lucide-react";

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.from("meetings").select("*").order("date", { ascending: false }).then(({ data }) => {
      setMeetings((data as Meeting[]) || []);
      setLoading(false);
    });
  }, [supabase]);

  if (loading) return <div className="p-6"><div className="skeleton h-8 w-32 mb-6" /><div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-20" />)}</div></div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex-between mb-6">
        <div><h1 className="text-2xl font-bold">Meetings</h1><p className="text-sm text-muted">{meetings.length} meetings</p></div>
        <Link href="/meetings/new" className="btn btn-primary"><Plus className="w-4 h-4" /> New Meeting</Link>
      </div>
      {meetings.length === 0 ? (
        <div className="text-center py-12"><p className="text-muted">No meetings yet</p></div>
      ) : (
        <div className="space-y-3">
          {meetings.map(m => (
            <Link key={m.id} href={`/meetings/${m.id}`} className="card card-hover flex flex-col sm:flex-row sm:items-center gap-4 py-4">
              <div className="text-center min-w-[60px]">
                <p className="text-xs text-muted uppercase">{new Date(m.date).toLocaleString("en", { month: "short" })}</p>
                <p className="text-xl font-bold">{new Date(m.date).getDate()}</p>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{m.title}</h3>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {m.start_time} – {m.end_time}</span>
                  {m.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {m.location}</span>}
                </div>
              </div>
              <span className={`badge text-xs ${m.meeting_type === "department" ? "badge-medium" : m.meeting_type === "senior_leadership" ? "badge-high" : "badge-low"}`}>{m.meeting_type.replace("_", " ")}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
