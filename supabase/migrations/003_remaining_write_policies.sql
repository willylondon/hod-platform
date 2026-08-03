-- Migration 002 covered schools/departments/staff/observations/calendar_events
-- but was never applied to the live project, and several other tables used by
-- write paths in the app (workflow_instances, workflow_templates, meetings,
-- meeting_actions, department_goals) were never given write policies at all.
-- profiles also had no INSERT policy, so a brand-new user's own profile row
-- could never be created (onboarding relies on this).

CREATE POLICY "Users can create own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Creators can start workflow instances"
ON workflow_instances FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators can update own workflow instances"
ON workflow_instances FOR UPDATE
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Templates are shared reference data (not owned by a single user), matching
-- the existing "Auth users can read" policy already on this table.
CREATE POLICY "Auth users can update workflow templates"
ON workflow_templates FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can create workflow templates"
ON workflow_templates FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Creators can create meetings"
ON meetings FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators can update own meetings"
ON meetings FOR UPDATE
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

ALTER TABLE meeting_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read meeting actions"
ON meeting_actions FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Meeting owners can manage actions"
ON meeting_actions FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_actions.meeting_id AND meetings.created_by = auth.uid())
);

CREATE POLICY "Meeting owners can update actions"
ON meeting_actions FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_actions.meeting_id AND meetings.created_by = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_actions.meeting_id AND meetings.created_by = auth.uid())
);

-- department_goals has no per-row owner column, so (like workflow templates)
-- any authenticated HoD can manage goals — matching the existing prototype-level
-- "single school" access model already used elsewhere in this schema.
CREATE POLICY "Auth users can create department goals"
ON department_goals FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can update department goals"
ON department_goals FOR UPDATE
USING (auth.role() = 'authenticated');
