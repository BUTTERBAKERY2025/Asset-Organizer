import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HttpError } from "../client/src/lib/queryClient";

let viewAllowed = true;
let editAllowed = true;
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    canView: () => viewAllowed,
    canEdit: () => editAllowed,
    isLoading: false,
  }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "employee" } }) }));
vi.mock("@/components/layout", () => ({ Layout: ({ children }: { children: React.ReactNode }) => children }));

import { FinishedGoodsWorkspace } from "../client/src/pages/finished-goods-inventory";
import { BranchBarHandoffs } from "../client/src/components/branch-bar-handoffs";

const lot = {
  id: 89, branchId: "b1", productId: 123, productName: "PRIVATE_LOT",
  productionDate: "2026-05-01", quantity: 12, reservedQuantity: 3, unit: "قطعة",
};
const transfer = {
  id: 55, sourceBranchId: "b2", destinationBranchId: "b1", productId: 123,
  productName: "PRIVATE_TRANSFER", transportPolicy: "branch_receipt", status: "in_transit",
  quantity: 4, unit: "قطعة",
};
const handoff = {
  id: 92, productId: 123, productName: "PRIVATE_HANDOFF", status: "pending",
  quantity: 2, unit: "قطعة", productionDate: "2026-05-01",
};

function cachedClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["/api/finished-goods-inventory", "b1", "", ""], [lot]);
  client.setQueryData(["/api/finished-goods-transfers", "b1"], [transfer]);
  client.setQueryData(["/api/branch-bar-handoffs", "b1"], {
    handoffs: [handoff],
    balances: [{ id: 13, productId: 123, productionDate: "2026-05-01", quantity: 8, quarantineQuantity: 0, unit: "قطعة" }],
  });
  client.setQueryData(["/api/products"], [{ id: 123, name: "PRIVATE_LOT", isActive: true }]);
  client.setQueryData(["/api/branches"], [{ id: "b1", name: "Branch" }]);
  return client;
}

function failCachedQuery(client: QueryClient, key: unknown[], status = 403) {
  const query = client.getQueryCache().find({ queryKey: key });
  if (!query) throw new Error("Expected cached query");
  // React Query deliberately retains data on a failed refetch.
  query.setState({ ...query.state, status: "error", fetchStatus: "idle", error: new HttpError(status, "revoked") });
  expect(query.state.data).toBeDefined();
}

function renderWorkspace(client: QueryClient) {
  return renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
    React.createElement(FinishedGoodsWorkspace, { embedded: true, initialBranchId: "b1", productIds: [123] })));
}

afterEach(() => { viewAllowed = true; editAllowed = true; });

describe("finished goods cached data revocation", () => {
  it("suppresses lots, handoffs and receipts on inventory 403 despite retained cached data", () => {
    const client = cachedClient();
    expect(renderWorkspace(client)).toContain("PRIVATE_LOT");
    failCachedQuery(client, ["/api/finished-goods-inventory", "b1", "", ""]);
    const html = renderWorkspace(client);
    expect(html).not.toContain("PRIVATE_LOT");
    expect(html).not.toContain("PRIVATE_HANDOFF");
    expect(html).not.toContain("PRIVATE_TRANSFER");
    expect(html).not.toContain("حجز للبار");
  });

  it("suppresses all workspace data on transfers 403 and hides scoped receipts on other transfer errors", () => {
    const client = cachedClient();
    failCachedQuery(client, ["/api/finished-goods-transfers", "b1"]);
    expect(renderWorkspace(client)).not.toContain("PRIVATE_LOT");
    expect(renderWorkspace(client)).not.toContain("PRIVATE_TRANSFER");
    failCachedQuery(client, ["/api/finished-goods-transfers", "b1"], 500);
    const html = renderWorkspace(client);
    expect(html).toContain("PRIVATE_LOT");
    expect(html).not.toContain("PRIVATE_TRANSFER");
  });

  it("hides all production data if live permission to view is removed", () => {
    const client = cachedClient();
    viewAllowed = false;
    const html = renderWorkspace(client);
    expect(html).not.toContain("PRIVATE_LOT");
    expect(html).not.toContain("PRIVATE_HANDOFF");
    expect(html).not.toContain("PRIVATE_TRANSFER");
  });

  it("hides handoff rows, balances and actions when its refetch fails", () => {
    const client = cachedClient();
    failCachedQuery(client, ["/api/branch-bar-handoffs", "b1"]);
    const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
      React.createElement(BranchBarHandoffs, { branchId: "b1", canEdit: true, onChanged: () => {} })));
    expect(html).not.toContain("PRIVATE_HANDOFF");
    expect(html).not.toContain("صالح مستلم 8");
    expect(html).not.toContain("توثيق خروج الكمية");
    expect(html).toContain("لم يعد الوصول");
    expect(renderWorkspace(client)).not.toContain("PRIVATE_LOT");
  });

  it("hides cached history and other workspace data after history 403", () => {
    const client = cachedClient();
    client.setQueryData(["/api/production-inventory-logs", "b1"], [{ id: 1, productName: "PRIVATE_HISTORY" }]);
    failCachedQuery(client, ["/api/production-inventory-logs", "b1"]);
    const html = renderWorkspace(client);
    expect(html).not.toContain("PRIVATE_LOT");
    expect(html).not.toContain("PRIVATE_HANDOFF");
    expect(html).not.toContain("PRIVATE_HISTORY");
  });

  it("hides action controls but not authorized data when edit permission is removed", () => {
    const client = cachedClient();
    editAllowed = false;
    const html = renderWorkspace(client);
    expect(html).toContain("PRIVATE_LOT");
    expect(html).not.toContain("حجز للبار");
    expect(html).not.toContain("توثيق خروج الكمية");
  });
});