import { createElement } from "react";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmployeeAccountManagerSelectionEditor } from "./employee-account-manager-selection";

const { act, create } = createRequire(import.meta.url)("react-test-renderer");
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const endpoint = "/api/admin/employee-account-managers";
const managers = ["a", "b"].map(id => ({ id, name: `مدير ${id}`, branches: [{ id: "branch", name: "الفرع", canManage: true }] }));
const selection = (managerId: string) => ({
  managerId, revision: `revision-${managerId}`, selectedEmployeeIds: managerId === "a" ? [1] : [2],
  employees: [1, 2].map(employeeId => ({ employeeId, employeeName: `موظف ${employeeId}`, branchId: "branch", branchName: "الفرع", hasAccount: false, eligible: true, reason: "allowed" })),
});
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
let renderer: any;
let refresh: ReturnType<typeof vi.fn>;
async function mount() {
  refresh = vi.fn();
  await act(async () => { renderer = create(createElement(EmployeeAccountManagerSelectionEditor, { refresh })); });
}
async function choose(id: string) {
  await act(async () => renderer.root.findByProps({ id: "employee-account-manager" }).props.onChange({ target: { value: id } }));
}
function text(node: any): string { return typeof node === "string" ? node : (node.children ?? []).map(text).join(""); }
function button(label: string) { return renderer.root.findAllByType("button").find((node: any) => text(node).includes(label)); }
function checkbox(id: number) { return renderer.root.findByProps({ "aria-label": `تفويض موظف ${id}` }); }
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});

