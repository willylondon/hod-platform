-- Private Telegram account links and idempotent Telegram reminder delivery.

CREATE TABLE telegram_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  chat_id TEXT UNIQUE,
  telegram_user_id TEXT,
  telegram_username TEXT,
  first_name TEXT,
  link_token_hash TEXT UNIQUE,
  link_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE telegram_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own Telegram connection"
ON telegram_connections FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

GRANT SELECT ON TABLE telegram_connections TO authenticated;

ALTER TABLE notification_deliveries
  DROP CONSTRAINT notification_deliveries_channel_check;

ALTER TABLE notification_deliveries
  ADD CONSTRAINT notification_deliveries_channel_check
  CHECK (channel IN ('email', 'push', 'telegram'));

ALTER TABLE settings
  ALTER COLUMN notification_preferences SET DEFAULT
  '{"email":true,"in_app":true,"push":false,"telegram":false,"deadline_reminders":true,"daily_task_digest":true,"weekly_task_digest":true,"timezone":"America/Jamaica"}'::jsonb;

UPDATE settings
SET notification_preferences =
  '{"email":true,"in_app":true,"push":false,"telegram":false,"deadline_reminders":true,"daily_task_digest":true,"weekly_task_digest":true,"timezone":"America/Jamaica"}'::jsonb
  || COALESCE(notification_preferences, '{}'::jsonb),
  updated_at = NOW();
