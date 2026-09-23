import { describe, expect, it } from "vitest";
import {
  allocateMaterialTransferCreation,
  MaterialTransferCreationError,
  databaseErrorCode,
  materialTransferPayloadHash,
  nextMaterialTransferNumber,
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

  it("allocates distinct human numbers while concurrent creates hold one advisory lock", async () => {
    const numbers: string[] = [];
    let tail = Promise.resolve();

    const create = async () => {
      let release!: () => void;
      const previous = tail;
      tail = new Promise<void>((resolve) => { release = resolve; });
      return allocateMaterialTransferCreation({
        now: new Date(2026, 2, 15),
        lockNumberAllocation: () => previous,
        findExistingNumbers: async () => numbers,
        insert: async (transferNumber) => {
          // Yield here to make a missing/broken lock reliably race.
          await Promise.resolve();
          numbers.push(transferNumber);
          release();
          return transferNumber;
        },
      });
    };

    const created = await Promise.all([create(), create(), create()]);
    expect(created).toEqual([
      "MT-202603-0001",
      "MT-202603-0002",
      "MT-202603-0003",
    ]);
    expect(new Set(numbers).size).toBe(3);
  });

  it("starts a new monthly sequence and ignores malformed latest suffixes", () => {
    const now = new Date(2026, 3, 1);
    expect(nextMaterialTransferNumber(now, ["MT-202603-0099"])).toBe("MT-202604-0001");
    expect(nextMaterialTransferNumber(now, ["MT-202604-oops"])).toBe("MT-202604-0001");
  });

  it("uses the maximum exact monthly suffix despite historical insertion order", () => {
    const now = new Date(2026, 3, 1);
    expect(nextMaterialTransferNumber(now, [
      "MT-202604-0012",
      "MT-202604-0003",
      "MT-202604-9oops",
      "MT-202604-0012-copy",
      "MT-202604--99",
      "MT-202603-9999",
    ])).toBe("MT-202604-0013");
  });
});