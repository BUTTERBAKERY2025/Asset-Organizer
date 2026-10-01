import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { attachCenterContext, centerNoticeDestination, monthlyReturnIntent, monthlySourceIntent, navigateCenterSourceWithHistory, operationsCenterReturnHref, preserveMonthlyAllReturn, purgeOperationsCenterQueries, refreshOperationsCenterQueries, salaryBranchIntent, withMonthlyReturn } from "../client/src/lib/operations-center-navigation";
import { createOperationsHrCommandGuard, operationsHrSelectionHref } from "../client/src/lib/operations-hr-state";

describe("operations monthly sender/receiver navigation contract", () => {
  const origin = "https://bakery.test";
  it("salary receiver accepts both names and refuses conflicting or empty explicit intent", () => {
    expect(salaryBranchIntent("?branch=one").branch).toBe("one");
    expect(salaryBranchIntent("?branchId=one").branch).toBe("one");
    expect(salaryBranchIntent("?branch=one&branchId=one").conflict).toBe(false);
    expect(salaryBranchIntent("?branch=one&branchId=two")).toEqual({ branch: "", explicit: true, conflict: true });
    expect(salaryBranchIntent("?branch=")).toEqual({ branch: "", explicit: true, conflict: false });
    expect(salaryBranchIntent("")).toEqual({ branch: "", explicit: false, conflict: false });
  });
  it("sender sets the salary receiving branch and preserves month, without replacing conflicting scope", () => {
    const url = new URL("/salary-closing?month=2026-09", origin);
    attachCenterContext(url, "one", ["one", "two"]);
    expect(url.searchParams.get("branch")).toBe("one");
    expect(url.searchParams.get("branchId")).toBe("one");
    expect(url.searchParams.get("month")).toBe("2026-09");
    expect(() => attachCenterContext(new URL("/salary-closing?branch=two", origin), "one", ["one"])).toThrow();
    expect(() => attachCenterContext(new URL("/salary-closing?branch=one&branchId=two", origin), "one", ["one"])).toThrow();
  });
  it.each([
    ["/hr-hub?branchId=one&month=2026-09&tab=payroll", "payroll"],
    ["/salary-closing?branch=one&month=2026-09", "payroll"],
    ["/pnl-dashboard?branchId=one&month=2026-09", "expenses"],
    ["/branch-daily-closures/42?branchId=one", "closing"],
    ["/sales-analytics?branchId=one&month=2026-09", "sales"],
  ] as const)("roundtrips %s to the same monthly branch, scope, month and file", (href, file) => {
    const destination = new URL(withMonthlyReturn(href, "one", "2026-09", file, origin), origin);
    attachCenterContext(destination, "one", ["one", "two"]);
    const back = new URL(operationsCenterReturnHref(destination.search, ["one", "two"]), origin);
    expect(back.pathname).toBe("/operations-center");
    expect(back.searchParams.get("branchIds")).toBe("one,two");
    expect(monthlyReturnIntent(back.search, ["one", "two"])).toEqual({
      monthly: true, month: "2026-09", branchId: "one", file,
    });
    if (destination.pathname === "/hr-hub") expect(destination.searchParams.get("tab")).toBe("payroll");
  });
  it("filters revoked return scope and never restores a revoked month branch", () => {
    const search = "?from=operations-center&centerBranchIds=one,two&centerWorkspace=monthly&centerMonth=2026-09&centerMonthBranchId=one&centerMonthFile=payroll";
    expect(operationsCenterReturnHref(search, ["two"])).toBe("/operations-center?branchIds=two");
    expect(monthlyReturnIntent("?workspace=monthly&month=2026-09&monthBranchId=one", ["two"]).branchId).toBe("");
  });
  it("rejects external destinations and malformed return fields", () => {
    expect(() => withMonthlyReturn("https://evil.test/pnl-dashboard", "one", "2026-09", "expenses", origin)).toThrow();
    expect(operationsCenterReturnHref("?centerWorkspace=monthly&centerMonth=2026-99&centerMonthBranchId=one", ["one"])).toBe("/operations-center");
    expect(monthlyReturnIntent("?workspace=monthly&month=2026-09&monthBranchId=one&monthFile=unknown", ["one"]).file).toBeNull();
  });
  it.each(["two", "all"])("preserves %s monthly intent in Browser Back and Return without broadening the outer subset", monthBranchId => {
    const source = new URL(withMonthlyReturn("/pnl-dashboard?branchId=two&month=2026-09", monthBranchId,
      "2026-09", "expenses", origin), origin);
    attachCenterContext(source, "two", ["one"], 30);
    const history = ["/operations-center?branchIds=one"];
    const navigate = vi.fn((href: string, options?: { replace?: boolean }) => {
      if (options?.replace) history[history.length - 1] = href;
      else history.push(href);
    });
    navigateCenterSourceWithHistory(source, ["one", "two"], navigate);
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate.mock.calls[0][1]).toEqual({ replace: true });
    const back = new URL(history[0], origin);
    expect(back.searchParams.get("branchIds")).toBe("one");
    expect(back.searchParams.get("monthBranchId")).toBe(monthBranchId);
    expect(back.searchParams.get("monthFile")).toBe("expenses");
    expect(back.searchParams.get("month")).toBe("2026-09");
    history.pop();
    expect(history[0]).toBe(operationsCenterReturnHref(source.search, ["one", "two"]));
  });
  it("keeps an all-authorized outer scope separate from the single monthly source", () => {
    const source = new URL(withMonthlyReturn("/sales-analytics?branchId=two&month=2026-02&fromDate=2026-02-01&toDate=2026-02-28", "all",
      "2026-02", "sales", origin), origin);
    attachCenterContext(source, "two", [], 7);
    const navigate = vi.fn();
    navigateCenterSourceWithHistory(source, ["one", "two"], navigate);
    const restored = new URL(navigate.mock.calls[0][0], origin);
    expect(restored.searchParams.has("branchIds")).toBe(false);
    expect(monthlyReturnIntent(restored.search, ["one", "two"])).toEqual({
      monthly: true, branchId: "all", month: "2026-02", file: "sales",
    });
    expect(monthlySourceIntent(source, ["one", "two"])?.branchId).toBe("two");
  });
  it.each([
    ["branchId", "two"], ["centerWorkspace", "monthly"], ["centerMonth", "2026-09"],
    ["centerMonthBranchId", "one"], ["centerMonthFile", "expenses"], ["month", "2026-09"],
  ])("denies duplicate monthly source %s rather than persisting or navigating it", (key, value) => {
    const source = new URL(withMonthlyReturn("/pnl-dashboard?branchId=one&month=2026-09", "one", "2026-09", "expenses", origin), origin);
    attachCenterContext(source, "one", ["one"], 7);
    source.searchParams.append(key, value);
    expect(monthlySourceIntent(source, ["one", "two"])).toBeNull();
    const navigate = vi.fn();
    navigateCenterSourceWithHistory(source, ["one", "two"], navigate);
    expect(navigate).not.toHaveBeenCalled();
  });
  it("denies malformed, forged and revoked branch intent, including aggregate sources", () => {
    const base = withMonthlyReturn("/pnl-dashboard?branchId=one&month=2026-09", "one", "2026-09", "expenses", origin);
    for (const href of [
      base.replace("branchId=one", "branchId=all"),
      base.replace("branchId=one", "branchId=forged"),
      base.replace("centerMonthBranchId=one", "centerMonthBranchId=two"),
      base.replace("centerMonthBranchId=one", "centerMonthBranchId=one%2Ctwo"),
      base.replace("centerMonth=2026-09", "centerMonth=2026-99"),
      base.replace("centerMonthFile=expenses", "centerMonthFile=unrecognized"),
      base.replace("/pnl-dashboard", "/salary-closing") + "&branch=two",
      base.replace("/pnl-dashboard", "/untrusted"),
    ]) expect(monthlySourceIntent(new URL(href, origin), ["one", "two"])).toBeNull();
    expect(monthlySourceIntent(new URL(base, origin), ["two"])).toBeNull();
    expect(salaryBranchIntent("?branch=one&branch=one").conflict).toBe(true);
    expect(salaryBranchIntent("?branchId=one&branchId=one").conflict).toBe(true);
  });
  it("refuses duplicate return intent and keeps an entirely revoked selected scope denied, not all", () => {
    const base = "?branchId=one&centerBranchIds=one&centerWorkspace=monthly&centerMonth=2026-09&centerMonthBranchId=one&centerMonthFile=expenses";
    for (const [key, value] of [
      ["centerWorkspace", "monthly"], ["centerMonth", "2026-09"], ["centerMonthBranchId", "one"],
      ["centerMonthFile", "expenses"], ["centerBranchIds", "one"], ["branchId", "one"],
    ]) {
      const restored = new URL(operationsCenterReturnHref(`${base}&${key}=${value}`, ["one", "two"]), origin);
      expect(restored.searchParams.has("monthBranchId")).toBe(false);
    }
    for (const scope of ["one,one", "one,,two", "all", "one, two"]) {
      const restored = new URL(operationsCenterReturnHref(base.replace("centerBranchIds=one", `centerBranchIds=${scope}`), ["one", "two"]), origin);
      expect(restored.searchParams.get("branchIds")).toBe("__invalid_scope__");
      expect(restored.searchParams.has("monthBranchId")).toBe(false);
    }
    const revoked = new URL(operationsCenterReturnHref(base, ["two"]), origin);
    expect(revoked.searchParams.get("branchIds")).toBe("one");
    expect(revoked.searchParams.has("workspace")).toBe(false);
    for (const alias of ["&branch=two", "&branch=one&branch=one"]) {
      expect(new URL(operationsCenterReturnHref(`${base}${alias}`, ["one", "two"]), origin).searchParams.has("workspace")).toBe(false);
    }
    expect(monthlyReturnIntent("?workspace=monthly&monthBranchId=one&monthBranchId=one&month=2026-09", ["one"]).branchId).toBe("");
    expect(monthlyReturnIntent("?workspace=monthly&monthBranchId=all&month=2026-09", []).branchId).toBe("");
  });
  it("HR automatic URL sync preserves aggregate month and file, and never expands the outer selection", () => {
    const search = "?branchId=two&month=2026-09&tab=payroll&from=operations-center&centerBranchIds=one&centerWorkspace=monthly&centerMonth=2026-09&centerMonthBranchId=all&centerMonthFile=payroll";
    const updated = operationsHrSelectionHref("/hr-hub", search, "two", "2026-08", "employees", ["one", "two"]);
    const safe = new URL(preserveMonthlyAllReturn(updated, search), origin);
    expect(safe.searchParams.get("month")).toBe("2026-08");
    const restored = new URL(operationsCenterReturnHref(safe.search, ["one", "two"]), origin);
    expect(Object.fromEntries(restored.searchParams)).toEqual({
      branchIds: "one", workspace: "monthly", month: "2026-09", monthBranchId: "all", monthFile: "payroll",
    });
  });
});

