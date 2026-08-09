export type NotificationPreferences = {
  email: boolean;
  in_app: boolean;
  push: boolean;
  deadline_reminders: boolean;
  daily_task_digest: boolean;
  weekly_task_digest: boolean;
  timezone: string;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: true,
  in_app: true,
  push: false,
  deadline_reminders: true,
  daily_task_digest: true,
  weekly_task_digest: true,
  timezone: "America/Jamaica",
};

export function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  const saved = value && typeof value === "object"
    ? value as Partial<NotificationPreferences>
    : {};

  return {
    email: saved.email ?? DEFAULT_NOTIFICATION_PREFERENCES.email,
    in_app: saved.in_app ?? DEFAULT_NOTIFICATION_PREFERENCES.in_app,
    push: saved.push ?? DEFAULT_NOTIFICATION_PREFERENCES.push,
    deadline_reminders: saved.deadline_reminders ?? DEFAULT_NOTIFICATION_PREFERENCES.deadline_reminders,
    daily_task_digest: saved.daily_task_digest ?? DEFAULT_NOTIFICATION_PREFERENCES.daily_task_digest,
    weekly_task_digest: saved.weekly_task_digest ?? DEFAULT_NOTIFICATION_PREFERENCES.weekly_task_digest,
    timezone: saved.timezone || DEFAULT_NOTIFICATION_PREFERENCES.timezone,
  };
}
