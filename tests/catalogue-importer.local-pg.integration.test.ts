import express, { type Express } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import net from "node:net";
import * as XLSX from "xlsx";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { updateCatalogueBranchStock, InactiveBranchStockReferenceError } from "../server/catalogue-branch-stock";

/**
 * This suite bootstraps its own disposable PostgreSQL cluster under /tmp.  It
 * deliberately does not read DATABASE_URL/SUPABASE_DATABASE_URL and does not
 * fall back to a workspace database.  The only URL used below is fabricated
 * from a loopback port reserved for this process.
 */
const sourceState = vi.hoisted(() => ({
  files: new Map<string, Buffer>(),
}));

const databaseState = vi.hoisted(() => ({
  db: null as any,
}));

vi.mock("../server/db", () => ({
  db: new Proxy({}, {
    get(_target, property) {
      const value = databaseState.db?.[property];
      return typeof value === "function" ? value.bind(databaseState.db) : value;
    },
  }),
}));

// Route authorization is exercised without loading the application's auth
// stack. The test identity carrier exists only in these direct route calls.
vi.mock("../server/auth", () => ({
  isAuthenticated: (req: any, res: any, next: () => void) => {
    if (!req.currentUser) return res.status(401).json({ error: "Unauthenticated" });
    return next();
  },
  isUserAdmin: (req: any) => req.currentUser?.role === "admin",
}));

// The production importer keeps its source loader private. Supply tiny,
// in-memory workbooks at that boundary so lifecycle tests do not depend on
// attached assets or mutate the workspace.
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  const sourceName = (candidate: unknown) => String(candidate).split(/[\\/]/).at(-1) || "";
  return {
    ...actual,
    // Never let the importer discover a workspace source directory. Its only
    // readable catalogue paths are the three in-memory workbooks above.
    existsSync: (candidate: any) => sourceState.files.has(sourceName(candidate)),
    readFileSync: (candidate: any, ...args: any[]) => {
      const source = sourceState.files.get(sourceName(candidate));
      return source ? Buffer.from(source) : (actual.readFileSync as any)(candidate, ...args);
    },
  };
});

const SOURCE_FILES = [
  "items_by_cod_1789494218526.xlsx",
  "item_store_1789494218529.xlsx",
  "items_by_category_1789494218529.xlsx",
] as const;
const TARGET_ID = "isolated-catalogue-target-74";
const ADMIN = { id: "catalogue-local-admin", role: "admin" };
const BRANCH_USER = { id: "catalogue-local-branch-user", role: "manager", branchId: "branch-74" };

type HttpResponse = { status: number; body: any };

let clusterDirectory: string | null = null;
let socketDirectory: string | null = null;
let localPort: number | null = null;
let pool: Pool;
let database: ReturnType<typeof drizzle>;
let importer: typeof import("../server/catalogue-importer");
let app: Express;
let fixture: {
  recodeId: number;
  legacyId: number;
  warehouseId: number;
  productPriceId: number;
  productHistoryId: number;
};

function workbook(rows: unknown[][]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  return XLSX.write(
    { SheetNames: ["source"], Sheets: { source: sheet } },
    { type: "buffer", bookType: "xlsx" },
  );
}

function installMockSources(version: "base" | "changed" = "base"): void {
  const suffix = version === "changed" ? " changed after staging" : "";
  sourceState.files.set(SOURCE_FILES[0], workbook([
    ["Code", "Name", "Unit"],
    ["P-KEEP", `Keep item${suffix}`, "PC"],
    ["P-RECODE", "Recode item", "PC"],
    ["P-ADD", "Added item", "PC"],
  ]));
  sourceState.files.set(SOURCE_FILES[1], workbook([
    ["#", "Code", "Name", "Unit"],
    [1, "W-KEEP", "Warehouse exact", "KG"],
    [2, "W-ADD", "Warehouse added", "KG"],
  ]));
  const categorySheet = XLSX.utils.aoa_to_sheet([
    ["ignored"],
    ["Breakfast", "Lunch", "Dessert", "Storage"],
    ["Keep item", "Recode item", "Added item", "Warehouse exact"],
    [null, null, null, "Warehouse added"],
  ]);
  sourceState.files.set(SOURCE_FILES[2], XLSX.write(
    { SheetNames: ["الأصناف"], Sheets: { "الأصناف": categorySheet } },
    { type: "buffer", bookType: "xlsx" },
  ));
}

function localPostgresEnvironment(): NodeJS.ProcessEnv {
  // Do not inherit service/database variables, in particular USE_SUPABASE.
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME || tmpdir(),
    LANG: "C",
    LC_ALL: "C",
  };
}

