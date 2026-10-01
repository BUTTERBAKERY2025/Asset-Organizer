import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { readFileSync } from "node:fs";

const state = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
  access: {} as Record<string, any>,
  denied: new Set<string>(),
  inserted: [] as any[],
  dedupes: new Set<string>(),
}));
vi.mock("../server/db", () => {
  const executor: any = {
    select: () => ({
      from: (table: any) => {
        const rows = () => state.tables[getTableName(table)] || [];
        const result = { limit: async () => rows(),
          then: (resolve: any, reject: any) => Promise.resolve(rows()).then(resolve, reject) };
        return { where: () => result };
      },
    }),
    insert: () => ({ values: (row: any) => ({
      onConflictDoNothing: () => ({ returning: async () => {
        if (state.dedupes.has(row.dedupeKey)) return [];
        state.dedupes.add(row.dedupeKey);
        state.inserted.push(row);
        return [{ id: state.inserted.length }];
      } }),
    }) }),
  };
  return { db: executor, pool: { query: async (_sql: string, values: string[]) => ({
    rowCount: state.denied.has(values.join(":")) ? 1 : 0, rows: [],
  }) } };
});
vi.mock("../server/source-notification-access", () => ({
  sourceNoticeAccess: async (id: string) => state.access[id] || null,
}));
vi.mock("../server/auth", () => ({
  HR_SPECIALIST_PERMISSIONS: { hr_advances: ["view", "edit"] },
  requirePermission: (module: string, action: string) => (req: any, res: any, next: any) =>
    state.access[req.currentUser.id]?.actions?.includes(`${module}:${action}`)
      ? next() : res.status(403).json({ error: "Denied" }),
}));
vi.mock("../server/leave-helpers", () => ({
  resolveReviewerJobTitle: async (id: string) => state.access[id]?.title || null,
  reviewerMatchesStep: ({ reviewerJobTitle, reviewerRole, expectedJobTitle }: any) =>
    reviewerJobTitle === expectedJobTitle || ({ operations_manager: "مدير التشغيل", branch_manager: "مدير الفرع" } as any)[reviewerRole] === expectedJobTitle,
}));

import { hrNoticeIdentity, projectHrSourceNotificationForRecipient, queueHrSourceNotification } from "../server/hr-system-notifications";

function user(id: string, role: string, branches: string[] | null, actions: string[], title?: string) {
  state.access[id] = {
    user: { id, role }, allowed: branches, actions, title,
    branch: (branch: string) => branches === null || branches.includes(branch),
    view: async (module: string) => actions.includes(`${module}:view`),
  };
  (state.tables.users ||= []).push({ id });
}
function notice() { return { ...state.inserted[0], id: 1 } as any; }
beforeEach(() => {
  state.tables = {}; state.access = {}; state.inserted = [];
  state.denied.clear(); state.dedupes.clear();
});

