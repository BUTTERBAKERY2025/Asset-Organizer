import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ModuleKind, transpileModule } from "typescript";

// Evaluate the real page helpers without importing the full browser-only Layout
// (the Node Vitest config cannot load its static image asset).
const page = readFileSync("client/src/pages/central-kitchen-orders.tsx", "utf8");
const helpers = page.slice(page.indexOf("export function kitchenDetailAccess("), page.indexOf("export default function CentralKitchenOrdersPage()"));
const compiled = transpileModule(helpers.replaceAll("export function", "function"), {
  compilerOptions: { module: ModuleKind.None },
}).outputText;
const { kitchenDetailAccess, visibleKitchenDetail, kitchenProductionScoped } = new Function(`${compiled}; return { kitchenDetailAccess, visibleKitchenDetail, kitchenProductionScoped };`)() as {
  kitchenDetailAccess: (order: { centralKitchenId: string; allowedActions?: Record<string, boolean> }, permissions: {
    approve: boolean; edit: boolean; production: boolean; kitchenBranch: boolean;
  }) => Record<string, boolean>;
  visibleKitchenDetail: (order: { id: number } | undefined, id: number | null, denied: boolean) => { id: number } | undefined;
  kitchenProductionScoped: (access: boolean, journey: { orderId: number; sections: { production: boolean } } | undefined, id: number, failed: boolean) => boolean;
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
  it.each([
    ["viewer", { approve: false, edit: false, production: false, kitchenBranch: false }, {}, []],
    ["requester", { approve: false, edit: true, production: false, kitchenBranch: false }, { receive: true, edit: true }, ["receive", "change"]],
    ["production", { approve: true, edit: true, production: true, kitchenBranch: true }, { approve: true, prepare: true, dispatch: true }, ["approve", "prepare", "dispatch", "production"]],
    ["admin outside kitchen branch", { approve: true, edit: true, production: true, kitchenBranch: false }, { approve: true, prepare: true, dispatch: true, receive: true, resolveDiscrepancy: true, edit: true, cancel: true }, ["approve", "prepare", "dispatch", "receive", "resolveDiscrepancy", "change"]],
  ] as const)("%s respects both permissions and server action flags", (_role, permissions, actions, expected) => {
    const access = kitchenDetailAccess({ ...order, allowedActions: actions }, permissions);
    expect(Object.entries(access).filter(([, permitted]) => permitted).map(([key]) => key)).toEqual(expected);
  });

  it("never treats a module permission alone as authority for a lifecycle action", () => {
    expect(kitchenDetailAccess({ ...order, allowedActions: {} }, {
      approve: true, edit: true, production: false, kitchenBranch: true,
    })).toEqual({
      approve: false, prepare: false, dispatch: false, receive: false,
      resolveDiscrepancy: false, change: false, production: false,
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