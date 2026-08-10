-- Add the practical appointment details needed by HoD-created calendar events.
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS attendees TEXT;

COMMENT ON COLUMN calendar_events.attendees IS
  'Free-text people or groups involved in the appointment; avoids requiring a staff directory record.';
