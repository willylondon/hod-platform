import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-security";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("ai_drafts")
    .select(
      "id,user_id,action,context_type,context_id,input_prompt,output_text,is_approved,is_discarded,created_at"
    )
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("AI draft history load failed", { code: error.code });
    return NextResponse.json(
      { error: "Draft history could not be loaded" },
      { status: 500 }
    );
  }

  return NextResponse.json({ drafts: data ?? [] });
}
