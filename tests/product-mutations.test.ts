import { describe, expect, it } from "vitest";
import {
  normalizeProductMutationInput,
  productUpdateSchema,
} from "../shared/product-mutations";

describe("product mutation validation", () => {
  it("allows only mutable product fields", () => {
    expect(productUpdateSchema.safeParse({ name: "  Croissant  ", vatRate: 0.15 }).success).toBe(true);
    expect(productUpdateSchema.safeParse({ id: 4, name: "Changed" }).success).toBe(false);
    expect(productUpdateSchema.safeParse({ createdAt: new Date().toISOString() }).success).toBe(false);
    expect(productUpdateSchema.safeParse({ updatedAt: new Date().toISOString() }).success).toBe(false);
    expect(productUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("validates prices, product types, and stored active strings", () => {
    expect(productUpdateSchema.safeParse({ basePrice: -1 }).success).toBe(false);
    expect(productUpdateSchema.safeParse({ productType: "unknown" }).success).toBe(false);
    expect(productUpdateSchema.safeParse({ isActive: "active" }).success).toBe(false);
    expect(productUpdateSchema.safeParse({ isActive: "false" }).success).toBe(true);
  });

  it("normalizes boolean active values at the HTTP boundary", () => {
    expect(normalizeProductMutationInput({ isActive: false, name: "Old", sku: "  SKU-1 " })).toEqual({
      isActive: "false",
      name: "Old",
      sku: "SKU-1",
    });
    expect(normalizeProductMutationInput({ isActive: true })).toEqual({ isActive: "true" });
    expect(normalizeProductMutationInput({ sku: "   " })).toEqual({ sku: null });
  });
});