import { describe, expect, it } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "../shared/schema";
import { postProductionBatchToStock } from "../server/production-stock-posting";
import { snapshotRecipeBackedBatchMaterials } from "../server/central-kitchen-batch-materials";

describe("local-only rollback output-only ledger proof", () => {
  it("stamps creation, preserves activation after disable, and posts output once without raw consumption", async () => {
    const url = process.env.DATABASE_URL;
    if (!url || new URL(url).hostname !== "helium" || process.env.USE_SUPABASE === "true") throw new Error("This test requires confirmed isolated helium development DB");
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      await client.query("BEGIN");
      const db = drizzle(client, { schema });
      const token = `output-only-test-${Date.now()}`;
      await db.insert(schema.branches).values({ id: token, name: token, isCentralKitchen: true });
      await db.insert(schema.users).values({ id: token, username: token, role: "admin", branchId: token });
      const [product] = await db.insert(schema.products).values({ name: token, category: "test", unit: "piece", isActive: "true" }).returning();
      // Existing recipe-backed production must retain frozen proof and consume
      // its real ingredients even after the kitchen is switched to output-only.
      const [material] = await db.insert(schema.warehouseItems).values({
        name: `${token}-raw`, category: "raw", unit: "kg", currentStock: 0, isActive: true,
      }).returning();
      await db.execute(sql`INSERT INTO branch_stock(branch_id,item_id,current_quantity,reserved_quantity)
        VALUES (${token},${material.id},10,0)`);
      const recipeResult = await db.execute(sql`INSERT INTO central_kitchen_recipes
        (kitchen_id,product_id,output_quantity,output_unit,created_by,updated_by)
        VALUES (${token},${product.id},1,'piece',${token},${token}) RETURNING id`);
      const recipeId = Number(recipeResult.rows[0].id);
      await db.execute(sql`INSERT INTO central_kitchen_recipe_ingredients(recipe_id,warehouse_item_id,quantity,unit)
        VALUES (${recipeId},${material.id},1,'kg')`);
      await db.execute(sql`UPDATE central_kitchen_recipes SET status='approved',approved_by=${token},approved_at=now() WHERE id=${recipeId}`);
      const [recipeBatch] = await db.insert(schema.dailyProductionBatches).values({
        branchId: token, productId: product.id, productName: token, quantity: 2, unit: "piece",
        productionDate: "2026-09-30", destination: "display", status: "in_progress", recipeBacked: false, recordedBy: token,
      }).returning();
      await snapshotRecipeBackedBatchMaterials(db, { batchId: recipeBatch.id, kitchenId: token, productId: product.id, batchQuantity: 2, batchUnit: "piece" });
      const before = await db.execute(sql`SELECT to_jsonb(s) AS snapshot FROM central_kitchen_batch_recipe_snapshots s WHERE batch_id=${recipeBatch.id}`);
      const event = await db.execute(sql`INSERT INTO production_recipe_mode_events(kitchen_id,enabled,reason,actor_id)
        VALUES (${token},true,'rollback test enabled',${token}) RETURNING id`);
      await db.execute(sql`UPDATE daily_production_batches SET status='finished' WHERE id=${recipeBatch.id}`);
      expect((await postProductionBatchToStock(db, recipeBatch.id, token, token, { allowInitialPosting: true })).posted).toBe(true);
      expect((await postProductionBatchToStock(db, recipeBatch.id, token)).posted).toBe(false);
      const after = await db.execute(sql`SELECT to_jsonb(s) AS snapshot FROM central_kitchen_batch_recipe_snapshots s WHERE batch_id=${recipeBatch.id}`);
      expect(after.rows).toEqual(before.rows);
      const unchanged = await db.execute(sql`SELECT recipe_backed,recipe_mode_activation_id FROM daily_production_batches WHERE id=${recipeBatch.id}`);
      expect(unchanged.rows[0]).toEqual({ recipe_backed: true, recipe_mode_activation_id: null });
      const rawAfterRecipe = await db.execute(sql`SELECT current_quantity::text FROM branch_stock WHERE branch_id=${token} AND item_id=${material.id}`);
      expect(Number(rawAfterRecipe.rows[0].current_quantity)).toBe(8);
      const [batch] = await db.insert(schema.dailyProductionBatches).values({
        branchId: token, productId: product.id, productName: token, quantity: 2, unit: "piece",
        productionDate: "2026-09-30", destination: "display", status: "in_progress", recipeBacked: false, recordedBy: token,
      }).returning();
      expect(batch.recipeModeActivationId).toBe(event.rows[0].id);
      // A normal producer may create output after the two privileged roles
      // activate it. Their role must still be unable to toggle the setting.
      const producer = `${token}-producer`;
      await db.insert(schema.users).values({ id: producer, username: producer, role: "production_manager", branchId: token });
      await client.query("SAVEPOINT denied_toggle");
      await expect(client.query("INSERT INTO production_recipe_mode_events(kitchen_id,enabled,reason,actor_id) VALUES ($1,false,'not allowed',$2)", [token, producer])).rejects.toThrow("role forbidden");
      await client.query("ROLLBACK TO SAVEPOINT denied_toggle");
      await db.insert(schema.branches).values({ id: `${token}-branch`, name: "Receiving branch" });
      const [request] = await db.insert(schema.centralKitchenOrders).values({
        orderNumber: `${token}-request`, requestBranchId: `${token}-branch`, centralKitchenId: token,
        orderDate: "2026-09-30", neededDate: "2026-09-30", status: "approved", inventoryMode: "real",
        idempotencyKey: token, payloadFingerprint: "b".repeat(64), createdBy: producer,
      }).returning();
      const [requestItem] = await db.insert(schema.centralKitchenOrderItems).values({
        orderId: request.id, productId: product.id, productName: token, unit: "piece", requestedQuantity: 3,
      }).returning();
      const [linked] = await db.insert(schema.dailyProductionBatches).values({
        branchId: token, productId: product.id, productName: token, quantity: 1, unit: "piece",
        productionDate: "2026-09-30", destination: "central_kitchen_order", status: "in_progress",
        recipeBacked: null, centralKitchenOrderItemId: requestItem.id, recordedBy: producer,
      }).returning();
      expect(linked.recipeModeActivationId).toBe(batch.recipeModeActivationId);
      const [plan] = await db.insert(schema.advancedProductionOrders).values({
        orderNumber: token, sourceBranchId: token, targetBranchId: token, title: token,
        startDate: "2026-09-30", endDate: "2026-09-30", status: "approved",
      }).returning();
      const [item] = await db.insert(schema.productionOrderItems).values({
        orderId: plan.id, productId: product.id, productName: token, targetQuantity: 3,
      }).returning();
      await client.query("SELECT set_config('app.advanced_execution_write','on',true)");
      await db.execute(sql`UPDATE production_order_items SET execution_unit='piece' WHERE id=${item.id}`);
      const [advanced] = await db.insert(schema.dailyProductionBatches).values({
        branchId: token, productId: product.id, productName: token, quantity: 1, unit: "piece",
        productionDate: "2026-09-30", destination: "display", status: "in_progress", recipeBacked: false,
        recordedBy: producer, productionOrderId: plan.id, advancedProductionOrderItemId: item.id,
        advancedIdempotencyKey: token, advancedPayloadFingerprint: "a".repeat(64),
      }).returning();
      expect(advanced.recipeModeActivationId).toBe(batch.recipeModeActivationId);
      await client.query("SET CONSTRAINTS ALL IMMEDIATE");
      await db.execute(sql`INSERT INTO production_recipe_mode_events(kitchen_id,enabled,reason,actor_id)
        VALUES (${token},false,'rollback test disabled',${token})`);
      await db.execute(sql`UPDATE daily_production_batches SET status='finished' WHERE id=${advanced.id}`);
      expect((await postProductionBatchToStock(db, advanced.id, producer, producer, { allowInitialPosting: true })).posted).toBe(true);
      expect((await postProductionBatchToStock(db, advanced.id, producer)).posted).toBe(false);
      await db.execute(sql`UPDATE daily_production_batches SET status='finished' WHERE id=${linked.id}`);
      expect((await postProductionBatchToStock(db, linked.id, producer, producer, { allowInitialPosting: true })).posted).toBe(true);
      expect((await postProductionBatchToStock(db, linked.id, producer)).posted).toBe(false);
      await db.execute(sql`UPDATE daily_production_batches SET status='finished' WHERE id=${batch.id}`);
      expect((await postProductionBatchToStock(db, batch.id, token, token, { allowInitialPosting: true })).posted).toBe(true);
      expect((await postProductionBatchToStock(db, batch.id, token)).posted).toBe(false);
      const result = await db.execute(sql`SELECT
        (SELECT count(*) FROM central_kitchen_batch_material_movements WHERE batch_id=${batch.id})::int AS raw,
        (SELECT recipe_mode_activation_id FROM daily_production_batches WHERE id=${batch.id}) AS activation`);
      expect(result.rows[0]).toEqual({ raw: 0, activation: batch.recipeModeActivationId });
      const [normal] = await db.insert(schema.dailyProductionBatches).values({
        branchId: token, productId: product.id, productName: token, quantity: 1, unit: "piece",
        productionDate: "2026-09-30", destination: "display", status: "in_progress", recipeBacked: false, recordedBy: token,
      }).returning();
      expect(normal.recipeModeActivationId).toBeNull();
      const finalRaw = await db.execute(sql`SELECT current_quantity::text FROM branch_stock WHERE branch_id=${token} AND item_id=${material.id}`);
      expect(Number(finalRaw.rows[0].current_quantity)).toBe(8);
      await client.query("SET CONSTRAINTS ALL IMMEDIATE");
    } finally { await client.query("ROLLBACK"); await client.end(); }
  });
});