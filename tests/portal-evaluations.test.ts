/**
 * اختبارات حماية بوابة الموظف — مسارات التقييمات
 *
 * تغطي:
 *  1. الموظف يرى تقييماته المعتمدة فقط (لا مسودات ولا ما ينتظر الاعتماد)
 *  2. الموظف لا يرى تقييمات موظف آخر
 *  3. رفض الإقرار على تقييم موظف آخر (409 دون أي تعديل)
 *  4. رفض الإقرار المكرر (409)
 *  5. رفض الإقرار على مسودة غير معتمدة (409)
 *  6. حجب المسارات عند إيقاف مفاتيح show_evaluations و allow_evaluation_ack (403)
 *
 * تعمل على قاعدة بيانات التطوير وتُنظف بياناتها بالكامل بعد الانتهاء.
 * التشغيل: npm run test:portal
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import type { Server } from "http";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

// هوية المستخدم الحالي — تُبدَّل بين الاختبارات لمحاكاة موظفين مختلفين
let currentUserId: string | null = null;

vi.mock("../server/auth", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    isAuthenticated: (req: any, _res: any, next: any) => {
      req.currentUser = currentUserId ? { id: currentUserId } : undefined;
      next();
    },
  };
});

let server: Server;
let base: string;
let userA: string;
let userB: string;
let empAId: number;
let approvedEvalId: number;
let draftEvalId: number;
let branchId: string;
const TEST_NAME_A = "TEST-EVAL-EMP-A";
const TEST_NAME_B = "TEST-EVAL-EMP-B";
const SETTING_KEYS = ["show_evaluations", "allow_evaluation_ack"] as const;
const originalSettings: Record<string, string | null> = {};

async function setFlag(key: string, value: string) {
  await db.execute(sql`
    INSERT INTO portal_settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = ${value}
  `);
}

async function api(method: string, path: string, body?: any) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* بعض الردود بلا جسم */ }
  return { status: res.status, json };
}

beforeAll(async () => {
  // حارس أمان: ممنوع التشغيل على قاعدة الإنتاج
  const dbUrl = process.env.DATABASE_URL || "";
  if (process.env.NODE_ENV === "production" || /supabase|pooler\.supabase|render\.com/i.test(dbUrl)) {
    throw new Error("رفض التشغيل: يبدو أن الاتصال موجه لقاعدة بيانات الإنتاج");
  }

  // مستخدمان بلا ملف موظف مرتبط (حتى لا يتداخل الاختبار مع بيانات حقيقية)
  const u: any = await db.execute(sql`
    SELECT u.id FROM users u
    LEFT JOIN branch_employees be ON be.linked_user_id = u.id
    WHERE be.id IS NULL
    ORDER BY u.id LIMIT 2
  `);
  const rows = (u.rows || u) as { id: string }[];
  if (rows.length < 2) throw new Error("نحتاج مستخدمين اثنين بلا ملف موظف مرتبط في قاعدة التطوير");
  userA = rows[0].id;
  userB = rows[1].id;

  const b: any = await db.execute(sql`SELECT id FROM branches LIMIT 1`);
  branchId = (b.rows || b)[0].id;

  // موظفان مرتبطان بالمستخدمين
  const empA: any = await db.execute(sql`
    INSERT INTO branch_employees (branch_id, employee_name, job_title, nationality, salary, linked_user_id, status)
    VALUES (${branchId}, ${TEST_NAME_A}, 'كاشير', 'سعودي', 4000, ${userA}, 'active')
    RETURNING id
  `);
  empAId = (empA.rows || empA)[0].id;
  await db.execute(sql`
    INSERT INTO branch_employees (branch_id, employee_name, job_title, nationality, salary, linked_user_id, status)
    VALUES (${branchId}, ${TEST_NAME_B}, 'كاشير', 'سعودي', 4000, ${userB}, 'active')
  `);

  // تقييم معتمد + مسودة لنفس الموظف A
  const ev1: any = await db.execute(sql`
    INSERT INTO employee_evaluations (branch_employee_id, branch_id, period_type, period_start, period_end, criteria, overall_score, status)
    VALUES (${empAId}, ${branchId}, 'quarterly', '2001-01-01', '2001-03-31', '[]'::jsonb, 4.5, 'approved')
    RETURNING id
  `);
  approvedEvalId = (ev1.rows || ev1)[0].id;
  const ev2: any = await db.execute(sql`
    INSERT INTO employee_evaluations (branch_employee_id, branch_id, period_type, period_start, period_end, criteria, overall_score, status)
    VALUES (${empAId}, ${branchId}, 'annual', '2001-01-01', '2001-12-31', '[]'::jsonb, 3.0, 'draft')
    RETURNING id
  `);
  draftEvalId = (ev2.rows || ev2)[0].id;

  // حفظ إعدادات البوابة الأصلية ثم تفعيل المفاتيح
  for (const key of SETTING_KEYS) {
    const r: any = await db.execute(sql`SELECT value FROM portal_settings WHERE key = ${key}`);
    originalSettings[key] = (r.rows || r)[0]?.value ?? null;
    await setFlag(key, "true");
  }

  // خادم اختبار يسجل مسارات البوابة مع مصادقة مقلّدة
  const { registerSelfServiceRoutes } = await import("../server/self-service-routes");
  const app = express();
  app.use(express.json());
  registerSelfServiceRoutes(app);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const addr = server.address() as any;
  base = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  // استرجاع إعدادات البوابة الأصلية
  for (const key of SETTING_KEYS) {
    const orig = originalSettings[key];
    if (orig === null || orig === undefined) {
      await db.execute(sql`DELETE FROM portal_settings WHERE key = ${key}`);
    } else {
      await setFlag(key, orig);
    }
  }
  // تنظيف البيانات (حذف الموظفين يحذف التقييمات بالتسلسل cascade)
  await db.execute(sql`DELETE FROM notifications WHERE message LIKE ${"%" + TEST_NAME_A + "%"}`);
  await db.execute(sql`DELETE FROM branch_employees WHERE employee_name IN (${TEST_NAME_A}, ${TEST_NAME_B})`);
  if (server) await new Promise((r) => server.close(r));
});

