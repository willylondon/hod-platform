import "server-only";

import webPush from "web-push";

type EmailInput = {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
};

type PushInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  title: string;
  body: string;
  url: string;
};

export async function sendReminderEmail(input: EmailInput): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: process.env.REMINDER_EMAIL_FROM || "HoD Platform <onboarding@resend.dev>",
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });

  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok) throw new Error(payload.message || `Email provider returned ${response.status}`);
  return payload.id ?? null;
}

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("VAPID keys are not configured");
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@hod-platform.vercel.app",
    publicKey,
    privateKey
  );
}

export async function sendReminderPush(input: PushInput): Promise<void> {
  configureWebPush();
  await webPush.sendNotification(
    {
      endpoint: input.endpoint,
      keys: { p256dh: input.p256dh, auth: input.auth },
    },
    JSON.stringify({
      title: input.title,
      body: input.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      url: input.url,
    }),
    { TTL: 60 * 60 * 12, urgency: "normal" }
  );
}

export function pushStatusCode(error: unknown): number | null {
  if (error && typeof error === "object" && "statusCode" in error) {
    const code = (error as { statusCode?: unknown }).statusCode;
    return typeof code === "number" ? code : null;
  }
  return null;
}
