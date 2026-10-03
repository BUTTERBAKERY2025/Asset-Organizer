import { createElement } from "react";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmployeeAccountManagerSelectionEditor } from "./employee-account-manager-selection";

const { act, create } = createRequire(import.meta.url)("react-test-renderer");
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const endpoint = "/api/admin/employee-account-managers";
const managers = ["a", "b"].map(id => ({ id, name: `مدير ${id}`, branches: [
  { id: "branch", name: "فرع الكتابة", canManage: true }, { id: "read", name: "فرع العرض", canManage: false },
] }));
const coverage = (managerId: string) => ({
  managerId, scopeMode: "all_branch_employees", revision: `revision-${managerId}`,
  selectedEmployeeIds: [], // Compatibility metadata is deliberately NOT the eligibility gate.
  employees: [
    { employeeId: 1, employeeName: "موظف حالي", branchId: "branch", branchName: "فرع الكتابة", hasAccount: true, eligible: true, reason: "allowed" },
    { employeeId: 2, employeeName: "موظف جديد بلا حساب", branchId: "branch", branchName: "فرع الكتابة", hasAccount: false, eligible: true, reason: "allowed" },
    { employeeId: 3, employeeName: "حساب إداري محمي", branchId: "branch", branchName: "فرع الكتابة", hasAccount: true, eligible: false, reason: "protected_account" },
    { employeeId: 4, employeeName: "موظف فرع العرض", branchId: "read", branchName: "فرع العرض", hasAccount: true, eligible: false, reason: "read_only_branch" },
  ],
});
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
let renderer: any;
const text = (node: any): string => typeof node === "string" ? node : (node.children ?? []).map(text).join("");
const button = (label: string) => renderer.root.findAllByType("button").find((node: any) => text(node).includes(label));
async function mount(actorRole = "admin") {
  await act(async () => { renderer = create(createElement(EmployeeAccountManagerSelectionEditor, { actorRole })); });
}
async function choose(id: string) {
  await act(async () => renderer.root.findByProps({ id: "employee-account-manager" }).props.onChange({ target: { value: id } }));
}
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});

