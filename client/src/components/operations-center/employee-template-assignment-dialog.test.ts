import { createElement } from "react";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DelegatedEmployeeAccount, EmployeeAccountsResponse } from "@/lib/employee-account-types";
import type { ApprovedEmployeeTemplate, EmployeeAssignmentSnapshot } from "@/lib/employee-template-assignment";
import { employeeTemplateDiff } from "@/lib/employee-template-assignment";
import type { EmployeeAccountAddition } from "@/lib/employee-account-additions";
import { EmployeeTemplateAssignmentDialog } from "./employee-template-assignment-dialog";

const { act, create } = createRequire(import.meta.url)("react-test-renderer");
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.mock("@/components/ui/dialog", () => {
  const element = ({ children }: { children: React.ReactNode }) => createElement("section", null, children);
  const dialog = ({ children, onOpenChange }: { children: React.ReactNode; onOpenChange: (open: boolean) => void }) =>
    createElement("section", { "data-testid": "test-dialog", onOpenChange }, children);
  return { Dialog: dialog, DialogContent: element, DialogHeader: element, DialogTitle: element, DialogDescription: element, DialogFooter: element };
});
const employee: DelegatedEmployeeAccount = {
  employeeId: 19, employeeName: "موظف مراجعة", branchId: "a", branchName: "فرع الاختبار",
  hasAccount: true, management: { allowed: true, reason: "allowed" },
  account: { id: "test-account", username: "test-user", isActive: "active", permissions: [{ module: "cashier_journal", actions: ["view", "create"] }], canReactivate: true },
};
const directory: EmployeeAccountsResponse = {
  branches: [{ id: "a", name: "فرع الاختبار" }, { id: "b", name: "فرع آخر مصرح" }],
  employees: [employee], policy: { enabled: true, permissions: [] }, availablePermissions: [], templates: [],
};
const template: ApprovedEmployeeTemplate = {
  templateId: 7, version: 3, key: "review-template", name: "خدمة الفرع", scopeType: "branch",
  permissions: [{ module: "cashier_journal", actions: ["view", "edit"] }], approvedAt: "2026-05-05T10:03:00Z",
};
const snapshot: EmployeeAssignmentSnapshot = {
  employeeId: 19, branchId: "a", assignment: null, currentPermissions: employee.account!.permissions,
  additions: [],
  expectedAssignmentRevision: "f".repeat(64),
};
const independentAddition: EmployeeAccountAddition = {
  id: 41, module: "maintenance", action: "edit", allow: false, scopeType: "global", branchId: null,
  startsAt: "2024-03-01T06:00:00Z", endsAt: "2024-03-02T06:00:00Z", reason: "منع مستقل محفوظ",
  revision: "11111111-1111-4111-8111-111111111111", createdBy: "admin-test",
  createdAt: "2024-02-28T06:00:00Z", updatedAt: "2024-02-28T06:00:00Z", integrity: "managed",
};
let renderer: any;
let catalog: ApprovedEmployeeTemplate[];
let excludedTemplates: unknown;
let current: EmployeeAssignmentSnapshot;
let write: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;
const text = (node: any): string => typeof node === "string" ? node : (node.children ?? []).map(text).join("");
const button = (label: string) => renderer.root.findAllByType("button").find((node: any) => text(node).includes(label));
const serialized = () => JSON.stringify(renderer.toJSON());
const change = async (id: string, value: string) => act(async () => renderer.root.findByProps({ id }).props.onChange({ target: { value } }));
const confirm = async () => act(async () => renderer.root.findByProps({ id: "employee-template-confirm" }).props.onChange({ target: { checked: true } }));
async function select(key = "7:3") {
  await change("approved-employee-template", key);
  await change("approved-employee-branch", "a");
  await change("employee-template-reason", "اعتماد مهام الفرع");
}
async function mount(mode: "create" | "permissions" = "permissions", row = employee, data = directory) {
  const close = vi.fn(), refresh = vi.fn();
  await act(async () => { renderer = create(createElement(EmployeeTemplateAssignmentDialog, { employee: row, mode, directory: data, close, refresh })); });
  return { close, refresh };
}
beforeEach(() => {
  catalog = [template];
  excludedTemplates = undefined;
  current = snapshot;
  write = vi.fn().mockResolvedValue(new Response(JSON.stringify({ employee, assignment: {} })));
  fetchMock = vi.fn((url: string, options: { method: string }) => {
    if (options.method === "POST") return write(url, options);
    return Promise.resolve(new Response(JSON.stringify(url.includes("job-templates") ? { templates: catalog, ...(excludedTemplates === undefined ? {} : { excludedTemplates }) } : current)));
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});

describe("approved employee template review", () => {
  it.each(["create", "permissions"] as const)("shows concrete non-selectable exclusions and eligible non-cashier templates in %s mode without filtering against the legacy ceiling", async mode => {
    const quality = { ...template, templateId: 8, version: 2, key: "quality-branch", name: "جودة الفرع", permissions: [{ module: "quality_control", actions: ["view", "create"] }] };
    catalog = [template, quality];
    excludedTemplates = [{ templateId: 12, version: 4, name: "إدارة عدة فروع", reason: "نطاق branches غير مدعوم للإسناد المفوض لهذا الموظف", code: "UNSUPPORTED_TEMPLATE_SCOPE" },
      { templateId: 13, version: 1, name: "صلاحية مالية عامة", reason: "finance:approve ليس إجراءً مدعومًا في هذا المسار", code: "UNSUPPORTED_TEMPLATE_PERMISSION" }];
    const row = mode === "create" ? { ...employee, hasAccount: false, account: null } : employee;
    current = { ...snapshot, currentPermissions: mode === "create" ? [] : snapshot.currentPermissions };
    const legacyOnly = { ...directory, policy: { enabled: true, permissions: [{ module: "cashier_journal", actions: ["view"] }] }, availablePermissions: [{ module: "cashier_journal", actions: ["view"] }] };
    await mount(mode, row, legacyOnly);
    const picker = renderer.root.findByProps({ id: "approved-employee-template" });
    expect(text(picker)).toContain("جودة الفرع");
    expect(text(picker)).not.toContain("إدارة عدة فروع");
    expect(text(picker)).not.toContain("صلاحية مالية عامة");
    const exclusions = renderer.root.findByProps({ "aria-label": "القوالب المعتمدة المستبعدة من الإسناد" });
    expect(text(exclusions)).toContain("إدارة عدة فروع");
    expect(text(exclusions)).toContain("finance:approve");
    expect(text(exclusions)).toContain("UNSUPPORTED_TEMPLATE_SCOPE");
    expect(renderer.root.findByProps({ id: "approved-employee-template" }).props.value).toBe("");
    expect(serialized()).toContain("ليست الخيارات محصورة بالكاشير");
    await select("12:4");
    await confirm();
    const applyLabel = mode === "create" ? "تأكيد الإسناد وتوليد الحساب" : "تأكيد إسناد الإصدار";
    await act(async () => button(applyLabel).props.onClick());
    expect(write).not.toHaveBeenCalled();
    await select("8:2");
    await confirm();
    write.mockResolvedValueOnce(new Response(JSON.stringify({ employee, assignment: {}, ...(mode === "create" ? { credentials: { username: "quality-user", password: "one-display-only" } } : {}) })));
    await act(async () => button(applyLabel).props.onClick());
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0][0]).toContain(mode === "create" ? "/template-account" : "/template-assignment");
    expect(JSON.parse(write.mock.calls[0][1].body)).toEqual({ templateId: 8, version: 2, branchId: "a", reason: "اعتماد مهام الفرع", expectedAssignmentRevision: current.expectedAssignmentRevision });
    if (mode === "create") expect(renderer.root.findByProps({ "data-testid": "generated-password" }).children).toEqual(["one-display-only"]);
  });
  it.each(["create", "permissions"] as const)("allows refresh of an empty eligible catalog without choosing anything in %s mode", async mode => {
    catalog = [];
    excludedTemplates = [{ templateId: 12, version: 4, name: "قالب معتمد مستبعد", reason: "وظيفة الموظف غير متوافقة مع مهام التوصيل", code: "DELIVERY_JOB_REQUIRED" }];
    await mount(mode, mode === "create" ? { ...employee, hasAccount: false, account: null } : employee);
    expect(renderer.root.findByProps({ id: "approved-employee-template" }).props.value).toBe("");
    expect(serialized()).toContain("وظيفة الموظف غير متوافقة");
    const reload = button("تحديث المعاينة والقوالب");
    expect(reload.props.disabled).toBe(false);
    catalog = [template];
    excludedTemplates = [];
    await act(async () => reload.props.onClick());
    expect(fetchMock.mock.calls.filter(call => call[0].includes("job-templates"))).toHaveLength(2);
    expect(renderer.root.findByProps({ id: "approved-employee-template" }).props.value).toBe("");
    expect(renderer.root.findAllByProps({ "aria-label": "القوالب المعتمدة المستبعدة من الإسناد" })).toHaveLength(0);
    expect(write).not.toHaveBeenCalled();
  });
  it.each([
    ["null exclusions", null],
    ["missing exclusion reason", [{ templateId: 12, version: 4, name: "قالب غير مكتمل", code: "UNSUPPORTED_TEMPLATE_SCOPE" }]],
    ["missing exclusion name", [{ templateId: 12, version: 4, reason: "نطاق غير مدعوم", code: "UNSUPPORTED_TEMPLATE_SCOPE" }]],
    ["missing exclusion code", [{ templateId: 12, version: 4, name: "قالب غير مكتمل", reason: "نطاق غير مدعوم" }]],
  ])("fails closed on malformed catalog metadata: %s", async (_case, malformed) => {
    excludedTemplates = malformed;
    await mount();
    expect(serialized()).toContain("بيانات كتالوج القوالب أو أسباب الاستبعاد أو سجل الإسناد غير مكتملة");
    expect(serialized()).not.toContain("لا يوجد إصدار معتمد مؤهل");
    expect(renderer.root.findAllByProps({ id: "approved-employee-template" })).toHaveLength(0);
    expect(button("تأكيد إسناد الإصدار").props.disabled).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });
  it.each(["create", "permissions"] as const)("fails closed when required approval metadata is missing in %s mode", async mode => {
    catalog = [{ ...template, approvedAt: undefined }] as unknown as ApprovedEmployeeTemplate[];
    await mount(mode, mode === "create" ? { ...employee, hasAccount: false, account: null } : employee);
    expect(serialized()).toContain("بيانات كتالوج القوالب");
    expect(renderer.root.findAllByProps({ id: "approved-employee-template" })).toHaveLength(0);
    expect(write).not.toHaveBeenCalled();
  });
  it.each([
    ["missing BASE", { ...snapshot, currentPermissions: undefined }],
    ["incomplete persisted assignment", { ...snapshot, assignment: { templateId: 7, version: 1, branchId: "a", revision: "previous-revision", assignedAt: "2026-05-04T10:03:00Z", reason: "إسناد سابق" } }],
  ])("does not fabricate empty current permissions or assignment metadata: %s", async (_case, malformed) => {
    current = malformed as unknown as EmployeeAssignmentSnapshot;
    await mount();
    expect(serialized()).toContain("بيانات كتالوج القوالب أو أسباب الاستبعاد أو سجل الإسناد غير مكتملة");
    expect(renderer.root.findAllByProps({ id: "approved-employee-template" })).toHaveLength(0);
    expect(write).not.toHaveBeenCalled();
  });
  it("loads an employee-filtered catalog and snapshot, with no implicit grant selection", async () => {
    await mount();
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      "/api/operations/employee-accounts/job-templates?employeeId=19",
      "/api/operations/employee-accounts/19/template-assignment",
    ]);
    expect(renderer.root.findByProps({ id: "approved-employee-template" }).props.value).toBe("");
    expect(renderer.root.findByProps({ id: "approved-employee-branch" }).props.value).toBe("");
    expect(renderer.root.findByProps({ id: "delegated-employee-name" }).props.readOnly).toBe(true);
    expect(renderer.root.findAllByType("input").filter((node: any) => node.props.type === "checkbox")).toHaveLength(1);
    expect(write).not.toHaveBeenCalled();
    expect(button("تأكيد إسناد الإصدار").props.disabled).toBe(true);
    expect(serialized()).not.toContain("فرع آخر مصرح");
  });
  it("shows additions/removals before explicit confirmation and sends only the strict snapshot-bound command", async () => {
    const { close, refresh } = await mount();
    await select();
    expect(serialized()).toContain("سيُضاف");
    expect(serialized()).toContain("سيُزال");
    expect(button("تأكيد إسناد الإصدار").props.disabled).toBe(true);
    await act(async () => button("تأكيد إسناد الإصدار").props.onClick());
    expect(write).not.toHaveBeenCalled();
    await confirm();
    await act(async () => button("تأكيد إسناد الإصدار").props.onClick());
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0][0]).toBe("/api/operations/employee-accounts/19/template-assignment");
    expect(JSON.parse(write.mock.calls[0][1].body)).toEqual({
      templateId: 7, version: 3, branchId: "a", reason: "اعتماد مهام الفرع", expectedAssignmentRevision: snapshot.expectedAssignmentRevision,
    });
    expect(close).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("allows an empty approved template under enabled policy without operational grants", async () => {
    catalog = [{ ...template, scopeType: "self", permissions: [] }];
    current = { ...snapshot, currentPermissions: [] };
    await mount();
    await select();
    expect(serialized()).toContain("بوابة الموظف الذاتية مستقلة");
    await confirm();
    expect(button("تأكيد إسناد الإصدار").props.disabled).toBe(false);
    await act(async () => button("تأكيد إسناد الإصدار").props.onClick());
    expect(JSON.parse(write.mock.calls[0][1].body)).not.toHaveProperty("permissions");
  });
  it("preserves choices/reason after 409, requires reloading both resources and a fresh confirmation", async () => {
    write.mockResolvedValueOnce(new Response(JSON.stringify({ error: "تغيرت الصلاحيات", code: "ASSIGNMENT_REVISION_CONFLICT" }), { status: 409 }));
    await mount();
    await select();
    await confirm();
    await act(async () => button("تأكيد إسناد الإصدار").props.onClick());
    expect(renderer.root.findByProps({ id: "approved-employee-template" }).props.value).toBe("7:3");
    expect(renderer.root.findByProps({ id: "approved-employee-branch" }).props.value).toBe("a");
    expect(renderer.root.findByProps({ id: "employee-template-reason" }).props.value).toBe("اعتماد مهام الفرع");
    expect(renderer.root.findByProps({ id: "employee-template-confirm" }).props.checked).toBe(false);
    expect(button("تأكيد إسناد الإصدار").props.disabled).toBe(true);
    current = { ...snapshot, expectedAssignmentRevision: "a".repeat(64), currentPermissions: [] };
    await act(async () => button("تحديث المعاينة والقوالب").props.onClick());
    expect(fetchMock.mock.calls.filter(call => call[1].method === "GET")).toHaveLength(4);
    expect(button("تأكيد إسناد الإصدار").props.disabled).toBe(true);
    await confirm();
    await act(async () => button("تأكيد إسناد الإصدار").props.onClick());
    expect(JSON.parse(write.mock.calls[1][1].body).expectedAssignmentRevision).toBe(current.expectedAssignmentRevision);
  });
  it.each(["TEMPLATE_NOT_APPROVED", "STALE_TEMPLATE_VERSION"])("does not automatically replace a revoked or superseded selected version (%s)", async code => {
    write.mockResolvedValueOnce(new Response(JSON.stringify({ error: "الإصدار غير متاح", code }), { status: 409 }));
    await mount();
    await select();
    await confirm();
    await act(async () => button("تأكيد إسناد الإصدار").props.onClick());
    catalog = [{ ...template, version: 4 }];
    await act(async () => button("تحديث المعاينة والقوالب").props.onClick());
    expect(renderer.root.findByProps({ id: "approved-employee-template" }).props.value).toBe("7:3");
    expect(serialized()).toContain("لم يعد الإصدار المختار مؤهلًا");
    expect(button("تأكيد إسناد الإصدار").props.disabled).toBe(true);
    expect(write).toHaveBeenCalledOnce();
  });
  it("shows missing migration 053 explicitly, never as an empty template list, with retry", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ error: "storage unavailable", code: "migration_required" }), { status: 503 })));
    await mount();
    expect(serialized()).toContain("053");
    expect(serialized()).not.toContain("لا يوجد إصدار معتمد مؤهل");
    expect(button("إعادة المحاولة")).toBeTruthy();
    expect(button("تأكيد إسناد الإصدار").props.disabled).toBe(true);
  });
  it("fails closed when an older service omits the required independent-additions preview instead of showing a false empty list", async () => {
    fetchMock.mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes("job-templates")
      ? { templates: catalog }
      : { employeeId: snapshot.employeeId, branchId: snapshot.branchId, assignment: null, currentPermissions: snapshot.currentPermissions, expectedAssignmentRevision: snapshot.expectedAssignmentRevision }))));
    await mount();
    expect(serialized()).toContain("لا تتضمن سجل الإضافات المستقلة");
    expect(serialized()).not.toContain("لا توجد إضافات مستقلة مُدارة");
    expect(button("تأكيد إسناد الإصدار").props.disabled).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });
  it("explains protected/unsupported roles and preserves backend forbidden errors", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ error: "إسناد قديم أو استثناء", code: "PROTECTED_ACCOUNT" }), { status: 403 })));
    await mount();
    expect(serialized()).toContain("إسناد قديم أو استثناء");
    expect(serialized()).toContain("الأدوار غير المدعومة");
    expect(write).not.toHaveBeenCalled();
  });
  it("distinguishes a genuinely empty eligible catalog and documents delivery compatibility", async () => {
    catalog = [];
    await mount();
    expect(serialized()).toContain("لا يوجد إصدار معتمد مؤهل");
    expect(serialized()).toContain("وظيفة توصيل محفوظة");
    expect(serialized()).not.toContain("053");
  });
  it("never uses the legacy directory templates or an admin-only fallback", async () => {
    catalog = [];
    await mount("permissions", employee, { ...directory, templates: [{ id: "admin-only", name: "قالب إدارة النظام", permissions: [{ module: "users", actions: ["manage"] }] }] });
    expect(serialized()).not.toContain("قالب إدارة النظام");
    expect(renderer.root.findByProps({ id: "approved-employee-template" }).props.value).toBe("");
    expect(write).not.toHaveBeenCalled();
  });
  it("shows independent denies and expiry separately from BASE, keeps them on template changes and never submits extra modifications", async () => {
    current = { ...snapshot, additions: [independentAddition] };
    catalog = [template, { ...template, templateId: 8, version: 1, name: "قالب أساس فارغ", permissions: [] }];
    await mount();
    await select();
    const readonly = () => renderer.root.findByProps({ "data-testid": "employee-additions-readonly" });
    const preserved = JSON.stringify(readonly().children.map((node: any) => text(node)));
    expect(text(readonly())).toContain("منع مستقل");
    expect(text(readonly())).toContain("حتى:");
    expect(text(readonly())).toContain("منع مستقل محفوظ");
    expect(readonly().findAllByType("button")).toHaveLength(0);
    expect(readonly().findAllByType("input")).toHaveLength(0);
    const base = renderer.root.findByProps({ "aria-label": "فرق القالب الأساسي قبل وبعد" });
    expect(text(base)).not.toContain("منع مستقل محفوظ");
    await change("approved-employee-template", "8:1");
    expect(JSON.stringify(readonly().children.map((node: any) => text(node)))).toBe(preserved);
    await confirm();
    await act(async () => button("تأكيد إسناد الإصدار").props.onClick());
    const body = JSON.parse(write.mock.calls[0][1].body);
    expect(Object.keys(body).sort()).toEqual(["templateId", "version", "branchId", "reason", "expectedAssignmentRevision"].sort());
    expect(body.templateId).toBe(8);
    expect(fetchMock.mock.calls.every(call => call[0].startsWith("/api/operations/employee-accounts/"))).toBe(true);
  });
  it("reloads read-only extras and BASE after an extras-bound revision conflict, without editing those extras", async () => {
    current = { ...snapshot, additions: [independentAddition] };
    write.mockResolvedValueOnce(new Response(JSON.stringify({ error: "تغيرت الإضافات", code: "ASSIGNMENT_REVISION_CONFLICT" }), { status: 409 }));
    await mount();
    await select();
    await confirm();
    await act(async () => button("تأكيد إسناد الإصدار").props.onClick());
    current = { ...snapshot, expectedAssignmentRevision: "a".repeat(64), additions: [{ ...independentAddition, reason: "مراجعة إضافات أحدث", allow: true }] };
    await act(async () => button("تحديث المعاينة والقوالب").props.onClick());
    expect(serialized()).toContain("مراجعة إضافات أحدث");
    expect(serialized()).toContain("منح مستقل");
    expect(renderer.root.findByProps({ id: "approved-employee-template" }).props.value).toBe("7:3");
    expect(button("تأكيد إسناد الإصدار").props.disabled).toBe(true);
    await confirm();
    await act(async () => button("تأكيد إسناد الإصدار").props.onClick());
    expect(JSON.parse(write.mock.calls[1][1].body).expectedAssignmentRevision).toBe(current.expectedAssignmentRevision);
    expect(JSON.parse(write.mock.calls[1][1].body)).not.toHaveProperty("additions");
    expect(write.mock.calls.every(call => call[0].endsWith("/template-assignment"))).toBe(true);
  });
  it("blocks non-authorized branches and changes to the server's persisted employee branch", async () => {
    await mount();
    await select();
    await change("approved-employee-branch", "b");
    await confirm();
    await act(async () => button("تأكيد إسناد الإصدار").props.onClick());
    expect(write).not.toHaveBeenCalled();
  });
  it("requires confirmation again after changing the selected branch, template or reason", async () => {
    await mount();
    await select();
    await confirm();
    await change("employee-template-reason", "سبب آخر");
    expect(renderer.root.findByProps({ id: "employee-template-confirm" }).props.checked).toBe(false);
    expect(button("تأكيد إسناد الإصدار").props.disabled).toBe(true);
  });
  it("creates through the selected employee, shows secrets once and reuses secure handoff", async () => {
    write.mockResolvedValueOnce(new Response(JSON.stringify({ employee, assignment: {}, credentials: { username: "new-user", password: "one-time-password" } })));
    const { close, refresh } = await mount("create", { ...employee, hasAccount: false, account: null });
    await select();
    await confirm();
    await act(async () => button("تأكيد الإسناد وتوليد الحساب").props.onClick());
    expect(write.mock.calls[0][0]).toBe("/api/operations/employee-accounts/19/template-account");
    expect(renderer.root.findByProps({ "data-testid": "generated-password" }).children).toEqual(["one-time-password"]);
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => renderer.root.findByProps({ "aria-label": "نسخ كلمة المرور" }).props.onClick());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("one-time-password");
    await act(async () => renderer.root.findByProps({ "data-testid": "test-dialog" }).props.onOpenChange(false));
    expect(close).not.toHaveBeenCalled();
    await act(async () => renderer.root.findAllByType("input").find((node: any) => node.props.type === "checkbox").props.onChange({ target: { checked: true } }));
    await act(async () => button("حفظت البيانات").props.onClick());
    expect(close).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
    expect(serialized()).not.toContain("one-time-password");
  });
  it("ignores a late secret response after dismissal without caching it", async () => {
    let resolve!: (response: Response) => void;
    write.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
    const { close, refresh } = await mount("create", { ...employee, hasAccount: false, account: null });
    await select();
    await confirm();
    let pending!: Promise<void>;
    await act(async () => { pending = button("تأكيد الإسناد وتوليد الحساب").props.onClick(); });
    await act(async () => button("إلغاء").props.onClick());
    expect(close).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
    await act(async () => {
      resolve(new Response(JSON.stringify({ employee, assignment: {}, credentials: { username: "late-user", password: "late-secret" } })));
      await pending;
    });
    expect(serialized()).not.toContain("late-secret");
  });
  it("never opens a frozen account or resets login credentials while assigning", async () => {
    await mount("permissions", { ...employee, account: { ...employee.account!, isActive: "inactive" } });
    expect(serialized()).toContain("إسناد القالب لا يعيد فتحه");
    await select();
    await confirm();
    await act(async () => button("تأكيد إسناد الإصدار").props.onClick());
    expect(JSON.parse(write.mock.calls[0][1].body)).not.toHaveProperty("isActive");
    expect(JSON.parse(write.mock.calls[0][1].body)).not.toHaveProperty("password");
  });
  it("does not apply under disabled policy even if a previously rendered catalog exists", async () => {
    await mount("permissions", employee, { ...directory, policy: { enabled: false, permissions: [] } });
    await select();
    await confirm();
    await act(async () => button("تأكيد إسناد الإصدار").props.onClick());
    expect(write).not.toHaveBeenCalled();
  });
  it("computes exact direct-permission differences including retained and removed modules", () => {
    expect(employeeTemplateDiff(snapshot.currentPermissions, template.permissions)).toEqual([{
      module: "cashier_journal", before: ["create", "view"], after: ["edit", "view"], added: ["edit"], removed: ["create"],
    }]);
    expect(employeeTemplateDiff(snapshot.currentPermissions, [])).toEqual([{
      module: "cashier_journal", before: ["create", "view"], after: [], added: [], removed: ["create", "view"],
    }]);
  });
});