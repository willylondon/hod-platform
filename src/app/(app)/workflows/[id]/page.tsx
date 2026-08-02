"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, Circle, Clock, Play } from "lucide-react";

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [instance, setInstance] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: inst } = await supabase.from("workflow_instances").select("*").eq("id", id).single();
      if (inst) {
        setInstance(inst);
        const { data: s } = await supabase.from("workflow_steps").select("*").eq("template_id", inst.template_id).order("sort_order");
        setSteps(s || []);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="p-6"><div className="skeleton h-8 w-48 mb-6" /><div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="skeleton h-12" />)}</div></div>;
  if (!instance) return <div className="p-6 text-center"><p className="text-muted">Workflow not found</p></div>;

  const completed = steps.filter((s: any) => s.completed).length;
  const pct = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto animate-fade-in">
      <a href="/workflows" className="text-sm text-muted hover:text-text flex items-center gap-1 mb-4"><ArrowLeft className="w-4 h-4" /> Back to Workflows</a>
      <div className="flex-between mb-2"><h1 className="text-2xl font-bold">{instance.title}</h1><span className={`badge text-xs ${instance.status === "completed" ? "badge-success" : instance.status === "in_progress" ? "badge-medium" : "badge-low"}`}>{instance.status}</span></div>
      {instance.start_date && <p className="text-sm text-muted mb-4">Started {instance.start_date}</p>}

      {/* Progress */}
      <div className="card mb-6">
        <div className="flex-between mb-3"><span className="text-sm font-medium">Progress</span><span className="text-sm text-muted">{completed}/{steps.length} steps</span></div>
        <div className="w-full bg-border rounded-full h-2.5"><div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((s: any, i: number) => (
          <div key={s.id} className="card flex items-center gap-3 py-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${s.completed ? "bg-success text-white" : "bg-border text-muted"}`}>{i + 1}</div>
            <span className="flex-1 text-sm">{s.title}</span>
            {s.relative_due_day && <span className="text-xs text-muted">Day {s.relative_due_day}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
