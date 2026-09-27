import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canView: vi.fn(() => false),
  canEdit: vi.fn(() => false),
  canApprove: vi.fn(() => false),
  useQuery: vi.fn(),
  removeQueries: vi.fn(),
  exceptions: vi.fn(() => ({ data: undefined })),
  requirements: vi.fn(() => ({ isLoading: true, isFetching: false, isError: false, data: undefined })),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ canView: mocks.canView, canEdit: mocks.canEdit, canApprove: mocks.canApprove }),
}));
vi.mock("@tanstack/react-query", async importOriginal => ({
  ...await importOriginal<typeof import("@tanstack/react-query")>(),
  useQuery: mocks.useQuery,
  useQueryClient: () => ({ removeQueries: mocks.removeQueries, invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/components/central-kitchen/recipe-materials", () => ({
  useRecipeMaterialRequirements: mocks.requirements,
  RecipeMaterialsPreview: () => null,
}));
vi.mock("@/components/central-kitchen/recipe-exceptions", () => ({
  useOrderRecipeExceptions: mocks.exceptions,
  RecipeExceptions: () => null,
}));
vi.mock("@/components/central-kitchen/use-visual-viewport-dialog", () => ({
  useVisualViewportDialog: () => ({}),
}));

import { LinkedBatches } from "../client/src/components/central-kitchen/linked-batches";
import { OrderJourney } from "../client/src/components/central-kitchen/order-journey";

beforeEach(() => vi.stubGlobal("React", React));

const batch = { id: 24, orderItemId: 3, quantity: 2, productionDate: null, status: "in_progress" };
const renderBatches = (productionVisible?: boolean, kitchenAccessible = true) =>
  renderToStaticMarkup(createElement(LinkedBatches, { batches: [batch], orderId: 5, kitchenAccessible, productionVisible }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("optional kitchen production detail", () => {
  it("does not mount a materials query or request exceptions without module and journey scope", () => {
    mocks.canView.mockReturnValue(false);
    expect(renderBatches(true)).not.toContain("دفعة #24");
    expect(mocks.exceptions).toHaveBeenCalledWith(5, false);
    expect(mocks.requirements).not.toHaveBeenCalled();

    mocks.exceptions.mockClear();
    mocks.canView.mockReturnValue(true);
    expect(renderBatches(false)).not.toContain("دفعة #24");
    expect(mocks.exceptions).toHaveBeenCalledWith(5, false);
    expect(mocks.requirements).not.toHaveBeenCalled();

    mocks.exceptions.mockClear();
    expect(renderBatches(true, false)).not.toContain("دفعة #24");
    expect(mocks.exceptions).toHaveBeenCalledWith(5, false);
    expect(mocks.requirements).not.toHaveBeenCalled();
    expect(renderBatches(true, true)).toContain("دفعة #24");
    expect(mocks.requirements).toHaveBeenCalledWith({ batchId: 24 });
  });
});

describe("optional order journey", () => {
  it("hides optional workspaces when the section scope is restricted even with module grants", () => {
    mocks.canView.mockReturnValue(true);
    mocks.canApprove.mockReturnValue(true);
    mocks.useQuery.mockReturnValue({
      data: {
        orderId: 5, stages: [], warnings: [], delivery: null, inventoryMode: "real",
        sections: { production: false, delivery: true, inventory: true, bar: false },
        sectionState: { production: "restricted", delivery: "restricted", inventory: "restricted", bar: "restricted" },
      },
      isError: false, isFetching: false, isPending: false,
    });
    const html = renderToStaticMarkup(createElement(OrderJourney, { orderId: 5, status: "received", onChanged: vi.fn() }));
    expect(html).not.toContain("التوصيل · التكليف");
    expect(html).not.toContain("مخزون الفرع");
  });

  it("does not show cached stages or mount children after a denied refetch", () => {
    mocks.useQuery.mockReturnValue({
      data: { orderId: 5, stages: [{ key: "production", label: "SECRET STAGE", status: "complete", summary: "SECRET" }] },
      isError: true,
      isFetching: false,
      isPending: false,
      error: new Error("403"),
      refetch: vi.fn(),
    });
    const html = renderToStaticMarkup(createElement(OrderJourney, { orderId: 5, status: "approved", onChanged: vi.fn() }));
    expect(html).not.toContain("SECRET");
    expect(html).toContain("بنود الطلب");
    expect(html).not.toContain("التوصيل · التكليف");
  });

  it("rejects a base 403 instead of fabricating stages or disturbing shared query observers", async () => {
    mocks.useQuery.mockImplementation((options: { queryFn: () => Promise<unknown> }) => {
      // Capture the real fetch callback without running it during rendering.
      queryFn = options.queryFn;
      return { isPending: true };
    });
    let queryFn: () => Promise<unknown> = async () => null;
    renderToStaticMarkup(createElement(OrderJourney, { orderId: 5, status: "approved", onChanged: vi.fn() }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 403, ok: false }));
    await expect(queryFn()).rejects.toThrow("403");
    expect(mocks.removeQueries).not.toHaveBeenCalled();
  });
});