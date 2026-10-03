import { useState } from "react";
import { createRoot } from "react-dom/client";
import type { AdminAccountAddition, EmployeeTemplatePilotResponse, PilotPermissionSource } from "@shared/employee-account-delegation";
import type { DelegatedEmployeeAccount, EmployeeAccountsResponse } from "@/lib/employee-account-types";
import type { ApprovedEmployeeTemplate } from "@/lib/employee-template-assignment";
import { EmployeeTemplatePilotDialog } from "./employee-template-pilot-dialog";
import { EmployeeTemplateAssignmentDialog } from "./employee-template-assignment-dialog";
import { EmployeeAccountAdditionsDialog } from "./employee-account-additions-dialog";
import { EmployeeAccountDialog } from "./employee-account-dialog";
import "./employee-account-dialog.fixture.css";

// This entry is used ONLY by the dedicated loopback Vite config/HTML.
// No application route imports it. Every fetch is intercepted, never forwarded.
const query = new URLSearchParams(location.search);
const kind = query.get("dialog") ?? "pilot";
const scenario = query.get("scenario") ?? "normal";
const long = query.get("long") === "1";
const modules = ["cashier_journal", "maintenance", "quality_control", "hr_documents", "hr_evaluations", "delivery_tasks"];
const before = modules.slice(0, long ? 6 : 2).map(module => ({ module, actions: ["view", "create"] }));
const after = before.map(row => ({ module: row.module, actions: ["view", "edit"] }));
const now = "2026-10-02T12:00:00Z";
const employee: DelegatedEmployeeAccount = {
  employeeId: 19, employeeName: "سارة منصور · بيانات اختبار محلية", branchId: "a", branchName: "فرع الاختبار المحلي",
  hasAccount: true, management: { allowed: true, reason: "allowed" },
  account: { id: "fixture-only-user", username: "fixture-user", isActive: "active", permissions: before, canReactivate: true },
};
const template: ApprovedEmployeeTemplate = {
  templateId: 7, version: 3, key: "fixture-review", name: "خدمة الفرع · قالب اختبار", scopeType: "branch", permissions: after, approvedAt: now,
};
const deny: PilotPermissionSource = {
  module: "cashier_journal", action: "delete", source: "override_deny", scopeType: "global",
  branchId: null, departmentId: null, startsAt: null, endsAt: "2026-11-02T12:00:00Z", temporalState: "active", allowed: false,
};
let additions: AdminAccountAddition[] = Array.from({ length: long ? 12 : 1 }, (_, index) => ({
  id: 41 + index, module: "cashier_journal", action: "delete", allow: false, scopeType: "global", branchId: null,
  startsAt: null, endsAt: deny.endsAt, reason: `منع مستقل محفوظ للاختبار ${index + 1}`, revision: `fixture-revision-${index}`,
  createdBy: "fixture-admin", createdAt: now, updatedAt: now, integrity: "managed",
}));
const assignment = { templateId: 7, version: 1, branchId: "a", revision: "fixture-assignment", assignedAt: now, assignedBy: "fixture-admin", reason: "الإسناد السابق محفوظ" };
let comparison: EmployeeTemplatePilotResponse = {
  employeeId: 19, branchId: "a", templateId: 7, version: 3, comparisonStatus: "known", canApply: true,
  blockedReasons: [], expectedComparisonRevision: "f".repeat(64), capturedAt: now, nextDecisionBoundary: null,
  scope: { kind: "employee_branch", branchId: "a", limitations: ["المقارنة لا تتجاوز ملكية الملفات أو المهام."] },
  currentBase: before, proposedBase: after,
  before: { sourceMode: "direct", effectivePermissions: before, sources: [deny] },
  after: { sourceMode: "direct", effectivePermissions: after, sources: [deny] },
  differences: { additions: after.map(row => ({ module: row.module, actions: ["edit"] })), removals: before.map(row => ({ module: row.module, actions: ["create"] })), retained: before.map(row => ({ module: row.module, actions: ["view"] })), retainedDenies: [deny] },
  extras: additions, assignment,
};
if (scenario === "blocked") comparison = {
  ...comparison, canApply: false, comparisonStatus: "unknown", after: null, differences: null,
  blockedReasons: [{ code: "PROTECTED_ACCOUNT", message: "هذا الحساب محمي بسبب استثناء غير مُدار · سبب اختبار من الخادم" }],
};
const directory: EmployeeAccountsResponse = {
  branches: [{ id: "a", name: employee.branchName }], employees: [employee],
  policy: { enabled: true, permissions: after }, availablePermissions: after,
  templates: [{ id: "fixture", name: "خدمة الفرع", permissions: after }],
};
type MockRequest = { url: string; method: string; body: unknown };
type FixtureControls = {
  requests: MockRequest[]; writes: MockRequest[];
  completeWrite: (success?: boolean) => void; releaseReads: () => void; stale: () => void;
};
declare global { interface Window { __employeeDialogFixture: FixtureControls } }
let queuedWrite: { resolve: (response: Response) => void; result: unknown; commit: () => void } | null = null;
const waitingReads: (() => void)[] = [];
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const controls: FixtureControls = {
  requests: [], writes: [],
  completeWrite(success = true) {
    if (!queuedWrite) return;
    if (success) queuedWrite.commit();
    queuedWrite.resolve(success ? response(queuedWrite.result) : response({ error: "تغيّرت اللقطة؛ حدّث وأعد المراجعة", code: "COMPARISON_REVISION_CONFLICT" }, 409));
    queuedWrite = null;
  },
  releaseReads() { waitingReads.splice(0).forEach(resolve => resolve()); },
  stale() {},
};
window.__employeeDialogFixture = controls;
window.fetch = async (input, options) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const method = options?.method ?? "GET";
  const body = typeof options?.body === "string" ? JSON.parse(options.body) : null;
  const call = { url, method, body };
  controls.requests.push(call);
  if (!url.startsWith("/api/")) return response({ error: "Fixture blocks all network requests" }, 403);
  if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (method !== "GET") {
    controls.writes.push(call);
    if (scenario === "conflict") return response({ error: "تغيّرت اللقطة؛ حدّث وأعد المراجعة", code: "COMPARISON_REVISION_CONFLICT" }, 409);
    let result: unknown = { employee, assignment };
    let commit = () => {};
    if (url.endsWith("/employee-template-pilot/19")) {
      const saved = { ...assignment, version: 3, reason: body.reason };
      result = { employee, assignment: saved, comparison };
      commit = () => { comparison = { ...comparison, assignment: saved, before: comparison.after, currentBase: after }; };
    } else if (url.includes("employee-account-additions")) {
      if (method === "DELETE") {
        const id = Number(url.split("/").pop());
        commit = () => { additions = additions.filter(row => row.id !== id); };
        result = { deleted: true, id };
      } else {
        const id = method === "PATCH" ? Number(url.split("/").pop()) : 91;
        const addition = { ...additions[0], ...body, id, revision: "fixture-updated", integrity: "managed" };
        commit = () => { additions = [...additions.filter(row => row.id !== id), addition]; };
        result = { addition };
      }
    } else if (url.endsWith("/template-account") || method === "POST") {
      result = { employee, assignment, credentials: { username: "fixture-user", password: "fixture-only-secret" } };
    }
    // Pending never self-resets. Tester explicitly completes/fails the mock.
    if (scenario === "pending") return new Promise<Response>(resolve => { queuedWrite = { resolve, result, commit }; });
    commit();
    return response(result);
  }
  if (scenario === "loading") await new Promise<void>(resolve => waitingReads.push(resolve));
  if (scenario === "error") return response({ error: "خدمة الاختبار غير متاحة", code: "migration_required" }, 503);
  if (url.includes("pilot-catalog") || url.includes("job-templates")) return response({ templates: scenario === "empty" ? [] : [template], excludedTemplates: [] });
  if (url.includes("employee-template-pilot/")) return response(comparison);
  if (url.includes("template-assignment")) return response({
    employeeId: 19, branchId: "a", assignment, currentPermissions: before, additions, expectedAssignmentRevision: "f".repeat(64),
  });
  if (url.includes("employee-account-additions")) return response({
    employeeId: 19, branchId: "a", userId: "fixture-only-user", additions: scenario === "empty" ? [] : additions,
    capabilities: {
      globalModules: modules.map(module => ({ module, actions: ["view", "create", "edit", "delete"] })),
      branchModules: [{ module: "hr_documents", actions: ["view", "edit"] }],
      unsupportedScopes: ["department", "self", "assigned_tasks"], globalScopeLabel: "عام · غير مقيد بالفرع",
    },
  });
  return response({ error: "Unknown fixture API; never forwarded" }, 404);
};

