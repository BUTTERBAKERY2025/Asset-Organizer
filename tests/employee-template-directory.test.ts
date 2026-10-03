import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { readDirectoryTemplateAssignments } from "../server/employee-template-directory";

describe("employee directory actual template version", () => {
  it("batches visible IDs and joins the bound historical version, not newest", async () => {
    const execute = vi.fn().mockResolvedValueOnce({ rows: [{ ready: true }] }).mockResolvedValueOnce({
      rows: [{ employeeId: 1, userId: "u1", templateId: 8, version: 2, name: "كاشير", approved: true },
        { employeeId: 2, userId: "old-account", templateId: 8, version: 4, name: "قديم", approved: true },
        { employeeId: 999, userId: "outside", templateId: 9, version: 1 }],
    });
    const result = await readDirectoryTemplateAssignments({ execute }, [{ id: 1, linkedUserId: "u1" }, { id: 2, linkedUserId: "new-account" }]);
    expect([...result!]).toEqual([[1, { templateId: 8, version: 2, name: "كاشير", approved: true }]]);
    const query = new PgDialect().sqlToQuery(execute.mock.calls[1][0]);
    expect(query.params).toEqual([1, 2]);
    expect(query.sql).toContain("v.version = b.version");
    expect(query.sql).toContain("a.version = b.version");
    expect(query.sql).not.toMatch(/MAX|UPDATE|INSERT|DELETE/i);
  });
  it("distinguishes unavailable metadata from no assignment", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ ready: false }] });
    expect(await readDirectoryTemplateAssignments({ execute }, [{ id: 1, linkedUserId: "u1" }])).toBeUndefined();
    expect(execute).toHaveBeenCalledTimes(1);
    execute.mockReset().mockResolvedValueOnce({ rows: [{ ready: true }] }).mockResolvedValueOnce({ rows: [] });
    expect((await readDirectoryTemplateAssignments({ execute }, [{ id: 1, linkedUserId: "u1" }]))?.size).toBe(0);
  });
  it("does not query when no visible accounts exist", async () => {
    const execute = vi.fn();
    expect((await readDirectoryTemplateAssignments({ execute }, [{ id: 1, linkedUserId: null }]))?.size).toBe(0);
    expect(execute).not.toHaveBeenCalled();
  });
  it("does not hide an assigned version whose historical metadata needs review", async () => {
    const execute = vi.fn().mockResolvedValueOnce({ rows: [{ ready: true }] }).mockResolvedValueOnce({
      rows: [{ employeeId: 1, userId: "u1", templateId: 8, version: 2, name: null, approved: false }],
    });
    expect((await readDirectoryTemplateAssignments({ execute }, [{ id: 1, linkedUserId: "u1" }]))?.get(1))
      .toEqual({ templateId: 8, version: 2, name: null, approved: false });
  });
});