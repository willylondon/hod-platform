-- ============================================================
-- TIMETABLE UPLOAD & PARSING
-- Extends the timetable_imports stub from 001_schema.sql and adds
-- a parsed-slots table plus a private storage bucket for uploads.
-- ============================================================

-- ------------------------------------------------------------
-- Extend timetable_imports
-- ------------------------------------------------------------
ALTER TABLE timetable_imports
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT CHECK (file_type IN ('csv', 'xlsx', 'image')),
  ADD COLUMN IF NOT EXISTS raw_text TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- ------------------------------------------------------------
-- Parsed timetable slots (one row per day x period cell)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS timetable_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_id UUID NOT NULL REFERENCES timetable_imports(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  period_label TEXT NOT NULL,
  start_time TIME,
  end_time TIME,
  content TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'class'
    CHECK (kind IN ('class', 'registration', 'break', 'lunch', 'assembly', 'meeting', 'clubs', 'free')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS timetable_slots_import_idx ON timetable_slots (import_id);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- School-scoped: users can only see/insert/delete rows that
-- belong to their own school (matching 001_schema.sql style).
-- ------------------------------------------------------------
ALTER TABLE timetable_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can read timetable imports" ON timetable_imports FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.school_id = timetable_imports.school_id)
);

CREATE POLICY "School members can insert timetable imports" ON timetable_imports FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.school_id = timetable_imports.school_id)
);

CREATE POLICY "School members can delete timetable imports" ON timetable_imports FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.school_id = timetable_imports.school_id)
);

CREATE POLICY "School members can read timetable slots" ON timetable_slots FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM timetable_imports ti
    JOIN profiles p ON p.school_id = ti.school_id
    WHERE ti.id = timetable_slots.import_id AND p.id = auth.uid()
  )
);

CREATE POLICY "School members can insert timetable slots" ON timetable_slots FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM timetable_imports ti
    JOIN profiles p ON p.school_id = ti.school_id
    WHERE ti.id = timetable_slots.import_id AND p.id = auth.uid()
  )
);

CREATE POLICY "School members can delete timetable slots" ON timetable_slots FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM timetable_imports ti
    JOIN profiles p ON p.school_id = ti.school_id
    WHERE ti.id = timetable_slots.import_id AND p.id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- Storage bucket for original uploads (private).
-- Guarded so re-running the migration is safe.
-- NOTE: if this statement fails with insufficient privileges,
-- create a private bucket named 'timetables' via the Supabase
-- dashboard instead (Storage -> New bucket).
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('timetables', 'timetables', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can read/write/delete objects inside their
-- own folder ({user_id}/...) within the timetables bucket.
CREATE POLICY "Users can read own timetable files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'timetables' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload own timetable files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'timetables' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own timetable files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'timetables' AND auth.uid()::text = (storage.foldername(name))[1]
  );
