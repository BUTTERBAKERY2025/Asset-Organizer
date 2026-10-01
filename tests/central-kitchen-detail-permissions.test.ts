import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ModuleKind, transpileModule } from "typescript";

// Evaluate the real page helpers without importing the full browser-only Layout
// (the Node Vitest config cannot load its static image asset).
const page = readFileSync("client/src/pages/central-kitchen-orders.tsx", "utf8");
const helpers = page.slice(page.indexOf("export function kitchenDetailAccess("), page.indexOf("export function visibleKitchenDetail("))
  + page.slice(page.indexOf("export function visibleKitchenDetail("), page.indexOf("export default function CentralKitchenOrdersPage()"));
const compiled = transpileModule(helpers.replaceAll("export function", "function").replaceAll("export const", "const"), {
  compilerOptions: { module: ModuleKind.None },
}).outputText;
const { kitchenDetailAccess, kitchenDetailMatchesBranch, visibleKitchenDetail, kitchenProductionScoped, kitchenActionHeading, kitchenOrderPreview, KITCHEN_DEFAULT_SORT } = new Function(`const STATUS = { approved: { label: "معتمد" } }; const normalized = (value) => value.toLowerCase(); ${compiled}; return { kitchenDetailAccess, kitchenDetailMatchesBranch, visibleKitchenDetail, kitchenProductionScoped, kitchenActionHeading, kitchenOrderPreview, KITCHEN_DEFAULT_SORT };`)() as {
  kitchenDetailMatchesBranch: (order: { requestBranchId: string; centralKitchenId: string }, branchId: string | null, role?: string) => boolean;
  kitchenDetailAccess: (order: { centralKitchenId: string; allowedActions?: Record<string, boolean> }, permissions: {
    approve: boolean; edit: boolean; production: boolean; kitchenBranch: boolean; sourceBranch: boolean;
  }) => Record<string, boolean>;
  visibleKitchenDetail: (order: { id: number } | undefined, id: number | null, denied: boolean) => { id: number } | undefined;
  kitchenProductionScoped: (access: boolean, journey: { orderId: number; sections: { production: boolean } } | undefined, id: number, failed: boolean) => boolean;
  kitchenActionHeading: (order: { status: string; allowedActions?: Record<string, boolean> }, access: Record<string, boolean>) => string;
  kitchenOrderPreview: (order: { items?: Array<{ productName: string; requestedQuantity: number; unit: string }>; requestBranchName: string; requestBranchId: string; centralKitchenName: string; centralKitchenId: string; status: string }) => { route: string; status: string; lines: string[] };
  KITCHEN_DEFAULT_SORT: string;
};

const order = {
  id: 42,
  centralKitchenId: "kitchen",
  allowedActions: {
    approve: true, prepare: true, dispatch: true, receive: true,
    resolveDiscrepancy: true, edit: true, cancel: true,
  },
};

