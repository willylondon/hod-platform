export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "not_started" | "in_progress" | "waiting" | "completed" | "cancelled";
export type ObservationStatus = "planned" | "scheduled" | "completed" | "feedback_pending" | "coaching_pending" | "follow_up_pending" | "closed";
export type GoalStatus = "planned" | "active" | "at_risk" | "achieved" | "paused";
export type MeetingType = "department" | "parent" | "coaching" | "one_to_one" | "standardization" | "professional_development" | "senior_leadership" | "other";
export type UserRole = "head_of_department" | "teacher" | "senior_leader" | "administrator";
export type CountdownUrgency = "normal" | "approaching" | "important" | "urgent" | "critical";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  school_id: string;
  department_id: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface School {
  id: string;
  name: string;
  academic_year: string;
  current_term: string;
  working_days: string[];
  preferred_hours_start: string;
  preferred_hours_end: string;
  created_at: string;
}

export interface Department {
  id: string;
  school_id: string;
  name: string;
  head_id: string;
  created_at: string;
}

export interface StaffMember {
  id: string;
  school_id: string;
  department_id: string;
  full_name: string;
  job_title: string;
  subject?: string;
  email: string;
  phone?: string;
  status: "active" | "inactive";
  start_date: string;
  notes?: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  deadline?: string;
  start_date?: string;
  estimated_duration_minutes?: number;
  assigned_to?: string;
  category?: string;
  workflow_instance_id?: string;
  parent_task_id?: string;
  notes?: string;
  is_recurring: boolean;
  completed_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
}

export interface ChecklistItem {
  id: string;
  parent_type: "workflow" | "task" | "observation" | "meeting";
  parent_id: string;
  title: string;
  completed: boolean;
  sort_order: number;
  assignee?: string;
  deadline?: string;
  notes?: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type?: string;
  created_at: string;
}

export interface WorkflowTemplate {
  id: string;
  title: string;
  description?: string;
  category: string;
  default_priority: Priority;
  default_duration_days?: number;
  is_archived: boolean;
  created_at: string;
}

export interface WorkflowStep {
  id: string;
  template_id: string;
  title: string;
  description?: string;
  sort_order: number;
  relative_due_day?: number;
  depends_on_step_id?: string;
  responsible_role?: string;
}

export interface WorkflowInstance {
  id: string;
  template_id: string;
  title: string;
  status: TaskStatus;
  start_date?: string;
  target_date?: string;
  created_by: string;
  created_at: string;
}

export interface Observation {
  id: string;
  teacher_id: string;
  observer_id: string;
  subject?: string;
  year_group?: string;
  observation_type: string;
  observation_focus?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  duration_minutes?: number;
  status: ObservationStatus;
  pre_observation_checklist?: string;
  raw_notes?: string;
  strengths?: string;
  areas_for_development?: string;
  agreed_actions?: string;
  feedback_draft?: string;
  feedback_approved: boolean;
  coaching_meeting_date?: string;
  follow_up_date?: string;
  evidence_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  title: string;
  meeting_type: MeetingType;
  date: string;
  start_time: string;
  end_time: string;
  location?: string;
  agenda?: string;
  preparation_checklist?: string;
  notes?: string;
  decisions?: string;
  follow_up_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MeetingAttendee {
  id: string;
  meeting_id: string;
  staff_id: string;
}

export interface MeetingAction {
  id: string;
  meeting_id: string;
  title: string;
  assigned_to?: string;
  deadline?: string;
  converted_to_task_id?: string;
  completed: boolean;
}

export interface DepartmentGoal {
  id: string;
  department_id: string;
  title: string;
  description?: string;
  academic_year: string;
  term: string;
  owner_id?: string;
  start_date?: string;
  target_date?: string;
  status: GoalStatus;
  progress_percentage: number;
  success_measures?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_type: "task_deadline" | "observation" | "meeting" | "school_event" | "reporting_deadline" | "exam" | "custom";
  start_date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  attendees?: string;
  all_day: boolean;
  related_task_id?: string;
  related_observation_id?: string;
  related_meeting_id?: string;
  created_by: string;
  created_at: string;
}

export interface Countdown {
  id: string;
  title: string;
  event_date: string;
  event_time?: string;
  urgency: CountdownUrgency;
  related_workflow_id?: string;
  completion_percentage: number;
  created_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  related_type: "task" | "meeting" | "observation" | "goal" | "countdown";
  related_id: string;
  remind_at: string;
  timing: "at_deadline" | "one_hour_before" | "one_day_before" | "three_days_before" | "one_week_before" | "custom";
  is_read: boolean;
  created_at: string;
}

export interface AiDraft {
  id: string;
  user_id: string;
  action: string;
  context_type?: string;
  context_id?: string;
  input_prompt?: string;
  output_text: string;
  is_approved: boolean;
  is_discarded: boolean;
  created_at: string;
}

export interface LeadershipQuote {
  id: string;
  text: string;
  author: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  related_url?: string;
  delivery_key?: string;
  created_at: string;
}

export interface TimetableImport {
  id: string;
  school_id: string;
  file_name: string | null;
  uploaded_at: string;
  status: "pending" | "processing" | "completed" | "failed";
  uploaded_by: string | null;
  storage_path: string | null;
  file_type: "csv" | "xlsx" | "image" | null;
  raw_text: string | null;
  error_message: string | null;
}

export interface TimetableSlot {
  id: string;
  import_id: string;
  day_of_week: number; // 1 = Monday … 7
  period_label: string;
  start_time: string | null; // HH:MM:SS
  end_time: string | null;
  content: string;
  kind:
    | "class"
    | "registration"
    | "break"
    | "lunch"
    | "assembly"
    | "meeting"
    | "clubs"
    | "free";
  sort_order: number;
}
