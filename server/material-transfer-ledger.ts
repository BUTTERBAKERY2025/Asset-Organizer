import {
  addMaterialQuantities,
  subtractMaterialQuantities,
} from "@shared/material-quantity";

export interface MaterialTransferBalanceSnapshot {
  balanceBefore: number;
  balanceAfter: number;
}

/**
 * Builds the audit snapshot from the balance returned by the same atomic SQL
 * mutation. These helpers deliberately do not read stock independently.
 */
export function sourceDebitSnapshot(
  balanceAfter: number,
  sentQuantity: number,
): MaterialTransferBalanceSnapshot {
  return {
    balanceBefore: addMaterialQuantities(balanceAfter, sentQuantity),
    balanceAfter,
  };
}

export function destinationCreditSnapshot(
  balanceAfter: number,
  receivedQuantity: number,
): MaterialTransferBalanceSnapshot {
  return {
    balanceBefore: subtractMaterialQuantities(balanceAfter, receivedQuantity),
    balanceAfter,
  };
}