/**
 * Strictly isolated test fixture for the actual salary-closing React page.
 * It runs a Vite middleware server on 127.0.0.1, substitutes only the page's
 * auth/permission/branch hooks with synthetic test-only hooks, and serves
 * payroll APIs from in-memory objects. It does not start the app server,
 * access a database, or forward API requests anywhere.
 *
 *   SALARY_CLOSING_FIXTURE_PORT=5099 npx tsx tests/salary-closing.browser.fixture.ts --serve
 * Navigate to /__salary-closing-fixture?branchId=fixture-branch&month=2026-03
 * Stop with Ctrl-C. Payroll mutation requests are refused; PDF rendering has
 * an in-memory synthetic response only, with no persistence or forwarding.
 */
import express from "express";
import { createServer as createViteServer } from "vite";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const port = Number(process.env.SALARY_CLOSING_FIXTURE_PORT || 5099);
const fixtureLabel = "SYNTHETIC PAYROLL FIXTURE — NO LIVE AUTH OR DATABASE";
const branchId = "fixture-branch";
const month = "2026-03";
type Scenario = "membership" | "clean" | "locked";
let scenario: Scenario = "membership";
let failNextPreviews = 0;
let previewRequests = 0;
const requests: string[] = [];
const forbiddenApiWrites: string[] = [];
const syntheticPdfRequests: unknown[] = [];

const line = {
  id: 3901, branchEmployeeId: 3901, employeeName: "موظف تجريبي", employeeNumber: "SYN-3901",
  employeeStatus: "active", jobTitle: "موظف اختبار", nationality: "اختبارية", bankName: "بنك تجريبي",
  bankAccountNumber: "SA0000000000000000000000", baseSalary: 5000, housingAllowance: 1000,
  allowances: 1000, grossSalary: 6000, dailyRate: 200, absenceDeduction: 0, sickLeaveDeduction: 0,
  socialInsurance: 600, manualDeductionsTotal: 0, manualDeductions: [], netSalary: 5400,
  scheduledWorkDays: 30, scheduledHours: 240, lateDays: 0, offDays: 0, presentDays: 30,
  absentDays: 0, totalHours: 240, branchName: "فرع الاختبار", departmentName: "اختبار",
  presentDates: [], absentDatesExplicit: [], absentDatesMissing: [], offDates: [], leaveBreakdown: [],
};
const memberWarning = {
  branchEmployeeId: 3901, employeeName: line.employeeName, code: "historical_membership",
  message: "موظف تجريبي: توجد عضوية تاريخية غير محسومة في فرع آخر.",
};
const storedNormalWarnings = [{
  branchEmployeeId: 3901, employeeName: line.employeeName, code: "no_work_at_all",
  message: "تحذير محفوظ عادي من لقطة الإغلاق التجريبية.",
}];
const lockedClosure = {
  id: 73901, branchId, month, status: "closed", closedByName: "Synthetic Fixture",
  closedAt: "2026-04-01T00:00:00.000Z", notes: "SYNTHETIC LOCKED SNAPSHOT",
  warnings: storedNormalWarnings,
};

