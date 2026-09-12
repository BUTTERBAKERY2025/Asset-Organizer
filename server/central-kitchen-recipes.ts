import { createHash, randomUUID } from "crypto";
import type { Express, Request } from "express";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import {
  branches,
  centralKitchenRecipeIngredients,
  centralKitchenRecipeOperations,
  centralKitchenRecipes,
  products,
  warehouseItems,
  type CentralKitchenRecipe,
  type CentralKitchenRecipeOperation,
  type User,
} from "@shared/schema";
import {
  centralKitchenRecipeActionSchema,
  centralKitchenRecipeCatalogQuerySchema,
  centralKitchenRecipeListQuerySchema,
  createCentralKitchenRecipeSchema,
  updateCentralKitchenRecipeSchema,
  type CentralKitchenRecipePayload,
  type CentralKitchenRecipeContract,
} from "@shared/central-kitchen-recipes";
import {
  canAccessBranch,
  isAuthenticated,
  requirePermission,
} from "./auth";

const BASE_PATH = "/api/central-kitchen-recipes";
const PERMISSION_MODULE = "production";

type Executor = typeof db | any;

class RecipeRouteError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "RecipeRouteError";
  }
}

function getCurrentUser(req: Request): User {
  const user = (req as any).currentUser as User | undefined;
  if (!user) throw new RecipeRouteError(401, "غير مصرح");
  return user;
}

