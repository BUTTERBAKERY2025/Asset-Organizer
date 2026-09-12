import { sql } from "drizzle-orm";
import { createHash } from "crypto";
import {
  formatExact6,
  scaleRecipeRequirementExact,
  type CentralKitchenMaterialRequirement,
  type CentralKitchenMaterialRequirementsContract,
} from "@shared/central-kitchen-batch-materials";

type Executor = any;

export class CentralKitchenBatchMaterialsError extends Error {
  constructor(message: string, public status = 409) {
    super(message);
    this.name = "CentralKitchenBatchMaterialsError";
  }
}

type RecipeRow = {
  id: number;
  version: number;
  output_quantity: string | number;
  output_unit: string;
};

type RecipeIngredientRow = {
  warehouse_item_id: number;
  material_name: string;
  recipe_quantity: string | number;
  unit: string;
  catalog_unit: string;
  is_active: boolean;
};

type FrozenRequirement = RecipeIngredientRow & { required_quantity: string };

function materialChecksum(requirements: Array<{
  warehouse_item_id: number; material_name: string; unit: string;
  recipe_quantity: string | number; required_quantity: string | number;
}>): string {
  const canonical = [...requirements]
    .sort((left, right) => Number(left.warehouse_item_id) - Number(right.warehouse_item_id))
    .map((requirement) => ({
      warehouseItemId: Number(requirement.warehouse_item_id),
      materialName: requirement.material_name,
      unit: requirement.unit,
      recipeQuantity: exact6(requirement.recipe_quantity),
      requiredQuantity: exact6(requirement.required_quantity),
    }));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function exact6(value: string | number | null | undefined): string {
  const text = String(value ?? "0").trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(text)) {
    throw new CentralKitchenBatchMaterialsError("تعذر قراءة كمية المادة بدقة ست منازل عشرية", 500);
  }
  const [whole, fraction = ""] = text.split(".");
  return formatExact6(BigInt(whole) * 1_000_000n + BigInt((fraction + "000000").slice(0, 6)));
}

function exactDifference(left: string | number | null | undefined, right: string | number | null | undefined): bigint {
  const parse = (value: string | number | null | undefined) => {
    const text = exact6(value);
    const [whole, fraction] = text.split(".");
    return BigInt(whole) * 1_000_000n + BigInt(fraction);
  };
  return parse(left) - parse(right);
}

function requirementsFromRecipe(
  recipe: RecipeRow,
  ingredients: RecipeIngredientRow[],
  batchQuantity: string | number,
): FrozenRequirement[] {
  if (!ingredients.length) {
    throw new CentralKitchenBatchMaterialsError("الوصفة المعتمدة لا تحتوي مواداً", 409);
  }
  return ingredients.map((ingredient) => {
    if (!ingredient.is_active) {
      throw new CentralKitchenBatchMaterialsError(`المادة «${ingredient.material_name}» غير مفعّلة`, 409);
    }
    if (ingredient.unit.trim() !== ingredient.catalog_unit.trim()) {
      throw new CentralKitchenBatchMaterialsError(
        `وحدة المادة «${ingredient.material_name}» تغيّرت عن وحدة الوصفة؛ لا يمكن التخمين أو التحويل`,
        409,
      );
    }
    try {
      return {
        ...ingredient,
        recipe_quantity: exact6(ingredient.recipe_quantity),
        required_quantity: scaleRecipeRequirementExact(
          ingredient.recipe_quantity,
          recipe.output_quantity,
          batchQuantity,
        ),
      };
    } catch (error) {
      throw new CentralKitchenBatchMaterialsError(
        `تعذر احتساب مادة «${ingredient.material_name}» بدقة: ${(error as Error).message}`,
        409,
      );
    }
  });
}

function assertFrozenSnapshotMatchesBatch(batch: any, snapshot: any): void {
  if (
    batch.branch_id !== snapshot.kitchen_id
    || Number(batch.product_id) !== Number(snapshot.snapshot_product_id)
    || exact6(batch.batch_quantity ?? batch.quantity) !== exact6(snapshot.batch_output_quantity)
    || String(batch.batch_unit ?? batch.unit ?? "").trim()
      !== String(snapshot.recipe_output_unit ?? "").trim()
  ) {
    throw new CentralKitchenBatchMaterialsError(
      "هوية أو كمية الدفعة لا تطابق لقطة الوصفة المجمدة",
      409,
    );
  }
}

