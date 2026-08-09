import "server-only";

import { normalizeNotificationPreferences } from "@/lib/notification-preferences";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function setTelegramPreference(userId: string, enabled: boolean) {
  const admin = createAdminSupabase();
  const { data, error: readError } = await admin
    .from("settings")
    .select("notification_preferences")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw readError;

  const preferences = {
    ...normalizeNotificationPreferences(data?.notification_preferences),
    telegram: enabled,
  };
  const { error } = await admin.from("settings").upsert({
    user_id: userId,
    notification_preferences: preferences,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw error;
}
