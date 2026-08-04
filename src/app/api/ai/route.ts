import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, requireApiUser } from "@/lib/api-security";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  draft_email: "Draft Email",
  meeting_agenda: "Create Meeting Agenda",
  summarize_notes: "Summarize Notes",
  observation_feedback: "Draft Observation Feedback",
  appraisal_comments: "Generate Appraisal Comments",
  parent_communication: "Draft Parent Communication",
  checklist: "Generate Checklist",
  review_workflow: "Review Workflow",
  recommend_actions: "Recommend Next Actions",
  rewrite_professionally: "Rewrite Professionally",
  notes_to_tasks: "Convert Notes Into Tasks",
};

const ACTION_IDS = Object.keys(ACTION_LABELS) as [string, ...string[]];
const AI_REQUEST_SCHEMA = z
  .object({
    action: z.enum(ACTION_IDS).default("draft_email"),
    context: z.string().trim().max(2_000).default(""),
    prompt: z.string().trim().max(20_000).default(""),
    styleReference: z.string().trim().max(15_000).default(""),
  })
  .strict();

const MAX_REQUEST_BYTES = 64 * 1024;
const AI_RATE_LIMIT = 10;
const AI_RATE_WINDOW_MS = 60_000;

function labelFor(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

function mockResponse(action: string, context: string, prompt: string): string {
  const ctx = context
    ? `\n\nContext considered: ${context}`
    : "";
  const brief = prompt
    ? `\nRequest: "${prompt.slice(0, 200)}${prompt.length > 200 ? "…" : ""}"`
    : "";

  switch (action) {
    case "draft_email":
      return `Subject: Department Update — Key Priorities for This Week

Dear team,

I hope you are all well. I wanted to share a brief update on our priorities for the coming week and to thank you for your continued hard work.

1. Moderation of Year 11 mock papers should be completed by Thursday. Please upload your marked scripts to the shared drive by 4pm.
2. Our department meeting on Wednesday will focus on intervention planning for students currently below target grades.
3. A reminder that learning walks begin next Monday — these are supportive and developmental, and I will share the focus areas in advance.

If you have any concerns or need support with any of the above, please do come and see me.

Best regards,
Head of Department${ctx}${brief}`;

    case "meeting_agenda":
      return `Department Meeting Agenda
Date: [Insert date] | Time: 3:30pm – 4:30pm | Location: Staff Room 2

1. Welcome and apologies (2 mins)
2. Minutes of last meeting and matters arising (5 mins)
3. Data review: current attainment against target grades (15 mins)
   - Key groups requiring intervention
   - Agreed actions and owners
4. Curriculum update: scheme of work revisions for next term (10 mins)
5. Upcoming observations and learning walks — schedule and focus (5 mins)
6. CPD opportunities and requests (5 mins)
7. AOB (3 mins)
8. Date of next meeting

Please send any agenda items to the Head of Department by end of day Monday.${ctx}${brief}`;

    case "summarize_notes":
      return `Summary of Notes

Key points identified:
• The department is broadly on track against its improvement plan, with two of five milestones complete.
• Year 11 attainment in the recent mock series was 4% below the same point last year; targeted intervention is recommended for the Grade 4/5 borderline group.
• Marking consistency has improved since the standardisation session, though feedback frequency varies between classes.
• Staffing capacity for next term's intervention programme needs confirming by Friday.

Suggested next steps:
1. Confirm intervention group membership and timetable slots.
2. Share marking exemplars at the next department meeting.
3. Schedule follow-up data review in three weeks.${ctx}${brief}`;

    case "observation_feedback":
      return `Observation Feedback (Draft)

Lesson observed: [Subject/Year Group] | Date: [Insert date]

Strengths:
• Clear learning objectives were shared and revisited throughout the lesson.
• Questioning was well-distributed and effectively probed deeper understanding, particularly during the main activity.
• Behaviour management was calm and consistent; routines were well established.
• Differentiated resources supported lower-attaining students effectively.

Areas for development:
• Consider reducing teacher talk in the first 15 minutes to increase independent practice time.
• Stretch activities for higher attainers could be more explicitly planned.

Agreed actions:
1. Incorporate a minimum of 20 minutes of independent practice in each observed lesson.
2. Plan challenge tasks using the department's stretch framework.
3. Follow-up observation to be arranged within four weeks.

Overall, this was a strong lesson with clear evidence of secure subject knowledge and positive relationships.${ctx}${brief}`;

    case "appraisal_comments":
      return `Appraisal Comments (Draft)

Performance against objectives:
[Name] has made strong progress against their appraisal objectives this year. Their commitment to high-quality teaching is evident in consistently positive observation outcomes and strong student feedback.

Objective 1 (Teaching & Learning): Met. Evidence includes improved outcomes in Year 11 mock examinations and consistently strong lesson observations.

Objective 2 (Contribution to department): Met. [Name] has led the revision of the Key Stage 4 scheme of work and mentored a trainee teacher effectively.

Objective 3 (Professional development): Partially met. The middle leadership course is underway and due to complete next term.

Recommended objectives for next cycle:
1. Develop assessment literacy across the department through leading standardisation sessions.
2. Take on a broader leadership responsibility within the department improvement plan.${ctx}${brief}`;

    case "parent_communication":
      return `Dear Parent/Guardian,

I am writing to update you on your child's progress in [subject] this term.

[Student name] has shown a positive attitude to learning and is currently working at a level broadly in line with their target grade. Particular strengths include their written analysis and consistent completion of homework.

To make further progress, we recommend that [student name] focuses on revisiting key terminology regularly and completing the practice questions set each week. Revision resources are available on the school portal.

We would welcome the opportunity to discuss this further at the upcoming parents' evening on [date]. If you have any questions in the meantime, please do not hesitate to contact the department.

Yours sincerely,
Head of Department${ctx}${brief}`;

    case "checklist":
      return `Checklist: [Process name]

Preparation:
☐ Confirm date, time, and room booking
☐ Notify all participants at least 5 working days in advance
☐ Gather required documentation and data
☐ Prepare agenda/materials and circulate 2 days prior

During:
☐ Record attendance
☐ Capture key decisions and action points with owners and deadlines
☐ Agree follow-up date if required

After:
☐ Circulate notes/actions within 2 working days
☐ Add actions to the task tracker with deadlines
☐ Schedule any agreed follow-up meetings
☐ File documentation in the shared drive${ctx}${brief}`;

    case "review_workflow":
      return `Workflow Review

Current status: The workflow is progressing broadly to schedule, with 60% of steps complete.

Observations:
• Steps 1–3 completed on time; documentation is in order.
• Step 4 (data collation) is 3 days behind schedule — this has a knock-on effect on steps 5 and 6.
• Responsibility for step 6 is currently unassigned.

Recommendations:
1. Reallocate resource to complete data collation by end of this week.
2. Assign an owner to step 6 immediately to avoid further delay.
3. Add a mid-point check-in for future instances of this workflow.
4. Consider building in a one-day buffer ahead of the final deadline.${ctx}${brief}`;

    case "recommend_actions":
      return `Recommended Next Actions

Based on current priorities and upcoming deadlines, I recommend the following:

High priority:
1. Finalise intervention groups for Year 11 — mock data review is overdue.
2. Complete pending observation feedback — two observations are awaiting written feedback beyond the 5-day target.
3. Confirm agenda for Wednesday's department meeting and circulate by tomorrow.

Medium priority:
4. Schedule the follow-up learning walk for next week.
5. Update the department improvement plan RAG ratings before the SLT review.
6. Chase outstanding appraisal paperwork from two team members.

Lower priority:
7. Review the shared drive folder structure ahead of next term.
8. Book CPD for the new assessment framework.${ctx}${brief}`;

    case "rewrite_professionally":
      return `Here is a professionally rewritten version:

---

I hope this message finds you well. I am writing to follow up on the matter discussed below and to propose a clear way forward.

${prompt ? `Your key points have been restructured as follows:\n\n"${prompt.slice(0, 300)}"\n\nRevised:\nThank you for bringing this to my attention. Having reviewed the situation, I would like to suggest that we address this at our earliest convenience. I propose we meet briefly this week to agree on next steps, and I will ensure any required documentation is prepared in advance.` : "Your text has been revised for tone, clarity, and structure, with a clear opening, concise body, and a professional close."}

Please let me know if you would like the tone adjusted — for example, more formal for external correspondence or warmer for parent communication.${ctx}`;

    case "notes_to_tasks":
      return `Tasks extracted from notes:

1. [High] Compile Year 11 intervention list from mock data — Deadline: Thursday
2. [High] Send observation feedback to J. Smith — Deadline: tomorrow
3. [Medium] Book room for standardisation meeting — Deadline: this week
4. [Medium] Update improvement plan RAG ratings — Deadline: before SLT review
5. [Medium] Chase appraisal forms (2 outstanding) — Deadline: Friday
6. [Low] Order revision guides for Year 11 — Deadline: end of term
7. [Low] Review scheme of work annotations — Deadline: next half term

Each task can be added to your task list and assigned to a team member. Would you like me to adjust priorities or deadlines?${ctx}${brief}`;

    default:
      return `Here is a draft response for "${labelFor(action)}":

Thank you for your request. Based on the context provided, I have prepared a structured draft below. Please review and edit as needed before approving.

• Point 1: A clear, actionable item relevant to your request.
• Point 2: Supporting detail drawn from the context provided.
• Point 3: A suggested next step with an owner and deadline.

Let me know if you would like this adjusted in tone, length, or format.${ctx}${brief}`;
  }
}

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  return NextResponse.json({ mock: !process.env.OPENROUTER_API_KEY });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const rateLimitResponse = enforceRateLimit(
    `ai:${auth.user.id}`,
    AI_RATE_LIMIT,
    AI_RATE_WINDOW_MS
  );
  if (rateLimitResponse) return rateLimitResponse;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Request is too large" }, { status: 413 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedBody = AI_REQUEST_SCHEMA.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Request fields are invalid or too long" },
      { status: 400 }
    );
  }

  const { action, context, prompt, styleReference } = parsedBody.data;

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    // Simulate a small delay so the UI feels realistic
    await new Promise((r) => setTimeout(r, 900));
    const baseText = mockResponse(action, context, prompt);
    const text = styleReference
      ? `${baseText}\n\n(Style reference considered: matched tone/format from your uploaded sample.)`
      : baseText;
    return NextResponse.json({ text, mock: true });
  }

  try {
    const systemPrompt = `You are an AI assistant for a Head of Department at a school. You help draft professional documents, communications, feedback, agendas, and plans. Be concise, professional, and practical. Output only the requested content.`;

    const userPrompt = [
      `Action: ${labelFor(action)}`,
      styleReference ? `Style/format reference — match this tone and structure:\n${styleReference}` : null,
      context ? `Context: ${context}` : null,
      prompt ? `Request: ${prompt}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://hod-platform.vercel.app",
        "X-Title": "HoD Productivity Platform",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "google/gemini-3.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.error("OpenRouter API error", {
        status: res.status,
        requestId: res.headers.get("x-request-id"),
      });
      return NextResponse.json(
        { error: `OpenRouter request failed (${res.status})` },
        { status: 502 }
      );
    }

    const data: unknown = await res.json();
    const text =
      typeof data === "object" &&
      data !== null &&
      "choices" in data &&
      Array.isArray(data.choices) &&
      typeof data.choices[0]?.message?.content === "string"
        ? data.choices[0].message.content.trim()
        : "";

    if (!text) {
      console.error("OpenRouter returned an empty or malformed response");
      return NextResponse.json(
        { error: "AI provider returned an invalid response" },
        { status: 502 }
      );
    }

    return NextResponse.json({ text, mock: false });
  } catch (err) {
    console.error("AI route error:", err);
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return NextResponse.json(
        { error: "AI provider timed out. Please try again." },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
