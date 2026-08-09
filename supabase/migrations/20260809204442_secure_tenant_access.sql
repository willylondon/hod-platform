-- Close direct-Data-API authorization gaps. An authenticated Supabase account
-- must first have a server-provisioned profile, and tenant records are limited
-- to their owner or the caller's department/school.

-- Profiles are provisioned by the allowlist-protected onboarding route. Client
-- code may edit presentation preferences, but cannot create a profile or move
-- itself to another school/department through the Data API.
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = id)
WITH CHECK (
  (SELECT auth.uid()) = id
  AND LOWER(email) = LOWER(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
);

REVOKE INSERT ON profiles FROM authenticated;
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, role, avatar_url, preferences, updated_at) ON profiles TO authenticated;

-- Tasks and personal workflow runs are private to their creator.
DROP POLICY IF EXISTS "School members can read tasks" ON tasks;
DROP POLICY IF EXISTS "Users can manage own tasks" ON tasks;

CREATE POLICY "Users can read own tasks"
ON tasks FOR SELECT TO authenticated
USING (created_by = (SELECT auth.uid()));
CREATE POLICY "Users can create own tasks"
ON tasks FOR INSERT TO authenticated
WITH CHECK (created_by = (SELECT auth.uid()));
CREATE POLICY "Users can update own tasks"
ON tasks FOR UPDATE TO authenticated
USING (created_by = (SELECT auth.uid()))
WITH CHECK (created_by = (SELECT auth.uid()));
CREATE POLICY "Users can delete own tasks"
ON tasks FOR DELETE TO authenticated
USING (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Auth users can read" ON workflow_instances;
DROP POLICY IF EXISTS "Creators can start workflow instances" ON workflow_instances;
DROP POLICY IF EXISTS "Creators can update own workflow instances" ON workflow_instances;

CREATE POLICY "Creators can read own workflow instances"
ON workflow_instances FOR SELECT TO authenticated
USING (created_by = (SELECT auth.uid()));
CREATE POLICY "Creators can start workflow instances"
ON workflow_instances FOR INSERT TO authenticated
WITH CHECK (created_by = (SELECT auth.uid()));
CREATE POLICY "Creators can update own workflow instances"
ON workflow_instances FOR UPDATE TO authenticated
USING (created_by = (SELECT auth.uid()))
WITH CHECK (created_by = (SELECT auth.uid()));
CREATE POLICY "Creators can delete own workflow instances"
ON workflow_instances FOR DELETE TO authenticated
USING (created_by = (SELECT auth.uid()));

-- Workflow templates are shared reference data, but only provisioned app users
-- may see or archive them.
DROP POLICY IF EXISTS "Auth users can read" ON workflow_templates;
DROP POLICY IF EXISTS "Auth users can update workflow templates" ON workflow_templates;
DROP POLICY IF EXISTS "Auth users can create workflow templates" ON workflow_templates;

CREATE POLICY "App users can read workflow templates"
ON workflow_templates FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid())));
CREATE POLICY "App users can update workflow templates"
ON workflow_templates FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid())));
CREATE POLICY "App users can create workflow templates"
ON workflow_templates FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid())));

-- Meetings and observations currently have creator/observer ownership rather
-- than a tenant id, so keep them private to that owner.
DROP POLICY IF EXISTS "Auth users can read" ON meetings;
DROP POLICY IF EXISTS "Creators can create meetings" ON meetings;
DROP POLICY IF EXISTS "Creators can update own meetings" ON meetings;

