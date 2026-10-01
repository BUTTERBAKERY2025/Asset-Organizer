import React, { createContext, createElement, useContext } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Isolated React rendering only: no browser, server, credentials, or business
// writes. react-test-renderer must match the application's React version.
const rendererPackage = "react-test-renderer";
let renderer: any;
let TransferRequestsPage: React.ComponentType;
let root: any;
let client: QueryClient;
let actor: { role: string; branchId: string | null };
let location: URL;
let events: EventTarget;
const toast = vi.fn();
const branches = [
  { id: "medina", name: "Medina", nameAr: "المدينة" },
  { id: "riyadh", name: "Riyadh", nameAr: "الرياض" },
];
const sourceTransfer = {
  id: 8, transferNumber: "SOURCE-8", status: "pending",
  sourceBranchId: "main_warehouse", sourceBranchName: "Main Warehouse",
  destinationBranchId: "medina", destinationBranchName: "Medina",
  transferDate: "2026-10-01", createdByName: "Source owner",
};
let fetchSource: typeof sourceTransfer;
let sourceStatus = 200;
let reads: string[];
let renders: number;

const ui = (names: string[]) => Object.fromEntries(names.map(name => [
  name, (props: any) => createElement(name.toLowerCase(), props, props.children),
]));

beforeAll(async () => {
  renderer = await import(rendererPackage);
  // The repository's node-test transform uses classic JSX.
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.doMock("@/hooks/useAuth", () => ({
    useAuth: () => ({ user: actor, isAdmin: actor.role === "admin", activeBranchId: "medina" }),
  }));
  vi.doMock("@/hooks/usePermissions", () => ({
    usePermissions: () => ({
      canView: () => true, canCreate: () => true, canEdit: () => true,
      canExport: () => false, isLoading: false,
    }),
  }));
  vi.doMock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
  vi.doMock("@/lib/queryClient", () => ({
    apiRequest: () => { throw new Error("Business writes are prohibited in this rendering test"); },
  }));
  vi.doMock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
  }));
  vi.doMock("react-to-print", () => ({ useReactToPrint: () => vi.fn() }));
  vi.doMock("@/components/layout", () => ui(["Layout"]));
  vi.doMock("@/components/dashboard/page-header", () => ({
    PageHeader: (props: any) => {
      // Fail a runaway passive-effect loop promptly instead of hanging CI.
      if (++renders > 60) throw new Error("Transfer source failed to settle after 60 renders");
      return createElement("page-header", props, props.actions);
    },
  }));
  vi.doMock("@/components/ui/card", () => ui(["Card", "CardContent", "CardDescription", "CardHeader", "CardTitle"]));
  vi.doMock("@/components/ui/button", () => ui(["Button"]));
  vi.doMock("@/components/ui/input", () => ui(["Input"]));
  vi.doMock("@/components/ui/label", () => ui(["Label"]));
  vi.doMock("@/components/ui/textarea", () => ui(["Textarea"]));
  vi.doMock("@/components/ui/badge", () => ui(["Badge"]));
  vi.doMock("@/components/ui/select", () => ui(["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"]));
  vi.doMock("@/components/ui/table", () => ui(["Table", "TableBody", "TableCell", "TableHead", "TableHeader", "TableRow"]));
  vi.doMock("@/components/ui/dropdown-menu", () => ui(["DropdownMenu", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuTrigger", "DropdownMenuSeparator"]));
  vi.doMock("@/components/ui/skeleton", () => ui(["Skeleton"]));
  const DialogContext = createContext(false);
  vi.doMock("@/components/ui/dialog", () => ({
    ...ui(["DialogDescription", "DialogFooter", "DialogHeader", "DialogTitle", "DialogTrigger"]),
    Dialog: (props: any) => createElement(DialogContext.Provider, { value: props.open },
      createElement("dialog", props, props.children)),
    DialogContent: (props: any) => useContext(DialogContext) ? createElement("dialog-content", props, props.children) : null,
  }));
  vi.doMock("@/components/signature-pad", () => ui(["SignaturePad", "SignatureDisplay"]));
  vi.doMock("@/components/export-buttons", () => ui(["ExportButtons"]));
  vi.doMock("@/components/branch-supply/sources", () => ui(["BranchSupplySources"]));
  vi.doMock("@/components/warehouse-entry/warehouse-item-entry", () => ui(["WarehouseItemEntry"]));
  vi.doMock("@/components/transfer-document", () => ui(["TransferDocument"]));
  vi.doMock("@/lib/pdf-utils", () => ({ generateTransferPdf: vi.fn(), generateQuickTransferPdf: vi.fn() }));
  vi.doMock("@/lib/transfer-export", () => ({ buildTransferListWorkbook: vi.fn(), buildTransferWorkbook: vi.fn() }));
});

beforeEach(async () => {
  actor = { role: "admin", branchId: null };
  fetchSource = { ...sourceTransfer };
  sourceStatus = 200;
  reads = [];
  renders = 0;
  toast.mockClear();
  location = new URL("https://isolated.invalid/transfer-requests?branchId=medina&transferId=8&status=approved&from=operations-center&tab=supply");
  events = new EventTarget();
  const history = {
    state: null,
    replaceState: (_state: unknown, _title: string, href: string) => {
      location.href = new URL(href, location.href).href;
      events.dispatchEvent(new Event("replaceState"));
    },
  };
  vi.stubGlobal("window", {
    location, history,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  });
  vi.stubGlobal("location", location);
  vi.stubGlobal("history", history);
  vi.stubGlobal("addEventListener", events.addEventListener.bind(events));
  vi.stubGlobal("removeEventListener", events.removeEventListener.bind(events));
  vi.stubGlobal("dispatchEvent", events.dispatchEvent.bind(events));
  vi.stubGlobal("PopStateEvent", Event);
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    if (init?.method && init.method !== "GET") throw new Error("Unexpected business write");
    const url = new URL(input, location.href);
    reads.push(url.pathname + url.search);
    if (url.pathname === "/api/branches") return new Response(JSON.stringify(branches));
    if (url.pathname === "/api/warehouse/items") return new Response("[]");
    if (url.pathname === "/api/warehouse/material-transfers/8") {
      return new Response(JSON.stringify({ transfer: fetchSource }), { status: sourceStatus });
    }
    if (url.pathname === "/api/warehouse/material-transfers/8/items") {
      return new Response(JSON.stringify([{ id: 12, transferId: 8, itemId: 4, itemName: "Source flour", quantity: 0.5, unit: "kg" }]));
    }
    if (url.pathname === "/api/warehouse/material-transfers") return new Response(JSON.stringify([fetchSource]));
    throw new Error(`Unexpected read: ${url.pathname}`);
  }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, structuralSharing: false } } });
  client.setQueryData(["/api/branches"], branches.map(branch => ({ ...branch })));
  TransferRequestsPage = (await import("../client/src/pages/transfer-requests")).default;
});

