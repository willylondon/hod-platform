"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import type { DepartmentGoal } from "@/lib/types";
import { Plus, Target, X, AlertCircle } from "lucide-react";

export default function GoalsPage() {
  const [goals, setGoals] = useState<DepartmentGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.from("department_goals").select("*").order("target_date").then(({ data }) => {
      setGoals((data as DepartmentGoal[]) || []);
      setLoading(false);
    });
  }, [supabase]);

  async function createGoal(event?: React.FormEvent) {
    event?.preventDefault();
    const title = newTitle.trim();
    if (!title || creating) return;

    setCreating(true);
    setError(null);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setError("Your session has expired. Please sign in again before adding a goal.");
      setCreating(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("department_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile?.department_id) {
      setError("Add your department in Settings before creating a goal.");
      setCreating(false);
      return;
    }

    const now = new Date();
    const { data, error: insertError } = await supabase
      .from("department_goals")
      .insert({
        department_id: profile.department_id,
        title,
        academic_year: `${now.getFullYear()}-${now.getFullYear() + 1}`,
        term: "Term 1",
        target_date: newTargetDate || null,
        status: "planned",
        progress_percentage: 0,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setCreating(false);
      return;
    }

    setGoals(prev => [...prev, data as DepartmentGoal].sort((a, b) => (a.target_date || "").localeCompare(b.target_date || "")));
    setNewTitle("");
    setNewTargetDate("");
    setShowForm(false);
    setCreating(false);
  }

  if (loading) return <div className="p-6"><div className="skeleton h-8 w-32 mb-6" /><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3].map(i => <div key={i} className="skeleton h-28" />)}</div></div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex-between mb-6">
        <div><h1 className="text-2xl font-bold">Department Goals</h1><p className="text-sm text-muted">{goals.length} goals</p></div>
        <button onClick={() => setShowForm(s => !s)} className="btn btn-primary"><Plus className="w-4 h-4" /> New Goal</button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-error/30 bg-error/5 px-3 py-2.5 mb-4 text-sm text-error" role="alert">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <form onSubmit={createGoal} className="card flex flex-col sm:flex-row gap-3 mb-6">
          <input autoFocus className="form-input flex-1" placeholder="Goal title..." value={newTitle} onChange={e => setNewTitle(e.target.value)} />
          <input type="date" className="form-input sm:w-48" value={newTargetDate} onChange={e => setNewTargetDate(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" disabled={creating || !newTitle.trim()} className="btn btn-primary btn-sm">{creating ? "Adding..." : "Add"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost btn-sm" aria-label="Cancel new goal"><X className="w-4 h-4" /></button>
          </div>
        </form>
      )}

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
