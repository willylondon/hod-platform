import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  return NextResponse.json({ allowed: true });
}
