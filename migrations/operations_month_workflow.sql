-- Monthly operational review only. Does not lock payroll, expenses or daily records.
CREATE TABLE IF NOT EXISTS operations_month_reviews (
  id bigserial PRIMARY KEY,
  branch_id varchar NOT NULL REFERENCES branches(id),
  month varchar(7) NOT NULL CHECK (month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','reopened')),
  revision integer NOT NULL DEFAULT 0,
  declarations jsonb NOT NULL DEFAULT '[]',
  history jsonb NOT NULL DEFAULT '[]',
  fingerprint text,
  snapshot jsonb,
  closed_at timestamptz,
  closed_by varchar REFERENCES users(id),
  closed_by_name text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, month)
);