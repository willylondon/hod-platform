"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { Plus, TrendingUp, Target } from "lucide-react";

export default function GoalsPage() {
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase.from("department_goals").select("*").order("target_date").then(({ data }) => {
      setGoals(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6"><div className="skeleton h-8 w-32 mb-6" /><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3].map(i => <div key={i} className="skeleton h-28" />)}</div></div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex-between mb-6">
        <div><h1 className="text-2xl font-bold">Department Goals</h1><p className="text-sm text-muted">{goals.length} goals</p></div>
        <button className="btn btn-primary"><Plus className="w-4 h-4" /> New Goal</button>
      </div>
      {goals.length === 0 ? (
        <div className="text-center py-12"><Target className="w-12 h-12 text-muted mx-auto mb-4" /><p className="text-muted">No department goals set</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map(g => (
            <div key={g.id} className="card">
              <div className="flex-between mb-3"><span className="text-sm font-semibold">{g.title}</span><span className={`badge text-xs ${g.status === "achieved" ? "badge-success" : g.status === "at_risk" ? "badge-urgent" : g.status === "active" ? "badge-medium" : "badge-low"}`}>{g.status.replace("_", " ")}</span></div>
              {g.description && <p className="text-sm text-muted mb-3">{g.description}</p>}
              <div className="w-full bg-border rounded-full h-2 mb-2"><div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${g.progress_percentage}%` }} /></div>
              <div className="flex-between text-xs text-muted">
                <span>{g.progress_percentage}%</span>
                <span>{g.academic_year} · {g.term}</span>
                {g.target_date && <span>Target: {formatDate(g.target_date)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
