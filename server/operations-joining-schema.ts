import type { Pool } from "pg";
import { getTableColumns, getTableName } from "drizzle-orm";
import {
  jobOffers, jobOfferTokens, jobOfferAuditLog, onboardingNotifications, onboardingTokens,
} from "@shared/schema";

/** Schema only. Do not cast historical employee identifiers or seed records. */
export const OPERATIONS_JOINING_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS job_offers (
  id SERIAL PRIMARY KEY, offer_number TEXT NOT NULL UNIQUE,
  candidate_name TEXT NOT NULL, candidate_name_en TEXT, nationality TEXT,
  id_number TEXT, id_place TEXT, id_expiry TEXT, phone TEXT NOT NULL,
  email TEXT, qualification TEXT, position TEXT NOT NULL, position_en TEXT,
  department TEXT, branch_id VARCHAR REFERENCES branches(id), branch_name TEXT,
  start_date TEXT NOT NULL, contract_duration_months INTEGER NOT NULL DEFAULT 12,
  probation_days INTEGER NOT NULL DEFAULT 180, working_hours TEXT DEFAULT '8 ساعات / 6 أيام في الأسبوع',
  basic_salary INTEGER NOT NULL DEFAULT 0, housing_allowance INTEGER NOT NULL DEFAULT 0,
  transport_allowance INTEGER NOT NULL DEFAULT 0, other_allowances INTEGER NOT NULL DEFAULT 0,
  annual_leave_days INTEGER NOT NULL DEFAULT 21, has_medical_insurance BOOLEAN NOT NULL DEFAULT TRUE,
  has_travel_tickets BOOLEAN NOT NULL DEFAULT FALSE, benefits_notes TEXT, terms_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft', validity_days INTEGER NOT NULL DEFAULT 2,
  sent_at TIMESTAMP, viewed_at TIMESTAMP, responded_at TIMESTAMP, expires_at TIMESTAMP,
  candidate_signature TEXT, accepted_at_signature TIMESTAMP, decline_reason TEXT,
  candidate_ip TEXT, candidate_user_agent TEXT, created_by VARCHAR REFERENCES users(id),
  cancelled_by VARCHAR REFERENCES users(id), cancel_reason TEXT,
  hired_employee_id VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_offers_status ON job_offers(status);
CREATE INDEX IF NOT EXISTS idx_job_offers_branch ON job_offers(branch_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_phone ON job_offers(phone);
CREATE INDEX IF NOT EXISTS idx_job_offers_created_at ON job_offers(created_at);
CREATE TABLE IF NOT EXISTS job_offer_tokens (
  id SERIAL PRIMARY KEY, offer_id INTEGER NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE, expires_at TIMESTAMP NOT NULL, used_at TIMESTAMP,
  revoked_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_offer_tokens_token ON job_offer_tokens(token);
CREATE INDEX IF NOT EXISTS idx_job_offer_tokens_offer ON job_offer_tokens(offer_id);
CREATE TABLE IF NOT EXISTS job_offer_audit_log (
  id SERIAL PRIMARY KEY, offer_id INTEGER NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
  action TEXT NOT NULL, performed_by VARCHAR REFERENCES users(id), performed_by_name TEXT,
  ip_address TEXT, details JSONB, created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_offer_audit_offer ON job_offer_audit_log(offer_id);
CREATE INDEX IF NOT EXISTS idx_job_offer_audit_created_at ON job_offer_audit_log(created_at);
CREATE TABLE IF NOT EXISTS onboarding_notifications (
  id SERIAL PRIMARY KEY, notification_number TEXT NOT NULL UNIQUE,
  job_offer_id INTEGER NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
  candidate_name TEXT NOT NULL, phone TEXT NOT NULL, position TEXT NOT NULL,
  branch_id VARCHAR REFERENCES branches(id), branch_name TEXT, actual_start_date TEXT NOT NULL,
  working_hours TEXT, reporting_to TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'pending',
  validity_days INTEGER NOT NULL DEFAULT 7, sent_at TIMESTAMP, expires_at TIMESTAMP,
  selfie_photo_url TEXT, selfie_lat DOUBLE PRECISION, selfie_lng DOUBLE PRECISION,
  selfie_accuracy DOUBLE PRECISION, selfie_captured_at TIMESTAMP, distance_from_branch_m INTEGER,
  within_branch_radius BOOLEAN, employee_signature TEXT, signed_at TIMESTAMP,
  signed_ip TEXT, signed_user_agent TEXT, confirmed_at TIMESTAMP, confirmed_by VARCHAR REFERENCES users(id),
  confirmed_notes TEXT, converted_at TIMESTAMP, converted_by VARCHAR REFERENCES users(id),
  converted_employee_id VARCHAR REFERENCES users(id),
  converted_branch_employee_id INTEGER REFERENCES branch_employees(id),
  created_by VARCHAR REFERENCES users(id), cancelled_at TIMESTAMP, cancel_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_onboarding_status ON onboarding_notifications(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_branch ON onboarding_notifications(branch_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_onboarding_offer ON onboarding_notifications(job_offer_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_created_at ON onboarding_notifications(created_at);
CREATE TABLE IF NOT EXISTS onboarding_tokens (
  id SERIAL PRIMARY KEY, notification_id INTEGER NOT NULL REFERENCES onboarding_notifications(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE, expires_at TIMESTAMP NOT NULL, used_at TIMESTAMP,
  revoked_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_onboarding_tokens_token ON onboarding_tokens(token);
CREATE INDEX IF NOT EXISTS idx_onboarding_tokens_notification ON onboarding_tokens(notification_id);
`;

const requiredTables = [jobOffers, jobOfferTokens, jobOfferAuditLog, onboardingNotifications, onboardingTokens];
const pgTypes: Record<string, string> = {
  serial: "int4", integer: "int4", text: "text", varchar: "varchar",
  timestamp: "timestamp", boolean: "bool", "double precision": "float8", jsonb: "jsonb",
};

/**
 * Atomic, additive readiness. Existing incompatible schemas stop startup with
 * an actionable diagnostic rather than silently converting business records.
 */
export async function ensureOperationsJoiningSchema(pool: Pick<Pool, "connect">): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SELECT pg_advisory_xact_lock(202610017)");
    await client.query(OPERATIONS_JOINING_SCHEMA_SQL);
    const names = requiredTables.map(getTableName);
    const metadata = await client.query(
      "SELECT table_name,column_name,udt_name,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[])",
      [names],
    );
    for (const table of requiredTables) {
      const name = getTableName(table);
      for (const column of Object.values(getTableColumns(table))) {
        const actual = metadata.rows.find(row => row.table_name === name && row.column_name === column.name);
        const expectedType = pgTypes[column.getSQLType()];
        if (!actual || !expectedType || actual.udt_name !== expectedType || (column.notNull && actual.is_nullable !== "NO")) {
          throw new Error(`Operations joining schema mismatch: ${name}.${column.name} requires ${column.getSQLType()}${column.notNull ? " NOT NULL" : ""}. Reconcile this column manually using verified identifiers; no historical rows were converted.`);
        }
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    const message = error instanceof Error ? error.message : "unknown schema failure";
    throw new Error(`Operations joining schema is not ready. ${message}. Apply migrations/operations_joining_readiness.sql only after checking existing schema compatibility. Do not run the old integer-to-varchar conversion or fabricate historical identifiers.`, { cause: error });
  } finally {
    client.release();
  }
}