afterEach(async () => {
  if (root) await renderer.act(async () => root.unmount());
  root = undefined;
  client.clear();
});

afterAll(() => vi.unstubAllGlobals());

async function mount() {
  await renderer.act(async () => {
    root = renderer.create(createElement(QueryClientProvider, { client }, createElement(TransferRequestsPage)));
  });
  await vi.waitFor(async () => {
    await settle();
    expect(client.isFetching()).toBe(0);
    if (sourceStatus === 200) {
      expect(detail()).toBeDefined();
      expect(text(detail())).toContain("Source flour");
    } else {
      expect(toast).toHaveBeenCalled();
    }
  }, { timeout: 1000, interval: 5 });
}

async function settle() {
  await renderer.act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
}

function detail() {
  return root.root.findAllByType("dialog-content").find((content: any) =>
    text(content).includes("Transfer Request Details"));
}

function text(node: any): string {
  if (typeof node === "string") return node;
  return (node.children || []).map(text).join(" ");
}

describe("canonical transfer source render stability", () => {
  it.each(["admin", "production_development_manager", "operations_manager"])(
    "settles the authenticated %s scoped deep link and keeps the actual pending source, not the approved URL hint", async role => {
    actor = { role, branchId: null };
    await mount();
    expect(detail()).toBeDefined();
    expect(text(detail())).toContain("SOURCE-8");
    expect(text(detail())).toContain("Pending");
    expect(text(detail())).toContain("Source flour");
    expect(text(detail())).not.toContain("Approved");
    expect(reads.filter(read => read === "/api/warehouse/material-transfers/8")).toHaveLength(1);
    expect(new URLSearchParams(location.search).has("transferId")).toBe(false);
    expect(new URLSearchParams(location.search).get("from")).toBe("operations-center");
    expect(new URLSearchParams(location.search).get("tab")).toBe("supply");

    // Mirror authorization refreshes: useBranches copies its array each
    // render, and a query refresh can also replace every branch object.
    for (let i = 0; i < 4; i++) {
      await renderer.act(async () => {
        client.setQueryData(["/api/branches"], branches.map(branch => ({ ...branch })));
        root.update(createElement(QueryClientProvider, { client }, createElement(TransferRequestsPage)));
      });
      await settle();
      expect(text(detail())).toContain("Pending");
      expect(root.root.findAllByType("dialog").filter((dialog: any) => dialog.props.open)).toHaveLength(1);
    }
    expect(toast).not.toHaveBeenCalled();
    expect(renders).toBeLessThan(30);
  });

  it("settles single-branch initialization even when authorized row objects are refreshed", async () => {
    actor = { role: "employee", branchId: "medina" };
    client.setQueryData(["/api/branches"], [{ ...branches[0] }]);
    await mount();
    await renderer.act(async () => client.setQueryData(["/api/branches"], [{ ...branches[0] }]));
    await settle();
    expect(text(detail())).toContain("SOURCE-8");
    expect(text(detail())).toContain("Pending");
    expect(toast).not.toHaveBeenCalled();
  });

  it("keeps the selected live list row when details are closed and reopened after a source refresh", async () => {
    await mount();
    const dialog = root.root.findAllByType("dialog").find((node: any) => node.props.open);
    await renderer.act(async () => dialog.props.onOpenChange(false));
    fetchSource = { ...sourceTransfer, status: "in_transit" };
    await renderer.act(async () => { await client.invalidateQueries({ queryKey: ["/api/warehouse/material-transfers"] }); });
    await settle();
    const button = root.root.findAllByType("button").find((node: any) => node.props["data-testid"] === "btn-view-8");
    await renderer.act(async () => button.props.onClick());
    await settle();
    expect(text(detail())).toContain("In Transit");
    expect(text(detail())).not.toContain("Pending");
    expect(reads.filter(read => read === "/api/warehouse/material-transfers/8")).toHaveLength(1);
  });

  it("does not disclose or fall back to an unscoped row for a forbidden exact source", async () => {
    sourceStatus = 403;
    await mount();
    expect(detail()).toBeUndefined();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Unable to open transfer", variant: "destructive" }));
    expect(reads.filter(read => read === "/api/warehouse/material-transfers/8")).toHaveLength(1);
    expect(reads.filter(read => read.startsWith("/api/warehouse/material-transfers?")))
      .toEqual(expect.arrayContaining(["/api/warehouse/material-transfers?branchId=medina"]));
    expect(reads).not.toContain("/api/warehouse/material-transfers?");
  });
});