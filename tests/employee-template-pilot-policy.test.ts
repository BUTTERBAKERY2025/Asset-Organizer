import { describe, expect, it } from "vitest";
import { pilotQuery, pilotInput, predictTemplateSnapshot, pilotAuthority, authorityDifferences,
  tupleTemporalState, nextDecisionBoundary } from "../server/employee-template-pilot-policy";
import { normalizePermissionDecisionSnapshot, checkPermissionDecision, hasPermissionDecisionDeny } from "../server/permission-decision";
const now = Date.parse("2026-10-02T10:00:00Z");
const input = { userId: "u", sourceMode: "direct" as const, direct: [{ module: "cashier_journal", actions: ["view"] }],
  roles: [], overrides: [] as any[] };
const authority = (snapshot: ReturnType<typeof normalizePermissionDecisionSnapshot>, branchId = "A", delivery = false) =>
  pilotAuthority(snapshot, branchId,
    (module, action) => !hasPermissionDecisionDeny(snapshot, module, action, { branchId })
      && (checkPermissionDecision(snapshot, module, action, { branchId })
        || (delivery && module === "delivery_tasks" && ["view", "edit"].includes(action))),
    (module, action) => delivery && module === "delivery_tasks" && ["view", "edit"].includes(action));
const extra = (changes = {}) => ({ module: "cashier_journal", action: "view", permissionId: 1,
  allow: false, branchId: null, departmentId: null, startDate: null, expiresAt: null, ...changes });
describe("phase6 pure comparison reuses runtime decisions", () => {
  it("changes only base, retaining independent grants/denies/timing and input immutability", () => {
    const before = normalizePermissionDecisionSnapshot({ ...input, overrides: [
      extra(), extra({ module: "maintenance", allow: true, startDate: new Date(now + 1000) }),
    ] }, now);
    const original = structuredClone(before);
    const after = predictTemplateSnapshot(before, [{ module: "cashier_journal", actions: ["view", "create"] }]);
    expect(before).toEqual(original);
    expect(after.tuples.filter(p => p.source.startsWith("override"))).toEqual(before.tuples.filter(p => p.source.startsWith("override")));
    expect(authority(after).effectivePermissions).toEqual([{ module: "cashier_journal", actions: ["create"] }]);
    expect(authorityDifferences(authority(before), authority(after)).retainedDenies).toHaveLength(1);
  });
  it("preserves contextual action × branch pairs, never projecting another branch into this employee", () => {
    const before = normalizePermissionDecisionSnapshot({ ...input, direct: [], overrides: [
      extra({ module: "hr_documents", allow: true, branchId: "A" }),
      extra({ module: "hr_documents", action: "delete", allow: true, branchId: "B" }),
    ] }, now);
    expect(authority(before).effectivePermissions).toEqual([{ module: "hr_documents", actions: ["view"] }]);
    expect(authority(before, "B").effectivePermissions).toEqual([{ module: "hr_documents", actions: ["delete"] }]);
  });
  it("retains intrinsic delivery without pretending a deny can be replaced by base", () => {
    const before = normalizePermissionDecisionSnapshot({ ...input, direct: [], overrides: [
      extra({ module: "delivery_tasks", action: "edit" }),
    ] }, now);
    const source = authority(before, "A", true);
    expect(source.effectivePermissions).toEqual([{ module: "delivery_tasks", actions: ["view"] }]);
    expect(source.sources.filter(s => s.source === "intrinsic")).toHaveLength(2);
    expect(source.sources.find(s => s.source === "intrinsic" && s.action === "edit")?.allowed).toBe(false);
  });
  it("only explicit direct replacement suppresses inherited base, not independent overlays", () => {
    const before = normalizePermissionDecisionSnapshot({ ...input, sourceMode: "inherit",
      roles: [{ module: "maintenance", action: "view", permissionId: 5, scopeType: "branch",
        branchId: "A", departmentId: null, startDate: null, endDate: null, isActive: true }],
      overrides: [extra({ module: "quality_control", allow: true })],
    }, now);
    expect(authority(predictTemplateSnapshot(before, [])).effectivePermissions)
      .toEqual([{ module: "quality_control", actions: ["view"] }]);
  });
  it.each([
    [{ startDate: new Date(now + 1) }, "future"], [{ startDate: new Date(now) }, "active"],
    [{ expiresAt: new Date(now) }, "expired"], [{ isActive: false }, "inactive"], [{ startDate: "bad" }, "invalid"],
  ])("source boundary %j => %s", (changes, expected) => {
    const tuple = normalizePermissionDecisionSnapshot({ ...input, overrides: [extra()] }, now).tuples.at(-1)!;
    expect(tupleTemporalState({ ...tuple, ...changes }, now)).toBe(expected);
  });
  it("returns the next real boundary, not capture time, including start and exclusive end", () => {
    const snapshot = normalizePermissionDecisionSnapshot({ ...input, overrides: [
      extra({ startDate: new Date(now + 2) }), extra({ expiresAt: new Date(now + 1) }),
    ] }, now);
    expect(nextDecisionBoundary(snapshot)).toBe(new Date(now + 1).toISOString());
  });
  it("reports malformed legacy time honestly without granting or crashing source projection", () => {
    const snapshot = normalizePermissionDecisionSnapshot({ ...input, direct: [],
      overrides: [extra({ allow: true, startDate: "invalid-legacy-time" })],
    }, now);
    const projected = authority(snapshot);
    expect(projected.effectivePermissions).toEqual([]);
    expect(projected.sources[0]).toMatchObject({ startsAt: "invalid-legacy-time", temporalState: "invalid", allowed: false });
  });
  it("diffs explicit additions/removals/retained effects rather than raw row counts", () => {
    const before = normalizePermissionDecisionSnapshot(input, now);
    const after = predictTemplateSnapshot(before, [{ module: "maintenance", actions: ["view"] }]);
    const diff = authorityDifferences(authority(before), authority(after));
    expect(diff.additions).toEqual([{ module: "maintenance", actions: ["view"] }]);
    expect(diff.removals).toEqual(input.direct);
    expect(diff.retained).toEqual([]);
  });
  it("requires latest requested IDs, explicit acknowledgement/reason/revision, rejecting bulk and hidden fields", () => {
    expect(pilotQuery.safeParse({ templateId: "1", version: "2" }).success).toBe(true);
    expect(pilotQuery.safeParse({ templateId: "0", version: "1" }).success).toBe(false);
    const valid = { templateId: 1, version: 1, branchId: "A", reason: "Reviewed",
      expectedComparisonRevision: "a".repeat(64), acknowledgeChanges: true };
    expect(pilotInput.safeParse(valid).success).toBe(true);
    for (const changes of [{ acknowledgeChanges: false }, { reason: " " }, { expectedComparisonRevision: "uuid" },
      { employeeIds: [1,2] }, { permissions: [] }, { role: "admin" }, { revert: true }])
      expect(pilotInput.safeParse({ ...valid, ...changes }).success).toBe(false);
  });
});