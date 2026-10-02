import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  comparePermissionImpact,
  type PermissionImpactInput,
} from "../scripts/permission-impact";
import { checkPermissionDecision, normalizePermissionDecisionSnapshot } from "../server/permission-decision";

const at = "2026-10-02T12:00:00.000Z";
const role = (changes = {}) => ({
  module: "orders", action: "view", permissionId: 1,
  scopeType: "branch", branchId: "A", departmentId: null,
  startDate: null, endDate: null, isActive: true, ...changes,
});
const override = (changes = {}) => ({
  module: "orders", action: "view", permissionId: 1, allow: false,
  branchId: "A", departmentId: null, expiresAt: null, ...changes,
});
const account = (changes = {}) => ({
  userId: "u", role: "employee", sourceMode: null,
  direct: [], roles: [role()], overrides: [], ...changes,
});
function input(changes = {}, contexts: PermissionImpactInput["checks"][number]["context"][] = [{ branchId: "A" }]): PermissionImpactInput {
  return {
    schemaVersion: 1, evaluatedAt: at, baselineId: "supplied-baseline",
    accounts: [account(changes)],
    checks: contexts.map((context, index) => ({
      id: `check-${index}`, userId: "u", module: "orders", action: "view", context, oldAllowed: true,
    })),
  };
}
const compare = (changes = {}, contexts?: PermissionImpactInput["checks"][number]["context"][]) =>
  comparePermissionImpact(input(changes, contexts));

