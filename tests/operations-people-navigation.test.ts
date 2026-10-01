import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import {
  attachCenterContext, navigateCenterSourceWithHistory, operationsCenterReturnHref,
  peopleRecordFromSource, peopleReturnIntent, peopleSourceIntent, validatePeopleSourceNavigation, withPeopleReturn,
} from "../client/src/lib/operations-center-navigation";
import { createOperationsHrCommandGuard, operationsHrSelectionIntent } from "../client/src/lib/operations-hr-state";
import { operationsEmployeeSection, operationsJoiningAction, operationsJoiningFocus, type OperationsJoining } from "../client/src/lib/operations-employees";

const origin = "https://app.test";
function source(href = "/hr/leaves?leaveId=42", record = "leave:42", scope = ["a", "b"]) {
  const url = new URL(withPeopleReturn(href, "a", record, origin), origin);
  attachCenterContext(url, "a", scope, 30);
  return url;
}
const candidate = (id: number, notificationId: number): OperationsJoining => ({
  id, candidateName: `Candidate ${id}`, position: "Baker", branchId: "a", status: "signed",
  blockedExisting: false, blockedReason: null, notification: {
    id: notificationId, branchId: "a", status: "signed", notificationNumber: `N-${notificationId}`,
    actualStartDate: "2026-09-01", sentAt: null, expiresAt: null, signedAt: "2026-09-01T10:00:00Z",
    confirmedAt: null, confirmedBy: null, confirmedByName: null, confirmedNotes: null,
  },
});

