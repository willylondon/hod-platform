import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api-security";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const onboardingSchema = z.object({
  full_name: z.string().trim().min(1).max(160),
  school_name: z.string().trim().min(1).max(200),
  department_name: z.string().trim().min(1).max(200),
  academic_year: z.string().trim().min(1).max(40),
  current_term: z.string().trim().min(1).max(80),
  working_days: z.array(z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])).min(1).max(7),
  preferred_hours_start: z.string().regex(/^\d{2}:\d{2}$/),
  preferred_hours_end: z.string().regex(/^\d{2}:\d{2}$/),
  notifications_in_app: z.boolean(),
  notifications_email: z.boolean(),
  timezone: z.string().trim().min(1).max(100),
  priorities: z.string().trim().max(2000),
});

function validTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const parsed = onboardingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !validTimezone(parsed.data.timezone)) {
    return NextResponse.json({ error: "Please check your onboarding details and try again." }, { status: 400 });
  }

  const input = parsed.data;
  const admin = createAdminSupabase();
  const { data: existingProfile, error: profileReadError } = await admin
    .from("profiles")
    .select("school_id,department_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profileReadError) {
    console.error("onboarding profile lookup error", profileReadError);
    return NextResponse.json({ error: "We couldn't prepare your profile." }, { status: 500 });
  }

  let schoolId = existingProfile?.school_id ?? null;
  if (schoolId) {
    const { error } = await admin.from("schools").update({
      name: input.school_name,
      academic_year: input.academic_year,
      current_term: input.current_term,
      working_days: input.working_days,
      preferred_hours_start: input.preferred_hours_start,
      preferred_hours_end: input.preferred_hours_end,
    }).eq("id", schoolId);
    if (error) {
      console.error("onboarding school update error", error);
      return NextResponse.json({ error: "We couldn't save your school details." }, { status: 500 });
    }
  } else {
    const { data, error } = await admin.from("schools").insert({
      name: input.school_name,
      academic_year: input.academic_year,
      current_term: input.current_term,
      working_days: input.working_days,
      preferred_hours_start: input.preferred_hours_start,
      preferred_hours_end: input.preferred_hours_end,
    }).select("id").single();
    if (error || !data) {
      console.error("onboarding school create error", error);
      return NextResponse.json({ error: "We couldn't create your school workspace." }, { status: 500 });
    }
    schoolId = data.id;
  }

  let departmentId = existingProfile?.department_id ?? null;
  if (departmentId) {
    const { error } = await admin.from("departments").update({ name: input.department_name }).eq("id", departmentId);
    if (error) {
      console.error("onboarding department update error", error);
      return NextResponse.json({ error: "We couldn't save your department details." }, { status: 500 });
    }
  } else {
    const { data, error } = await admin.from("departments").insert({
      school_id: schoolId,
      name: input.department_name,
      head_id: auth.user.id,
    }).select("id").single();
    if (error || !data) {
      console.error("onboarding department create error", error);
      return NextResponse.json({ error: "We couldn't create your department workspace." }, { status: 500 });
    }
    departmentId = data.id;
  }

  const preferences = {
    notifications: { in_app: input.notifications_in_app, email: input.notifications_email },
    academic_year: input.academic_year,
    current_term: input.current_term,
    working_days: input.working_days,
    preferred_hours_start: input.preferred_hours_start,
    preferred_hours_end: input.preferred_hours_end,
    priorities: input.priorities,
  };

  const { error: profileError } = await admin.from("profiles").upsert({
    id: auth.user.id,
    email: auth.user.email!,
    full_name: input.full_name,
    role: "head_of_department",
    school_id: schoolId,
    department_id: departmentId,
    preferences,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (profileError) {
    console.error("onboarding profile save error", profileError);
    return NextResponse.json({ error: "We couldn't save your profile." }, { status: 500 });
  }

  const { error: settingsError } = await admin.from("settings").upsert({
    user_id: auth.user.id,
    notification_preferences: {
      email: input.notifications_email,
      in_app: input.notifications_in_app,
      push: false,
      telegram: false,
      deadline_reminders: true,
      daily_task_digest: true,
      weekly_task_digest: true,
      timezone: input.timezone,
    },
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (settingsError) {
    console.error("onboarding settings save error", settingsError);
    return NextResponse.json({ error: "We couldn't save your reminder preferences." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