function toDbDecimal(value: number): string {
  return value.toFixed(6);
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new RecipeRouteError(500, "تعذر قراءة كمية الوصفة");
  }
  return parsed;
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function createCentralKitchenRecipePayloadFingerprint(
  payload: CentralKitchenRecipePayload,
): string {
  const canonical = {
    kitchenId: payload.kitchenId,
    productId: payload.productId,
    outputQuantity: payload.outputQuantity,
    outputUnit: payload.outputUnit,
    notes: payload.notes ?? null,
    ingredients: [...payload.ingredients]
      .sort((a, b) => a.warehouseItemId - b.warehouseItemId)
      .map((ingredient) => ({
        warehouseItemId: ingredient.warehouseItemId,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      })),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function actionFingerprint(
  action: string,
  recipeId: number,
  version: number,
  updateToken: string,
  payloadFingerprint = "",
): string {
  return createHash("sha256")
    .update(JSON.stringify({ action, recipeId, version, updateToken, payloadFingerprint }))
    .digest("hex");
}

async function getKitchen(kitchenId: string, executor: Executor = db) {
  const [kitchen] = await executor
    .select({
      id: branches.id,
      isCentralKitchen: branches.isCentralKitchen,
    })
    .from(branches)
    .where(eq(branches.id, kitchenId))
    .limit(1);
  if (!kitchen) throw new RecipeRouteError(404, "المطبخ غير موجود");
  if (!kitchen.isCentralKitchen) {
    throw new RecipeRouteError(400, "الفرع المحدد ليس مطبخاً مركزياً");
  }
  return kitchen;
}

async function assertKitchenAccess(req: Request, kitchenId: string): Promise<void> {
  await getKitchen(kitchenId);
  if (!(await canAccessBranch(req as any, kitchenId))) {
    throw new RecipeRouteError(403, "ليس لديك صلاحية للوصول لهذا المطبخ");
  }
}

async function lockKitchenProduct(
  tx: Executor,
  kitchenId: string,
  productId: number,
): Promise<void> {
  // Every mutation for a kitchen/product pair takes the same transaction lock,
  // including revisions and approvals.  No inventory operation is performed.
  await tx.execute(sql`
    SELECT pg_advisory_xact_lock(hashtext(${kitchenId}), ${productId})
  `);
}

async function lockKitchenProducts(
  tx: Executor,
  keys: Array<{ kitchenId: string; productId: number }>,
): Promise<void> {
  const uniqueKeys = new Map(
    keys.map((key) => [`${key.kitchenId}\u0000${key.productId}`, key]),
  );
  for (const [, key] of Array.from(uniqueKeys.entries()).sort(([left], [right]) => left.localeCompare(right))) {
    await lockKitchenProduct(tx, key.kitchenId, key.productId);
  }
}

async function findRecipeById(
  executor: Executor,
  id: number,
  forUpdate = false,
): Promise<CentralKitchenRecipe | null> {
  const query = executor
    .select()
    .from(centralKitchenRecipes)
    .where(eq(centralKitchenRecipes.id, id))
    .limit(1);
  const rows = forUpdate ? await query.for("update") : await query;
  return rows[0] || null;
}

async function findRecipeOperation(
  executor: Executor,
  userId: string,
  idempotencyKey: string | undefined,
): Promise<CentralKitchenRecipeOperation | null> {
  if (!idempotencyKey) return null;
  const [existing] = await executor
    .select()
    .from(centralKitchenRecipeOperations)
    .where(and(
      eq(centralKitchenRecipeOperations.actorId, userId),
      eq(centralKitchenRecipeOperations.idempotencyKey, idempotencyKey),
    ))
    .limit(1);
  return existing;
}

function assertOperationBinding(
  operation: CentralKitchenRecipeOperation,
  action: string,
  fingerprint: string,
  recipeId?: number,
): void {
  if (
    operation.action !== action
    || operation.fingerprint !== fingerprint
    || (recipeId !== undefined && operation.recipeId !== recipeId)
  ) {
    throw new RecipeRouteError(409, "مفتاح التكرار مستخدم لعملية مختلفة");
  }
}

async function insertRecipeOperation(
  executor: Executor,
  values: {
    actorId: string;
    action: string;
    idempotencyKey: string;
    fingerprint: string;
    recipeId: number;
    kitchenId: string;
    productId: number;
    snapshot: Record<string, unknown>;
    response: Record<string, unknown>;
  },
): Promise<void> {
  await executor.insert(centralKitchenRecipeOperations).values({
    actorId: values.actorId,
    action: values.action,
    idempotencyKey: values.idempotencyKey,
    fingerprint: values.fingerprint,
    recipeId: values.recipeId,
    kitchenId: values.kitchenId,
    productId: values.productId,
    snapshotJson: values.snapshot,
    responseJson: values.response,
  });
}

async function replayOperation(
  req: Request,
  operation: CentralKitchenRecipeOperation | null,
  action: string,
  fingerprint: string,
  recipeId?: number,
): Promise<Record<string, unknown> | null> {
  if (!operation) return null;
  assertOperationBinding(operation, action, fingerprint, recipeId);
  await assertKitchenAccess(req, operation.kitchenId);
  return operation.responseJson;
}

async function validateCatalogPayload(
  executor: Executor,
  payload: CentralKitchenRecipePayload,
): Promise<{ productName: string; ingredientNames: Map<number, string> }> {
  // Products historically used text values for is_active (and some legacy
  // databases omitted the field).  to_jsonb keeps this check safe across those
  // catalog variants without making a stock write.
  const productResult = await executor.execute(sql`
    SELECT p.id, p.name, p.unit
    FROM products p
    WHERE p.id = ${payload.productId}
      AND lower(COALESCE(to_jsonb(p)->>'is_active', 'true'))
        IN ('true', 'active', '1', 'yes')
    LIMIT 1
  `);
  const product = productResult.rows[0] as { id: number; name: string; unit: string } | undefined;
  if (!product) throw new RecipeRouteError(400, "المنتج غير موجود أو غير نشط");
  if (product.unit !== payload.outputUnit) {
    throw new RecipeRouteError(400, "وحدة إخراج الوصفة يجب أن تطابق وحدة المنتج");
  }

  const materialIds = payload.ingredients.map(
    (ingredient: { warehouseItemId: number }) => ingredient.warehouseItemId,
  );
  const materials = await executor
    .select({
      id: warehouseItems.id,
      name: warehouseItems.name,
      unit: warehouseItems.unit,
    })
    .from(warehouseItems)
    .where(and(
      inArray(warehouseItems.id, materialIds),
      eq(warehouseItems.isActive, true),
    ));
  const materialById = new Map<number, { id: number; name: string; unit: string }>(
    materials.map((material: any) => [material.id, material]),
  );
  const ingredientNames = new Map<number, string>();
  for (const ingredient of payload.ingredients) {
    const material = materialById.get(ingredient.warehouseItemId);
    if (!material) {
      throw new RecipeRouteError(400, "المادة غير موجودة أو غير نشطة");
    }
    if (material.unit !== ingredient.unit) {
      throw new RecipeRouteError(400, "وحدة المادة يجب أن تطابق وحدة الكتالوج حرفياً");
    }
    ingredientNames.set(ingredient.warehouseItemId, material.name);
  }
  return { productName: product.name, ingredientNames };
}

type RecipeDetailRow = {
  recipe: CentralKitchenRecipe;
  productName: string;
  ingredientId: number | null;
  ingredientWarehouseItemId: number | null;
  ingredientName: string | null;
  ingredientQuantity: unknown;
  ingredientUnit: string | null;
};

async function selectRecipeDetailRows(
  executor: Executor,
  where: any,
): Promise<RecipeDetailRow[]> {
  return executor
    .select({
      recipe: centralKitchenRecipes,
      productName: products.name,
      ingredientId: centralKitchenRecipeIngredients.id,
      ingredientWarehouseItemId: centralKitchenRecipeIngredients.warehouseItemId,
      ingredientName: warehouseItems.name,
      ingredientQuantity: centralKitchenRecipeIngredients.quantity,
      ingredientUnit: centralKitchenRecipeIngredients.unit,
    })
    .from(centralKitchenRecipes)
    .innerJoin(products, eq(products.id, centralKitchenRecipes.productId))
    .leftJoin(
      centralKitchenRecipeIngredients,
      eq(centralKitchenRecipeIngredients.recipeId, centralKitchenRecipes.id),
    )
    .leftJoin(
      warehouseItems,
      eq(warehouseItems.id, centralKitchenRecipeIngredients.warehouseItemId),
    )
    .where(where)
    .orderBy(desc(centralKitchenRecipes.updatedAt), asc(centralKitchenRecipeIngredients.id));
}

function mapRecipeRows(rows: RecipeDetailRow[]): CentralKitchenRecipeContract[] {
  const mapped = new Map<number, CentralKitchenRecipeContract>();
  for (const row of rows) {
    const recipe = row.recipe;
    let output = mapped.get(recipe.id);
    if (!output) {
      output = {
        id: recipe.id,
        kitchenId: recipe.kitchenId,
        productId: recipe.productId,
        productName: row.productName,
        outputQuantity: toNumber(recipe.outputQuantity),
        outputUnit: recipe.outputUnit,
        notes: recipe.notes,
        status: recipe.status as CentralKitchenRecipeContract["status"],
        version: recipe.version,
        updateToken: recipe.updateToken,
        supersedesRecipeId: recipe.supersedesRecipeId,
        supersededByRecipeId: recipe.supersededByRecipeId,
        createdBy: recipe.createdBy,
        createdAt: toIso(recipe.createdAt),
        updatedBy: recipe.updatedBy,
        updatedAt: toIso(recipe.updatedAt),
        approvedBy: recipe.approvedBy,
        approvedAt: recipe.approvedAt ? toIso(recipe.approvedAt) : null,
        supersededAt: recipe.supersededAt ? toIso(recipe.supersededAt) : null,
        ingredients: [],
      };
      mapped.set(recipe.id, output);
    }
    if (row.ingredientId != null && row.ingredientWarehouseItemId != null) {
      output.ingredients.push({
        id: row.ingredientId,
        warehouseItemId: row.ingredientWarehouseItemId,
        name: row.ingredientName || "",
        quantity: toNumber(row.ingredientQuantity),
        unit: row.ingredientUnit || "",
      });
    }
  }
  return Array.from(mapped.values());
}

async function getRecipeContract(executor: Executor, id: number): Promise<CentralKitchenRecipeContract | null> {
  const rows = await selectRecipeDetailRows(executor, eq(centralKitchenRecipes.id, id));
  return mapRecipeRows(rows)[0] || null;
}

function assertGuard(
  recipe: CentralKitchenRecipe,
  guard: { version: number; updateToken: string },
): void {
  if (recipe.version !== guard.version || recipe.updateToken !== guard.updateToken) {
    throw new RecipeRouteError(409, "تغيرت الوصفة منذ آخر تحميل؛ أعد تحميلها قبل المتابعة");
  }
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new RecipeRouteError(400, "معرّف الوصفة غير صالح");
  }
  return id;
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new RecipeRouteError(400, "بيانات الوصفة غير صحيحة");
  }
  return result.data;
}

