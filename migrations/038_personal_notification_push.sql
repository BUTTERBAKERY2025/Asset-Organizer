-- Outbox is populated ONLY by inserts after this trigger is installed.
-- Existing notifications are intentionally never backfilled/replayed.
CREATE TABLE IF NOT EXISTS personal_push_activation (
  key text PRIMARY KEY,
  activated_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE personal_push_activation ENABLE ROW LEVEL SECURITY;
INSERT INTO personal_push_activation(key) VALUES ('personal_notifications_v1') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS personal_notification_push_outbox (
  notification_id integer PRIMARY KEY REFERENCES notifications(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimed_at timestamp,
  attempt_count integer NOT NULL DEFAULT 0,
  next_retry_at timestamp,
  delivered_at timestamp,
  failed_at timestamp,
  last_error text,
  created_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE personal_notification_push_outbox ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_personal_push_due ON personal_notification_push_outbox (next_retry_at, notification_id)
  WHERE delivered_at IS NULL AND failed_at IS NULL;
CREATE TABLE IF NOT EXISTS personal_notification_push_deliveries (
  notification_id integer NOT NULL REFERENCES personal_notification_push_outbox(notification_id) ON DELETE CASCADE,
  subscription_id integer NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  status text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  delivered_at timestamp,
  updated_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, subscription_id)
);
ALTER TABLE personal_notification_push_deliveries ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION enqueue_personal_notification_push() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- A branch-only notification has no proven individual recipient.
  IF NEW.user_id IS NOT NULL AND NEW.created_at >=
    (SELECT activated_at FROM personal_push_activation WHERE key = 'personal_notifications_v1') THEN
    INSERT INTO personal_notification_push_outbox(notification_id, user_id)
    VALUES (NEW.id, NEW.user_id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_enqueue_personal_notification_push ON notifications;
CREATE TRIGGER trg_enqueue_personal_notification_push
  AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION enqueue_personal_notification_push();