async function findApprovedRecipe(
  tx: Executor,
  kitchenId: string,
  productId: number,
  forUpdate = false,
): Promise<{ recipe: RecipeRow; ingredients: RecipeIngredientRow[] } | null> {
  const recipeQuery = tx.execute(sql`
    SELECT id, version, output_quantity::text, output_unit
    FROM central_kitchen_recipes
    WHERE kitchen_id = ${kitchenId}
      AND product_id = ${productId}
      AND status = 'approved'
    LIMIT 1
    ${forUpdate ? sql`FOR UPDATE` : sql``}
  `);
  const recipe = (await recipeQuery).rows[0] as RecipeRow | undefined;
  if (!recipe) return null;
  const result = await tx.execute(sql`
    SELECT i.warehouse_item_id, wi.name AS material_name,
           i.quantity::text AS recipe_quantity, i.unit,
           wi.unit AS catalog_unit, wi.is_active
    FROM central_kitchen_recipe_ingredients i
    INNER JOIN warehouse_items wi ON wi.id = i.warehouse_item_id
    WHERE i.recipe_id = ${recipe.id}
    ORDER BY i.warehouse_item_id
  `);
  return { recipe, ingredients: result.rows as RecipeIngredientRow[] };
}

async function getAvailability(
  tx: Executor,
  kitchenId: string,
  requirements: FrozenRequirement[],
): Promise<CentralKitchenMaterialRequirement[]> {
  if (!requirements.length) return [];
  const ids = requirements.map((ingredient) => ingredient.warehouse_item_id);
  const result = await tx.execute(sql`
    SELECT bs.item_id, bs.current_quantity::text, bs.reserved_quantity::text
    FROM branch_stock bs
    WHERE bs.branch_id = ${kitchenId}
      AND bs.item_id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
  `);
  const balances = new Map<number, { current_quantity: string; reserved_quantity: string }>(
    result.rows.map((row: any) => [Number(row.item_id), row]),
  );
  return requirements.map((ingredient) => {
    const balance = balances.get(ingredient.warehouse_item_id);
    const currentQuantity = exact6(balance?.current_quantity);
    const reservedQuantity = exact6(balance?.reserved_quantity);
    const available = exactDifference(currentQuantity, reservedQuantity);
    const required = exactDifference(ingredient.required_quantity, "0");
    return {
      warehouseItemId: ingredient.warehouse_item_id,
      materialName: ingredient.material_name,
      unit: ingredient.unit,
      recipeQuantity: exact6(ingredient.recipe_quantity),
      requiredQuantity: ingredient.required_quantity,
      currentQuantity,
      reservedQuantity,
      availableQuantity: formatExact6(available > 0n ? available : 0n),
      shortageQuantity: formatExact6(required > available ? required - (available > 0n ? available : 0n) : 0n),
    };
  });
}

export async function previewCentralKitchenMaterialRequirements(
  tx: Executor,
  input: { kitchenId: string; productId: number; quantity: string | number },
): Promise<CentralKitchenMaterialRequirementsContract> {
  const source = await findApprovedRecipe(tx, input.kitchenId, input.productId);
  if (!source) {
    return {
      kitchenId: input.kitchenId,
      productId: input.productId,
      batchQuantity: exact6(input.quantity),
      recipeBacked: false,
      recipe: null,
      requirements: [],
      materialConsumptionStatus: "not_applicable",
      message: "لا توجد وصفة معتمدة لهذا المنتج في المطبخ المحدد",
    };
  }
  const requirements = requirementsFromRecipe(source.recipe, source.ingredients, input.quantity);
  return {
    kitchenId: input.kitchenId,
    productId: input.productId,
    batchQuantity: exact6(input.quantity),
    recipeBacked: true,
    recipe: {
      recipeId: Number(source.recipe.id),
      recipeVersion: Number(source.recipe.version),
      source: "approved_recipe",
      outputQuantity: exact6(source.recipe.output_quantity),
      outputUnit: source.recipe.output_unit,
    },
    requirements: await getAvailability(tx, input.kitchenId, requirements),
    materialConsumptionStatus: "not_applicable",
  };
}

/**
 * Freezes the one currently-approved recipe in the same transaction as linked
 * batch creation.  This is deliberately never called for historical batches.
 */
