import { createElement } from "react";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminAccountAddition, EmployeeTemplatePilotResponse, PilotPermissionSource } from "@shared/employee-account-delegation";
import type { DelegatedEmployeeAccount } from "@/lib/employee-account-types";
import { EmployeeTemplatePilotDialog } from "./employee-template-pilot-dialog";

const { act, create } = createRequire(import.meta.url)("react-test-renderer");
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.mock("@/components/ui/dialog", () => {
  const element = ({ children }: { children: React.ReactNode }) => createElement("section", null, children);
  const dialog = ({ children, onOpenChange }: { children: React.ReactNode; onOpenChange: (open: boolean) => void }) =>
    createElement("section", { "data-testid": "test-dialog", onOpenChange }, children);
  return { Dialog: dialog, DialogContent: element, DialogHeader: element, DialogTitle: element, DialogDescription: element, DialogFooter: element };
});
const employee: DelegatedEmployeeAccount = {
  employeeId: 19, employeeName: "موظف تجربة محدد", branchId: "a", branchName: "فرع التجربة",
  hasAccount: true, management: { allowed: true, reason: "allowed" },
  account: { id: "linked-test-user", username: "test-user", isActive: "active", permissions: [], canReactivate: true },
};
const deny: PilotPermissionSource = {
  module: "cashier_journal", action: "edit", source: "override_deny", scopeType: "global", branchId: null,
  departmentId: null, startsAt: "2026-09-01T00:00:00Z", endsAt: "2026-10-03T12:00:00Z", temporalState: "active", allowed: false,
};
const intrinsic: PilotPermissionSource = { ...deny, module: "delivery_tasks", action: "view", source: "intrinsic", startsAt: null, endsAt: null, temporalState: "active", allowed: true, scopeType: "assigned_tasks" };
const extra: AdminAccountAddition = {
  id: 41, module: deny.module, action: deny.action, allow: false, scopeType: "global", branchId: null,
  startsAt: deny.startsAt, endsAt: deny.endsAt, reason: "منع مستقل لا تغيّره التجربة",
  revision: "11111111-1111-4111-8111-111111111111", createdBy: "admin-test", createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", integrity: "managed",
};
const initial: EmployeeTemplatePilotResponse = {
  employeeId: 19, branchId: "a", templateId: 7, version: 3, comparisonStatus: "known", canApply: true,
  blockedReasons: [], expectedComparisonRevision: "f".repeat(64), capturedAt: "2026-10-02T12:00:00Z", nextDecisionBoundary: null,
  scope: { kind: "employee_branch", branchId: "a", limitations: ["حدود الفرع لا تتجاوز ملكية الملفات أو المهام."] },
  currentBase: [{ module: "cashier_journal", actions: ["view"] }],
  proposedBase: [{ module: "cashier_journal", actions: ["view", "edit"] }],
  before: { sourceMode: "direct", effectivePermissions: [{ module: "cashier_journal", actions: ["view"] }, { module: "delivery_tasks", actions: ["view"] }], sources: [deny, intrinsic] },
  after: { sourceMode: "direct", effectivePermissions: [{ module: "cashier_journal", actions: ["view"] }, { module: "delivery_tasks", actions: ["view"] }], sources: [deny, intrinsic] },
  differences: { additions: [], removals: [], retained: [{ module: "cashier_journal", actions: ["view"] }, { module: "delivery_tasks", actions: ["view"] }], retainedDenies: [deny] },
  extras: [extra],
  assignment: { templateId: 7, version: 1, branchId: "a", revision: "old-assignment", assignedAt: "2026-09-01T00:00:00Z", assignedBy: "admin-test", reason: "إصدار سابق معتمد محفوظ" },
};
const template = { templateId: 7, version: 3, key: "pilot-template", name: "قالب تجربة معتمد", scopeType: "branch", permissions: [{ module: "cashier_journal", actions: ["view", "edit"] }], approvedAt: "2026-10-02T09:00:00Z" };
let renderer: any;
let preview: EmployeeTemplatePilotResponse;
let catalog: any[];
let fetchMock: ReturnType<typeof vi.fn>;
let write: ReturnType<typeof vi.fn>;
let postReadFails: boolean;
const text = (node: any): string => typeof node === "string" ? node : (node.children ?? []).map(text).join("");
const button = (label: string) => renderer.root.findAllByType("button").find((node: any) => text(node).includes(label));
const serialized = () => JSON.stringify(renderer.toJSON());
const change = async (id: string, value: string) => act(async () => renderer.root.findByProps({ id }).props.onChange({ target: { value } }));
const checkbox = async (id: string, checked = true) => act(async () => renderer.root.findByProps({ id }).props.onChange({ target: { checked } }));
async function mount(actorRole = "admin", row = employee) {
  const close = vi.fn(), refresh = vi.fn();
  await act(async () => { renderer = create(createElement(EmployeeTemplatePilotDialog, { actorRole, actorId: "admin-test", employee: row, close, refresh })); });
  return { close, refresh };
}
async function compare() {
  await change("pilot-template", "7:3");
  await act(async () => button("مقارنة الآن").props.onClick());
}
async function reviewFinal() {
  await change("pilot-reason", "تجربة واحدة بعد مراجعة الأدلة");
  await checkbox("pilot-review");
  await act(async () => button("الانتقال إلى تأكيد الحساب الواحد").props.onClick());
  await checkbox("pilot-final-confirm");
}
beforeEach(() => {
  preview = initial;
  catalog = [template];
  postReadFails = false;
  write = vi.fn().mockImplementation(() => {
    const comparison = preview;
    const assignment = { ...initial.assignment!, version: 3, revision: "applied-revision", assignedAt: "2026-10-02T12:00:05Z", reason: "تجربة واحدة بعد مراجعة الأدلة" };
    preview = { ...preview, assignment, currentBase: preview.proposedBase!, before: preview.after, expectedComparisonRevision: "a".repeat(64) };
    return Promise.resolve(new Response(JSON.stringify({ employee, assignment, comparison })));
  });
  fetchMock = vi.fn((url: string, options: { method: string }) => {
    if (options.method === "POST") return write(url, options);
    if (url.includes("/job-templates")) return Promise.resolve(new Response(JSON.stringify({ templates: catalog })));
    if (postReadFails && write.mock.calls.length) return Promise.resolve(new Response(JSON.stringify({ error: "القراءة غير متاحة" }), { status: 503 }));
    return Promise.resolve(new Response(JSON.stringify(preview)));
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("bounded admin template comparison and pilot", () => {
  it.each(["operations_manager", "employee", "branch_manager"])("never mounts pilot resources or controls for %s", async role => {
    await mount(role);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(button("مقارنة الآن")).toBeUndefined();
    expect(serialized()).toContain("للأدمن فقط");
  });
  it("selects no employee alternatives, template or participant automatically and starts with read-only catalog only", async () => {
    await mount();
    expect(renderer.root.findByProps({ id: "pilot-employee" }).props.value).toBe(employee.employeeName);
    expect(renderer.root.findByProps({ id: "pilot-employee" }).props.readOnly).toBe(true);
    expect(renderer.root.findByProps({ id: "pilot-template" }).props.value).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalled();
    expect(button("مقارنة الآن").props.disabled).toBe(true);
  });
  it("comparison is GET only and displays actual sources, denies, expiry and intrinsic authority separately from BASE", async () => {
    preview = { ...initial, before: { ...initial.before!, sources: [deny, intrinsic, { ...deny, source: "override_grant", module: "maintenance", temporalState: "expired", allowed: true }] } };
    await mount();
    await compare();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/employee-template-pilot/19?templateId=7&version=3", expect.objectContaining({ method: "GET" }));
    expect(write).not.toHaveBeenCalled();
    expect(serialized()).toContain("منع مستقل");
    expect(serialized()).toContain("انتهت صلاحيته");
    expect(serialized()).toContain("وصول أصيل للوظيفة");
    expect(serialized()).toContain("منع مستقل لا تغيّره التجربة");
    expect(renderer.root.findByProps({ "aria-label": "فرق الأساس المستقل في التجربة" })).toBeTruthy();
    const effective = renderer.root.findByProps({ "aria-label": "فرق الصلاحيات الفعالة من الخادم" });
    expect(text(effective)).toContain("لا إضافات فعالة بحسب الخادم");
    expect(text(effective)).not.toContain("منع مستقل لا تغيّره التجربة");
  });
  it("does not hide the previously approved assigned version when it is older than current picker options", async () => {
    await mount();
    await compare();
    const assignment = renderer.root.findByProps({ "data-testid": "pilot-current-assignment" });
    expect(text(assignment)).toContain("الإصدار 1");
    expect(text(assignment)).toContain("إصدار سابق معتمد محفوظ");
    expect(text(assignment)).toContain("ولو كان إصدارًا أقدم");
  });
  it("requires reason, review, separate final confirmation and one strict single-account POST, then reads actual state afresh", async () => {
    const { refresh } = await mount();
    await compare();
    expect(button("الانتقال إلى تأكيد الحساب الواحد").props.disabled).toBe(true);
    await change("pilot-reason", "تجربة واحدة بعد مراجعة الأدلة");
    await checkbox("pilot-review");
    expect(write).not.toHaveBeenCalled();
    await act(async () => button("الانتقال إلى تأكيد الحساب الواحد").props.onClick());
    expect(write).not.toHaveBeenCalled();
    expect(button("تأكيد التطبيق على هذا الحساب وحده").props.disabled).toBe(true);
    await act(async () => button("تأكيد التطبيق على هذا الحساب وحده").props.onClick());
    expect(write).not.toHaveBeenCalled();
    await checkbox("pilot-final-confirm");
    await act(async () => button("تأكيد التطبيق على هذا الحساب وحده").props.onClick());
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0][0]).toBe("/api/admin/employee-template-pilot/19");
    expect(JSON.parse(write.mock.calls[0][1].body)).toEqual({
      templateId: 7, version: 3, branchId: "a", reason: "تجربة واحدة بعد مراجعة الأدلة",
      expectedComparisonRevision: initial.expectedComparisonRevision, acknowledgeChanges: true,
    });
    expect(refresh).toHaveBeenCalledOnce();
    expect(renderer.root.findByProps({ "data-testid": "pilot-success" })).toBeTruthy();
    expect(renderer.root.findByProps({ "data-testid": "pilot-fresh-verification" })).toBeTruthy();
    expect(serialized()).toContain("قراءة جديدة من الخادم");
    expect(text(renderer.root.findByProps({ "data-testid": "pilot-success" }))).toContain("الإصدار 3");
    const reads = fetchMock.mock.calls.filter(call => call[0].includes("/employee-template-pilot/") && call[1].method === "GET");
    expect(reads).toHaveLength(2);
    await act(async () => button("إعادة قراءة الحالة الفعلية").props.onClick());
    expect(write).toHaveBeenCalledOnce();
  });
  it("shows unsupported/protected comparisons as unknown and blocked rather than inventing empty effective access", async () => {
    preview = { ...initial, comparisonStatus: "unknown", canApply: false, blockedReasons: [{ code: "PROTECTED_ACCOUNT", message: "حساب ذو إسناد قديم أو استثناء غير مُدار" }], proposedBase: null, before: null, after: null, differences: null };
    await mount("admin", { ...employee, account: null, management: { allowed: false, reason: "protected_account" } });
    await compare();
    expect(serialized()).toContain("حساب ذو إسناد قديم أو استثناء غير مُدار");
    expect(serialized()).toContain("PROTECTED_ACCOUNT");
    expect(serialized()).toContain("غير معروف");
    expect(serialized()).not.toContain("أكد الخادم عدم وجود إجراءات فعالة");
    expect(renderer.root.findByProps({ id: "pilot-review" }).props.disabled).toBe(true);
    expect(button("الانتقال إلى تأكيد الحساب الواحد").props.disabled).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });
  it("preserves selection and reason on 409, resets both acknowledgements and requires a new server comparison", async () => {
    write.mockResolvedValueOnce(new Response(JSON.stringify({ error: "تغيرت المقارنة", code: "COMPARISON_REVISION_CONFLICT" }), { status: 409 }));
    await mount();
    await compare();
    await reviewFinal();
    await act(async () => button("تأكيد التطبيق على هذا الحساب وحده").props.onClick());
    expect(renderer.root.findByProps({ id: "pilot-template" }).props.value).toBe("7:3");
    expect(renderer.root.findByProps({ id: "pilot-reason" }).props.value).toBe("تجربة واحدة بعد مراجعة الأدلة");
    expect(renderer.root.findByProps({ id: "pilot-review" }).props.checked).toBe(false);
    expect(renderer.root.findAllByProps({ id: "pilot-final-confirm" })).toHaveLength(0);
    preview = { ...initial, expectedComparisonRevision: "b".repeat(64), before: { ...initial.before!, sources: [{ ...deny, temporalState: "expired" }, intrinsic] } };
    await act(async () => button("إعادة المقارنة من الخادم").props.onClick());
    expect(serialized()).toContain("انتهت صلاحيته");
    expect(button("الانتقال إلى تأكيد الحساب الواحد").props.disabled).toBe(true);
    await reviewFinal();
    await act(async () => button("تأكيد التطبيق على هذا الحساب وحده").props.onClick());
    expect(JSON.parse(write.mock.calls[1][1].body).expectedComparisonRevision).toBe("b".repeat(64));
    expect(write.mock.calls.every(call => Object.keys(JSON.parse(call[1].body)).length === 6)).toBe(true);
  });
  it("invalidates at the server-supplied temporal boundary without simulating expiry or silently refreshing permission decisions", async () => {
    vi.useFakeTimers();
    preview = { ...initial, nextDecisionBoundary: "2026-10-02T12:00:01Z" };
    await mount();
    await compare();
    await reviewFinal();
    const readsBefore = fetchMock.mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(1100); });
    expect(serialized()).toContain("حدّ قرار زمني حدده الخادم");
    expect(renderer.root.findByProps({ id: "pilot-review" }).props.checked).toBe(false);
    expect(fetchMock.mock.calls.length).toBe(readsBefore);
    expect(serialized()).not.toContain("انتهت صلاحيته");
    expect(write).not.toHaveBeenCalled();
    preview = { ...initial, capturedAt: "2026-10-02T12:00:02Z", expectedComparisonRevision: "c".repeat(64), before: { ...initial.before!, sources: [{ ...deny, temporalState: "expired" }] } };
    await act(async () => button("إعادة المقارنة من الخادم").props.onClick());
    expect(serialized()).toContain("انتهت صلاحيته");
    expect(renderer.root.findByProps({ id: "pilot-review" }).props.checked).toBe(false);
  });
  it("shows migration readiness instead of a false empty catalog or comparison", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ error: "missing required storage", code: "migration_required" }), { status: 503 })));
    await mount();
    expect(serialized()).toContain("050–054");
    expect(serialized()).not.toContain("لا توجد خيارات معتمدة");
    expect(button("إعادة تحميل الخيارات")).toBeTruthy();
    expect(write).not.toHaveBeenCalled();
  });
  it("fails closed on incomplete comparison evidence instead of treating missing additions or authority as empty", async () => {
    preview = { ...initial, extras: undefined } as unknown as EmployeeTemplatePilotResponse;
    await mount();
    await compare();
    expect(serialized()).toContain("لا تتضمن أدلة الصلاحيات أو الإضافات المطلوبة");
    expect(renderer.root.findAllByProps({ "data-testid": "pilot-server-comparison" })).toHaveLength(0);
    expect(renderer.root.findByProps({ id: "pilot-review" }).props.disabled).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });
  it("does not retry application or claim a fresh confirmation when the post-success read fails", async () => {
    postReadFails = true;
    await mount();
    await compare();
    await reviewFinal();
    await act(async () => button("تأكيد التطبيق على هذا الحساب وحده").props.onClick());
    expect(serialized()).toContain("التطبيق نجح، لكن القراءة الجديدة لم تتأكد");
    expect(renderer.root.findByProps({ "data-testid": "pilot-success" })).toBeTruthy();
    expect(renderer.root.findAllByProps({ "data-testid": "pilot-fresh-verification" })).toHaveLength(0);
    expect(write).toHaveBeenCalledOnce();
    postReadFails = false;
    await act(async () => button("إعادة قراءة الحالة الفعلية").props.onClick());
    expect(renderer.root.findByProps({ "data-testid": "pilot-fresh-verification" })).toBeTruthy();
    expect(write).toHaveBeenCalledOnce();
  });
  it("does not silently change a revoked selected version while reloading catalog and comparing again", async () => {
    await mount();
    await compare();
    await change("pilot-reason", "احتفظ بالسبب");
    catalog = [{ ...template, version: 4 }];
    preview = { ...initial, canApply: false, comparisonStatus: "unknown", after: null, differences: null, blockedReasons: [{ code: "STALE_TEMPLATE_VERSION", message: "آخر إصدار تغيّر" }] };
    await act(async () => button("تحديث الخيارات وإعادة المقارنة").props.onClick());
    expect(renderer.root.findByProps({ id: "pilot-template" }).props.value).toBe("7:3");
    expect(renderer.root.findByProps({ id: "pilot-reason" }).props.value).toBe("احتفظ بالسبب");
    expect(serialized()).toContain("الإصدار المختار لم يعد");
    expect(serialized()).toContain("آخر إصدار تغيّر");
    expect(write).not.toHaveBeenCalled();
  });
  it("resets review/final confirmation when reason or template selection changes", async () => {
    await mount();
    await compare();
    await reviewFinal();
    await change("pilot-reason", "سبب جديد");
    expect(renderer.root.findByProps({ id: "pilot-review" }).props.checked).toBe(false);
    expect(renderer.root.findAllByProps({ id: "pilot-final-confirm" })).toHaveLength(0);
    await change("pilot-template", "");
    expect(renderer.root.findAllByProps({ "data-testid": "pilot-server-comparison" })).toHaveLength(0);
    expect(write).not.toHaveBeenCalled();
  });
  it("ignores a late pilot success after the dialog is dismissed", async () => {
    let resolve!: (response: Response) => void;
    write.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
    const { close, refresh } = await mount();
    await compare();
    await reviewFinal();
    let pending!: Promise<void>;
    await act(async () => { pending = button("تأكيد التطبيق على هذا الحساب وحده").props.onClick(); });
    await act(async () => button("إغلاق").props.onClick());
    expect(close).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
    await act(async () => { resolve(new Response(JSON.stringify({ employee, assignment: initial.assignment, comparison: initial }))); await pending; });
    expect(renderer.root.findAllByProps({ "data-testid": "pilot-success" })).toHaveLength(0);
  });
  it("blocks pilot creation for unlinked targets even if a previously returned comparison claims eligibility", async () => {
    await mount("admin", { ...employee, hasAccount: false, account: null });
    await compare();
    await change("pilot-reason", "لا إنشاء في هذه المرحلة");
    expect(renderer.root.findByProps({ id: "pilot-review" }).props.disabled).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });
});