CREATE POLICY "Creators can read own meetings"
ON meetings FOR SELECT TO authenticated
USING (created_by = (SELECT auth.uid()));
CREATE POLICY "Creators can create meetings"
ON meetings FOR INSERT TO authenticated
WITH CHECK (created_by = (SELECT auth.uid()));
CREATE POLICY "Creators can update own meetings"
ON meetings FOR UPDATE TO authenticated
USING (created_by = (SELECT auth.uid()))
WITH CHECK (created_by = (SELECT auth.uid()));
CREATE POLICY "Creators can delete own meetings"
ON meetings FOR DELETE TO authenticated
USING (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Auth users can read" ON observations;
DROP POLICY IF EXISTS "Observers can create observations" ON observations;
DROP POLICY IF EXISTS "Observers can update own observations" ON observations;
DROP POLICY IF EXISTS "Observers can delete own observations" ON observations;

CREATE POLICY "Observers can read own observations"
ON observations FOR SELECT TO authenticated
USING (observer_id = (SELECT auth.uid()));
CREATE POLICY "Observers can create observations"
ON observations FOR INSERT TO authenticated
WITH CHECK (
  observer_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM staff
    JOIN profiles ON profiles.id = (SELECT auth.uid())
    WHERE staff.id = observations.teacher_id
      AND staff.school_id = profiles.school_id
  )
);
CREATE POLICY "Observers can update own observations"
ON observations FOR UPDATE TO authenticated
USING (observer_id = (SELECT auth.uid()))
WITH CHECK (
  observer_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM staff
    JOIN profiles ON profiles.id = (SELECT auth.uid())
    WHERE staff.id = observations.teacher_id
      AND staff.school_id = profiles.school_id
  )
);
CREATE POLICY "Observers can delete own observations"
ON observations FOR DELETE TO authenticated
USING (observer_id = (SELECT auth.uid()));

-- Department goals are shared only inside the caller's department.
DROP POLICY IF EXISTS "Auth users can read" ON department_goals;
DROP POLICY IF EXISTS "Auth users can create department goals" ON department_goals;
DROP POLICY IF EXISTS "Auth users can update department goals" ON department_goals;

CREATE POLICY "Department members can read goals"
ON department_goals FOR SELECT TO authenticated
USING (department_id IN (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid())));
CREATE POLICY "Department members can create goals"
ON department_goals FOR INSERT TO authenticated
WITH CHECK (department_id IN (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid())));
CREATE POLICY "Department members can update goals"
ON department_goals FOR UPDATE TO authenticated
USING (department_id IN (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid())))
WITH CHECK (department_id IN (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid())));
CREATE POLICY "Department members can delete goals"
ON department_goals FOR DELETE TO authenticated
USING (department_id IN (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid())));

-- Meeting actions inherit their parent meeting's ownership.
DROP POLICY IF EXISTS "Auth users can read meeting actions" ON meeting_actions;
DROP POLICY IF EXISTS "Meeting owners can manage actions" ON meeting_actions;
DROP POLICY IF EXISTS "Meeting owners can update actions" ON meeting_actions;

CREATE POLICY "Meeting owners can read actions"
ON meeting_actions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM meetings
  WHERE meetings.id = meeting_actions.meeting_id
    AND meetings.created_by = (SELECT auth.uid())
));
CREATE POLICY "Meeting owners can create actions"
ON meeting_actions FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM meetings
  WHERE meetings.id = meeting_actions.meeting_id
    AND meetings.created_by = (SELECT auth.uid())
));
CREATE POLICY "Meeting owners can update actions"
ON meeting_actions FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM meetings
  WHERE meetings.id = meeting_actions.meeting_id
    AND meetings.created_by = (SELECT auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM meetings
  WHERE meetings.id = meeting_actions.meeting_id
    AND meetings.created_by = (SELECT auth.uid())
));
CREATE POLICY "Meeting owners can delete actions"
ON meeting_actions FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM meetings
  WHERE meetings.id = meeting_actions.meeting_id
    AND meetings.created_by = (SELECT auth.uid())
));

-- Checklist rows inherit ownership from their typed parent.
DROP POLICY IF EXISTS "Authenticated users can read checklist items" ON checklist_items;
DROP POLICY IF EXISTS "Authenticated users can create checklist items" ON checklist_items;
DROP POLICY IF EXISTS "Authenticated users can update checklist items" ON checklist_items;
DROP POLICY IF EXISTS "Authenticated users can delete checklist items" ON checklist_items;

