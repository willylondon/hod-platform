import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api-security";
import { sendReminderPush } from "@/lib/reminder-delivery";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(4096),
  keys: z.object({
    p256dh: z.string().min(1).max(1024),
    auth: z.string().min(1).max(1024),
  }),
});

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json({ error: "Phone notifications are not configured yet" }, { status: 503 });
  }
  return NextResponse.json({ publicKey });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const subscriptionRow = {
    user_id: auth.user.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    user_agent: request.headers.get("user-agent"),
    updated_at: new Date().toISOString(),
  };
  const { error: insertError } = await admin.from("push_subscriptions").upsert(subscriptionRow, {
    onConflict: "endpoint",
    ignoreDuplicates: true,
  });

  if (insertError) {
    console.error("push subscription save error", insertError);
    return NextResponse.json({ error: "Could not enable phone notifications" }, { status: 500 });
  }

  const { data: existing, error: ownerError } = await admin.from("push_subscriptions")
    .select("user_id")
    .eq("endpoint", parsed.data.endpoint)
    .single();
  if (ownerError || !existing) {
    console.error("push subscription owner lookup error", ownerError);
    return NextResponse.json({ error: "Could not verify this phone notification subscription" }, { status: 500 });
  }
  if (existing.user_id !== auth.user.id) {
    return NextResponse.json({
      error: "This browser is still connected to another account. Log out of that account before enabling phone reminders here.",
    }, { status: 409 });
  }

  const { error: updateError } = await admin.from("push_subscriptions")
    .update(subscriptionRow)
    .eq("endpoint", parsed.data.endpoint)
    .eq("user_id", auth.user.id);
  if (updateError) {
    console.error("push subscription update error", updateError);
    return NextResponse.json({ error: "Could not enable phone notifications" }, { status: 500 });
  }

  try {
    await sendReminderPush({
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      title: "Phone reminders enabled",
      body: "You’ll now receive deadline alerts from HoD Platform.",
      url: "/tasks",
    });
  } catch (pushError) {
    console.error("push confirmation error", pushError);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const parsed = z.object({ endpoint: z.string().url().max(4096) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { error } = await admin.from("push_subscriptions")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("endpoint", parsed.data.endpoint);

  if (error) {
    console.error("push subscription delete error", error);
    return NextResponse.json({ error: "Could not disable phone notifications" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
