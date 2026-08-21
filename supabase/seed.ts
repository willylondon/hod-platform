import { createClient } from "@supabase/supabase-js";

// Seed script — run via: npx ts-node supabase/seed.ts
// Or via Supabase SQL editor with the migration + seed data

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function seed() {
  console.log("Seeding HoD Platform...");

  // 1. Create school
  const { data: school } = await supabase.from("schools").insert({
    name: "Kingston College",
    academic_year: "2026-2027",
    current_term: "Autumn",
    working_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    preferred_hours_start: "08:00",
    preferred_hours_end: "16:00",
  }).select().single();

  if (!school) throw new Error("Failed to create school");

  // 2. Create department
  const { data: dept } = await supabase.from("departments").insert({
    school_id: school.id,
    name: "English Department",
  }).select().single();

  if (!dept) throw new Error("Failed to create department");

  // 3. Create staff members (6 fictional teachers)
  const teachers = [
    { full_name: "Dr. Andrea Williams", job_title: "Senior Teacher", subject: "English Literature", email: "awilliams@kingstoncollege.edu", status: "active", start_date: "2019-09-01" },
    { full_name: "Mr. David Chen", job_title: "Teacher", subject: "English Language", email: "dchen@kingstoncollege.edu", status: "active", start_date: "2021-09-01" },
    { full_name: "Ms. Sarah Thompson", job_title: "Teacher", subject: "English Literature", email: "sthompson@kingstoncollege.edu", status: "active", start_date: "2022-09-01" },
    { full_name: "Mr. James McDonald", job_title: "Newly Qualified Teacher", subject: "English Language", email: "jmcdonald@kingstoncollege.edu", status: "active", start_date: "2025-09-01" },
    { full_name: "Mrs. Patricia James", job_title: "Teacher", subject: "English Literature", email: "pjames@kingstoncollege.edu", status: "active", start_date: "2018-09-01" },
    { full_name: "Ms. Rachel Foster", job_title: "Teacher", subject: "Drama & English", email: "rfoster@kingstoncollege.edu", status: "active", start_date: "2023-09-01" },
  ];

  const { data: staff } = await supabase.from("staff").insert(
    teachers.map(t => ({ ...t, school_id: school.id, department_id: dept.id }))
  ).select();

  if (!staff) throw new Error("Failed to create staff");

  // Update department head
  await supabase.from("departments").update({ head_id: staff[0].id }).eq("id", dept.id);

  // 4. Create workflow templates
  const templates = [
    {
      title: "Teacher Observation",
      description: "Complete observation cycle from planning to follow-up",
      category: "Performance Management",
      default_priority: "high",
      default_duration_days: 14,
      steps: [
        "Select teacher for observation",
        "Review previous feedback and notes",
        "Schedule observation date and time",
        "Notify teacher of observation",
        "Prepare observation focus and criteria",
        "Conduct classroom observation",
        "Complete observation notes",
        "Draft feedback and identify strengths/areas for development",
        "Hold coaching meeting with teacher",
        "Upload observation record and evidence",
        "Agree on action points and targets",
        "Schedule follow-up observation",
      ]
    },
    {
      title: "Department Meeting",
      description: "Standard department meeting workflow",
      category: "Meetings",
      default_priority: "medium",
      default_duration_days: 7,
      steps: [
        "Prepare meeting agenda",
        "Circulate agenda to department members",
        "Prepare any required data or reports",
        "Conduct department meeting",
        "Record minutes and decisions",
        "Distribute minutes and action items",
        "Follow up on action items",
      ]
    },
    {
      title: "New Teacher Onboarding",
      description: "Onboard a new teacher into the department",
      category: "HR & Development",
      default_priority: "high",
      default_duration_days: 30,
      steps: [
        "Prepare welcome pack and department handbook",
        "Assign mentor/buddy teacher",
        "Schedule introductory meeting",
        "Share curriculum documents and schemes of work",
        "Share assessment calendar and marking policies",
        "Set up classroom and resources",
        "Schedule first observation (supportive)",
        "Conduct week 1 check-in",
        "Conduct end of first month review",
      ]
    },
    {
      title: "Exam Preparation",
      description: "Prepare department for examination period",
      category: "Curriculum",
      default_priority: "urgent",
      default_duration_days: 21,
      steps: [
        "Review exam specification and requirements",
        "Prepare revision materials and resources",
        "Create exam timetable for department",
        "Brief invigilation staff",
        "Prepare exam papers and marking schemes",
        "Conduct pre-exam briefing with teachers",
        "Run mock examinations if applicable",
        "Collect and securely store completed papers",
        "Coordinate marking and moderation",
        "Submit results and grade boundaries",
      ]
    },
    {
      title: "Curriculum Planning",
      description: "Plan curriculum for new academic term",
      category: "Curriculum",
      default_priority: "high",
      default_duration_days: 14,
      steps: [
        "Review current curriculum and specifications",
        "Analyse previous term results and feedback",
        "Identify areas for curriculum development",
        "Draft scheme of work for new term",
        "Align assessments with curriculum objectives",
        "Review resources and materials needed",
        "Present curriculum plan to department",
        "Finalise and distribute scheme of work",
      ]
    },
    {
      title: "Parent Meeting",
      description: "Prepare for and conduct parent meeting",
      category: "Communication",
      default_priority: "medium",
      default_duration_days: 5,
      steps: [
        "Gather student progress data and reports",
        "Prepare meeting agenda and talking points",
        "Send meeting invitation to parents",
        "Prepare room and resources",
        "Conduct parent meeting",
        "Document meeting outcomes and agreed actions",
        "Follow up with any promised resources",
      ]
    },
    {
      title: "Standardization Meeting",
      description: "Standardize marking and assessment across department",
      category: "Quality Assurance",
      default_priority: "high",
      default_duration_days: 10,
      steps: [
        "Select sample papers for standardization",
        "Circulate sample papers to team in advance",
        "Prepare marking criteria and grade descriptors",
        "Conduct standardization meeting",
        "Document agreed marking standards",
        "Apply standardized approach to remaining papers",
        "Review consistency post-marking",
      ]
    },
  ];

  for (const t of templates) {
    const { data: template } = await supabase.from("workflow_templates").insert({
      title: t.title,
      description: t.description,
      category: t.category,
      default_priority: t.default_priority,
      default_duration_days: t.default_duration_days,
    }).select().single();

    if (template && t.steps) {
      await supabase.from("workflow_steps").insert(
        t.steps.map((step, i) => ({
          template_id: template.id,
          title: step,
          sort_order: i + 1,
          relative_due_day: Math.ceil(t.default_duration_days! * (i + 1) / t.steps.length),
        }))
      );
    }
  }

  // 5. Create sample tasks
  const now = new Date();
  const tasks = [
    { title: "Complete Year 11 marking moderation", priority: "urgent", status: "in_progress", deadline: new Date(now.getTime() - 86400000), assigned_to: staff[0].id, category: "Assessment" },
    { title: "Submit department budget proposal", priority: "high", status: "not_started", deadline: new Date(now.getTime() + 172800000), assigned_to: staff[0].id, category: "Administration" },
    { title: "Prepare for Ofsted deep dive", priority: "high", status: "in_progress", deadline: new Date(now.getTime() + 604800000), assigned_to: staff[0].id, category: "Quality Assurance" },
    { title: "Review Year 10 curriculum maps", priority: "medium", status: "waiting", deadline: new Date(now.getTime() + 259200000), assigned_to: staff[1].id, category: "Curriculum" },
    { title: "Update department handbook", priority: "medium", status: "not_started", deadline: new Date(now.getTime() + 1209600000), assigned_to: staff[0].id, category: "Administration" },
    { title: "Organise GCSE revision materials", priority: "high", status: "in_progress", deadline: new Date(now.getTime() + 345600000), assigned_to: staff[3].id, category: "Curriculum" },
    { title: "Schedule learning walk for SLT", priority: "medium", status: "not_started", deadline: new Date(now.getTime() + 432000000), assigned_to: staff[0].id, category: "Quality Assurance" },
    { title: "Complete NQT end of term assessment", priority: "high", status: "in_progress", deadline: new Date(now.getTime() + 864000000), assigned_to: staff[0].id, category: "HR" },
    { title: "Prepare data report for governors", priority: "high", status: "not_started", deadline: new Date(now.getTime() + 1209600000), assigned_to: staff[0].id, category: "Reporting" },
    { title: "Mark Year 9 end of unit assessments", priority: "urgent", status: "completed", completed_at: new Date(), assigned_to: staff[1].id, category: "Assessment" },
    { title: "Update classroom displays for new term", priority: "low", status: "completed", completed_at: new Date(), assigned_to: staff[5].id, category: "Environment" },
    { title: "Review SEN provision in English", priority: "medium", status: "not_started", deadline: new Date(now.getTime() + 2592000000), assigned_to: staff[2].id, category: "Inclusion" },
    { title: "Arrange cross-curricular project with History dept", priority: "low", status: "not_started", deadline: new Date(now.getTime() + 5184000000), assigned_to: staff[4].id, category: "Collaboration" },
    { title: "Complete KS3 assessment analysis", priority: "high", status: "completed", completed_at: new Date(), assigned_to: staff[0].id, category: "Assessment" },
    { title: "Finalise exam invigilation rota", priority: "high", status: "waiting", deadline: new Date(now.getTime() + 1209600000), assigned_to: staff[0].id, category: "Exams" },
  ];

  await supabase.from("tasks").insert(
    tasks.map(t => ({
      ...t,
      created_by: "00000000-0000-0000-0000-000000000000", // Will be replaced by real user
      created_at: new Date().toISOString(),
    }))
  ).select();

  // 6. Create observations
  await supabase.from("observations").insert([
    { teacher_id: staff[3].id, observer_id: "00000000-0000-0000-0000-000000000000", subject: "English Language", year_group: "Year 9", observation_type: "formal", observation_focus: "Questioning techniques and student engagement", scheduled_date: "2026-09-25", status: "feedback_pending", raw_notes: "Good use of cold calling. Wait time could be extended. Some students disengaged during independent work.", strengths: "Clear lesson objectives, good rapport with students, effective starter activity.", areas_for_development: "Extend wait time after questions, differentiate independent tasks, incorporate more peer assessment." },
    { teacher_id: staff[1].id, observer_id: "00000000-0000-0000-0000-000000000000", subject: "English Language", year_group: "Year 11", observation_type: "formal", observation_focus: "Exam preparation and revision strategies", scheduled_date: "2026-09-18", status: "coaching_pending", raw_notes: "Effective exam technique modelling. Good use of model answers. Students need more timed practice.", strengths: "Excellent subject knowledge, clear explanations, good use of past papers.", areas_for_development: "Build in more timed practice, vary revision activities, include peer marking exercises." },
    { teacher_id: staff[5].id, observer_id: "00000000-0000-0000-0000-000000000000", subject: "Drama & English", year_group: "Year 10", observation_type: "informal", observation_focus: "Group work and collaborative learning", scheduled_date: "2026-10-02", status: "scheduled" },
    { teacher_id: staff[4].id, observer_id: "00000000-0000-0000-0000-000000000000", subject: "English Literature", year_group: "Year 12", observation_type: "formal", observation_focus: "A-Level seminar discussion quality", scheduled_date: "2026-08-20", status: "completed", raw_notes: "Excellent seminar discussion. High level of student participation. Good use of critical theory.", strengths: "Strong academic rigour, excellent student preparation, good use of wider reading.", areas_for_development: "Encourage quieter students to contribute, vary discussion formats.", feedback_approved: true },
  ]).select();

  // 7. Create meetings
  const today = new Date();
  await supabase.from("meetings").insert([
    { title: "Weekly Department Briefing", meeting_type: "department", date: today.toISOString().split("T")[0], start_time: "08:30", end_time: "09:00", location: "English Office", created_by: "00000000-0000-0000-0000-000000000000", agenda: "1. Exam results review\n2. Upcoming observations\n3. Resource requests\n4. AOB" },
    { title: "NQT Progress Review", meeting_type: "coaching", date: new Date(today.getTime() + 172800000).toISOString().split("T")[0], start_time: "15:30", end_time: "16:00", location: "HoD Office", created_by: "00000000-0000-0000-0000-000000000000" },
    { title: "Year 11 Parent Evening", meeting_type: "parent", date: new Date(today.getTime() + 604800000).toISOString().split("T")[0], start_time: "17:00", end_time: "19:00", location: "Main Hall", created_by: "00000000-0000-0000-0000-000000000000" },
    { title: "SLT Curriculum Review", meeting_type: "senior_leadership", date: new Date(today.getTime() + 259200000).toISOString().split("T")[0], start_time: "09:00", end_time: "10:30", location: "Conference Room", created_by: "00000000-0000-0000-0000-000000000000" },
  ]);

  // 8. Create department goals
  await supabase.from("department_goals").insert([
    { department_id: dept.id, title: "Improve GCSE English Language pass rate to 85%", academic_year: "2026-2027", term: "Autumn", status: "active", progress_percentage: 35, target_date: "2027-06-30", success_measures: "85% of students achieve grade 4 or above in English Language GCSE" },
    { department_id: dept.id, title: "Implement new KS3 assessment framework", academic_year: "2026-2027", term: "Autumn", status: "active", progress_percentage: 60, target_date: "2026-12-15", success_measures: "All KS3 teachers using consistent assessment criteria by December 2026" },
    { department_id: dept.id, title: "Increase A-Level English Literature uptake by 20%", academic_year: "2026-2027", term: "Autumn", status: "planned", progress_percentage: 10, target_date: "2027-09-01", success_measures: "20% increase in Year 12 enrolment for English Literature" },
  ]);

  // 9. Create countdowns
  const countdowns = [
    { title: "Year 11 Mock Exams Begin", event_date: new Date(today.getTime() + 1209600000).toISOString(), urgency: "approaching", completion_percentage: 70 },
    { title: "GCSE Exam Period Starts", event_date: new Date(today.getTime() + 7776000000).toISOString(), urgency: "normal", completion_percentage: 45 },
    { title: "End of Autumn Term", event_date: new Date(today.getTime() + 16416000000).toISOString(), urgency: "normal", completion_percentage: 30 },
    { title: "Department Budget Deadline", event_date: new Date(today.getTime() + 259200000).toISOString(), urgency: "important", completion_percentage: 25 },
    { title: "Ofsted Inspection Window", event_date: new Date(today.getTime() + 2592000000).toISOString(), urgency: "normal", completion_percentage: 15 },
    { title: "A-Level Results Day", event_date: new Date(today.getTime() + 32140800000).toISOString(), urgency: "normal", completion_percentage: 0 },
  ];
  await supabase.from("countdowns").insert(countdowns);

  // 10. Create leadership quotes
  await supabase.from("leadership_quotes").insert([
    { text: "Leadership is not about being in charge. It is about taking care of those in your charge.", author: "Simon Sinek" },
    { text: "The function of leadership is to produce more leaders, not more followers.", author: "Ralph Nader" },
    { text: "Great leaders don't set out to be a leader. They set out to make a difference.", author: "Jeremy Bravo" },
    { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
    { text: "The art of teaching is the art of assisting discovery.", author: "Mark Van Doren" },
    { text: "Every student can learn, just not on the same day, or the same way.", author: "George Evans" },
    { text: "A good leader takes a little more than his share of the blame, a little less than his share of the credit.", author: "Arnold H. Glasow" },
  ]);

  console.log("Seed complete!");
  console.log("School ID:", school.id);
  console.log("Department ID:", dept.id);
  console.log("Staff created:", staff.length);
}

seed().catch(console.error);
