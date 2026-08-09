import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { normalizeNotificationPreferences } from "@/lib/notification-preferences";
import { pushStatusCode, sendReminderEmail, sendReminderPush } from "@/lib/reminder-delivery";
import {
  localDateKey,
  reminderCopy,
  scheduledDeadlineReminders,
  weekdayInTimezone,
  type ScheduledTaskReminder,
} from "@/lib/task-reminders";
import type { Task } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ProfileRow = { id: string; email: string; full_name: string };
type SettingsRow = { user_id: string; notification_preferences: unknown };
type PushRow = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
type DeliveryRow = { user_id: string; channel: "email" | "push"; delivery_key: string };

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] || character);
}

function formatDeadline(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-JM", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function emailHtml(
  profile: ProfileRow,
  reminders: ScheduledTaskReminder[],
  outstanding: Task[],
  timezone: string,
  mode: "deadline" | "daily" | "weekly"
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://hod-platform.vercel.app";
  const digest = mode !== "deadline";
  const items = (digest ? outstanding : reminders.map((item) => item.task)).slice(0, 20);
  const list = items.map((task) => `<li style="margin-bottom:12px"><strong>${escapeHtml(task.title)}</strong>${task.deadline ? `<br><span style="color:#5f6b7a">Due ${escapeHtml(formatDeadline(task.deadline, timezone))} · ${escapeHtml(task.priority)} priority</span>` : ""}</li>`).join("");
  const intro = digest
    ? `Here is your ${mode} overview of ${outstanding.length} outstanding task${outstanding.length === 1 ? "" : "s"}.`
    : `You have ${reminders.length} task deadline reminder${reminders.length === 1 ? "" : "s"} today.`;

  const heading = mode === "weekly" ? "Your weekly task overview" : mode === "daily" ? "Your daily task overview" : "Upcoming task deadlines";
  const total = digest ? outstanding.length : reminders.length;
  return `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#1f2933"><div style="max-width:600px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border-radius:12px;padding:28px;border:1px solid #dde3e8"><p style="margin-top:0;color:#697586;font-size:14px">HoD Productivity Platform</p><h1 style="font-size:24px;margin:0 0 12px">${heading}</h1><p>Hello ${escapeHtml(profile.full_name || "there")},</p><p>${intro}</p><ul style="padding-left:20px">${list}</ul>${items.length < total ? `<p>And ${total - items.length} more.</p>` : ""}<p style="margin:26px 0 0"><a href="${appUrl}/tasks" style="display:inline-block;background:#294f71;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600">Review your tasks</a></p></div><p style="font-size:12px;color:#697586;text-align:center">Manage reminder preferences in Settings.</p></div></body></html>`;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const now = new Date();
  const [{ data: profiles, error: profileError }, { data: settings, error: settingsError }, { data: tasks, error: taskError }, { data: subscriptions, error: pushError }, { data: deliveries, error: deliveryError }] = await Promise.all([
    admin.from("profiles").select("id,email,full_name"),
    admin.from("settings").select("user_id,notification_preferences"),
    admin.from("tasks").select("*").not("status", "in", '("completed","cancelled")'),
    admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth"),
    admin.from("notification_deliveries").select("user_id,channel,delivery_key").gte("created_at", new Date(now.getTime() - 14 * 86_400_000).toISOString()),
  ]);

  const dataError = profileError || settingsError || taskError || pushError || deliveryError;
  if (dataError) {
    console.error("task reminder query error", dataError);
    return NextResponse.json({ error: "Could not load reminders" }, { status: 500 });
  }

  const preferencesByUser = new Map((settings as SettingsRow[] | null ?? []).map((row) => [row.user_id, normalizeNotificationPreferences(row.notification_preferences)]));
  const tasksByUser = new Map<string, Task[]>();
  for (const task of tasks as Task[] | null ?? []) {
    tasksByUser.set(task.created_by, [...(tasksByUser.get(task.created_by) ?? []), task]);
  }
  const pushByUser = new Map<string, PushRow[]>();
  for (const subscription of subscriptions as PushRow[] | null ?? []) {
    pushByUser.set(subscription.user_id, [...(pushByUser.get(subscription.user_id) ?? []), subscription]);
  }
  const delivered = new Set((deliveries as DeliveryRow[] | null ?? []).map((row) => `${row.user_id}:${row.channel}:${row.delivery_key}`));

  let inAppCount = 0;
  let emailCount = 0;
  let pushCount = 0;
  let failureCount = 0;

  for (const profile of profiles as ProfileRow[] | null ?? []) {
    const preferences = preferencesByUser.get(profile.id) ?? normalizeNotificationPreferences(null);
    const userTasks = tasksByUser.get(profile.id) ?? [];
    if (userTasks.length === 0) continue;
    const dateKey = localDateKey(now, preferences.timezone);
    const reminders = preferences.deadline_reminders
      ? scheduledDeadlineReminders(userTasks, now, preferences.timezone)
      : [];
    const digestMessage = `You have ${userTasks.length} outstanding task${userTasks.length === 1 ? "" : "s"}${reminders.length ? ` and ${reminders.length} deadline alert${reminders.length === 1 ? "" : "s"} today` : ""}.`;

    if (preferences.in_app) {
      if (preferences.daily_task_digest) {
        const { error } = await admin.from("notifications").upsert({
          user_id: profile.id,
          title: "Daily task reminder",
          message: digestMessage,
          related_url: "/tasks",
          delivery_key: `task-digest-daily:${dateKey}`,
        }, { onConflict: "user_id,delivery_key", ignoreDuplicates: true });
        if (error) failureCount += 1;
        else inAppCount += 1;
      }
      for (const reminder of reminders) {
        const copy = reminderCopy(reminder);
        const deliveryKey = `task-deadline:${reminder.task.id}:${reminder.window}:${reminder.window === "overdue" ? dateKey : "once"}`;
        const { error } = await admin.from("notifications").upsert({
          user_id: profile.id,
          title: copy.title,
          message: copy.message,
          related_url: "/tasks",
          delivery_key: deliveryKey,
        }, { onConflict: "user_id,delivery_key", ignoreDuplicates: true });
        if (error) failureCount += 1;
        else inAppCount += 1;
      }
    }

    const isMonday = weekdayInTimezone(now, preferences.timezone) === "Monday";
    const shouldSendWeekly = preferences.weekly_task_digest && isMonday;
    if (preferences.in_app && shouldSendWeekly) {
      const { error } = await admin.from("notifications").upsert({
        user_id: profile.id,
        title: "Weekly task reminder",
        message: digestMessage,
        related_url: "/tasks",
        delivery_key: `task-digest-weekly:${dateKey}`,
      }, { onConflict: "user_id,delivery_key", ignoreDuplicates: true });
      if (error) failureCount += 1;
      else inAppCount += 1;
    }

    const shouldSendDaily = preferences.daily_task_digest;
    const shouldSendDeadlineEmail = preferences.deadline_reminders && reminders.length > 0;
    if (process.env.RESEND_API_KEY && preferences.email && (shouldSendWeekly || shouldSendDaily || shouldSendDeadlineEmail)) {
      const kind = shouldSendWeekly ? "weekly" : shouldSendDaily ? "daily" : "deadline";
      const deliveryKey = `task-email:${kind}:${dateKey}`;
      if (!delivered.has(`${profile.id}:email:${deliveryKey}`)) {
        try {
          const providerId = await sendReminderEmail({
            to: profile.email,
            subject: kind === "weekly" ? `Weekly task overview: ${userTasks.length} outstanding` : kind === "daily" ? `Daily task reminder: ${userTasks.length} outstanding` : `${reminders.length} upcoming task deadline${reminders.length === 1 ? "" : "s"}`,
            html: emailHtml(profile, reminders, userTasks, preferences.timezone, kind),
            idempotencyKey: `${profile.id}-${deliveryKey}`,
          });
          const { error } = await admin.from("notification_deliveries").insert({ user_id: profile.id, channel: "email", delivery_key: deliveryKey, provider_id: providerId });
          if (error) throw error;
          delivered.add(`${profile.id}:email:${deliveryKey}`);
          emailCount += 1;
        } catch (error) {
          failureCount += 1;
          console.error("task reminder email error", { userId: profile.id, error });
        }
      }
    }

    if (preferences.push && (reminders.length > 0 || shouldSendDaily || shouldSendWeekly)) {
      for (const subscription of pushByUser.get(profile.id) ?? []) {
        if (shouldSendDaily || shouldSendWeekly) {
          const kind = shouldSendWeekly ? "weekly" : "daily";
          const deliveryKey = `task-push:${subscription.id}:${kind}:${dateKey}`;
          if (!delivered.has(`${profile.id}:push:${deliveryKey}`)) {
            try {
              await sendReminderPush({
                endpoint: subscription.endpoint,
                p256dh: subscription.p256dh,
                auth: subscription.auth,
                title: shouldSendWeekly ? "Weekly task overview" : "Daily task reminder",
                body: digestMessage,
                url: "/tasks",
              });
              const { error } = await admin.from("notification_deliveries").insert({ user_id: profile.id, channel: "push", delivery_key: deliveryKey });
              if (error) throw error;
              delivered.add(`${profile.id}:push:${deliveryKey}`);
              pushCount += 1;
            } catch (error) {
              failureCount += 1;
              const status = pushStatusCode(error);
              if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", subscription.id);
              console.error("task digest push error", { userId: profile.id, status });
            }
          }
        }
        for (const reminder of reminders) {
          const copy = reminderCopy(reminder);
          const deliveryKey = `task-push:${subscription.id}:${reminder.task.id}:${reminder.window}:${reminder.window === "overdue" ? dateKey : "once"}`;
          if (delivered.has(`${profile.id}:push:${deliveryKey}`)) continue;
          try {
            await sendReminderPush({ endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth, title: copy.title, body: copy.message, url: "/tasks" });
            const { error } = await admin.from("notification_deliveries").insert({ user_id: profile.id, channel: "push", delivery_key: deliveryKey });
            if (error) throw error;
            delivered.add(`${profile.id}:push:${deliveryKey}`);
            pushCount += 1;
          } catch (error) {
            failureCount += 1;
            const status = pushStatusCode(error);
            if (status === 404 || status === 410) {
              await admin.from("push_subscriptions").delete().eq("id", subscription.id);
            }
            console.error("task reminder push error", { userId: profile.id, status });
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: failureCount === 0, inAppCount, emailCount, pushCount, failureCount });
}
