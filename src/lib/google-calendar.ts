import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

function encryptionKey() {
  const encoded = process.env.GOOGLE_CALENDAR_ENCRYPTION_KEY;
  if (!encoded) throw new Error("Google Calendar encryption is not configured");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("Google Calendar encryption key must be 32 bytes");
  return key;
}

function googleCredentials() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google Calendar OAuth is not configured");
  return { clientId, clientSecret };
}

export function isGoogleCalendarConfigured() {
  try {
    googleCredentials();
    encryptionKey();
    return true;
  } catch {
    return false;
  }
}

export function googleCalendarRedirectUri(requestOrigin: string) {
  return process.env.GOOGLE_CALENDAR_REDIRECT_URI
    || `${requestOrigin}/api/google-calendar/callback`;
}

export function createGoogleAuthorizationUrl({
  state,
  loginHint,
  redirectUri,
}: {
  state: string;
  loginHint?: string;
  redirectUri: string;
}) {
  const { clientId } = googleCredentials();
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  if (loginHint) url.searchParams.set("login_hint", loginHint);
  return url;
}

async function readTokenResponse(response: Response) {
  const payload = await response.json() as Partial<GoogleTokenResponse> & {
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token || !payload.expires_in) {
    throw new Error(payload.error_description || payload.error || "Google authorization failed");
  }
  return payload as GoogleTokenResponse;
}

export async function exchangeGoogleAuthorizationCode({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}) {
  const { clientId, clientSecret } = googleCredentials();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  return readTokenResponse(response);
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = googleCredentials();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  return readTokenResponse(response);
}

export async function revokeGoogleToken(token: string) {
  await fetch(GOOGLE_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    cache: "no-store",
  });
}

export function encryptGoogleToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptGoogleToken(value: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Invalid encrypted Google token");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
