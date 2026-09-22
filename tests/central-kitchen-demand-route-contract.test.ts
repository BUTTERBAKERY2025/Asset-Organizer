import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const routeSource = await readFile(new URL("../server/central-kitchen-demand-routes.ts", import.meta.url), "utf8");
const migrationSource = await readFile(new URL("../migrations/central_kitchen_unmet_demand_commitments.sql", import.meta.url), "utf8");

describe("central kitchen unmet-demand route security contract", () => {
  it("authenticates every demand endpoint and applies explicit module permissions", () => {
    const registrations = routeSource.match(/app\.(?:get|post)\("\/api\/central-kitchen-demand[^;]+/g) || [];
    expect(registrations.length).toBeGreaterThanOrEqual(4);
    for (const registration of registrations) {
      expect(registration).toContain("isAuthenticated");
      expect(registration).toMatch(/requirePermission\("central_kitchen_orders", "(?:view|edit|approve)"\)/);
    }
  });

  it("keeps report reads branch-scoped and branch decisions separate from kitchen replacement decisions", () => {
    expect(routeSource).toContain("getAllowedBranchIds(req)");
    expect(routeSource).toContain("centralKitchenDemandCommitments.requestBranchId");
    expect(routeSource).toContain("centralKitchenDemandCommitments.centralKitchenId");
    expect(routeSource).toContain("branchDecision ? commitment.requestBranchId : commitment.centralKitchenId");
    expect(routeSource).toContain('kitchenActionAllowed(db, currentUserId(req), routingOrder, "receive")');
    expect(routeSource).toContain('kitchenActionAllowed(db, body.data.responsibleUserId, routingOrder, "prepare")');
  });

  it("locks before allocation, caps settlement, and enforces confirmation before substitute acceptance", () => {
    expect(routeSource).toContain('.for("update")');
    expect(routeSource).toContain("if (requestedAction > available)");
    expect(routeSource).toContain("priorAccepted + requestedAction");
    expect(routeSource).toContain('locked.receiptAttributionBasis !== "branch_confirmed"');
    expect(routeSource).toContain("originalReceipt < allocated ? originalReceipt : allocated");
    expect(routeSource).toContain("activeReplacementCommitment");
    expect(routeSource).toContain('![\"cancelled\", \"received\"].includes(status)');
    expect(routeSource).toContain("effectiveStatus");
    expect(routeSource).toContain("preparedOriginal");
  });

  it("has durable idempotency at both action and generated-order layers", () => {
    expect(routeSource).toContain("payloadFingerprint");
    expect(routeSource).toContain('res.set("Idempotent-Replayed", "true")');
    expect(routeSource).toContain("centralKitchenDemandActions.idempotencyKey");
    expect(routeSource).toContain("const orderKey = `demand:${locked.id}:${body.data.idempotencyKey}`");
    expect(migrationSource).toMatch(/UNIQUE\s*\(commitment_id,\s*idempotency_key\)/i);
    expect(migrationSource).toMatch(/idempotency_key\s+varchar\(128\)\s+NOT NULL/i);
  });

  it("requires an audit reason for substitute acceptance and waiver payloads", () => {
    expect(routeSource).toContain('type: z.literal("accept_substitute")');
    expect(routeSource).toContain('type: z.literal("waive")');
    expect(routeSource.match(/reason: z\.string\(\)\.trim\(\)\.min\(3\)\.max\(1000\)/g)).toHaveLength(3);
  });
});