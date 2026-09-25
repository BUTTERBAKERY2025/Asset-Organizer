import { describe, expect, it } from "vitest";
import { HttpError } from "../client/src/lib/queryClient";
import {
  maintenanceCreatePayload,
  maintenanceDetailQueryKey,
  maintenanceOptionsQueryKey,
  maintenanceTicketErrorMessage,
  maintenanceTicketsListUrl,
  maintenanceTransitionPayload,
} from "../client/src/components/maintenance-tickets";

describe("maintenance tickets UI contract", () => {
  it("keeps the selected branch and active/overdue URL filters", () => {
    const url = new URL(maintenanceTicketsListUrl("branch riyadh", 2, "active", true), "https://example.test");
    expect(url.pathname).toBe("/api/maintenance-tickets");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      branchId: "branch riyadh",
      page: "2",
      status: "active",
      overdue: "true",
    });
  });

  it("keeps detail and options under the maintenance cache prefix and branch scope", () => {
    expect(maintenanceDetailQueryKey("b-2", 17)).toEqual(["/api/maintenance-tickets", "detail", "b-2", 17]);
    expect(maintenanceOptionsQueryKey("b-2")).toEqual(["/api/maintenance-tickets", "options", "b-2"]);
  });

  it("creates only the published create payload", () => {
    expect(maintenanceCreatePayload({
      branchId: "b-1",
      description: "  عطل في الفرن  ",
      priority: "high",
      assetId: "asset-7",
      assigneeUserId: "none",
      dueAt: "2026-03-20T09:00:00.000Z",
    })).toEqual({
      branchId: "b-1",
      description: "عطل في الفرن",
      priority: "high",
      assetId: "asset-7",
      assigneeUserId: null,
      dueAt: "2026-03-20T09:00:00.000Z",
    });
  });

  it("builds guarded assign, start, close, and reopen transitions", () => {
    expect(maintenanceTransitionPayload(3, "assign", "user-9")).toEqual({
      version: 3, action: "assign", assigneeUserId: "user-9",
    });
    expect(maintenanceTransitionPayload(4, "start")).toEqual({ version: 4, action: "start" });
    expect(maintenanceTransitionPayload(5, "close")).toEqual({ version: 5, action: "close" });
    expect(maintenanceTransitionPayload(6, "reopen", "", "  العطل مستمر  ")).toEqual({
      version: 6, action: "reopen", reason: "العطل مستمر",
    });
    expect(() => maintenanceTransitionPayload(3, "assign")).toThrow("assignee required");
    expect(() => maintenanceTransitionPayload(6, "reopen")).toThrow("reason required");
  });

  it("shows safe Arabic permission, conflict, missing, and generic errors", () => {
    expect(maintenanceTicketErrorMessage(new HttpError(403, "private"))).toContain("الصلاحية");
    expect(maintenanceTicketErrorMessage(new HttpError(409, "stale"))).toContain("مستخدم آخر");
    expect(maintenanceTicketErrorMessage(new HttpError(404, "gone"))).toContain("متاح");
    expect(maintenanceTicketErrorMessage(new Error("secret internal detail"))).toBe("تعذر إتمام الطلب. حاول مرة أخرى.");
  });
});