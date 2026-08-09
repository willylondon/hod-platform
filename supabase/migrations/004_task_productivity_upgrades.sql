-- Task productivity upgrade: mini-checklists, private document attachments,
-- and deduplicated daily/weekly in-app task reminders.

CREATE TABLE task_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  file_size BIGINT NOT NULL CHECK (file_size >= 0),
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ADD COLUMN delivery_key TEXT;
CREATE UNIQUE INDEX notifications_user_delivery_key_idx
  ON notifications (user_id, delivery_key);
CREATE INDEX task_attachments_task_id_idx ON task_attachments (task_id);
CREATE INDEX task_attachments_uploaded_by_idx ON task_attachments (uploaded_by);
CREATE INDEX checklist_items_parent_idx ON checklist_items (parent_type, parent_id, sort_order);
CREATE INDEX reminders_user_id_idx ON reminders (user_id);

ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Task owners can read checklist items"
ON checklist_items FOR SELECT
TO authenticated
USING (
  parent_type = 'task'
  AND EXISTS (
    SELECT 1 FROM tasks
    WHERE tasks.id = checklist_items.parent_id
      AND tasks.created_by = (SELECT auth.uid())
  )
);

CREATE POLICY "Task owners can create checklist items"
ON checklist_items FOR INSERT
TO authenticated
WITH CHECK (
  parent_type = 'task'
  AND EXISTS (
    SELECT 1 FROM tasks
    WHERE tasks.id = checklist_items.parent_id
      AND tasks.created_by = (SELECT auth.uid())
  )
);

CREATE POLICY "Task owners can update checklist items"
ON checklist_items FOR UPDATE
TO authenticated
USING (
  parent_type = 'task'
  AND EXISTS (
    SELECT 1 FROM tasks
    WHERE tasks.id = checklist_items.parent_id
      AND tasks.created_by = (SELECT auth.uid())
  )
)
WITH CHECK (
  parent_type = 'task'
  AND EXISTS (
    SELECT 1 FROM tasks
    WHERE tasks.id = checklist_items.parent_id
      AND tasks.created_by = (SELECT auth.uid())
  )
);

CREATE POLICY "Task owners can delete checklist items"
ON checklist_items FOR DELETE
TO authenticated
USING (
  parent_type = 'task'
  AND EXISTS (
    SELECT 1 FROM tasks
    WHERE tasks.id = checklist_items.parent_id
      AND tasks.created_by = (SELECT auth.uid())
  )
);

-- Preserve the existing prototype behaviour for workflow, observation, and
-- meeting checklists now that RLS is enabled on this shared table.
CREATE POLICY "Authenticated users can manage non-task checklist items"
ON checklist_items FOR ALL
TO authenticated
USING (
  parent_type <> 'task'
)
WITH CHECK (
  parent_type <> 'task'
);

CREATE POLICY "Task owners can read attachments"
ON task_attachments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tasks
    WHERE tasks.id = task_attachments.task_id
      AND tasks.created_by = (SELECT auth.uid())
  )
);

CREATE POLICY "Task owners can add attachments"
ON task_attachments FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM tasks
    WHERE tasks.id = task_attachments.task_id
      AND tasks.created_by = (SELECT auth.uid())
  )
);

CREATE POLICY "Task owners can remove attachments"
ON task_attachments FOR DELETE
TO authenticated
USING (
  uploaded_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM tasks
    WHERE tasks.id = task_attachments.task_id
      AND tasks.created_by = (SELECT auth.uid())
  )
);

CREATE POLICY "Users can read own reminders"
ON reminders FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can manage own reminders"
ON reminders FOR ALL
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can read own notifications"
ON notifications FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create own notifications"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own notifications"
ON notifications FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can read own settings"
ON settings FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create own settings"
ON settings FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own settings"
ON settings FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  checklist_items,
  task_attachments,
  reminders,
  notifications,
  settings
TO authenticated;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'task-documents',
  'task-documents',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Users can read own task documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "Users can upload own task documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "Users can delete own task documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);
