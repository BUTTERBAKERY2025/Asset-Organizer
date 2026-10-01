import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { PgDialect } from "drizzle-orm/pg-core";
import { branches, branchComplaints, qualityChecks } from "../shared/schema";
import { getBranchComplaintTransition } from "../shared/branch-complaints";
import { operationsDecisionBoardProjection } from "../shared/operations-center";

const state = vi.hoisted(() => ({
  grants: new Set<string>(),
  checks: [] as string[],
  queries: [] as { source: string; sql: string; params: unknown[] }[],
  complaints: [] as any[],
  quality: [] as any[],
}));

vi.mock("../server/auth", () => ({
  getAllowedBranchIds: () => ["a"],
  isAuthenticated: () => {},
  requirePermission: () => () => {},
  HR_SPECIALIST_PERMISSIONS: {},
}));
vi.mock("../server/storage", () => ({ storage: {} }));
vi.mock("../server/branch-operations", () => ({
  branchOperationsDefinitions: [],
  loadAuthorizedBranchOperationsCard: vi.fn(),
  hasEffectiveViewPermission: async (_req: Request, module: string, action = "view") => {
    state.checks.push(`${module}:${action}`);
    return state.grants.has(`${module}:${action}`);
  },
}));
vi.mock("../server/db", () => ({
  pool: {},
  db: {
    select: () => ({
      from: (table: unknown) => {
        const source = table === branches ? "branches" : table === branchComplaints ? "complaints" :
          table === qualityChecks ? "quality" : "unexpected";
        let where: any;
        const result = () => {
          const query = new PgDialect().sqlToQuery(where);
          state.queries.push({ source, sql: query.sql, params: query.params });
          if (source === "branches") return Promise.resolve([{ id: "a", name: "Branch A" }]);
          if (source === "complaints") return Promise.resolve(state.complaints.filter(row =>
            query.params.includes(row.branchId) && query.params.includes(row.status)));
          if (source === "quality") return Promise.resolve(state.quality.filter(row =>
            query.params.includes(row.branchId) && query.params.includes(row.checkDate) &&
            (!query.sql.includes('"result" in') || query.params.includes(row.result))));
          throw new Error(`Unexpected source query: ${source}`);
        };
        const builder: any = {
          where: (condition: any) => { where = condition; return builder; },
          orderBy: () => builder,
          limit: () => result(),
          then: (resolve: any, reject: any) => result().then(resolve, reject),
        };
        return builder;
      },
    }),
  },
}));

import { projectOperationsCenter } from "../server/operations-center";

const request = () => ({ currentUser: { id: "me", role: "branch_manager" } }) as Request;
const complaint = (id: number, status: string, overrides = {}) => ({
  id, branchId: "a", status, priority: "normal", owner: "me",
  due: new Date("2026-09-29T12:00:00Z"), responded: null, created: new Date("2026-09-28T12:00:00Z"),
  updated: new Date("2026-09-30T10:00:00Z"), ...overrides,
});
const project = (exportMode = false) => projectOperationsCenter(request(), ["a"], 0, exportMode);
const board = (data: Awaited<ReturnType<typeof project>>) =>
  operationsDecisionBoardProjection(data.queue, data.scope.branchIds, "me", data.generatedAt, data.businessDate);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
  state.grants = new Set(["branch_complaints:view"]);
  state.checks = [];
  state.queries = [];
  state.complaints = [];
  state.quality = [];
});
afterEach(() => vi.useRealTimers());

