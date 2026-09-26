import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({
  warning: null as any,
  token: "",
  now: 0,
  lastUpdateSql: "",
}));

vi.mock("../server/db", async () => {
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const { getTableName } = await import("drizzle-orm");
  const dialect = new PgDialect();
  const matches = (predicate: any) => {
    const query = dialect.sqlToQuery(predicate);
    const sqlText: string = query.sql;
    const token = state.token;
    const row = state.warning;
    if (!row || !query.params.includes(token) || row.publicToken !== token) return false;
    if (sqlText.includes('"status"') && row.status !== "active") return false;
    if (sqlText.includes('"signed_at" IS NULL') && row.signedAt) return false;
    if (sqlText.includes('"expires_at"') && row.expiresAt && row.expiresAt < new Date(state.now).toISOString().slice(0, 10)) return false;
    const issued = /^v1\.(\d{13})\./.exec(token);
    if (sqlText.includes("CURRENT_TIMESTAMP <") && issued && state.now >= Number(issued[1]) + 7 * 86400000) return false;
    if (sqlText.includes("INTERVAL '7 days'") && state.now - row.createdAt.getTime() > 7 * 86400000) return false;
    return true;
  };
  const db = {
    select: () => ({
      from: (table: any) => ({
        where: async (condition: any) => {
          if (getTableName(table) === "employee_warnings") return matches(condition) ? [state.warning] : [];
          if (getTableName(table) === "branch_employees") return [{ id: 1, employeeName: "Employee", iqamaNumber: "SENSITIVE" }];
          return [];
        },
      }),
    }),
    update: () => ({
      set: (values: any) => ({
        where: (condition: any) => ({
          returning: async () => {
            state.lastUpdateSql = dialect.sqlToQuery(condition).sql;
            if (!matches(condition)) return [];
            Object.assign(state.warning, values);
            return [state.warning];
          },
        }),
      }),
    }),
  };
  return { db };
});

import { registerHrRoutes } from "../server/hr-routes";
import { issueWarningPublicToken, warningPublicAccessCondition } from "../server/warning-public-token";

const routes = new Map<string, Function>();
const app: any = {};
for (const method of ["get", "post", "patch", "put", "delete"]) {
  app[method] = (path: string, ...handlers: Function[]) => routes.set(`${method} ${path}`, handlers.at(-1)!);
}
registerHrRoutes(app);

async function request(method: string, path: string) {
  const response: any = {
    code: 200, body: null,
    status(code: number) { this.code = code; return this; },
    json(body: any) { this.body = body; return this; },
  };
  const handler = routes.get(`${method} /api/public/warning/:token` + (method === "post" ? "/sign" : ""));
  expect(handler).toBeDefined();
  await handler!({
    params: { token: state.token }, body: { signatureData: "x".repeat(50) },
    ip: "127.0.0.1", socket: {}, headers: {},
  }, response);
  return response;
}

describe("public warning link lifecycle", () => {
  beforeEach(() => {
    state.now = Date.now();
    state.token = issueWarningPublicToken(new Date(state.now - 86400000));
    state.warning = {
      id: 1, branchEmployeeId: 1, branchId: null, publicToken: state.token,
      createdAt: new Date(state.now - 86400000), status: "active", expiresAt: null,
      signedAt: null, templateId: null, reasonCategory: null, issuedDate: "2026-01-01",
    };
    state.lastUpdateSql = "";
  });

  it("serves a valid link without exposing national ID and signs it only once", async () => {
    state.warning.templateId = "notice_attention";
    const get = await request("get", "");
    expect(get.code).toBe(200);
    expect(get.body.employee).not.toHaveProperty("nationalId");
    expect(get.body.template.body).toContain("Employee");
    expect(get.body.template.body).not.toContain("SENSITIVE");
    const sign = await request("post", "/sign");
    expect(sign.code).toBe(200);
    expect(state.lastUpdateSql).toContain('"signed_at" IS NULL');
    expect(state.lastUpdateSql).toContain('"status"');
    expect((await request("post", "/sign")).code).toBe(409);
  });

  it("rejects expired links on both GET and sign even after unrelated edits", async () => {
    state.token = issueWarningPublicToken(new Date(state.now - 8 * 86400000));
    state.warning.publicToken = state.token;
    state.warning.createdAt = new Date(state.now);
    state.warning.updatedAt = new Date(state.now);
    expect((await request("get", "")).code).toBe(404);
    expect((await request("post", "/sign")).code).toBe(404);
  });

  it.each(["cancelled", "appealed", "expired"])("rejects %s warnings on GET and sign", async (status) => {
    state.warning.status = status;
    expect((await request("get", "")).code).toBe(404);
    expect((await request("post", "/sign")).code).toBe(404);
  });

  it("honors warning expiry dates on GET and sign", async () => {
    state.warning.expiresAt = "2020-01-01";
    expect((await request("get", "")).code).toBe(404);
    expect((await request("post", "/sign")).code).toBe(404);
  });

  it("allows signing throughout the warning's expiry date", async () => {
    state.warning.expiresAt = new Date(state.now).toISOString().slice(0, 10);
    expect((await request("get", "")).code).toBe(200);
    expect((await request("post", "/sign")).code).toBe(200);
  });

  it("rejects a revoked token after replacement", async () => {
    state.warning.publicToken = issueWarningPublicToken(new Date(state.now));
    expect((await request("get", "")).code).toBe(404);
    expect((await request("post", "/sign")).code).toBe(404);
  });

  it("keeps old pre-versioned links within their creation-date window only", async () => {
    state.token = "pre-versioned-token";
    state.warning.publicToken = state.token;
    const dialect = new PgDialect();
    const sql = dialect.sqlToQuery(warningPublicAccessCondition("old-token")).sql;
    expect(sql).toContain("INTERVAL '7 days'");
    expect(sql).toContain('"created_at"');
    expect((await request("get", "")).code).toBe(200);
    expect((await request("post", "/sign")).code).toBe(200);
    state.warning.signedAt = null;
    state.warning.createdAt = new Date(state.now - 8 * 86400000);
    expect((await request("get", "")).code).toBe(404);
    expect((await request("post", "/sign")).code).toBe(404);
  });
});