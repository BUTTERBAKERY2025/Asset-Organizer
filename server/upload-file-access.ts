import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

export type UploadBinding = {
  category: string;
  branch_id: string | null;
  owner_id: string | null;
  status: string | null;
  upload_actor_id?: string | null;
};

export async function resolveUploadBindings(
  query: SQL,
  execute: (query: SQL) => Promise<{ rows: UploadBinding[] }>,
  executeSelect: (text: string, params: unknown[]) => Promise<{ rows: UploadBinding[] }>,
): Promise<UploadBinding[]> {
  try {
    return (await execute(query)).rows;
  } catch (error: any) {
    // Optional feature tables/columns may not yet exist on older installs.
    // Fail closed per missing source, NOT by dropping authorization for every
    // other resource. Other SQL errors still surface, never grant access.
    const code = error?.code || error?.cause?.code;
    if (code !== "42P01" && code !== "42703") throw error;
    const rendered = new PgDialect().sqlToQuery(query);
    const rows: UploadBinding[] = [];
    for (const select of rendered.sql.split(/\bUNION ALL\b/)) {
      const params: unknown[] = [];
      const text = select.replace(/\$(\d+)/g, (_match, index: string) => {
        params.push(rendered.params[Number(index) - 1]);
        return `$${params.length}`;
      });
      try {
        rows.push(...(await executeSelect(text, params)).rows);
      } catch (sourceError: any) {
        if (sourceError?.code !== "42P01" && sourceError?.code !== "42703") throw sourceError;
      }
    }
    return rows;
  }
}

function signingSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for authenticated uploads");
  return secret;
}

export function makeAuthenticatedUploadName(folder: string, extension: string, userId: string): string {
  const safeFolder = folder.slice(0, 24);
  const safeExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const actor = createHmac("sha256", signingSecret()).update(`generic-actor-v2|${userId}`).digest("hex").slice(0, 24);
  const nonce = randomBytes(6).toString("hex");
  const mac = createHmac("sha256", signingSecret())
    .update(`generic-upload-v2|${safeFolder}|${safeExtension}|${actor}|${nonce}`).digest("hex").slice(0, 32);
  return `${safeFolder}/g2_${actor}_${nonce}_${mac}.${safeExtension}`;
}

