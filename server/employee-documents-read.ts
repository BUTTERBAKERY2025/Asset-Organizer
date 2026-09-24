import { sql } from "drizzle-orm";
import { db } from "./db";

export type EmployeeDocumentStatus = "active" | "expiring_soon" | "expired" | "archived" | "unknown";

export interface EmployeeDocumentMetadata {
  id: number | string;
  branchEmployeeId: number;
  branchId: string;
  employeeName: string;
  employeeJob: string;
  branchName: string | null;
  employeeStatus: string;
  documentType: string;
  documentNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  issuingAuthority: string | null;
  notes: string | null;
  status: string;
  computedStatus: EmployeeDocumentStatus;
  source: "document" | "employee_profile";
  readOnly: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface EmployeeDocumentReadOptions {
  branchIds: string[] | null;
  employeeId?: number;
  type?: string;
  status?: string;
  activeOnly?: boolean;
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
  today?: string;
}

export const ISO_CALENDAR_DATE_RE = /^(?:(?:\d{4}-(?:01|03|05|07|08|10|12)-(?:0[1-9]|[12]\d|3[01]))|(?:\d{4}-(?:04|06|09|11)-(?:0[1-9]|[12]\d|30))|(?:\d{4}-02-(?:0[1-9]|1\d|2[0-8]))|(?:(?:\d{2}(?:0[48]|[2468][048]|[13579][26])|(?:[02468][048]|[13579][26])00)-02-29))$/;
const ISO_CALENDAR_DATE_PATTERN = ISO_CALENDAR_DATE_RE.source;

export function saudiDateParts(now = new Date()): { today: string; thirtyDaysOut: string } {
  const saudi = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const today = saudi.toISOString().slice(0, 10);
  const end = new Date(`${today}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 30);
  return { today, thirtyDaysOut: end.toISOString().slice(0, 10) };
}

export function classifyEmployeeDocument(
  expiryDate: string | null | undefined,
  storedStatus: string | null | undefined,
  today: string,
  thirtyDaysOut: string,
): EmployeeDocumentStatus {
  if (storedStatus === "archived") return "archived";
  if (!expiryDate || !ISO_CALENDAR_DATE_RE.test(expiryDate)) return "unknown";
  if (expiryDate < today) return "expired";
  if (expiryDate <= thirtyDaysOut) return "expiring_soon";
  return "active";
}

const emptyResult = (page: number, pageSize: number) => ({
  items: [] as EmployeeDocumentMetadata[],
  page,
  pageSize,
  total: 0,
  stats: { total: 0, active: 0, expired: 0, expiringSoon: 0, unknown: 0, archived: 0, byType: {} as Record<string, number>,
    oldestExpiredDate: null as string | null, oldestExpiringSoonDate: null as string | null },
});

/**
 * Single metadata-only read model for HR, reports and branch-operation cards.
 * The employee's current branch is authoritative. Legacy profile values are emitted
 * only when no real document of that employee/type exists (an archived row blocks it).
 */
export async function readEmployeeDocumentMetadata(options: EmployeeDocumentReadOptions) {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.min(500, Math.max(1, options.pageSize || 100));
  if (options.branchIds !== null && options.branchIds.length === 0) return emptyResult(page, pageSize);

  const { today, thirtyDaysOut } = options.today
    ? { today: options.today, thirtyDaysOut: saudiDateParts(new Date(`${options.today}T00:00:00Z`)).thirtyDaysOut }
    : saudiDateParts();
  const scope = options.branchIds === null
    ? sql`true`
    : sql`be.branch_id in (${sql.join(options.branchIds.map(id => sql`${id}`), sql`, `)})`;
  const active = options.activeOnly === false ? sql`true` : sql`be.status = 'active'`;
  const employee = options.employeeId ? sql`and d.branch_employee_id = ${options.employeeId}` : sql``;
  const type = options.type ? sql`and d.document_type = ${options.type}` : sql``;
  const archived = options.includeArchived ? sql`true` : sql`d.status <> 'archived'`;
  const status = options.status ? sql`and d.computed_status = ${options.status}` : sql``;
  const offset = (page - 1) * pageSize;

  const query = sql`
    with metadata as (
      select ed.id::text as id, be.id as branch_employee_id, be.branch_id,
        be.employee_name, be.job_title as employee_job, b.name as branch_name,
        be.status as employee_status, ed.document_type, ed.document_number,
        ed.issue_date, ed.expiry_date, ed.issuing_authority, ed.notes, ed.status,
        case
          when ed.status = 'archived' then 'archived'
          when ed.expiry_date is null or ed.expiry_date !~ ${ISO_CALENDAR_DATE_PATTERN} then 'unknown'
          when ed.expiry_date < ${today} then 'expired'
          when ed.expiry_date <= ${thirtyDaysOut} then 'expiring_soon'
          else 'active'
        end as computed_status,
        'document'::text as source, false as read_only, ed.created_at, ed.updated_at
      from employee_documents ed
      join branch_employees be on be.id = ed.branch_employee_id
      left join branches b on b.id = be.branch_id
      where ${scope} and ${active}
      union all
      select ('legacy-residence-' || be.id)::text, be.id, be.branch_id, be.employee_name,
        be.job_title, b.name, be.status, 'residence', be.iqama_number, null,
        be.iqama_expiry, null, null, 'active',
        case when be.iqama_expiry is null or be.iqama_expiry !~ ${ISO_CALENDAR_DATE_PATTERN} then 'unknown'
             when be.iqama_expiry < ${today} then 'expired'
             when be.iqama_expiry <= ${thirtyDaysOut} then 'expiring_soon' else 'active' end,
        'employee_profile', true, null, null
      from branch_employees be left join branches b on b.id = be.branch_id
      where ${scope} and ${active} and (be.iqama_number is not null or be.iqama_expiry is not null)
        and not exists (select 1 from employee_documents x where x.branch_employee_id=be.id and x.document_type='residence')
      union all
      select ('legacy-passport-' || be.id)::text, be.id, be.branch_id, be.employee_name,
        be.job_title, b.name, be.status, 'passport', be.passport_number, null,
        be.passport_expiry, null, null, 'active',
        case when be.passport_expiry is null or be.passport_expiry !~ ${ISO_CALENDAR_DATE_PATTERN} then 'unknown'
             when be.passport_expiry < ${today} then 'expired'
             when be.passport_expiry <= ${thirtyDaysOut} then 'expiring_soon' else 'active' end,
        'employee_profile', true, null, null
      from branch_employees be left join branches b on b.id = be.branch_id
      where ${scope} and ${active} and (be.passport_number is not null or be.passport_expiry is not null)
        and not exists (select 1 from employee_documents x where x.branch_employee_id=be.id and x.document_type='passport')
      union all
      select ('legacy-health-' || be.id)::text, be.id, be.branch_id, be.employee_name,
        be.job_title, b.name, be.status, 'health_certificate', null, null,
        be.health_certificate_expiry, null, null, 'active',
        case when be.health_certificate_expiry is null or be.health_certificate_expiry !~ ${ISO_CALENDAR_DATE_PATTERN} then 'unknown'
             when be.health_certificate_expiry < ${today} then 'expired'
             when be.health_certificate_expiry <= ${thirtyDaysOut} then 'expiring_soon' else 'active' end,
        'employee_profile', true, null, null
      from branch_employees be left join branches b on b.id = be.branch_id
      where ${scope} and ${active} and (be.health_certificate <> 'none' or be.health_certificate_expiry is not null)
        and not exists (select 1 from employee_documents x where x.branch_employee_id=be.id and x.document_type='health_certificate')
    ), filtered as (
      select * from metadata d where ${archived} ${employee} ${type} ${status}
    ), totals as (
      select count(*)::int total,
        count(*) filter(where computed_status='active')::int active,
        count(*) filter(where computed_status='expired')::int expired,
        count(*) filter(where computed_status='expiring_soon')::int expiring_soon,
        count(*) filter(where computed_status='unknown')::int unknown,
        count(*) filter(where computed_status='archived')::int archived,
        min(expiry_date) filter(where computed_status='expired') oldest_expired_date,
        min(expiry_date) filter(where computed_status='expiring_soon') oldest_expiring_soon_date,
        (select coalesce(jsonb_object_agg(tc.document_type, tc.amount), '{}'::jsonb)
          from (select document_type, count(*)::int amount from filtered group by document_type) tc
        ) as by_type
      from filtered
    )
    select f.*, t.*
    from totals t
    left join lateral (
      select * from filtered
      order by updated_at desc nulls last, branch_employee_id, document_type, id
      limit ${pageSize} offset ${offset}
    ) f on true`;
  const result: any = await db.execute(query);
  const rows: any[] = result.rows || result;
  const first = rows[0];
  const byType: Record<string, number> = Object.fromEntries(
    Object.entries(first.by_type || {}).map(([key, value]) => [key, Number(value)]),
  );
  return {
    items: rows.filter(row => row.id != null).map(row => ({
      id: row.id, branchEmployeeId: row.branch_employee_id, branchId: row.branch_id,
      employeeName: row.employee_name, employeeJob: row.employee_job, branchName: row.branch_name,
      employeeStatus: row.employee_status, documentType: row.document_type,
      documentNumber: row.document_number, issueDate: row.issue_date, expiryDate: row.expiry_date,
      issuingAuthority: row.issuing_authority, notes: row.notes, status: row.status,
      computedStatus: row.computed_status, source: row.source, readOnly: row.read_only,
      createdAt: row.created_at, updatedAt: row.updated_at,
    })),
    page, pageSize, total: Number(first.total),
    stats: {
      total: Number(first.total), active: Number(first.active), expired: Number(first.expired),
      expiringSoon: Number(first.expiring_soon), unknown: Number(first.unknown),
      archived: Number(first.archived), byType,
      oldestExpiredDate: (first.oldest_expired_date || null) as string | null,
      oldestExpiringSoonDate: (first.oldest_expiring_soon_date || null) as string | null,
    },
  };
}