import { describe, expect, it } from "vitest";
import { deliveryMatchesContext } from "../client/src/components/delivery/delivery-ui";

describe("embedded delivery context", () => {
  const delivery = { id: 602, sourceType: "kitchen" as const, sourceId: 13 };

  it("accepts the exact authoritative delivery even when absent from a list", () => {
    expect(deliveryMatchesContext(delivery, "kitchen", 13, 602)).toBe(true);
  });

  it("does not display a stale task when its id or source changes", () => {
    expect(deliveryMatchesContext(delivery, "kitchen", 13, 603)).toBe(false);
    expect(deliveryMatchesContext(delivery, "kitchen", 14, 602)).toBe(false);
    expect(deliveryMatchesContext(delivery, "kitchen", 14)).toBe(false);
  });
});