describe("بوابة الموظف — عزل التقييمات بين الموظفين", () => {
  it("الموظف A يرى تقييمه المعتمد فقط (المسودة لا تظهر)", async () => {
    currentUserId = userA;
    const { status, json } = await api("GET", "/api/my/evaluations");
    expect(status).toBe(200);
    const ids = (json as any[]).map((r) => r.id);
    expect(ids).toContain(approvedEvalId);
    expect(ids).not.toContain(draftEvalId);
    expect((json as any[]).every((r) => r.status === "approved")).toBe(true);
  });

  it("الموظف B لا يرى أي تقييم يخص الموظف A", async () => {
    currentUserId = userB;
    const { status, json } = await api("GET", "/api/my/evaluations");
    expect(status).toBe(200);
    const ids = (json as any[]).map((r) => r.id);
    expect(ids).not.toContain(approvedEvalId);
    expect(ids).not.toContain(draftEvalId);
  });

  it("الموظف B لا يستطيع الإقرار على تقييم الموظف A (409 دون تعديل)", async () => {
    currentUserId = userB;
    const { status } = await api("POST", `/api/my/evaluations/${approvedEvalId}/acknowledge`, { comment: "محاولة اختراق" });
    expect(status).toBe(409);
    const r: any = await db.execute(sql`SELECT employee_ack_at FROM employee_evaluations WHERE id = ${approvedEvalId}`);
    expect((r.rows || r)[0].employee_ack_at).toBeNull();
  });

  it("لا يمكن الإقرار على مسودة غير معتمدة حتى لصاحبها (409)", async () => {
    currentUserId = userA;
    const { status } = await api("POST", `/api/my/evaluations/${draftEvalId}/acknowledge`);
    expect(status).toBe(409);
  });

  it("إيقاف مفتاح allow_evaluation_ack يمنع الإقرار (403)", async () => {
    currentUserId = userA;
    await setFlag("allow_evaluation_ack", "false");
    const { status, json } = await api("POST", `/api/my/evaluations/${approvedEvalId}/acknowledge`);
    expect(status).toBe(403);
    expect(json?.disabled).toBe(true);
    await setFlag("allow_evaluation_ack", "true");
  });

  it("إيقاف مفتاح show_evaluations يحجب القائمة والإقرار معاً (403)", async () => {
    currentUserId = userA;
    await setFlag("show_evaluations", "false");
    const list = await api("GET", "/api/my/evaluations");
    expect(list.status).toBe(403);
    const ack = await api("POST", `/api/my/evaluations/${approvedEvalId}/acknowledge`);
    expect(ack.status).toBe(403);
    await setFlag("show_evaluations", "true");
  });

  it("الإقرار الصحيح يمر مرة واحدة فقط — التكرار يُرفض (409)", async () => {
    currentUserId = userA;
    const first = await api("POST", `/api/my/evaluations/${approvedEvalId}/acknowledge`, { comment: "اطلعت عليه" });
    expect(first.status).toBe(200);
    expect(first.json.id).toBe(approvedEvalId);
    expect(first.json.employeeAckAt).toBeTruthy();
    const second = await api("POST", `/api/my/evaluations/${approvedEvalId}/acknowledge`);
    expect(second.status).toBe(409);
  });

  it("مستخدم بلا ملف موظف مرتبط: قائمة فارغة و404 عند الإقرار", async () => {
    // مستخدم غير موجود إطلاقاً = لا ملف موظف
    currentUserId = "00000000-0000-0000-0000-000000000000";
    const list = await api("GET", "/api/my/evaluations");
    expect(list.status).toBe(200);
    expect(list.json).toEqual([]);
    const ack = await api("POST", `/api/my/evaluations/${approvedEvalId}/acknowledge`);
    expect(ack.status).toBe(404);
  });
});