function Fixture() {
  const [open, setOpen] = useState(true);
  const [revision, setRevision] = useState(0);
  controls.stale = () => setRevision(value => value + 1);
  const close = () => setOpen(false);
  const refresh = () => {};
  const creating = query.get("mode") === "create";
  const row = creating ? { ...employee, hasAccount: false, account: null } : employee;
  return <main dir="rtl" className="min-h-[100dvh] bg-background p-6 text-foreground">
    <h1 className="text-lg font-bold">نافذة حساب · اختبار محلي فقط</h1>
    <p className="my-3 text-sm">كل الطلبات محاكاة داخل المتصفح. لا اتصال بقاعدة بيانات أو حساب حقيقي.</p>
    <button className="rounded-lg border p-3" onClick={() => setOpen(true)}>فتح النافذة مجددًا</button>
    {open && (kind === "pilot" ? <EmployeeTemplatePilotDialog actorRole="admin" actorId="fixture-admin" employee={employee} contextRevision={String(revision)} close={close} refresh={refresh} /> :
      kind === "assignment" ? <EmployeeTemplateAssignmentDialog employee={row} mode={creating ? "create" : "permissions"} directory={directory} close={close} refresh={refresh} /> :
      kind === "additions" ? <EmployeeAccountAdditionsDialog actorRole="admin" employee={employee} close={close} refresh={refresh} /> :
      <EmployeeAccountDialog employee={row} mode={creating ? "create" : query.get("mode") === "freeze" ? "freeze" : query.get("mode") === "reopen" ? "reopen" : "permissions"} directory={directory} close={close} refresh={refresh} />)}
  </main>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);