export function authenticatedUploadMatchesActor(key: string, userId: string): boolean {
  const match = /^([a-zA-Z0-9_-]+)_g2_([a-f0-9]{24})_([a-f0-9]{12})_([a-f0-9]{32})_\d{13}_[a-f0-9]{8}\.([a-z0-9]+)$/.exec(key);
  if (!match || !userId) return false;
  const [, folder, actor, nonce, mac, ext] = match;
  const expectedActor = createHmac("sha256", signingSecret()).update(`generic-actor-v2|${userId}`).digest("hex").slice(0, 24);
  if (!timingSafeEqual(Buffer.from(actor, "hex"), Buffer.from(expectedActor, "hex"))) return false;
  const expected = createHmac("sha256", signingSecret())
    .update(`generic-upload-v2|${folder}|${ext}|${actor}|${nonce}`).digest("hex").slice(0, 32);
  const provided = Buffer.from(mac, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return provided.length === expectedBytes.length && timingSafeEqual(provided, expectedBytes);
}

// Never normalize a user-supplied path into a different storage key. In
// particular, encoded separators and dot segments must not create aliases.
export function validUploadKey(key: unknown): key is string {
  return typeof key === "string" && key.length > 0 && key.length <= 1024 &&
    !/[%\\?#\0]/.test(key) &&
    key.split("/").every(part => part.length > 0 && part !== "." && part !== "..");
}

// Some producers use their own protected namespace, outside /api/uploads.
// A user-editable URL on a less privileged record cannot launder one of
// those objects into a branch avatar, leave attachment or journal.
export function compatibleUploadBinding(key: string, binding: UploadBinding): boolean {
  if (/^financial_doc_\d+_\d{13}_[a-f0-9]{8}\.pdf$/i.test(key)) return binding.category === "financial";
  if (/^onboarding(?:_|\/)/.test(key)) return binding.category === "onboarding";
  const producerPrefix: Record<string, RegExp> = {
    journal: /^cashier-journals(?:_|\/)/,
    document: /^doc-/,
    employee: /^employees_/,
    leave: /^leaves_/,
    shareholder: /^shareholders_/,
    project_photo: /^daily-logs_/,
    field_photo: /^checklist-/,
  };
  if (producerPrefix[binding.category] && !producerPrefix[binding.category].test(key)) return false;
  return true;
}

export async function mayDownloadUpload(
  bindings: UploadBinding[],
  userId: string,
  isAdmin: boolean,
  canViewModule: (module: string) => Promise<boolean>,
  canViewBranch: (branchId: string, category: string) => Promise<boolean>,
  canViewAllCashiers: () => Promise<boolean>,
  canViewOwnPortalFile: (category: string) => Promise<boolean>,
  key?: string,
): Promise<boolean> {
  // An unbound upload has no authoritative owner. Only trusted admins may
  // retrieve these (for recovery/audit); never trust a folder name as ACL.
  if (!bindings.length) return isAdmin;
  if (isAdmin) return true;
  if (key) {
    const generic = key.includes("_g2_");
    // A free-form DB URL is not upload provenance. Legacy generic objects
    // cannot be safely attributed without a persisted upload ledger.
    if (!generic) return false;
    if (generic && bindings.some(row => !authenticatedUploadMatchesActor(key, row.upload_actor_id || ""))) return false;
  }
  // The public job application and manually pasted warning URLs are not
  // provenance records. Require a second, independently authorized binding
  // (e.g. the document the warning links to) for these cases.
  if (bindings.length === 1 && ["warning", "application"].includes(bindings[0].category)) return false;
  for (const row of bindings) {
    if (key && !compatibleUploadBinding(key, row)) return false;
    const module = ({
      journal: "cashier_journal",
      document: "documents",
      employee: "branch_employees",
      employee_document: "hr_documents",
      leave: "hr_leaves",
      warning: "hr_warnings",
      onboarding: "hr_onboarding",
      application: "hr_employment_applications",
      shareholder: "governance_shareholders",
      project_photo: "project_daily_logs",
      field_photo: "construction_projects",
      shift_photo: "shifts",
      visitor: "executive_visitors",
      marketing_asset: "marketing_assets",
      contract_attachment: "contracts",
      project_expense: "project_expenses",
      payment_request: "payment_requests",
      marketing_expense: "marketing_expenses",
      influencer_payment: "marketing_influencers",
    } as Record<string, string>)[row.category];
    if (!module) return false;
    if (row.category === "document" && (row.status === "deleted" ||
        (row.status === "private" && row.owner_id !== userId))) return false;
    // The financial signing route is explicitly admin-only. A URL pasted
    // into another user-editable record cannot loosen that restriction.
    if (row.category === "financial") return false;
    // Employees viewing their own HR record through /api/my/* need not have
    // a branch assignment or an HR management grant.
    const ownHr = ["leave", "employee_document", "warning"].includes(row.category) &&
      row.owner_id === userId && (row.category === "leave" || await canViewOwnPortalFile(row.category));
    if (row.branch_id && !ownHr && !(await canViewBranch(row.branch_id, row.category))) return false;
    // A missing branch on branch-bound content cannot grant global access.
    if (!row.branch_id && ["journal", "employee", "employee_document", "leave", "warning", "project_photo", "field_photo", "shift_photo", "contract_attachment", "project_expense", "payment_request"].includes(row.category)) return false;
    if (row.category === "journal" && row.owner_id !== userId && !(await canViewAllCashiers())) return false;
    if (ownHr) continue;
    if (!(await canViewModule(module))) return false;
  }
  // A key referenced by multiple records needs authorization for every one.
  return true;
}