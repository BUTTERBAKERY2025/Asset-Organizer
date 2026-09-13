BEGIN;

CREATE TABLE IF NOT EXISTS manual_production_operations (
  id bigserial PRIMARY KEY,
  actor_id varchar NOT NULL,
  operation varchar(32) NOT NULL,
  idempotency_key varchar(128) NOT NULL,
  payload_hash varchar(64) NOT NULL,
  branch_id varchar NOT NULL,
  response_status integer NOT NULL,
  response_json jsonb NOT NULL,
  created_at timestamp NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_manual_production_operations_actor_operation_key
    UNIQUE (actor_id, operation, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_manual_production_operations_branch_id
  ON manual_production_operations (branch_id);

COMMIT;