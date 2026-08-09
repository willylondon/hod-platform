import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { enforceRateLimit, requireApiUser } from "@/lib/api-security";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { setTelegramPreference } from "@/lib/telegram-connections";

export const dynamic = "force-dynamic";

function botUsername() {
  return process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || "";
}

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const username = botUsername();
  if (!process.env.TELEGRAM_BOT_TOKEN || !username) {
    return NextResponse.json({ configured: false, connected: false });
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("telegram_connections")
    .select("chat_id,telegram_username,first_name,connected_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) {
    console.error("telegram connection query error", error);
    return NextResponse.json({ error: "Could not check Telegram connection" }, { status: 500 });
  }

  return NextResponse.json({
    configured: true,
    connected: Boolean(data?.chat_id && data?.connected_at),
    botUsername: username,
    telegramUsername: data?.telegram_username ?? null,
    firstName: data?.first_name ?? null,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(`telegram-connect:${auth.user.id}`, 5, 10 * 60_000);
  if (limited) return limited;

  const username = botUsername();
  if (!process.env.TELEGRAM_BOT_TOKEN || !username) {
    return NextResponse.json({ error: "Telegram reminders are not configured yet" }, { status: 503 });
  }

  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const admin = createAdminSupabase();
  const { error } = await admin.from("telegram_connections").upsert({
    user_id: auth.user.id,
    link_token_hash: tokenHash,
    link_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) {
    console.error("telegram connection token error", error);
    return NextResponse.json({ error: "Could not create the Telegram connection" }, { status: 500 });
  }

  return NextResponse.json({
    connectUrl: `https://t.me/${username}?start=${token}`,
    expiresAt,
  });
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const admin = createAdminSupabase();
  const { error } = await admin.from("telegram_connections")
    .delete()
    .eq("user_id", auth.user.id);
  if (error) {
    console.error("telegram disconnect error", error);
    return NextResponse.json({ error: "Could not disconnect Telegram" }, { status: 500 });
  }

  try {
    await setTelegramPreference(auth.user.id, false);
  } catch (preferenceError) {
    console.error("telegram preference disable error", preferenceError);
    return NextResponse.json({ error: "Telegram was disconnected, but reminder settings could not be updated" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