CREATE POLICY "Owners can read checklist items"
ON checklist_items FOR SELECT TO authenticated
USING (
  (parent_type = 'task' AND EXISTS (SELECT 1 FROM tasks WHERE id = parent_id AND created_by = (SELECT auth.uid())))
  OR (parent_type = 'meeting' AND EXISTS (SELECT 1 FROM meetings WHERE id = parent_id AND created_by = (SELECT auth.uid())))
  OR (parent_type = 'observation' AND EXISTS (SELECT 1 FROM observations WHERE id = parent_id AND observer_id = (SELECT auth.uid())))
  OR (parent_type = 'workflow' AND EXISTS (SELECT 1 FROM workflow_instances WHERE id = parent_id AND created_by = (SELECT auth.uid())))
);
CREATE POLICY "Owners can create checklist items"
ON checklist_items FOR INSERT TO authenticated
WITH CHECK (
  (parent_type = 'task' AND EXISTS (SELECT 1 FROM tasks WHERE id = parent_id AND created_by = (SELECT auth.uid())))
  OR (parent_type = 'meeting' AND EXISTS (SELECT 1 FROM meetings WHERE id = parent_id AND created_by = (SELECT auth.uid())))
  OR (parent_type = 'observation' AND EXISTS (SELECT 1 FROM observations WHERE id = parent_id AND observer_id = (SELECT auth.uid())))
  OR (parent_type = 'workflow' AND EXISTS (SELECT 1 FROM workflow_instances WHERE id = parent_id AND created_by = (SELECT auth.uid())))
);
CREATE POLICY "Owners can update checklist items"
ON checklist_items FOR UPDATE TO authenticated
USING (
  (parent_type = 'task' AND EXISTS (SELECT 1 FROM tasks WHERE id = parent_id AND created_by = (SELECT auth.uid())))
  OR (parent_type = 'meeting' AND EXISTS (SELECT 1 FROM meetings WHERE id = parent_id AND created_by = (SELECT auth.uid())))
  OR (parent_type = 'observation' AND EXISTS (SELECT 1 FROM observations WHERE id = parent_id AND observer_id = (SELECT auth.uid())))
  OR (parent_type = 'workflow' AND EXISTS (SELECT 1 FROM workflow_instances WHERE id = parent_id AND created_by = (SELECT auth.uid())))
)
WITH CHECK (
  (parent_type = 'task' AND EXISTS (SELECT 1 FROM tasks WHERE id = parent_id AND created_by = (SELECT auth.uid())))
  OR (parent_type = 'meeting' AND EXISTS (SELECT 1 FROM meetings WHERE id = parent_id AND created_by = (SELECT auth.uid())))
  OR (parent_type = 'observation' AND EXISTS (SELECT 1 FROM observations WHERE id = parent_id AND observer_id = (SELECT auth.uid())))
  OR (parent_type = 'workflow' AND EXISTS (SELECT 1 FROM workflow_instances WHERE id = parent_id AND created_by = (SELECT auth.uid())))
);
CREATE POLICY "Owners can delete checklist items"
ON checklist_items FOR DELETE TO authenticated
USING (
  (parent_type = 'task' AND EXISTS (SELECT 1 FROM tasks WHERE id = parent_id AND created_by = (SELECT auth.uid())))
  OR (parent_type = 'meeting' AND EXISTS (SELECT 1 FROM meetings WHERE id = parent_id AND created_by = (SELECT auth.uid())))
  OR (parent_type = 'observation' AND EXISTS (SELECT 1 FROM observations WHERE id = parent_id AND observer_id = (SELECT auth.uid())))
  OR (parent_type = 'workflow' AND EXISTS (SELECT 1 FROM workflow_instances WHERE id = parent_id AND created_by = (SELECT auth.uid())))
);

-- Supporting tables were previously reachable without RLS.
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE countdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE leadership_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "App users can read workflow steps"
ON workflow_steps FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid())));

CREATE POLICY "Task owners can read dependencies"
ON task_dependencies FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM tasks WHERE id = task_id AND created_by = (SELECT auth.uid())));
CREATE POLICY "Task owners can create dependencies"
ON task_dependencies FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM tasks WHERE id = task_id AND created_by = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM tasks WHERE id = depends_on_task_id AND created_by = (SELECT auth.uid()))
);
CREATE POLICY "Task owners can delete dependencies"
ON task_dependencies FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM tasks WHERE id = task_id AND created_by = (SELECT auth.uid())));

CREATE POLICY "Meeting owners can read attendees"
ON meeting_attendees FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM meetings WHERE id = meeting_id AND created_by = (SELECT auth.uid())));
CREATE POLICY "Meeting owners can add attendees"
ON meeting_attendees FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM meetings WHERE id = meeting_id AND created_by = (SELECT auth.uid())));
CREATE POLICY "Meeting owners can remove attendees"
ON meeting_attendees FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM meetings WHERE id = meeting_id AND created_by = (SELECT auth.uid())));

CREATE POLICY "App users can read countdowns"
ON countdowns FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid())));
CREATE POLICY "App users can read leadership quotes"
ON leadership_quotes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid())));

