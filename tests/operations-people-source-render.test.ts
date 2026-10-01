import React, { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeOperationsQueueItem } from "../shared/operations-center";
import type { OperationsPeopleRecord, OperationsPeopleResponse } from "../shared/operations-people";

// Node-only rendering: actual center page, useBranches, People local guard,
// and Wouter's patched History API events. No browser, server or business writes.
const rendererPackage = "react-test-renderer";
let renderer: any, root: any, Center: React.ComponentType, App: React.ComponentType;
let client: QueryClient, location: URL, events: EventTarget;
let history: { state: unknown; replaceState: Function; pushState: Function; back: () => void };
let reads: string[], historyEvents: { type: string; href: string }[];
let branchWait: Promise<void> | undefined;
let freshIds: string[], permissionGranted: boolean, sourceStatus: string;
const branches = [{ id: "medina", name: "المدينة" }, { id: "abha_airport", name: "أبها" }];
const leave: OperationsPeopleRecord = {
  ...makeOperationsQueueItem("leave", 42, "level_1", "medina", "hr_leaves", "طلب إجازة", "pending",
    "/hr/leaves?branchId=medina", "مدير الفرع", null, "people1"),
  domain: "leaves", employee: { name: "صاحب طلب المدينة" },
};
const ui = (names: string[]) => Object.fromEntries(names.map(name => [
  name, (props: any) => createElement(name.toLowerCase(), props, props.children),
]));

beforeAll(async () => {
  renderer = await import(rendererPackage);
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.doMock("@/hooks/useAuth", () => ({
    useAuth: () => ({ user: { id: "people1", role: "operations_manager", branchId: null }, isAdmin: false }),
  }));
  vi.doMock("@/hooks/usePermissions", () => ({
    usePermissions: () => ({ canView: () => true, canExport: () => false, isLoading: false }),
  }));
  vi.doMock("@/hooks/useOperationsCenterLive", () => ({
    useOperationsCenterLive: () => ({ status: "connected" }),
  }));
  vi.doMock("@/lib/app-badge", () => ({ syncAppBadge: async () => {} }));
  vi.doMock("@/components/layout", () => ui(["Layout"]));
  vi.doMock("@/components/operations-center/workspace", () => ({ time: (value: string) => value }));
  vi.doMock("@/components/operations-center/record-sheet", () => ({ time: (value: string) => value }));
  vi.doMock("@/components/operations-center/analytics-model", () => ({
    performanceDataForRange: (data: unknown) => data,
  }));
  vi.doMock("@/components/operations-center/operations-screen", () => ({
    OperationsCenterScreen: (props: any) => createElement("main", {}, props.actions, props.children),
  }));
  // Replace only the board's unrelated presentation, not People state/callbacks.
  vi.doMock("@/components/operations-center/decision-board", async () => {
    const { OperationsPeopleWorkspace } = await import("../client/src/components/operations-center/people-workspace");
    return { OperationsDecisionBoard: (props: any) => createElement(OperationsPeopleWorkspace, {
      branches: props.data.branches, actorId: props.actorId, open: props.open,
    }) };
  });
  vi.doMock("@/components/ui/button", () => ({ Button: (props: any) => createElement("button", props, props.children) }));
  vi.doMock("@/components/ui/popover", () => ui(["Popover", "PopoverContent", "PopoverTrigger"]));
  vi.doMock("@/components/ui/dialog", () => ui(["Dialog", "DialogContent", "DialogDescription", "DialogFooter", "DialogHeader", "DialogTitle"]));
  vi.doMock("@/components/ui/sheet", () => ui(["Sheet", "SheetContent", "SheetDescription", "SheetTitle", "SheetTrigger"]));
});

