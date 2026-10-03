import { createElement } from "react";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmployeeAccountsResponse } from "@/lib/employee-account-types";
import OperationsEmployeeAccountsPage from "./operations-employee-accounts";

const { act, create } = createRequire(import.meta.url)("react-test-renderer");
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const mocks = vi.hoisted(() => ({
  user: { id: "manager-test", role: "operations_manager", branchId: "a", activeBranchId: "a", allowedBranches: [{ branchId: "a" }] } as any,
  state: {} as any,
  options: {} as any,
  search: "",
  navigate: vi.fn(),
  invalidate: vi.fn(),
  cancel: vi.fn(),
  remove: vi.fn(),
  switching: false,
  loggingOut: false,
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user, isAuthError: false, isSwitchingBranch: mocks.switching }) }));
vi.mock("@/components/layout", () => ({ Layout: ({ children }: { children: React.ReactNode }) => createElement("div", null, children) }));
vi.mock("@/components/protected-route", () => ({ AccessDeniedPage: ({ message }: { message: string }) => createElement("p", { "data-testid": "denied" }, message) }));
vi.mock("wouter", () => ({
  useSearch: () => mocks.search,
  useLocation: () => ["/operations-employee-accounts", mocks.navigate],
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => createElement("a", { href }, children),
}));
vi.mock("@tanstack/react-query", () => ({
  useIsMutating: () => mocks.loggingOut ? 1 : 0,
  useQuery: (options: unknown) => { mocks.options = options; return mocks.state; },
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate, cancelQueries: mocks.cancel, removeQueries: mocks.remove }),
}));
vi.mock("@/components/ui/dialog", () => {
  const element = ({ children }: { children: React.ReactNode }) => createElement("section", null, children);
  return { Dialog: element, DialogContent: element, DialogHeader: element, DialogTitle: element, DialogDescription: element, DialogFooter: element };
});

