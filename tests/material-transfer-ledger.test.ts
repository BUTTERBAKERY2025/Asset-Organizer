import { describe, expect, it } from "vitest";
import {
  destinationCreditSnapshot,
  sourceDebitSnapshot,
} from "../server/material-transfer-ledger";

describe("material transfer ledger snapshots", () => {
  it("reconstructs the source balance around the sent-quantity debit", () => {
    expect(sourceDebitSnapshot(7.125, 2.375)).toEqual({
      balanceBefore: 9.5,
      balanceAfter: 7.125,
    });
  });

  it("reconstructs the destination balance around only the received credit", () => {
    expect(destinationCreditSnapshot(8.2, 1.7)).toEqual({
      balanceBefore: 6.5,
      balanceAfter: 8.2,
    });
  });

  it("uses fixed material precision rather than floating-point drift", () => {
    expect(sourceDebitSnapshot(0.2, 0.1).balanceBefore).toBe(0.3);
    expect(destinationCreditSnapshot(0.3, 0.1).balanceBefore).toBe(0.2);
  });
});