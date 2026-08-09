import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sendReminderTelegram } from "@/lib/reminder-delivery";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { setTelegramPreference } from "@/lib/telegram-connections";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  message: z.object({
    text: z.string().max(4096).optional(),
    chat: z.object({
      id: z.union([z.number(), z.string()]),
      type: z.string(),
    }),
    from: z.object({
      id: z.union([z.number(), z.string()]),
      username: z.string().max(64).optional(),
      first_name: z.string().max(128).optional(),
    }).optional(),
  }).optional(),
});

function validWebhookSecret(received: string | null, expected: string | undefined) {
  if (!received || !expected) return false;
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes);
}

export async function POST(request: Request) {
  if (!validWebhookSecret(
    request.headers.get("x-telegram-bot-api-secret-token"),
    process.env.TELEGRAM_WEBHOOK_SECRET
  )) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: true });
  }

  const message = parsed.data.message;
  if (!message?.text) return NextResponse.json({ ok: true });
  const chatId = String(message.chat.id);
  const text = message.text.trim();
  if (message.chat.type !== "private") {
    await sendReminderTelegram({ chatId, text: "Please connect HoD Platform reminders in a private chat with this bot." }).catch(() => null);
    return NextResponse.json({ ok: true });
  }

  if (/^\/help(?:@\w+)?$/.test(text)) {
    await sendReminderTelegram({
      chatId,
      text: "HoD Platform can send task deadline alerts plus daily and weekly outstanding-task summaries here. To connect, open Settings in the app and choose Connect Telegram. Send /stop at any time to disconnect.",
    }).catch(() => null);
    return NextResponse.json({ ok: true });
  }

  if (/^\/(?:stop|disconnect)(?:@\w+)?$/.test(text)) {
    const admin = createAdminSupabase();
    const { data: connection } = await admin
      .from("telegram_connections")
      .select("id,user_id")
      .eq("chat_id", chatId)
      .maybeSingle();
    if (connection) {
      await admin.from("telegram_connections").delete().eq("id", connection.id);
      await setTelegramPreference(connection.user_id, false).catch((error) => {
        console.error("telegram stop preference error", error);
      });
    }
    await sendReminderTelegram({
      chatId,
      text: connection
        ? "Telegram reminders are disconnected. You can reconnect from HoD Platform Settings at any time."
        : "This Telegram chat is not connected to HoD Platform reminders.",
    }).catch(() => null);
    return NextResponse.json({ ok: true });
  }

  const startMatch = text.match(/^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{1,64}))?$/);
  if (!startMatch) return NextResponse.json({ ok: true });
  const token = startMatch[1];
  if (!token) {
    await sendReminderTelegram({
      chatId,
      text: "Open HoD Platform Settings and choose Connect Telegram to securely link your reminders.",
    }).catch(() => null);
    return NextResponse.json({ ok: true });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const admin = createAdminSupabase();
  const { data: connection, error: findError } = await admin
    .from("telegram_connections")
    .select("id,user_id")
    .eq("link_token_hash", tokenHash)
    .gt("link_expires_at", new Date().toISOString())
    .maybeSingle();
  if (findError || !connection) {
    if (findError) console.error("telegram link lookup error", findError);
    await sendReminderTelegram({
      chatId,
      text: "That connection link has expired or was already used. Return to HoD Platform Settings and create a new link.",
    }).catch(() => null);
    return NextResponse.json({ ok: true });
  }

  const { error: updateError } = await admin.from("telegram_connections").update({
    chat_id: chatId,
    telegram_user_id: message.from?.id ? String(message.from.id) : null,
    telegram_username: message.from?.username ?? null,
    first_name: message.from?.first_name ?? null,
    link_token_hash: null,
    link_expires_at: null,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", connection.id);
  if (updateError) {
    console.error("telegram link update error", updateError);
    await sendReminderTelegram({
      chatId,
      text: "This Telegram account is already connected elsewhere, or the connection could not be completed.",
    }).catch(() => null);
    return NextResponse.json({ ok: true });
  }

  try {
    await setTelegramPreference(connection.user_id, true);
    await sendReminderTelegram({
      chatId,
      text: "✅ Telegram reminders are connected. You’ll receive your HoD Platform task deadlines and daily or weekly summaries here.",
    });
  } catch (error) {
    console.error("telegram connection confirmation error", error);
  }

  return NextResponse.json({ ok: true });
}