function handleRecipeError(error: unknown, res: any): void {
  if (error instanceof RecipeRouteError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: "بيانات الوصفة غير صحيحة", details: error.errors });
    return;
  }
  if ((error as any)?.code === "23505") {
    res.status(409).json({ error: "توجد وصفة حالية أو مفتاح تكرار مطابق بالفعل" });
    return;
  }
  console.error("[central-kitchen-recipes]", error);
  res.status(500).json({ error: "حدث خطأ أثناء معالجة الوصفة" });
}

export function registerCentralKitchenRecipeRoutes(app: Express): void {
  app.get(
    `${BASE_PATH}/catalog`,
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "view"),
    async (req, res) => {
      try {
        const query = parseBody(
          centralKitchenRecipeCatalogQuerySchema,
          { kitchenId: req.query.kitchenId },
        );
        await assertKitchenAccess(req, query.kitchenId);
        const [productResult, materials] = await Promise.all([
          db.execute(sql`
            SELECT p.id, p.name, p.unit
            FROM products p
            WHERE lower(COALESCE(to_jsonb(p)->>'is_active', 'true'))
              IN ('true', 'active', '1', 'yes')
            ORDER BY p.name, p.id
          `),
          db
            .select({
              id: warehouseItems.id,
              name: warehouseItems.name,
              unit: warehouseItems.unit,
            })
            .from(warehouseItems)
            .where(eq(warehouseItems.isActive, true))
            .orderBy(asc(warehouseItems.name), asc(warehouseItems.id)),
        ]);
        res.json({
          products: productResult.rows.map((row: any) => ({
            id: Number(row.id),
            name: row.name,
            unit: row.unit,
          })),
          materials: materials.map((row: any) => ({
            id: row.id,
            name: row.name,
            unit: row.unit,
          })),
        });
      } catch (error) {
        handleRecipeError(error, res);
      }
    },
  );

  app.get(
    BASE_PATH,
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "view"),
    async (req, res) => {
      try {
        const query = parseBody(
          centralKitchenRecipeListQuerySchema,
          { kitchenId: req.query.kitchenId },
        );
        await assertKitchenAccess(req, query.kitchenId);
        const rows = await selectRecipeDetailRows(
          db,
          eq(centralKitchenRecipes.kitchenId, query.kitchenId),
        );
        res.json(mapRecipeRows(rows));
      } catch (error) {
        handleRecipeError(error, res);
      }
    },
  );

  app.post(
    BASE_PATH,
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "create"),
    async (req, res) => {
      try {
        const payload = parseBody(createCentralKitchenRecipeSchema, req.body);
        const user = getCurrentUser(req);
        const payloadFingerprint = createCentralKitchenRecipePayloadFingerprint(payload);
        const fingerprint = actionFingerprint("create", 0, 0, "", payloadFingerprint);
        const operation = await findRecipeOperation(db, user.id, payload.idempotencyKey);
        const replay = await replayOperation(req, operation, "create", fingerprint);
        if (replay) {
          res.set("Idempotent-Replayed", "true");
          return res.status(200).json(replay);
        }
        await assertKitchenAccess(req, payload.kitchenId);
        const createResult = await db.transaction(async (tx) => {
          await lockKitchenProduct(tx, payload.kitchenId, payload.productId);
          const operationReplay = await findRecipeOperation(tx, user.id, payload.idempotencyKey);
          if (operationReplay) {
            assertOperationBinding(operationReplay, "create", fingerprint);
            return { response: operationReplay.responseJson, replayed: true };
          }
          await validateCatalogPayload(tx, payload);
          const [currentApproved] = await tx
            .select({ id: centralKitchenRecipes.id })
            .from(centralKitchenRecipes)
            .where(and(
              eq(centralKitchenRecipes.kitchenId, payload.kitchenId),
              eq(centralKitchenRecipes.productId, payload.productId),
              eq(centralKitchenRecipes.status, "approved"),
            ))
            .for("update")
            .limit(1);
          if (currentApproved) {
            throw new RecipeRouteError(409, "توجد وصفة معتمدة؛ استخدم مسار المراجعة");
          }
          const [existingDraft] = await tx
            .select({ id: centralKitchenRecipes.id })
            .from(centralKitchenRecipes)
            .where(and(
              eq(centralKitchenRecipes.kitchenId, payload.kitchenId),
              eq(centralKitchenRecipes.productId, payload.productId),
              eq(centralKitchenRecipes.status, "draft"),
            ))
            .for("update")
            .limit(1);
          if (existingDraft) {
            throw new RecipeRouteError(409, "توجد مسودة حالية لهذا المنتج في المطبخ");
          }
          const now = new Date();
          const [created] = await tx
            .insert(centralKitchenRecipes)
            .values({
              kitchenId: payload.kitchenId,
              productId: payload.productId,
              outputQuantity: toDbDecimal(payload.outputQuantity),
              outputUnit: payload.outputUnit,
              notes: payload.notes ?? null,
              status: "draft",
              version: 1,
              updateToken: randomUUID(),
              idempotencyKey: payload.idempotencyKey ?? null,
              payloadFingerprint: payload.idempotencyKey ? payloadFingerprint : null,
              createdBy: user.id,
              createdAt: now,
              updatedBy: user.id,
              updatedAt: now,
            })
            .returning({ id: centralKitchenRecipes.id });
          await tx.insert(centralKitchenRecipeIngredients).values(
            payload.ingredients.map((ingredient: { warehouseItemId: number; quantity: number; unit: string }) => ({
              recipeId: created.id,
              warehouseItemId: ingredient.warehouseItemId,
              quantity: toDbDecimal(ingredient.quantity),
              unit: ingredient.unit,
            })),
          );
          const response = await getRecipeContract(tx, created.id);
          if (!response) throw new RecipeRouteError(500, "تعذر إنشاء الوصفة");
          if (payload.idempotencyKey) {
            await insertRecipeOperation(tx, {
              actorId: user.id,
              action: "create",
              idempotencyKey: payload.idempotencyKey,
              fingerprint,
              recipeId: created.id,
              kitchenId: payload.kitchenId,
              productId: payload.productId,
              snapshot: response as unknown as Record<string, unknown>,
              response: response as unknown as Record<string, unknown>,
            });
          }
          return { response, replayed: false };
        });
        if (createResult.replayed) res.set("Idempotent-Replayed", "true");
        res.status(createResult.replayed ? 200 : 201).json(createResult.response);
      } catch (error) {
        handleRecipeError(error, res);
      }
    },
  );

  app.get(
    `${BASE_PATH}/:id`,
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "view"),
    async (req, res) => {
      try {
        const id = parseId(req.params.id);
        const recipe = await findRecipeById(db, id);
        if (!recipe) throw new RecipeRouteError(404, "الوصفة غير موجودة");
        await assertKitchenAccess(req, recipe.kitchenId);
        const detail = await getRecipeContract(db, id);
        if (!detail) throw new RecipeRouteError(404, "الوصفة غير موجودة");
        res.json(detail);
      } catch (error) {
        handleRecipeError(error, res);
      }
    },
  );

  app.patch(
    `${BASE_PATH}/:id`,
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "edit"),
    async (req, res) => {
      try {
        const id = parseId(req.params.id);
        const payload = parseBody(updateCentralKitchenRecipeSchema, req.body);
        const user = getCurrentUser(req);
        const before = await findRecipeById(db, id);
        const payloadFingerprint = createCentralKitchenRecipePayloadFingerprint(payload);
        const fingerprint = actionFingerprint(
          "update",
          id,
          payload.version,
          payload.updateToken,
          payloadFingerprint,
        );
        const operation = await findRecipeOperation(db, user.id, payload.idempotencyKey);
        const replay = await replayOperation(req, operation, "update", fingerprint, id);
        if (replay) {
          res.set("Idempotent-Replayed", "true");
          return res.json(replay);
        }
        if (!before) throw new RecipeRouteError(404, "الوصفة غير موجودة");
        await assertKitchenAccess(req, before.kitchenId);
        const updateResult = await db.transaction(async (tx) => {
          await lockKitchenProduct(tx, before.kitchenId, before.productId);
          const [locked] = await tx
            .select()
            .from(centralKitchenRecipes)
            .where(eq(centralKitchenRecipes.id, id))
            .for("update")
            .limit(1);
          if (!locked) throw new RecipeRouteError(404, "الوصفة غير موجودة");
          const operationReplay = await findRecipeOperation(tx, user.id, payload.idempotencyKey);
          if (operationReplay) {
            assertOperationBinding(operationReplay, "update", fingerprint, id);
            return { response: operationReplay.responseJson, replayed: true };
          }
          if (locked.status !== "draft") {
            throw new RecipeRouteError(409, "الوصفة المعتمدة غير قابلة للتعديل");
          }
          if (
            locked.kitchenId !== payload.kitchenId
            || locked.productId !== payload.productId
          ) {
            throw new RecipeRouteError(409, "لا يمكن تغيير هوية الوصفة؛ استخدم مسار المراجعة");
          }
          assertGuard(locked, payload);
          await validateCatalogPayload(tx, payload);
          const now = new Date();
          await tx
            .update(centralKitchenRecipes)
            .set({
              kitchenId: payload.kitchenId,
              productId: payload.productId,
              outputQuantity: toDbDecimal(payload.outputQuantity),
              outputUnit: payload.outputUnit,
              notes: payload.notes ?? null,
              version: locked.version + 1,
              updateToken: randomUUID(),
              idempotencyKey: payload.idempotencyKey ?? null,
              payloadFingerprint: payload.idempotencyKey ? payloadFingerprint : null,
              updatedBy: user.id,
              updatedAt: now,
            })
            .where(eq(centralKitchenRecipes.id, id));
          await tx
            .delete(centralKitchenRecipeIngredients)
            .where(eq(centralKitchenRecipeIngredients.recipeId, id));
          await tx.insert(centralKitchenRecipeIngredients).values(
            payload.ingredients.map((ingredient: { warehouseItemId: number; quantity: number; unit: string }) => ({
              recipeId: id,
              warehouseItemId: ingredient.warehouseItemId,
              quantity: toDbDecimal(ingredient.quantity),
              unit: ingredient.unit,
            })),
          );
          const response = await getRecipeContract(tx, id);
          if (!response) throw new RecipeRouteError(500, "تعذر تحديث الوصفة");
          if (payload.idempotencyKey) {
            await insertRecipeOperation(tx, {
              actorId: user.id,
              action: "update",
              idempotencyKey: payload.idempotencyKey,
              fingerprint,
              recipeId: id,
              kitchenId: locked.kitchenId,
              productId: locked.productId,
              snapshot: response as unknown as Record<string, unknown>,
              response: response as unknown as Record<string, unknown>,
            });
          }
          return { response, replayed: false };
        });
        if (updateResult.replayed) res.set("Idempotent-Replayed", "true");
        res.json(updateResult.response);
      } catch (error) {
        handleRecipeError(error, res);
      }
    },
  );

  app.post(
    `${BASE_PATH}/:id/approve`,
    isAuthenticated,
    requirePermission("production", "approve"),
    async (req, res) => {
      try {
        const id = parseId(req.params.id);
        const action = parseBody(centralKitchenRecipeActionSchema, req.body);
        const user = getCurrentUser(req);
        const fingerprint = actionFingerprint(
          "approve",
          id,
          action.version,
          action.updateToken,
        );
        const operation = await findRecipeOperation(db, user.id, action.idempotencyKey);
        const replay = await replayOperation(req, operation, "approve", fingerprint, id);
        if (replay) {
          res.set("Idempotent-Replayed", "true");
          return res.json(replay);
        }
        const before = await findRecipeById(db, id);
        if (!before) throw new RecipeRouteError(404, "الوصفة غير موجودة");
        await assertKitchenAccess(req, before.kitchenId);
        const approvalResult = await db.transaction(async (tx) => {
          await lockKitchenProduct(tx, before.kitchenId, before.productId);
          const [draft] = await tx
            .select()
            .from(centralKitchenRecipes)
            .where(eq(centralKitchenRecipes.id, id))
            .for("update")
            .limit(1);
          if (!draft) throw new RecipeRouteError(404, "الوصفة غير موجودة");
          const operationReplay = await findRecipeOperation(tx, user.id, action.idempotencyKey);
          if (operationReplay) {
            assertOperationBinding(operationReplay, "approve", fingerprint, id);
            return { response: operationReplay.responseJson, replayed: true };
          }
          if (draft.status !== "draft") {
            throw new RecipeRouteError(409, "لا يمكن اعتماد وصفة غير مسودة");
          }
          assertGuard(draft, action);
          const ingredients = await tx
            .select({
              warehouseItemId: centralKitchenRecipeIngredients.warehouseItemId,
              quantity: centralKitchenRecipeIngredients.quantity,
              unit: centralKitchenRecipeIngredients.unit,
            })
            .from(centralKitchenRecipeIngredients)
            .where(eq(centralKitchenRecipeIngredients.recipeId, id));
          await validateCatalogPayload(tx, {
            kitchenId: draft.kitchenId,
            productId: draft.productId,
            outputQuantity: toNumber(draft.outputQuantity),
            outputUnit: draft.outputUnit,
            notes: draft.notes,
            ingredients: ingredients.map((ingredient: any) => ({
              warehouseItemId: ingredient.warehouseItemId,
              quantity: toNumber(ingredient.quantity),
              unit: ingredient.unit,
            })),
          });
          const [currentApproved] = await tx
            .select()
            .from(centralKitchenRecipes)
            .where(and(
              eq(centralKitchenRecipes.kitchenId, draft.kitchenId),
              eq(centralKitchenRecipes.productId, draft.productId),
              eq(centralKitchenRecipes.status, "approved"),
            ))
            .for("update")
            .limit(1);
          const now = new Date();
          if (currentApproved) {
            if (draft.supersedesRecipeId !== currentApproved.id) {
              throw new RecipeRouteError(409, "يجب اعتماد مراجعة مرتبطة بالوصفة الحالية");
            }
            await tx
              .update(centralKitchenRecipes)
              .set({
                status: "superseded",
                supersededByRecipeId: id,
                supersededAt: now,
                updatedBy: user.id,
                updatedAt: now,
              })
              .where(eq(centralKitchenRecipes.id, currentApproved.id));
          } else if (draft.supersedesRecipeId !== null) {
            throw new RecipeRouteError(409, "الوصفة الأصلية للمراجعة ليست معتمدة حالياً");
          }
          await tx
            .update(centralKitchenRecipes)
            .set({
              status: "approved",
              version: draft.version + 1,
              updateToken: randomUUID(),
              idempotencyKey: action.idempotencyKey ?? null,
              payloadFingerprint: action.idempotencyKey ? fingerprint : null,
              approvedBy: user.id,
              approvedAt: now,
              updatedBy: user.id,
              updatedAt: now,
            })
            .where(eq(centralKitchenRecipes.id, id));
          const response = await getRecipeContract(tx, id);
          if (!response) throw new RecipeRouteError(500, "تعذر اعتماد الوصفة");
          if (action.idempotencyKey) {
            await insertRecipeOperation(tx, {
              actorId: user.id,
              action: "approve",
              idempotencyKey: action.idempotencyKey,
              fingerprint,
              recipeId: id,
              kitchenId: draft.kitchenId,
              productId: draft.productId,
              snapshot: response as unknown as Record<string, unknown>,
              response: response as unknown as Record<string, unknown>,
            });
          }
          return { response, replayed: false };
        });
        if (approvalResult.replayed) res.set("Idempotent-Replayed", "true");
        res.json(approvalResult.response);
      } catch (error) {
        handleRecipeError(error, res);
      }
    },
  );

  app.post(
    `${BASE_PATH}/:id/revise`,
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "create"),
    async (req, res) => {
      try {
        const id = parseId(req.params.id);
        const action = parseBody(centralKitchenRecipeActionSchema, req.body);
        const user = getCurrentUser(req);
        const fingerprint = actionFingerprint(
          "revise",
          id,
          action.version,
          action.updateToken,
        );
        const operation = await findRecipeOperation(db, user.id, action.idempotencyKey);
        const replay = await replayOperation(req, operation, "revise", fingerprint, id);
        if (replay) {
          res.set("Idempotent-Replayed", "true");
          return res.status(200).json(replay);
        }
        const before = await findRecipeById(db, id);
        if (!before) throw new RecipeRouteError(404, "الوصفة غير موجودة");
        await assertKitchenAccess(req, before.kitchenId);
        const revisionResult = await db.transaction(async (tx) => {
          await lockKitchenProduct(tx, before.kitchenId, before.productId);
          const [source] = await tx
            .select()
            .from(centralKitchenRecipes)
            .where(eq(centralKitchenRecipes.id, id))
            .for("update")
            .limit(1);
          if (!source) throw new RecipeRouteError(404, "الوصفة غير موجودة");
          const operationReplay = await findRecipeOperation(tx, user.id, action.idempotencyKey);
          if (operationReplay) {
            assertOperationBinding(operationReplay, "revise", fingerprint, id);
            return { response: operationReplay.responseJson, replayed: true };
          }
          if (source.status !== "approved") {
            throw new RecipeRouteError(409, "لا يمكن إنشاء مراجعة إلا من وصفة معتمدة حالية");
          }
          assertGuard(source, action);
          const sourceIngredients = await tx
            .select({
              warehouseItemId: centralKitchenRecipeIngredients.warehouseItemId,
              quantity: centralKitchenRecipeIngredients.quantity,
              unit: centralKitchenRecipeIngredients.unit,
            })
            .from(centralKitchenRecipeIngredients)
            .where(eq(centralKitchenRecipeIngredients.recipeId, id));
          const clonePayload: CentralKitchenRecipePayload = {
            kitchenId: source.kitchenId,
            productId: source.productId,
            outputQuantity: toNumber(source.outputQuantity),
            outputUnit: source.outputUnit,
            notes: source.notes,
            ingredients: sourceIngredients.map((ingredient: any) => ({
              warehouseItemId: ingredient.warehouseItemId,
              quantity: toNumber(ingredient.quantity),
              unit: ingredient.unit,
            })),
          };
          await validateCatalogPayload(tx, clonePayload);
          const [existingDraft] = await tx
            .select({ id: centralKitchenRecipes.id })
            .from(centralKitchenRecipes)
            .where(and(
              eq(centralKitchenRecipes.kitchenId, source.kitchenId),
              eq(centralKitchenRecipes.productId, source.productId),
              eq(centralKitchenRecipes.status, "draft"),
            ))
            .for("update")
            .limit(1);
          if (existingDraft) {
            throw new RecipeRouteError(409, "توجد مسودة مراجعة حالية لهذا المنتج");
          }
          const now = new Date();
          const [created] = await tx
            .insert(centralKitchenRecipes)
            .values({
              kitchenId: source.kitchenId,
              productId: source.productId,
              outputQuantity: toDbDecimal(toNumber(source.outputQuantity)),
              outputUnit: source.outputUnit,
              notes: source.notes,
              status: "draft",
              version: 1,
              updateToken: randomUUID(),
              supersedesRecipeId: source.id,
              idempotencyKey: action.idempotencyKey ?? null,
              payloadFingerprint: action.idempotencyKey ? fingerprint : null,
              createdBy: user.id,
              createdAt: now,
              updatedBy: user.id,
              updatedAt: now,
            })
            .returning({ id: centralKitchenRecipes.id });
          await tx.insert(centralKitchenRecipeIngredients).values(
            clonePayload.ingredients.map((ingredient: { warehouseItemId: number; quantity: number; unit: string }) => ({
              recipeId: created.id,
              warehouseItemId: ingredient.warehouseItemId,
              quantity: toDbDecimal(ingredient.quantity),
              unit: ingredient.unit,
            })),
          );
          const response = await getRecipeContract(tx, created.id);
          if (!response) throw new RecipeRouteError(500, "تعذر إنشاء مسودة المراجعة");
          if (action.idempotencyKey) {
            await insertRecipeOperation(tx, {
              actorId: user.id,
              action: "revise",
              idempotencyKey: action.idempotencyKey,
              fingerprint,
              recipeId: source.id,
              kitchenId: source.kitchenId,
              productId: source.productId,
              snapshot: response as unknown as Record<string, unknown>,
              response: response as unknown as Record<string, unknown>,
            });
          }
          return { response, replayed: false };
        });
        if (revisionResult.replayed) res.set("Idempotent-Replayed", "true");
        res.status(revisionResult.replayed ? 200 : 201).json(revisionResult.response);
      } catch (error) {
        handleRecipeError(error, res);
      }
    },
  );

  app.delete(
    `${BASE_PATH}/:id`,
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "delete"),
    async (req, res) => {
      try {
        const id = parseId(req.params.id);
        const guard = parseBody(centralKitchenRecipeActionSchema, req.body);
        const user = getCurrentUser(req);
        const fingerprint = actionFingerprint(
          "delete",
          id,
          guard.version,
          guard.updateToken,
        );
        const operation = await findRecipeOperation(db, user.id, guard.idempotencyKey);
        const replay = await replayOperation(req, operation, "delete", fingerprint, id);
        if (replay) {
          res.set("Idempotent-Replayed", "true");
          return res.json(replay);
        }
        const before = await findRecipeById(db, id);
        if (!before) throw new RecipeRouteError(404, "الوصفة غير موجودة");
        await assertKitchenAccess(req, before.kitchenId);
        const deleteResult = await db.transaction(async (tx) => {
          await lockKitchenProduct(tx, before.kitchenId, before.productId);
          const operationReplayBeforeRow = await findRecipeOperation(tx, user.id, guard.idempotencyKey);
          if (operationReplayBeforeRow) {
            assertOperationBinding(operationReplayBeforeRow, "delete", fingerprint, id);
            return { response: operationReplayBeforeRow.responseJson, replayed: true };
          }
          const [draft] = await tx
            .select()
            .from(centralKitchenRecipes)
            .where(eq(centralKitchenRecipes.id, id))
            .for("update")
            .limit(1);
          if (!draft) throw new RecipeRouteError(404, "الوصفة غير موجودة");
          const operationReplay = await findRecipeOperation(tx, user.id, guard.idempotencyKey);
          if (operationReplay) {
            assertOperationBinding(operationReplay, "delete", fingerprint, id);
            return { response: operationReplay.responseJson, replayed: true };
          }
          if (draft.status !== "draft") {
            throw new RecipeRouteError(409, "لا يمكن حذف إلا المسودة");
          }
          assertGuard(draft, guard);
          const snapshot = await getRecipeContract(tx, id);
          if (!snapshot) throw new RecipeRouteError(500, "تعذر قراءة الوصفة قبل الحذف");
          if (guard.idempotencyKey) {
            await insertRecipeOperation(tx, {
              actorId: user.id,
              action: "delete",
              idempotencyKey: guard.idempotencyKey,
              fingerprint,
              recipeId: id,
              kitchenId: draft.kitchenId,
              productId: draft.productId,
              snapshot: snapshot as unknown as Record<string, unknown>,
              response: { success: true },
            });
          }
          await tx.delete(centralKitchenRecipes).where(eq(centralKitchenRecipes.id, id));
          return { response: { success: true }, replayed: false };
        });
        if (deleteResult.replayed) res.set("Idempotent-Replayed", "true");
        res.json(deleteResult.response);
      } catch (error) {
        handleRecipeError(error, res);
      }
    },
  );
}
