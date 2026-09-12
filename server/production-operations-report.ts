import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { getEffectiveBranchFilter, isAuthenticated, requirePermission } from "./auth";
import {
  parseProductionOperationsDateWindow,
  type ProductionOperationsCoverage,
  type ProductionOperationsMaterialRow,
  type ProductionOperationsPlannedRow,
  type ProductionOperationsProductionRow,
  type ProductionOperationsQuantityByUnit,
  type ProductionOperationsReport,
  type ProductionOperationsRequestRow,
  type ProductionOperationsWasteRow,
} from "@shared/production-operations-report";

type SqlExecutor = { execute: (query: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }> };
type DatabaseRow = Record<string, unknown>;

const UNKNOWN_UNIT = "غير محددة";

function asRow(value: unknown): DatabaseRow {
  return value as DatabaseRow;
}

function numberValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function integerValue(value: unknown): number {
  return Math.trunc(numberValue(value));
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map(integerValue).filter((id) => id > 0);
}

function stringIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function quantityRows(rows: unknown[], quantityColumn: string, unitColumn = "unit"): ProductionOperationsQuantityByUnit[] {
  return rows.map((raw) => {
    const row = asRow(raw);
    return {
      unit: textValue(row[unitColumn], UNKNOWN_UNIT),
      quantity: numberValue(row[quantityColumn]),
    };
  });
}

function scopedBranchPredicate(column: ReturnType<typeof sql>, branchIds: string[] | null) {
  if (branchIds === null) return sql`${column} IS NOT NULL`;
  return sql`${column} IN (${sql.join(branchIds.map((branchId) => sql`${branchId}`), sql`, `)})`;
}

async function tableExists(tx: SqlExecutor, tableName: string): Promise<boolean> {
  const result = await tx.execute(sql`SELECT to_regclass(${`public.${tableName}`}) IS NOT NULL AS exists`);
  return Boolean(asRow(result.rows[0]).exists);
}