describe("read-only automatic branch employee coverage", () => {
  it("shows admin branch coverage and current eligible employees without checkboxes, selection mutations or save controls", async () => {
    const fetch = vi.fn(async (url: string) => response(url === endpoint ? { managers } : coverage(url.endsWith("/a") ? "a" : "b")));
    vi.stubGlobal("fetch", fetch);
    await mount();
    await choose("a");
    expect(renderer.root.findAllByType("input").filter((node: any) => node.props.type === "checkbox")).toHaveLength(0);
    expect(button("حفظ")).toBeUndefined();
    expect(button("مسح الاختيار")).toBeUndefined();
    expect(text(renderer.root.findByProps({ "aria-label": "تغطية فروع المدير" }))).toContain("الموظفين الحاليين والمستقبليين تلقائيًا");
    expect(text(renderer.root.findByProps({ "data-testid": "manager-selection-count" }))).toContain("الموظفون المؤهلون حاليًا: 2");
    expect(text(renderer.root.findByProps({ "data-testid": "manager-coverage-employee-1" }))).toContain("مؤهل حاليًا");
    expect(text(renderer.root.findByProps({ "data-testid": "manager-coverage-employee-3" }))).toContain("خارج نطاق الإدارة المفوّضة");
    expect(text(renderer.root.findByProps({ "data-testid": "manager-coverage-employee-4" }))).toContain("للقراءة فقط");
    expect(JSON.stringify(renderer.toJSON())).toContain("التغطية التلقائية ليست إنشاءً أو منحًا تلقائيًا");
    await choose("b");
    await act(async () => button("إعادة قراءة تغطية المدير").props.onClick());
    expect(fetch.mock.calls.every((call: any) => call[1].method === "GET" && call[1].body === undefined)).toBe(true);
  });
  it.each(["operations_manager", "employee"])("mounts no admin resources or mutation controls for %s", async role => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await mount(role);
    expect(fetch).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType("input")).toHaveLength(0);
    expect(renderer.root.findAllByType("button")).toHaveLength(0);
  });
  it("filters branches and employees as read-only views and includes a newly returned employee without any saved selection", async () => {
    let data = coverage("a");
    const fetch = vi.fn(async (url: string) => response(url === endpoint ? { managers } : data));
    vi.stubGlobal("fetch", fetch);
    await mount(); await choose("a");
    await act(async () => renderer.root.findByProps({ id: "manager-employees-branch" }).props.onChange({ target: { value: "read" } }));
    expect(renderer.root.findAllByProps({ "data-testid": "manager-coverage-employee-1" })).toHaveLength(0);
    expect(renderer.root.findByProps({ "data-testid": "manager-coverage-employee-4" })).toBeTruthy();
    await act(async () => renderer.root.findByProps({ id: "manager-employees-branch" }).props.onChange({ target: { value: "" } }));
    data = { ...data, employees: [...data.employees, { ...data.employees[1], employeeId: 5, employeeName: "موظف انضم لاحقًا" }] };
    await act(async () => button("إعادة قراءة تغطية المدير").props.onClick());
    expect(renderer.root.findByProps({ "data-testid": "manager-coverage-employee-5" })).toBeTruthy();
    expect(text(renderer.root.findByProps({ "data-testid": "manager-selection-count" }))).toContain("حاليًا: 3");
    await act(async () => renderer.root.findByProps({ id: "manager-employees-search" }).props.onChange({ target: { value: "انضم لاحقًا" } }));
    expect(renderer.root.findAllByProps({ "data-testid": "manager-coverage-employee-1" })).toHaveLength(0);
    expect(fetch.mock.calls.every((call: any) => call[1].method === "GET")).toBe(true);
  });
  it.each([undefined, "manual_selection"])("fails closed on missing or obsolete scopeMode %s without showing an old selection list", async scopeMode => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => response(url === endpoint ? { managers } : { ...coverage("a"), scopeMode })));
    await mount(); await choose("a");
    expect(JSON.stringify(renderer.toJSON())).toContain("الخدمة لا تؤكد نمط تغطية جميع موظفي الفروع");
    expect(renderer.root.findAllByProps({ "data-testid": "manager-coverage-employee-1" })).toHaveLength(0);
    expect(button("إعادة قراءة تغطية المدير").props.disabled).toBe(false);
    expect(button("حفظ")).toBeUndefined();
  });
  it("rejects claimed eligibility in a read-only branch rather than widening coverage", async () => {
    const data = coverage("a");
    data.employees[3] = { ...data.employees[3], eligible: true, reason: "allowed" };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => response(url === endpoint ? { managers } : data)));
    await mount(); await choose("a");
    expect(JSON.stringify(renderer.toJSON())).toContain("لم نعرض أهلية بديلة");
    expect(renderer.root.findAllByProps({ "data-testid": "manager-coverage-employee-4" })).toHaveLength(0);
  });
  it("isolates A→B→A reads and aborts the superseded request", async () => {
    let resolveOld!: (value: Response) => void;
    let oldSignal!: AbortSignal;
    let aReads = 0;
    vi.stubGlobal("fetch", vi.fn((url: string, options: any) => {
      if (url === endpoint) return Promise.resolve(response({ managers }));
      if (url.endsWith("/a") && ++aReads === 1) {
        oldSignal = options.signal;
        return new Promise<Response>(resolve => { resolveOld = resolve; });
      }
      return Promise.resolve(response(coverage(url.endsWith("/a") ? "a" : "b")));
    }));
    await mount(); await choose("a"); await choose("b"); await choose("a");
    expect(oldSignal.aborted).toBe(true);
    await act(async () => resolveOld(response({ ...coverage("a"), employees: [{ ...coverage("a").employees[0], employeeName: "قراءة قديمة يجب تجاهلها" }] })));
    expect(JSON.stringify(renderer.toJSON())).not.toContain("قراءة قديمة يجب تجاهلها");
    expect(renderer.root.findByProps({ "data-testid": "manager-coverage-employee-2" })).toBeTruthy();
  });
  it("clears admin resources on role withdrawal and aborts pending reads", async () => {
    let signal!: AbortSignal;
    vi.stubGlobal("fetch", vi.fn((_: string, options: any) => {
      signal = options.signal;
      return new Promise<Response>(() => {});
    }));
    await mount();
    await act(async () => renderer.update(createElement(EmployeeAccountManagerSelectionEditor, { actorRole: "operations_manager" })));
    expect(signal.aborted).toBe(true);
    expect(renderer.root.findAllByProps({ id: "employee-account-manager" })).toHaveLength(0);
  });
  it("offers retry for auth errors and shows a genuine empty manager list without any writes", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response({ error: "غير مصرح" }, 403)).mockResolvedValue(response({ managers: [] }));
    vi.stubGlobal("fetch", fetch); await mount();
    expect(JSON.stringify(renderer.toJSON())).toContain("غير مصرح (403)");
    await act(async () => button("تحديث قائمة المديرين").props.onClick());
    expect(JSON.stringify(renderer.toJSON())).toContain("لا يوجد مديرو عمليات متاحون");
    expect(fetch.mock.calls.every((call: any) => call[1].method === "GET")).toBe(true);
  });
});