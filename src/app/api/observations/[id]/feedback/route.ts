import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api-security";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PARAMS_SCHEMA = z.object({ id: z.string().uuid() }).strict();
const FEEDBACK_SCHEMA = z
  .object({ feedback: z.string().trim().min(1).max(20_000) })
  .strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const parsedParams = PARAMS_SCHEMA.safeParse(await params);
  const parsedBody = FEEDBACK_SCHEMA.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json(
      { error: "Feedback details are invalid" },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("observations")
    .update({
      feedback_draft: parsedBody.data.feedback,
      feedback_approved: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsedParams.data.id)
    .eq("observer_id", auth.user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Observation feedback save failed", { code: error.code });
    return NextResponse.json(
      { error: "Feedback could not be saved" },
      { status: 500 }
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Observation not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
