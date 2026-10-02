import { describe, expect, it } from "vitest";
import { additionFingerprint, additionIntegrity, additionIsDelegationSafe, additionInput,
  additionUpdateInput, additionDeleteInput, validateAddition, ADDITION_BRANCH_MODULES, type AdditionRecord,
  readManagedAdditions, additionDTO,
} from "../server/employee-account-additions-policy";
import { userPermissionOverrides } from "../shared/schema";
import { EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS } from "../shared/employee-account-delegation";
import { normalizePermissionDecisionSnapshot, checkPermissionDecision, evaluatePermissionDecision } from "../server/permission-decision";
const body = { module: "cashier_journal", action: "edit", allow: true, scopeType: "global" as const,
  branchId: null, startsAt: null, endsAt: null, reason: "Explicit global addition" };
const employee = { id: 1, linkedUserId: "worker", branchId: "A" };
const policy = { enabled: true, permissions: EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS };
function record(changes: Partial<AdditionRecord> = {}): AdditionRecord {
  const row: AdditionRecord = { id: 5, employeeId: 1, userId: "worker", employeeBranchId: "A",
    overrideUserId: "worker", permissionId: 3, module: "cashier_journal", action: "edit", allow: true,
    branchId: null, departmentId: null, startsAt: null, endsAt: null, reason: "Explicit addition",
    grantedBy: "admin", overrideCreatedAt: "2026-10-02T10:00:00Z", overrideUpdatedAt: "2026-10-02T10:00:00Z",
    createdBy: "admin", createdAt: "2026-10-02T10:00:00Z", updatedAt: "2026-10-02T10:00:00Z",
    revision: "bd7b9e99-cb2c-416c-84ef-f19ed259f06c", snapshot: null, ...changes };
  row.snapshot = additionFingerprint(row);
  return row;
}
describe("managed admin additions: existing override provenance and boundaries", () => {
  it.each(["UTC", "Asia/Riyadh", "America/New_York"])(
    "round-trips actual Drizzle RETURNING provenance through raw PG timestamp strings under %s", async timezone => {
      const previous = process.env.TZ;
      process.env.TZ = timezone;
      try {
        // Actual timestamp column decoders used by INSERT/UPDATE RETURNING.
        // PostgreSQL supplies six fractional digits; Drizzle's Date precision
        // is milliseconds on both returning and the raw managed-read path.
        const returned = record({
          module: "quality_control", action: "view", allow: false,
          startsAt: userPermissionOverrides.startsAt.mapFromDriverValue("2026-10-02 10:00:00.123456"),
          endsAt: userPermissionOverrides.expiresAt.mapFromDriverValue("2099-01-01 00:00:00.654321"),
          overrideCreatedAt: userPermissionOverrides.createdAt.mapFromDriverValue("2026-10-02 09:00:00.987654"),
          overrideUpdatedAt: userPermissionOverrides.updatedAt.mapFromDriverValue("2026-10-02 09:15:00.234567"),
        });
        const raw = { ...returned,
          startsAt: "2026-10-02 10:00:00.123456", endsAt: "2099-01-01 00:00:00.654321",
          overrideCreatedAt: "2026-10-02 09:00:00.987654", overrideUpdatedAt: "2026-10-02 09:15:00.234567",
          createdAt: "2026-10-02 13:00:00+03", updatedAt: "2026-10-02 13:00:00+03",
        };
        const tx = { execute: async () => ({ rows: [raw] }) };
        const [loaded] = await readManagedAdditions(tx, ["worker"], true);
        expect(additionFingerprint(loaded)).toEqual(returned.snapshot);
        expect(additionIntegrity(loaded)).toBe(true);
        expect(additionDTO(loaded).integrity).toBe("managed");
        expect(additionDTO(loaded).startsAt).toBe("2026-10-02T10:00:00.123Z");
        expect(additionIsDelegationSafe(loaded, employee, policy)).toBe(true);
        // Browser-reported quality_control:view deny has no validity dates:
        // created_at/updated_at alone must round-trip without false protection.
        const noDates = record({ ...returned, startsAt: null, endsAt: null });
        const [loadedNoDates] = await readManagedAdditions({ execute: async () => ({ rows: [{
          ...raw, startsAt: null, endsAt: null, snapshot: noDates.snapshot,
        }] }) }, ["worker"], true);
        expect(additionIntegrity(loadedNoDates)).toBe(true);
        expect(additionIsDelegationSafe(loadedNoDates, employee, policy)).toBe(true);
        // Exact integrity is not relaxed: legacy edits to timing/effect still
        // invalidate provenance and keep the account protected.
        for (const changed of [
          { ...raw, allow: true }, { ...raw, startsAt: "2026-10-02 10:00:00.124456" },
          { ...raw, overrideUpdatedAt: "2026-10-02 09:15:01.234567" },
        ]) {
          const [tampered] = await readManagedAdditions({ execute: async () => ({ rows: [changed] }) }, ["worker"], true);
          expect(additionIntegrity(tampered)).toBe(false);
          expect(additionIsDelegationSafe(tampered, employee, policy)).toBe(false);
        }
      } finally {
        if (previous === undefined) delete process.env.TZ;
        else process.env.TZ = previous;
      }
    });
  it("keeps global explicit and rejects branch labels for every safe operational module", () => {
    validateAddition(additionInput.parse(body), "A");
    for (const permission of EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS)
      for (const action of permission.actions)
        expect(() => validateAddition(additionInput.parse({ ...body, module: permission.module,
          action, scopeType: "branch", branchId: "A" }), "A")).toThrow();
  });
  it("permits only verified contextual HR branch actions, matching persisted employee branch", () => {
    for (const permission of ADDITION_BRANCH_MODULES)
      for (const action of permission.actions) {
        const input = additionInput.parse({ ...body, module: permission.module, action, scopeType: "branch", branchId: "A" });
        expect(() => validateAddition(input, "A")).not.toThrow();
        expect(() => validateAddition(input, "B")).toThrow();
      }
    expect(() => validateAddition(additionInput.parse({ ...body, module: "hr_documents",
      action: "export", scopeType: "branch", branchId: "A" }), "A")).toThrow();
  });
  it("never silently narrows global scope to an employee branch", () => {
    expect(() => validateAddition(additionInput.parse({ ...body, branchId: "A" }), "A")).toThrow();
  });
  it.each(["department", "self", "assigned_tasks", "branches"])("rejects unsupported scope %s", scopeType => {
    expect(additionInput.safeParse({ ...body, scopeType }).success).toBe(false);
  });
  it.each(["employeeId", "userId", "permissionId", "directPermissions", "role", "expectedRevision"])(
    "rejects create input field %s", key => {
      expect(additionInput.safeParse({ ...body, [key]: "untrusted" }).success).toBe(false);
    });
  it("requires reason and revision for mutations without accepting unknown delete fields", () => {
    expect(additionInput.safeParse({ ...body, reason: " " }).success).toBe(false);
    expect(additionUpdateInput.safeParse(body).success).toBe(false);
    expect(additionDeleteInput.safeParse({ reason: "Removal" }).success).toBe(false);
    expect(additionDeleteInput.safeParse({ reason: "Removal", expectedRevision: record().revision, allow: false }).success).toBe(false);
  });
  it("requires exclusive end after inclusive start and valid dates", () => {
    for (const endsAt of ["2026-10-02T09:00:00Z", "2026-10-02T10:00:00Z"])
      expect(() => validateAddition(additionInput.parse({ ...body, startsAt: "2026-10-02T10:00:00Z", endsAt }), "A")).toThrow();
    expect(additionInput.safeParse({ ...body, startsAt: "not-a-date" }).success).toBe(false);
  });
  it("classifies only exact managed safe additions including denies, future and expired rows", () => {
    for (const changes of [{}, { allow: false }, { startsAt: "2099-01-01T00:00:00Z" }, { endsAt: "2000-01-01T00:00:00Z" }])
      expect(additionIsDelegationSafe(record(changes), employee, policy)).toBe(true);
  });
  it("keeps privileged additions/denies protected from ops", () => {
    for (const module of ["users", "rbac", "hr_documents", "inventory"])
      for (const allow of [true, false])
        expect(additionIsDelegationSafe(record({ module, action: "view", allow }), employee, policy)).toBe(false);
  });
  it("does not adopt changed provenance or a different employee/user/branch", () => {
    for (const change of [{ employeeId: 2 }, { userId: "other" }, { overrideUserId: "other" },
      { employeeBranchId: "B" }, { departmentId: 2 }, { branchId: "B" }, { branchId: "A" }])
      expect(additionIsDelegationSafe(record(change), employee, policy)).toBe(false);
    const row = record(); row.allow = false;
    expect(additionIntegrity(row)).toBe(false);
    expect(additionIsDelegationSafe(row, employee, policy)).toBe(false);
  });
  it("validates fingerprint independent of JSONB key order and rejects extra provenance keys", () => {
    const row = record();
    row.snapshot = Object.fromEntries(Object.entries(row.snapshot as object).reverse());
    expect(additionIntegrity(row)).toBe(true);
    (row.snapshot as any).unexpected = true;
    expect(additionIntegrity(row)).toBe(false);
  });
  it("safe extras outside current admin ceiling keep the account protected", () => {
    expect(additionIsDelegationSafe(record(), employee, { enabled: false, permissions: [] })).toBe(false);
  });
  it("uses the existing resolver for global future starts, expiration and deny precedence", () => {
    const now = Date.parse("2026-10-02T10:00:00Z");
    const decision = (overrides: any[]) => normalizePermissionDecisionSnapshot({
      userId: "worker", sourceMode: "direct", direct: [{ module: "cashier_journal", actions: ["view"] }],
      roles: [], overrides,
    }, now);
    const override = { module: "cashier_journal", action: "edit", permissionId: 1, allow: true,
      branchId: null, departmentId: null, expiresAt: null, startDate: new Date(now + 1) };
    const future = decision([override]);
    expect(checkPermissionDecision(future, "cashier_journal", "edit", {})).toBe(false);
    expect(evaluatePermissionDecision(future).some(p => p.action === "edit" && p.allowed)).toBe(false);
    expect(checkPermissionDecision(decision([{ ...override, startDate: new Date(now) }]), "cashier_journal", "edit")).toBe(true);
    expect(checkPermissionDecision(decision([{ ...override, startDate: null, expiresAt: new Date(now) }]), "cashier_journal", "edit")).toBe(false);
    expect(checkPermissionDecision(decision([{ ...override, startDate: null }, { ...override, startDate: null, allow: false }]),
      "cashier_journal", "edit")).toBe(false);
  });
});