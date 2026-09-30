import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
vi.mock("../client/src/components/central-kitchen/operations-board", () => ({ OperationsBoard: () => null }));
vi.mock("../client/src/components/central-kitchen/production-planning", () => ({ ProductionPlanning: () => null }));
import { CycleState } from "../client/src/components/central-kitchen/production-cycle";

describe("production cycle source UI and authorized deep links", () => {
  it("prioritizes daily execution and collapses secondary tracking without repeated scope controls", () => {
    const source = readFileSync("client/src/components/central-kitchen/production-cycle.tsx", "utf8");
    const css = readFileSync("client/src/components/central-kitchen/production-workspace.css", "utf8");
    expect(source.indexOf('aria-label="تنفيذ الإنتاج اليومي"')).toBeLessThan(source.indexOf('data-testid="cycle-order-tracking"'));
    expect(source).toContain('<OperationsBoard key={kitchenId} embedded');
    expect(source).toContain('embedded mode="planning"');
    expect(source).not.toContain('className="rounded-xl border bg-card p-3" open');
    expect(css).toContain('--desk-accent: var(--color-primary');
    expect(css).not.toContain("#edf3f1");
    expect(readFileSync("client/src/pages/production-dashboard.tsx", "utf8")).toContain('<Tabs dir="rtl"');
  });
  const render = (loading: boolean, error: Error | null, empty = false) =>
    renderToStaticMarkup(React.createElement(CycleState, { loading, error, empty, retry: vi.fn(), children: React.createElement("p", null, "cached-sensitive-data") }));
  it("hides cached children after a forbidden refresh and renders explicit retry", () => {
    const html = render(false, new Error("غير مصرح"));
    expect(html).toContain('role="alert"');
    expect(html).toContain("إعادة المحاولة");
    expect(html).not.toContain("cached-sensitive-data");
  });
  it("distinguishes pending, empty and successful sources", () => {
    expect(render(true, null)).toContain('role="status"');
    expect(render(true, null)).not.toContain("cached-sensitive-data");
    expect(render(false, null, true)).toContain("ليس إثباتًا لاكتمال الدورة");
    expect(render(false, null)).toContain("cached-sensitive-data");
  });
  it("uses server-authorized exact reverse movement lookup, not the capped list", () => {
    const page = readFileSync("client/src/pages/reverse-logistics.tsx", "utf8");
    const server = readFileSync("server/reverse-logistics-routes.ts", "utf8");
    expect(page).toContain('params.get("movementId")');
    expect(page).toContain('get(`/api/reverse-logistics/${movementId}`)');
    const detail = server.slice(server.indexOf('app.get("/api/reverse-logistics/:id"'), server.indexOf('app.post("/api/reverse-logistics"'));
    expect(detail).toContain("...warehouseView");
    expect(detail).toContain('branchGrant(req,row.kind,"view")');
    expect(detail).toContain('throw new Reject("Branch access denied",403)');
    expect(detail).toContain("AS quarantine_quantity");
    expect(detail).toContain("AS shortage_quantity");
  });
  it("filters authorized kitchen before movement source limits without claiming complete totals", () => {
    const shipping = readFileSync("server/kitchen-warehouse-shipping-routes.ts", "utf8");
    const returns = readFileSync("server/reverse-logistics-routes.ts", "utf8");
    const source = readFileSync("client/src/components/central-kitchen/production-cycle.tsx", "utf8");
    expect(shipping).toContain('if (kitchenId && !inScope(req, kitchenId))');
    expect(shipping).toMatch(/AND \(\$3::varchar IS NULL OR s.source_branch_id=\$3\)\s+ORDER BY s.id DESC LIMIT 500/);
    expect(returns).toContain('if (kitchenId && !scope(req,kitchenId))');
    expect(returns).toMatch(/AND \(\$4::varchar IS NULL OR source_branch_id=\$4 OR destination_branch_id=\$4\)\s+ORDER BY m.id DESC LIMIT 250/);
    expect(source).toContain("/api/kitchen-warehouse-shipping?kitchenId=");
    expect(source).toContain("/api/reverse-logistics?kitchenId=");
    expect(source).toContain("قد تغيب سجلات أقدم");
  });
});