describe("offline supplied-old vs actual current permission decisions", () => {
  it("does not cross action and branch sets and explicitly reports unknown contexts", () => {
    const data = input({ roles: [role(), role({ action: "edit", branchId: "B" })] }, [{ branchId: "A" }, { branchId: "B" }, {}]);
    data.checks.push({ ...data.checks[0], id: "edit-A", action: "edit" });
    const report = comparePermissionImpact(data);
    expect(report.rows.map(row => row.newAllowed)).toEqual([true, false, false, false]);
    expect(report.rows[2].reasons).toContain("unknown-context");
    expect(report.counts).toMatchObject({ lost: 3, unchanged: 1, gained: 0 });
    expect(report.affectedAccountIds).toEqual(["u"]);
  });

  it.each([
    [{ sourceMode: "direct" }, false, "direct"],
    [{ sourceMode: "inherit", direct: [{ module: "cash", actions: ["edit"] }] }, true, "inherit"],
    [{ direct: [{ module: "cash", actions: ["edit"] }] }, false, "direct"],
    [{ direct: [{ module: "orders", actions: [] }] }, true, "inherit"],
  ])("uses actual current source-mode semantics: %j", (changes, allowed, mode) => {
    const report = compare(changes);
    expect(report.rows[0].newAllowed).toBe(allowed);
    expect(report.rows[0].resolvedSourceMode).toBe(mode);
    if ("sourceMode" in changes && changes.sourceMode === "direct") expect(report.rows[0].reasons).toContain("source-empty");
  });

  it("empty direct base does not suppress independent override grants", () => {
    const report = compare({ sourceMode: "direct", overrides: [override({ allow: true })] });
    expect(report.rows[0]).toMatchObject({ newAllowed: true, reasons: ["grant", "source-empty"] });
  });

  it.each([
    [{ endDate: at }, "expired"],
    [{ startDate: "2026-10-02T12:00:00.001Z" }, "not-started"],
    [{ isActive: false }, "inactive"],
    [{ startDate: "malformed" }, "invalid-time"],
  ])("reports assignment exclusion %j as %s", (changes, reason) => {
    const row = compare({ roles: [role(changes)] }).rows[0];
    expect(row.newAllowed).toBe(false);
    expect(row.reasons).toContain(reason);
  });

  it("start is inclusive, end/override expiry are exclusive", () => {
    expect(compare({ roles: [role({ startDate: at, endDate: "2026-10-02T12:00:00.001Z" })] }).rows[0].newAllowed).toBe(true);
    const expired = compare({ roles: [], overrides: [override({ allow: true, expiresAt: at })] }).rows[0];
    expect(expired.newAllowed).toBe(false);
    expect(expired.reasons).toContain("expired");
    expect(compare({ overrides: [override({ expiresAt: at })] }).rows[0].newAllowed).toBe(true);
  });

  it("deny is conservative for unknown context, scoped for known other branch, and malformed time remains blocking", () => {
    const report = compare({
      direct: [{ module: "orders", actions: ["view"] }],
      overrides: [override({ expiresAt: "malformed" })],
    }, [{ branchId: "A" }, { branchId: "B" }, {}]);
    expect(report.rows.map(row => row.newAllowed)).toEqual([false, true, false]);
    expect(report.rows[2].reasons).toEqual(["explicit-deny", "invalid-time", "unknown-context"]);
  });

  it("requires both department and branch dimensions without guessing", () => {
    const report = compare({
      roles: [role({ scopeType: "branch_department", departmentId: 3 })],
    }, [{ branchId: "A", departmentId: 3 }, { branchId: "A" }, { branchId: "A", departmentId: 4 }, { departmentId: 3 }]);
    expect(report.rows.map(row => row.newAllowed)).toEqual([true, false, false, false]);
    expect(report.rows[1].reasons).toContain("unknown-context");
    expect(report.rows[2].reasons).toContain("scope-mismatch");
  });

  it("legacy null-branch scope requires a concrete branch, not necessarily A", () => {
    expect(compare({ roles: [role({ branchId: null })] }, [{ branchId: "B" }, {}]).rows.map(row => row.newAllowed)).toEqual([true, false]);
  });

  it("preserves unconditional admin bypass, including source-empty and active denies", () => {
    const report = compare({ role: "admin", sourceMode: "direct", overrides: [override()] }, [{}]);
    expect(report.rows[0]).toMatchObject({ newAllowed: true, reasons: ["admin-bypass"] });
  });

  it("mirrors directional aliases using the resolver rather than a second alias implementation", () => {
    const data = input({ roles: [role({ module: "attendance" })] });
    data.checks[0].module = "attendance_check";
    expect(comparePermissionImpact(data).rows[0].newAllowed).toBe(true);
    data.accounts[0].roles[0].module = "attendance_check";
    data.checks[0].module = "attendance";
    expect(comparePermissionImpact(data).rows[0].newAllowed).toBe(false);
  });

  it("always agrees with the real pure resolver across supplied contexts and modes", () => {
    for (const sourceMode of [null, "direct", "inherit"] as const) {
      for (const context of [{}, { branchId: "A" }, { branchId: "B", departmentId: 3 }, { departmentId: 3 }]) {
        const data = input({
          sourceMode, direct: [{ module: "orders", actions: ["view"] }],
          roles: [role({ departmentId: 3 })],
          overrides: [override({ departmentId: 3 })],
        }, [context]);
        const snapshot = normalizePermissionDecisionSnapshot(data.accounts[0], Date.parse(at));
        expect(comparePermissionImpact(data).rows[0].newAllowed)
          .toBe(checkPermissionDecision(snapshot, "orders", "view", context));
      }
    }
  });

  it("uses supplied old outcomes, reports gains and unchecked identifiers without inventing baseline decisions", () => {
    const data = input();
    data.checks[0].oldAllowed = false;
    data.accounts.push(account({ userId: "unchecked" }));
    const report = comparePermissionImpact(data);
    expect(report.oldDecisionSource).toBe("supplied-per-check");
    expect(report.counts.gained).toBe(1);
    expect(report.uncheckedAccountIds).toEqual(["unchecked"]);
    delete (data.checks[0] as any).oldAllowed;
    expect(() => comparePermissionImpact(data)).toThrow();
  });

  it("is deterministic across row permutations and does not mutate supplied data", () => {
    const data = input({ roles: [role(), role({ action: "edit", branchId: "B" })] }, [{ branchId: "B" }, {}]);
    const before = JSON.stringify(data);
    const first = comparePermissionImpact(data);
    expect(JSON.stringify(data)).toBe(before);
    data.checks.reverse();
    data.accounts[0].roles.reverse();
    expect(comparePermissionImpact(data)).toEqual(first);
  });

  it.each([
    (data: any) => { delete data.accounts[0].sourceMode; },
    (data: any) => { data.accounts[0].sourceMode = "unavailable"; },
    (data: any) => { data.accounts[0].name = "not accepted"; },
    (data: any) => { data.accounts.push(data.accounts[0]); },
    (data: any) => { data.checks.push(data.checks[0]); },
    (data: any) => { data.checks[0].userId = "missing"; },
    (data: any) => { data.evaluatedAt = "not a time"; },
    (data: any) => { data.checks[0].context.departmentId = "3"; },
  ])("rejects incomplete, ambiguous, unsanitized or malformed input", mutate => {
    const data = input();
    mutate(data);
    expect(() => comparePermissionImpact(data)).toThrow();
  });
});

describe("offline CLI", () => {
  const cli = (stdin: string, args = ["-"]) => spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/compare-permission-impact.ts", ...args],
    { input: stdin, encoding: "utf8", timeout: 15000 },
  );

  it("reads supplied stdin JSON and emits only a report", () => {
    const result = cli(JSON.stringify(input()));
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual(comparePermissionImpact(input()));
  });

  it("fails explicitly without a report for missing files, invalid JSON/schema, or absent arguments", () => {
    for (const result of [
      cli("", ["tests/does-not-exist-permission-impact.json"]),
      cli("{"), cli(JSON.stringify({ name: "sensitive-value" })), cli("", []),
    ]) {
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).not.toContain("sensitive-value");
    }
  });

  it("has no application imports beyond the pure resolver and no DB/env/network/write APIs", () => {
    const helper = readFileSync("scripts/permission-impact.ts", "utf8");
    const entry = readFileSync("scripts/compare-permission-impact.ts", "utf8");
    const imports = [...(helper + entry).matchAll(/from\s+["']([^"']+)["']/g)].map(match => match[1]).sort();
    expect(imports).toEqual(["../server/permission-decision", "./permission-impact", "node:fs", "zod"].sort());
    const code = (helper + entry).replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/process\.env|dotenv|writeFile|appendFile|createWriteStream|fetch\(|node:https|node:http|DATABASE_URL/);
  });
});