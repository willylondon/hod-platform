-- Consolidate mutually exclusive checklist policies so Postgres evaluates one
-- permissive policy per action, and split reminder write access from reads.

DROP POLICY IF EXISTS "Task owners can read checklist items" ON checklist_items;
DROP POLICY IF EXISTS "Task owners can create checklist items" ON checklist_items;
DROP POLICY IF EXISTS "Task owners can update checklist items" ON checklist_items;
DROP POLICY IF EXISTS "Task owners can delete checklist items" ON checklist_items;
DROP POLICY IF EXISTS "Authenticated users can manage non-task checklist items" ON checklist_items;

CREATE POLICY "Authenticated users can read checklist items"
ON checklist_items FOR SELECT
TO authenticated
USING (
  parent_type <> 'task'
  OR (
    parent_type = 'task'
    AND EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = checklist_items.parent_id
        AND tasks.created_by = (SELECT auth.uid())
    )
  )
);

CREATE POLICY "Authenticated users can create checklist items"
ON checklist_items FOR INSERT
TO authenticated
WITH CHECK (
  parent_type <> 'task'
  OR (
    parent_type = 'task'
    AND EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = checklist_items.parent_id
        AND tasks.created_by = (SELECT auth.uid())
    )
  )
);

CREATE POLICY "Authenticated users can update checklist items"
ON checklist_items FOR UPDATE
TO authenticated
USING (
  parent_type <> 'task'
  OR (
    parent_type = 'task'
    AND EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = checklist_items.parent_id
        AND tasks.created_by = (SELECT auth.uid())
    )
  )
)
WITH CHECK (
  parent_type <> 'task'
  OR (
    parent_type = 'task'
    AND EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = checklist_items.parent_id
        AND tasks.created_by = (SELECT auth.uid())
    )
  )
);

CREATE POLICY "Authenticated users can delete checklist items"
ON checklist_items FOR DELETE
TO authenticated
USING (
  parent_type <> 'task'
  OR (
    parent_type = 'task'
    AND EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = checklist_items.parent_id
        AND tasks.created_by = (SELECT auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Users can manage own reminders" ON reminders;

CREATE POLICY "Users can create own reminders"
ON reminders FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own reminders"
ON reminders FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own reminders"
ON reminders FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS checklist_items_assignee_idx ON checklist_items (assignee);
