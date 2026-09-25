import { describe, expect, it, vi } from "vitest";

vi.mock("../client/src/lib/queryClient", () => ({ apiRequest: vi.fn(), getQueryFn: vi.fn() }));
vi.mock("../client/src/components/layout", () => ({ Layout: ({ children }: { children: unknown }) => children }));

import { requestChangePayload, requestChangeVersion, requestChangeVersionMatches } from "../client/src/pages/central-kitchen-orders";

describe("request change draft version", () => {
  const initial = {
    id: 42,
    events: [{ id: 5, toStatus: "requested", createdAt: "2026-01-01" }],
    items: [{ id: 10, productName: "Bread", unit: "قطعة", requestedQuantity: 4 }],
  };

  it("rejects newer events and another order, without accepting an old draft under a fresh version", () => {
    const captured = requestChangeVersion(initial);
    expect(requestChangeVersionMatches(captured, { ...initial, events: [...initial.events, { id: 7, toStatus: "requested", createdAt: "2026-01-02" }] })).toBe(false);
    expect(requestChangeVersionMatches(captured, { ...initial, id: 43 })).toBe(false);
    expect(requestChangeVersionMatches(captured, { ...initial, events: [...initial.events, { id: 3, toStatus: "requested", createdAt: "2025-12-31" }] })).toBe(true);
  });

  it("builds edit and cancel payloads from the captured draft, never refreshed props", () => {
    const refreshed = { ...initial, events: [...initial.events, { id: 7, toStatus: "requested", createdAt: "2026-01-02" }], items: [{ ...initial.items[0], id: 11 }] };
    const values = { reason: " revised ", date: "2026-11-20", time: "12:00", notes: "note", quantities: ["6"], reportedAvailable: ["2"] };
    expect(requestChangePayload(initial, values, true)).toEqual({
      expectedEventId: 5, reason: "revised",
      edit: { neededDate: "2026-11-20", neededTime: "12:00", notes: "note", items: [{ itemId: 10, requestedQuantity: 6, reportedAvailableQuantity: 2 }] },
    });
    expect(requestChangePayload(initial, values, false)).toEqual({ expectedEventId: 5, reason: "revised" });
    expect(requestChangePayload(refreshed, values, false).expectedEventId).toBe(7);
  });
});