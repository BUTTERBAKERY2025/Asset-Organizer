import express from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { auditActivityLog, auditFiles, auditPeriods, auditRequirements, users } from "../shared/schema";

// Only persistence and session authentication are replaced. Requests pass through
// the registered Express route, team authorization, real Multer and byte checks.
const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("../server/db", () => ({ db: mocks }));
vi.mock("../server/storage", () => ({ storage: {} }));
vi.mock("../server/auth", () => ({
  isAuthenticated: (req: any, _res: any, next: () => void) => {
    req.session = { userId: "upload-test-user" };
    next();
  },
}));
vi.mock("../server/supabase-storage", () => ({
  uploadToSupabase: mocks.upload,
  downloadFromSupabase: vi.fn(),
  deleteFromSupabase: vi.fn(),
}));

import { registerAuditPortalRoutes } from "../server/audit-portal-routes";

type Attachment = { name: string; field?: "file" | "files"; content?: string; mime?: string };
const pdf = (name: string, field: Attachment["field"] = "files"): Attachment => ({ name, field });
let server: Server;
let baseUrl: string;
let requirementStatus: string;
let saved: any[];
let activities: any[];
let updates: any[];

async function upload(files: Attachment[], withRequirement = true) {
  const body = new FormData();
  if (withRequirement) body.append("requirementId", "42");
  body.append("category", "banks");
  for (const file of files) {
    body.append(file.field ?? "files", new Blob(
      [file.content ?? "%PDF-1.7\nfixture document"],
      { type: file.mime ?? "application/pdf" },
    ), file.name);
  }
  const response = await fetch(`${baseUrl}/api/audit/periods/7/files`, { method: "POST", body });
  return { status: response.status, body: await response.json() };
}

function expectNoWrites() {
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
}

