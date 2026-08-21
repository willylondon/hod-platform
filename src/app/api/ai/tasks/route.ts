import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, requireApiUser } from "@/lib/api-security";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function isCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const DATE_SCHEMA = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarDate);
const CREATE_TASKS_SCHEMA = z
  .object({
    tasks: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(200),
            priority: z.enum(["low", "medium", "high", "urgent"]),
            deadline: DATE_SCHEMA.nullable().optional(),
          })
          .strict()
      )
      .min(1)
      .max(20),
  })
  .strict();

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const rateLimitResponse = enforceRateLimit(
    `ai-task-create:${auth.user.id}`,
    5,
    60_000
  );
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = CREATE_TASKS_SCHEMA.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Task details are invalid" },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabase();
  const rows = parsed.data.tasks.map((task) => ({
    title: task.title,
    priority: task.priority,
    deadline: task.deadline ? `${task.deadline}T21:00:00.000Z` : null,
    status: "not_started",
    is_recurring: false,
    created_by: auth.user.id,
  }));
  const { data, error } = await supabase
    .from("tasks")
    .insert(rows)
    .select("id,title,priority,deadline");

  if (error) {
    console.error("AI task creation failed", { code: error.code });
    return NextResponse.json(
      { error: "Tasks could not be created" },
      { status: 500 }
    );
  }

  return NextResponse.json({ tasks: data ?? [], count: data?.length ?? 0 });
}
