"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, Check, Clock, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/utils";
import type { Notification, Task } from "@/lib/types";

type NotificationPreferences = {
  in_app?: boolean;
  daily_task_digest?: boolean;
  weekly_task_digest?: boolean;
};

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function digestMessage(tasks: Task[]): string {
  const now = new Date();
  const weekFromNow = new Date(now);
  weekFromNow.setDate(now.getDate() + 7);
  const overdue = tasks.filter((task) => task.deadline && new Date(task.deadline) < now).length;
  const dueSoon = tasks.filter((task) => {
    if (!task.deadline) return false;
    const deadline = new Date(task.deadline);
    return deadline >= now && deadline <= weekFromNow;
  }).length;
  const details = [
    overdue ? `${overdue} overdue` : null,
    dueSoon ? `${dueSoon} due in the next 7 days` : null,
  ].filter(Boolean);
  return `You have ${tasks.length} outstanding task${tasks.length === 1 ? "" : "s"}${details.length ? ` — ${details.join(" and ")}` : ""}.`;
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) {
        if (active) setLoading(false);
        return;
      }

      const [{ data: settings }, { data: taskRows }] = await Promise.all([
        supabase.from("settings").select("notification_preferences").eq("user_id", user.id).maybeSingle(),
        supabase.from("tasks").select("*").eq("created_by", user.id).not("status", "in", '("completed","cancelled")'),
      ]);

      const preferences = (settings?.notification_preferences ?? {}) as NotificationPreferences;
      const tasks = (taskRows as Task[] | null) ?? [];
      const now = new Date();
      const pending: Array<{
        user_id: string;
        title: string;
        message: string;
        related_url: string;
        delivery_key: string;
      }> = [];

      if (preferences.in_app !== false && tasks.length > 0) {
        if (preferences.daily_task_digest !== false) {
          pending.push({
            user_id: user.id,
            title: "Daily task reminder",
            message: digestMessage(tasks),
            related_url: "/tasks",
            delivery_key: `task-digest-daily:${localDateKey(now)}`,
          });
        }
        if (preferences.weekly_task_digest !== false && now.getDay() === 1) {
          pending.push({
            user_id: user.id,
            title: "Weekly task reminder",
            message: digestMessage(tasks),
            related_url: "/tasks",
            delivery_key: `task-digest-weekly:${localDateKey(now)}`,
          });
        }
      }

      if (pending.length > 0) {
        await supabase.from("notifications").upsert(pending, {
          onConflict: "user_id,delivery_key",
          ignoreDuplicates: true,
        });
      }

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (active) {
        setNotifications((data as Notification[] | null) ?? []);
        setLoading(false);
      }
    }

    loadNotifications();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function markAllRead() {
    const unreadIds = notifications.filter((item) => !item.is_read).map((item) => item.id);
    if (unreadIds.length === 0) return;
    const supabase = createClient();
    const { error } = await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    if (!error) setNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
  }

  async function markRead(id: string) {
    const item = notifications.find((notification) => notification.id === id);
    if (!item || item.is_read) return;
    const supabase = createClient();
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((items) => items.map((notification) => notification.id === id ? { ...notification, is_read: true } : notification));
  }

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="btn btn-ghost btn-icon relative"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[0.625rem] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-12 z-50 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-base font-semibold">Notifications</h2>
              <p className="text-xs text-muted">Daily and weekly task reminders</p>
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="btn btn-ghost btn-sm">
                <Check className="h-3.5 w-3.5" aria-hidden /> Mark read
              </button>
            )}
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading reminders…
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Bell className="mx-auto mb-3 h-7 w-7 text-muted" aria-hidden />
                <p className="text-sm font-medium">You’re all caught up</p>
                <p className="mt-1 text-xs text-muted">Outstanding-task reminders will appear here.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <Link
                  key={item.id}
                  href={item.related_url || "/tasks"}
                  onClick={() => { markRead(item.id); setOpen(false); }}
                  className={`block border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-surface-alt ${item.is_read ? "" : "bg-info-bg/40"}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.is_read ? "bg-border" : "bg-info"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted">{item.message}</p>
                      <p className="mt-1.5 flex items-center gap-1 text-[0.6875rem] text-muted">
                        <Clock className="h-3 w-3" aria-hidden /> {timeAgo(item.created_at)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="border-t border-border bg-surface-alt px-4 py-2 text-center">
            <Link href="/settings" onClick={() => setOpen(false)} className="text-xs font-medium text-primary hover:underline">
              Manage reminder schedule
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
