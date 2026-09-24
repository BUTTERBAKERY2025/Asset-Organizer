BEGIN;

ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS push_sent_at timestamp;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS push_claimed_at timestamp;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS push_attempt_count integer NOT NULL DEFAULT 0;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS push_next_retry_at timestamp;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS push_failed_at timestamp;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id serial PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS push_vapid_config (
  id serial PRIMARY KEY,
  public_key text NOT NULL,
  private_key text NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS push_notification_deliveries (
  id serial PRIMARY KEY,
  notification_id integer NOT NULL REFERENCES system_notifications(id) ON DELETE CASCADE,
  subscription_id integer NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  status text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  delivered_at timestamp,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT idx_push_delivery_notification_subscription UNIQUE(notification_id, subscription_id)
);
CREATE INDEX IF NOT EXISTS idx_push_delivery_notification
  ON push_notification_deliveries(notification_id);

CREATE TABLE IF NOT EXISTS push_migration_state (
  key text PRIMARY KEY,
  applied_at timestamp DEFAULT now() NOT NULL
);

-- Deploying delivery tracking must not replay old, already-visible rows whose
-- pre-tracking delivery outcome is unknowable. Future scheduled rows stay due.
WITH installed AS (
  INSERT INTO push_migration_state(key)
  VALUES ('delivery_tracking_v1')
  ON CONFLICT DO NOTHING
  RETURNING key
)
UPDATE system_notifications
SET push_sent_at = now()
WHERE push_sent_at IS NULL
  AND (start_date IS NULL OR start_date <= now())
  AND EXISTS (SELECT 1 FROM installed);

COMMIT;