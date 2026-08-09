import type { Task } from "@/lib/types";

export type ReminderWindow = "week" | "tomorrow" | "today" | "overdue";

export type ScheduledTaskReminder = {
  task: Task;
  window: ReminderWindow;
  daysUntilDue: number;
};

function localDateParts(value: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(value).map((part) => [part.type, part.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

export function localDateKey(value: Date, timezone: string): string {
  const { year, month, day } = localDateParts(value, timezone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function weekdayInTimezone(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(value);
}

export function daysUntilDeadline(deadline: string, now: Date, timezone: string): number {
  const current = localDateParts(now, timezone);
  const due = localDateParts(new Date(deadline), timezone);
  const currentUtc = Date.UTC(current.year, current.month - 1, current.day);
  const dueUtc = Date.UTC(due.year, due.month - 1, due.day);
  return Math.round((dueUtc - currentUtc) / 86_400_000);
}

export function scheduledDeadlineReminders(
  tasks: Task[],
  now: Date,
  timezone: string
): ScheduledTaskReminder[] {
  return tasks.flatMap<ScheduledTaskReminder>((task) => {
    if (!task.deadline) return [];
    const days = daysUntilDeadline(task.deadline, now, timezone);
    if (days === 7) return [{ task, window: "week" as const, daysUntilDue: days }];
    if (days === 1) return [{ task, window: "tomorrow" as const, daysUntilDue: days }];
    if (days === 0) return [{ task, window: "today" as const, daysUntilDue: days }];
    if (days < 0) return [{ task, window: "overdue" as const, daysUntilDue: days }];
    return [];
  });
}

export function reminderCopy(reminder: ScheduledTaskReminder) {
  switch (reminder.window) {
    case "week":
      return { title: "Task due in one week", message: `“${reminder.task.title}” is due in 7 days.` };
    case "tomorrow":
      return { title: "Task due tomorrow", message: `“${reminder.task.title}” is due tomorrow.` };
    case "today":
      return { title: "Task due today", message: `“${reminder.task.title}” is due today.` };
    case "overdue": {
      const overdueDays = Math.abs(reminder.daysUntilDue);
      return {
        title: "Task overdue",
        message: `“${reminder.task.title}” is ${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue.`,
      };
    }
  }
}