async function command(binary: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, {
      env: localPostgresEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += String(chunk); });
    child.stderr.on("data", (chunk) => { output += String(chunk); });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${binary} failed with exit ${code}: ${output}`));
    });
  });
}

async function reserveLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not reserve an isolated PostgreSQL port"));
        return;
      }
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function startLocalPostgres(): Promise<string> {
  clusterDirectory = await mkdtemp(join(tmpdir(), "catalogue-importer-pg-"));
  socketDirectory = join(clusterDirectory, "socket");
  const dataDirectory = join(clusterDirectory, "data");
  await command("initdb", ["-D", dataDirectory, "--auth=trust", "--username=postgres", "--no-locale"]);
  await mkdir(socketDirectory);
  localPort = await reserveLoopbackPort();
  await command("pg_ctl", [
    "-D", dataDirectory,
    "-o", `-F -p ${localPort} -k ${socketDirectory} -c listen_addresses=127.0.0.1`,
    "-w",
    "start",
  ]);
  await command("createdb", [
    "-h", "127.0.0.1",
    "-p", String(localPort),
    "-U", "postgres",
    "catalogue_import_test_74",
  ]);
  return `postgresql://postgres@127.0.0.1:${localPort}/catalogue_import_test_74`;
}

async function stopLocalPostgres(): Promise<void> {
  if (clusterDirectory) {
    await command("pg_ctl", ["-D", join(clusterDirectory, "data"), "-m", "immediate", "-w", "stop"])
      .catch(() => undefined);
    await rm(clusterDirectory, { recursive: true, force: true });
  }
  clusterDirectory = null;
  socketDirectory = null;
  localPort = null;
}

function route(appInstance: Express, path: string, method: "get" | "post"): any[] {
  const layer = (appInstance as any)._router.stack.find((candidate: any) =>
    candidate.route?.path === path && candidate.route.methods[method],
  );
  if (!layer) throw new Error(`Missing catalogue importer route ${method.toUpperCase()} ${path}`);
  return layer.route.stack.map((entry: any) => entry.handle);
}

async function request(
  path: string,
  method: "get" | "post",
  user: any,
  body?: unknown,
  params: Record<string, string> = {},
  headers: Record<string, string> = {},
): Promise<HttpResponse> {
  const handlers = route(app, path, method);
  return new Promise((resolve, reject) => {
    const req: any = {
      body,
      params,
      currentUser: user,
      header: (name: string) => headers[name.toLowerCase()] ?? headers[name],
    };
    const res: any = {
      statusCode: 200,
      status(status: number) {
        this.statusCode = status;
        return this;
      },
      set() {
        return this;
      },
      json(responseBody: any) {
        resolve({ status: this.statusCode, body: responseBody });
        return this;
      },
    };
    const dispatch = (index: number, error?: unknown): void => {
      if (error) {
        reject(error);
        return;
      }
      const handler = handlers[index];
      if (!handler) {
        reject(new Error(`Route ${path} completed without a response`));
        return;
      }
      try {
        Promise.resolve(handler(req, res, (nextError?: unknown) => dispatch(index + 1, nextError)))
          .catch(reject);
      } catch (handlerError) {
        reject(handlerError);
      }
    };
    dispatch(0);
  });
}

function approvals() {
  return [
    {
      namespace: "products", action: "adopt_code", sourceCode: "P-RECODE", currentId: fixture.recodeId,
      identityAcknowledgement: "MANUAL_IDENTITY_CONFIRMED",
      reason: "Reviewer confirmed this bilingual product identity",
    },
    {
      namespace: "products", action: "add", sourceCode: "P-ADD", category: "pastry",
      availabilityDisposition: "inactive_pending_price",
    },
    {
      namespace: "warehouse", action: "add", sourceCode: "W-ADD", category: "dry_store",
      availabilityDisposition: "inactive_pending_price",
    },
    {
      namespace: "products",
      action: "hard_delete",
      currentId: fixture.legacyId,
      reason: "No references after reviewer inspection; apply must prove again",
      reviewAcknowledgement: "LEGACY_RECORD_REVIEWED",
    },
  ];
}

async function reviewedCatalogue(): Promise<any> {
  const response = await request("/api/admin/catalogue-import/review", "get", ADMIN);
  expect(response.status).toBe(200);
  return response.body;
}

async function stagePlan(
  review?: any,
  planApprovals = approvals(),
): Promise<any> {
  const currentReview = review ?? await reviewedCatalogue();
  const response = await request("/api/admin/catalogue-import/stage", "post", ADMIN, {
    targetId: TARGET_ID,
    sourceChecksum: currentReview.sourceChecksum,
    snapshotChecksum: currentReview.snapshotChecksum,
    reviewAcknowledgement: "CATALOGUE_REVIEWED",
    approvals: planApprovals,
  });
  expect(response.status).toBe(201);
  expect(response.body.reviewRequiredCount).toBe(0);
  return response.body;
}

