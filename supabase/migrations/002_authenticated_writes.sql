-- Allow authenticated HoDs to manage the records created by the interactive
-- forms. The original schema only granted read access for several of these
-- tables, so successful-looking forms were rejected by Row Level Security.

CREATE POLICY "School members can update own school"
ON schools FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.school_id = schools.id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.school_id = schools.id
  )
);

CREATE POLICY "School members can read own school"
ON schools FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.school_id = schools.id
  )
);

CREATE POLICY "Department members can read own department"
ON departments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.department_id = departments.id
  )
);

CREATE POLICY "Department members can update own department"
ON departments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.department_id = departments.id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.department_id = departments.id
  )
);

CREATE POLICY "School members can add staff"
ON staff FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.school_id = staff.school_id
  )
);

CREATE POLICY "School members can update staff"
ON staff FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.school_id = staff.school_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.school_id = staff.school_id
  )
);

CREATE POLICY "Observers can create observations"
ON observations FOR INSERT
WITH CHECK (observer_id = auth.uid());

CREATE POLICY "Observers can update own observations"
ON observations FOR UPDATE
USING (observer_id = auth.uid())
WITH CHECK (observer_id = auth.uid());

CREATE POLICY "Observers can delete own observations"
ON observations FOR DELETE
USING (observer_id = auth.uid());

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own calendar events"
ON calendar_events FOR SELECT
USING (created_by = auth.uid());

CREATE POLICY "Users can create own calendar events"
ON calendar_events FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own calendar events"
ON calendar_events FOR UPDATE
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own calendar events"
ON calendar_events FOR DELETE
USING (created_by = auth.uid());

-- Settings needs to support older accounts whose profile was created without
-- school/department foreign keys. This function safely creates or renames the
-- user's own organization records in one transaction.
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
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT profiles.school_id, profiles.department_id
  INTO v_school_id, v_department_id
  FROM profiles
  WHERE profiles.id = v_user_id;

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
