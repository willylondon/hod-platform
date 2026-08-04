import "server-only";

function allowedEmails(): Set<string> {
  const configured = process.env.APP_ALLOWED_EMAILS;

  // Production fails closed if the allowlist is missing. Local development stays
  // usable unless a local allowlist is explicitly configured.
  if (!configured) {
    return process.env.NODE_ENV === "production" ? new Set() : new Set(["*"]);
  }

  return new Set(
    configured
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAllowedUserEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = allowedEmails();
  return allowlist.has("*") || allowlist.has(email.trim().toLowerCase());
}