beforeEach(async () => {
  location = new URL("https://isolated.invalid/operations-center?branchIds=medina,abha_airport&workspace=people");
  events = new EventTarget();
  reads = []; historyEvents = [];
  branchWait = undefined; freshIds = branches.map(branch => branch.id); permissionGranted = true; sourceStatus = "pending";
  const stack = [location.href];
  let index = 0;
  history = {
    state: null,
    // Do not dispatch here: Wouter patches these methods and dispatches its
    // real replaceState/pushState events when it first imports below.
    replaceState(state: unknown, _title: string, href: string) {
      history.state = state; location.href = new URL(href, location.href).href; stack[index] = location.href;
    },
    pushState(state: unknown, _title: string, href: string) {
      history.state = state; location.href = new URL(href, location.href).href;
      stack.splice(++index); stack.push(location.href);
    },
    back() {
      if (index > 0) { location.href = stack[--index]; events.dispatchEvent(new Event("popstate")); }
    },
  };
  const window = {
    location, history,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  };
  vi.stubGlobal("window", window);
  vi.stubGlobal("location", location);
  vi.stubGlobal("history", history);
  vi.stubGlobal("addEventListener", window.addEventListener);
  vi.stubGlobal("removeEventListener", window.removeEventListener);
  vi.stubGlobal("dispatchEvent", window.dispatchEvent);
  for (const type of ["replaceState", "pushState", "popstate"]) events.addEventListener(type, () => {
    historyEvents.push({ type, href: location.pathname + location.search });
  });
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    if (init?.method && init.method !== "GET") throw new Error("Unexpected business write");
    const url = new URL(input, location.href);
    reads.push(url.pathname + url.search);
    if (url.pathname === "/api/branches") {
      if (branchWait) await branchWait;
      return Response.json(branches.filter(branch => freshIds.includes(branch.id)));
    }
    if (url.pathname === "/api/my-permissions") return Response.json((permissionGranted ? ["operations", "hr_leaves"] : ["operations"])
      .map(module => ({ module, actions: ["view"] })));
    if (url.pathname === "/api/hr/leaves") return Response.json([{ id: 42, branchId: "medina", status: sourceStatus }]);
    if (url.pathname === "/api/operations-center/notifications") return Response.json([]);
    if (url.pathname === "/api/operations-center") return Response.json({
      scope: { branchIds: branches.map(branch => branch.id) }, branches,
    });
    if (url.pathname === "/api/operations-center/people") {
      const ids = url.searchParams.get("branchIds")!.split(",");
      const source = url.searchParams.get("source") as OperationsPeopleResponse["scope"]["source"];
      return Response.json({
        generatedAt: "2026-10-01T10:00:00Z", businessDate: "2026-10-01",
        scope: { branchIds: ids, requested: ids, source, offset: Number(url.searchParams.get("offset")), limit: 30 },
        branches: branches.filter(branch => ids.includes(branch.id)),
        records: ids.includes("medina") && ["all", "leaves"].includes(source) ? [leave] : [],
        summaries: [], employees: { value: 1, active: 1, coverage: "complete", definition: "موظفو النطاق" }, tools: [],
        coverage: { total: 1, nextOffset: null, sources: Object.fromEntries(
          ["leaves", "advances", "attendance", "joining", "leave_movements"].map(key => [key, { state: "complete", reason: null }])) },
      });
    }
    throw new Error(`Unexpected read: ${url.pathname}`);
  }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  // Keep a real Wouter subscription/History navigation for all test cases.
  // Its module is cached after the first import, so patch new test histories
  // with the first import's same event semantics on subsequent cases.
  const alreadyImported = !!Center;
  Center = (await import("../client/src/pages/operations-center")).default;
  const { useLocation } = await import("wouter");
  if (alreadyImported) for (const type of ["replaceState", "pushState"] as const) {
    const original = history[type];
    history[type] = (...args: unknown[]) => { original(...args); events.dispatchEvent(new Event(type)); };
  }
  App = () => {
    const [path] = useLocation();
    return path === "/operations-center" ? createElement(Center) : createElement("source", { "data-testid": "actual-source" }, path);
  };
});

afterEach(async () => {
  if (root) await renderer.act(async () => root.unmount());
  root = undefined; client.clear();
});
afterAll(() => vi.unstubAllGlobals());
const settle = () => renderer.act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
const text = (node: any): string => typeof node === "string" ? node : (node.children || []).map(text).join(" ");
const branchSelect = () => root.root.findByProps({ "aria-label": "فرع متابعة الموظفين" });
const caseButton = () => root.root.findAllByType("button").find((node: any) => node.props.className === "oc-list-item oc-people-case");
const readButton = () => root.root.findAllByType("button").find((node: any) => text(node).includes("فتح السجل للمتابعة في المصدر"));
async function mountSelected() {
  await renderer.act(async () => {
    root = renderer.create(createElement(QueryClientProvider, { client }, createElement(App)));
  });
  await vi.waitFor(async () => { await settle(); expect(caseButton()).toBeDefined(); expect(client.isFetching()).toBe(0); });
  await renderer.act(async () => branchSelect().props.onChange({ target: { value: "medina" } }));
  await vi.waitFor(async () => { await settle(); expect(caseButton()).toBeDefined(); expect(client.isFetching()).toBe(0); });
  await renderer.act(async () => caseButton().props.onClick());
  expect(readButton()).toBeDefined();
}

