"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Play, Archive, Clock, CheckCircle2 } from "lucide-react";

export default function WorkflowsPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [{ data: t }, { data: i }] = await Promise.all([
        supabase.from("workflow_templates").select("*").eq("is_archived", false).order("created_at"),
        supabase.from("workflow_instances").select("*").order("created_at", { ascending: false }),
      ]);
      setTemplates(t || []);
      setInstances(i || []);
      setLoading(false);
    }
    load();
  }, []);

  async function startWorkflow(templateId: string) {
    const template = templates.find(t => t.id === templateId);
    const { data } = await supabase.from("workflow_instances").insert({
      template_id: templateId,
      title: template?.title || "New Workflow",
      status: "in_progress",
      start_date: new Date().toISOString().split("T")[0],
      created_by: "00000000-0000-0000-0000-000000000000",
    }).select().single();
    if (data) setInstances(prev => [data, ...prev]);
  }

  async function archiveTemplate(id: string) {
    await supabase.from("workflow_templates").update({ is_archived: true }).eq("id", id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  if (loading) return <div className="p-6"><div className="skeleton h-8 w-32 mb-6" /><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3,4].map(i => <div key={i} className="skeleton h-40" />)}</div></div>;

  const activeInstances = instances.filter((i: any) => i.status !== "completed" && i.status !== "cancelled");

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex-between mb-6">
        <div><h1 className="text-2xl font-bold">Workflows</h1><p className="text-sm text-muted">{activeInstances.length} active, {templates.length} templates</p></div>
      </div>

      {/* Active instances */}
      {activeInstances.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Active Workflows</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeInstances.map((inst: any) => (
              <a key={inst.id} href={`/workflows/${inst.id}`} className="card card-hover">
                <div className="flex-between mb-2">
                  <span className="badge badge-medium text-xs">{inst.status}</span>
                  <Clock className="w-4 h-4 text-muted" />
                </div>
                <h3 className="font-semibold mb-1">{inst.title}</h3>
                {inst.start_date && <p className="text-xs text-muted">Started {inst.start_date}</p>}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Templates */}
      <h2 className="text-lg font-semibold mb-4">Workflow Templates</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t: any) => (
          <div key={t.id} className="card">
            <div className="flex-between mb-2">
              <span className="badge badge-low text-xs">{t.category}</span>
              <button onClick={() => archiveTemplate(t.id)} className="btn btn-ghost btn-icon btn-sm" title="Archive"><Archive className="w-4 h-4" /></button>
            </div>
            <h3 className="font-semibold mb-1">{t.title}</h3>
            {t.description && <p className="text-sm text-muted mb-3 line-clamp-2">{t.description}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => startWorkflow(t.id)} className="btn btn-primary btn-sm"><Play className="w-3.5 h-3.5" /> Start</button>
              <a href={`/workflows/${t.id}`} className="btn btn-secondary btn-sm">View</a>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center mt-8">
        <button className="btn btn-secondary"><Plus className="w-4 h-4" /> Create Custom Workflow</button>
      </div>
    </div>
  );
}
