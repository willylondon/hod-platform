"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getGreeting, formatDate, daysUntil, countdownUrgency, timeAgo } from "@/lib/utils";
import type { Task, Countdown, DepartmentGoal, Observation, Meeting, LeadershipQuote } from "@/lib/types";
import { Calendar, Clock, Flag, AlertTriangle, CheckCircle2, Eye, MessageSquareQuote, TrendingUp, Sparkles } from "lucide-react";

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [countdowns, setCountdowns] = useState<Countdown[]>([]);
  const [goals, setGoals] = useState<DepartmentGoal[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [quote, setQuote] = useState<LeadershipQuote | null>(null);
  const [firstName, setFirstName] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      const [{ data: profile }, { data: t }, { data: c }, { data: g }, { data: o }, { data: m }, { data: q }] = await Promise.all([
        userId ? supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("tasks").select("*").order("deadline", { ascending: true }),
        supabase.from("countdowns").select("*").order("event_date"),
        supabase.from("department_goals").select("*").order("target_date"),
        supabase.from("observations").select("*").order("scheduled_date", { ascending: false }),
        supabase.from("meetings").select("*").order("date"),
        supabase.from("leadership_quotes").select("*"),
      ]);

      if (profile?.full_name) {
        const parts = profile.full_name.split(" ");
        const titles = ["Dr.", "Mr.", "Mrs.", "Ms.", "Prof.", "Sir"];
        const first = titles.includes(parts[0]) ? (parts[1] || parts[0]) : parts[0];
        setFirstName(first);
      }
      setTasks(t || []);
      setCountdowns(c || []);
      setGoals(g || []);
      setObservations(o || []);
      setMeetings(m || []);
      setQuote(q?.[Math.floor(Math.random() * (q?.length || 1))] || { text: "The function of leadership is to produce more leaders, not followers.", author: "Ralph Nader" });
      setLoading(false);
    }
    load();
  }, [supabase]);

  const overdueTasks = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled" && t.deadline && new Date(t.deadline) < new Date());
  const todayTasks = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled" && t.deadline && new Date(t.deadline).toDateString() === new Date().toDateString());
  const upcomingTasks = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled" && t.deadline && new Date(t.deadline) > new Date() && daysUntil(t.deadline) <= 7);
  const recentlyCompleted = tasks.filter(t => t.status === "completed").slice(0, 5);
  const feedbackPending = observations.filter(o => o.status === "feedback_pending" || o.status === "coaching_pending");
  const todayMeetings = meetings.filter(m => m.date === new Date().toISOString().split("T")[0]);

  const recommendedAction = (() => {
    if (overdueTasks.filter(t => t.priority === "urgent").length > 0) return { icon: AlertTriangle, title: "Overdue urgent tasks", desc: `${overdueTasks.filter(t => t.priority === "urgent").length} urgent tasks are past deadline`, href: "/tasks", color: "var(--color-error)" };
    if (overdueTasks.length > 0) return { icon: Clock, title: "Overdue tasks need attention", desc: `${overdueTasks.length} tasks past deadline`, href: "/tasks", color: "var(--color-warning)" };
    if (todayTasks.length > 0) return { icon: Flag, title: "Tasks due today", desc: `${todayTasks.length} tasks to complete`, href: "/tasks", color: "var(--color-info)" };
    if (feedbackPending.length > 0) return { icon: Eye, title: "Feedback awaiting completion", desc: `${feedbackPending.length} observations need feedback`, href: "/observations", color: "var(--color-warning)" };
    if (upcomingTasks.length > 0) return { icon: Calendar, title: "Plan ahead", desc: `${upcomingTasks.length} tasks due this week`, href: "/tasks", color: "var(--color-info)" };
    return { icon: TrendingUp, title: "Review department goals", desc: "Check progress on active goals", href: "/goals", color: "var(--color-success)" };
  })();

  if (loading) return <div className="p-6"><div className="skeleton h-8 w-48 mb-4" /><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="skeleton h-32" /><div className="skeleton h-32" /><div className="skeleton h-32" /></div></div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-muted">{formatDate(new Date())}</p>
        <h1 className="text-2xl font-bold mt-1">{getGreeting()}{firstName ? `, ${firstName}` : ""}</h1>
      </div>

      {/* Quote */}
      {quote && (
        <div className="card mb-6 border-l-4 border-l-accent bg-surface">
          <div className="flex gap-3 items-start">
            <MessageSquareQuote className="w-5 h-5 text-accent mt-0.5 shrink-0" />
            <div>
              <p className="text-sm italic text-text">&ldquo;{quote.text}&rdquo;</p>
              <p className="text-xs text-muted mt-1">&mdash; {quote.author}</p>
            </div>
          </div>
        </div>
      )}

      {/* Recommended action */}
      <div className="card mb-6 cursor-pointer hover:border-primary-light transition-colors" onClick={() => window.location.href = recommendedAction.href}>
        <div className="flex gap-3 items-center">
          <recommendedAction.icon className="w-8 h-8 shrink-0" style={{ color: recommendedAction.color }} />
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">Recommended Next Action</p>
            <p className="font-semibold">{recommendedAction.title}</p>
            <p className="text-sm text-muted">{recommendedAction.desc}</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <QuickStat icon={AlertTriangle} label="Overdue" value={overdueTasks.length} color="var(--color-error)" />
        <QuickStat icon={Flag} label="Due Today" value={todayTasks.length} color="var(--color-info)" />
        <QuickStat icon={Eye} label="Feedback Pending" value={feedbackPending.length} color="var(--color-warning)" />
        <QuickStat icon={Calendar} label="Today's Meetings" value={todayMeetings.length} color="var(--color-primary)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Tasks */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex-between mb-4">
              <h2 className="text-lg font-semibold">Today's Priorities</h2>
              <a href="/tasks" className="text-sm text-primary hover:underline">View all</a>
            </div>
            {[...overdueTasks, ...todayTasks, ...upcomingTasks].slice(0, 8).length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No tasks due. Well done!</p>
            ) : (
              <div className="space-y-2">
                {[...overdueTasks, ...todayTasks, ...upcomingTasks].slice(0, 8).map(t => (
                  <div key={t.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <span className="priority-dot" style={{ backgroundColor: t.priority === "urgent" ? "var(--color-error)" : t.priority === "high" ? "var(--color-warning)" : "var(--color-info)" }} />
                    <span className="flex-1 text-sm">{t.title}</span>
                    <span className={`badge text-xs ${t.priority === "urgent" ? "badge-urgent" : t.priority === "high" ? "badge-high" : "badge-medium"}`}>{t.priority}</span>
                    {t.deadline && <span className="text-xs text-muted">{formatDate(t.deadline)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Countdowns */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Countdowns</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {countdowns.slice(0, 4).map(c => {
                const days = daysUntil(c.event_date);
                const urgency = countdownUrgency(days);
                return (
                  <div key={c.id} className="p-3 rounded-md border border-border bg-surface-alt">
                    <div className="flex-between mb-2">
                      <span className="text-sm font-medium">{c.title}</span>
                      <span className={`badge text-xs ${urgency === "critical" ? "badge-urgent" : urgency === "urgent" ? "badge-high" : urgency === "important" ? "badge-medium" : "badge-low"}`}>
                        {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `${days}d`}
                      </span>
                    </div>
                    <div className="w-full bg-border rounded-full h-1.5"><div className="bg-primary h-1.5 rounded-full" style={{ width: `${c.completion_percentage}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          {/* Today's meetings */}
          <div className="card">
            <div className="flex-between mb-4">
              <h2 className="text-lg font-semibold">Today's Meetings</h2>
              <a href="/meetings" className="text-sm text-primary hover:underline">All</a>
            </div>
            {todayMeetings.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No meetings today</p>
            ) : (
              todayMeetings.map(m => (
                <div key={m.id} className="py-2 border-b border-border last:border-0">
                  <p className="text-sm font-medium">{m.title}</p>
                  <p className="text-xs text-muted">{m.start_time} – {m.end_time} · {m.location}</p>
                </div>
              ))
            )}
          </div>

          {/* Goals */}
          <div className="card">
            <div className="flex-between mb-4">
              <h2 className="text-lg font-semibold">Department Goals</h2>
              <a href="/goals" className="text-sm text-primary hover:underline">All</a>
            </div>
            {goals.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No goals set</p>
            ) : (
              goals.map(g => (
                <div key={g.id} className="py-2 border-b border-border last:border-0">
                  <div className="flex-between">
                    <p className="text-sm font-medium">{g.title}</p>
                    <span className={`badge text-xs ${g.status === "achieved" ? "badge-success" : g.status === "at_risk" ? "badge-urgent" : g.status === "active" ? "badge-medium" : "badge-low"}`}>{g.status.replace("_", " ")}</span>
                  </div>
                  <div className="w-full bg-border rounded-full h-1.5 mt-2"><div className="bg-primary h-1.5 rounded-full" style={{ width: `${g.progress_percentage}%` }} /></div>
                </div>
              ))
            )}
          </div>

          {/* Recently completed */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Recently Completed</h2>
            {recentlyCompleted.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">Nothing completed yet</p>
            ) : (
              recentlyCompleted.map(t => (
                <div key={t.id} className="flex items-center gap-3 py-1.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  <span className="flex-1">{t.title}</span>
                  <span className="text-xs text-muted">{t.completed_at ? timeAgo(t.completed_at) : ""}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStat({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="card flex items-center gap-3">
      <Icon className="w-5 h-5 shrink-0" style={{ color }} />
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}