const data: EmployeeAccountsResponse = {
  branches: [{ id: "a", name: "فرع أ" }, { id: "empty", name: "فرع بلا موظفين" }],
  policy: { enabled: true, permissions: [{ module: "cashier_journal", actions: ["view"] }] },
  availablePermissions: [{ module: "cashier_journal", actions: ["view"] }],
  templates: [],
  employees: [
    { employeeId: 1, employeeName: "موظف مؤهل", branchId: "a", branchName: "فرع أ", hasAccount: false, management: { allowed: true, reason: "allowed" }, account: null },
    { employeeId: 2, employeeName: "موظف بحساب مجمد", branchId: "a", branchName: "فرع أ", hasAccount: true, management: { allowed: true, reason: "allowed" }, account: { id: "unit-account", username: "unit-disabled", isActive: "inactive", permissions: [], canReactivate: true } },
  ],
};
let renderer: any;
function button(label: string) {
  const text = (node: any): string => typeof node === "string" ? node : (node.children ?? []).map(text).join("");
  return renderer.root.findAllByType("button").find((node: any) => text(node).includes(label));
}
async function mount() {
  await act(async () => { renderer = create(createElement(OperationsEmployeeAccountsPage)); });
}
async function renderAgain() {
  await act(async () => renderer.update(createElement(OperationsEmployeeAccountsPage)));
}
function templateFetch(password = "page-test-secret") {
  return vi.fn((url: string, options: { method: string }) => Promise.resolve(new Response(JSON.stringify(
    options.method === "POST"
      ? { employee: data.employees[0], credentials: { username: "unit-user", password } }
      : url.includes("job-templates") || url === "/api/admin/employee-template-pilot-catalog"
        ? { templates: [{ templateId: 7, version: 3, key: "test", name: "قالب اختبار", scopeType: "branch", permissions: [], approvedAt: "2026-05-05T10:03:00Z" }] }
        : { employeeId: Number(url.split("/").at(-2)), branchId: "a", assignment: null, currentPermissions: [], additions: [], expectedAssignmentRevision: "f".repeat(64) },
  ))));
}
async function confirmCreate() {
  await act(async () => renderer.root.findByProps({ id: "approved-employee-template" }).props.onChange({ target: { value: "7:3" } }));
  await act(async () => renderer.root.findByProps({ id: "approved-employee-branch" }).props.onChange({ target: { value: "a" } }));
  await act(async () => renderer.root.findByProps({ id: "employee-template-reason" }).props.onChange({ target: { value: "اختبار الإسناد" } }));
  await act(async () => renderer.root.findByProps({ id: "employee-template-confirm" }).props.onChange({ target: { checked: true } }));
  await act(async () => button("تأكيد الإسناد وتوليد الحساب").props.onClick());
}
beforeEach(() => {
  mocks.user = { id: "manager-test", role: "operations_manager", branchId: "a", activeBranchId: "a", allowedBranches: [{ branchId: "a" }] };
  mocks.state = { data, isError: false, isFetchedAfterMount: true, isFetching: false };
  mocks.search = "";
  mocks.switching = false;
  mocks.loggingOut = false;
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } });
  vi.stubGlobal("fetch", templateFetch());
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("operations employee account page", () => {
  it("classifies protected accounts as linked, hides all actions and retains empty authorized branches", async () => {
    mocks.state.data = { ...data, employees: [{ ...data.employees[1], account: null, management: { allowed: false, reason: "protected_account" } }] };
    await mount();
    expect(renderer.root.findAllByProps({ "data-testid": "employee-account-2" })).toHaveLength(1);
    expect(JSON.stringify(renderer.toJSON())).toContain("حساب محمي — يتطلب مسؤول النظام");
    expect(JSON.stringify(renderer.toJSON())).toContain("فرع بلا موظفين");
    expect(button("إسناد قالب معتمد")).toBeUndefined();
    expect(button("إعادة الفتح")).toBeUndefined();
    await act(async () => button("موظفون دون حساب").props.onClick());
    expect(renderer.root.findAllByProps({ "data-testid": "employee-account-2" })).toHaveLength(0);
    expect(button("اختيار الموظف")).toBeUndefined();
  });

  it.each(["not_selected", "read_only_branch"])("hides actions on %s and closes a stale open dialog immediately", async reason => {
    await mount();
    await act(async () => button("إسناد قالب معتمد").props.onClick());
    expect(button("تأكيد إسناد الإصدار")).toBeTruthy();
    mocks.state.data = { ...data, employees: [{ ...data.employees[1], account: null, management: { allowed: false, reason } }] };
    await renderAgain();
    expect(button("تأكيد إسناد الإصدار")).toBeUndefined();
    expect(button("إسناد قالب معتمد")).toBeUndefined();
    expect(JSON.stringify(renderer.toJSON())).toContain(reason === "not_selected" ? "لم يفوضك مسؤول النظام" : "للقراءة فقط");
  });

  it("closes a modal if the active roster no longer contains its employee", async () => {
    await mount();
    await act(async () => button("إسناد قالب معتمد").props.onClick());
    mocks.state.data = { ...data, employees: [] };
    await renderAgain();
    expect(button("تأكيد إسناد الإصدار")).toBeUndefined();
  });
  it("preserves template/branch/reason review when a linked account changes while its employee remains eligible", async () => {
    await mount();
    await act(async () => button("إسناد قالب معتمد").props.onClick());
    await act(async () => renderer.root.findByProps({ id: "approved-employee-template" }).props.onChange({ target: { value: "7:3" } }));
    await act(async () => renderer.root.findByProps({ id: "approved-employee-branch" }).props.onChange({ target: { value: "a" } }));
    await act(async () => renderer.root.findByProps({ id: "employee-template-reason" }).props.onChange({ target: { value: "احتفظ بالمراجعة" } }));
    await act(async () => renderer.root.findByProps({ id: "employee-template-confirm" }).props.onChange({ target: { checked: true } }));
    mocks.state.data = { ...data, employees: [{ ...data.employees[1], account: { ...data.employees[1].account!, permissions: [{ module: "cashier_journal", actions: ["view"] }] } }] };
    await renderAgain();
    expect(renderer.root.findByProps({ id: "approved-employee-template" }).props.value).toBe("7:3");
    expect(renderer.root.findByProps({ id: "approved-employee-branch" }).props.value).toBe("a");
    expect(renderer.root.findByProps({ id: "employee-template-reason" }).props.value).toBe("احتفظ بالمراجعة");
    expect(button("تأكيد إسناد الإصدار").props.disabled).toBe(true);
    expect(renderer.root.findByProps({ id: "employee-template-confirm" }).props.checked).toBe(false);
    expect(JSON.stringify(renderer.toJSON())).toContain("تغيّرت بيانات الحساب في الدليل");
  });

  it("fails closed when individual management approval is absent", async () => {
    mocks.state.data = { ...data, employees: [{ ...data.employees[0], management: undefined }] };
    await mount();
    await act(async () => button("موظفون دون حساب").props.onClick());
    expect(JSON.stringify(renderer.toJSON())).toContain("لم يفوضك مسؤول النظام");
    expect(button("اختيار الموظف")).toBeUndefined();
  });

  it("retains the one-time handoff on its own successful create refresh but clears it on revoked selection", async () => {
    vi.stubGlobal("fetch", templateFetch("handoff-secret"));
    await mount();
    await act(async () => button("موظفون دون حساب").props.onClick());
    await act(async () => button("اختيار الموظف").props.onClick());
    await confirmCreate();
    const created = { ...data.employees[0], hasAccount: true, account: data.employees[1].account };
    mocks.state.data = { ...data, employees: [created] };
    await renderAgain();
    expect(JSON.stringify(renderer.toJSON())).toContain("handoff-secret");
    mocks.state.data = { ...data, employees: [{ ...created, account: null, management: { allowed: false, reason: "not_selected" } }] };
    await renderAgain();
    expect(JSON.stringify(renderer.toJSON())).not.toContain("handoff-secret");
  });
  it("shows an explicit offline state instead of an indefinite loading skeleton or stale accounts", async () => {
    mocks.state = { data, isError: false, isFetchedAfterMount: false, isFetching: false, isPaused: true };
    await mount();
    expect(JSON.stringify(renderer.toJSON())).toContain("الاتصال غير متاح");
    expect(renderer.root.findAllByProps({ role: "status" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-testid": "employee-account-2" })).toHaveLength(0);
    mocks.state = { ...mocks.state, isFetchedAfterMount: true };
    await renderAgain();
    expect(renderer.root.findAllByProps({ "data-testid": "employee-account-2" })).toHaveLength(0);
    mocks.state = { ...mocks.state, isPaused: false };
    await renderAgain();
    expect(renderer.root.findAllByProps({ "data-testid": "employee-account-2" })).toHaveLength(1);
  });

  it("eagerly loads the real protected route rather than stranding its lazy payload", () => {
    const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    expect(app).toContain('import OperationsEmployeeAccountsPage from "@/pages/operations-employee-accounts";');
    expect(app).not.toContain('makeLazy("operations-employee-accounts")');
    expect(app).toContain('<Route path="/operations-employee-accounts">{() => <EmployeeAccountsPage />}</Route>');
    expect(app).toContain("canManageEmployeeAccounts(user?.role)");
    expect(app).toContain("<ProtectedRoute>");
  });

  it("queries with actor/scope identity and no stale or offline placeholder permissions", async () => {
    await mount();
    expect(mocks.options.queryKey[0]).toBe("/api/operations/employee-accounts");
    expect(mocks.options.queryKey[1]).toBe("manager-test");
    expect(mocks.options.queryKey[2]).toContain("operations_manager");
    expect(mocks.options).toMatchObject({ staleTime: 0, gcTime: 0, placeholderData: undefined, retry: false, networkMode: "online", refetchOnMount: "always" });
  });

  it("includes disabled linked accounts and offers employee selection, not standalone creation", async () => {
    await mount();
    expect(renderer.root.findAllByProps({ "data-testid": "employee-account-2" })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ "data-testid": "employee-account-1" })).toHaveLength(0);
    expect(button("تأكيد الإسناد وتوليد الحساب")).toBeUndefined();
    await act(async () => button("موظفون دون حساب").props.onClick());
    await act(async () => button("اختيار الموظف").props.onClick());
    expect(renderer.root.findByProps({ id: "delegated-employee-name" }).props.value).toBe("موظف مؤهل");
    expect(button("تأكيد الإسناد وتوليد الحساب")).toBeTruthy();
    expect(button("سياسة التفويض")).toBeUndefined();
  });

  it("only renders the approved allowlist editor for admin", async () => {
    mocks.user = { ...mocks.user, role: "admin" };
    mocks.search = "?policy=1";
    await mount();
    expect(renderer.root.findAllByProps({ "data-testid": "employee-account-policy-editor" })).toHaveLength(1);
    mocks.user = { ...mocks.user, role: "operations_manager" };
    await renderAgain();
    expect(renderer.root.findAllByProps({ "data-testid": "employee-account-policy-editor" })).toHaveLength(0);
  });
  it("offers independent-addition editing only to admin on linked employees, without weakening manager protection", async () => {
    await mount();
    expect(button("الإضافات المستقلة")).toBeUndefined();
    mocks.user = { ...mocks.user, role: "admin" };
    mocks.state.data = { ...data, employees: [{ ...data.employees[1], account: null, management: { allowed: false, reason: "protected_account" } }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      employeeId: 2, branchId: "a", userId: "server-linked-user", additions: [],
      capabilities: { globalModules: [], branchModules: [], unsupportedScopes: ["department", "self", "assigned_tasks"], globalScopeLabel: "عام" },
    }))));
    await renderAgain();
    expect(button("إسناد قالب معتمد")).toBeUndefined();
    expect(button("الإضافات المستقلة")).toBeTruthy();
    await act(async () => button("الإضافات المستقلة").props.onClick());
    expect(fetch).toHaveBeenCalledWith("/api/admin/employee-account-additions/2", expect.objectContaining({ method: "GET" }));
    expect(button("إضافة مستقلة جديدة")).toBeTruthy();
    mocks.user = { ...mocks.user, role: "operations_manager" };
    await renderAgain();
    expect(button("الإضافات المستقلة")).toBeUndefined();
    expect(button("إضافة مستقلة جديدة")).toBeUndefined();
    expect(button("إسناد قالب معتمد")).toBeUndefined();
  });
  it("never offers additions for an unlinked employee and retains an admin draft when management protection changes", async () => {
    mocks.user = { ...mocks.user, role: "admin" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      employeeId: 2, branchId: "a", userId: "unit-account", additions: [],
      capabilities: { globalModules: [], branchModules: [], unsupportedScopes: ["department", "self", "assigned_tasks"], globalScopeLabel: "عام" },
    }))));
    await mount();
    await act(async () => button("الإضافات المستقلة").props.onClick());
    await act(async () => button("إضافة مستقلة جديدة").props.onClick());
    await act(async () => renderer.root.findByProps({ id: "addition-reason" }).props.onChange({ target: { value: "مراجعة مستقلة" } }));
    mocks.state.data = { ...data, employees: [{ ...data.employees[1], account: null, management: { allowed: false, reason: "protected_account" } }] };
    await renderAgain();
    expect(renderer.root.findByProps({ id: "addition-reason" }).props.value).toBe("مراجعة مستقلة");
    await act(async () => button("إغلاق").props.onClick());
    mocks.state.data = data;
    await renderAgain();
    await act(async () => button("موظفون دون حساب").props.onClick());
    expect(button("الإضافات المستقلة")).toBeUndefined();
  });
  it("keeps the pilot entry admin-only and separate, including blocked linked accounts but never account creation", async () => {
    await mount();
    expect(button("مقارنة وتجربة قالب")).toBeUndefined();
    mocks.user = { ...mocks.user, role: "admin" };
    mocks.state.data = { ...data, employees: [{ ...data.employees[1], account: null, management: { allowed: false, reason: "protected_account" } }, data.employees[0]] };
    await renderAgain();
    expect(button("مقارنة وتجربة قالب")).toBeTruthy();
    expect(button("إسناد قالب معتمد")).toBeUndefined();
    await act(async () => button("مقارنة وتجربة قالب").props.onClick());
    expect(renderer.root.findByProps({ id: "pilot-employee" }).props.value).toBe(data.employees[1].employeeName);
    await act(async () => button("إغلاق").props.onClick());
    await act(async () => button("موظفون دون حساب").props.onClick());
    expect(button("مقارنة وتجربة قالب")).toBeUndefined();
  });
  it("preserves pilot choices and reason on policy changes but clears the dialog when admin identity/role is withdrawn", async () => {
    mocks.user = { ...mocks.user, role: "admin" };
    await mount();
    await act(async () => button("مقارنة وتجربة قالب").props.onClick());
    await act(async () => renderer.root.findByProps({ id: "pilot-template" }).props.onChange({ target: { value: "7:3" } }));
    await act(async () => renderer.root.findByProps({ id: "pilot-reason" }).props.onChange({ target: { value: "سبب تجربة محفوظ" } }));
    mocks.state.data = { ...data, policy: { enabled: false, permissions: [] } };
    await renderAgain();
    expect(renderer.root.findByProps({ id: "pilot-template" }).props.value).toBe("7:3");
    expect(renderer.root.findByProps({ id: "pilot-reason" }).props.value).toBe("سبب تجربة محفوظ");
    expect(JSON.stringify(renderer.toJSON())).toContain("تغيّرت بيانات الحساب أو السياسة");
    expect(renderer.root.findByProps({ id: "pilot-review" }).props.checked).toBe(false);
    mocks.user = { ...mocks.user, role: "operations_manager" };
    await renderAgain();
    expect(renderer.root.findAllByProps({ id: "pilot-reason" })).toHaveLength(0);
    expect(button("مقارنة وتجربة قالب")).toBeUndefined();
  });

  it("fails closed on stale directory errors and does not silently expand an invalid branch", async () => {
    mocks.search = "?branchId=unauthorized";
    await mount();
    expect(button("اختيار الموظف")).toBeUndefined();
    expect(JSON.stringify(renderer.toJSON())).toContain("لم يتم توسيع النطاق تلقائيًا");
    mocks.state = { ...mocks.state, isError: true, error: new Error("network") };
    await renderAgain();
    expect(renderer.root.findAllByProps({ "data-testid": "employee-account-2" })).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("لم نعرض بيانات أو صلاحيات قديمة");
  });

  it("clears credentials immediately when actor/active branch changes and on logout", async () => {
    vi.stubGlobal("fetch", templateFetch("unit-secret"));
    await mount();
    await act(async () => button("موظفون دون حساب").props.onClick());
    await act(async () => button("اختيار الموظف").props.onClick());
    await confirmCreate();
    expect(JSON.stringify(renderer.toJSON())).toContain("unit-secret");
    mocks.user = { ...mocks.user, activeBranchId: "b" };
    await renderAgain();
    expect(JSON.stringify(renderer.toJSON())).not.toContain("unit-secret");
    expect(mocks.cancel).toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalled();
    mocks.user = null;
    await renderAgain();
    expect(renderer.root.findAllByProps({ "data-testid": "denied" })).toHaveLength(1);
    expect(JSON.stringify(renderer.toJSON())).not.toContain("unit-secret");
  });

  it("clears credentials on a client branch change or newly disabled policy", async () => {
    vi.stubGlobal("fetch", templateFetch("scope-secret"));
    await mount();
    await act(async () => button("موظفون دون حساب").props.onClick());
    await act(async () => button("اختيار الموظف").props.onClick());
    await confirmCreate();
    expect(JSON.stringify(renderer.toJSON())).toContain("scope-secret");
    mocks.search = "?branchId=a";
    await renderAgain();
    expect(JSON.stringify(renderer.toJSON())).not.toContain("scope-secret");
    await act(async () => button("اختيار الموظف").props.onClick());
    vi.stubGlobal("fetch", templateFetch("policy-secret"));
    await confirmCreate();
    expect(JSON.stringify(renderer.toJSON())).toContain("policy-secret");
    mocks.state = { ...mocks.state, data: { ...data, policy: { enabled: false, permissions: [] } } };
    await renderAgain();
    expect(JSON.stringify(renderer.toJSON())).not.toContain("policy-secret");
    expect(button("اختيار الموظف").props.disabled).toBe(true);
  });

  it("denies other roles even when they have broad users permissions elsewhere", async () => {
    mocks.user = { ...mocks.user, role: "branch_manager" };
    await mount();
    expect(renderer.root.findAllByProps({ "data-testid": "denied" })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ "data-testid": "operations-employee-accounts-page" })).toHaveLength(0);
  });

  it("clears credentials at logout start, before the auth cookie response arrives", async () => {
    vi.stubGlobal("fetch", templateFetch("logout-secret"));
    await mount();
    await act(async () => button("موظفون دون حساب").props.onClick());
    await act(async () => button("اختيار الموظف").props.onClick());
    await confirmCreate();
    expect(JSON.stringify(renderer.toJSON())).toContain("logout-secret");
    mocks.loggingOut = true;
    await renderAgain();
    expect(JSON.stringify(renderer.toJSON())).not.toContain("logout-secret");
    expect(JSON.stringify(renderer.toJSON())).toContain("جار تسجيل الخروج");
  });

  it.each([
    { enabled: false, permissions: [] },
    { enabled: true, permissions: [{ module: "cashier_journal", actions: ["view"] }] },
  ])("keeps existing accounts visible and freezing available with disabled/narrowed policy %#", async policy => {
    const account = {
      ...data.employees[1],
      account: {
        ...data.employees[1].account!,
        isActive: "active" as const,
        permissions: [{ module: "cashier_journal", actions: ["view", "create"] }],
        canReactivate: false,
      },
    };
    mocks.state = { ...mocks.state, data: { ...data, policy, availablePermissions: policy.permissions, employees: [account] } };
    await mount();
    expect(renderer.root.findAllByProps({ "data-testid": "employee-account-2" })).toHaveLength(1);
    expect(button("إسناد قالب معتمد").props.disabled).toBe(false);
    expect(JSON.stringify(renderer.toJSON())).toContain("تعطيل السياسة أو تضييقها لا يسحب تلقائيًا وصول الحسابات الحالية");
    await act(async () => button("إسناد قالب معتمد").props.onClick());
    expect(button("تأكيد إسناد الإصدار").props.disabled).toBe(true);
    expect(renderer.root.findAllByType("input").filter((node: any) => node.props.type === "checkbox")).toHaveLength(1);
    expect(button("حفظ تخفيض الصلاحيات")).toBeUndefined();
    await act(async () => button("إلغاء").props.onClick());
    expect(button("تجميد").props.disabled).toBe(false);
    await act(async () => button("تجميد").props.onClick());
    expect(button("تأكيد التجميد").props.disabled).toBe(false);
  });
});