import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canApproveDailyClosure, dailyClosureCenterLabel, dailyClosureDateRange, dailyClosureHref, dailyClosureIntent, dailyClosureScopeReady, dailyClosureToday } from "../client/src/lib/daily-closure-navigation";
import { attachCenterContext, monthlyReturnIntent, operationsCenterReturnHref, withMonthlyReturn } from "../client/src/lib/operations-center-navigation";

const origin = "https://bakery.test";
const read = (name: string) => readFileSync(new URL(`../client/src/${name}`, import.meta.url), "utf8");

describe("monthly daily evidence URL loop", () => {
  const send = (destination: "list" | "create", day = "2026-09-14") => {
    const url = new URL(withMonthlyReturn(dailyClosureHref(destination, "", "branch-b", day, "2026-09"),
      "branch-b", "2026-09", "closing", origin), origin);
    attachCenterContext(url, "branch-b", ["branch-a", "branch-b"]);
    return url;
  };

  it("missing operating day -> create -> filtered approval list -> detail -> list -> same monthly file", () => {
    const create = send("create");
    expect(create.pathname).toBe("/branch-daily-closing");
    expect(dailyClosureIntent(create.search)).toEqual({ date: "2026-09-14", month: "2026-09", invalidDate: false });
    const list = new URL(dailyClosureHref("list", create.search, "branch-b", "2026-09-14", "2026-09"), origin);
    expect(list.pathname).toBe("/branch-daily-closures");
    expect(dailyClosureDateRange(list.search)).toEqual({ startDate: "2026-09-14", endDate: "2026-09-14" });
    const detail = new URL(dailyClosureHref(42, list.search, "branch-b"), origin);
    expect(detail.pathname).toBe("/branch-daily-closures/42");
    const backToList = new URL(dailyClosureHref("list", detail.search, "branch-b"), origin);
    expect(backToList.href).toBe(list.href);
    const returnHref = new URL(operationsCenterReturnHref(backToList.search, ["branch-a", "branch-b"]), origin);
    expect(returnHref.searchParams.get("branchIds")).toBe("branch-a,branch-b");
    expect(monthlyReturnIntent(returnHref.search, ["branch-a", "branch-b"])).toEqual({
      monthly: true, branchId: "branch-b", month: "2026-09", file: "closing",
    });
  });

  it("existing open day goes to the real approval list with the exact branch/date, not read-only detail", () => {
    const approval = send("list", "2026-09-30");
    expect(approval.pathname).toBe("/branch-daily-closures");
    expect(approval.searchParams.get("branchId")).toBe("branch-b");
    expect(dailyClosureDateRange(approval.search)).toEqual({ startDate: "2026-09-30", endDate: "2026-09-30" });
    const source = read("components/operations-center/month-workflow.tsx");
    expect(source).toContain('item.status === "open" ? "list" : item.id');
    expect(source).toContain('dailyClosureHref("create", "", branchId, day, month)');
    expect(source).toContain('begin("declare", day)');
  });

  it("preserves monthly metadata across manual daily scope changes and filters revoked return branches", () => {
    const entry = send("create");
    const changed = new URL(dailyClosureHref("list", entry.search, "branch-a", "2026-10-01", "2026-10"), origin);
    expect(dailyClosureIntent(changed.search).date).toBe("2026-10-01");
    expect(changed.searchParams.get("centerMonth")).toBe("2026-09");
    expect(changed.searchParams.get("centerMonthBranchId")).toBe("branch-b");
    expect(operationsCenterReturnHref(changed.search, ["branch-a"])).toBe("/operations-center?branchIds=branch-a");
  });

  it("validates dates from operations-center as well as branch-operations without defaulting malformed days to today", () => {
    for (const from of ["operations-center", "branch-operations"]) {
      expect(dailyClosureIntent(`?from=${from}&date=2026-02-30&month=2026-02`).invalidDate).toBe(true);
      expect(dailyClosureIntent(`?from=${from}&date=&month=2026-02`).invalidDate).toBe(true);
      expect(dailyClosureIntent(`?from=${from}&date=2026-03-01&month=2026-02`).invalidDate).toBe(true);
      expect(dailyClosureIntent(`?from=${from}&date=2024-02-29&month=2024-02`).date).toBe("2024-02-29");
    }
    expect(dailyClosureDateRange("?month=2024-02")).toEqual({ startDate: "2024-02-01", endDate: "2024-02-29" });
    expect(() => dailyClosureHref("create", "", "branch-b", "2026-02-30")).toThrow();
    expect(() => dailyClosureHref(-1, "", "branch-b")).toThrow();
  });

  it("does not carry arbitrary return URLs and keeps the branch desk's opaque return token", () => {
    const href = new URL(dailyClosureHref("create",
      "?from=branch-operations&branchReturn=token&returnUrl=https://evil.test&date=2026-09-14", "branch-b"), origin);
    expect(href.searchParams.get("branchReturn")).toBe("token");
    expect(href.searchParams.has("returnUrl")).toBe(false);
  });
});