describe("exact people sender/Return/Back contract", () => {
  it.each([
    ["/hr/leaves?leaveId=42", "leave:42"],
    ["/hr/advances?advanceId=42", "advance:42"],
    ["/employee-attendance-report?attendanceId=42", "attendance_record:42"],
    ["/hr-hub?tab=employees&section=joining&offerId=42", "joining_offer:42"],
    ["/hr-hub?tab=employees&section=joining&offerId=7&notificationId=42", "joining_notification:42"],
  ])("restores outer scope, branch and canonical record for %s", (href, record) => {
    const url = source(href, record);
    expect(peopleRecordFromSource(url)?.record).toBe(record);
    const navigate = vi.fn();
    navigateCenterSourceWithHistory(url, ["a", "b"], navigate);
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate.mock.calls[0][1]).toEqual({ replace: true });
    expect(navigate.mock.calls[1][0]).toBe(`${url.pathname}${url.search}`);
    const back = operationsCenterReturnHref(url.search, ["a", "b"], url.pathname);
    expect(navigate.mock.calls[0][0]).toBe(back);
    expect(peopleReturnIntent(new URL(back, origin).search, ["a", "b"])).toEqual({
      people: true, branchId: "a", record, valid: true,
    });
    expect(new URL(back, origin).searchParams.get("branchIds")).toBe("a,b");
    expect(new URL(back, origin).searchParams.get("performanceDays")).toBe("30");
  });
  it("preserves server-authorized all outer scope rather than selecting only source branch", () => {
    const url = source("/hr/leaves?leaveId=42", "leave:42", []);
    const back = new URL(operationsCenterReturnHref(url.search, ["a", "b"], url.pathname), origin);
    expect(back.searchParams.has("branchIds")).toBe(false);
    expect(back.searchParams.get("peopleBranchId")).toBe("a");
  });
  it.each(["directory", "joining", "transfers"])("opens the reused %s tool without inventing a task", section => {
    const url = new URL(withPeopleReturn(`/hr-hub?tab=employees&section=${section}`, "a", null, origin), origin);
    attachCenterContext(url, "a", ["a"]);
    const navigate = vi.fn();
    navigateCenterSourceWithHistory(url, ["a"], navigate);
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(new URL(navigate.mock.calls[0][0], origin).searchParams.has("peopleRecord")).toBe(false);
  });
  it.each(["/employee-attendance-report", "/hr/leaves", "/hr/advances"])("opens the zero-case source tool %s with explicit branch, no synthetic record", path => {
    const url = new URL(withPeopleReturn(`${path}?branchId=a`, "a", null, origin), origin);
    attachCenterContext(url, "a", ["a"]);
    expect(peopleSourceIntent(url, ["a"])).toMatchObject({ branchId: "a", selection: null, scope: ["a"] });
    const navigate = vi.fn();
    navigateCenterSourceWithHistory(url, ["a"], navigate);
    expect(navigate).toHaveBeenCalledTimes(2);
    const back = new URL(navigate.mock.calls[0][0], origin);
    expect(back.searchParams.get("workspace")).toBe("people");
    expect(back.searchParams.get("peopleBranchId")).toBe("a");
    expect(back.searchParams.has("peopleRecord")).toBe(false);
    const wrong = new URL(url);
    wrong.searchParams.set("leaveId", "42");
    expect(peopleSourceIntent(wrong, ["a"])).toBeNull();
    const revoked = new URL(url);
    revoked.searchParams.set("branchId", "denied");
    expect(peopleSourceIntent(revoked, ["a"])).toBeNull();
  });
  it("does not grant people monthly's outside-outer-scope branch exception", () => {
    expect(() => attachCenterContext(source(), "a", ["b"])).toThrow();
    expect(peopleSourceIntent(source(), ["b"])).toBeNull();
  });
  it.each([
    ["leaveId", "43"], ["leaveId", "0"], ["leaveId", "9007199254740992"],
    ["branchId", "b"], ["centerPeopleBranchId", "b"], ["centerPeopleRecord", "advance:42"],
    ["centerBranchIds", "a,a"], ["centerBranchIds", "a,denied"],
    ["centerBranchIds", "all"], ["centerBranchIds", "a,"],
  ])("rejects malformed/conflicting %s=%s and never substitutes a default branch", (key, value) => {
    const url = source();
    url.searchParams.set(key, value);
    expect(peopleSourceIntent(url, ["a", "b"])).toBeNull();
    const navigate = vi.fn();
    navigateCenterSourceWithHistory(url, ["a", "b"], navigate);
    expect(navigate).not.toHaveBeenCalled();
    const returned = new URL(operationsCenterReturnHref(url.search, ["a", "b"], url.pathname), origin);
    expect(peopleReturnIntent(returned.search, ["a", "b"]).valid).toBe(false);
  });
  it.each(["leaveId", "branchId", "from", "centerWorkspace", "centerPeopleBranchId", "centerPeopleRecord", "centerBranchIds"])("rejects duplicate %s even with identical values", key => {
    const url = source();
    url.searchParams.append(key, url.searchParams.get(key)!);
    expect(peopleSourceIntent(url, ["a", "b"])).toBeNull();
    const navigate = vi.fn();
    navigateCenterSourceWithHistory(url, ["a", "b"], navigate);
    expect(navigate).not.toHaveBeenCalled();
  });
  it("checks real source path, including Return and not only ID query strings", () => {
    const url = source();
    url.pathname = "/hr/advances";
    expect(peopleSourceIntent(url, ["a", "b"])).toBeNull();
    const navigate = vi.fn();
    navigateCenterSourceWithHistory(url, ["a", "b"], navigate);
    expect(navigate).not.toHaveBeenCalled();
    expect(new URL(operationsCenterReturnHref(url.search, ["a", "b"], url.pathname), origin).searchParams.has("peopleRecord")).toBe(false);
  });
  it("refuses revoked or malformed center HR branch intent instead of selecting its only remaining branch", () => {
    for (const search of ["?branchId=a&branchId=a", "?branchId=&from=operations-center", "?from=operations-center", "?branchId=all"]) {
      expect(operationsHrSelectionIntent(search, "2026-09").branchId).toBe("__invalid_scope__");
    }
    expect(operationsHrSelectionIntent("?branchId=denied", "2026-09").branchId).toBe("denied");
  });
});

describe("people source click async freshness", () => {
  it.each(["branches", "permission", "record"] as const)("ignores A→B→A while awaiting %s", async step => {
    const guard = createOperationsHrCommandGuard();
    guard.update("A");
    const token = guard.capture();
    let release!: (value: any) => void;
    const delayed = new Promise<any>(resolve => { release = resolve; });
    const calls = { branches: vi.fn(async () => ["a", "b"]), permission: vi.fn(async () => true), record: vi.fn(async () => true) };
    calls[step] = vi.fn(() => delayed) as any;
    const result = validatePeopleSourceNavigation(source(), { ...calls, isCurrent: () => guard.isCurrent(token) });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    guard.update("B"); guard.update("A");
    release(step === "branches" ? ["a", "b"] : true);
    expect(await result).toBeNull();
  });
  it.each(["branches", "permission", "record"] as const)("fails closed when fresh %s validation fails", async step => {
    const checks = { branches: async () => ["a", "b"], permission: async () => true, record: async () => true, isCurrent: () => true };
    if (step === "branches") checks.branches = async () => ["b"];
    else checks[step] = async () => false;
    expect(await validatePeopleSourceNavigation(source(), checks)).toBeNull();
  });
  it("opens only after fresh grants, source permission and persisted clicked record all pass", async () => {
    expect(await validatePeopleSourceNavigation(source(), {
      branches: async () => ["a", "b"], permission: async () => true, record: async () => true, isCurrent: () => true,
    })).toEqual(["a", "b"]);
  });
  it("wires canonical operations-manager tools, source revalidation and a single Layout breadcrumb", () => {
    const center = readFileSync("client/src/pages/operations-center.tsx", "utf8");
    expect(center).toContain('canOpenEmployees={user?.role === "operations_manager" && canView("operations_hr")}');
    expect(center).toContain("validatePeopleSourceNavigation(destination");
    expect(center).toContain("sourceCommands.isCurrent(token)");
    expect(center).toContain('fetch("/api/my-permissions"');
    const hr = readFileSync("client/src/pages/operations-hr.tsx", "utf8");
    expect(hr).not.toContain("العودة إلى ملف الشهر التشغيلي");
    expect(hr).toContain("&& sourceValid");
  });
});

