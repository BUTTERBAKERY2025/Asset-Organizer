import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { canOpenDeliverySource, DeliveryDetail, deliverySourcePath, deliveryTiming } from "../client/src/components/delivery/delivery-ui";
import type { Delivery } from "../client/src/pages/driver-deliveries";

const scheduled = Date.parse("2026-01-01T10:00:00Z");
const task = (status: Delivery["status"], scheduledAt: string | null = new Date(scheduled).toISOString()) =>
  ({ status, scheduledAt } as Delivery);

describe("delivery deadline indicators", () => {
  it("shows overdue at the deadline and escalation at exactly sixty minutes", () => {
    expect(deliveryTiming(task("assigned"), scheduled - 1)).toBe("on_time");
    expect(deliveryTiming(task("assigned"), scheduled)).toBe("overdue");
    expect(deliveryTiming(task("awaiting_receipt"), scheduled + 60 * 60_000 - 1)).toBe("overdue");
    expect(deliveryTiming(task("awaiting_receipt"), scheduled + 60 * 60_000)).toBe("escalated");
  });

  it("hides deadline warnings after receipt approval, completion and cancellation", () => {
    for (const status of ["receipt_approved", "completed", "cancelled"] as const)
      expect(deliveryTiming(task(status), scheduled + 90 * 60_000)).toBe("on_time");
    expect(deliveryTiming(task("in_transit", null), scheduled + 90 * 60_000)).toBe("on_time");
  });
});

describe("delivery source access and receipt evidence", () => {
  const delivery = {
    id: 6, sourceId: 12, sourceType: "kitchen", sourceStatus: "dispatched",
    status: "awaiting_receipt", scheduledAt: null, sourceBranchName: "Kitchen",
    destinationBranchName: "Branch", items: [], driverName: "Driver",
    vehicleNumber: "1", proofPresent: true, proofAt: "2026-01-01T10:00:00Z",
    capabilities: {},
  } as Delivery;
  const proof = {
    signatureData: "data:image/png;base64,abc", receiverName: "Recipient",
    proofAt: delivery.proofAt, receiptApprovedBy: null, receiptApprovedAt: null,
  };

  it("does not offer a forbidden source route to a delivery-only driver", () => {
    expect(canOpenDeliverySource("kitchen", () => false)).toBe(false);
    expect(canOpenDeliverySource("reverse_movement", module => module === "warehouse")).toBe(true);
    expect(canOpenDeliverySource("finished_goods_transfer", module => module === "warehouse")).toBe(false);
    const html = renderToStaticMarkup(createElement(DeliveryDetail, { delivery, canOpenSource: false, proof }));
    expect(html).not.toContain("/central-kitchen-orders");
    expect(html).toContain("مستخدم مخوّل");
    expect(renderToStaticMarkup(createElement(DeliveryDetail, { delivery, canOpenSource: true, proof }))).toContain("/central-kitchen-orders");
  });

  it("opens the branch supply transfer receipt without granting warehouse source access", () => {
    const transfer = { ...delivery, sourceType: "material_transfer" as const };
    expect(canOpenDeliverySource("material_transfer", module => module === "branch_supply")).toBe(true);
    expect(canOpenDeliverySource("reverse_movement", module => module === "branch_supply")).toBe(true);
    expect(deliverySourcePath(transfer, true)).toContain("from=branch-supply");
    expect(renderToStaticMarkup(createElement(DeliveryDetail, { delivery: transfer, canOpenSource: true, branchSupply: true })))
      .toContain("from=branch-supply");
  });

  it("does not display cached proof from before reassignment or a new submission", () => {
    const newer = { ...delivery, proofPresent: false, proofAt: null };
    expect(renderToStaticMarkup(createElement(DeliveryDetail, { delivery: newer, proof }))).not.toContain("data:image/png");
    const replaced = { ...delivery, proofAt: "2026-01-01T11:00:00Z" };
    expect(renderToStaticMarkup(createElement(DeliveryDetail, { delivery: replaced, proof }))).not.toContain("data:image/png");
    expect(renderToStaticMarkup(createElement(DeliveryDetail, { delivery, proof }))).toContain("data:image/png");
  });
});