async function completedBackup(plan: any, alternateTargetIdentity?: string): Promise<number> {
  const result = await pool.query(
    "INSERT INTO backups (status, created_at) VALUES ('completed', now()) RETURNING id",
  );
  const products = await pool.query("SELECT id, sku, name, unit, is_active FROM products ORDER BY id");
  const warehouse = await pool.query(`
    SELECT id, sku, name, unit, current_stock, is_active FROM warehouse_items ORDER BY id
  `);
  const manifest = importer.createCatalogueBackupManifest(
    alternateTargetIdentity ?? plan.targetIdentity,
    products.rows,
    warehouse.rows,
  );
  await pool.query(`
    INSERT INTO catalogue_backup_manifests (
      backup_id, target_identity, snapshot_checksum, manifest_checksum
    ) VALUES ($1, $2, $3, $4)
  `, [
    result.rows[0].id,
    manifest.targetIdentity,
    manifest.snapshotChecksum,
    manifest.manifestChecksum,
  ]);
  return Number(result.rows[0].id);
}

async function applyPlan(planId: string, backupId: number, idempotencyKey: string): Promise<HttpResponse> {
  return request(
    "/api/admin/catalogue-import/plans/:planId/apply",
    "post",
    ADMIN,
    {
      targetId: TARGET_ID,
      backupId,
      applyConfirmation: `APPLY_CATALOGUE_${planId}`,
    },
    { planId },
    { "idempotency-key": idempotencyKey },
  );
}

async function proveUnused(namespace: "products" | "warehouse", id: number) {
  return database.transaction((tx) => importer.proveUnusedForHardDelete(tx, namespace, id));
}

async function applyOperation(operation: Parameters<typeof importer.applyCatalogueImportOperation>[2]) {
  return database.transaction((tx) =>
    importer.applyCatalogueImportOperation(tx, randomUUID(), operation));
}

