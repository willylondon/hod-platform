import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  return NextResponse.json({
    emailConfigured: Boolean(process.env.RESEND_API_KEY),
    pushConfigured: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
  });
}
