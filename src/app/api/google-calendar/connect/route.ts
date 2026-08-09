import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { enforceRateLimit, requireApiUser } from "@/lib/api-security";
import {
  createGoogleAuthorizationUrl,
  googleCalendarRedirectUri,
  isGoogleCalendarConfigured,
} from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(`google-calendar-connect:${auth.user.id}`, 5, 10 * 60_000);
  if (limited) return limited;
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(new URL("/calendar?googleCalendar=not_configured", request.url));
  }

  const state = randomBytes(32).toString("base64url");
  const requestUrl = new URL(request.url);
  const redirectUri = googleCalendarRedirectUri(requestUrl.origin);
  const authorizationUrl = createGoogleAuthorizationUrl({
    state,
    loginHint: auth.user.email,
    redirectUri,
  });
  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set("hod_google_calendar_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: requestUrl.protocol === "https:",
    maxAge: 10 * 60,
    path: "/api/google-calendar/callback",
  });
  return response;
}
