-- Additive-only migration. request_id is deliberately not unique: it is a
-- business request foreign key and multiple legitimate transfers may share it.
ALTER TABLE material_transfers
  ADD COLUMN IF NOT EXISTS idempotency_key varchar(128),
  ADD COLUMN IF NOT EXISTS idempotency_actor_id varchar REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS idempotency_action varchar(64),
  ADD COLUMN IF NOT EXISTS idempotency_payload_hash varchar(64);

CREATE UNIQUE INDEX IF NOT EXISTS uq_material_transfers_idempotency
  ON material_transfers (idempotency_actor_id, idempotency_action, idempotency_key)
  WHERE idempotency_key IS NOT NULL;