describe("actual center people source permission callbacks", () => {
  function harness(options: { ids?: string[]; grants?: string[]; status?: string; branch?: string; role?: string; permissionWait?: Promise<any> } = {}) {
    const page = ts.createSourceFile("operations-center.tsx", readFileSync("client/src/pages/operations-center.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let initializer: ts.Expression | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "go") initializer = node.initializer;
      ts.forEachChild(node, visit);
    };
    visit(page);
    if (!initializer) throw new Error("Missing actual go callback");
    const sourceCommands = createOperationsHrCommandGuard();
    const navigate = vi.fn(), setMessage = vi.fn();
    const fetch = vi.fn(async (href: string) => ({
      ok: true,
      json: async () => href === "/api/my-permissions"
        ? options.permissionWait ? await options.permissionWait
          : (options.grants ?? ["operations", "hr_leaves", "hr_advances", "attendance", "operations_hr", "operations_joining", "operations_employee_transfer"])
            .map(module => ({ module, actions: ["view"] }))
        : href === "/api/branches" ? (options.ids ?? ["a", "b"]).map(id => ({ id }))
        : href.startsWith("/api/operations-hr/joining") ? [candidate(7, 42)]
        : href.startsWith("/api/attendance/") ? { id: 42, branchId: options.branch ?? "a", status: options.status ?? "pending" }
        : [{ id: 42, branchId: options.branch ?? "a", status: options.status ?? "pending" }],
    }));
    const dependencies = {
      window: { location: { origin } }, data: { scope: { branchIds: ["a"] } }, effectiveIds: ["a"],
      scopeChecked: true, allowed: true, invalidSelection: false, user: { id: "actor", role: options.role ?? "operations_manager" },
      sourceAccess: { current: { allowed: true } }, sourceCommands, canView: () => true, fetch,
      sourceBranchScope: { current: "a,b" }, client: { setQueryData: vi.fn() }, purgeCenter: vi.fn(),
      refetchBranches: async () => ({ isError: false, data: (options.ids ?? ["a", "b"]).map(id => ({ id })) }),
      attachCenterContext, monthlySourceIntent: () => null, peopleRecordFromSource, peopleSourceIntent,
      withPeopleReturn, validatePeopleSourceNavigation, operationsJoiningFocus, navigateCenterSourceWithHistory,
      navigate, performanceDays: 7, setMessage, RECORD_PARAMS: {},
    };
    const compiled = ts.transpileModule(`const handler = ${initializer.getText(page)};`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText;
    const go = new Function(...Object.keys(dependencies), `${compiled}\nreturn handler;`)(...Object.values(dependencies));
    return { go, navigate, setMessage, fetch, sourceCommands };
  }
  it.each([
    ["/hr/leaves?leaveId=42", "leave"],
    ["/hr/advances?advanceId=42", "advance"],
    ["/employee-attendance-report?attendanceId=42", "attendance_record"],
  ])("rechecks exact current %s before replacing/pushing history", async (href, sourceType) => {
    const h = harness();
    await h.go(href, "a", { branchId: "a", sourceType, sourceId: "42", status: "pending" });
    expect(h.navigate).toHaveBeenCalledTimes(2);
    expect(h.navigate.mock.calls[0][1]).toEqual({ replace: true });
    expect(h.fetch).toHaveBeenCalledTimes(3);
  });
  it.each(["/hr/leaves", "/hr/advances", "/employee-attendance-report"])("requires the actual permission for zero-case %s tools", async href => {
    const denied = harness({ grants: ["operations", "operations_hr"] });
    await denied.go(href, "a");
    expect(denied.navigate).not.toHaveBeenCalled();
    const allowed = harness();
    await allowed.go(href, "a");
    expect(allowed.navigate).toHaveBeenCalledTimes(2);
  });
  it.each([
    { ids: ["b"] }, { grants: ["operations"] }, { status: "approved" }, { branch: "b" },
  ])("does not open stale/denied clicked source with fresh result %j", async options => {
    const h = harness(options);
    await h.go("/hr/leaves?leaveId=42", "a", { branchId: "a", sourceType: "leave", sourceId: "42", status: "pending" });
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.setMessage).toHaveBeenCalled();
  });
  it("rejects exact joining pair mismatch and HR tools under a general HR route role", async () => {
    const mismatch = harness();
    await mismatch.go("/hr-hub?tab=employees&section=joining&offerId=8&notificationId=42", "a");
    expect(mismatch.navigate).not.toHaveBeenCalled();
    const wrongRole = harness({ role: "hr_manager" });
    await wrongRole.go("/hr-hub?tab=employees&section=transfers", "a");
    expect(wrongRole.navigate).not.toHaveBeenCalled();
  });
  it("drops actual late permission callback after A→B→A and does not display its stale error", async () => {
    let release!: (value: any) => void;
    const waiting = new Promise<any>(resolve => { release = resolve; });
    const h = harness({ permissionWait: waiting });
    const pending = h.go("/hr/leaves?leaveId=42", "a");
    await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(2));
    h.sourceCommands.update("B"); h.sourceCommands.update("A");
    release(["operations", "hr_leaves"].map(module => ({ module, actions: ["view"] })));
    await pending;
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.setMessage).not.toHaveBeenCalled();
    expect(h.fetch).toHaveBeenCalledTimes(2);
  });
  it("honors the owning workspace's local branch/source/record intent generation during permission awaits", async () => {
    let release!: (value: any) => void;
    const waiting = new Promise<any>(resolve => { release = resolve; });
    const h = harness({ permissionWait: waiting });
    const local = createOperationsHrCommandGuard();
    local.update("branch-a:leaves:42");
    const token = local.capture();
    const pending = h.go("/hr/leaves?leaveId=42", "a", undefined, () => local.isCurrent(token));
    await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(2));
    local.update("branch-b:advances:42"); local.update("branch-a:leaves:42");
    release(["operations", "hr_leaves"].map(module => ({ module, actions: ["view"] })));
    await pending;
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.setMessage).not.toHaveBeenCalled();
  });
});

