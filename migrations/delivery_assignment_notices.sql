-- Apply this additive migration to installations that already ran
-- delivery_notification_outbox.sql. No outbox rows are removed.
ALTER TABLE delivery_notification_outbox
  DROP CONSTRAINT IF EXISTS delivery_notification_outbox_event_type_check;
ALTER TABLE delivery_notification_outbox
  ADD CONSTRAINT delivery_notification_outbox_event_type_check
  CHECK (event_type IN ('failed','cancelled','awaiting_receipt','receipt_approved',
                       'overdue','escalated','assigned','reassigned'));