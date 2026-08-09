-- Persistent browser push subscriptions and channel-level delivery receipts.
-- The scheduler uses delivery receipts to keep retries idempotent.

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push')),
  delivery_key TEXT NOT NULL,
  provider_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, channel, delivery_key)
);

CREATE INDEX push_subscriptions_user_id_idx ON push_subscriptions (user_id);
CREATE INDEX notification_deliveries_user_id_idx ON notification_deliveries (user_id, created_at DESC);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own push subscriptions"
ON push_subscriptions FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can read own delivery history"
ON notification_deliveries FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

GRANT SELECT ON TABLE push_subscriptions, notification_deliveries TO authenticated;

ALTER TABLE settings
  ALTER COLUMN notification_preferences SET DEFAULT
  '{"email":true,"in_app":true,"push":false,"deadline_reminders":true,"daily_task_digest":true,"weekly_task_digest":true,"timezone":"America/Jamaica"}'::jsonb;

UPDATE settings
SET notification_preferences =
  '{"email":true,"in_app":true,"push":false,"deadline_reminders":true,"daily_task_digest":true,"weekly_task_digest":true,"timezone":"America/Jamaica"}'::jsonb
  || COALESCE(notification_preferences, '{}'::jsonb),
  updated_at = NOW();
