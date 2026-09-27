import { describe, expect, it } from "vitest";
import { assertDeliveryDispatchReady, deliverySourceFingerprint } from "../server/delivery-dispatch-guard";

const items = [{ id: 12, name: "Item", quantity: 2, unit: "piece" }];
const fingerprint = deliverySourceFingerprint(items);
function transaction(overrides: Record<string, unknown> = {}, evidence = ["shipment_photo", "carrier_receipt"]) {
  let debits = 0;
  const assignment = {
    id: 1, status: "assigned", transport_mode: "external", driver_id: null,
    carrier: "road", waybill: "R-12", package_count: 1,
    handover_recorded_at: new Date(), handover_revision: 1,
    handover_fingerprint: fingerprint, handover_items: items,
    ...overrides,
  };
  const tx = { query: async (text: string) => {
    if (text.includes("FROM delivery_assignments")) return { rows: [assignment] };
    if (text.includes("FROM delivery_carrier_attachments")) return { rows: evidence.map(kind => ({ kind })) };
    if (text.includes("FROM finished_goods_transfers")) return { rows: items };
    if (text.includes("UPDATE")) { debits++; return { rows: [] }; }
    throw Error("Unexpected query");
  } };
  return { tx, get debits() { return debits; } };
}
describe("external shipment dispatch is metadata-only", () => {
  const source = { sourceType: "finished_goods_transfer" as const, sourceId: 1 };
  it("accepts documented carrier without requiring a fake driver", async () => {
    const mock = transaction();
    const result = await assertDeliveryDispatchReady(mock.tx as any, source);
    expect(result.driverId).toBeNull();
    expect(result.driverName).toBe("Road");
    expect(mock.debits).toBe(0);
  });
  it.each([
    [{ handover_fingerprint: "forged" }, ["shipment_photo", "carrier_receipt"]],
    [{ handover_recorded_at: null }, ["shipment_photo", "carrier_receipt"]],
    [{ driver_id: "fabricated" }, ["shipment_photo", "carrier_receipt"]],
    [{}, ["shipment_photo"]],
  ])("rejects forged handover, driver or missing proof before stock posting", async (override, evidence) => {
    const mock = transaction(override, evidence);
    await expect(assertDeliveryDispatchReady(mock.tx as any, source)).rejects.toThrow();
    expect(mock.debits).toBe(0);
  });
});