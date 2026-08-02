"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, Mail, GraduationCap, Eye } from "lucide-react";

export default function StaffPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase.from("staff").select("*").order("full_name").then(({ data }) => {
      setStaff(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6"><div className="skeleton h-8 w-32 mb-6" /><div className="space-y-3">{[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-16" />)}</div></div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex-between mb-6">
        <div><h1 className="text-2xl font-bold">Staff Directory</h1><p className="text-sm text-muted">{staff.length} staff members</p></div>
      </div>
      {staff.length === 0 ? (
        <div className="text-center py-12"><Users className="w-12 h-12 text-muted mx-auto mb-4" /><p className="text-muted">No staff records</p></div>
      ) : (
        <div className="space-y-2">
          {staff.map(s => (
            <div key={s.id} className="card flex flex-col sm:flex-row sm:items-center gap-3 py-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0">{s.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}</div>
              <div className="flex-1">
                <p className="font-medium">{s.full_name}</p>
                <p className="text-sm text-muted">{s.job_title}{s.subject ? ` · ${s.subject}` : ""}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <Mail className="w-3.5 h-3.5" /> {s.email}
              </div>
              <span className={`badge text-xs ${s.status === "active" ? "badge-success" : "badge-low"}`}>{s.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
