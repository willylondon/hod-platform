"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, isOverdue } from "@/lib/utils";
import type { Task, Priority, TaskStatus } from "@/lib/types";
import { Plus, Search, Filter, CheckCircle2, Circle, Clock, AlertTriangle, X, LayoutList, LayoutGrid, Layers, Pencil } from "lucide-react";

const STATUSES: TaskStatus[] = ["not_started", "in_progress", "waiting", "completed", "cancelled"];
const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];
const STATUS_LABELS: Record<TaskStatus, string> = { not_started: "Not Started", in_progress: "In Progress", waiting: "Waiting", completed: "Completed", cancelled: "Cancelled" };

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: "", priority: "", search: "" });
  const [view, setView] = useState<"list" | "board" | "grouped">("list");
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const supabase = createClient();

  useEffect(() => { loadTasks(); }, []);
  async function loadTasks() {
    const { data } = await supabase.from("tasks").select("*").order("deadline", { ascending: true });
    setTasks(data || []);
    setLoading(false);
  }

  async function toggleStatus(task: Task) {
    const next: TaskStatus = task.status === "completed" ? "not_started" : "completed";
    await supabase.from("tasks").update({ status: next, completed_at: next === "completed" ? new Date().toISOString() : null }).eq("id", task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next, completed_at: next === "completed" ? new Date().toISOString() : undefined } : t));
  }

  async function createTask() {
    if (!newTitle.trim()) return;
    const { data } = await supabase.from("tasks").insert({ title: newTitle, priority: "medium", status: "not_started", created_by: "00000000-0000-0000-0000-000000000000" }).select().single();
    if (data) { setTasks(prev => [data, ...prev]); setNewTitle(""); setShowForm(false); }
  }

  const filtered = tasks.filter(t => {
    if (filter.status && t.status !== filter.status) return false;
    if (filter.priority && t.priority !== filter.priority) return false;
    if (filter.search && !t.title.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });

  const grouped = (groupBy: "status" | "priority") => {
    const keys = groupBy === "status" ? STATUSES : PRIORITIES;
    return keys.map(k => ({ key: k, tasks: filtered.filter(t => t[groupBy] === k) }));
  };

  if (loading) return <div className="p-6"><div className="skeleton h-8 w-32 mb-4" /><div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-16" />)}</div></div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-sm text-muted">{filtered.length} task{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary"><Plus className="w-4 h-4" /> New Task</button>
      </div>

      {/* Quick create */}
      {showForm && (
        <div className="card mb-4 p-3">
          <div className="flex gap-2">
            <input className="form-input flex-1" placeholder="Task title... (press Enter)" value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && createTask()} autoFocus />
            <button onClick={createTask} className="btn btn-primary btn-sm">Add</button>
            <button onClick={() => setShowForm(false)} className="btn btn-ghost btn-sm"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Filters + View toggle */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" /><input className="form-input pl-9" placeholder="Search tasks..." value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} /></div>
        <select className="form-select w-auto" value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select className="form-select w-auto" value={filter.priority} onChange={e => setFilter(f => ({ ...f, priority: e.target.value }))}>
          <option value="">All priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="flex border border-border rounded-md overflow-hidden">
          {(["list", "board", "grouped"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`btn btn-ghost btn-sm rounded-none ${view === v ? "bg-surface-alt" : ""}`}>
              {v === "list" ? <LayoutList className="w-4 h-4" /> : v === "board" ? <LayoutGrid className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks */}
      {filtered.length === 0 ? (
        <div className="text-center py-12"><p className="text-muted mb-2">No tasks found</p><button onClick={() => setShowForm(true)} className="btn btn-primary btn-sm"><Plus className="w-4 h-4" /> Create your first task</button></div>
      ) : view === "list" ? (
        <div className="space-y-2">
          {filtered.map(task => (
            <div key={task.id} className={`card flex items-center gap-3 py-3 ${task.status === "completed" ? "opacity-60" : ""}`}>
              <button onClick={() => toggleStatus(task)} className="shrink-0">{task.status === "completed" ? <CheckCircle2 className="w-5 h-5 text-success" /> : <Circle className="w-5 h-5 text-muted" />}</button>
              <span className={`flex-1 text-sm ${task.status === "completed" ? "line-through text-muted" : ""}`}>{task.title}</span>
              <span className={`priority-dot priority-${task.priority}`} title={task.priority} />
              {task.deadline && <span className={`text-xs ${isOverdue(task.deadline) && task.status !== "completed" ? "text-error font-medium" : "text-muted"}`}>{isOverdue(task.deadline) && task.status !== "completed" ? <><Clock className="w-3 h-3 inline mr-1" />Overdue</> : formatDate(task.deadline)}</span>}
              <span className={`badge text-xs ${task.status === "completed" ? "badge-success" : task.status === "in_progress" ? "badge-medium" : "badge-low"}`}>{STATUS_LABELS[task.status]}</span>
            </div>
          ))}
        </div>
      ) : view === "board" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {STATUSES.map(status => (
            <div key={status} className="space-y-2">
              <h3 className="text-sm font-semibold mb-2">{STATUS_LABELS[status]} ({filtered.filter(t => t.status === status).length})</h3>
              {filtered.filter(t => t.status === status).map(task => (
                <div key={task.id} className="card p-3 text-sm">
                  <div className="flex-between mb-2"><span>{task.title}</span><span className={`priority-dot priority-${task.priority}`} /></div>
                  {task.deadline && <p className="text-xs text-muted">{formatDate(task.deadline)}</p>}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped("status").filter(g => g.tasks.length > 0).map(g => (
            <div key={g.key}>
              <h3 className="text-sm font-semibold mb-3">{g.key in STATUS_LABELS ? STATUS_LABELS[g.key as TaskStatus] : g.key}</h3>
              <div className="space-y-2">
                {g.tasks.map(task => (
                  <div key={task.id} className="card flex items-center gap-3 py-3">
                    <button onClick={() => toggleStatus(task)} className="shrink-0">{task.status === "completed" ? <CheckCircle2 className="w-5 h-5 text-success" /> : <Circle className="w-5 h-5 text-muted" />}</button>
                    <span className="flex-1 text-sm">{task.title}</span>
                    <span className={`badge text-xs ${task.priority === "urgent" ? "badge-urgent" : task.priority === "high" ? "badge-high" : "badge-medium"}`}>{task.priority}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
