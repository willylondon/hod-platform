import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api-security";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PARAMS_SCHEMA = z.object({ id: z.string().uuid() }).strict();
const UPDATE_SCHEMA = z
  .object({
    status: z.enum(["approved", "discarded"]),
    outputText: z.string().trim().min(1).max(20_000).optional(),
  })
  .strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const parsedParams = PARAMS_SCHEMA.safeParse(await params);
  const parsedBody = UPDATE_SCHEMA.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json(
      { error: "Draft update is invalid" },
      { status: 400 }
    );
  }

  const isApproved = parsedBody.data.status === "approved";
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("ai_drafts")
    .update({
      is_approved: isApproved,
      is_discarded: !isApproved,
      ...(parsedBody.data.outputText
        ? { output_text: parsedBody.data.outputText }
        : {}),
    })
    .eq("id", parsedParams.data.id)
    .eq("user_id", auth.user.id)
    .select(
      "id,user_id,action,context_type,context_id,input_prompt,output_text,is_approved,is_discarded,created_at"
    )
    .maybeSingle();

  if (error) {
    console.error("AI draft update failed", { code: error.code });
    return NextResponse.json(
      { error: "Draft status could not be saved" },
      { status: 500 }
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  return NextResponse.json({ draft: data });
}