export async function snapshotRecipeBackedBatchMaterials(
  tx: Executor,
  input: {
    batchId: number; kitchenId: string; productId: number; batchQuantity: string | number; batchUnit: string;
  },
): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.kitchenId}), ${input.productId})`);
  const source = await findApprovedRecipe(tx, input.kitchenId, input.productId, true);
  if (!source) {
    throw new CentralKitchenBatchMaterialsError("لا يمكن إنشاء دفعة مرتبطة بالوصفة: لا توجد وصفة معتمدة حالية", 409);
  }
  if (source.recipe.output_unit.trim() !== input.batchUnit.trim()) {
    throw new CentralKitchenBatchMaterialsError(
      "وحدة دفعة الإنتاج لا تطابق وحدة إخراج الوصفة المعتمدة",
      409,
    );
  }
  const requirements = requirementsFromRecipe(source.recipe, source.ingredients, input.batchQuantity);
  await tx.execute(sql`SELECT set_config('app.central_kitchen_snapshot_write', 'on', true)`);
  await tx.execute(sql`
    INSERT INTO central_kitchen_batch_recipe_snapshots (
      batch_id, kitchen_id, product_id, source_recipe_id, source_recipe_version,
      recipe_source, recipe_output_quantity, recipe_output_unit, batch_output_quantity
      , ingredient_count, ingredient_checksum
    ) VALUES (
      ${input.batchId}, ${input.kitchenId}, ${input.productId}, ${source.recipe.id}, ${source.recipe.version},
      'approved_recipe', ${exact6(source.recipe.output_quantity)}, ${source.recipe.output_unit}, ${exact6(input.batchQuantity)},
      ${requirements.length}, ${materialChecksum(requirements)}
    )
  `);
  for (const ingredient of requirements) {
    await tx.execute(sql`
      INSERT INTO central_kitchen_batch_materials (
        batch_id, warehouse_item_id, material_name, unit, recipe_quantity, required_quantity
      ) VALUES (
        ${input.batchId}, ${ingredient.warehouse_item_id}, ${ingredient.material_name}, ${ingredient.unit},
        ${ingredient.recipe_quantity}, ${ingredient.required_quantity}
      )
    `);
  }
  await tx.execute(sql`
    UPDATE daily_production_batches
    SET recipe_backed = true
    WHERE id = ${input.batchId}
  `);
}

export async function getBatchMaterialRequirements(
  tx: Executor,
  batchId: number,
): Promise<CentralKitchenMaterialRequirementsContract | null> {
  const batchResult = await tx.execute(sql`
    SELECT id, branch_id, product_id, unit AS batch_unit, quantity::text, recipe_backed
    FROM daily_production_batches WHERE id = ${batchId} LIMIT 1
  `);
  const batch = batchResult.rows[0] as any;
  if (!batch) return null;
  const sourceResult = await tx.execute(sql`
    SELECT kitchen_id, product_id AS snapshot_product_id,
           source_recipe_id, source_recipe_version, recipe_source,
           recipe_output_quantity::text, recipe_output_unit, batch_output_quantity::text,
           ingredient_count, ingredient_checksum
    FROM central_kitchen_batch_recipe_snapshots WHERE batch_id = ${batchId} LIMIT 1
  `);
  const source = sourceResult.rows[0] as any;
  if (!source) {
    if (batch.recipe_backed === true) {
      throw new CentralKitchenBatchMaterialsError(
        "دفعة الوصفة لا تحتوي لقطة مواد صالحة؛ لا يمكن عرض حالة استهلاك مضللة",
        409,
      );
    }
    return {
      kitchenId: batch.branch_id,
      productId: Number(batch.product_id),
      batchQuantity: exact6(batch.quantity),
      recipeBacked: false,
      recipe: null,
      requirements: [],
      materialConsumptionStatus: "not_applicable",
      message: "هذه الدفعة غير مرتبطة بوصفة مواد",
    };
  }
  if (batch.recipe_backed !== true) {
    throw new CentralKitchenBatchMaterialsError(
      "توجد لقطة مواد لدفعة غير معلنة كوصفة؛ لا يمكن عرض حالة استهلاك مضللة",
      409,
    );
  }
  assertFrozenSnapshotMatchesBatch(batch, source);
  const materialResult = await tx.execute(sql`
    SELECT warehouse_item_id, material_name, unit, recipe_quantity::text, required_quantity::text
    FROM central_kitchen_batch_materials WHERE batch_id = ${batchId} ORDER BY warehouse_item_id
  `);
  const requirements = (materialResult.rows as any[]).map((row) => ({
    warehouse_item_id: Number(row.warehouse_item_id),
    material_name: row.material_name,
    unit: row.unit,
    catalog_unit: row.unit,
    is_active: true,
    recipe_quantity: row.recipe_quantity,
    required_quantity: row.required_quantity,
  })) as FrozenRequirement[];
  if (!requirements.length) {
    throw new CentralKitchenBatchMaterialsError(
      "لقطة مواد الدفعة غير مكتملة؛ لا يمكن عرض حالة استهلاك مضللة",
      409,
    );
  }
  if (requirements.length !== Number(source.ingredient_count)
    || materialChecksum(requirements) !== source.ingredient_checksum) {
    throw new CentralKitchenBatchMaterialsError(
      "لقطة مواد الدفعة غير مكتملة أو تم العبث بها؛ لا يمكن عرض حالة استهلاك مضللة",
      409,
    );
  }
  const movementResult = await tx.execute(sql`
    SELECT warehouse_item_id, quantity::text, unit, created_at
    FROM central_kitchen_batch_material_movements
    WHERE batch_id = ${batchId}
    ORDER BY warehouse_item_id
  `);
  let materialConsumptionStatus: "pending" | "consumed" = "pending";
  let consumedAt: string | undefined;
  if (movementResult.rows.length) {
    const invalidMovementSet = movementResult.rows.length !== requirements.length
      || movementResult.rows.some((movement: any, index: number) => {
        const requirement = requirements[index];
        return Number(movement.warehouse_item_id) !== Number(requirement?.warehouse_item_id)
          || exact6(movement.quantity) !== exact6(requirement?.required_quantity)
          || String(movement.unit).trim() !== String(requirement?.unit).trim();
      });
    if (invalidMovementSet) {
      throw new CentralKitchenBatchMaterialsError(
        "سجل صرف مواد الدفعة غير مكتمل؛ لا يمكن عرض حالة استهلاك مضللة",
        409,
      );
    }
    materialConsumptionStatus = "consumed";
    const timestamp = movementResult.rows[0].created_at;
    consumedAt = timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString();
  }
  return {
    kitchenId: batch.branch_id,
    productId: Number(batch.product_id),
    batchQuantity: exact6(source.batch_output_quantity),
    recipeBacked: true,
    recipe: {
      recipeId: Number(source.source_recipe_id),
      recipeVersion: Number(source.source_recipe_version),
      source: source.recipe_source,
      outputQuantity: exact6(source.recipe_output_quantity),
      outputUnit: source.recipe_output_unit,
    },
    requirements: await getAvailability(tx, batch.branch_id, requirements),
    materialConsumptionStatus,
    ...(consumedAt ? { consumedAt } : {}),
  };
}

/**
 * Debits all frozen materials atomically before finished goods are credited.
 * The caller already locks the batch; branch-stock rows are locked in
 * warehouse-item order.  Existing movement rows make safe retries a no-op.
 */
export async function consumeRecipeBackedBatchMaterials(
  tx: Executor,
  batch: { id: number; branchId: string },
  actor?: { id?: string; name?: string },
): Promise<boolean> {
  const batchResult = await tx.execute(sql`
    SELECT id, branch_id, product_id, unit AS batch_unit, quantity::text AS batch_quantity, recipe_backed
    FROM daily_production_batches WHERE id = ${batch.id} FOR UPDATE
  `);
  const lockedBatch = batchResult.rows[0] as any;
  if (!lockedBatch) throw new CentralKitchenBatchMaterialsError("دفعة الإنتاج غير موجودة", 404);
  const snapshotResult = await tx.execute(sql`
    SELECT kitchen_id, product_id AS snapshot_product_id,
           s.recipe_output_unit, s.batch_output_quantity::text,
           s.ingredient_count, s.ingredient_checksum
    FROM central_kitchen_batch_recipe_snapshots s
    WHERE s.batch_id = ${batch.id} FOR UPDATE
  `);
  const snapshot = { ...lockedBatch, ...(snapshotResult.rows[0] as any | undefined) };
  if (!snapshot.ingredient_checksum) {
    if (snapshot.recipe_backed === true) {
      throw new CentralKitchenBatchMaterialsError("دفعة الوصفة لا تحتوي لقطة مواد صالحة؛ رُفض الترحيل لحماية الرصيد", 409);
    }
    return false;
  }
  if (snapshot.recipe_backed !== true) {
    throw new CentralKitchenBatchMaterialsError(
      "توجد لقطة مواد لدفعة غير معلنة كوصفة؛ رُفض الترحيل لحماية الرصيد",
      409,
    );
  }
  assertFrozenSnapshotMatchesBatch(lockedBatch, snapshot);
  if (snapshot.branch_id !== batch.branchId) {
    throw new CentralKitchenBatchMaterialsError("هوية الدفعة المقفلة لا تطابق فرع الترحيل", 409);
  }
  const requirementsResult = await tx.execute(sql`
    SELECT warehouse_item_id, material_name, unit, recipe_quantity::text, required_quantity::text
    FROM central_kitchen_batch_materials
    WHERE batch_id = ${batch.id}
    ORDER BY warehouse_item_id
  `);
  const requirements = requirementsResult.rows as Array<{
    warehouse_item_id: number; material_name: string; unit: string;
    recipe_quantity: string; required_quantity: string;
  }>;
  if (!requirements.length) {
    throw new CentralKitchenBatchMaterialsError("لقطة الوصفة لا تحتوي مواداً", 500);
  }
  if (requirements.length !== Number(snapshot.ingredient_count)
    || materialChecksum(requirements) !== snapshot.ingredient_checksum) {
    throw new CentralKitchenBatchMaterialsError("لقطة مواد الدفعة غير مكتملة أو تم العبث بها؛ رُفض الترحيل", 409);
  }
  const priorResult = await tx.execute(sql`
    SELECT warehouse_item_id, quantity::text, unit
    FROM central_kitchen_batch_material_movements
    WHERE batch_id = ${batch.id} ORDER BY warehouse_item_id
  `);
  if (priorResult.rows.length) {
    const invalidPriorMovement = priorResult.rows.length !== requirements.length
      || priorResult.rows.some((movement: any, index: number) => {
        const requirement = requirements[index];
        return Number(movement.warehouse_item_id) !== Number(requirement?.warehouse_item_id)
          || exact6(movement.quantity) !== exact6(requirement?.required_quantity)
          || String(movement.unit).trim() !== String(requirement?.unit).trim();
      });
    if (invalidPriorMovement) {
      throw new CentralKitchenBatchMaterialsError("توجد حركة مواد غير مكتملة لهذه الدفعة؛ لا يمكن المتابعة بأمان", 409);
    }
    return false;
  }

  const ids = requirements.map((requirement) => Number(requirement.warehouse_item_id));
  const lockedResult = await tx.execute(sql`
    SELECT bs.id AS branch_stock_id, bs.item_id, bs.current_quantity::text, bs.reserved_quantity::text,
           wi.unit AS catalog_unit, wi.is_active
    FROM branch_stock bs
    INNER JOIN warehouse_items wi ON wi.id = bs.item_id
    WHERE bs.branch_id = ${batch.branchId}
      AND bs.item_id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
    ORDER BY bs.item_id
    FOR UPDATE OF bs
  `);
  const stocks = new Map<number, any>(
    lockedResult.rows.map((row: any) => [Number(row.item_id), row]),
  );
  for (const requirement of requirements) {
    const stock = stocks.get(Number(requirement.warehouse_item_id));
    if (!stock) {
      throw new CentralKitchenBatchMaterialsError(`لا يوجد رصيد مطبخ للمادة «${requirement.material_name}»`, 409);
    }
    if (!stock.is_active || String(stock.catalog_unit).trim() !== String(requirement.unit).trim()) {
      throw new CentralKitchenBatchMaterialsError(
        `وحدة أو حالة المادة «${requirement.material_name}» لا تطابق لقطة الوصفة`,
        409,
      );
    }
    if (exactDifference(stock.current_quantity, stock.reserved_quantity)
      < exactDifference(requirement.required_quantity, "0")) {
      throw new CentralKitchenBatchMaterialsError(`رصيد المادة «${requirement.material_name}» غير كافٍ`, 409);
    }
  }
  await tx.execute(sql`SELECT set_config('app.central_kitchen_material_consume', 'on', true)`);
  for (const requirement of requirements) {
    const stock = stocks.get(Number(requirement.warehouse_item_id));
    const updated = await tx.execute(sql`
      UPDATE branch_stock
      SET current_quantity = current_quantity - ${exact6(requirement.required_quantity)},
          last_updated = now()
      WHERE id = ${stock.branch_stock_id}
        AND current_quantity - reserved_quantity >= ${exact6(requirement.required_quantity)}
      RETURNING id
    `);
    if (!updated.rows.length) {
      throw new CentralKitchenBatchMaterialsError(`تعذر خصم المادة «${requirement.material_name}» بسبب تغير الرصيد`, 409);
    }
    await tx.execute(sql`
      INSERT INTO central_kitchen_batch_material_movements (
        batch_id, warehouse_item_id, branch_stock_id, quantity, unit, actor_id, actor_name
      ) VALUES (
        ${batch.id}, ${requirement.warehouse_item_id}, ${stock.branch_stock_id},
        ${exact6(requirement.required_quantity)}, ${requirement.unit}, ${actor?.id || null}, ${actor?.name || null}
      )
    `);
  }
  return true;
}