describe("daily approval gates never act on stale rows", () => {
  const closure = { branchId: "branch-b", createdBy: "creator", status: "open", closureDate: "2026-09-14" };
  const context = {
    actorId: "reviewer", permitted: true, scopeReady: true, pending: false, fetching: false,
    allowedIds: ["branch-a", "branch-b"], branchId: "branch-b", startDate: "2026-09-14", endDate: "2026-09-14",
  };
  it("requires effective approval permission, a separate actor and settled branch/date evidence", () => {
    expect(canApproveDailyClosure(closure, context)).toBe(true);
    for (const change of [
      { permitted: false }, { actorId: undefined }, { actorId: "creator" }, { scopeReady: false },
      { pending: true }, { fetching: true }, { allowedIds: ["branch-a"] }, { branchId: "branch-a" },
      { startDate: "2026-09-15" }, { endDate: "2026-09-13" },
    ]) expect(canApproveDailyClosure(closure, { ...context, ...change })).toBe(false);
    expect(canApproveDailyClosure({ ...closure, status: "closed" }, context)).toBe(false);
    expect(canApproveDailyClosure({ ...closure, createdBy: "" }, context)).toBe(false);
  });

  it("matches the existing server's admin creator exception without weakening any other gate", () => {
    const admin = { ...context, actorId: "creator", actorRole: "admin" };
    expect(canApproveDailyClosure(closure, admin)).toBe(true);
    expect(canApproveDailyClosure(closure, { ...admin, permitted: false })).toBe(false);
    expect(canApproveDailyClosure(closure, { ...admin, allowedIds: ["branch-a"] })).toBe(false);
    expect(canApproveDailyClosure(closure, { ...admin, fetching: true })).toBe(false);
    expect(canApproveDailyClosure(closure, { ...admin, actorRole: "manager" })).toBe(false);
    expect(canApproveDailyClosure({ ...closure, status: "closed" }, admin)).toBe(false);
  });

  it("denies both old and new branch actions during linked-scope resolution, including unscoped first renders", () => {
    const ids = ["branch-a", "branch-b"];
    expect(dailyClosureScopeReady("", ids, false, false, false, null, true)).toBe(false);
    expect(dailyClosureScopeReady("branch-a", ids, false, true, false, "branch-b", true)).toBe(false);
    expect(dailyClosureScopeReady("branch-b", ids, true, true, true, "branch-b", true)).toBe(false);
    expect(dailyClosureScopeReady("branch-b", ["branch-a"], false, true, false, "branch-b", true)).toBe(false);
    expect(dailyClosureScopeReady("all", ids, false, true, false, "branch-b", true)).toBe(false);
    expect(dailyClosureScopeReady("branch-b", ids, false, true, false, "branch-b", true)).toBe(true);
  });

  it("wires the gate into the actual confirmation path, removes previous-branch placeholders and invalidates evidence", () => {
    const list = read("pages/branch-daily-closures.tsx");
    expect(list).not.toContain("placeholderData:");
    expect(list).toContain("responseData?.scopeKey === queryParams");
    expect(list).toContain('permissions.canApprove("daily_closures")');
    expect(list).toContain("actorId: user?.id, actorRole: user?.role");
    expect(list).toContain("const current = closures.find(row => row.id === closure.id)");
    expect(list).toContain("canApproveDailyClosure(current,");
    expect(list).toContain("if (!canClose(closure)) throw new Error");
    expect(list).toContain("if (canClose(closure)) closeMutation.mutate(closure)");
    expect(list).toContain('apiRequest("POST", `/api/branch-daily-closures/${closure.id}/close`');
    for (const page of ["branch-daily-closures", "branch-daily-closing"]) {
      const source = read(`pages/${page}.tsx`);
      expect(source).toContain('queryKey: ["/api/operations-center/month-workflow"]');
      expect(source).toContain("exact: true");
      expect(source).toContain("permissionState.isFetching");
    }
    const create = read("pages/branch-daily-closing.tsx");
    expect(create).toContain("selectionScope === scopeKey");
    expect(create).toContain("previewData?.scopeKey === scopeKey");
    expect(create).toContain("if (!canCreateClosure)");
    const detail = read("pages/branch-daily-closure-detail.tsx");
    expect(detail).toContain('dailyClosureHref("list", linkedSearch, closure.branchId, closure.closureDate');
    expect(detail).not.toContain('href="/branch-daily-closures"');
  });
});

