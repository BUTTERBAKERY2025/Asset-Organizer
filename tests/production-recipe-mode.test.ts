import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ execute: vi.fn(), transaction: vi.fn(), scope: vi.fn() }));
vi.mock("../server/db", () => ({ db: { execute: mocks.execute, transaction: mocks.transaction } }));
vi.mock("../server/auth", () => ({ isAuthenticated: vi.fn(), requirePermission: vi.fn(), canAccessBranch: mocks.scope }));
import { lockedRecipeMode, mayManageRecipeMode, registerProductionRecipeModeRoutes } from "../server/production-recipe-mode";
import { snapshotRecipeBackedBatchMaterials, consumeRecipeBackedBatchMaterials } from "../server/central-kitchen-batch-materials";
import { readFileSync } from "node:fs";

describe("temporary output-only production", () => {
  it("limits management, not production use, to the two designated roles", () => {
    expect(mayManageRecipeMode("admin")).toBe(true);
    expect(mayManageRecipeMode("production_development_manager")).toBe(true);
    for (const role of ["production_manager", "branch_manager", "warehouse_keeper", "operations_manager", undefined]) expect(mayManageRecipeMode(role)).toBe(false);
  });
  it("rejects toggle at the server for an ordinary production manager despite module access", async () => {
    let handler: any;
    registerProductionRecipeModeRoutes({ get: vi.fn(), patch: (_url: string, ...handlers: any[]) => { handler = handlers.at(-1); } } as any);
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler({ body: { kitchenId: "k", enabled: true, reason: "temporary setup" }, currentUser: { id: "p", role: "production_manager" } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("requires authorized kitchen scope even for the development/production manager", async () => {
    mocks.scope.mockResolvedValueOnce(false);
    let handler: any;
    registerProductionRecipeModeRoutes({ get: vi.fn(), patch: (_url: string, ...handlers: any[]) => { handler = handlers.at(-1); } } as any);
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler({ body: { kitchenId: "outside", enabled: true, reason: "temporary setup" }, currentUser: { id: "p", role: "production_development_manager" } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
  it("locks the kitchen before reading its prospective policy; default is off", async () => {
    const tx = { execute: vi.fn().mockResolvedValue({ rows: [] }) };
    expect(await lockedRecipeMode(tx, "k")).toBeNull();
    expect(tx.execute).toHaveBeenCalledTimes(2);
  });
  it("does not create recipe snapshots for database-stamped output-only batches", async () => {
    const tx = { execute: vi.fn().mockResolvedValue({ rows: [{ recipe_mode_activation_id: 12 }] }) };
    await snapshotRecipeBackedBatchMaterials(tx, { batchId: 1, kitchenId: "k", productId: 2, batchQuantity: 3, batchUnit: "piece" });
    expect(tx.execute).toHaveBeenCalledTimes(1);
  });
  it("does not debit raw stock without a recipe snapshot", async () => {
    const tx = { execute: vi.fn().mockResolvedValueOnce({ rows: [{ id: 1, branch_id: "k", recipe_backed: false }] }).mockResolvedValueOnce({ rows: [] }) };
    expect(await consumeRecipeBackedBatchMaterials(tx, { id: 1, branchId: "k" })).toBe(false);
    expect(tx.execute).toHaveBeenCalledTimes(2);
  });
  it("still rejects malformed recipe-backed evidence", async () => {
    const tx = { execute: vi.fn().mockResolvedValueOnce({ rows: [{ id: 1, branch_id: "k", recipe_backed: true }] }).mockResolvedValueOnce({ rows: [] }) };
    await expect(consumeRecipeBackedBatchMaterials(tx, { id: 1, branchId: "k" })).rejects.toThrow();
  });
  it("covers advanced creation and finish constraints without removing normal proof", () => {
    const migration = readFileSync("migrations/049_production_recipe_output_only.sql", "utf8");
    expect(migration).toContain("guard_advanced_execution_batch()");
    expect(migration).toContain("require_advanced_execution_recipe_proof()");
    expect(migration).toContain("enforce_linked_recipe_exception()");
    expect(migration).toContain("Production recipe execution mode is immutable");
    expect(migration).toContain("Output-only batch has conflicting recipe or raw movement proof");
    expect(migration).toContain("Client cannot supply recipe mode proof");
  });
});