describe("central kitchen detail permission intersection", () => {
  it("accepts supplier and requester deep links for authorized operators, but keeps branch managers destination-only", () => {
    const detail = { requestBranchId: "requester", centralKitchenId: "supplier" };
    for (const role of ["admin", "operations_manager", "production_development_manager"]) {
      expect(kitchenDetailMatchesBranch(detail, "supplier", role)).toBe(true);
      expect(kitchenDetailMatchesBranch(detail, "requester", role)).toBe(true);
      expect(kitchenDetailMatchesBranch(detail, "unrelated", role)).toBe(false);
      expect(kitchenDetailMatchesBranch(detail, null, role)).toBe(false);
    }
    expect(kitchenDetailMatchesBranch(detail, "supplier", "branch_manager")).toBe(false);
    expect(kitchenDetailMatchesBranch(detail, "requester", "branch_manager")).toBe(true);
    expect(page).toContain("!kitchenDetailMatchesBranch(detailQuery.data, linkedBranchId, user?.role)");
    expect(page).toContain('new URLSearchParams(window.location.search).getAll("branchId").length !== 1');
  });
  it.each([
    ["viewer", { approve: false, edit: false, production: false, kitchenBranch: false, sourceBranch: false }, {}, []],
    ["requester", { approve: false, edit: true, production: false, kitchenBranch: false, sourceBranch: true }, { receive: true, edit: true }, ["receive", "change"]],
    ["production", { approve: true, edit: true, production: true, kitchenBranch: true, sourceBranch: false }, { approve: true, prepare: true, dispatch: true }, ["approve", "prepare", "dispatch", "production"]],
    ["admin outside kitchen branch", { approve: true, edit: true, production: true, kitchenBranch: false, sourceBranch: true }, { approve: true, prepare: true, dispatch: true, receive: true, resolveDiscrepancy: true, edit: true, cancel: true }, ["approve", "prepare", "dispatch", "receive", "resolveDiscrepancy", "change"]],
  ] as const)("%s respects both permissions and server action flags", (_role, permissions, actions, expected) => {
    const access = kitchenDetailAccess({ ...order, allowedActions: actions }, permissions);
    expect(Object.entries(access).filter(([, permitted]) => permitted).map(([key]) => key)).toEqual(expected);
  });

  it("never treats a module permission alone as authority for a lifecycle action", () => {
    expect(kitchenDetailAccess({ ...order, allowedActions: {} }, {
      approve: true, edit: true, production: false, kitchenBranch: true, sourceBranch: true,
    })).toEqual({
      approve: false, prepare: false, dispatch: false, receive: false,
      resolveDiscrepancy: false, change: false, production: false,
    });
  });

  it("never grants source-branch actions based only on kitchen permissions", () => {
    const access = kitchenDetailAccess(order, { approve: true, edit: true, production: true, kitchenBranch: true, sourceBranch: false });
    expect(access.receive).toBe(false);
    expect(access.change).toBe(false);
    expect(access.resolveDiscrepancy).toBe(false);
  });

  it("shows neutral access for viewers and requesters waiting on kitchen, operational label only when permitted", () => {
    const approved = { status: "approved", allowedActions: { prepare: true } };
    expect(kitchenActionHeading(approved, kitchenDetailAccess({ ...order, allowedActions: approved.allowedActions }, { approve: false, edit: false, production: false, kitchenBranch: false, sourceBranch: true }))).toBe("الاطلاع على الطلب");
    expect(kitchenActionHeading(approved, kitchenDetailAccess({ ...order, allowedActions: {} }, { approve: false, edit: true, production: false, kitchenBranch: false, sourceBranch: true }))).toBe("الاطلاع على الطلب");
    expect(kitchenActionHeading(approved, kitchenDetailAccess({ ...order, allowedActions: approved.allowedActions }, { approve: true, edit: true, production: true, kitchenBranch: true, sourceBranch: false }))).toBe("تأكيد التجهيز");
  });

  it("defaults to newest and previews actual item quantities, units, route and status", () => {
    expect(KITCHEN_DEFAULT_SORT).toBe("newest");
    expect(kitchenOrderPreview({ status: "approved", requestBranchId: "b", requestBranchName: "فرع", centralKitchenId: "k", centralKitchenName: "مطبخ", items: [{ productName: "خبز", requestedQuantity: 2.5, unit: "كيلو" }] })).toEqual({
      route: "فرع ← مطبخ", status: "معتمد", lines: ["خبز: 2.5 كيلو"],
    });
  });

  it("clears previously loaded detail on denial or when selecting another order", () => {
    expect(visibleKitchenDetail(order, 42, false)).toBe(order);
    expect(visibleKitchenDetail(order, 42, true)).toBeUndefined();
    expect(visibleKitchenDetail(order, 43, false)).toBeUndefined();
    expect(visibleKitchenDetail(order, null, false)).toBeUndefined();
  });

  it("mounts production extras only when both branch permission and current server journey authorize them", () => {
    const scope = { orderId: 42, sections: { production: true } };
    expect(kitchenProductionScoped(true, scope, 42, false)).toBe(true);
    expect(kitchenProductionScoped(false, scope, 42, false)).toBe(false);
    expect(kitchenProductionScoped(true, { orderId: 42, sections: { production: false } }, 42, false)).toBe(false);
    expect(kitchenProductionScoped(true, scope, 43, false)).toBe(false);
    expect(kitchenProductionScoped(true, scope, 42, true)).toBe(false);
    expect(kitchenProductionScoped(true, undefined, 42, false)).toBe(false);
  });
});