describe("current HR workflow notices, not unreadable null-user portal broadcasts", () => {
  it("targets joining only to currently authorized operations approvers, with canonical exact identity and dedupe", async () => {
    state.tables.onboarding_notifications = [{ id: 12, jobOfferId: 3, branchId: "a", status: "signed", signedAt: new Date() }];
    state.tables.job_offers = [{ id: 3, branchId: "a", status: "accepted" }];
    const rights = ["operations_joining:view", "operations_joining:approve", "operations_hr:view"];
    user("ops", "operations_manager", ["a"], rights);
    user("other-branch", "operations_manager", ["b"], rights);
    user("viewer", "operations_manager", ["a"], rights.filter(r => !r.endsWith(":approve")));
    user("hr", "hr_manager", null, rights);
    expect(await queueHrSourceNotification("joining", 12)).toBe(1);
    expect(state.inserted[0].targetUserIds).toEqual(["ops"]);
    expect(state.inserted[0]).toMatchObject({ autoSource: "hr_workflow", accessBranchIds: ["a"], targetAllBranches: false });
    expect(state.inserted[0].buttonAction).toBe("/hr-hub?branchId=a&notificationId=12&tab=employees&section=joining");
    expect(await queueHrSourceNotification("joining", 12)).toBeNull();
    expect(state.inserted).toHaveLength(1);
    expect((await projectHrSourceNotificationForRecipient(notice(), "ops"))?.sourceState).toBe("current");
    expect(await projectHrSourceNotificationForRecipient(notice(), "hr")).toBeNull();
    state.tables.onboarding_notifications[0].confirmedAt = new Date();
    expect(await projectHrSourceNotificationForRecipient(notice(), "ops")).toBeNull();
  });
  it("uses the persisted leave chain and advances to a distinct stage notice; stale recipients/stages are removed", async () => {
    const chain = [{ level: 1, jobTitle: "مدير الفرع" }, { level: 2, jobTitle: "مدير التشغيل" }];
    state.tables.leave_requests = [{ id: 7, branchId: "a", status: "pending", currentLevel: 2, approvalChain: chain }];
    const rights = ["hr_leaves:view", "hr_leaves:approve"];
    user("branch", "branch_manager", ["a"], rights);
    user("ops", "operations_manager", ["a"], rights);
    user("unlinked", "employee", ["a"], rights);
    expect(await queueHrSourceNotification("leave", 7)).toBe(1);
    expect(state.inserted[0].targetUserIds).toEqual(["ops"]);
    expect(state.inserted[0].dedupeKey).toBe("hr-workflow:leave:7:level_2");
    expect(state.inserted[0].buttonAction).toBe("/hr/leaves?branchId=a&leaveId=7");
    state.access.ops.actions = ["hr_leaves:view"];
    expect(await projectHrSourceNotificationForRecipient(notice(), "ops")).toBeNull();
    state.access.ops.actions = rights;
    state.tables.leave_requests[0].currentLevel = 3;
    expect(await projectHrSourceNotificationForRecipient(notice(), "ops")).toBeNull();
  });
  it("routes preliminary advances to current reviewers, but preapproved/signed stages to exact HR final authority only", async () => {
    state.tables.advance_requests = [{ id: 8, branchId: "a", status: "pending" }];
    const rights = ["hr_advances:view", "hr_advances:approve", "hr_advances:edit"];
    user("ops", "operations_manager", ["a"], rights);
    user("hr", "hr_manager", null, rights);
    user("specialist", "hr_specialist", ["a"], rights);
    await queueHrSourceNotification("advance", 8);
    expect(state.inserted[0].targetUserIds).toEqual(["ops", "hr", "specialist"]);
    const pending = notice();
    state.tables.advance_requests[0].status = "pre_approved";
    await queueHrSourceNotification("advance", 8);
    expect(state.inserted[1].targetUserIds).toEqual(["hr", "specialist"]);
    expect(await projectHrSourceNotificationForRecipient(pending, "ops")).toBeNull();
    state.tables.advance_requests[0].status = "awaiting_signature";
    expect(await queueHrSourceNotification("advance", 8)).toBeNull();
    state.tables.advance_requests[0].status = "signed";
    await queueHrSourceNotification("advance", 8);
    expect(state.inserted[2].buttonAction).toBe("/hr/advances?branchId=a&advanceId=8");
    expect(state.inserted[2].targetUserIds).toEqual(["hr", "specialist"]);
  });
  it("fails closed after branch/view/action revocation, inactive user, tampered scope or malformed provenance", async () => {
    state.tables.leave_requests = [{ id: 7, branchId: "a", status: "pending", currentLevel: 1 }];
    user("reviewer", "operations_manager", ["a"], ["hr_leaves:view", "hr_leaves:approve"]);
    await queueHrSourceNotification("leave", 7);
    const n = notice();
    state.denied.add("reviewer:hr_leaves:approve");
    expect(await projectHrSourceNotificationForRecipient(n, "reviewer")).toBeNull();
    state.denied.clear();
    expect(await projectHrSourceNotificationForRecipient({ ...n, accessModule: "operations" }, "reviewer")).toBeNull();
    expect(await projectHrSourceNotificationForRecipient({ ...n, accessBranchIds: ["a", "b"] }, "reviewer")).toBeNull();
    expect(hrNoticeIdentity({ ...n, dedupeKey: "hr-workflow:leave:7:approved" })).toBeNull();
    state.access.reviewer.allowed = [];
    state.access.reviewer.branch = () => false;
    expect(await projectHrSourceNotificationForRecipient(n, "reviewer")).toBeNull();
    delete state.access.reviewer;
    expect(await projectHrSourceNotificationForRecipient(n, "reviewer")).toBeNull();
  });
  it("does not create a broadcast when nobody is eligible or when source is closed", async () => {
    state.tables.leave_requests = [{ id: 7, branchId: "a", status: "pending", currentLevel: 1 }];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await queueHrSourceNotification("leave", 7)).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("No currently authorized recipient"));
    warn.mockRestore();
    state.tables.leave_requests[0].status = "approved";
    expect(await queueHrSourceNotification("leave", 7)).toBeNull();
    expect(state.inserted).toEqual([]);
    await expect(queueHrSourceNotification("leave", NaN)).rejects.toThrow("Invalid HR");
  });
  it("keeps settlement/evaluation factual and never invents unsupported exact-record buttons", async () => {
    state.tables.leave_settlements = [{ id: 5, branchId: "a", status: "active", signedAt: new Date() }];
    state.tables.employee_evaluations = [{ id: 6, branchId: "a", status: "approved", employeeAckAt: new Date() }];
    user("hr", "hr_manager", null, ["hr_leaves:view", "hr_leaves:edit", "hr_evaluations:view", "hr_evaluations:edit"]);
    await queueHrSourceNotification("leave_settlement", 5);
    await queueHrSourceNotification("evaluation", 6);
    expect(state.inserted).toHaveLength(2);
    expect(state.inserted.every(n => n.buttonAction === null && n.buttonText === null)).toBe(true);
  });
  it("hooks signing/creation/reviewer advancement into source transactions without changing employee channels", () => {
    const onboarding = readFileSync("server/onboarding-routes.ts", "utf8");
    expect(onboarding).toContain('queueHrSourceNotification("joining", n.id, tx)');
    const portal = readFileSync("server/self-service-routes.ts", "utf8");
    expect(portal).toContain('queueHrSourceNotification("leave", row.id, tx)');
    expect(portal).toContain('queueHrSourceNotification("advance", row.id, tx)');
    expect(portal.match(/queueHrSourceNotification\("advance", id, tx\)/g)).toHaveLength(2);
    const hr = readFileSync("server/hr-routes.ts", "utf8");
    expect(hr).toContain('if (finalStatus === "pending") await queueHrSourceNotification("leave", id, tx)');
    expect(hr).toContain('channels: ["whatsapp", "sms"]');
    const helper = readFileSync("server/notify-helpers.ts", "utf8");
    expect(helper).toContain("storage.createNotification");
    expect(helper).not.toContain("userId: null");
  });
});