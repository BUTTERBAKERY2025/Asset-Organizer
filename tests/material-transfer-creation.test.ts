import { describe, expect, it } from "vitest";
import {
  MaterialTransferCreationError,
  databaseErrorCode,
  materialTransferPayloadHash,
  requireNonEmptyMaterialTransferItems,
  requireMaterialTransferIdempotencyKey,
  runIdempotentMaterialTransferCreation,
} from "../server/material-transfer-creation";

describe("material transfer creation helpers", () => {
  it("requires a durable, constrained Idempotency-Key", () => {
    expect(requireMaterialTransferIdempotencyKey(" transfer.intent:123 ")).toBe("transfer.intent:123");
    expect(() => requireMaterialTransferIdempotencyKey(undefined)).toThrow(MaterialTransferCreationError);
    expect(() => requireMaterialTransferIdempotencyKey("short")).toThrow();
    expect(() => requireMaterialTransferIdempotencyKey("invalid key value")).toThrow();
  });

  it("binds a key to canonical payload content", () => {
    const first = { transfer: { requestId: 7, notes: undefined }, items: [{ itemId: 2, quantity: 1 }] };
    const reordered = { items: [{ quantity: 1, itemId: 2 }], transfer: { requestId: 7 } };
    expect(materialTransferPayloadHash(first)).toBe(materialTransferPayloadHash(reordered));
    expect(materialTransferPayloadHash(first)).not.toBe(
      materialTransferPayloadHash({ ...reordered, items: [{ quantity: 2, itemId: 2 }] }),
    );
  });

  it("rejects omitted and empty transfer item lists", () => {
    expect(() => requireNonEmptyMaterialTransferItems(undefined)).toThrow(MaterialTransferCreationError);
    expect(() => requireNonEmptyMaterialTransferItems([])).toThrow(MaterialTransferCreationError);
    expect(() => requireNonEmptyMaterialTransferItems([{ itemId: 1 }])).not.toThrow();
  });

  it("finds PostgreSQL codes wrapped by Drizzle", () => {
    expect(databaseErrorCode({ cause: { code: "23505" } })).toBe("23505");
    expect(databaseErrorCode({ cause: { cause: { code: "42703" } } })).toBe("42703");
  });

  it("serializes a two-client race to one resource and one item set", async () => {
    const rows: Array<{ id: number; idempotencyPayloadHash: string }> = [];
    const itemSets: number[][] = [];
    let insertionInFlight: Promise<void> | undefined;
    let releaseInsertion!: () => void;
    const gate = new Promise<void>((resolve) => { releaseInsertion = resolve; });

    const attempt = () => runIdempotentMaterialTransferCreation({
      payloadHash: "same-payload",
      create: async () => {
        if (insertionInFlight || rows.length) {
          await insertionInFlight;
          throw { cause: { code: "23505" } };
        }
        insertionInFlight = gate;
        await Promise.resolve();
        rows.push({ id: 41, idempotencyPayloadHash: "same-payload" });
        itemSets.push([11, 12]);
        releaseInsertion();
        await gate;
        return rows[0];
      },
      findExisting: async () => rows[0],
    });

    const [first, second] = await Promise.all([attempt(), attempt()]);
    expect(rows).toHaveLength(1);
    expect(itemSets).toEqual([[11, 12]]);
    expect(first.transfer).toBe(second.transfer);
    expect([first.replayed, second.replayed].sort()).toEqual([false, true]);
  });
});