describe("per-manager employee selection", () => {
  it("isolates drafts between two managers and saves only captured manager/revision without autosave", async () => {
    const fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      if (options.method === "PUT") return response({ saved: true });
      return response(url === endpoint ? { managers } : selection(url.endsWith("/a") ? "a" : "b"));
    });
    vi.stubGlobal("fetch", fetch);
    await mount();
    await choose("a");
    expect(checkbox(1).props.checked).toBe(true);
    await act(async () => checkbox(2).props.onChange({ target: { checked: true } }));
    expect(fetch.mock.calls.filter(([, options]) => options.method === "PUT")).toHaveLength(0);
    await choose("b");
    expect(checkbox(1).props.checked).toBe(false);
    expect(checkbox(2).props.checked).toBe(true);
    await act(async () => button("حفظ اختيار الموظفين").props.onClick());
    const put = fetch.mock.calls.find(([, options]) => options.method === "PUT")!;
    expect(put[0]).toBe(`${endpoint}/b`);
    expect(JSON.parse(put[1].body)).toEqual({ employeeIds: [2], revision: "revision-b" });
    expect(refresh).toHaveBeenCalledOnce();
    expect(JSON.stringify(renderer.toJSON())).toContain("تم حفظ اختيار هذا المدير");
    await choose("a");
    expect(checkbox(2).props.checked).toBe(false);
  });

  it("ignores an old manager response including A→B→A and aborts the old request", async () => {
    let resolve!: (result: Response) => void;
    let oldSignal!: AbortSignal;
    let aCalls = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string, options: any) => {
      if (url === endpoint) return Promise.resolve(response({ managers }));
      if (url.endsWith("/a") && ++aCalls === 1) {
        oldSignal = options.signal;
        return new Promise<Response>(done => { resolve = done; });
      }
      return Promise.resolve(response(selection(url.endsWith("/a") ? "a" : "b")));
    }));
    await mount();
    await choose("a");
    await choose("b");
    expect(oldSignal.aborted).toBe(true);
    await choose("a");
    expect(checkbox(1).props.checked).toBe(true);
    await act(async () => {
      resolve(response({ ...selection("a"), revision: "old", selectedEmployeeIds: [2] }));
      await new Promise(done => setTimeout(done, 0));
    });
    expect(checkbox(1).props.checked).toBe(true);
    expect(checkbox(2).props.checked).toBe(false);
  });

  it("ignores a late save when manager changes and leaves the second manager untouched", async () => {
    let resolve!: (result: Response) => void;
    let signal!: AbortSignal;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string, options: any) => {
      if (options.method === "PUT") {
        signal = options.signal;
        return new Promise<Response>(done => { resolve = done; });
      }
      return Promise.resolve(response(url === endpoint ? { managers } : selection(url.endsWith("/a") ? "a" : "b")));
    }));
    await mount();
    await choose("a");
    let pending!: Promise<void>;
    await act(async () => { pending = button("حفظ اختيار الموظفين").props.onClick(); });
    await choose("b");
    expect(signal.aborted).toBe(true);
    await act(async () => { resolve(response({ saved: true })); await pending; });
    expect(checkbox(2).props.checked).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).not.toContain("تم حفظ اختيار هذا المدير");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("explains optimistic conflicts and requires explicit reload instead of force overwrite", async () => {
    const fetch = vi.fn().mockImplementation(async (url: string, options: any) =>
      options.method === "PUT" ? response({ error: "تعارض" }, 409) : response(url === endpoint ? { managers } : selection("a")));
    vi.stubGlobal("fetch", fetch);
    await mount();
    await choose("a");
    await act(async () => button("حفظ اختيار الموظفين").props.onClick());
    expect(JSON.stringify(renderer.toJSON())).toContain("لن يتم فرض استبدال الاختيار");
    expect(button("حفظ اختيار الموظفين").props.disabled).toBe(true);
    await act(async () => button("حفظ اختيار الموظفين").props.onClick());
    expect(fetch.mock.calls.filter(([, options]) => options.method === "PUT")).toHaveLength(1);
    await act(async () => button("إعادة تحميل اختيار المدير").props.onClick());
    expect(button("حفظ اختيار الموظفين").props.disabled).toBe(false);
  });

  it("surfaces save failures without claiming success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string, options: any) =>
      options.method === "PUT" ? response({ error: "تعذر حفظ الاختيار" }, 500) : response(url === endpoint ? { managers } : selection("a"))));
    await mount();
    await choose("a");
    await act(async () => button("حفظ اختيار الموظفين").props.onClick());
    expect(JSON.stringify(renderer.toJSON())).toContain("تعذر حفظ الاختيار (500)");
    expect(JSON.stringify(renderer.toJSON())).not.toContain("تم حفظ اختيار هذا المدير");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows explicit list errors, empty states, and cancels requests on scope unmount", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: "غير مصرح" }, 403)));
    await mount();
    expect(JSON.stringify(renderer.toJSON())).toContain("غير مصرح (403)");
    expect(renderer.root.findByProps({ id: "employee-account-manager" }).props.disabled).toBe(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ managers: [] })));
    await act(async () => button("تحديث قائمة المديرين").props.onClick());
    expect(JSON.stringify(renderer.toJSON())).toContain("لا يوجد مديرو عمليات");
    let signal!: AbortSignal;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_: string, options: any) => {
      signal = options.signal;
      return new Promise<Response>(() => {});
    }));
    await act(async () => { void button("تحديث قائمة المديرين").props.onClick(); });
    await act(async () => renderer.unmount());
    renderer = undefined;
    expect(signal.aborted).toBe(true);
  });

  it("disables protected/read-only employees and supports clear plus filtered selection count", async () => {
    const data = selection("a");
    data.employees[1] = { ...data.employees[1], eligible: false, reason: "protected_account", hasAccount: true };
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => response(url === endpoint ? { managers } : data)));
    await mount();
    await choose("a");
    expect(checkbox(2).props.disabled).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).toContain("حساب محمي — يتطلب مسؤول النظام");
    await act(async () => renderer.root.findByProps({ id: "manager-employees-search" }).props.onChange({ target: { value: "موظف 2" } }));
    expect(renderer.root.findAllByProps({ "aria-label": "تفويض موظف 1" })).toHaveLength(0);
    expect(text(renderer.root.findByProps({ "data-testid": "manager-selection-count" }))).toContain("1");
    await act(async () => button("مسح الاختيار").props.onClick());
    expect(text(renderer.root.findByProps({ "data-testid": "manager-selection-count" }))).toContain("0");
  });
});