describe("daily source date and Sales return context", () => {
  it("uses Saudi business midnight rather than browser/host midnight", () => {
    expect(dailyClosureToday(new Date("2026-09-14T20:59:59Z"))).toBe("2026-09-14");
    expect(dailyClosureToday(new Date("2026-09-14T21:00:00Z"))).toBe("2026-09-15");
  });

  it("preserves original page, selected record, outer scope and the empty all-branches filter", () => {
    const search = "?from=operations-center&centerWorkspace=sales&centerBranchIds=branch-a,branch-b"
      + "&centerSalesRecord=daily_closure:19&centerSalesBranchId=branch-b&centerSalesFilterBranchId="
      + "&centerSalesSource=closures&centerSalesOffset=30";
    const list = new URL(dailyClosureHref("list", search, "branch-b", "2026-09-14"), origin);
    const detail = new URL(dailyClosureHref(19, list.search, "branch-b", "2026-09-14"), origin);
    const rebuild = new URL(dailyClosureHref("create", detail.search, "branch-b", "2026-09-14"), origin);
    rebuild.searchParams.set("correction", "1");
    expect(list.searchParams.get("closureId")).toBe("19");
    for (const url of [list, detail, rebuild]) {
      expect(url.searchParams.get("centerSalesRecord")).toBe("daily_closure:19");
      expect(url.searchParams.get("centerSalesBranchId")).toBe("branch-b");
      expect(url.searchParams.has("centerSalesFilterBranchId")).toBe(true);
      expect(url.searchParams.get("centerSalesFilterBranchId")).toBe("");
      expect(url.searchParams.get("centerSalesSource")).toBe("closures");
      expect(url.searchParams.get("centerSalesOffset")).toBe("30");
      expect(url.searchParams.get("centerBranchIds")).toBe("branch-a,branch-b");
      const back = new URL(operationsCenterReturnHref(url.search, ["branch-a", "branch-b"], url.pathname), origin);
      expect(back.searchParams.get("workspace")).toBe("sales");
      expect(back.searchParams.get("salesRecord")).toBe("daily_closure:19");
      expect(back.searchParams.get("salesFilterBranchId")).toBe("");
      expect(back.searchParams.get("salesSource")).toBe("closures");
      expect(back.searchParams.get("salesOffset")).toBe("30");
    }
    const scopedRebuild = new URL(dailyClosureHref("create", rebuild.search, "branch-b", "2026-09-14"), origin);
    expect(scopedRebuild.searchParams.get("correction")).toBe("1");
    expect(dailyClosureCenterLabel(search)).toBe("متابعة اليوميات والإغلاق اليومي");
    expect(dailyClosureCenterLabel("?centerWorkspace=monthly")).toBe("ملف الشهر التشغيلي");
    expect(dailyClosureCenterLabel("")).toBe("مركز إدارة التشغيل");
  });

  it("does not normalize duplicate return parameters into valid-looking Sales intent", () => {
    const link = new URL(dailyClosureHref("list",
      "?centerWorkspace=sales&centerWorkspace=monthly&centerSalesRecord=daily_closure:19"
      + "&centerSalesOffset=0&centerSalesOffset=30", "branch-b"), origin);
    expect(link.searchParams.getAll("centerWorkspace")).toEqual(["sales", "monthly"]);
    expect(link.searchParams.getAll("centerSalesOffset")).toEqual(["0", "30"]);
    expect(link.searchParams.has("closureId")).toBe(false);
  });

  it("exposes only the existing authorized explicit correction path and refreshes source evidence", () => {
    const detail = read("pages/branch-daily-closure-detail.tsx");
    expect(detail).toContain('user?.role === "admin"');
    expect(detail).toContain('permissions.canDelete("daily_closures")');
    expect(detail).toContain('closure?.status === "open"');
    expect(detail).toContain('apiRequest("DELETE", `/api/branch-daily-closures/${captured.id}`)');
    expect(detail).toContain("if (!correctionAllowed || !closure) throw");
    expect(detail).toContain("captured.intent !== latestCorrectionIntent.current");
    expect(detail).toContain("AlertDialog key={correctionIntent}");
    expect(detail).toContain('dailyClosureHref("create", captured.search');
    expect(detail).toContain('"/api/cashier-journals"');
    for (const page of ["branch-daily-closing", "branch-daily-closures", "branch-daily-closure-detail"]) {
      const source = read(`pages/${page}.tsx`);
      expect(source).toContain('"/api/branch-daily-closures/journals-preview"');
      expect(source).toContain('"/api/operations-center/sales"');
    }
    expect(read("pages/branch-daily-closing.tsx")).toContain("journalPreview.businessDate || dailyClosureToday()");
  });
});