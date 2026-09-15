import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("../server/db", () => ({ db: mocks }));
vi.mock("../server/storage", () => ({ storage: { createSystemNotification: mocks.notify } }));
vi.mock("../server/auth", () => ({ isAuthenticated: vi.fn() }));
vi.mock("../server/supabase-storage", () => ({
  uploadToSupabase: vi.fn(), downloadFromSupabase: vi.fn(), deleteFromSupabase: vi.fn(),
}));

import { registerAuditPortalRoutes } from "../server/audit-portal-routes";

const handlers = new Map<string, Function>();
const app: any = {};
for (const method of ["get", "post", "patch", "delete"]) {
  app[method] = (path: string, ...callbacks: Function[]) => {
    handlers.set(`${method} ${path}`, callbacks.at(-1)!);
  };
}
registerAuditPortalRoutes(app);

const auditor = { id: "auditor-id", name: "المراجع", role: "external_auditor", isAuditor: true, isTeam: false };
const team = { ...auditor, id: "team-id", role: "financial_manager", isAuditor: false, isTeam: true };
const requirement = { id: 7, periodId: 2, title: "كشف الحساب البنكي", source: "auditor", status: "uploaded" };
const period = { id: 2, status: "open" };

function selectResult(value: unknown) {
  mocks.select.mockReturnValueOnce({ from: () => ({ where: async () => value }) });
}

async function call(method: string, path: string, body: any, ctx = auditor) {
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await handlers.get(`${method} ${path}`)!({ params: { id: "7" }, body, auditCtx: ctx }, res);
  return res;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.insert.mockReturnValue({ values: () => ({ returning: async () => [requirement] }) });
  mocks.update.mockReturnValue({ set: () => ({ where: () => ({ returning: async () => [{ ...requirement, status: "rejected" }] }) }) });
  mocks.notify.mockResolvedValue({ id: 1 });
});

describe("audit portal team notifications", () => {
  it("creates one active bell/Push notification for an auditor request, targeted only to the team roles", async () => {
    selectResult([period]);
    const res = await call("post", "/api/audit/periods/:id/requirements", { title: requirement.title });
    expect(res.status).not.toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    const notification = mocks.notify.mock.calls[0][0];
    expect(notification).toMatchObject({
      title: "طلب جديد من المراجع الخارجي",
      content: expect.stringContaining(requirement.title),
      isActive: true,
      targetAllBranches: true,
      targetRoleIds: ["admin", "financial_manager"],
      buttonAction: "/audit-portal",
    });
    expect(notification).not.toHaveProperty("message");
    expect(notification).not.toHaveProperty("targetUserIds");
  });

  it("does not notify for internally created requirements", async () => {
    selectResult([period]);
    mocks.insert.mockReturnValueOnce({ values: () => ({ returning: async () => [{ ...requirement, source: "internal" }] }) });
    await call("post", "/api/audit/periods/:id/requirements", { title: requirement.title, source: "auditor" }, team);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("notifies when an uploaded item is rejected", async () => {
    selectResult([requirement]);
    selectResult([period]);
    await call("patch", "/api/audit/requirements/:id", { status: "rejected" });
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({
      title: "إرجاع بند من المراجع الخارجي",
      content: expect.stringContaining(requirement.title),
      targetRoleIds: ["admin", "financial_manager"],
    }));
  });

  it("does not notify on approval", async () => {
    selectResult([requirement]);
    selectResult([period]);
    await call("patch", "/api/audit/requirements/:id", { status: "approved" });
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("does not notify for an already rejected item", async () => {
    selectResult([{ ...requirement, status: "rejected" }]);
    selectResult([period]);
    const res = await call("patch", "/api/audit/requirements/:id", { status: "rejected" });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("does not notify when the period is closed", async () => {
    selectResult([{ ...period, status: "closed" }]);
    await call("post", "/api/audit/periods/:id/requirements", { title: requirement.title });
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("does not notify when saving the requirement fails", async () => {
    selectResult([period]);
    mocks.insert.mockReturnValueOnce({ values: () => ({ returning: async () => { throw new Error("save failed"); } }) });
    const res = await call("post", "/api/audit/periods/:id/requirements", { title: requirement.title });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("logs notification failures without falsely failing an already saved request", async () => {
    selectResult([period]);
    mocks.notify.mockRejectedValueOnce(new Error("notification unavailable"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await call("post", "/api/audit/periods/:id/requirements", { title: requirement.title });
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(requirement);
      expect(error).toHaveBeenCalledWith(expect.stringContaining("[audit-portal]"), expect.any(Error));
    } finally {
      error.mockRestore();
    }
  });
});