import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { transpileModule, JsxEmit, ModuleKind } from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  query: vi.fn(),
  mutation: vi.fn(() => ({ isPending: false })),
}));
vi.mock("@tanstack/react-query", async importOriginal => ({
  ...await importOriginal<typeof import("@tanstack/react-query")>(),
  useQuery: hooks.query,
  useMutation: hooks.mutation,
  useQueryClient: () => ({}),
}));
vi.mock("../client/src/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
import { DemandCommitments } from "../client/src/components/central-kitchen/demand-commitments";

// Render the actual conditional JSX from OrderDetail, not a duplicate condition.
// This avoids exporting private production components just for a regression test.
const page = readFileSync("client/src/pages/central-kitchen-orders.tsx", "utf8");
const expression = page.match(/\{\["received", "cancelled"\]\.includes\(status\) && <DemandCommitments[^]*?\/>\}/)?.[0];
if (!expression) throw new Error("OrderDetail demand mount expression changed; review cancellation trigger");
const compiled = transpileModule(
  `function renderTrigger(status, section, order, canEdit) {
    return <div hidden={section !== "decisions"}>${expression}</div>;
  }`,
  { compilerOptions: { jsx: JsxEmit.React, module: ModuleKind.None } },
).outputText;
const renderTrigger = new Function("React", "DemandCommitments", `${compiled}; return renderTrigger;`)(
  React, DemandCommitments,
) as (status: string, section: string, order: object, canEdit: boolean) => React.ReactElement;

describe("post-cancellation demand query mount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // This Node-only config uses classic JSX; production Vite uses automatic JSX.
    vi.stubGlobal("React", React);
    // Explicit failed read: verifies inline error containment as well as hooks.
    hooks.query.mockReturnValue({ isLoading: false, isError: true, data: undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(["requested", "approved", "prepared", "dispatched"])(
    "%s does not mount demand queries",
    status => {
      renderToStaticMarkup(renderTrigger(status, "summary", { id: 123 }, true));
      expect(hooks.query).not.toHaveBeenCalled();
    },
  );

  it.each(["received", "cancelled"])(
    "%s mounts both reads even when Decisions is hidden",
    status => {
      expect(page).toContain('<div hidden={section !== "decisions"} className="space-y-4">');
      const html = renderToStaticMarkup(renderTrigger(status, "summary", {
        id: 123, centralKitchenId: "test kitchen", items: [],
      }, true));
      expect(html).toContain('hidden=""');
      expect(html).toContain('role="alert"');
      expect(hooks.query).toHaveBeenCalledTimes(2);
      expect(hooks.query.mock.calls.map(([options]) => options)).toEqual([
        {
          queryKey: ["/api/central-kitchen-demand?originalOrderId=123&pageSize=200"],
          retry: false,
        },
        {
          queryKey: ["/api/central-kitchen-orders/routing/candidates?branchId=test%20kitchen"],
          enabled: true,
          retry: false,
        },
      ]);
      // No user click and no mutation is executed by the render.
      expect(hooks.mutation).toHaveBeenCalledTimes(2);
    },
  );
});