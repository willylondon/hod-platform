-- HoD Productivity Platform — Database Schema
-- Supabase PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SCHOOLS
-- ============================================================
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  academic_year TEXT NOT NULL DEFAULT '2026-2027',
  current_term TEXT NOT NULL DEFAULT 'Autumn',
  working_days TEXT[] NOT NULL DEFAULT ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'],
  preferred_hours_start TIME NOT NULL DEFAULT '08:00',
  preferred_hours_end TIME NOT NULL DEFAULT '16:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  head_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'head_of_department' CHECK (role IN ('head_of_department','teacher','senior_leader','administrator')),
  school_id UUID REFERENCES schools(id),
  department_id UUID REFERENCES departments(id),
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STAFF DIRECTORY
-- ============================================================
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id),
  full_name TEXT NOT NULL,
  job_title TEXT NOT NULL DEFAULT 'Teacher',
  subject TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- WORKFLOW TEMPLATES
-- ============================================================
CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  default_priority TEXT NOT NULL DEFAULT 'medium' CHECK (default_priority IN ('low','medium','high','urgent')),
  default_duration_days INTEGER,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workflow_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  relative_due_day INTEGER,
  depends_on_step_id UUID REFERENCES workflow_steps(id),
  responsible_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workflow_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES workflow_templates(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','waiting','completed','cancelled')),
  start_date DATE,
  target_date DATE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','waiting','completed','cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  deadline TIMESTAMPTZ,
  start_date DATE,
  estimated_duration_minutes INTEGER,
  assigned_to UUID REFERENCES staff(id),
  category TEXT,
  workflow_instance_id UUID REFERENCES workflow_instances(id),
  parent_task_id UUID REFERENCES tasks(id),
  notes TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  UNIQUE(task_id, depends_on_task_id)
);

-- ============================================================
-- CHECKLIST ITEMS
-- ============================================================
CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_type TEXT NOT NULL CHECK (parent_type IN ('workflow','task','observation','meeting')),
  parent_id UUID NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  assignee UUID REFERENCES staff(id),
  deadline TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- OBSERVATIONS
-- ============================================================
CREATE TABLE observations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES staff(id),
  observer_id UUID NOT NULL REFERENCES profiles(id),
  subject TEXT,
  year_group TEXT,
  observation_type TEXT NOT NULL DEFAULT 'formal',
  observation_focus TEXT,
  scheduled_date DATE,
  scheduled_time TIME,
  duration_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','scheduled','completed','feedback_pending','coaching_pending','follow_up_pending','closed')),
  pre_observation_checklist TEXT,
  raw_notes TEXT,
  strengths TEXT,
  areas_for_development TEXT,
  agreed_actions TEXT,
  feedback_draft TEXT,
  feedback_approved BOOLEAN NOT NULL DEFAULT false,
  coaching_meeting_date DATE,
  follow_up_date DATE,
  evidence_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MEETINGS
-- ============================================================
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  meeting_type TEXT NOT NULL DEFAULT 'department' CHECK (meeting_type IN ('department','parent','coaching','one_to_one','standardization','professional_development','senior_leadership','other')),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT,
  agenda TEXT,
  preparation_checklist TEXT,
  notes TEXT,
  decisions TEXT,
  follow_up_date DATE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE meeting_attendees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id),
  UNIQUE(meeting_id, staff_id)
);

CREATE TABLE meeting_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assigned_to UUID REFERENCES staff(id),
  deadline DATE,
  converted_to_task_id UUID REFERENCES tasks(id),
  completed BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================
-- DEPARTMENT GOALS
-- ============================================================
CREATE TABLE department_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES departments(id),
  title TEXT NOT NULL,
  description TEXT,
  academic_year TEXT NOT NULL,
  term TEXT NOT NULL,
  owner_id UUID REFERENCES staff(id),
  start_date DATE,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','at_risk','achieved','paused')),
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  success_measures TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'custom' CHECK (event_type IN ('task_deadline','observation','meeting','school_event','reporting_deadline','exam','custom')),
  start_date DATE NOT NULL,
  end_date DATE,
  all_day BOOLEAN NOT NULL DEFAULT false,
  related_task_id UUID REFERENCES tasks(id),
  related_observation_id UUID REFERENCES observations(id),
  related_meeting_id UUID REFERENCES meetings(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- COUNTDOWNS
-- ============================================================
CREATE TABLE countdowns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal','approaching','important','urgent','critical')),
  related_workflow_id UUID REFERENCES workflow_instances(id),
  completion_percentage INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REMINDERS & NOTIFICATIONS
-- ============================================================
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  related_type TEXT NOT NULL CHECK (related_type IN ('task','meeting','observation','goal','countdown')),
  related_id UUID NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  timing TEXT NOT NULL DEFAULT 'at_deadline' CHECK (timing IN ('at_deadline','one_hour_before','one_day_before','three_days_before','one_week_before','custom')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  related_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AI DRAFTS
-- ============================================================
CREATE TABLE ai_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  context_type TEXT,
  context_id UUID,
  input_prompt TEXT,
  output_text TEXT NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_discarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SETTINGS & QUOTES
-- ============================================================
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) UNIQUE,
  notification_preferences JSONB DEFAULT '{"email":false,"in_app":true,"push":false}',
  ai_provider TEXT DEFAULT 'mock',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE leadership_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  text TEXT NOT NULL,
  author TEXT NOT NULL
);

-- Future: timetable support
CREATE TABLE timetable_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id),
  file_name TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed'))
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_drafts ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own profile
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Authenticated users in the same school can read shared data
CREATE POLICY "School members can read" ON staff FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.school_id = staff.school_id)
);

CREATE POLICY "School members can read tasks" ON tasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid())
);

CREATE POLICY "Users can manage own tasks" ON tasks FOR ALL USING (created_by = auth.uid());

-- Default: authenticated users can read most tables
CREATE POLICY "Auth users can read" ON workflow_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can read" ON workflow_instances FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can read" ON observations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can read" ON meetings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can read" ON department_goals FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can read" ON ai_drafts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Auth users can create ai_drafts" ON ai_drafts FOR INSERT WITH CHECK (auth.uid() = user_id);
