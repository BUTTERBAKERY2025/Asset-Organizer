import { createElement } from "react";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmployeeAccountsResponse } from "@shared/employee-account-delegation";
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
  policy: { enabled: true, permissions: [{ module: "cashier_journal", actions: ["view"] }] },
  availablePermissions: [{ module: "cashier_journal", actions: ["view"] }],
  templates: [],
  employees: [
    { employeeId: 1, employeeName: "موظف مؤهل", branchId: "a", branchName: "فرع أ", account: null },
    { employeeId: 2, employeeName: "موظف بحساب مجمد", branchId: "a", branchName: "فرع أ", account: { id: "unit-account", username: "unit-disabled", isActive: "inactive", permissions: [], canReactivate: true } },
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
beforeEach(() => {
  mocks.user = { id: "manager-test", role: "operations_manager", branchId: "a", activeBranchId: "a", allowedBranches: [{ branchId: "a" }] };
  mocks.state = { data, isError: false, isFetchedAfterMount: true, isFetching: false };
  mocks.search = "";
  mocks.switching = false;
  mocks.loggingOut = false;
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("operations employee account page", () => {
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
    expect(button("توليد وإنشاء الحساب")).toBeUndefined();
    await act(async () => button("موظفون دون حساب").props.onClick());
    await act(async () => button("اختيار الموظف").props.onClick());
    expect(renderer.root.findByProps({ id: "delegated-employee-name" }).props.value).toBe("موظف مؤهل");
    expect(button("توليد وإنشاء الحساب")).toBeTruthy();
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ employee: data.employees[0], credentials: { username: "unit-user", password: "unit-secret" } }))));
    await mount();
    await act(async () => button("موظفون دون حساب").props.onClick());
    await act(async () => button("اختيار الموظف").props.onClick());
    await act(async () => button("توليد وإنشاء الحساب").props.onClick());
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ employee: data.employees[0], credentials: { username: "unit-user", password: "scope-secret" } }))));
    await mount();
    await act(async () => button("موظفون دون حساب").props.onClick());
    await act(async () => button("اختيار الموظف").props.onClick());
    await act(async () => button("توليد وإنشاء الحساب").props.onClick());
    mocks.search = "?branchId=a";
    await renderAgain();
    expect(JSON.stringify(renderer.toJSON())).not.toContain("scope-secret");
    await act(async () => button("اختيار الموظف").props.onClick());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ employee: data.employees[0], credentials: { username: "unit-user", password: "policy-secret" } }))));
    await act(async () => button("توليد وإنشاء الحساب").props.onClick());
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ employee: data.employees[0], credentials: { username: "unit-user", password: "logout-secret" } }))));
    await mount();
    await act(async () => button("موظفون دون حساب").props.onClick());
    await act(async () => button("اختيار الموظف").props.onClick());
    await act(async () => button("توليد وإنشاء الحساب").props.onClick());
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
    expect(button("الصلاحيات").props.disabled).toBe(false);
    expect(JSON.stringify(renderer.toJSON())).toContain("تعطيل السياسة أو تضييقها لا يسحب تلقائيًا وصول الحسابات الحالية");
    await act(async () => button("الصلاحيات").props.onClick());
    expect(button("حفظ تخفيض الصلاحيات").props.disabled).toBe(false);
    await act(async () => button("إلغاء").props.onClick());
    expect(button("تجميد").props.disabled).toBe(false);
    await act(async () => button("تجميد").props.onClick());
    expect(button("تأكيد التجميد").props.disabled).toBe(false);
  });
});