describe("actual center monthly source branch revalidation", () => {
  const origin = "https://bakery.test";
  function sourceGo(freshIds: string[] | null, duringRefresh?: (access: { current: any }) => void) {
    const page = ts.createSourceFile("operations-center.tsx", readFileSync("client/src/pages/operations-center.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let initializer: ts.Expression | undefined;
    function visit(node: ts.Node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "go") initializer = node.initializer;
      ts.forEachChild(node, visit);
    }
    visit(page);
    if (!initializer) throw new Error("Missing actual center source navigation handler");
    const navigate = vi.fn();
    const setMessage = vi.fn();
    const selected = ["one"];
    const sourceAccess = { current: { actorId: "actor", allowed: true, selected, grants: "true" } };
    const refetchBranches = vi.fn(async () => {
      duringRefresh?.(sourceAccess);
      return { isError: freshIds === null, data: freshIds?.map(id => ({ id, name: id })) };
    });
    const dependencies = {
      window: { location: { origin } }, data: { scope: { branchIds: ["one"] } },
      scopeChecked: true, allowed: true, invalidSelection: false,
      sourceAccess, sourceCommands: createOperationsHrCommandGuard(), refetchBranches, attachCenterContext, monthlySourceIntent,
      navigateCenterSourceWithHistory, navigate, performanceDays: 30, setMessage, RECORD_PARAMS: {},
    };
    const compiled = ts.transpileModule(`const handler = ${initializer.getText(page)};`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText;
    const go = new Function(...Object.keys(dependencies), `${compiled}\nreturn handler;`)(...Object.values(dependencies));
    return { go, navigate, setMessage, refetchBranches, sourceAccess, selected };
  }
  it.each(["two", "all"])("allows a freshly authorized outside-subset drill with %s monthly intent, without changing center selected history", async monthBranchId => {
    const harness = sourceGo(["one", "two"]);
    const href = withMonthlyReturn("/pnl-dashboard?branchId=two&month=2026-09", monthBranchId, "2026-09", "expenses", origin);
    await harness.go(href, "two");
    expect(harness.refetchBranches).toHaveBeenCalledOnce();
    expect(harness.navigate).toHaveBeenCalledTimes(2);
    expect(harness.setMessage).not.toHaveBeenCalled();
    const history = new URL(harness.navigate.mock.calls[0][0], origin);
    expect(history.searchParams.get("branchIds")).toBe("one");
    expect(history.searchParams.get("monthBranchId")).toBe(monthBranchId);
    expect(harness.selected).toEqual(["one"]);
  });
  it.each([{ grants: ["one"] }, { grants: ["two"] }, { grants: null }])("denies revoked source/outer selection or failed fresh grants $grants", async ({ grants }) => {
    const harness = sourceGo(grants);
    await harness.go(withMonthlyReturn("/pnl-dashboard?branchId=two&month=2026-09", "all", "2026-09", "expenses", origin), "two");
    expect(harness.refetchBranches).toHaveBeenCalledOnce();
    expect(harness.navigate).not.toHaveBeenCalled();
    expect(harness.setMessage).toHaveBeenCalled();
  });
  it("does not trust raw branch href, duplicate intent, or navigation races", async () => {
    const base = withMonthlyReturn("/pnl-dashboard?branchId=two&month=2026-09", "all", "2026-09", "expenses", origin);
    for (const href of [
      base.replace("branchId=two", "branchId=forged"), `${base}&branchId=two`,
      `${base}&centerMonthBranchId=all`, base.replace("centerMonthBranchId=all", "centerMonthBranchId=one"),
    ]) {
      const harness = sourceGo(["one", "two"]);
      await harness.go(href, "two");
      expect(harness.navigate).not.toHaveBeenCalled();
      expect(harness.setMessage).toHaveBeenCalled();
    }
    for (const changed of [{ actorId: "other" }, { allowed: false }, { grants: "false" }, { selected: ["two"] }]) {
      const harness = sourceGo(["one", "two"], access => { access.current = { ...access.current, ...changed }; });
      await harness.go(base, "two");
      expect(harness.navigate).not.toHaveBeenCalled();
    }
  });
});

describe("supply notice source navigation", () => {
  const origin = "https://bakery.test";
  it("keeps the exact canonical source selection, production workspace, selected scope and performance", () => {
    const destination = centerNoticeDestination("/central-kitchen-orders?branchId=kitchen&orderId=42&stage=approved&deliveryId=7",
      ["kitchen"], ["kitchen", "branch"], ["branch", "kitchen"], 30, origin, "production");
    expect(destination?.branchId).toBe("kitchen");
    const url = new URL(destination!.href, origin);
    expect(url.pathname).toBe("/central-kitchen-orders");
    expect(url.searchParams.get("branchId")).toBe("kitchen");
    expect(url.searchParams.get("orderId")).toBe("42");
    expect(url.searchParams.get("deliveryId")).toBe("7");
    expect(url.searchParams.get("stage")).toBe("approved");
    expect(operationsCenterReturnHref(url.search, ["branch", "kitchen"]))
      .toBe("/operations-center?branchIds=branch%2Ckitchen&performanceDays=30&workspace=production&supplyRecord=delivery_assignment%3A7&supplyBranchId=kitchen");
  });
  it.each([
    ["/transfer-requests?branchId=branch&transferId=9", "/transfer-requests", "transferId"],
    ["/reverse-logistics?branchId=branch&movementId=9", "/reverse-logistics", "movementId"],
    ["/kitchen-warehouse-shipping?kitchenId=branch&shipmentId=9", "/kitchen-warehouse-shipping", "shipmentId"],
    ["/driver-deliveries?deliveryId=9", "/driver-deliveries", "deliveryId"],
  ])("preserves the canonical endpoint and exact selection for %s", (action, path, parameter) => {
    const result = centerNoticeDestination(action, ["branch"], ["branch"], [], 7, origin);
    const url = new URL(result!.href, origin);
    expect(url.pathname).toBe(path);
    expect(url.searchParams.get(parameter)).toBe("9");
    expect(url.searchParams.get("branchId")).toBe("branch");
    expect(operationsCenterReturnHref(url.search, ["branch"])).toBe("/operations-center?performanceDays=7");
  });
  it("does not replace a source branch with a selected branch or accept revoked/conflicting intent", () => {
    for (const action of ["/transfer-requests?branchId=other&transferId=9",
      "/transfer-requests?branchId=branch&branchId=other&transferId=9",
      "/kitchen-warehouse-shipping?branchId=branch&kitchenId=other&shipmentId=9",
      "//evil.test/transfer-requests", "/\\evil.test"]) {
      expect(centerNoticeDestination(action, ["branch"], ["branch"], ["branch"], 7, origin)).toBeNull();
    }
    expect(centerNoticeDestination("/central-kitchen-orders?branchId=kitchen&orderId=42",
      ["kitchen"], ["branch"], ["branch"], 30, origin)).toBeNull();
    expect(centerNoticeDestination("/central-kitchen-orders?orderId=42",
      ["kitchen", "branch"], ["kitchen", "branch"], [], 30, origin)).toBeNull();
    expect(() => attachCenterContext(new URL("/central-kitchen-orders?branchId=kitchen", origin),
      "branch", ["branch"])).toThrow();
  });
  it("filters revoked production return scope without changing workspace or performance", () => {
    expect(operationsCenterReturnHref("?centerWorkspace=production&centerBranchIds=kitchen,branch&centerPerformanceDays=30", ["branch"]))
      .toBe("/operations-center?branchIds=branch&performanceDays=30&workspace=production");
  });
  it.each([
    ["/central-kitchen-orders?orderId=42", "kitchen_order:42"],
    ["/transfer-requests?transferId=42", "transfer:42"],
    ["/reverse-logistics?movementId=42", "reverse_movement:42"],
    ["/driver-deliveries?deliveryId=7", "delivery_assignment:7"],
    ["/central-kitchen-orders?orderId=42&deliveryId=7", "delivery_assignment:7"],
    ["/transfer-requests?transferId=42&deliveryId=7", "delivery_assignment:7"],
    ["/reverse-logistics?movementId=42&deliveryId=7", "delivery_assignment:7"],
    ["/finished-goods-inventory?transferId=42&deliveryId=7", "delivery_assignment:7"],
    ["/kitchen-warehouse-shipping?kitchenId=branch&shipmentId=42&deliveryId=7", "delivery_assignment:7"],
  ])("restores exact supply selection from the legal source CTA %s", (href, record) => {
    const url = new URL(href, origin);
    url.searchParams.set("centerWorkspace", "production");
    url.searchParams.set("centerSupplyRecord", record);
    url.searchParams.set("centerSupplyBranchId", "branch");
    attachCenterContext(url, "branch", ["branch", "kitchen"], 30);
    const returned = new URL(operationsCenterReturnHref(url.search, ["branch", "kitchen"]), origin);
    expect(returned.searchParams.get("workspace")).toBe("production");
    expect(returned.searchParams.get("supplyRecord")).toBe(record);
    expect(returned.searchParams.get("supplyBranchId")).toBe("branch");
    expect(returned.searchParams.get("branchIds")).toBe("branch,kitchen");
    expect(returned.searchParams.get("performanceDays")).toBe("30");
  });
  it("fails closed on noncanonical/source-conflicting selections without blocking a legal embedded source route", () => {
    const base = "/transfer-requests?branchId=branch&transferId=42&deliveryId=7&centerWorkspace=production&centerSupplyRecord=delivery_assignment:7&centerSupplyBranchId=branch";
    for (const invalid of [
      base.replace("delivery_assignment:7", "manual:7"),
      base.replace("delivery_assignment:7", "delivery_assignment:8"),
      base.replace("delivery_assignment:7", "delivery_assignment:9007199254740993"),
      base.replace("centerSupplyBranchId=branch", "centerSupplyBranchId=kitchen"),
      `${base}&centerSupplyRecord=delivery_assignment:7`,
      base.replace("/transfer-requests", "/delivery-management"),
      base.replace("transferId=42&", ""),
    ]) expect(() => attachCenterContext(new URL(invalid, origin), "branch", ["branch"], 7)).toThrow();
    expect(() => attachCenterContext(new URL(base, origin), "branch", ["branch"], 7)).not.toThrow();
  });
  it("drops restored selection on branch revocation, excluded return scope, source conflicts or duplicates", () => {
    const base = "?branchId=branch&transferId=42&centerWorkspace=production&centerSupplyRecord=transfer:42&centerSupplyBranchId=branch&centerBranchIds=branch,kitchen";
    const revoked = new URL(operationsCenterReturnHref(base, ["kitchen"]), origin);
    expect(revoked.searchParams.get("workspace")).toBe("production");
    expect(revoked.searchParams.has("supplyRecord")).toBe(false);
    for (const invalid of [
      base.replace("branch,kitchen", "kitchen"),
      base.replace("transferId=42", "transferId=43"),
      base.replace("branchId=branch", "branchId=kitchen"),
      `${base}&centerSupplyBranchId=branch`,
      `${base}&centerSupplyRecord=transfer:42`,
      `${base}&transferId=42`,
      `${base}&centerBranchIds=branch`,
      base.replace("branch,kitchen", "branch,,kitchen"),
    ]) {
      const result = new URL(operationsCenterReturnHref(invalid, ["branch", "kitchen"]), origin);
      expect(result.searchParams.has("supplyRecord")).toBe(false);
      expect(result.searchParams.has("supplyBranchId")).toBe(false);
    }
  });
  it("replaces the current center history entry before pushing the source so Browser Back restores production selection", () => {
    const history = ["/operations-center?branchIds=branch,kitchen&performanceDays=30"];
    const navigate = vi.fn((href: string, options?: { replace?: boolean }) => {
      if (options?.replace) history[history.length - 1] = href;
      else history.push(href);
    });
    const source = new URL("/central-kitchen-orders?branchId=kitchen&orderId=42&deliveryId=7&centerWorkspace=production&centerSupplyRecord=delivery_assignment:7&centerSupplyBranchId=kitchen&untrusted=ignored#source-detail", origin);
    attachCenterContext(source, "kitchen", ["branch", "kitchen"], 30);
    navigateCenterSourceWithHistory(source, ["branch", "kitchen"], navigate);
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate.mock.calls[0][1]).toEqual({ replace: true });
    expect(navigate.mock.calls[1][1]).toBeUndefined();
    expect(history[1]).toBe(`${source.pathname}${source.search}${source.hash}`);
    history.pop(); // Native Browser Back, not the source Return button.
    const restored = new URL(history[0], origin);
    expect(restored.pathname).toBe("/operations-center");
    expect(Object.fromEntries(restored.searchParams)).toEqual({
      branchIds: "branch,kitchen", performanceDays: "30", workspace: "production",
      supplyRecord: "delivery_assignment:7", supplyBranchId: "kitchen",
    });
    expect(restored.hash).toBe("");
    expect(history[0]).toBe(operationsCenterReturnHref(source.search, ["branch", "kitchen"]));
  });
  it("does not persist invalid, revoked or ordinary board intent as a supply history selection", () => {
    const base = "/transfer-requests?branchId=branch&transferId=42&centerWorkspace=production&centerSupplyRecord=transfer:42&centerSupplyBranchId=branch&centerBranchIds=branch&centerPerformanceDays=7";
    for (const [href, allowed] of [
      [base, ["kitchen"]],
      [base.replace("transferId=42", "transferId=43"), ["branch"]],
      [base.replace("/transfer-requests", "/untrusted"), ["branch"]],
      [`${base}&centerSupplyRecord=transfer:42`, ["branch"]],
      ["/transfer-requests?branchId=branch&transferId=42", ["branch"]],
    ] as const) {
      const navigate = vi.fn();
      const source = new URL(href, origin);
      navigateCenterSourceWithHistory(source, allowed, navigate);
      expect(navigate).toHaveBeenCalledExactlyOnceWith(`${source.pathname}${source.search}`);
    }
  });
  it("keeps an all-authorized center scope on Back rather than narrowing it to the source branch", () => {
    const source = new URL("/transfer-requests?transferId=42&centerWorkspace=production&centerSupplyRecord=transfer:42&centerSupplyBranchId=branch", origin);
    attachCenterContext(source, "branch", [], 7);
    const navigate = vi.fn();
    navigateCenterSourceWithHistory(source, ["branch", "kitchen"], navigate);
    const restored = new URL(navigate.mock.calls[0][0], origin);
    expect(restored.searchParams.has("branchIds")).toBe(false);
    expect(restored.searchParams.get("performanceDays")).toBe("7");
    expect(restored.searchParams.get("supplyBranchId")).toBe("branch");
    expect(navigate.mock.calls[0][1]).toEqual({ replace: true });
  });
});

describe("center supply/board/notices/monthly cache boundary", () => {
  const roots = ["/api/operations-center", "/api/operations-center/supply", "/api/operations-center/people", "/api/operations-center/notifications", "/api/operations-center/month-workflow", "/api/operations-center/monthly"];
  it.each([true, false])("invalidates all canonical cache roots once with cancelRefetch=%s", cancelRefetch => {
    const client = { invalidateQueries: vi.fn(async () => undefined) };
    refreshOperationsCenterQueries(client as any, cancelRefetch);
    expect(client.invalidateQueries.mock.calls).toEqual(roots.map(endpoint => [{ queryKey: [endpoint] }, { cancelRefetch }]));
  });
  it("cancels in-flight responses and purges every root on revocation", () => {
    const client = { cancelQueries: vi.fn(async () => undefined), removeQueries: vi.fn() };
    purgeOperationsCenterQueries(client as any);
    expect(client.cancelQueries.mock.calls).toEqual(roots.map(endpoint => [{ queryKey: [endpoint] }]));
    expect(client.removeQueries.mock.calls).toEqual(roots.map(endpoint => [{ queryKey: [endpoint] }]));
  });
  it("uses the same authority for manual refresh, SSE, polling and scope invalidation; notice clicks use go", () => {
    const page = readFileSync("client/src/pages/operations-center.tsx", "utf8");
    expect(page).toContain('refreshCenter(reason === "change")');
    expect(page).toContain('reason === "scope-invalidated"');
    expect(page).toContain('onClick={() => refreshCenter()}');
    expect(page).toContain("go(destination.href, destination.branchId)");
    const sheet = page.slice(page.indexOf("function CenterNotifications"), page.indexOf("export default function"));
    expect(sheet).not.toContain("navigate(");
    expect(sheet).toContain("revoke()");
  });
  it("wires independently authorized monthly scope/live authority and receiving-page returns", () => {
    const page = readFileSync("client/src/pages/operations-center.tsx", "utf8");
    expect(page).toContain("monthlyBranches={branches}");
    expect(page).toContain("monthlyReady={scopeChecked && !branchesLoading && !branchesError}");
    expect(page).toContain("monthlyLiveManaged={liveEnabled}");
    expect(page).toContain("liveScope.current = allowedIds");
    expect(page).toContain('"salary_closing", "pnl", "pnl_dashboard", "daily_closures", "sales_analytics"');
    for (const name of ["salary-closing", "pnl-dashboard"]) {
      const source = readFileSync(`client/src/pages/${name}.tsx`, "utf8");
      expect(source).toContain("operationsCenterReturnHref(");
    }
  });
});