CREATE POLICY "School members can read timetable imports"
ON timetable_imports FOR SELECT TO authenticated
USING (school_id IN (SELECT school_id FROM profiles WHERE id = (SELECT auth.uid())));
CREATE POLICY "School members can create timetable imports"
ON timetable_imports FOR INSERT TO authenticated
WITH CHECK (school_id IN (SELECT school_id FROM profiles WHERE id = (SELECT auth.uid())));
CREATE POLICY "School members can update timetable imports"
ON timetable_imports FOR UPDATE TO authenticated
USING (school_id IN (SELECT school_id FROM profiles WHERE id = (SELECT auth.uid())))
WITH CHECK (school_id IN (SELECT school_id FROM profiles WHERE id = (SELECT auth.uid())));
CREATE POLICY "School members can delete timetable imports"
ON timetable_imports FOR DELETE TO authenticated
USING (school_id IN (SELECT school_id FROM profiles WHERE id = (SELECT auth.uid())));

CREATE INDEX IF NOT EXISTS tasks_created_by_idx ON tasks (created_by);
CREATE INDEX IF NOT EXISTS workflow_instances_created_by_idx ON workflow_instances (created_by);
CREATE INDEX IF NOT EXISTS meetings_created_by_idx ON meetings (created_by);
CREATE INDEX IF NOT EXISTS observations_observer_id_idx ON observations (observer_id);
CREATE INDEX IF NOT EXISTS department_goals_department_id_idx ON department_goals (department_id);

-- New Supabase projects no longer rely on automatic public-schema grants.
-- Explicit object grants make the Data API reachable; RLS remains the row-level
-- authorization boundary for every table below.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  profiles,
  schools,
  departments,
  staff,
  workflow_templates,
  workflow_steps,
  workflow_instances,
  tasks,
  task_dependencies,
  checklist_items,
  task_attachments,
  observations,
  meetings,
  meeting_attendees,
  meeting_actions,
  department_goals,
  calendar_events,
  countdowns,
  reminders,
  notifications,
  ai_drafts,
  settings,
  leadership_quotes,
  timetable_imports
TO authenticated;

-- Re-apply the profile column boundary after the general table grants.
REVOKE INSERT ON profiles FROM authenticated;
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, role, avatar_url, preferences, updated_at) ON profiles TO authenticated;

-- Future settings rows should not opt users into external email by default.
ALTER TABLE settings
  ALTER COLUMN notification_preferences SET DEFAULT
  '{"email":false,"in_app":true,"push":false,"telegram":false,"deadline_reminders":true,"daily_task_digest":true,"weekly_task_digest":true,"timezone":"America/Jamaica"}'::jsonb;

-- Keep the existing organization editor available to legitimate profiles, but
-- stop a bare Auth account from using the definer function to create records.
CREATE OR REPLACE FUNCTION set_profile_organization(
  p_school_name TEXT,
  p_department_name TEXT
)
RETURNS TABLE (school_id UUID, department_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_school_id UUID;
  v_department_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT profiles.school_id, profiles.department_id
  INTO v_school_id, v_department_id
  FROM profiles
  WHERE profiles.id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'App profile required' USING ERRCODE = '42501';
  END IF;

  IF v_school_id IS NULL THEN
    INSERT INTO schools (name)
    VALUES (NULLIF(TRIM(p_school_name), ''))
    RETURNING id INTO v_school_id;
  ELSIF NULLIF(TRIM(p_school_name), '') IS NOT NULL THEN
    UPDATE schools SET name = TRIM(p_school_name) WHERE id = v_school_id;
  END IF;

  IF v_department_id IS NULL THEN
    INSERT INTO departments (school_id, name, head_id)
    VALUES (v_school_id, NULLIF(TRIM(p_department_name), ''), v_user_id)
    RETURNING id INTO v_department_id;
  ELSIF NULLIF(TRIM(p_department_name), '') IS NOT NULL THEN
    UPDATE departments SET name = TRIM(p_department_name) WHERE id = v_department_id;
  END IF;

  UPDATE profiles
  SET school_id = v_school_id,
      department_id = v_department_id,
      updated_at = NOW()
  WHERE id = v_user_id;

  RETURN QUERY SELECT v_school_id, v_department_id;
END;
$$;

REVOKE ALL ON FUNCTION set_profile_organization(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_profile_organization(TEXT, TEXT) TO authenticated;