function queryString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function registerProductionOperationsReportRoute(app: Express): void {
  app.get(
    "/api/production/operations-report",
    isAuthenticated,
    requirePermission("production", "view"),
    async (req: Request, res: Response) => {
      const requestedBranchId = queryString(req.query.branchId);
      const startDate = queryString(req.query.startDate);
      const endDate = queryString(req.query.endDate);
      if (!requestedBranchId || !startDate || !endDate) {
        return res.status(400).json({ error: "branchId و startDate و endDate مطلوبة" });
      }

      let window: ReturnType<typeof parseProductionOperationsDateWindow>;
      try {
        window = parseProductionOperationsDateWindow(startDate, endDate);
      } catch (error) {
        return res.status(400).json({ error: (error as Error).message });
      }

      // Deliberately resolve authorization before opening the report snapshot or
      // issuing any report-source query. `all` is the established explicit all
      // convention and remains constrained for users with assigned branches.
      const branchFilter = getEffectiveBranchFilter(req, requestedBranchId);
      if (!branchFilter.hasAccess) {
        return res.status(403).json({ error: "غير مصرح بالوصول" });
      }
      const branchIds = branchFilter.branchIds;
      const batchBranch = scopedBranchPredicate(sql`b.branch_id`, branchIds);
      const wasteBranch = scopedBranchPredicate(sql`wr.branch_id`, branchIds);
      const advancedSourceBranch = scopedBranchPredicate(sql`apo.source_branch_id`, branchIds);
      const advancedTargetBranch = scopedBranchPredicate(sql`apo.target_branch_id`, branchIds);
      const kitchenBranch = scopedBranchPredicate(sql`cko.central_kitchen_id`, branchIds);
      const requestBranch = scopedBranchPredicate(sql`cko.request_branch_id`, branchIds);
      const warnings: string[] = [];

      try {
        const report = await db.transaction(async (transaction) => {
          const tx = transaction as unknown as SqlExecutor;
          await tx.execute(sql.raw("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"));

          const [snapshotTableAvailable, movementTableAvailable] = await Promise.all([
            tableExists(tx, "central_kitchen_batch_recipe_snapshots"),
            tableExists(tx, "central_kitchen_batch_material_movements"),
          ]);

          const productionResult = await tx.execute(sql`
            SELECT
              b.product_id,
              COALESCE(NULLIF(BTRIM(b.product_name), ''), 'منتج غير مسمى') AS product_name,
              COALESCE(NULLIF(BTRIM(b.unit), ''), 'غير محددة') AS unit,
              ARRAY_AGG(DISTINCT b.branch_id) AS branch_ids,
              COUNT(*) FILTER (WHERE b.status = 'finished') AS finished_batch_count,
              COALESCE(SUM(b.quantity) FILTER (WHERE b.status = 'finished'), 0) AS finished_quantity,
              COUNT(*) FILTER (WHERE b.status = 'in_progress') AS in_progress_batch_count,
              COALESCE(SUM(b.quantity) FILTER (WHERE b.status = 'in_progress'), 0) AS in_progress_quantity,
              ARRAY_AGG(b.id ORDER BY b.id) AS batch_ids
            FROM daily_production_batches b
            WHERE b.production_date >= ${window.startDate}
              AND b.production_date <= ${window.endDate}
              AND b.status IN ('finished', 'in_progress')
              AND ${batchBranch}
            GROUP BY b.product_id, COALESCE(NULLIF(BTRIM(b.product_name), ''), 'منتج غير مسمى'),
                     COALESCE(NULLIF(BTRIM(b.unit), ''), 'غير محددة')
            ORDER BY product_name, unit
          `);

          let recipeIdsByBatch = new Map<number, number[]>();
          if (snapshotTableAvailable) {
            const recipeResult = await tx.execute(sql`
              SELECT s.batch_id, ARRAY_AGG(DISTINCT s.source_recipe_id) AS recipe_ids
              FROM central_kitchen_batch_recipe_snapshots s
              INNER JOIN daily_production_batches b ON b.id = s.batch_id
              WHERE b.production_date >= ${window.startDate}
                AND b.production_date <= ${window.endDate}
                AND b.status IN ('finished', 'in_progress')
                AND ${batchBranch}
              GROUP BY s.batch_id
            `);
            recipeIdsByBatch = new Map(recipeResult.rows.map((raw) => {
              const row = asRow(raw);
              return [integerValue(row.batch_id), numberIds(row.recipe_ids)];
            }));
          } else {
            warnings.push("لقطات وصفات دفعات المطبخ غير متاحة؛ لا يمكن إسناد الدفعات المرتبطة للوصفة إلى نسخة وصفة.");
          }

          const productionRows: ProductionOperationsProductionRow[] = productionResult.rows.map((raw) => {
            const row = asRow(raw);
            const batchIds = numberIds(row.batch_ids);
            return {
              productId: row.product_id === null ? null : integerValue(row.product_id),
              productName: textValue(row.product_name, "منتج غير مسمى"),
              unit: textValue(row.unit, UNKNOWN_UNIT),
              branchIds: stringIds(row.branch_ids),
              finishedBatchCount: integerValue(row.finished_batch_count),
              finishedQuantity: numberValue(row.finished_quantity),
              inProgressBatchCount: integerValue(row.in_progress_batch_count),
              inProgressQuantity: numberValue(row.in_progress_quantity),
              batchIds,
              recipeSourceRecipeIds: [...new Set(batchIds.flatMap((batchId) => recipeIdsByBatch.get(batchId) ?? []))],
            };
          });

          const productionSummaryResult = await tx.execute(sql`
            SELECT
              COALESCE(NULLIF(BTRIM(b.unit), ''), 'غير محددة') AS unit,
              COUNT(*) FILTER (WHERE b.status = 'finished') AS finished_batch_count,
              COALESCE(SUM(b.quantity) FILTER (WHERE b.status = 'finished'), 0) AS finished_quantity,
              COUNT(*) FILTER (WHERE b.status = 'in_progress') AS in_progress_batch_count,
              COALESCE(SUM(b.quantity) FILTER (WHERE b.status = 'in_progress'), 0) AS in_progress_quantity
            FROM daily_production_batches b
            WHERE b.production_date >= ${window.startDate}
              AND b.production_date <= ${window.endDate}
              AND b.status IN ('finished', 'in_progress')
              AND ${batchBranch}
            GROUP BY COALESCE(NULLIF(BTRIM(b.unit), ''), 'غير محددة')
            ORDER BY unit
          `);

          const plannedResult = await tx.execute(sql`
            SELECT
              poi.product_id,
              COALESCE(NULLIF(BTRIM(poi.product_name), ''), 'منتج غير مسمى') AS product_name,
              NULLIF(BTRIM(p.unit), '') AS catalog_unit,
              ARRAY_AGG(DISTINCT apo.source_branch_id) AS source_branch_ids,
              ARRAY_AGG(DISTINCT apo.target_branch_id) AS target_branch_ids,
              COALESCE(SUM(poi.target_quantity), 0) AS planned_quantity,
              ARRAY_AGG(DISTINCT apo.id) AS advanced_order_ids,
              ARRAY_AGG(poi.id ORDER BY poi.id) AS advanced_order_item_ids
            FROM advanced_production_orders apo
            INNER JOIN production_order_items poi ON poi.order_id = apo.id
            LEFT JOIN products p ON p.id = poi.product_id
            WHERE apo.start_date <= ${window.endDate}
              AND apo.end_date >= ${window.startDate}
              AND (${advancedSourceBranch} OR ${advancedTargetBranch})
            GROUP BY poi.product_id, COALESCE(NULLIF(BTRIM(poi.product_name), ''), 'منتج غير مسمى'),
                     NULLIF(BTRIM(p.unit), '')
            ORDER BY product_name, catalog_unit NULLS LAST
          `);
          const plannedRows: ProductionOperationsPlannedRow[] = plannedResult.rows.map((raw) => {
            const row = asRow(raw);
            return {
              productId: row.product_id === null ? null : integerValue(row.product_id),
              productName: textValue(row.product_name, "منتج غير مسمى"),
              catalogUnit: textValue(row.catalog_unit) || null,
              sourceBranchIds: stringIds(row.source_branch_ids),
              targetBranchIds: stringIds(row.target_branch_ids),
              plannedQuantity: numberValue(row.planned_quantity),
              advancedOrderIds: numberIds(row.advanced_order_ids),
              advancedOrderItemIds: numberIds(row.advanced_order_item_ids),
              comparisonStatus: "unavailable_without_explicit_batch_link",
            };
          });

          const requestResult = await tx.execute(sql`
            WITH linked_batches AS (
              SELECT
                b.central_kitchen_order_item_id AS order_item_id,
                COALESCE(SUM(b.quantity) FILTER (WHERE b.status = 'finished'), 0) AS linked_finished_quantity,
                COALESCE(SUM(b.quantity) FILTER (WHERE b.status = 'in_progress'), 0) AS linked_in_progress_quantity,
                ARRAY_AGG(b.id ORDER BY b.id) AS linked_batch_ids
              FROM daily_production_batches b
              WHERE b.central_kitchen_order_item_id IS NOT NULL
                AND b.status IN ('finished', 'in_progress')
                AND ${batchBranch}
              GROUP BY b.central_kitchen_order_item_id
            )
            SELECT
              cko.central_kitchen_id AS kitchen_id,
              ARRAY_AGG(DISTINCT cko.request_branch_id) AS request_branch_ids,
              COALESCE(cko.inventory_mode, 'unknown') AS inventory_mode,
              cko.status,
              CASE WHEN ckoi.product_id IS NOT NULL THEN 'product' ELSE 'warehouse_item' END AS item_kind,
              COALESCE(ckoi.product_id, ckoi.warehouse_item_id) AS item_id,
              ckoi.product_name AS item_name,
              ckoi.unit,
              COALESCE(SUM(ckoi.requested_quantity), 0) AS requested_quantity,
              COALESCE(SUM(ckoi.prepared_quantity), 0) AS prepared_quantity,
              COALESCE(SUM(ckoi.dispatched_quantity), 0) AS dispatched_quantity,
              COALESCE(SUM(ckoi.received_quantity), 0) AS good_received_quantity,
              COALESCE(SUM(ckoi.damaged_quantity), 0) AS damaged_quantity,
              COALESCE(SUM(ckoi.missing_quantity), 0) AS missing_quantity,
              CASE WHEN ckoi.product_id IS NOT NULL
                THEN COALESCE(linked_batches.linked_finished_quantity, 0) ELSE 0 END AS linked_finished_quantity,
              CASE WHEN ckoi.product_id IS NOT NULL
                THEN COALESCE(linked_batches.linked_in_progress_quantity, 0) ELSE 0 END AS linked_in_progress_quantity,
              CASE WHEN ckoi.product_id IS NOT NULL
                THEN COALESCE(linked_batches.linked_batch_ids, ARRAY[]::integer[]) ELSE ARRAY[]::integer[] END AS linked_batch_ids,
              ARRAY_AGG(DISTINCT cko.id) AS order_ids,
              ARRAY_AGG(ckoi.id ORDER BY ckoi.id) AS order_item_ids
            FROM central_kitchen_orders cko
            INNER JOIN central_kitchen_order_items ckoi ON ckoi.order_id = cko.id
            LEFT JOIN linked_batches ON linked_batches.order_item_id = ckoi.id
            WHERE cko.needed_date >= ${window.startDate}::date
              AND cko.needed_date <= ${window.endDate}::date
              AND (${kitchenBranch} OR ${requestBranch})
            GROUP BY cko.central_kitchen_id, COALESCE(cko.inventory_mode, 'unknown'), cko.status,
                     CASE WHEN ckoi.product_id IS NOT NULL THEN 'product' ELSE 'warehouse_item' END,
                     ckoi.product_id, ckoi.warehouse_item_id, ckoi.product_name, ckoi.unit,
                     linked_batches.linked_finished_quantity, linked_batches.linked_in_progress_quantity,
                     linked_batches.linked_batch_ids
            ORDER BY inventory_mode, status, item_name, unit
          `);
          const requestRows: ProductionOperationsRequestRow[] = requestResult.rows.map((raw) => {
            const row = asRow(raw);
            return {
              kitchenId: textValue(row.kitchen_id),
              requestBranchIds: stringIds(row.request_branch_ids),
              inventoryMode: row.inventory_mode === "real"
                ? "real"
                : row.inventory_mode === "shadow"
                  ? "shadow"
                  : "unknown",
              status: textValue(row.status, "unknown"),
              itemKind: row.item_kind === "product" ? "product" : "warehouse_item",
              itemId: row.item_id === null ? null : integerValue(row.item_id),
              itemName: textValue(row.item_name, "صنف غير مسمى"),
              unit: textValue(row.unit, UNKNOWN_UNIT),
              requestedQuantity: numberValue(row.requested_quantity),
              preparedQuantity: numberValue(row.prepared_quantity),
              dispatchedQuantity: numberValue(row.dispatched_quantity),
              goodReceivedQuantity: numberValue(row.good_received_quantity),
              damagedQuantity: numberValue(row.damaged_quantity),
              missingQuantity: numberValue(row.missing_quantity),
              linkedFinishedQuantity: numberValue(row.linked_finished_quantity),
              linkedInProgressQuantity: numberValue(row.linked_in_progress_quantity),
              linkedBatchIds: numberIds(row.linked_batch_ids),
              linkedProductionComparisonStatus: row.item_kind === "product"
                ? "available_explicit_batch_order_item_fk"
                : "not_applicable_warehouse_item",
              orderIds: numberIds(row.order_ids),
              orderItemIds: numberIds(row.order_item_ids),
            };
          });

          let materialRows: ProductionOperationsMaterialRow[] = [];
          if (movementTableAvailable) {
            const materialResult = await tx.execute(sql`
              SELECT
                m.warehouse_item_id,
                COALESCE(NULLIF(BTRIM(wi.name), ''), 'مادة #' || m.warehouse_item_id::text) AS material_name,
                COALESCE(NULLIF(BTRIM(m.unit), ''), 'غير محددة') AS unit,
                COALESCE(SUM(m.quantity), 0) AS consumed_quantity,
                ARRAY_AGG(m.id ORDER BY m.id) AS movement_ids,
                ARRAY_AGG(DISTINCT b.id) AS batch_ids
              FROM central_kitchen_batch_material_movements m
              INNER JOIN daily_production_batches b ON b.id = m.batch_id
              LEFT JOIN warehouse_items wi ON wi.id = m.warehouse_item_id
              WHERE b.production_date >= ${window.startDate}
                AND b.production_date <= ${window.endDate}
                AND b.status = 'finished'
                AND ${batchBranch}
              GROUP BY m.warehouse_item_id, COALESCE(NULLIF(BTRIM(wi.name), ''), 'مادة #' || m.warehouse_item_id::text),
                       COALESCE(NULLIF(BTRIM(m.unit), ''), 'غير محددة')
              ORDER BY material_name, unit
            `);
            materialRows = materialResult.rows.map((raw) => {
              const row = asRow(raw);
              return {
                warehouseItemId: integerValue(row.warehouse_item_id),
                materialName: textValue(row.material_name),
                unit: textValue(row.unit, UNKNOWN_UNIT),
                consumedQuantity: numberValue(row.consumed_quantity),
                movementIds: numberIds(row.movement_ids),
                batchIds: numberIds(row.batch_ids),
              };
            });
          } else {
            warnings.push("سجل حركات مواد دفعات المطبخ غير متاح؛ لا يمكن عرض الاستهلاك الفعلي أو الحكم على نقص ترحيله.");
          }

          const wasteResult = await tx.execute(sql`
            SELECT
              wi.product_id,
              COALESCE(NULLIF(BTRIM(p.name), ''), 'منتج #' || wi.product_id::text) AS product_name,
              NULLIF(BTRIM(p.unit), '') AS catalog_unit,
              COALESCE(SUM(wi.quantity), 0) AS approved_quantity,
              ARRAY_AGG(DISTINCT wr.id) AS waste_report_ids,
              ARRAY_AGG(wi.id ORDER BY wi.id) AS waste_item_ids
            FROM waste_reports wr
            INNER JOIN waste_items wi ON wi.waste_report_id = wr.id
            LEFT JOIN products p ON p.id = wi.product_id
            WHERE wr.status = 'approved'
              AND wr.report_date >= ${window.startDate}
              AND wr.report_date <= ${window.endDate}
              AND ${wasteBranch}
            GROUP BY wi.product_id, COALESCE(NULLIF(BTRIM(p.name), ''), 'منتج #' || wi.product_id::text),
                     NULLIF(BTRIM(p.unit), '')
            ORDER BY product_name, catalog_unit NULLS LAST
          `);
          const wasteRows: ProductionOperationsWasteRow[] = wasteResult.rows.map((raw) => {
            const row = asRow(raw);
            return {
              productId: integerValue(row.product_id),
              productName: textValue(row.product_name),
              catalogUnit: textValue(row.catalog_unit) || null,
              approvedQuantity: numberValue(row.approved_quantity),
              wasteReportIds: numberIds(row.waste_report_ids),
              wasteItemIds: numberIds(row.waste_item_ids),
            };
          });

          const coverageResult = await tx.execute(sql`
            WITH scoped_finished AS (
              SELECT b.id, b.recipe_backed, b.central_kitchen_order_item_id,
                EXISTS (
                  SELECT 1 FROM production_inventory_logs pil
                  WHERE pil.batch_id = b.id
                    OR (pil.reference_type = 'batch' AND pil.reference_id = b.id)
                ) AS output_posting_proven
              FROM daily_production_batches b
              WHERE b.production_date >= ${window.startDate}
                AND b.production_date <= ${window.endDate}
                AND b.status = 'finished'
                AND ${batchBranch}
            )
            SELECT
              COUNT(*) AS finished_batch_count,
              COUNT(*) FILTER (WHERE recipe_backed IS TRUE) AS recipe_backed,
              COUNT(*) FILTER (WHERE recipe_backed IS FALSE) AS non_recipe,
              COUNT(*) FILTER (WHERE recipe_backed IS NULL) AS recipe_status_unknown,
              COUNT(*) FILTER (WHERE central_kitchen_order_item_id IS NOT NULL) AS linked,
              COUNT(*) FILTER (WHERE central_kitchen_order_item_id IS NULL) AS unlinked,
              COUNT(*) FILTER (WHERE output_posting_proven) AS output_posting_proven,
              COUNT(*) FILTER (
                WHERE (recipe_backed IS TRUE OR central_kitchen_order_item_id IS NOT NULL)
                  AND NOT output_posting_proven
              ) AS output_posting_missing,
              COUNT(*) FILTER (
                WHERE recipe_backed IS NULL
                  AND central_kitchen_order_item_id IS NULL
                  AND NOT output_posting_proven
              ) AS output_posting_unknown
            FROM scoped_finished
          `);
          const coverageSource = asRow(coverageResult.rows[0]);
          const coverage: ProductionOperationsCoverage = {
            finishedBatchCount: integerValue(coverageSource.finished_batch_count),
            recipeBacked: integerValue(coverageSource.recipe_backed),
            nonRecipe: integerValue(coverageSource.non_recipe),
            recipeStatusUnknown: integerValue(coverageSource.recipe_status_unknown),
            linked: integerValue(coverageSource.linked),
            unlinked: integerValue(coverageSource.unlinked),
            materialPostingMissing: 0,
            materialPostingUnknown: 0,
            outputPostingProven: integerValue(coverageSource.output_posting_proven),
            outputPostingMissing: integerValue(coverageSource.output_posting_missing),
            outputPostingUnknown: integerValue(coverageSource.output_posting_unknown),
            recipeSnapshotMissing: null,
          };

          if (movementTableAvailable) {
            const materialCoverage = await tx.execute(sql`
              SELECT
                COUNT(*) FILTER (
                  WHERE b.recipe_backed IS TRUE
                    AND NOT EXISTS (
                      SELECT 1 FROM central_kitchen_batch_material_movements m WHERE m.batch_id = b.id
                    )
                ) AS material_posting_missing
              FROM daily_production_batches b
              WHERE b.production_date >= ${window.startDate}
                AND b.production_date <= ${window.endDate}
                AND b.status = 'finished'
                AND ${batchBranch}
            `);
            coverage.materialPostingMissing = integerValue(asRow(materialCoverage.rows[0]).material_posting_missing);
          } else {
            coverage.materialPostingUnknown = coverage.recipeBacked;
          }
          if (snapshotTableAvailable) {
            const snapshotCoverage = await tx.execute(sql`
              SELECT COUNT(*) FILTER (
                WHERE b.recipe_backed IS TRUE
                  AND NOT EXISTS (
                    SELECT 1 FROM central_kitchen_batch_recipe_snapshots s WHERE s.batch_id = b.id
                  )
              ) AS recipe_snapshot_missing
              FROM daily_production_batches b
              WHERE b.production_date >= ${window.startDate}
                AND b.production_date <= ${window.endDate}
                AND b.status = 'finished'
                AND ${batchBranch}
            `);
            coverage.recipeSnapshotMissing = integerValue(asRow(snapshotCoverage.rows[0]).recipe_snapshot_missing);
          }

          const centralKitchenUnitRows = requestRows.map((row) => ({
            unit: row.unit,
            requested_quantity: row.requestedQuantity,
            prepared_quantity: row.preparedQuantity,
            dispatched_quantity: row.dispatchedQuantity,
            good_received_quantity: row.goodReceivedQuantity,
            damaged_quantity: row.damagedQuantity,
            missing_quantity: row.missingQuantity,
          }));
          const rollupByUnit = (column: string): ProductionOperationsQuantityByUnit[] => {
            const totals = new Map<string, number>();
            for (const row of centralKitchenUnitRows) {
              totals.set(row.unit, (totals.get(row.unit) ?? 0) + numberValue(row[column]));
            }
            return [...totals.entries()].map(([unit, quantity]) => ({ unit, quantity })).sort((a, b) => a.unit.localeCompare(b.unit));
          };
          const rollupRequestRowsByUnit = (
            rows: ProductionOperationsRequestRow[],
            quantity: keyof Pick<
              ProductionOperationsRequestRow,
              | "requestedQuantity"
              | "preparedQuantity"
              | "dispatchedQuantity"
              | "goodReceivedQuantity"
              | "damagedQuantity"
              | "missingQuantity"
            >,
          ): ProductionOperationsQuantityByUnit[] => {
            const totals = new Map<string, number>();
            for (const row of rows) {
              totals.set(row.unit, (totals.get(row.unit) ?? 0) + row[quantity]);
            }
            return [...totals.entries()]
              .map(([unit, quantity]) => ({ unit, quantity }))
              .sort((left, right) => left.unit.localeCompare(right.unit));
          };
          const inactiveStatuses = new Set(["cancelled", "canceled", "rejected"]);
          const byInventoryMode = (["real", "shadow", "unknown"] as const).map((inventoryMode) => {
            const rows = requestRows.filter((row) => row.inventoryMode === inventoryMode);
            const orderIds = new Set(rows.flatMap((row) => row.orderIds));
            const activeIds = new Set<number>();
            const inactiveIds = new Set<number>();
            for (const row of rows) {
              const target = inactiveStatuses.has(row.status.toLowerCase()) ? inactiveIds : activeIds;
              row.orderIds.forEach((id) => target.add(id));
            }
            return {
              inventoryMode,
              orderCount: orderIds.size,
              activeOrderCount: activeIds.size,
              inactiveOrderCount: inactiveIds.size,
              requestedQuantityByUnit: rollupRequestRowsByUnit(rows, "requestedQuantity"),
              preparedQuantityByUnit: rollupRequestRowsByUnit(rows, "preparedQuantity"),
              dispatchedQuantityByUnit: rollupRequestRowsByUnit(rows, "dispatchedQuantity"),
              goodReceivedQuantityByUnit: rollupRequestRowsByUnit(rows, "goodReceivedQuantity"),
              damagedQuantityByUnit: rollupRequestRowsByUnit(rows, "damagedQuantity"),
              missingQuantityByUnit: rollupRequestRowsByUnit(rows, "missingQuantity"),
            };
          });
          const productionUnitRows = productionSummaryResult.rows;
          const plannedQuantityByCatalogUnit = plannedRows.reduce<ProductionOperationsQuantityByUnit[]>((rows, row) => {
            const unit = row.catalogUnit ?? UNKNOWN_UNIT;
            const prior = rows.find((candidate) => candidate.unit === unit);
            if (prior) prior.quantity += row.plannedQuantity;
            else rows.push({ unit, quantity: row.plannedQuantity });
            return rows;
          }, []).sort((a, b) => a.unit.localeCompare(b.unit));
          const wasteQuantityByCatalogUnit = wasteRows.reduce<ProductionOperationsQuantityByUnit[]>((rows, row) => {
            const unit = row.catalogUnit ?? UNKNOWN_UNIT;
            const prior = rows.find((candidate) => candidate.unit === unit);
            if (prior) prior.quantity += row.approvedQuantity;
            else rows.push({ unit, quantity: row.approvedQuantity });
            return rows;
          }, []).sort((a, b) => a.unit.localeCompare(b.unit));

          const advancedOrderIds = new Set(plannedRows.flatMap((row) => row.advancedOrderIds));
          const wasteReportIds = new Set(wasteRows.flatMap((row) => row.wasteReportIds));
          const orderByModeAndStatus = new Map<string, {
            inventoryMode: "real" | "shadow" | "unknown";
            status: string;
            orderIds: Set<number>;
          }>();
          for (const row of requestRows) {
            const key = `${row.inventoryMode}\u0000${row.status}`;
            const current = orderByModeAndStatus.get(key) ?? {
              inventoryMode: row.inventoryMode,
              status: row.status,
              orderIds: new Set<number>(),
            };
            row.orderIds.forEach((id) => current.orderIds.add(id));
            orderByModeAndStatus.set(key, current);
          }
          const activeOrderIds = new Set<number>();
          const inactiveOrderIds = new Set<number>();
          for (const row of requestRows) {
            const target = inactiveStatuses.has(row.status.toLowerCase()) ? inactiveOrderIds : activeOrderIds;
            row.orderIds.forEach((id) => target.add(id));
          }
          const report: ProductionOperationsReport = {
            summary: {
              production: {
                finishedBatchCount: productionRows.reduce((total, row) => total + row.finishedBatchCount, 0),
                inProgressBatchCount: productionRows.reduce((total, row) => total + row.inProgressBatchCount, 0),
                finishedQuantityByUnit: quantityRows(productionUnitRows, "finished_quantity"),
                inProgressQuantityByUnit: quantityRows(productionUnitRows, "in_progress_quantity"),
              },
              advancedPlans: {
                orderCount: advancedOrderIds.size,
                itemCount: plannedRows.reduce((total, row) => total + row.advancedOrderItemIds.length, 0),
                plannedQuantityByCatalogUnit,
                comparisonStatus: "unavailable_without_explicit_batch_link",
              },
              centralKitchen: {
                orderCount: new Set(requestRows.flatMap((row) => row.orderIds)).size,
                activeOrderCount: activeOrderIds.size,
                inactiveOrderCount: inactiveOrderIds.size,
                byInventoryMode,
                orderCountsByInventoryModeAndStatus: [...orderByModeAndStatus.values()]
                  .map((entry) => ({
                    inventoryMode: entry.inventoryMode,
                    status: entry.status,
                    orderCount: entry.orderIds.size,
                  }))
                  .sort((left, right) => `${left.inventoryMode}:${left.status}`.localeCompare(`${right.inventoryMode}:${right.status}`)),
                combinedQuantitiesDeprecated: true,
                requestedQuantityByUnit: rollupByUnit("requested_quantity"),
                preparedQuantityByUnit: rollupByUnit("prepared_quantity"),
                dispatchedQuantityByUnit: rollupByUnit("dispatched_quantity"),
                goodReceivedQuantityByUnit: rollupByUnit("good_received_quantity"),
                damagedQuantityByUnit: rollupByUnit("damaged_quantity"),
                missingQuantityByUnit: rollupByUnit("missing_quantity"),
              },
              materials: {
                movementCount: materialRows.reduce((total, row) => total + row.movementIds.length, 0),
                consumedQuantityByUnit: materialRows.reduce<ProductionOperationsQuantityByUnit[]>((rows, row) => {
                  const prior = rows.find((candidate) => candidate.unit === row.unit);
                  if (prior) prior.quantity += row.consumedQuantity;
                  else rows.push({ unit: row.unit, quantity: row.consumedQuantity });
                  return rows;
                }, []).sort((a, b) => a.unit.localeCompare(b.unit)),
              },
              approvedWaste: {
                reportCount: wasteReportIds.size,
                quantityByCatalogUnit: wasteQuantityByCatalogUnit,
              },
            },
            productionRows,
            plannedRows,
            requestRows,
            materialRows,
            wasteRows,
            coverage,
            metadata: {
              generatedAt: new Date().toISOString(),
              readConsistency: "repeatable_read_read_only_transaction",
              branchScope: {
                requestedBranchId,
                effectiveBranchIds: branchIds,
                allConvention: "branchId=all",
              },
              dateWindow: {
                ...window,
                timezone: "Asia/Riyadh",
                bases: [
                  { source: "dailyProductionBatches", dateBasis: "production_date", label: "تاريخ دفعة الإنتاج المسجل" },
                  { source: "advancedProductionOrders", dateBasis: "start_date/end_date overlap", label: "تداخل فترة أمر الإنتاج المخطط" },
                  { source: "centralKitchenOrders", dateBasis: "needed_date", label: "فوج احتياج طلب المطبخ المركزي" },
                  { source: "centralKitchenBatchMaterialMovements", dateBasis: "linked batch production_date", label: "فوج تاريخ دفعة الإنتاج المرتبطة؛ كمية الاستهلاك من حركة صرف فعلية لا من تقدير الوصفة" },
                  { source: "wasteReports", dateBasis: "report_date", label: "تاريخ تقرير الهالك المعتمد" },
                ],
              },
              sources: [
                { source: "dailyProductionBatches", status: "available", label: "مخرجات إنتاج فعلية؛ المكتمل فقط فعلي وقيد التنفيذ منفصل" },
                { source: "advancedProductionOrders", status: "available", label: "خطة فقط؛ لا مقارنة بمخرجات دون رابط دفعة صريح" },
                { source: "centralKitchenOrders", status: "available", label: "لقطة دورة الطلب حسب inventoryMode وحالة الطلب: مطلوب/مجهز/مرسل/مستلم سليم/تالف/مفقود؛ مخرجات الطلب مرتبطة فقط بمفتاح بند الطلب الصريح" },
                { source: "centralKitchenBatchRecipeSnapshots", status: snapshotTableAvailable ? "available" : "unavailable", label: "لقطات وصفات الدفعات المجمدة" },
                { source: "centralKitchenBatchMaterialMovements", status: movementTableAvailable ? "available" : "unavailable", label: "حركات صرف مواد فعلية غير قابلة للتعديل" },
                { source: "productionInventoryLogs", status: "available", label: "إثبات ترحيل مخرج فقط؛ لا يضيف مخرجات للتقرير" },
                { source: "wasteReports", status: "available", label: "هالك تقارير معتمدة فقط" },
              ],
              linkage: {
                centralKitchenOrderItemToBatch: {
                  status: "available_explicit_batch_order_item_fk",
                  dateBasis: "request needed_date cohort; linked batches are not filtered by production_date",
                },
                advancedPlanToBatch: {
                  status: "unavailable_without_explicit_batch_link",
                },
              },
              costing: {
                status: "not_available",
                message: "لا توجد تكلفة دفعة أو حركة مواد مجمدة في مصادر التقرير؛ لم تُستخدم تكلفة كتالوج حالية ولم يُحتسب هامش تاريخي.",
              },
              rowLimit: {
                applied: false,
                totalRows: productionRows.length + plannedRows.length + requestRows.length + materialRows.length + wasteRows.length,
              },
              warnings: [
                ...warnings,
                "الدفعات ذات recipeBacked=null تعامل كتغطية تاريخية غير معروفة، وليست غير مرتبطة بوصفة.",
                "غياب إثبات ترحيل المخرج يعد نقصاً فقط للدفعات ذات رابط دورة صريح؛ السجل التاريخي بلا علامة يبقى غير معروف.",
                "استخدم centralKitchen.byInventoryMode فقط لعرض كميات طلبات المطبخ. الحقول المجمعة القديمة موسومة deprecated وتمزج حقائق تشغيلية ولا تمثل مخزوناً فعلياً.",
                "أي حالة طلب ملغاة أو مرفوضة معروضة في صف مستقل ولا تدخل activeOrderCount.",
                "وحدة خطط الإنتاج المتقدمة والهالك هي وحدة الكتالوج الحالية عند توفرها وليست لقطة تاريخية.",
              ],
            },
          };
          return report;
        });

        res.set("Cache-Control", "no-store");
        return res.json(report);
      } catch (error) {
        console.error("Error building production operations report:", error);
        return res.status(500).json({ error: "تعذر إنشاء تقرير عمليات الإنتاج" });
      }
    },
  );
}