import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { transform } from "esbuild";
import { sql as drizzleSql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { authenticatedUploadMatchesActor, compatibleUploadBinding, makeAuthenticatedUploadName, mayDownloadUpload, resolveUploadBindings, validUploadKey, type UploadBinding } from "../server/upload-file-access";
import { isDedicatedSocialMediaKey, noStoreProtectedUpload } from "../server/protected-upload-response";

// Compile the actual registered handler, not a rewritten test implementation.
// The DB and bucket are substituted; no server or production data is touched.
const source = readFileSync("server/routes.ts", "utf8");
const start = source.indexOf('app.get(["/api/uploads/file/*", "/uploads/*"], isAuthenticated, async (req, res) => {');
const end = source.indexOf('\n  // Upload Document File', start);
if (start < 0 || end < 0) throw new Error("upload route registration missing");
const expression = source.slice(start, end)
  .replace(/^app\.get\(\["\/api\/uploads\/file\/\*", "\/uploads\/\*"\], isAuthenticated, /, "")
  .replace(/\);\s*$/, "")
  .replaceAll('await import("./supabase-storage")', "await Promise.resolve(bucket)");
const compiled = (await transform(expression, { loader: "ts", target: "es2022" })).code.trim().replace(/;\s*$/, "");
process.env.SESSION_SECRET = "local-unit-test-key-for-upload-provenance";
const validKey = makeAuthenticatedUploadName("cashier-journals", "jpg", "owner")
  .replace("/", "_").replace(".jpg", "_1234567890123_abcdef12.jpg");

function dispatch(rows: UploadBinding[], opts: { role?: string; branch?: string; modules?: string[]; legacy?: boolean; key?: string; missingUnrelated?: boolean; local?: boolean; userId?: string } = {}) {
  const events: string[] = [];
  const key = opts.key ?? validKey;
  let lastQuery = "";
  let lastParams: unknown[] = [];
  const db = { execute: async (query: any) => {
    const rendered = opts.missingUnrelated ? new PgDialect().sqlToQuery(query) : query;
    lastQuery = rendered.sql ?? rendered.text;
    lastParams = rendered.params;
    events.push("database");
    if (opts.missingUnrelated) throw Object.assign(new Error("unrelated feature not installed"), { code: "42P01" });
    return { rows: lastQuery.includes("FROM journal_attachments a") ? rows : [] };
  } };
  const fakeSql = (strings: TemplateStringsArray, ...values: unknown[]) => ({
    text: strings.join("?"),
    params: values,
  });
  const sql = opts.missingUnrelated ? drizzleSql : fakeSql;
  const pool = { query: async (text: string, _params: unknown[]) => {
    events.push("select");
    if (text.includes("FROM financial_documents")) throw Object.assign(new Error("not installed"), { code: "42P01" });
    return { rows: text.includes("FROM journal_attachments a") ? rows : [] };
  } };
  const bucket = {
    isSupabaseAvailable: () => true,
    downloadFromSupabase: async (_key: string) => {
      events.push("bucket");
      return { data: { arrayBuffer: async () => Uint8Array.of(1, 2).buffer }, mimeType: "image/png" };
    },
    findLegacyMatch: async () => opts.legacy ? "cashier-journals_13_1234567890123_abcdef12.jpg" : null,
  };
  const response: any = {
    code: 200, headersSent: false,
    headers: {} as Record<string, string>,
    status(code: number) { this.code = code; return this; },
    json(body: unknown) { this.body = body; this.headersSent = true; return this; },
    set(headers: Record<string, string>) { Object.assign(this.headers, headers); return this; },
    send(body: unknown) { this.body = body; return this; },
  };
  const deps = {
    db, sql, pool, bucket, Buffer, console,
    resolveUploadBindings: opts.missingUnrelated ? resolveUploadBindings :
      async (query: any, execute: (q: any) => Promise<{rows: UploadBinding[]}>) => (await execute(query)).rows,
    validUploadKey, mayDownloadUpload, compatibleUploadBinding,
    isDedicatedSocialMediaKey,
    sendLocalProtectedUpload: async (_key: string, res: any) => {
      events.push("local");
      res.send(Buffer.from("verified local document"));
    },
    getCurrentUser: (req: any) => req.currentUser,
    isUserAdmin: (req: any) => req.currentUser.role === "admin",
    canAccessBranch: async (_req: any, branch: string) => branch === (opts.branch ?? "A"),
    hasCrossBranchHrReadAccess: () => false,
    canUserViewAllCashiers: async () => false,
    requirePermission: (module: string) => async (_req: any, res: any, next: () => void) =>
      (opts.modules ?? []).includes(module) ? next() : res.status(403).json({ error: "module denied" }),
    storage: { getPortalSetting: async () => "true" },
    PORTAL_SETTING_KEYS: { SHOW_WARNINGS: "show_warnings", SHOW_DOCUMENTS: "show_documents" },
  };
  const handler = Function(...Object.keys(deps), `return (${compiled})`)(...Object.values(deps));
  return {
    execute: async () => {
      const req: any = { path: `${opts.local ? "/uploads/" : "/api/uploads/file/"}${key}`, params: { 0: key }, currentUser: { id: opts.userId ?? "owner", role: opts.role ?? "employee" } };
      noStoreProtectedUpload(req, response, () => {});
      await handler(req, response);
      return response;
    },
    events, get query() { return lastQuery; }, get params() { return lastParams; },
  };
}

describe("GET /api/uploads/file/* route dispatch", () => {
  const journal: UploadBinding = { category: "journal", branch_id: "A", owner_id: "owner", upload_actor_id: "owner", status: null };
  it("resolves stored references with exact key and URL before touching bucket", async () => {
    const run = dispatch([journal], { modules: ["cashier_journal"] });
    const response = await run.execute();
    expect(response.code).toBe(200);
    expect(run.events).toEqual(["database", "bucket"]);
    expect(run.query).toContain("FROM journal_attachments a JOIN cashier_sales_journals j");
    expect(run.query).toContain("CASE WHEN j.created_by");
    expect(run.query).toContain("FROM employee_warnings w");
    expect(run.query).toContain("FROM financial_documents d");
    expect(run.params).toContain(`/api/uploads/file/${validKey}`);
  });
  it("denies cross-branch, missing module, unknown, and malformed paths before storage", async () => {
    for (const run of [
      dispatch([{ ...journal, branch_id: "B" }], { modules: ["cashier_journal"] }),
      dispatch([journal]),
      dispatch([]),
      dispatch([journal], { key: "a/%2e%2e/private.jpg", modules: ["cashier_journal"] }),
    ]) {
      const response = await run.execute();
      expect([400, 403]).toContain(response.code);
      expect(run.events).not.toContain("bucket");
    }
  });
  it("does not invoke legacy recovery for an unauthorized alias", async () => {
    const run = dispatch([{ ...journal, branch_id: "B" }], {
      key: "cashier-journals/13/legacy.jpg", legacy: true, modules: ["cashier_journal"],
    });
    expect((await run.execute()).code).toBe(403);
    expect(run.events).toEqual(["database"]);
  });
  it("does not let a permitted editable URL reference override another record's denial", async () => {
    const run = dispatch([journal, { category: "financial", branch_id: null, owner_id: "other", status: null }], {
      modules: ["cashier_journal"],
    });
    expect((await run.execute()).code).toBe(403);
    expect(run.events).toEqual(["database"]);
  });
  it("does not let a pasted protected onboarding key inherit a journal's branch grant", async () => {
    const run = dispatch([journal], {
      key: "onboarding_2_123_1234567890123_abcdef12.jpg",
      modules: ["cashier_journal"],
    });
    expect((await run.execute()).code).toBe(403);
    expect(run.events).toEqual(["database"]);
  });
  it("serves an authorized journal even if an unrelated feature table is absent", async () => {
    const run = dispatch([journal], { modules: ["cashier_journal"], missingUnrelated: true });
    expect((await run.execute()).code).toBe(200);
    expect(run.events).toContain("bucket");
    expect(run.events[0]).toBe("database");
  });
  it("rejects a copied marker whose uploader does not match the record", async () => {
    const run = dispatch([{ ...journal, upload_actor_id: "other" }], { modules: ["cashier_journal"] });
    expect((await run.execute()).code).toBe(403);
    expect(run.events).toEqual(["database"]);
  });
  it("fails closed for unsigned legacy attachments even when the row is writable", async () => {
    const run = dispatch([journal], {
      key: "cashier-journals_13_1234567890123_abcdef12.jpg", modules: ["cashier_journal"],
    });
    expect((await run.execute()).code).toBe(403);
    expect(run.events).toEqual(["database"]);
  });
  it("blocks another employee's guessed private document on both actual download routes", async () => {
    const key = makeAuthenticatedUploadName("doc-", "pdf", "owner")
      .replace("/", "_").replace(".pdf", "_1234567890123_abcdef12.pdf");
    const document: UploadBinding = {
      category: "document", branch_id: "A", owner_id: "owner", upload_actor_id: "owner", status: "private",
    };
    for (const local of [false, true]) {
      const localKey = local ? `documents/${key}` : key;
      const denied = dispatch([document], { local, key: localKey, userId: "another-employee", modules: ["documents"] });
      const allowed = dispatch([document], { local, key: localKey, modules: ["documents"] });
      const deniedResult = await denied.execute();
      expect(deniedResult.code).toBe(403);
      expect(denied.events).toEqual(["database"]);
      const allowedResult = await allowed.execute();
      expect(allowedResult.code).toBe(200);
      expect(allowed.events).toEqual(["database", local ? "local" : "bucket"]);
      for (const result of [deniedResult, allowedResult]) {
        expect(result.headers["Cache-Control"]).toBe("private, no-store");
      }
    }
  });
  it("does not launder legacy local HR URLs or unknown files through a session", async () => {
    for (const run of [
      dispatch([{ category: "employee_document", owner_id: "owner", branch_id: "A", status: null }], { local: true, key: "hr/private.pdf" }),
      dispatch([], { local: true, key: "social-media/social-legacy.jpg", modules: ["marketing"] }),
    ]) {
      const result = await run.execute();
      expect(result.code).toBe(403);
      expect(result.headers["Cache-Control"]).toBe("private, no-store");
      expect(run.events).toEqual(["database"]);
    }
    const admin = dispatch([], { local: true, key: "documents/legacy.pdf", role: "admin" });
    expect((await admin.execute()).code).toBe(200);
    expect(admin.events).toEqual(["database", "local"]);
  });
  it("preserves dedicated social producer assets only for marketing viewers without private bindings", async () => {
    const key = "social-media/social-1730000000000-123456789.jpg";
    const allowed = dispatch([], { local: true, key, modules: ["marketing"] });
    expect((await allowed.execute()).code).toBe(200);
    expect(allowed.events).toEqual(["database", "local"]);
    for (const run of [
      dispatch([], { local: true, key }),
      dispatch([], { key, modules: ["marketing"] }),
      dispatch([], { local: true, key: "social-media/private.pdf", modules: ["marketing"] }),
      dispatch([], { local: true, key: "other/social-1730000000000-123456789.jpg", modules: ["marketing"] }),
      dispatch([{ category: "employee_document", owner_id: "other", branch_id: "A", status: null }], { local: true, key, modules: ["marketing"] }),
      dispatch([{ category: "document", owner_id: "other", branch_id: "A", status: "private" }], { local: true, key, modules: ["marketing", "documents"] }),
    ]) {
      const result = await run.execute();
      expect(result.code).toBe(403);
      expect(result.headers["Cache-Control"]).toBe("private, no-store");
      expect(run.events).toEqual(["database"]);
    }
  });
  it("registers no-store before authentication/ACL and removes the early static bypass", () => {
    expect(source.indexOf('app.use(["/api/uploads/file", "/uploads", "/api/documents/file"], noStoreProtectedUpload)'))
      .toBeLessThan(source.indexOf("app.use(auditorApiLockdown)"));
    const index = readFileSync("server/index.ts", "utf8");
    expect(index).not.toMatch(/app\.use\(['"]\/uploads/);
  });
});

describe("other document file URLs", () => {
  it("redirects the authenticated document alias into the same checked route", async () => {
    const start = source.indexOf('app.get("/api/documents/file/:filename",');
    const end = source.indexOf("\n  // Serve shared files", start);
    const expression = source.slice(start, end)
      .replace(/^app\.get\("\/api\/documents\/file\/:filename", isAuthenticated, requirePermission\("documents", "view"\), /, "")
      .replace(/\);\s*$/, "");
    const compiled = (await transform(expression, { loader: "ts", target: "es2022" })).code.trim().replace(/;\s*$/, "");
    const handler = Function("validUploadKey", `return (${compiled})`)(validUploadKey);
    const result: any = {
      status(code: number) { this.code = code; return this; },
      json(body: unknown) { this.body = body; return this; },
      redirect(code: number, url: string) { this.code = code; this.url = url; return this; },
    };
    await handler({ params: { filename: validKey } }, result);
    expect(result.code).toBe(302);
    expect(result.url).toBe(`/api/uploads/file/${validKey}`);
    await handler({ params: { filename: "../hidden.pdf" } }, result);
    expect(result.code).toBe(400);
    expect(expression).not.toContain("downloadFromSupabase");
    expect(expression).not.toContain("sendFile");
  });

  it("does not expose an arbitrary bucket object via a copied or password-protected public share", async () => {
    const start = source.indexOf('app.get("/api/documents/shared-file/:shareLink/:filename",');
    const end = source.indexOf("\n  // Public share link access", start);
    const expression = source.slice(start, end)
      .replace(/^app\.get\("\/api\/documents\/shared-file\/:shareLink\/:filename", apiRateLimiter, /, "")
      .replaceAll('await import("./supabase-storage")', "await Promise.resolve(bucket)")
      .replace(/\);\s*$/, "");
    const compiled = (await transform(expression, { loader: "ts", target: "es2022" })).code.trim().replace(/;\s*$/, "");
    const key = makeAuthenticatedUploadName("doc-", "pdf", "owner")
      .replace("/", "_").replace(".pdf", "_1234567890123_abcdef12.pdf");
    let reads = 0;
    const bucket = { downloadFromSupabase: async () => {
      reads++;
      return { data: { arrayBuffer: async () => Uint8Array.of(1).buffer }, mimeType: "application/pdf" };
    } };
    const doc = { id: 1, filePath: key, createdBy: "owner", status: "active" };
    const share = {
      documentId: 1, isActive: true, shareType: "public",
      sharePassword: null as string | null, expiresAt: null,
      maxAccessCount: 0, accessCount: 0,
    };
    const storage = {
      getDocumentShareByLink: async () => share,
      getDocument: async () => doc,
      getDocumentVersions: async () => [],
    };
    const handler = Function("storage", "bucket", "validUploadKey", "authenticatedUploadMatchesActor", "Buffer", "console",
      `return (${compiled})`)(storage, bucket, validUploadKey, authenticatedUploadMatchesActor, Buffer, console);
    const response: any = {
      code: 200,
      status(code: number) { this.code = code; return this; },
      json(body: unknown) { this.body = body; return this; },
      set() { return this; },
      send(body: unknown) { this.body = body; return this; },
    };
    const req = { params: { shareLink: "a".repeat(32), filename: key } };
    doc.createdBy = "other";
    await handler(req, response);
    expect(response.code).toBe(403);
    expect(reads).toBe(0);
    doc.createdBy = "owner";
    share.sharePassword = "protected";
    await handler(req, response);
    expect(response.code).toBe(403);
    expect(reads).toBe(0);
    share.sharePassword = null;
    share.maxAccessCount = 1;
    share.accessCount = 1;
    await handler(req, response);
    expect(response.code).toBe(403);
    expect(reads).toBe(0);
    share.maxAccessCount = 0;
    response.code = 200;
    await handler(req, response);
    expect(response.code).toBe(200);
    expect(reads).toBe(1);
  });
});