describe("operations-manager People source click through real history events", () => {
  it("keeps local selection during fresh branch preflight, then replaces exact Back intent before pushing the source", async () => {
    await mountSelected();
    reads.length = 0;
    let release!: () => void;
    branchWait = new Promise(resolve => { release = resolve; });
    await renderer.act(async () => readButton().props.onClick());
    await settle();
    expect(reads).toEqual(["/api/branches"]);
    expect(client.getQueryState(["/api/branches"])?.fetchStatus).toBe("idle");
    expect(branchSelect().props.value).toBe("medina");
    expect(caseButton().props["data-active"]).toBe(true);
    expect(readButton()).toBeDefined();
    await renderer.act(async () => { release(); await new Promise(resolve => setTimeout(resolve, 10)); });
    await vi.waitFor(async () => { await settle(); expect(location.pathname).toBe("/hr/leaves"); });
    expect(reads).toEqual(["/api/branches", "/api/my-permissions", "/api/hr/leaves?branchId=medina"]);
    expect(historyEvents.map(event => event.type)).toEqual(["replaceState", "pushState"]);
    const back = new URL(historyEvents[0].href, location.origin);
    expect(back.searchParams.get("branchIds")).toBe("medina,abha_airport");
    expect(back.searchParams.get("workspace")).toBe("people");
    expect(back.searchParams.get("peopleBranchId")).toBe("medina");
    expect(back.searchParams.get("peopleRecord")).toBe("leave:42");
    expect(location.searchParams.get("leaveId")).toBe("42");
    expect(root.root.findByProps({ "data-testid": "actual-source" })).toBeDefined();
    branchWait = undefined;
    await renderer.act(async () => history.back());
    await vi.waitFor(async () => { await settle(); expect(caseButton()?.props["data-active"]).toBe(true); });
    expect(branchSelect().props.value).toBe("medina");
    expect(location.searchParams.get("peopleRecord")).toBe("leave:42");
  });

  it.each(["branch", "permission", "record"])("fails closed without navigating on fresh %s denial", async denial => {
    await mountSelected();
    if (denial === "branch") freshIds = ["abha_airport"];
    if (denial === "permission") permissionGranted = false;
    if (denial === "record") sourceStatus = "approved";
    await renderer.act(async () => readButton().props.onClick());
    await vi.waitFor(async () => {
      await settle(); expect(text(root.root)).toContain(denial === "branch"
        ? "تغير نطاق صلاحيات الفروع" : "رابط المصدر غير صالح أو تغيّر السجل أو صلاحية الوصول");
    });
    expect(location.pathname).toBe("/operations-center");
    expect(historyEvents).toEqual([]);
    if (denial === "branch") {
      expect(caseButton()).toBeUndefined();
      expect(readButton()).toBeUndefined();
      expect(text(root.root)).not.toContain("صاحب طلب المدينة");
    } else {
      expect(branchSelect().props.value).toBe("medina");
      expect(caseButton().props["data-active"]).toBe(true);
    }
  });

  it("still drops a click when an independent canonical branch refresh hides and unmounts its workspace", async () => {
    await mountSelected();
    reads.length = 0;
    let release!: () => void;
    branchWait = new Promise(resolve => { release = resolve; });
    await renderer.act(async () => readButton().props.onClick());
    let refresh!: Promise<void>;
    await renderer.act(async () => {
      refresh = client.refetchQueries({ queryKey: ["/api/branches"] });
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    expect(client.getQueryState(["/api/branches"])?.fetchStatus).toBe("fetching");
    expect(readButton()).toBeUndefined();
    expect(text(root.root)).not.toContain("صاحب طلب المدينة");
    await renderer.act(async () => { release(); await refresh; });
    await settle();
    expect(reads.filter(read => read === "/api/my-permissions")).toEqual([]);
    expect(reads.filter(read => read.startsWith("/api/hr/leaves"))).toEqual([]);
    expect(historyEvents).toEqual([]);
    expect(location.pathname).toBe("/operations-center");
    expect(text(root.root)).not.toContain("رابط المصدر غير صالح أو تغيّر السجل أو صلاحية الوصول");
  });

  it("does not reopen a local A→B→A selection after a delayed independent branch preflight", async () => {
    await mountSelected();
    reads.length = 0;
    let release!: () => void;
    branchWait = new Promise(resolve => { release = resolve; });
    await renderer.act(async () => readButton().props.onClick());
    await renderer.act(async () => {
      const change = branchSelect().props.onChange;
      change({ target: { value: "abha_airport" } });
      change({ target: { value: "medina" } });
    });
    await renderer.act(async () => release());
    await settle();
    expect(reads.filter(read => read === "/api/my-permissions")).toEqual([]);
    expect(reads.filter(read => read.startsWith("/api/hr/leaves"))).toEqual([]);
    expect(historyEvents).toEqual([]);
    expect(location.pathname).toBe("/operations-center");
    expect(branchSelect().props.value).toBe("medina");
    expect(text(root.root)).not.toContain("رابط المصدر غير صالح أو تغيّر السجل أو صلاحية الوصول");
  });
});