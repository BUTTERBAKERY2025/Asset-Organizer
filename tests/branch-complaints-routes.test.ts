import { beforeEach, describe, expect, it, vi } from "vitest";

const fakes = vi.hoisted(() => ({
  rows: [] as any[],
  branchAllowed: true,
  permissions: new Set(["view", "create", "edit", "approve"]),
  storageReady: true,
  uploaded: { storagePath: "/objects/branch-complaints/one.pdf" } as any,
  downloaded: { data: Buffer.from([1, 2, 3]), contentType: "application/pdf", size: 3 } as any,
  downloadCalls: 0,
  file: { buffer: Buffer.from("%PDF-fixture"), originalname: "evidence.pdf", mimetype: "application/pdf", size: 12 } as any,
}));

vi.mock("../server/db", () => {
  function builder() {
    const value = () => fakes.rows.shift() ?? [];
    const result: any = {
      from: () => result, where: () => result, orderBy: () => result,
      limit: () => result, offset: () => result, set: () => result,
      values: () => result,
      returning: () => Promise.resolve(value()),
      then: (resolve: any, reject: any) => Promise.resolve(value()).then(resolve, reject),
    };
    return result;
  }
  const db: any = {
    select: () => builder(),
    insert: () => builder(),
    update: () => builder(),
  };
  db.transaction = async (work: any) => work(db);
  return { db };
});
vi.mock("../server/auth", () => ({
  BRANCH_MANAGER_INTRINSIC_PERMISSIONS: { branch_complaints: ["view", "create", "edit"] },
  OPERATIONS_MANAGER_PERMISSIONS: { branch_complaints: ["view", "create", "edit", "approve"] },
  canAccessBranch: vi.fn(async () => fakes.branchAllowed),
  isAuthenticated: (req: any, res: any, next: any) =>
    req.currentUser ? next() : res.status(401).json({ message: "unauthorized" }),
  requirePermission: (_module: string, action: string) => (_req: any, res: any, next: any) =>
    fakes.permissions.has(action) ? next() : res.status(403).json({ message: "forbidden" }),
}));
vi.mock("../server/branch-complaint-attachment-storage", () => ({
  complaintAttachmentStorage: {
    isReady: vi.fn(async () => fakes.storageReady),
    upload: vi.fn(async () => fakes.uploaded),
    download: vi.fn(async () => {
      fakes.downloadCalls += 1;
      return fakes.downloaded;
    }),
    delete: vi.fn(async () => undefined),
  },
}));
vi.mock("../server/storage", () => ({
  storage: { hasPermission: vi.fn(async (_id: string, _module: string, action: string) => fakes.permissions.has(action)) },
}));
vi.mock("multer", () => {
  const multer: any = () => ({
    single: () => async (req: any, _res: any, next: any) => {
      req.file = fakes.file;
      await next();
    },
  });
  multer.memoryStorage = () => ({});
  return { default: multer };
});

import { registerBranchComplaintRoutes } from "../server/branch-complaints";

type Route = { method: string; path: string; handlers: Function[] };
const routes: Route[] = [];
const app: any = {};
for (const method of ["get", "post", "patch", "delete"]) {
  app[method] = (path: string, ...handlers: Function[]) => routes.push({ method: method.toUpperCase(), path, handlers });
}
registerBranchComplaintRoutes(app);

function route(method: string, path: string) {
  const found = routes.find((item) => item.method === method && item.path === path);
  expect(found, `${method} ${path} registered`).toBeDefined();
  return found!;
}

