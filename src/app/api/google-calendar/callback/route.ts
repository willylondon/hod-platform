import { NextResponse } from "next/server";
import { isAllowedUserEmail } from "@/lib/access-control";
import {
  encryptGoogleToken,
  exchangeGoogleAuthorizationCode,
  googleCalendarRedirectUri,
  GOOGLE_CALENDAR_SCOPE,
} from "@/lib/google-calendar";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function redirectToCalendar(request: Request, result: string) {
  const response = NextResponse.redirect(new URL(`/calendar?googleCalendar=${result}`, request.url));
  response.cookies.set("hod_google_calendar_oauth_state", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    maxAge: 0,
    path: "/api/google-calendar/callback",
  });
  return response;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const providerError = requestUrl.searchParams.get("error");
  const cookieHeader = request.headers.get("cookie") || "";
  const expectedState = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("hod_google_calendar_oauth_state="))
    ?.slice("hod_google_calendar_oauth_state=".length);

  if (providerError) return redirectToCalendar(request, "cancelled");
  if (!code || !state || !expectedState || state !== decodeURIComponent(expectedState)) {
    return redirectToCalendar(request, "invalid_state");
  }

  const supabase = await createServerSupabase();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user || !isAllowedUserEmail(user.email)) {
    return redirectToCalendar(request, "session_expired");
  }

  try {
    const admin = createAdminSupabase();
    const { data: existing } = await admin
      .from("google_calendar_connections")
      .select("refresh_token_encrypted")
      .eq("user_id", user.id)
      .maybeSingle();
    const tokens = await exchangeGoogleAuthorizationCode({
      code,
      redirectUri: googleCalendarRedirectUri(requestUrl.origin),
    });
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptGoogleToken(tokens.refresh_token)
      : existing?.refresh_token_encrypted;
    if (!encryptedRefreshToken) throw new Error("Google did not return offline access");

    const now = new Date();
    const { error } = await admin.from("google_calendar_connections").upsert({
      user_id: user.id,
      access_token_encrypted: encryptGoogleToken(tokens.access_token),
      refresh_token_encrypted: encryptedRefreshToken,
      token_expires_at: new Date(now.getTime() + tokens.expires_in * 1000).toISOString(),
      scope: tokens.scope || GOOGLE_CALENDAR_SCOPE,
      connected_at: now.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw error;
    return redirectToCalendar(request, "connected");
  } catch (error) {
    console.error("Google Calendar callback failed", error instanceof Error ? error.message : "Unknown error");
    return redirectToCalendar(request, "error");
  }
}
