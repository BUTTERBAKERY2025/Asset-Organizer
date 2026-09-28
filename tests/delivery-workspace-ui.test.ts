import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Delivery } from "../client/src/pages/driver-deliveries";
import { deliveryDraftChanged } from "../client/src/components/delivery/delivery-ui";

const fixture = vi.hoisted(() => ({
  tab: "tasks" as "tasks" | "reports",
  caps: { canAssign: false, canReport: false, canExport: false },
  capsError: false,
  capsFetching: false,
  reportError: false,
  queries: [] as { key: unknown[]; enabled: unknown }[],
}));

vi.mock("react", async importOriginal => {
  const react = await importOriginal<typeof import("react")>();
  return { ...react, useState: (initial: unknown) => react.useState(initial === "tasks" ? fixture.tab : initial) };
});
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn(), removeQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQuery: (options: { queryKey: unknown[]; enabled?: boolean }) => {
    fixture.queries.push({ key: options.queryKey, enabled: options.enabled });
    const key = options.queryKey[0];
    const data = key === "/api/deliveries/capabilities" ? fixture.caps
      : key === "/api/deliveries" ? { deliveries: [] }
      : typeof key === "string" && key.startsWith("/api/deliveries/reports?")
        ? { deliveries: [], summary: { total: 0 } } : undefined;
    const isError = key === "/api/deliveries/capabilities" ? fixture.capsError
      : typeof key === "string" && key.startsWith("/api/deliveries/reports?") && fixture.reportError;
    return { data, isError, isSuccess: !isError && data !== undefined, isFetching: key === "/api/deliveries/capabilities" && fixture.capsFetching, isLoading: false, refetch: vi.fn() };
  },
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ canView: () => false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/dashboard/page-header", () => ({ PageHeader: () => null }));
vi.mock("@/components/layout", () => ({ Layout: ({ children }: { children: unknown }) => children }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: vi.fn() }));

import { DeliveryActionBar, DeliveryWorkspace, ExternalMaterialNextAction, startExternalMaterialDelivery } from "../client/src/pages/driver-deliveries";

const render = () => {
  const previousWindow = globalThis.window;
  Object.assign(globalThis, { window: { location: { search: "" } } });
  try { return renderToStaticMarkup(createElement(DeliveryWorkspace)); }
  finally { Object.assign(globalThis, { window: previousWindow }); }
};
const reportEnabled = () => fixture.queries.find(query =>
  typeof query.key[0] === "string" && query.key[0].startsWith("/api/deliveries/reports?"))?.enabled;

