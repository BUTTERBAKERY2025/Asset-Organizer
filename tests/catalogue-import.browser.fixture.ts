/**
 * Browser verification for the catalogue-import route.
 *
 * This is deliberately not connected to server/index.ts, storage, migrations,
 * or a database. It serves the already-built React application from
 * dist/public and supplies a clearly-labelled, in-memory synthetic API fixture.
 *
 *   npm run test:catalogue-import:browser
 *   npx tsx tests/catalogue-import.browser.fixture.ts --serve
 *
 * The --serve form is useful for a reviewer screenshot at
 * http://127.0.0.1:5000/catalogue-import. Stop it with Ctrl-C when finished.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { dirname, resolve } from "node:path";
import express from "express";
import puppeteer, { type Page } from "puppeteer";

const port = Number(process.env.CATALOGUE_IMPORT_FIXTURE_PORT ?? 5000);
const publicRoot = resolve(process.cwd(), "dist/public");
const indexFile = resolve(publicRoot, "index.html");
// Replit supplies Chromium at this path while Puppeteer's optional downloaded
// Chrome cache is intentionally absent in lightweight workspaces. A caller can
// override this for another CI environment.
const replitChromium = "/repl/tools/bin/chromium";
const browserExecutable = process.env.PUPPETEER_EXECUTABLE_PATH
  ?? (existsSync(replitChromium) ? replitChromium : undefined);
const fixtureLabel = "SYNTHETIC TEST-ONLY CATALOGUE IMPORT FIXTURE";
const targetId = "fixture-catalogue-target-task-74";
const sourceChecksum = "a".repeat(64);
const snapshotChecksum = "b".repeat(64);
const planId = "fixture-catalogue-plan-task-74";
const expectedApproval = {
  namespace: "products",
  action: "adopt_code",
  sourceCode: "FIXTURE-SOURCE-ARBITRARY",
  currentId: 731,
  identityAcknowledgement: "MANUAL_IDENTITY_CONFIRMED",
  reason: "Fixture reviewer manually verified this arbitrary internal identity.",
};

type StageRequest = {
  targetId?: string;
  sourceChecksum?: string;
  snapshotChecksum?: string;
  reviewAcknowledgement?: string;
  approvals?: unknown[];
};

type ApplyRequest = {
  targetId?: string;
  backupId?: number;
  applyConfirmation?: string;
};

type FixtureState = {
  staleNextStage: boolean;
  stageRequests: StageRequest[];
  applyRequests: Array<{ body: ApplyRequest; idempotencyKey?: string }>;
  appliedKey?: string;
};

function fixtureReview() {
  return {
    fixture: fixtureLabel,
    targetId,
    sourceChecksum,
    snapshotChecksum,
    currentCatalogues: {
      products: [
        {
          id: 731,
          sku: "FIXTURE-INTERNAL-731",
          name: "Fixture arbitrary internal identity",
          unit: "piece",
        },
      ],
      warehouse: [],
    },
    reconciliation: {
      sourceTotals: {
        products: { rows: 2, unique: 2, duplicateRows: 0 },
        warehouse: { rows: 0, unique: 0, duplicateRows: 0 },
        categories: { rows: 0, entries: 0, unmatched: 0 },
      },
      productRows: [
        {
          namespace: "products",
          status: "review",
          sourceCode: "FIXTURE-SOURCE-ARBITRARY",
          sourceName: "Synthetic source item requiring a reviewer choice",
          sourceUnit: "piece",
          issues: [{ code: "fixture_manual_choice", message: "Synthetic fixture: select an arbitrary current ID manually." }],
        },
        {
          namespace: "products",
          status: "exact_match",
          sourceCode: "FIXTURE-EXACT-001",
          sourceName: "Synthetic exact-match item",
          sourceUnit: "piece",
          currentId: 732,
          currentRecord: { id: 732, sku: "FIXTURE-EXACT-001", name: "Synthetic exact-match item", unit: "piece" },
        },
      ],
      warehouseRows: [],
      legacyRows: [],
    },
  };
}

function stagedPlan(status: "staged" | "applied" = "staged", replayed = false) {
  const summary = {
    appliedAt: "2026-01-01T00:00:00.000Z",
    actorId: "fixture-admin-task-74",
    backupId: 741,
    counts: { keep: 1, adopt_code: 1, add: 0, deactivate: 0, hard_delete: 0, defer: 0 },
    rollbackPlan: {
      reversibleMetadataOperations: 1,
      irreversibleHardDeletes: 0,
      notes: ["Synthetic fixture only; no database operation occurred."],
    },
  };
  return {
    id: planId,
    status,
    targetId,
    sourceChecksum,
    snapshotChecksum,
    planChecksum: "c".repeat(64),
    reviewRequiredCount: 0,
    operations: [
      { namespace: "products", action: "keep", sourceCode: "FIXTURE-EXACT-001", currentId: 732 },
      { namespace: "products", action: "adopt_code", sourceCode: "FIXTURE-SOURCE-ARBITRARY", currentId: 731 },
    ],
    rollbackPlan: summary.rollbackPlan,
    ...(status === "applied" ? { summary, appliedSummary: summary, replayed } : {}),
  };
}

function assertValidStagePayload(body: StageRequest) {
  assert.equal(body.targetId, targetId);
  assert.equal(body.sourceChecksum, sourceChecksum);
  assert.equal(body.snapshotChecksum, snapshotChecksum);
  assert.equal(body.reviewAcknowledgement, "CATALOGUE_REVIEWED");
  assert.deepEqual(body.approvals, [expectedApproval]);
}

function createFixtureServer() {
  const app = express();
  const state: FixtureState = { staleNextStage: true, stageRequests: [], applyRequests: [] };
  const syntheticUser = {
    id: "fixture-admin-task-74",
    username: "synthetic-fixture-admin",
    name: "Synthetic Fixture Admin",
    role: "admin",
  };
  const init = {
    fixture: fixtureLabel,
    user: syntheticUser,
    branches: [],
    permissions: [{ module: "settings", actions: ["view", "create", "edit", "delete", "approve"] }],
  };

  app.disable("x-powered-by");
  app.use(express.json());
  app.use((_, res, next) => {
    res.setHeader("X-Catalogue-Import-Fixture", fixtureLabel);
    next();
  });

  app.get("/__catalogue-import-fixture/status", (_, res) => {
    res.json({
      fixture: fixtureLabel,
      mode: "in-memory; no production app, database, migration, or scheduler",
      route: "/catalogue-import",
      staleNextStage: state.staleNextStage,
      stageRequests: state.stageRequests.length,
      applyRequests: state.applyRequests.length,
    });
  });
  app.post("/__catalogue-import-fixture/stage-mode", (req, res) => {
    state.staleNextStage = req.body?.stale === true;
    res.json({ fixture: fixtureLabel, staleNextStage: state.staleNextStage });
  });

  app.get("/api/auth/init", (_, res) => res.json(init));
  app.get("/api/auth/me", (_, res) => res.json(syntheticUser));
  app.get("/api/branches", (_, res) => res.json([]));
  app.get("/api/my-permissions", (_, res) => res.json(init.permissions));
  app.get("/api/permissions", (_, res) => res.json(init.permissions));
  app.get("/api/backups", (_, res) => res.json([
    { id: 741, name: "Synthetic fixture backup after staged plan", status: "completed", createdAt: "2026-01-01T00:01:00.000Z" },
  ]));
  app.get("/api/admin/catalogue-import/review", (_, res) => res.set("Cache-Control", "no-store").json(fixtureReview()));

  app.post("/api/admin/catalogue-import/stage", (req, res) => {
    const body = req.body as StageRequest;
    state.stageRequests.push(body);
    try {
      assertValidStagePayload(body);
    } catch (error) {
      return res.status(400).json({ error: `Fixture rejected malformed stage payload: ${(error as Error).message}` });
    }
    if (state.staleNextStage) {
      return res.status(409).json({ error: "بيانات مراجعة العميل قديمة؛ أعد تحميل المراجعة قبل تجهيز الخطة (synthetic fixture)" });
    }
    return res.status(201).json(stagedPlan());
  });

  app.post("/api/admin/catalogue-import/plans/:requestedPlanId/apply", (req, res) => {
    const body = req.body as ApplyRequest;
    const idempotencyKey = req.header("Idempotency-Key");
    state.applyRequests.push({ body, idempotencyKey });
    if (
      req.params.requestedPlanId !== planId
      || body.targetId !== targetId
      || body.backupId !== 741
      || body.applyConfirmation !== `APPLY_CATALOGUE_${planId}`
      || !idempotencyKey
    ) {
      return res.status(400).json({ error: "Fixture rejected malformed apply payload." });
    }
    if (!state.appliedKey) {
      state.appliedKey = idempotencyKey;
      return res.json(stagedPlan("applied", false));
    }
    if (state.appliedKey !== idempotencyKey) {
      return res.status(409).json({ error: "Fixture rejects a different idempotency key for the applied plan." });
    }
    return res.json(stagedPlan("applied", true));
  });

  app.use(express.static(publicRoot, { index: false }));
  app.get("*", (_, res) => res.sendFile(indexFile));
  return { server: createServer(app), state };
}

async function listen(server: Server): Promise<void> {
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, process.argv.includes("--serve") ? "0.0.0.0" : "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
}

async function selectRadixOption(page: Page, trigger: string, expectedText: string) {
  await page.waitForSelector(trigger, { visible: true });
  await page.click(trigger);
  try {
    await page.waitForFunction(
      (selector) => document.querySelector(selector)?.getAttribute("aria-expanded") === "true",
      { timeout: 1_500 },
      trigger,
    );
  } catch {
    // A just-mounted Dialog can briefly claim pointer focus. Keyboard opening
    // remains a normal, accessible interaction with the real Select control.
    await page.focus(trigger);
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(
      (selector) => document.querySelector(selector)?.getAttribute("aria-expanded") === "true",
      {},
      trigger,
    );
  }
  await page.waitForSelector('[role="option"]', { visible: true });
  const options = await page.$$('[role="option"]');
  for (const option of options) {
    const text = await option.evaluate((element) => element.textContent ?? "");
    if (text.includes(expectedText)) {
      await option.click();
      await page.waitForFunction(
        (selector) => document.querySelector(selector)?.getAttribute("aria-expanded") === "false",
        {},
        trigger,
      );
      // Radix keeps the closing portal in the document briefly. Waiting for it
      // to unmount prevents the next picker click being intercepted by it.
      await page.waitForFunction(() => !document.querySelector('[role="option"]'));
      return;
    }
  }
  throw new Error(`Radix option containing "${expectedText}" was not found.`);
}

async function clickTextRole(page: Page, role: string, expectedText: string) {
  const elements = await page.$$(`[role="${role}"]`);
  for (const element of elements) {
    const text = await element.evaluate((node) => node.textContent ?? "");
    if (text.includes(expectedText)) {
      await element.click();
      return;
    }
  }
  throw new Error(`${role} containing "${expectedText}" was not found.`);
}

async function verifyBrowser(state: FixtureState) {
  const browser = await puppeteer.launch({ headless: true, executablePath: browserExecutable });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
    // PWA/push prompts are unrelated global UI overlays. Suppress only their
    // local browser prompts so clicks exercise the catalogue route itself.
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem("pwa-prompt-dismissed", String(Date.now()));
      localStorage.setItem("push-prompt-dismissed", "1");
      localStorage.setItem("push-ios-guide-dismissed", "1");
    });
    await page.goto(`http://127.0.0.1:${port}/catalogue-import`, { waitUntil: "networkidle0" });

    await page.waitForSelector('[data-testid="catalogue-review-products:source:FIXTURE-SOURCE-ARBITRARY"]');
    assert.match(await page.evaluate(() => document.body.innerText), /مراجعة واعتماد كتالوج الأصناف/);

    await selectRadixOption(page, '[data-testid="select-source-action-FIXTURE-SOURCE-ARBITRARY"]', "ربط بسجل حالي");
    await selectRadixOption(page, '[data-testid="select-current-id-FIXTURE-SOURCE-ARBITRARY"]', "#731");
    await page.type(
      '[data-testid="input-identity-reason-FIXTURE-SOURCE-ARBITRARY"]',
      expectedApproval.reason,
    );
    await page.click('[data-testid="checkbox-identity-confirmed-FIXTURE-SOURCE-ARBITRARY"]');
    await clickTextRole(page, "tab", "الخطة والتدقيق");
    await page.click('[data-testid="checkbox-catalogue-review-acknowledgement"]');

    // The first real UI submit intentionally receives a stale-review response.
    await page.click('[data-testid="button-stage-catalogue-plan"]');
    await page.waitForFunction(() => document.body.innerText.includes("بيانات مراجعة العميل قديمة"));
    assert.equal(state.stageRequests.length, 1);
    assertValidStagePayload(state.stageRequests[0]);

    // Enable the same fixture plan only after its visible stale error was tested.
    await page.evaluate(() => fetch("/__catalogue-import-fixture/stage-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stale: false }),
    }));
    await page.click('[data-testid="button-stage-catalogue-plan"]');
    await page.waitForSelector('[data-testid="button-open-catalogue-apply"]');
    assert.equal(state.stageRequests.length, 2);
    assertValidStagePayload(state.stageRequests[1]);

    await page.click('[data-testid="button-open-catalogue-apply"]');
    await page.waitForSelector('[data-testid="select-catalogue-backup"]');
    await selectRadixOption(page, '[data-testid="select-catalogue-backup"]', "Synthetic fixture backup");
    await page.click('[data-testid="checkbox-catalogue-target-acknowledgement"]');
    await page.click('[data-testid="checkbox-catalogue-backup-acknowledgement"]');
    await page.type('[data-testid="input-catalogue-apply-confirm"]', `APPLY_CATALOGUE_${planId}`);
    await page.click('[data-testid="button-apply-catalogue-plan"]');
    await page.waitForFunction(() => document.body.innerText.includes("نتيجة التدقيق وخطة التراجع"));

    assert.equal(state.applyRequests.length, 1);
    const firstApply = state.applyRequests[0];
    assert.equal(firstApply.idempotencyKey, state.appliedKey);
    assert.deepEqual(firstApply.body, {
      targetId,
      backupId: 741,
      applyConfirmation: `APPLY_CATALOGUE_${planId}`,
    });

    // Replay the actual browser request with its captured UI-generated key.
    const replay = await page.evaluate(async ({ key, body, requestPlanId }) => {
      const response = await fetch(`/api/admin/catalogue-import/plans/${requestPlanId}/apply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    }, { key: firstApply.idempotencyKey!, body: firstApply.body, requestPlanId: planId });
    assert.equal(replay.status, 200);
    assert.equal(replay.body.replayed, true);
    assert.equal(state.applyRequests.length, 2);
    assert.equal(state.applyRequests[1].idempotencyKey, firstApply.idempotencyKey);

    const screenshotPath = process.env.CATALOGUE_IMPORT_SCREENSHOT;
    if (screenshotPath) {
      await mkdir(dirname(resolve(screenshotPath)), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  if (!existsSync(indexFile)) {
    throw new Error("dist/public/index.html is required. Build the frontend first; this fixture never starts the production app.");
  }
  if (!readFileSync(indexFile, "utf8").includes("/assets/index-")) {
    throw new Error("dist/public/index.html does not look like a compiled Vite application.");
  }

  const { server, state } = createFixtureServer();
  await listen(server);
  const url = `http://127.0.0.1:${port}/catalogue-import`;
  const statusUrl = `http://127.0.0.1:${port}/__catalogue-import-fixture/status`;
  console.log(`${fixtureLabel}\nroute: ${url}\nstatus: ${statusUrl}`);

  if (process.argv.includes("--serve")) {
    const stop = () => server.close(() => process.exit(0));
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    return;
  }

  try {
    await verifyBrowser(state);
    console.log("Catalogue-import browser fixture verification passed.");
  } finally {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});