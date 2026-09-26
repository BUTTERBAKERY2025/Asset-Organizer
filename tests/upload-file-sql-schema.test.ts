import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getTableColumns, getTableName, isTable } from "drizzle-orm";
import * as schema from "../shared/schema";

const route = readFileSync("server/routes.ts", "utf8");
const start = route.indexOf('app.get("/api/uploads/file/*"');
const end = route.indexOf("const authorized = await mayDownloadUpload", start);
const query = route.slice(start, end).split("resolveUploadBindings(sql`")[1]?.split("`, (query)")[0];
if (!query) throw new Error("upload reference SQL missing");
const tables = new Map(Object.values(schema).filter(isTable).map(t => [getTableName(t), t]));

describe("upload reference SQL against shared schema", () => {
  it("uses existing physical columns for every FROM/JOIN alias (including new URL consumers)", () => {
    for (const select of query.replace(/--[^\n]*/g, "").split(/\bUNION ALL\b/)) {
      const aliases = new Map([...select.matchAll(/\b(?:FROM|JOIN|LEFT JOIN)\s+([a-z_]+)\s+([a-z]+)\b/g)]
        .map(([, table, alias]) => [alias, table]));
      for (const [, alias, column] of select.matchAll(/\b([a-z]+)\.([a-z_]+)\b/g)) {
        const tableName = aliases.get(alias);
        if (!tableName) {
          // jsonb_array_elements aliases expose the JSON element, not a
          // table column; the expression has no dot-column reference.
          throw new Error(`SQL alias ${alias}.${column} not declared`);
        }
        const table = tables.get(tableName);
        expect(table, `table ${tableName}`).toBeDefined();
        const physicalColumns = Object.values(getTableColumns(table!)).map(c => c.name);
        expect(physicalColumns, `${tableName}.${column}`).toContain(column);
      }
    }
  });

  it("keeps UNION branch and owner positions string-compatible", () => {
    const column = (table: string, name: string) =>
      Object.values(getTableColumns(tables.get(table)!)).find(c => c.name === name)!;
    for (const [table, branch] of [
      ["cashier_sales_journals", "branch_id"], ["documents", "branch_id"],
      ["branch_employees", "branch_id"], ["construction_projects", "branch_id"],
      ["onboarding_notifications", "branch_id"], ["employment_applications", "target_branch_id"],
      ["leave_requests", "branch_id"], ["employee_warnings", "branch_id"],
      ["visitors", "branch_id"], ["marketing_assets", "branch_id"],
      ["branch_shifts", "branch_id"], ["project_daily_logs", "branch_id"],
      ["field_checklists", "branch_id"],
    ]) expect(column(table, branch).dataType).toBe("string");
    // Schema has an integer campaign branch ID, but baseline migrations lack
    // that field. The route deliberately does not reference it.
    expect(column("campaign_expenses", "branch_id").dataType).toBe("number");
    expect(query).toContain("SELECT 'marketing_expense', NULL::varchar");
    const baselineCampaign = readFileSync("migrations/0000_add_indexes.sql", "utf8")
      .split('CREATE TABLE "campaign_expenses" (')[1]?.split(");")[0];
    expect(baselineCampaign).toBeDefined();
    expect(baselineCampaign).not.toContain('"branch_id"');
    for (const [table, owner] of [
      ["cashier_sales_journals", "cashier_id"], ["documents", "owner_id"],
      ["cashier_sales_journals", "created_by"],
      ["branch_employees", "linked_user_id"], ["financial_documents", "uploaded_by"],
      ["campaign_expenses", "created_by"], ["payment_requests", "requested_by"],
      ["project_expenses", "created_by"], ["construction_contracts", "created_by"],
      ["influencer_payments", "created_by"], ["project_daily_log_photos", "uploaded_by"],
      ["shift_photos", "uploaded_by"], ["shift_checklist_responses", "completed_by"],
      ["daily_waste_log", "recorded_by"], ["shareholder_documents", "uploaded_by"],
      ["field_checklists", "assigned_to"],
    ]) expect(column(table, owner).dataType).toBe("string");
    expect(readFileSync("migrations/add_warning_signing_fields.sql", "utf8"))
      .toMatch(/ADD COLUMN IF NOT EXISTS attachments\s+jsonb/i);
    // These DB creator fields may anchor signed upload provenance only while
    // their edit routes strip client-supplied creator changes.
    expect(route).toMatch(/createdBy: _createdBy, \.\.\.contractChanges/);
    expect(route).toMatch(/createdBy: _createdBy, \.\.\.expenseChanges/);
    expect(route).toMatch(/createdBy: _createdBy, \.\.\.paymentChanges/);
    expect(route).toMatch(/requestedBy: _requestedBy, \.\.\.requestChanges/);
  });

  it("uses existing physical columns in legacy collision checks", () => {
    const collision = route.slice(end).split("const collision = await db.execute(sql`")[1]?.split("`);")[0];
    expect(collision).toBeDefined();
    for (const [, tableName, predicates] of collision!.matchAll(/\b(?:FROM|JOIN)\s+([a-z_]+)\s+WHERE\s+([^\n]+)/g)) {
      const table = tables.get(tableName);
      expect(table, `collision table ${tableName}`).toBeDefined();
      const physicalColumns = Object.values(getTableColumns(table!)).map(c => c.name);
      for (const [, column] of predicates.matchAll(/\b([a-z_]+)\s*=\s*\$\{/g)) {
        expect(physicalColumns, `${tableName}.${column}`).toContain(column);
      }
    }
  });
});