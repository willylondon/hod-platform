export type NotificationPreferences = {
  email: boolean;
  in_app: boolean;
  push: boolean;
  telegram: boolean;
  deadline_reminders: boolean;
  daily_task_digest: boolean;
  weekly_task_digest: boolean;
  timezone: string;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: false,
  in_app: true,
  push: false,
  telegram: false,
  deadline_reminders: true,
  daily_task_digest: true,
  weekly_task_digest: true,
  timezone: "America/Jamaica",
};

export const TIMEZONE_OPTIONS = [
  { value: "America/Jamaica", label: "Jamaica" },
  { value: "America/New_York", label: "Eastern Time (US & Canada)" },
  { value: "America/Chicago", label: "Central Time (US & Canada)" },
  { value: "America/Denver", label: "Mountain Time (US & Canada)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)" },
  { value: "America/Toronto", label: "Toronto" },
  { value: "America/Nassau", label: "The Bahamas" },
  { value: "America/Barbados", label: "Barbados" },
  { value: "America/Port_of_Spain", label: "Trinidad & Tobago" },
  { value: "Europe/London", label: "United Kingdom" },
  { value: "UTC", label: "UTC" },
] as const;

function normalizeTimezone(value: unknown): string {
  if (typeof value !== "string" || !value) return DEFAULT_NOTIFICATION_PREFERENCES.timezone;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return value;
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES.timezone;
  }
}

export function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  const saved = value && typeof value === "object"
    ? value as Partial<NotificationPreferences>
    : {};

  return {
    email: saved.email ?? DEFAULT_NOTIFICATION_PREFERENCES.email,
    in_app: saved.in_app ?? DEFAULT_NOTIFICATION_PREFERENCES.in_app,
    push: saved.push ?? DEFAULT_NOTIFICATION_PREFERENCES.push,
    telegram: saved.telegram ?? DEFAULT_NOTIFICATION_PREFERENCES.telegram,
    deadline_reminders: saved.deadline_reminders ?? DEFAULT_NOTIFICATION_PREFERENCES.deadline_reminders,
    daily_task_digest: saved.daily_task_digest ?? DEFAULT_NOTIFICATION_PREFERENCES.daily_task_digest,
    weekly_task_digest: saved.weekly_task_digest ?? DEFAULT_NOTIFICATION_PREFERENCES.weekly_task_digest,
    timezone: normalizeTimezone(saved.timezone),
  };
}
