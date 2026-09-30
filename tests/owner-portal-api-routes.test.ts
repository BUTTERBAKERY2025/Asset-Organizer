import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  authenticated: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  allowed: vi.fn(),
  effective: vi.fn(),
  download: vi.fn(),
}));
vi.mock("../server/db", () => ({ db: { select: mocks.select } }));
vi.mock("../server/supabase-storage", () => ({ downloadFromSupabase: mocks.download }));
vi.mock("../server/auth", () => ({
  isAuthenticated: mocks.authenticated,
  getAllowedBranchIds: mocks.allowed,
  getEffectiveBranchFilter: mocks.effective,
}));
import { registerOwnerPortalRoutes } from "../server/owner-portal-routes";

const routes = new Map<string, Function[]>();
registerOwnerPortalRoutes({ get: (path: string, ...handlers: Function[]) => routes.set(path, handlers) } as unknown as Express);
async function request(path: string, options: { role?: string; query?: Record<string, unknown>; grants?: string[] } = {}) {
  const req = { currentUser: { role: options.role ?? "business_owner" }, userBranchAccess: (options.grants ?? ["a"]).map(branchId => ({ branchId })), query: options.query ?? {}, params: { id: "1" }, route: { path: `/api/owner/${path}` } };
  const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn(), send: vi.fn() };
  res.status.mockReturnValue(res);
  await routes.get(`/api/owner/${path}`)![1](req, res);
  return res;
}
describe("owner API handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.allowed.mockReturnValue(["a"]);
    mocks.effective.mockReturnValue({ hasAccess: true, branchIds: ["a"], singleBranchId: "a" });
  });
  it("protects all eight routes with authentication", () => {
    expect(routes.size).toBe(8);
    for (const handlers of Array.from(routes.values())) expect(handlers[0]).toBe(mocks.authenticated);
  });
  it("rejects non-owner roles before database reads", async () => {
    for (const role of ["employee", "financial_manager", "auditor", ""]) {
      expect((await request("overview", { role })).status).toHaveBeenCalledWith(403);
    }
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("rejects no grants and unauthorized branch queries", async () => {
    expect((await request("assets", { grants: [] })).status).toHaveBeenCalledWith(403);
    expect((await request("sales", { query: { branchId: "b" } })).status).toHaveBeenCalledWith(403);
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("rejects invalid filters before any reads", async () => {
    expect((await request("sales", { query: { dateFrom: "2026-02-30" } })).status).toHaveBeenCalledWith(400);
    expect((await request("assets", { query: { page: "0" } })).status).toHaveBeenCalledWith(400);
    expect((await request("shareholders", { query: { search: ["a", "b"] } })).status).toHaveBeenCalledWith(400);
    expect((await request("marketing", { query: { section: "contracts" } })).status).toHaveBeenCalledWith(400);
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("returns an explicit sanitized error instead of empty success on database failure", async () => {
    mocks.select.mockImplementationOnce(() => { throw new Error("private DB details"); });
    const res = await request("branches");
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).not.toContain("private DB details");
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  });
  it("preview denies ungranted branches and arbitrary URL query input before storage", async () => {
    expect((await request("assets/:id/image", { grants: [] })).status).toHaveBeenCalledWith(403);
    expect((await request("marketing/content/:id/image", { query: { url: "http://localhost" } })).status).toHaveBeenCalledWith(400);
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
  });
  it("serves only the exact internally stored raster image through a no-store proxy", async () => {
    const query = { from: vi.fn(), where: vi.fn(), limit: vi.fn() };
    query.from.mockReturnValue(query); query.where.mockReturnValue(query);
    query.limit.mockResolvedValue([{ image: "/api/documents/file/photo.png" }]);
    mocks.select.mockReturnValueOnce(query);
    const bytes = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
    mocks.download.mockResolvedValueOnce({ data: new Blob([bytes]), mimeType: "text/html" });
    const res = await request("assets/:id/image");
    expect(mocks.download).toHaveBeenCalledWith("photo.png");
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/png");
    expect(res.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
    expect(res.send).toHaveBeenCalledWith(bytes);
  });
});