beforeAll(async () => {
  const app = express();
  registerAuditPortalRoutes(app);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test HTTP port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

beforeEach(() => {
  vi.resetAllMocks();
  requirementStatus = "requested";
  saved = [];
  activities = [];
  updates = [];
  mocks.select.mockImplementation(() => ({
    from: (table: unknown) => ({
      where: () => {
        const rows = table === users
          ? [{ id: "upload-test-user", firstName: "Test", role: "financial_manager", isActive: "active" }]
          : table === auditPeriods
            ? [{ id: 7, status: "open" }]
            : table === auditRequirements
              ? [{ id: 42, periodId: 7, status: requirementStatus }]
              : undefined;
        if (!rows) throw new Error("Unexpected table read");
        return Object.assign(Promise.resolve(rows), { limit: async () => rows });
      },
    }),
  }));
  mocks.insert.mockImplementation((table: unknown) => ({
    values: (values: any) => {
      if (table === auditFiles) {
        const row = { id: saved.length + 1, ...values };
        saved.push(row);
        return { returning: async () => [row] };
      }
      if (table === auditActivityLog) {
        activities.push(values);
        return Promise.resolve();
      }
      throw new Error("Unexpected table insert");
    },
  }));
  mocks.update.mockImplementation((table: unknown) => {
    expect(table).toBe(auditRequirements);
    return {
      set: (values: any) => ({
        where: async () => { updates.push(values); requirementStatus = values.status; },
      }),
    };
  });
  mocks.upload.mockImplementation(async (_buffer: Buffer, name: string) => ({ path: `audit/${name}` }));
});

describe("POST /api/audit/periods/:id/files — real multipart batches", () => {
  it("returns all successful files and marks the linked requirement uploaded", async () => {
    const result = await upload([pdf("first.pdf"), pdf("second.pdf")]);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, uploaded: saved, failed: [] });
    expect(saved.map(row => row.fileName)).toEqual(["first.pdf", "second.pdf"]);
    expect(saved).toEqual(expect.arrayContaining([
      expect.objectContaining({ periodId: 7, requirementId: 42, category: "banks" }),
    ]));
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(updates).toEqual([{ status: "uploaded", updatedAt: expect.any(Date) }]);
    expect(activities).toHaveLength(1);
  });

  it("reports every rejected file when the entire batch fails validation", async () => {
    const result = await upload([
      pdf("unsupported.exe"),
      { name: "bad-signature.pdf", content: "not a PDF document" },
    ]);
    expect(result.status).toBe(400);
    expect(result.body.error).toContain("unsupported.exe: امتداد الملف غير مدعوم");
    expect(result.body.error).toContain("bad-signature.pdf: محتوى الملف لا يطابق امتداده");
    expectNoWrites();
    expect(requirementStatus).toBe("requested");
  });

  it("returns uploaded AND failed entries and continues past invalid files", async () => {
    const result = await upload([
      pdf("unsupported.exe"),
      pdf("first.pdf"),
      { name: "bad-signature.pdf", content: "not a PDF document" },
      pdf("last.pdf"),
    ]);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      ok: true,
      uploaded: saved,
      failed: [
        { fileName: "unsupported.exe", error: "امتداد الملف غير مدعوم" },
        { fileName: "bad-signature.pdf", error: "محتوى الملف لا يطابق امتداده" },
      ],
    });
    expect(saved.map(row => row.fileName)).toEqual(["first.pdf", "last.pdf"]);
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(requirementStatus).toBe("uploaded");
    expect(updates).toHaveLength(1);
  });

  it("merges legacy file and plural files fields without losing attachments", async () => {
    const result = await upload([pdf("legacy.pdf", "file"), pdf("new.pdf"), pdf("another.pdf")]);
    expect(result.status).toBe(200);
    expect(result.body.uploaded.map((row: any) => row.fileName)).toEqual(["legacy.pdf", "new.pdf", "another.pdf"]);
    expect(result.body.failed).toEqual([]);
    expect(saved).toHaveLength(3);
  });

  it.each(["plural", "mixed"] as const)("accepts exactly 20 files (%s fields)", async (mode) => {
    const files = Array.from({ length: 20 }, (_, i) => pdf(`${i}.pdf`, mode === "mixed" && i === 0 ? "file" : "files"));
    const result = await upload(files);
    expect(result.status).toBe(200);
    expect(result.body.uploaded).toHaveLength(20);
    expect(result.body.failed).toEqual([]);
    expect(mocks.upload).toHaveBeenCalledTimes(20);
  });

  it.each(["plural", "mixed"] as const)("rejects more than 20 before any storage writes (%s fields)", async (mode) => {
    const files = Array.from({ length: 21 }, (_, i) => pdf(`${i}.pdf`, mode === "mixed" && i === 0 ? "file" : "files"));
    const result = await upload(files);
    expect(result.status).toBe(400);
    expect(result.body.error).toEqual(expect.any(String));
    if (mode === "mixed") expect(result.body.error).toContain("20");
    expectNoWrites();
    expect(requirementStatus).toBe("requested");
  });

  it.each(["approved", "not_applicable"])("rejects attachments to a %s requirement", async (status) => {
    requirementStatus = status;
    const result = await upload([pdf("first.pdf"), pdf("second.pdf")]);
    expect(result.status).toBe(400);
    expect(result.body.error).toContain(status === "approved" ? "البند معتمد" : "غير منطبق");
    expectNoWrites();
    expect(requirementStatus).toBe(status);
  });

  it("does not change the requirement if all storage uploads fail", async () => {
    mocks.upload.mockResolvedValue(null);
    const result = await upload([pdf("first.pdf"), pdf("second.pdf")]);
    expect(result.status).toBe(400);
    expect(result.body.error).toContain("first.pdf: فشل الرفع إلى التخزين");
    expect(result.body.error).toContain("second.pdf: فشل الرفع إلى التخزين");
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(requirementStatus).toBe("requested");
  });

  it("reports a storage failure alongside a successful upload", async () => {
    mocks.upload.mockResolvedValueOnce(null);
    const result = await upload([pdf("failed.pdf"), pdf("success.pdf")]);
    expect(result.status).toBe(200);
    expect(result.body.uploaded).toEqual([expect.objectContaining({ fileName: "success.pdf" })]);
    expect(result.body.failed).toEqual([{ fileName: "failed.pdf", error: "فشل الرفع إلى التخزين" }]);
    expect(requirementStatus).toBe("uploaded");
    expect(updates).toHaveLength(1);
  });

  it("does not update any requirement for an unlinked upload", async () => {
    const result = await upload([pdf("first.pdf")], false);
    expect(result.status).toBe(200);
    expect(result.body.uploaded).toEqual([expect.objectContaining({ requirementId: null })]);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects an empty batch without changing the requirement", async () => {
    const result = await upload([]);
    expect(result.status).toBe(400);
    expect(result.body.error).toBe("لم يتم إرفاق ملف");
    expectNoWrites();
  });
});