function syntheticPreview() {
  const locked = scenario === "locked";
  return {
    fixture: fixtureLabel,
    lines: [{ ...line }],
    totals: { employeeCount: 1, grossSalary: 6000, netSalary: 5400 },
    unlinked: [],
    unlinkedSummary: { totalRecords: 0, presentRecords: 0, totalHours: 0 },
    // A pre-existing locked snapshot keeps only ordinary stored warnings.
    // The historical-membership blocker is never stored in a closure.
    warnings: scenario === "membership" ? [{ ...memberWarning }] : locked ? storedNormalWarnings : [],
    closure: locked ? { ...lockedClosure, warnings: [...storedNormalWarnings] } : null,
    isLocked: locked,
  };
}

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use((req, res, next) => {
    res.setHeader("X-Salary-Closing-Fixture", "synthetic-payroll-only");
    res.setHeader("Cache-Control", "no-store");
    if (req.path.startsWith("/api/")) requests.push(`${req.method} ${req.path}`);
    if (req.path === "/api/pdf/salary-closing" && req.method === "POST") return next();
    if (req.path.startsWith("/api/") && !["GET", "HEAD"].includes(req.method)) {
      forbiddenApiWrites.push(`${req.method} ${req.path}`);
      return res.status(405).json({ error: "Synthetic fixture is read-only; payroll writes are disabled." });
    }
    next();
  });

  app.get("/__salary-closing-fixture/status", (_req, res) => res.json({
    fixture: fixtureLabel, mode: "in-memory only; no auth provider/app server/database",
    scenario, failNextPreviews, previewRequests, requests, forbiddenApiWrites,
    syntheticPdfRequests: syntheticPdfRequests.length,
  }));
  app.post("/__salary-closing-fixture/scenario", (req, res) => {
    if (!["membership", "clean", "locked"].includes(req.body?.scenario)) {
      return res.status(400).json({ error: "Unsupported synthetic scenario" });
    }
    scenario = req.body.scenario;
    failNextPreviews = 0;
    res.json({ fixture: fixtureLabel, scenario });
  });
  app.post("/__salary-closing-fixture/fail-next-previews", (req, res) => {
    failNextPreviews = Math.min(5, Math.max(1, Number(req.body?.count) || 1));
    res.json({ fixture: fixtureLabel, failNextPreviews });
  });

  app.get("/__salary-closing-fixture", (_req, res) => {
    const html = readFileSync(resolve(process.cwd(), "tests/fixtures/salary-closing.html"), "utf8");
    const entry = resolve(process.cwd(), "tests/fixtures/salary-closing-entry.tsx");
    res.type("html").send(html.replace("__FIXTURE_ENTRY__", `/@fs/${entry}`));
  });
  app.get("/api/branches", (_req, res) => res.json([{ id: branchId, name: "فرع الاختبار" }]));
  app.get("/api/employee-reports/bundle", (_req, res) => res.json({
    fixture: fixtureLabel, employees: [{ ...line }], attendance: [], schedules: [], salaryDeductions: [],
  }));
  app.get("/api/salary-closing/preview", (_req, res) => {
    previewRequests++;
    if (failNextPreviews > 0) {
      failNextPreviews--;
      return res.status(503).json({ error: "Synthetic preview refresh failure" });
    }
    res.json(syntheticPreview());
  });
  app.get("/api/salary-closing", (_req, res) => res.json({
    fixture: fixtureLabel,
    closure: scenario === "locked" ? { ...lockedClosure, warnings: [...storedNormalWarnings] } : null,
    lines: scenario === "locked" ? [{ ...line, id: 73911, netSalary: 5400 }] : [],
  }));
  app.get("/api/salary-closing/payments", (_req, res) => res.json([]));
  app.post("/api/pdf/salary-closing", (req, res) => {
    syntheticPdfRequests.push(req.body);
    res.type("application/pdf").send("%PDF-1.4\n% synthetic payroll fixture PDF\n%%EOF");
  });
  app.get("/api/my-permissions", (_req, res) => res.json([]));
  // Fail closed: there are no other permitted endpoints in this fixture.
  app.all("/api/*", (req, res) => res.status(404).json({ error: `No synthetic fixture for ${req.method} ${req.path}` }));

  return app;
}

async function main() {
  const fixtureAliases = [
    { find: "@/components/layout", replacement: resolve("tests/fixtures/salary-closing-layout.tsx") },
    { find: "@/hooks/useAuth", replacement: resolve("tests/fixtures/salary-closing-auth.ts") },
    { find: "@/hooks/usePermissions", replacement: resolve("tests/fixtures/salary-closing-permissions.ts") },
    { find: "@/hooks/useBranches", replacement: resolve("tests/fixtures/salary-closing-branches.ts") },
  ];
  const vite = await createViteServer({
    root: resolve("client"),
    configFile: resolve("vite.config.ts"),
    resolve: { alias: fixtureAliases },
    server: { middlewareMode: true, fs: { allow: [resolve(process.cwd())] } },
    appType: "custom",
  });
  const app = createApp();
  app.use(vite.middlewares);
  const server = app.listen(port, "127.0.0.1");
  await new Promise<void>((done, reject) => {
    server.once("listening", done);
    server.once("error", reject);
  });
  console.log(`Synthetic salary-closing fixture at http://127.0.0.1:${port}/__salary-closing-fixture?branchId=${branchId}&month=${month}`);
  const close = () => { server.close(); void vite.close(); };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

void main().catch(error => { console.error(error); process.exitCode = 1; });