describe("joining exact authorized candidate receiver", () => {
  const rows = [candidate(7, 42), candidate(8, 43)];
  it.each(["?offerId=7", "?notificationId=42", "?offerId=7&notificationId=42&branchId=a"])("focuses the real authorized candidate for %s", search => {
    expect(operationsJoiningFocus(search, rows, "a").row).toBe(rows[0]);
    expect(operationsEmployeeSection(search)).toBe("joining");
  });
  it.each(["?offerId=7&notificationId=43", "?offerId=999", "?notificationId=42&notificationId=42",
    "?offerId=0", "?offerId=9007199254740992", "?notificationId=", "?offerId=7&branchId=b"])("does not silently focus another candidate for %s", search => {
    expect(operationsJoiningFocus(search, rows, "a")).toMatchObject({ requested: true, row: null });
  });
  it("purges focused identity when fresh response loses that authorized candidate", () => {
    expect(operationsJoiningFocus("?offerId=7&notificationId=42", [rows[1]], "a").row).toBeNull();
    expect(operationsJoiningFocus("?offerId=7", [{ ...rows[0], branchId: "b" }], "a").row).toBeNull();
    expect(operationsJoiningFocus("?offerId=7", [{ ...rows[0], notification: { ...rows[0].notification!, branchId: "b" } }], "a").row).toBeNull();
  });
  it("reserves signed decision labels for eligible, nonblocked approve actions", () => {
    expect(operationsJoiningAction(rows[0], false, true)).toBe("confirm");
    expect(operationsJoiningAction(rows[0], false, false)).toBe("approval-denied");
    expect(operationsJoiningAction({ ...rows[0], blockedExisting: true }, false, true)).toBe("blocked");
    expect(operationsJoiningAction({ ...rows[0], status: "converted" }, false, true)).toBe("terminal");
    const workspace = readFileSync("client/src/components/operations-hr/joining-workspace.tsx", "utf8");
    expect(workspace).toContain('operationsJoiningAction(row, canCreate, canApprove) === "confirm"');
    expect(workspace).toContain("focus.requested ? focus.row ? [focus.row] : []");
    expect(workspace).toContain("لم يُفتح مرشح آخر كبديل");
  });
});