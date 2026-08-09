import { NextResponse } from "next/server";
import { enforceRateLimit, requireApiUser } from "@/lib/api-security";
import {
  decryptGoogleToken,
  isGoogleCalendarConfigured,
  revokeGoogleToken,
} from "@/lib/google-calendar";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json({ configured: false, connected: false });
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("google_calendar_connections")
    .select("connected_at,last_synced_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) {
    console.error("Google Calendar connection query failed", error.message);
    return NextResponse.json({ error: "Could not check Google Calendar" }, { status: 500 });
  }
  return NextResponse.json({
    configured: true,
    connected: Boolean(data?.connected_at),
    lastSyncedAt: data?.last_synced_at ?? null,
  });
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  const limited = enforceRateLimit(`google-calendar-disconnect:${auth.user.id}`, 5, 10 * 60_000);
  if (limited) return limited;

  const admin = createAdminSupabase();
  const { data } = await admin
    .from("google_calendar_connections")
    .select("refresh_token_encrypted")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (data?.refresh_token_encrypted) {
    try {
      await revokeGoogleToken(decryptGoogleToken(data.refresh_token_encrypted));
    } catch (error) {
      console.error("Google Calendar token revocation failed", error instanceof Error ? error.message : "Unknown error");
    }
  }
  const { error } = await admin
    .from("google_calendar_connections")
    .delete()
    .eq("user_id", auth.user.id);
  if (error) {
    console.error("Google Calendar disconnect failed", error.message);
    return NextResponse.json({ error: "Could not disconnect Google Calendar" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
