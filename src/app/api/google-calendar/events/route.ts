import { NextResponse } from "next/server";
import { enforceRateLimit, requireApiUser } from "@/lib/api-security";
import {
  decryptGoogleToken,
  encryptGoogleToken,
  isGoogleCalendarConfigured,
  refreshGoogleAccessToken,
} from "@/lib/google-calendar";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ConnectionRow = {
  access_token_encrypted: string | null;
  refresh_token_encrypted: string;
  token_expires_at: string | null;
};

type GoogleEvent = {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

function requestedRange(request: Request) {
  const url = new URL(request.url);
  const timeMin = new Date(url.searchParams.get("timeMin") || "");
  const timeMax = new Date(url.searchParams.get("timeMax") || "");
  const duration = timeMax.getTime() - timeMin.getTime();
  if (!Number.isFinite(duration) || duration <= 0 || duration > 370 * 24 * 60 * 60 * 1000) {
    return null;
  }
  return { timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString() };
}

async function refreshAndStoreToken(userId: string, refreshTokenEncrypted: string) {
  const refreshToken = decryptGoogleToken(refreshTokenEncrypted);
  const tokens = await refreshGoogleAccessToken(refreshToken);
  const now = new Date();
  const admin = createAdminSupabase();
  const { error } = await admin.from("google_calendar_connections").update({
    access_token_encrypted: encryptGoogleToken(tokens.access_token),
    token_expires_at: new Date(now.getTime() + tokens.expires_in * 1000).toISOString(),
    updated_at: now.toISOString(),
  }).eq("user_id", userId);
  if (error) throw error;
  return tokens.access_token;
}

async function fetchGoogleEvents(accessToken: string, timeMin: string, timeMax: string) {
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("showDeleted", "false");
  url.searchParams.set("maxResults", "2500");
  return fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
}

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  const range = requestedRange(request);
  if (!range) return NextResponse.json({ error: "Invalid calendar date range" }, { status: 400 });
  const limited = enforceRateLimit(`google-calendar-events:${auth.user.id}`, 60, 10 * 60_000);
  if (limited) return limited;
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json({ configured: false, connected: false, events: [] });
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("google_calendar_connections")
    .select("access_token_encrypted,refresh_token_encrypted,token_expires_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) {
    console.error("Google Calendar event connection query failed", error.message);
    return NextResponse.json({ error: "Could not load Google Calendar" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ configured: true, connected: false, events: [] });

  try {
    const connection = data as ConnectionRow;
    const expiresSoon = !connection.token_expires_at
      || new Date(connection.token_expires_at).getTime() <= Date.now() + 60_000;
    let accessToken = !expiresSoon && connection.access_token_encrypted
      ? decryptGoogleToken(connection.access_token_encrypted)
      : await refreshAndStoreToken(auth.user.id, connection.refresh_token_encrypted);
    let googleResponse = await fetchGoogleEvents(accessToken, range.timeMin, range.timeMax);
    if (googleResponse.status === 401) {
      accessToken = await refreshAndStoreToken(auth.user.id, connection.refresh_token_encrypted);
      googleResponse = await fetchGoogleEvents(accessToken, range.timeMin, range.timeMax);
    }
    const payload = await googleResponse.json() as { items?: GoogleEvent[]; error?: { message?: string } };
    if (!googleResponse.ok) throw new Error(payload.error?.message || "Google Calendar request failed");

    const events = (payload.items ?? []).flatMap((event) => {
      const date = event.start?.date || event.start?.dateTime?.slice(0, 10);
      if (!event.id || !date || event.status === "cancelled") return [];
      return [{
        id: event.id,
        title: event.summary || "Busy",
        date,
        start: event.start?.dateTime || event.start?.date || date,
        end: event.end?.dateTime || event.end?.date || null,
        allDay: Boolean(event.start?.date),
        description: event.description || null,
        location: event.location || null,
        htmlLink: event.htmlLink || null,
      }];
    });
    const syncedAt = new Date().toISOString();
    await admin.from("google_calendar_connections").update({
      last_synced_at: syncedAt,
      updated_at: syncedAt,
    }).eq("user_id", auth.user.id);
    return NextResponse.json({ configured: true, connected: true, lastSyncedAt: syncedAt, events });
  } catch (eventError) {
    console.error("Google Calendar event sync failed", eventError instanceof Error ? eventError.message : "Unknown error");
    return NextResponse.json({
      configured: true,
      connected: true,
      events: [],
      error: "Google Calendar could not be refreshed. Please reconnect it in Calendar settings.",
    }, { status: 502 });
  }
}