describe("daily-cycle server projection and its board consumer", () => {
  it("retains resolved complaints for viewers but only advertises closure to an actual approver at the resolved stage", async () => {
    state.complaints = [complaint(1, "open"), complaint(2, "in_progress"), complaint(3, "resolved"),
      complaint(4, "closed"), complaint(5, "resolved", { branchId: "b" })];
    // Assignment and an edit grant do not confer closure authority.
    state.grants.add("branch_complaints:edit");
    const readOnly = await project();
    expect(readOnly.queue.map(row => row.sourceId)).toEqual(["1", "2", "3"]);
    expect(board(readOnly).decision).toEqual([]);
    expect(readOnly.queue.every(row => !row.decision)).toBe(true);
    expect(state.checks).toContain("branch_complaints:approve");
    const query = state.queries.find(query => query.source === "complaints")!;
    expect(query.sql).toContain('"branch_complaints"."branch_id" in');
    expect(query.sql).toContain('"branch_complaints"."status" in');
    expect(query.params).toEqual(["a", "open", "in_progress", "resolved"]);
    state.grants.add("branch_complaints:approve");
    const approving = await project();
    const decisions = board(approving).decision;
    expect(decisions.map(row => row.sourceId)).toEqual(["3"]);
    expect(decisions[0].decision).toMatchObject({
      awaitingActor: true, actorId: "me", capability: "approve",
      permission: { module: "branch_complaints", action: "approve" },
      href: "/branch-complaints?branchId=a&complaintId=3",
    });
    expect(decisions[0].href).toBe(decisions[0].decision!.href);
    state.grants.delete("branch_complaints:approve");
    expect(board(await project()).decision).toEqual([]);
  });

  it("removes a complaint on close and restores the same canonical record as follow-up on reopen", async () => {
    state.grants.add("branch_complaints:approve");
    const row = complaint(11, "resolved", { responded: new Date("2026-09-29T10:00:00Z") });
    state.complaints = [row];
    const original = await project();
    expect(board(original).decision).toHaveLength(1);
    const canonicalId = original.queue[0].canonicalId;
    row.status = getBranchComplaintTransition(row.status, "close")!;
    const closed = await project();
    expect(closed.queue).toEqual([]);
    expect(board(closed).priority).toEqual([]);
    row.status = getBranchComplaintTransition(row.status, "reopen")!;
    const reopened = await project();
    expect(reopened.queue[0]).toMatchObject({ canonicalId, status: "open",
      href: "/branch-complaints?branchId=a&complaintId=11" });
    expect(board(reopened).decision).toEqual([]);
    expect(board(reopened).followup.map(row => row.sourceId)).toEqual(["11"]);
    expect(board(reopened).overdue).toEqual([]);
    expect(board(reopened).critical).toEqual([]);
  });

  it("only treats an unanswered first-response deadline as complaint overdue, distinct from source urgency", async () => {
    state.complaints = [
      complaint(11, "open"),
      complaint(12, "in_progress", { responded: new Date("2026-09-29T10:00:00Z") }),
      complaint(13, "resolved"),
      complaint(14, "open", { priority: "urgent" }),
    ];
    const data = await project();
    expect(board(data).overdue.map(row => row.sourceId)).toEqual(["11"]);
    expect(board(data).critical.map(row => row.sourceId)).toEqual(["14"]);
    expect(board(data).priority.map(row => row.sourceId)).toEqual(["14", "11"]);
    expect(data.queue.filter(row => ["12", "13"].includes(row.sourceId)).every(row => row.dueAt === null)).toBe(true);
  });

  it("keeps today-only quality evidence visible for investigation without counting it as unresolved work", async () => {
    state.grants = new Set(["quality_control:view"]);
    state.quality = [
      { id: 21, branchId: "a", result: "failed", checkDate: "2026-09-30" },
      { id: 22, branchId: "a", result: "needs_improvement", checkDate: "2026-09-30" },
      { id: 23, branchId: "a", result: "passed", checkDate: "2026-09-30" },
      { id: 24, branchId: "a", result: "failed", checkDate: "2026-09-29" },
      { id: 25, branchId: "b", result: "failed", checkDate: "2026-09-30" },
    ];
    const data = await project();
    expect(data.queue.map(row => row.sourceId)).toEqual(["21", "22"]);
    expect(data.queue[0]).toMatchObject({ title: "دليل جودة يحتاج التحقيق",
      href: "/quality-control?branchId=a&checkId=21", dueAt: null });
    expect(data.queue[0].reason).toContain("ليست مهمة قابلة للإكمال");
    expect(board(data).evidence).toHaveLength(2);
    expect(board(data).followup).toEqual([]);
    expect(board(data).decision).toEqual([]);
    expect(data.analytics?.followups.byBranch[0].count).toBe(0);
    expect(data.analytics?.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "أدلة جودة تحتاج التحقيق", source: "quality_checks.result؛ فحوص اليوم فقط" }),
    ]));
    expect(data.metrics.find(metric => metric.key === "quality.pass_rate")?.value).toBeCloseTo(100 / 3);
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    expect((await project()).queue).toEqual([]);
  });

  it("preserves module/export/branch scope gates for the repaired sources", async () => {
    state.complaints = [complaint(1, "resolved")];
    state.quality = [{ id: 2, branchId: "a", result: "failed", checkDate: "2026-09-30" }];
    state.grants = new Set(["branch_complaints:approve", "quality_control:approve"]);
    expect((await project()).queue).toEqual([]);
    expect(state.queries.map(query => query.source)).toEqual(["branches"]);
    state.grants.add("branch_complaints:view");
    state.grants.add("quality_control:view");
    state.queries = [];
    expect((await project(true)).queue).toEqual([]);
    expect(state.queries.map(query => query.source)).toEqual(["branches"]);
    state.grants.add("branch_complaints:export");
    expect((await project(true)).queue.map(row => row.sourceType)).toEqual(["branch_complaint"]);
    await expect(projectOperationsCenter(request(), ["b"], 0)).rejects.toMatchObject({ status: 403 });
  });
});