describe.sequential("catalogue importer local PostgreSQL lifecycle", () => {
  beforeAll(async () => {
    installMockSources();
    const localUrl = await startLocalPostgres();
    pool = new Pool({ connectionString: localUrl, max: 8, allowExitOnIdle: true });
    database = drizzle(pool);
    databaseState.db = database;

    await pool.query(`
      CREATE TABLE users (id varchar PRIMARY KEY, role text NOT NULL);
      CREATE TABLE products (
        id serial PRIMARY KEY, sku text, name text NOT NULL, unit text,
        category text NOT NULL DEFAULT 'finish', base_price numeric,
        is_active text DEFAULT 'true', description text, image_url text,
        nutrition jsonb, updated_at timestamp DEFAULT now()
      );
      CREATE TABLE warehouse_items (
        id serial PRIMARY KEY, sku text, name text NOT NULL, unit text,
        category text NOT NULL DEFAULT 'raw', current_stock numeric DEFAULT 0,
        unit_price numeric, is_active boolean DEFAULT true, supplier text, reorder_level numeric,
        updated_at timestamp DEFAULT now()
      );
      CREATE TABLE product_prices (
        id serial PRIMARY KEY, product_id integer NOT NULL REFERENCES products(id) ON DELETE RESTRICT, price numeric
      );
       CREATE TABLE product_history (
         id serial PRIMARY KEY, product_id integer REFERENCES products(id) ON DELETE RESTRICT, event text
       );
       CREATE TABLE product_operations (
         id serial PRIMARY KEY, product_id integer REFERENCES products(id) ON DELETE RESTRICT, status text NOT NULL
       );
       CREATE TABLE pos_refund_items (id serial PRIMARY KEY, product_id integer NOT NULL, quantity numeric);
      CREATE TABLE branch_stock (
         id serial PRIMARY KEY, item_id integer REFERENCES warehouse_items(id),
         branch_id varchar NOT NULL DEFAULT 'fixture-branch',
         current_quantity numeric DEFAULT 0, reserved_quantity numeric DEFAULT 0,
         daily_consumption numeric DEFAULT 0, last_updated timestamp NOT NULL DEFAULT now(),
         updated_by varchar,
         UNIQUE(branch_id, item_id)
      );
       CREATE TABLE assembly_resolution_items (id serial PRIMARY KEY);
       CREATE TABLE assembly_resolution_votes (
         id serial PRIMARY KEY, item_id integer NOT NULL REFERENCES assembly_resolution_items(id)
       );
       CREATE TABLE checklist_items (id serial PRIMARY KEY);
       CREATE TABLE shift_checklist_responses (
         id serial PRIMARY KEY, item_id integer NOT NULL REFERENCES checklist_items(id)
       );
      CREATE TABLE backups (id serial PRIMARY KEY, status text NOT NULL, created_at timestamp NOT NULL DEFAULT now());
      CREATE TABLE catalogue_import_plans (
        id uuid PRIMARY KEY, status text NOT NULL DEFAULT 'staged', target_id text NOT NULL,
        target_identity varchar(64) NOT NULL,
        source_checksum varchar(64) NOT NULL, snapshot_checksum varchar(64) NOT NULL,
        plan_checksum varchar(64) NOT NULL, review_acknowledgement text NOT NULL,
        requested_by varchar NOT NULL REFERENCES users(id), reviewed_by varchar NOT NULL REFERENCES users(id),
        backup_id integer REFERENCES backups(id), idempotency_actor_id varchar REFERENCES users(id),
        idempotency_key varchar(128), request_hash varchar(64), staged_payload jsonb NOT NULL,
        applied_summary jsonb, applied_at timestamp, created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        UNIQUE (idempotency_actor_id, idempotency_key)
      );
      CREATE TABLE catalogue_backup_manifests (
        backup_id integer PRIMARY KEY REFERENCES backups(id) ON DELETE RESTRICT,
        target_identity varchar(64) NOT NULL, snapshot_checksum varchar(64) NOT NULL,
        manifest_checksum varchar(64) NOT NULL, created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE catalogue_usage_sections (
        id serial PRIMARY KEY, name text UNIQUE NOT NULL, created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE product_usage_sections (
        product_id integer NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        usage_section_id integer NOT NULL REFERENCES catalogue_usage_sections(id) ON DELETE RESTRICT,
        source_plan_id uuid NOT NULL REFERENCES catalogue_import_plans(id) ON DELETE RESTRICT,
        created_at timestamp NOT NULL DEFAULT now(), PRIMARY KEY(product_id, usage_section_id)
      );
      CREATE TABLE warehouse_item_usage_sections (
        warehouse_item_id integer NOT NULL REFERENCES warehouse_items(id) ON DELETE RESTRICT,
        usage_section_id integer NOT NULL REFERENCES catalogue_usage_sections(id) ON DELETE RESTRICT,
        source_plan_id uuid NOT NULL REFERENCES catalogue_import_plans(id) ON DELETE RESTRICT,
        created_at timestamp NOT NULL DEFAULT now(), PRIMARY KEY(warehouse_item_id, usage_section_id)
      );
      CREATE TABLE system_audit_logs (
        id serial PRIMARY KEY, module text, entity_id text, entity_name text, action text,
        details text, user_id varchar, description text
      );
    `);
    await pool.query("INSERT INTO users (id, role) VALUES ($1, 'admin'), ($2, 'manager')", [
      ADMIN.id,
      BRANCH_USER.id,
    ]);

    const exact = await pool.query(`
      INSERT INTO products (sku, name, unit, category, base_price, is_active, description, image_url, nutrition)
      VALUES ('P-KEEP', 'Keep item', 'piece', 'finish', 13.25, 'true', 'unchanged exact metadata',
              'https://example.invalid/keep', '{"calories": 150}')
      RETURNING id
    `);
    const recode = await pool.query(`
      INSERT INTO products (sku, name, unit, category, base_price, is_active, description, image_url, nutrition)
      VALUES ('OLD-RECODE', 'Recode item', 'piece', 'finish', 22.50, 'true', 'preserve me',
              'https://example.invalid/recode', '{"allergens":["milk"]}')
      RETURNING id
    `);
    const legacy = await pool.query(`
      INSERT INTO products (sku, name, unit, category, base_price)
      VALUES ('OLD-UNUSED', 'Unused legacy', 'piece', 'finish', 9) RETURNING id
    `);
    const warehouse = await pool.query(`
      INSERT INTO warehouse_items (sku, name, unit, category, current_stock, is_active, supplier, reorder_level)
      VALUES ('W-KEEP', 'Warehouse exact', 'kg', 'raw', 7.5, true, 'Preserved supplier', 2) RETURNING id
    `);
    const price = await pool.query(
      "INSERT INTO product_prices (product_id, price) VALUES ($1, 22.50) RETURNING id",
      [recode.rows[0].id],
    );
    const history = await pool.query(
      "INSERT INTO product_history (product_id, event) VALUES ($1, 'sold') RETURNING id",
      [recode.rows[0].id],
    );
    fixture = {
      recodeId: Number(recode.rows[0].id),
      legacyId: Number(legacy.rows[0].id),
      warehouseId: Number(warehouse.rows[0].id),
      productPriceId: Number(price.rows[0].id),
      productHistoryId: Number(history.rows[0].id),
    };

    const priorPlanId = "00000000-0000-0000-0000-000000000074";
    await pool.query(`
      INSERT INTO catalogue_import_plans (
        id, target_id, target_identity, source_checksum, snapshot_checksum, plan_checksum,
        review_acknowledgement, requested_by, reviewed_by, staged_payload
      ) VALUES ($1, 'seed', repeat('0', 64), repeat('0', 64), repeat('0', 64), repeat('0', 64),
                'CATALOGUE_REVIEWED', $2, $2, '{}')
    `, [priorPlanId, ADMIN.id]);
    const existingSection = await pool.query(
      "INSERT INTO catalogue_usage_sections (name) VALUES ('Existing section') RETURNING id",
    );
    await pool.query(
      "INSERT INTO product_usage_sections (product_id, usage_section_id, source_plan_id) VALUES ($1, $2, $3)",
      [fixture.recodeId, existingSection.rows[0].id, priorPlanId],
    );

    app = express();
    process.env.CATALOGUE_IMPORT_TARGET_ID = TARGET_ID;
    importer = await import("../server/catalogue-importer");
    importer.registerCatalogueImporterRoutes(app);
  });

  afterAll(async () => {
    databaseState.db = null;
    await pool?.end();
    await stopLocalPostgres();
    delete process.env.CATALOGUE_IMPORT_TARGET_ID;
  });

  it("permits only an authenticated administrator to stage/review the isolated target", async () => {
    const anonymous = await request("/api/admin/catalogue-import/review", "get", null);
    expect(anonymous.status).toBe(401);

    const branchUser = await request("/api/admin/catalogue-import/stage", "post", BRANCH_USER, {
      targetId: TARGET_ID,
      reviewAcknowledgement: "CATALOGUE_REVIEWED",
      approvals: approvals(),
    });
    expect(branchUser.status).toBe(403);

    const adminReview = await request("/api/admin/catalogue-import/review", "get", ADMIN);
    expect(adminReview.status).toBe(200);
    expect(adminReview.body.targetId).toBe(TARGET_ID);
  });

  it("rejects a staged plan when its in-memory source checksum becomes stale", async () => {
    const plan = await stagePlan();
    const backupId = await completedBackup(plan);
    installMockSources("changed");

    const response = await applyPlan(plan.id, backupId, "catalogue-source-stale-0001");
    expect(response.status).toBe(409);
    expect(response.body.error).toContain("مصدر الكتالوج تغير");
    expect((await pool.query("SELECT status FROM catalogue_import_plans WHERE id = $1", [plan.id])).rows[0].status)
      .toBe("staged");
    installMockSources();
  });

  it("refuses to stage a client review after its source checksum changes", async () => {
    const review = await reviewedCatalogue();
    installMockSources("changed");

    const response = await request("/api/admin/catalogue-import/stage", "post", ADMIN, {
      targetId: TARGET_ID,
      sourceChecksum: review.sourceChecksum,
      snapshotChecksum: review.snapshotChecksum,
      reviewAcknowledgement: "CATALOGUE_REVIEWED",
      approvals: approvals(),
    });
    expect(response.status).toBe(409);
    expect(response.body.error).toContain("بيانات مراجعة العميل قديمة");
    installMockSources();
  });

  it("rejects a staged plan when the target snapshot changes before apply", async () => {
    const plan = await stagePlan();
    const backupId = await completedBackup(plan);
    await pool.query("UPDATE products SET name = 'Changed after staging' WHERE id = $1", [fixture.recodeId]);

    const response = await applyPlan(plan.id, backupId, "catalogue-snapshot-stale-01");
    expect(response.status).toBe(409);
    expect(response.body.error).toContain("كتالوج الهدف تغير");
    await pool.query("UPDATE products SET name = 'Recode item' WHERE id = $1", [fixture.recodeId]);
  });

  it("handles a missing backup as a validation refusal rather than an outer-join lock error", async () => {
    const plan = await stagePlan();
    const response = await applyPlan(plan.id, 999999, "catalogue-missing-backup-1");
    expect(response.status).toBe(409);
    expect(response.body.error).toContain("نسخة احتياطية");
    expect((await pool.query("SELECT status FROM catalogue_import_plans WHERE id = $1", [plan.id])).rows[0].status)
      .toBe("staged");
  });

  it("refuses a completed backup whose immutable manifest is bound to another target", async () => {
    const plan = await stagePlan();
    const backupId = await completedBackup(plan, "f".repeat(64));
    const response = await applyPlan(plan.id, backupId, "catalogue-wrong-target-backup");
    expect(response.status).toBe(409);
    expect(response.body.error).toContain("النسخة الاحتياطية لا تثبت");
    expect((await pool.query("SELECT status FROM catalogue_import_plans WHERE id = $1", [plan.id])).rows[0].status)
      .toBe("staged");
  });

  it("stages, applies once under concurrent requests, and safely replays without rewriting metadata", async () => {
    const before = await pool.query(`
      SELECT id, sku, name, unit, category, base_price, is_active, description, image_url, nutrition
      FROM products WHERE id = $1
    `, [fixture.recodeId]);
    const exactBefore = await pool.query(`
      SELECT id, sku, name, unit, category, base_price, is_active, description, image_url, nutrition
      FROM products WHERE sku = 'P-KEEP'
    `);
    const warehouseBefore = await pool.query(`
      SELECT id, sku, name, unit, category, current_stock, is_active, supplier, reorder_level
      FROM warehouse_items WHERE id = $1
    `, [fixture.warehouseId]);
    const plan = await stagePlan();
    const backupId = await completedBackup(plan);
    const idempotencyKey = `catalogue-concurrent-${randomUUID()}`;

    const responses = await Promise.all([
      applyPlan(plan.id, backupId, idempotencyKey),
      applyPlan(plan.id, backupId, idempotencyKey),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 200]);
    expect(responses.filter((response) => response.body.replayed === false)).toHaveLength(1);
    expect(responses.filter((response) => response.body.replayed === true)).toHaveLength(1);

    const recoded = await pool.query(`
      SELECT id, sku, name, unit, category, base_price, is_active, description, image_url, nutrition
      FROM products WHERE id = $1
    `, [fixture.recodeId]);
    expect(recoded.rows[0]).toMatchObject({
      ...before.rows[0],
      sku: "P-RECODE",
      nutrition: { allergens: ["milk"] },
    });
    expect((await pool.query("SELECT id FROM product_prices WHERE id = $1 AND product_id = $2", [
      fixture.productPriceId, fixture.recodeId,
    ])).rowCount).toBe(1);
    expect((await pool.query("SELECT id FROM product_history WHERE id = $1 AND product_id = $2", [
      fixture.productHistoryId, fixture.recodeId,
    ])).rowCount).toBe(1);
    expect((await pool.query("SELECT id FROM products WHERE id = $1", [fixture.legacyId])).rowCount).toBe(0);
    expect((await pool.query(
      "SELECT is_active, base_price FROM products WHERE sku = 'P-ADD'",
    )).rows[0]).toMatchObject({ is_active: "false", base_price: null });
    expect((await pool.query(
      "SELECT is_active, unit_price FROM warehouse_items WHERE sku = 'W-ADD'",
    )).rows[0]).toMatchObject({ is_active: false, unit_price: null });
    expect((await pool.query(`
      SELECT id, sku, name, unit, category, base_price, is_active, description, image_url, nutrition
      FROM products WHERE sku = 'P-KEEP'
    `)).rows[0]).toMatchObject(exactBefore.rows[0]);
    expect((await pool.query(`
      SELECT id, sku, name, unit, category, current_stock, is_active, supplier, reorder_level
      FROM warehouse_items WHERE id = $1
    `, [
      fixture.warehouseId,
    ])).rows[0]).toMatchObject(warehouseBefore.rows[0]);

    const sections = await pool.query(`
      SELECT s.name FROM product_usage_sections pus
      JOIN catalogue_usage_sections s ON s.id = pus.usage_section_id
      WHERE pus.product_id = $1 ORDER BY s.name
    `, [fixture.recodeId]);
    expect(sections.rows.map((row) => row.name)).toEqual(["Existing section", "Lunch"]);
    expect((await pool.query(
      "SELECT count(*)::int AS count FROM system_audit_logs WHERE module = 'catalogue_import' AND entity_id = $1",
      [plan.id],
    )).rows[0].count).toBe(1);
  });

  it("globally serializes distinct plans so the second plan observes the first plan's snapshot change", async () => {
    const firstLegacy = await pool.query(`
      INSERT INTO products (sku, name, unit, category) VALUES ('RACE-A', 'Race legacy A', 'piece', 'finish')
      RETURNING id
    `);
    const secondLegacy = await pool.query(`
      INSERT INTO products (sku, name, unit, category) VALUES ('RACE-B', 'Race legacy B', 'piece', 'finish')
      RETURNING id
    `);
    const firstId = Number(firstLegacy.rows[0].id);
    const secondId = Number(secondLegacy.rows[0].id);
    const legacyApproval = (currentId: number, action: "hard_delete" | "defer") => ({
      namespace: "products" as const,
      action,
      currentId,
      reason: action === "hard_delete" ? "Unused after reviewer inspection" : "Reserved for the other reviewed plan",
      reviewAcknowledgement: "LEGACY_RECORD_REVIEWED",
    });
    const review = await reviewedCatalogue();
    const firstPlan = await stagePlan(review, [
      legacyApproval(firstId, "hard_delete"),
      legacyApproval(secondId, "defer"),
    ]);
    const secondPlan = await stagePlan(review, [
      legacyApproval(firstId, "defer"),
      legacyApproval(secondId, "hard_delete"),
    ]);
    const [firstBackup, secondBackup] = await Promise.all([
      completedBackup(firstPlan),
      completedBackup(secondPlan),
    ]);

    const responses = await Promise.all([
      applyPlan(firstPlan.id, firstBackup, `catalogue-distinct-a-${randomUUID()}`),
      applyPlan(secondPlan.id, secondBackup, `catalogue-distinct-b-${randomUUID()}`),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(responses.find((response) => response.status === 409)?.body.error).toContain("كتالوج الهدف تغير");
    expect((await pool.query("SELECT id FROM products WHERE id IN ($1, $2)", [firstId, secondId])).rowCount).toBe(1);
  });

  it("stores hostile administrator text as data instead of SQL syntax", async () => {
    const hostileCode = "P-RECODE'); DROP TABLE products; --";
    await applyOperation({
      namespace: "products",
      action: "adopt_code",
      currentId: fixture.recodeId,
      sourceCode: hostileCode,
      usageSections: [],
    });
    expect((await pool.query("SELECT sku FROM products WHERE id = $1", [fixture.recodeId])).rows[0].sku)
      .toBe(hostileCode);
    expect((await pool.query("SELECT count(*)::int AS count FROM products")).rows[0].count).toBeGreaterThan(0);
    await pool.query("UPDATE products SET sku = 'P-RECODE' WHERE id = $1", [fixture.recodeId]);
  });

  it("refuses a new branch-stock association for an inactive catalogue item", async () => {
    const item = await pool.query(
      "INSERT INTO warehouse_items (sku,name,unit,is_active) VALUES ('INACTIVE-STOCK','Archived','kg',false) RETURNING id",
    );
    const id = item.rows[0].id;
    await expect(updateCatalogueBranchStock(database as any, "new-branch", id, 2))
      .rejects.toBeInstanceOf(InactiveBranchStockReferenceError);
    expect((await pool.query("SELECT id FROM branch_stock WHERE item_id=$1", [id])).rowCount).toBe(0);
    await pool.query("INSERT INTO branch_stock (branch_id,item_id,current_quantity) VALUES ('old-branch',$1,3)", [id]);
    const edited = await updateCatalogueBranchStock(database as any, "old-branch", id, 4);
    expect(Number(edited.currentQuantity)).toBe(4);
  });

  it("serializes concurrent stock upserts and rechecks committed deactivation before inserting", async () => {
    const item = await pool.query(
      "INSERT INTO warehouse_items (sku,name,unit,is_active) VALUES ('CONCURRENT-STOCK','Concurrent','kg',true) RETURNING id",
    );
    const id = item.rows[0].id;
    await Promise.all([
      updateCatalogueBranchStock(database as any, "same-branch", id, 2),
      updateCatalogueBranchStock(database as any, "same-branch", id, 3),
    ]);
    expect((await pool.query("SELECT id FROM branch_stock WHERE branch_id='same-branch' AND item_id=$1", [id])).rowCount).toBe(1);
    const writer = await pool.connect();
    try {
      await writer.query("BEGIN");
      await writer.query("UPDATE warehouse_items SET is_active=false WHERE id=$1", [id]);
      const waiting = updateCatalogueBranchStock(database as any, "different-branch", id, 1);
      const rejection = expect(waiting).rejects.toBeInstanceOf(InactiveBranchStockReferenceError);
      await writer.query("COMMIT");
      await rejection;
      expect((await pool.query("SELECT id FROM branch_stock WHERE branch_id='different-branch' AND item_id=$1", [id])).rowCount).toBe(0);
    } finally {
      await writer.query("ROLLBACK");
      writer.release();
    }
  });

  it("refuses destructive operations for FK, non-FK/history, open-operation, and balance references", async () => {
    const fkProduct = await pool.query(
      "INSERT INTO products (sku, name, unit) VALUES ('BLOCK-FK', 'FK blocker', 'piece') RETURNING id",
    );
    await pool.query("INSERT INTO product_prices (product_id, price) VALUES ($1, 1)", [fkProduct.rows[0].id]);
    const fkProof = await proveUnused("products", Number(fkProduct.rows[0].id));
    expect(fkProof.proven).toBe(false);
    expect(fkProof.blockers).toContain("fk:product_prices.product_id");

    const historyProduct = await pool.query(
      "INSERT INTO products (sku, name, unit) VALUES ('BLOCK-HISTORY', 'History blocker', 'piece') RETURNING id",
    );
    await pool.query("INSERT INTO product_history (product_id, event) VALUES ($1, 'historic sale')", [
      historyProduct.rows[0].id,
    ]);
    const historyProof = await proveUnused("products", Number(historyProduct.rows[0].id));
    expect(historyProof.proven).toBe(false);
    expect(historyProof.blockers).toContain("fk:product_history.product_id");

    const openProduct = await pool.query(
      "INSERT INTO products (sku, name, unit) VALUES ('BLOCK-OPEN', 'Open blocker', 'piece') RETURNING id",
    );
    await pool.query("INSERT INTO product_operations (product_id, status) VALUES ($1, 'pending')", [
      openProduct.rows[0].id,
    ]);
    const openProof = await proveUnused("products", Number(openProduct.rows[0].id));
    expect(openProof.proven).toBe(false);
    expect(openProof.blockers).toContain("open_operation:product_operations");
    await expect(applyOperation({
      namespace: "products",
      action: "hard_delete",
      currentId: Number(openProduct.rows[0].id),
      usageSections: [],
    })).rejects.toThrow("تعذر إثبات");
    expect((await pool.query("SELECT id FROM products WHERE id = $1", [openProduct.rows[0].id])).rowCount).toBe(1);

    const nonFkProduct = await pool.query(
      "INSERT INTO products (sku, name, unit) VALUES ('BLOCK-NONFK', 'Non FK blocker', 'piece') RETURNING id",
    );
    await pool.query("INSERT INTO pos_refund_items (product_id, quantity) VALUES ($1, 1)", [
      nonFkProduct.rows[0].id,
    ]);
    const nonFkProof = await proveUnused("products", Number(nonFkProduct.rows[0].id));
    expect(nonFkProof.proven).toBe(false);
    expect(nonFkProof.blockers).toContain("reference:pos_refund_items.product_id");

    const balancedWarehouse = await pool.query(
      "INSERT INTO warehouse_items (sku, name, unit, current_stock) VALUES ('BLOCK-STOCK', 'Stock blocker', 'kg', 0) RETURNING id",
    );
    await pool.query("INSERT INTO branch_stock (item_id, current_quantity) VALUES ($1, 3)", [
      balancedWarehouse.rows[0].id,
    ]);
    const balanceProof = await proveUnused("warehouse", Number(balancedWarehouse.rows[0].id));
    expect(balanceProof.proven).toBe(false);
    expect(balanceProof.blockers).toContain("branch_stock_balance");
  });

  it("permits truly unused catalogue IDs despite unrelated numeric item_id columns", async () => {
    const unrelatedAssembly = await pool.query("INSERT INTO assembly_resolution_items DEFAULT VALUES RETURNING id");
    const unrelatedChecklist = await pool.query("INSERT INTO checklist_items DEFAULT VALUES RETURNING id");
    await pool.query("INSERT INTO assembly_resolution_votes (item_id) VALUES ($1)", [unrelatedAssembly.rows[0].id]);
    await pool.query("INSERT INTO shift_checklist_responses (item_id) VALUES ($1)", [unrelatedChecklist.rows[0].id]);

    const unusedProduct = await pool.query(
      "INSERT INTO products (sku, name, unit) VALUES ('UNUSED-PRODUCT', 'Unused product', 'piece') RETURNING id",
    );
    const unusedWarehouse = await pool.query(
      "INSERT INTO warehouse_items (sku, name, unit) VALUES ('UNUSED-WAREHOUSE', 'Unused warehouse', 'kg') RETURNING id",
    );
    expect((await proveUnused("products", Number(unusedProduct.rows[0].id))).proven).toBe(true);
    const warehouseProof = await proveUnused("warehouse", Number(unusedWarehouse.rows[0].id));
    expect(warehouseProof.proven, JSON.stringify(warehouseProof)).toBe(true);
    await applyOperation({
      namespace: "products",
      action: "hard_delete",
      currentId: Number(unusedProduct.rows[0].id),
      usageSections: [],
    });
    await applyOperation({
      namespace: "warehouse",
      action: "hard_delete",
      currentId: Number(unusedWarehouse.rows[0].id),
      usageSections: [],
    });
    expect((await pool.query("SELECT id FROM products WHERE id = $1", [unusedProduct.rows[0].id])).rowCount).toBe(0);
    expect((await pool.query("SELECT id FROM warehouse_items WHERE id = $1", [unusedWarehouse.rows[0].id])).rowCount).toBe(0);
  });

  it("fails closed when a future numeric semantic column lacks an FK or reviewed policy", async () => {
    await pool.query("CREATE TABLE future_product_links (id serial PRIMARY KEY, product_id integer NOT NULL)");
    const candidate = await pool.query(
      "INSERT INTO products (sku, name, unit) VALUES ('FUTURE-LINK', 'Future link candidate', 'piece') RETURNING id",
    );
    const proof = await proveUnused("products", Number(candidate.rows[0].id));
    expect(proof.proven).toBe(false);
    expect(proof.blockers).toContain("unregistered_semantic_reference:future_product_links.product_id");
  });
});