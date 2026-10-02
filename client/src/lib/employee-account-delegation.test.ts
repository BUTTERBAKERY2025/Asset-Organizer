import { afterEach, describe, expect, it, vi } from "vitest";
import { canManageEmployeeAccounts, constrainDelegatedPermissions, createEmployeeAccountCommandGuard, employeeAccountScope, EmployeeAccountRequestError, hasMissingViewPermission, hasUnapprovedPermissions, requestEmployeeAccount, toggleDelegatedPermission } from "./employee-account-delegation";
import { getCachedData, setCachedData, shouldPersist } from "./persistentCache";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("narrow employee account frontend security", () => {
  it.each(["headers", "body"])("bounds a stalled directory %s request without retrying", async phase => {
    vi.useFakeTimers();
    let signal: AbortSignal;
    const fetch = vi.fn((_url, options) => {
      signal = options.signal;
      const stalled = new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
      return phase === "headers" ? stalled : Promise.resolve({ ok: true, json: () => stalled });
    });
    vi.stubGlobal("fetch", fetch);
    const result = requestEmployeeAccount("/api/operations/employee-accounts", { signal: new AbortController().signal });
    const settled = vi.fn();
    void result.then(settled, settled);
    await vi.advanceTimersByTimeAsync(30_001);
    expect(settled).toHaveBeenCalledOnce();
    await expect(result).rejects.toMatchObject({ name: "TimeoutError" });
    expect(signal!.aborted).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("forwards cancellation and cleans up the deadline after success", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetch = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason));
    }));
    vi.stubGlobal("fetch", fetch);
    const result = requestEmployeeAccount("/api/operations/employee-accounts", { signal: controller.signal });
    const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    await requestEmployeeAccount("/api/operations/employee-accounts");
    expect(vi.getTimerCount()).toBe(0);
  });

  const approved = [{ module: "cashier_journal", actions: ["view", "create"] }];

  it("admits only admin and operations_manager, not blanket users access", () => {
    for (const role of ["admin", "operations_manager"]) expect(canManageEmployeeAccounts(role)).toBe(true);
    for (const role of ["employee", "branch_manager", "hr_manager", "viewer", "business_owner", undefined]) expect(canManageEmployeeAccounts(role)).toBe(false);
  });

  it("intersects custom and template permissions with the server-approved allowlist", () => {
    const selected = [
      { module: "users", actions: ["create", "edit"] },
      { module: "cashier_journal", actions: ["delete", "create", "create"] },
      { module: "cashier_journal", actions: ["view"] },
    ];
    expect(constrainDelegatedPermissions(selected, approved)).toEqual(approved);
    expect(hasUnapprovedPermissions(selected, approved)).toBe(true);
    expect(hasUnapprovedPermissions(approved, approved)).toBe(false);
    expect(constrainDelegatedPermissions(selected, [])).toEqual([]);
    expect(constrainDelegatedPermissions([], approved)).toEqual([]);
  });

  it("normalizes permission copies without mutating the returned server catalog", () => {
    const before = JSON.stringify(approved);
    const result = constrainDelegatedPermissions(approved, approved);
    result[0].actions.push("edit");
    expect(JSON.stringify(approved)).toBe(before);
  });

  it("enforces view dependencies without mutating input or exceeding approval", () => {
    const actionOnly = [{ module: "cashier_journal", actions: ["create"] }];
    expect(hasMissingViewPermission(actionOnly)).toBe(true);
    expect(hasMissingViewPermission([])).toBe(false);
    const selected = toggleDelegatedPermission([], approved, "cashier_journal", "create", true);
    expect(selected).toEqual(approved);
    expect(toggleDelegatedPermission(selected, approved, "cashier_journal", "create", true)).toEqual(approved);
    expect(toggleDelegatedPermission(selected, approved, "cashier_journal", "view", false)).toEqual([]);
    expect(toggleDelegatedPermission([], actionOnly, "cashier_journal", "create", true)).toEqual([]);
    expect(selected).toEqual(approved);
    expect(toggleDelegatedPermission(selected, approved, "cashier_journal", "create", false))
      .toEqual([{ module: "cashier_journal", actions: ["view"] }]);
  });

  it("keys actor and scope separately, including membership and active branch changes", () => {
    const user = { id: "actor-a", role: "operations_manager", branchId: "a", activeBranchId: "a", allowedBranches: [{ branchId: "a" }, { branchId: "b" }] };
    expect(employeeAccountScope(user)).toBe(employeeAccountScope({ ...user, allowedBranches: [...user.allowedBranches].reverse() }));
    expect(employeeAccountScope(user)).not.toBe(employeeAccountScope({ ...user, id: "actor-b" }));
    expect(employeeAccountScope(user)).not.toBe(employeeAccountScope({ ...user, activeBranchId: "b" }));
    expect(employeeAccountScope(user)).not.toBe(employeeAccountScope({ ...user, allowedBranches: [{ branchId: "a" }] }));
  });

  it("rejects late commands after close or A→B→A scope transitions", () => {
    const guard = createEmployeeAccountCommandGuard();
    const token = guard.capture();
    expect(guard.isCurrent(token)).toBe(true);
    guard.invalidate();
    guard.invalidate();
    expect(guard.isCurrent(token)).toBe(false);
    expect(guard.isCurrent(guard.capture())).toBe(true);
  });

  it("does not persist the directory, policy, permission edits, or credentials", () => {
    const localStorage = { getItem: vi.fn(), setItem: vi.fn() };
    vi.stubGlobal("localStorage", localStorage);
    for (const path of ["/api/operations/employee-accounts", "/api/operations/employee-accounts/1", "/api/admin/employee-account-policy"]) {
      expect(shouldPersist(path)).toBe(false);
      setCachedData(path, { credentials: { password: "unit-test-only" } }, 60_000);
      expect(getCachedData(path)).toBeUndefined();
    }
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it("uses the atomic creation contract with no credentials in the request or cache", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ credentials: { username: "unit-user", password: "unit-password" } })));
    vi.stubGlobal("fetch", fetch);
    await requestEmployeeAccount("/api/operations/employee-accounts/19", { method: "POST", body: { permissions: approved } });
    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("/api/operations/employee-accounts/19");
    expect(options).toMatchObject({ method: "POST", cache: "no-store", credentials: "include" });
    expect(JSON.parse(options.body)).toEqual({ permissions: approved });
  });

  it("surfaces structured errors and does not expose malformed response bodies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "الفرع غير مسموح" }), { status: 403 })));
    await expect(requestEmployeeAccount("/api/operations/employee-accounts")).rejects.toThrow("الفرع غير مسموح (403)");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("a-secret-must-not-be-logged", { status: 502 })));
    await expect(requestEmployeeAccount("/api/operations/employee-accounts")).rejects.toEqual(new EmployeeAccountRequestError(502, "استجابة غير صالحة من الخادم (502)"));
  });
});