import { describe, expect, it } from "vitest";
import { authenticatedUploadMatchesActor, compatibleUploadBinding, makeAuthenticatedUploadName, mayDownloadUpload, validUploadKey, type UploadBinding } from "../server/upload-file-access";
import { beforeAll } from "vitest";
import { sql } from "drizzle-orm";
import { resolveUploadBindings } from "../server/upload-file-access";
beforeAll(() => { process.env.SESSION_SECRET = "local-unit-test-key-for-upload-provenance"; });

const binding = (category: string, branch_id: string | null = "A", owner_id: string | null = "owner"): UploadBinding =>
  ({ category, branch_id, owner_id, status: null });

const authorize = (
  rows: UploadBinding[],
  modules: string[] = [],
  branches: string[] = ["A"],
  user = "owner",
  admin = false,
  allCashiers = false,
) => mayDownloadUpload(rows, user, admin,
  async module => modules.includes(module),
  async branch => branches.includes(branch),
  async () => allCashiers,
  async () => true);

describe("general upload proxy authorization", () => {
  it("does not turn encoded paths, traversal, backslashes or empty segments into a different key", () => {
    for (const key of ["a/../secret.jpg", "a/./b", "a//b", "a%2Fb", "a%252Fb", "a\\b", "a?b", ""]) {
      expect(validUploadKey(key)).toBe(false);
    }
    expect(validUploadKey("cashier-journals/123/image.jpg")).toBe(true);
    expect(validUploadKey("cashier-journals_123_image_1234567890123_abcdef12.jpg")).toBe(true);
  });

  it("requires the actual record's branch and module even when owner matches", async () => {
    expect(await authorize([binding("journal", "B")], ["cashier_journal"])).toBe(false);
    expect(await authorize([binding("journal")])).toBe(false);
    expect(await authorize([binding("journal")], ["cashier_journal"])).toBe(true);
  });

  it("restricts other cashiers to roles authorized for all journals", async () => {
    const rows = [binding("journal", "A", "other")];
    expect(await authorize(rows, ["cashier_journal"])).toBe(false);
    expect(await authorize(rows, ["cashier_journal"], ["A"], "owner", false, true)).toBe(true);
    expect(await authorize(rows, ["cashier_journal"], ["B"], "owner", false, true)).toBe(false);
  });

  it("enforces documents, HR, governance and branch-bound project photos", async () => {
    expect(await authorize([binding("document")], ["documents"])).toBe(true);
    expect(await authorize([{ ...binding("document"), status: "private" }], ["documents"], ["A"], "other")).toBe(false);
    expect(await authorize([binding("employee", "B")], ["branch_employees"])).toBe(false);
    expect(await authorize([binding("leave")])).toBe(true); // employee's own leave
    expect(await authorize([binding("employee_document", "B")])).toBe(true); // /api/my/documents
    expect(await authorize([binding("warning", "B"), binding("document")], ["documents"])).toBe(true);
    expect(await authorize([binding("leave", "A", "other")], ["hr_leaves"])).toBe(true);
    expect(await authorize([binding("shareholder", null)], ["governance_shareholders"])).toBe(true);
    expect(await authorize([binding("project_photo", null)], ["project_daily_logs"])).toBe(false);
  });

  it("fails closed for unbound, unknown or multiply bound files", async () => {
    expect(await authorize([])).toBe(false);
    expect(await authorize([], [], [], "owner", true)).toBe(true);
    expect(await authorize([binding("unknown")], ["unknown"])).toBe(false);
    expect(await authorize([binding("journal"), binding("journal", "B")], ["cashier_journal"])).toBe(false);
  });
  it("prevents cross-module URL laundering of separately uploaded financial and onboarding objects", () => {
    expect(compatibleUploadBinding("financial_doc_123_1234567890123_abcdef12.pdf", binding("employee"))).toBe(false);
    expect(compatibleUploadBinding("onboarding_2_123_1234567890123_abcdef12.jpg", binding("journal"))).toBe(false);
    expect(compatibleUploadBinding("onboarding/2/123.jpg", binding("onboarding"))).toBe(true);
  });
  it("honors disabled employee portal documents instead of allowing ownership alone", async () => {
    expect(await mayDownloadUpload(
      [binding("employee_document", "B")], "owner", false,
      async () => false, async () => false, async () => false, async () => false,
    )).toBe(false);
  });
  it("applies actual construction/payment/marketing module grants and project branch scopes", async () => {
    expect(await authorize([binding("contract_attachment")], ["contracts"])).toBe(true);
    expect(await authorize([binding("project_expense", "B")], ["project_expenses"])).toBe(false);
    expect(await authorize([binding("payment_request")], ["payment_requests"])).toBe(true);
    expect(await authorize([binding("marketing_expense", null)], ["marketing_expenses"])).toBe(true);
    expect(await authorize([binding("influencer_payment", null)], ["marketing_influencers"])).toBe(true);
    expect(await authorize([binding("marketing_expense", null)], ["contracts"])).toBe(false);
  });
  it("requires a signed uploader marker matched to server-assigned record creator", async () => {
    const requested = makeAuthenticatedUploadName("project-expenses", "png", "owner");
    const key = requested.replace("/", "_").replace(".png", "_1234567890123_abcdef12.png");
    expect(authenticatedUploadMatchesActor(key, "owner")).toBe(true);
    expect(authenticatedUploadMatchesActor(key, "other")).toBe(false);
    const args = [async (module: string) => module === "project_expenses", async () => true, async () => false, async () => true] as const;
    expect(await mayDownloadUpload([{ ...binding("project_expense"), upload_actor_id: "owner" }], "owner", false, ...args, key)).toBe(true);
    expect(await mayDownloadUpload([{ ...binding("project_expense"), upload_actor_id: "other" }], "other", false, ...args, key)).toBe(false);
    expect(await mayDownloadUpload([{ ...binding("project_expense"), upload_actor_id: null }], "owner", false, ...args, key)).toBe(false);
    expect(await mayDownloadUpload([{ ...binding("project_expense"), upload_actor_id: "owner" }], "owner", false, ...args, key.replace(/a/, "b"))).toBe(false);
    const forged = key.replace(/_([a-f0-9]{32})_(\d{13})_/, (_all, mac: string, time: string) =>
      `_${mac[0] === "f" ? "e" : "f"}${mac.slice(1)}_${time}_`);
    expect(authenticatedUploadMatchesActor(forged, "owner")).toBe(false);
    expect(await mayDownloadUpload([{ ...binding("project_expense"), upload_actor_id: "owner" }], "owner", false, ...args, forged)).toBe(false);
    expect(await mayDownloadUpload([{ ...binding("project_expense"), upload_actor_id: "owner" }], "owner", false, ...args, "project-expenses_old_1234567890123_abcdef12.png")).toBe(false);
  });
  it("skips a missing unrelated schema source, retaining parameterized ACL bindings", async () => {
    const lookup = sql`SELECT 'document' category, ${"doc-1"}::text key
      FROM documents WHERE file_path = ${"doc-1"}
      UNION ALL SELECT 'financial' category, ${"doc-1"}::text key
      FROM financial_documents WHERE storage_path = ${"doc-1"}`;
    const seen: unknown[][] = [];
    const records = await resolveUploadBindings(
      lookup,
      async () => { throw Object.assign(new Error("relation absent"), { code: "42P01" }); },
      async (text, params) => {
        seen.push(params);
        if (text.includes("financial_documents")) throw Object.assign(new Error("relation absent"), { code: "42P01" });
        return { rows: [{ category: "document", branch_id: "A", owner_id: "owner", status: null }] };
      },
    );
    expect(records).toHaveLength(1);
    expect(seen).toEqual([["doc-1", "doc-1"], ["doc-1", "doc-1"]]);
  });
});