describe("delivery workspace permissions (synthetic read-only fixture)", () => {
  beforeEach(() => {
    fixture.tab = "tasks";
    fixture.caps = { canAssign: false, canReport: false, canExport: false };
    fixture.capsError = false;
    fixture.capsFetching = false;
    fixture.reportError = false;
    fixture.queries.length = 0;
  });

  it("keeps the driver's report and assignment actions hidden even if reports was selected earlier", () => {
    fixture.tab = "reports";
    const html = render();
    expect(html).not.toContain("إسناد توصيل");
    expect(html).not.toContain("التقارير");
    expect(html).not.toContain("تصدير CSV");
    expect(reportEnabled()).toBe(false);
  });

  it("keeps the order-scoped embedded receipt workspace independent of standalone role navigation", () => {
    const html = renderToStaticMarkup(createElement(DeliveryWorkspace, {
      embedded: true, sourceType: "kitchen", sourceId: 42,
    }));
    expect(html).toContain("توصيل الطلب");
    expect(html).not.toContain("بوابة التوصيل");
    expect(fixture.queries.find(query => query.key[0] === "/api/deliveries")?.enabled).toBe(true);
  });

  it("shows the manager's report tab, but never exports without export capability", () => {
    fixture.caps = { canAssign: true, canReport: true, canExport: false };
    fixture.tab = "reports";
    const html = render();
    expect(html).toContain("التقارير");
    expect(html).toContain("إسناد توصيل");
    expect(html).not.toContain("تصدير CSV");
    expect(reportEnabled()).toBe(true);
  });

  it("hides cached reports and controls when capabilities fail or are rechecking", () => {
    fixture.caps = { canAssign: true, canReport: true, canExport: true };
    fixture.tab = "reports";
    for (const state of ["error", "refresh"] as const) {
      fixture.queries.length = 0;
      fixture.capsError = state === "error";
      fixture.capsFetching = state === "refresh";
      const html = render();
      expect(html).not.toContain("التقارير");
      expect(html).not.toContain("تصدير CSV");
      expect(html).not.toContain("إسناد توصيل");
      expect(reportEnabled()).toBe(false);
    }
  });

  it("retains report filters and retry but hides cached report output on report failure", () => {
    fixture.caps = { canAssign: true, canReport: true, canExport: true };
    fixture.tab = "reports";
    fixture.reportError = true;
    const html = render();
    expect(html).toContain("تعذر تحميل التقرير");
    expect(html).toContain("إعادة المحاولة");
    expect(html).not.toContain("تصدير CSV");
  });

  it("keeps recipient receipt approval independent of driver start/finish and source navigation", () => {
    const delivery = { id: 17, capabilities: { canApproveReceipt: true, canStart: false, canComplete: false } } as Delivery;
    const html = renderToStaticMarkup(createElement(DeliveryActionBar, { delivery, pending: false, onAction: vi.fn() }));
    expect(html).toContain("اعتماد إيصال المصدر");
    expect(html).not.toContain("بدء التوصيل");
    expect(html).not.toContain("إنهاء المهمة");
    expect(html).not.toContain("central-kitchen-orders");
  });

  it("shows already-dispatched carrier tracking to source editors without assignment-create rights", () => {
    const delivery = { id: 4, sourceId: 5, sourceType: "material_transfer", transportMode: "external",
      status: "assigned", sourceStatus: "in_transit", handoverRecordedAt: "2026-09-01T10:00:00Z",
      capabilities: { canStart: true, canDispatchSource: false } } as Delivery;
    fixture.caps.canAssign = false;
    const html = renderToStaticMarkup(createElement(ExternalMaterialNextAction, {
      delivery, pending: false, onStart: vi.fn(), onDispatch: vi.fn(),
    }));
    expect(html).toContain("بدء متابعة الناقل");
    expect(html).not.toContain("إرسال الشحنة");
    expect(renderToStaticMarkup(createElement(ExternalMaterialNextAction, {
      delivery: { ...delivery, capabilities: { ...delivery.capabilities, canStart: false } },
      pending: false, onStart: vi.fn(), onDispatch: vi.fn(),
    }))).not.toContain("بدء متابعة الناقل");
  });

  it("does not repeat stock dispatch when the same delivery is already in transit", async () => {
    const delivery = { id: 4, sourceId: 5, sourceType: "material_transfer", transportMode: "external",
      status: "assigned", sourceStatus: "in_transit", handoverRecordedAt: "2026-09-01T10:00:00Z",
      capabilities: { canStart: true, canDispatchSource: false } } as Delivery;
    const read = vi.fn().mockResolvedValue(delivery);
    const dispatch = vi.fn();
    const start = vi.fn().mockResolvedValue({ ...delivery, status: "awaiting_receipt" });
    const attempted = vi.fn();
    expect((await startExternalMaterialDelivery(delivery, read, dispatch, start, attempted)).status).toBe("awaiting_receipt");
    expect(read).toHaveBeenCalledOnce();
    expect(dispatch).not.toHaveBeenCalled();
    expect(attempted).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledOnce();
  });

  it("dispatches approved source only with its edit-derived permission, then starts", async () => {
    const delivery = { id: 4, sourceId: 5, sourceType: "material_transfer", transportMode: "external",
      status: "assigned", sourceStatus: "approved", handoverRecordedAt: "2026-09-01T10:00:00Z",
      capabilities: { canStart: false, canDispatchSource: true } } as Delivery;
    const read = vi.fn().mockResolvedValueOnce(delivery).mockResolvedValueOnce({
      ...delivery, sourceStatus: "in_transit", capabilities: { canStart: true, canDispatchSource: false },
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const start = vi.fn().mockResolvedValue({ ...delivery, status: "awaiting_receipt" });
    await startExternalMaterialDelivery(delivery, read, dispatch, start, vi.fn());
    expect(dispatch).toHaveBeenCalledExactlyOnceWith(5);
    expect(start).toHaveBeenCalledOnce();
    await expect(startExternalMaterialDelivery(delivery, async () => ({
      ...delivery, capabilities: { canStart: false, canDispatchSource: false },
    }), dispatch, start, vi.fn()))
      .rejects.toThrow("صلاحية إرسال المصدر");
    expect(dispatch).toHaveBeenCalledOnce();
  });

  it("invalidates delivery drafts after reassignment or replacement proof, not ordinary refresh", () => {
    const old = { id: 17, driverId: "old-driver", proofAt: "2026-01-01T10:00:00Z" };
    expect(deliveryDraftChanged(old, { ...old })).toBe(false);
    expect(deliveryDraftChanged(old, { ...old, driverId: "new-driver", proofAt: null })).toBe(true);
    expect(deliveryDraftChanged(old, { ...old, proofAt: "2026-01-01T11:00:00Z" })).toBe(true);
    expect(deliveryDraftChanged(old, { ...old, id: 18 })).toBe(true);
  });
});