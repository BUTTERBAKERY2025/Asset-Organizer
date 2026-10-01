import type { OperationsSalesSource } from "@shared/operations-sales";

export type SalesActor = { id: string; role: string };
export type SalesGrants = {
  journalsView: boolean; journalsApprove: boolean;
  closuresView: boolean; closuresApprove: boolean;
  allCashiers: boolean;
};

/** Identical active/visibility predicates serve counts and independently paged records. */
export function operationsSalesSql(source: OperationsSalesSource, branchIds: string[], businessDate: string,
  actor: SalesActor, grants: SalesGrants) {
  const values: unknown[] = [branchIds, businessDate];
  const creator = "coalesce(nullif(trim(concat_ws(' ',u.first_name,u.last_name)),''),nullif(u.username,'')) AS creator_name";
  const scope = "r.branch_id=ANY($1::varchar[])";
  if (source === "journals") {
    if (!grants.allCashiers) values.push(actor.id);
    return {
      from: "cashier_sales_journals r LEFT JOIN users u ON u.id=r.created_by",
      where: `${scope} AND r.journal_date <= $2 AND r.status IN ('draft','submitted','rejected')${grants.allCashiers ? "" : " AND r.cashier_id=$3"}`,
      select: `r.id,r.branch_id,r.status,r.journal_date AS business_date,r.created_by,${creator},
        r.cashier_id,r.cashier_name,r.total_sales,r.discrepancy_amount AS cash_discrepancy,
        r.bank_discrepancy_total AS bank_discrepancy,NULL::integer AS journals_count`,
      order: "r.journal_date DESC,r.id DESC", values,
    };
  }
  if (source !== "closures") throw new Error("Unknown sales source");
  return {
    from: "branch_daily_closures r LEFT JOIN users u ON u.id=r.created_by",
    where: `${scope} AND r.closure_date <= $2 AND r.status='open'`,
    select: `r.id,r.branch_id,r.status,r.closure_date AS business_date,r.created_by,${creator},
      r.total_sales,r.total_cash_discrepancy AS cash_discrepancy,
      r.total_bank_discrepancy AS bank_discrepancy,r.journals_count`,
    order: "r.closure_date DESC,r.id DESC", values,
  };
}