async function invoke(target: Route, options: any = {}) {
  const response: any = { statusCode: 200, body: undefined, headers: {}, sent: undefined, finished: false };
  const req: any = {
    currentUser: { id: "user-1", role: "employee", username: "tester", isActive: "active" },
    query: {}, params: {}, body: {}, ...options,
  };
  req.session = { userId: req.currentUser?.id };
  if (req.currentUser) {
    const authenticationRows = Array.from({ length: Math.max(1, target.handlers.length - 2) }, () => [
      [{ ...req.currentUser, role: "employee", isActive: "active" }],
      [],
    ]).flat();
    fakes.rows.unshift(...authenticationRows);
  }
  const res: any = {
    status(code: number) { response.statusCode = code; return res; },
    json(body: any) { response.body = body; response.finished = true; return res; },
    setHeader(name: string, value: string) { response.headers[name] = value; },
    send(value: any) { response.sent = value; response.finished = true; return res; },
  };
  let index = 0;
  const next = async (error?: any): Promise<void> => {
    if (error) throw error;
    const handler = target.handlers[index++];
    if (handler) await handler(req, res, next);
  };
  await next();
  for (let attempt = 0; attempt < 100 && !response.finished; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  expect(response.finished, "route completed").toBe(true);
  return response;
}

const complaint = {
  id: 7, branchId: "branch-a", subject: "تأخر خدمة", description: "تفاصيل",
  category: "service", priority: "normal", status: "open", version: 1,
  ownerUserId: null, resolution: null, firstRespondedAt: null,
};

describe("branch complaint registered handlers", () => {
  beforeEach(() => {
    fakes.rows.length = 0;
    fakes.branchAllowed = true;
    fakes.permissions = new Set(["view", "create", "edit", "approve"]);
    fakes.storageReady = true;
    fakes.uploaded = { storagePath: "/objects/branch-complaints/one.pdf" };
    fakes.downloaded = { data: Buffer.from([1, 2, 3]), contentType: "application/pdf", size: 3 };
    fakes.downloadCalls = 0;
    fakes.file = { buffer: Buffer.from("%PDF-fixture"), originalname: "evidence.pdf", mimetype: "application/pdf", size: 12 };
  });

  it("registers the exact client API methods including XHR upload and archive", () => {
    expect(routes.map(({ method, path }) => `${method} ${path}`)).toEqual([
      "GET /api/branch-complaints/summary",
      "GET /api/branch-complaints/assignees",
      "GET /api/branch-complaints",
      "GET /api/branch-complaints/:id",
      "POST /api/branch-complaints",
      "PATCH /api/branch-complaints/:id",
      "POST /api/branch-complaints/:id/transition",
      "POST /api/branch-complaints/:id/attachments",
      "GET /api/branch-complaints/:id/attachments/:attachmentId",
      "DELETE /api/branch-complaints/:id/attachments/:attachmentId",
    ]);
  });

  it("rejects unauthenticated and revoked-view requests before handlers", async () => {
    let response = await invoke(route("GET", "/api/branch-complaints"), { currentUser: null, query: { branchId: "branch-a" } });
    expect(response.statusCode).toBe(401);
    fakes.permissions.delete("view");
    response = await invoke(route("GET", "/api/branch-complaints"), { query: { branchId: "branch-a" } });
    expect(response.statusCode).toBe(403);
  });

  it.each([
    ["GET", "/api/branch-complaints/summary", { query: { branchId: "branch-b" } }],
    ["GET", "/api/branch-complaints/assignees", { query: { branchId: "branch-b" } }],
    ["GET", "/api/branch-complaints", { query: { branchId: "branch-b" } }],
    ["POST", "/api/branch-complaints", { body: { branchId: "branch-b", subject: "شكوى", description: "وصف", category: "service", responseDue: "2026-10-01T10:00:00Z" } }],
  ])("enforces branch isolation for %s %s", async (method, path, options) => {
    fakes.branchAllowed = false;
    const response = await invoke(route(method, path), options);
    expect(response.statusCode).toBe(403);
  });

  it("lists, summarizes, and loads detail with events and active attachments", async () => {
    fakes.rows.push([{ value: 3 }], [{ value: 1 }]);
    let response = await invoke(route("GET", "/api/branch-complaints/summary"), { query: { branchId: "branch-a" } });
    expect(response.body).toEqual({ branchId: "branch-a", open: 3, overdue: 1 });

    fakes.rows.push([complaint], [{ value: 1 }]);
    response = await invoke(route("GET", "/api/branch-complaints"), { query: { branchId: "branch-a", page: "1" } });
    expect(response.body).toMatchObject({ items: [complaint], total: 1, pageSize: 25 });

    fakes.rows.push([complaint], [{ id: 1, eventType: "created" }], [{
      id: 9,
      originalName: "evidence.pdf",
      storagePath: "/objects/branch-complaints/private.pdf",
    }]);
    response = await invoke(route("GET", "/api/branch-complaints/:id"), { params: { id: "7" } });
    expect(response.body.events).toHaveLength(1);
    expect(response.body.attachments).toHaveLength(1);
    expect(response.body.attachments[0]).not.toHaveProperty("storagePath");
  });

  it("creates and patches with persisted event/audit and reports optimistic 409", async () => {
    fakes.rows.push([complaint], [], []);
    let response = await invoke(route("POST", "/api/branch-complaints"), {
      body: { branchId: "branch-a", subject: "تأخر خدمة", description: "تفاصيل", category: "service", responseDue: "2026-10-01T10:00:00Z" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.body.id).toBe(7);

    fakes.rows.push([complaint], [{ ...complaint, subject: "معدل", version: 2 }], [], []);
    response = await invoke(route("PATCH", "/api/branch-complaints/:id"), {
      params: { id: "7" }, body: { version: 1, subject: "معدل" },
    });
    expect(response.body).toMatchObject({ subject: "معدل", version: 2 });

    fakes.rows.push([complaint], []);
    response = await invoke(route("PATCH", "/api/branch-complaints/:id"), {
      params: { id: "7" }, body: { version: 1, subject: "قديم" },
    });
    expect(response.statusCode).toBe(409);
  });

  it("requires approve for close/reopen and rolls back stale transition with 409", async () => {
    const resolved = { ...complaint, status: "resolved", version: 3 };
    fakes.permissions.delete("approve");
    let response = await invoke(route("POST", "/api/branch-complaints/:id/transition"), {
      params: { id: "7" }, body: { version: 3, action: "close", reason: "تم الاعتماد" },
    });
    expect(response.statusCode).toBe(403);

    fakes.permissions.add("approve");
    fakes.rows.length = 0;
    fakes.rows.push([resolved], [{ ...resolved, status: "closed", version: 4 }], [], []);
    response = await invoke(route("POST", "/api/branch-complaints/:id/transition"), {
      params: { id: "7" }, body: { version: 3, action: "close", reason: "تم الاعتماد" },
    });
    expect(response.body).toMatchObject({ status: "closed", version: 4 });

    fakes.rows.push([resolved], []);
    response = await invoke(route("POST", "/api/branch-complaints/:id/transition"), {
      params: { id: "7" }, body: { version: 3, action: "reopen", reason: "ظهرت المشكلة مجددًا" },
    });
    expect(response.statusCode).toBe(409);
  });

  it("uploads, downloads and archives only attachments belonging to an accessible complaint", async () => {
    fakes.rows.push([complaint], [{ id: 9, complaintId: 7, originalName: "evidence.pdf", mimeType: "application/pdf" }], [], []);
    let response = await invoke(route("POST", "/api/branch-complaints/:id/attachments"), { params: { id: "7" } });
    expect(response.statusCode).toBe(201);
    expect(response.body.id).toBe(9);
    expect(response.body).not.toHaveProperty("storagePath");

    fakes.rows.push([complaint], [{ id: 9, complaintId: 7, originalName: "evidence.pdf", mimeType: "application/pdf", storagePath: "/objects/branch-complaints/one.pdf" }]);
    response = await invoke(route("GET", "/api/branch-complaints/:id/attachments/:attachmentId"), { params: { id: "7", attachmentId: "9" } });
    expect(response.headers["Content-Disposition"]).toContain("evidence.pdf");
    expect(response.headers["Content-Type"]).toBe("application/pdf");
    expect(response.headers["Content-Length"]).toBe("3");
    expect(response.headers["Cache-Control"]).toBe("private, no-store");
    expect(Buffer.isBuffer(response.sent)).toBe(true);

    fakes.rows.push([complaint], [{ id: 9, complaintId: 7, originalName: "evidence.pdf" }], [], []);
    response = await invoke(route("DELETE", "/api/branch-complaints/:id/attachments/:attachmentId"), { params: { id: "7", attachmentId: "9" } });
    expect(response.body).toEqual({ archived: true, objectRetained: true });

    fakes.branchAllowed = false;
    fakes.rows.push([complaint]);
    response = await invoke(route("GET", "/api/branch-complaints/:id/attachments/:attachmentId"), { params: { id: "7", attachmentId: "9" } });
    expect(response.statusCode).toBe(404);
    expect(fakes.downloadCalls).toBe(1);
  });

  it("rejects revoked owners and storage failures explicitly", async () => {
    const owner = { id: "owner", role: "employee", branchId: "branch-a" };
    fakes.permissions.delete("edit");
    fakes.rows.push([owner], []);
    let response = await invoke(route("POST", "/api/branch-complaints"), {
      body: { branchId: "branch-a", subject: "شكوى", description: "وصف", category: "service", ownerUserId: "owner", responseDue: "2026-10-01T10:00:00Z" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.body.message).toContain("غير مؤهل");

    fakes.permissions.add("edit");
    fakes.rows.length = 0;
    fakes.storageReady = false;
    fakes.rows.push([complaint]);
    response = await invoke(route("POST", "/api/branch-complaints/:id/attachments"), { params: { id: "7" } });
    expect(response.statusCode).toBe(503);
    expect(response.body.message).toContain("الخاص غير متاح");
  });
});