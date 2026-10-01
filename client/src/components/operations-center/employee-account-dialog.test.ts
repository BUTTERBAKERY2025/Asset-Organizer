import { createElement } from "react";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmployeeAccountsResponse, DelegatedEmployeeAccount } from "@shared/employee-account-delegation";
import { EmployeeAccountDialog } from "./employee-account-dialog";
import { EmployeeAccountPolicyEditor } from "./employee-account-policy";

const { act, create } = createRequire(import.meta.url)("react-test-renderer");
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.mock("@/components/ui/dialog", () => {
  const element = ({ children }: { children: React.ReactNode }) => createElement("section", null, children);
  return { Dialog: element, DialogContent: element, DialogHeader: element, DialogTitle: element, DialogDescription: element, DialogFooter: element };
});

const employee: DelegatedEmployeeAccount = { employeeId: 19, employeeName: "موظف اختبار", branchId: "a", branchName: "فرع اختبار", account: null };
const directory: EmployeeAccountsResponse = {
  employees: [employee],
  policy: { enabled: true, permissions: [{ module: "cashier_journal", actions: ["view"] }] },
  // Admin catalog is wider than policy: the dialog must NOT expand grants.
  availablePermissions: [{ module: "cashier_journal", actions: ["view", "create"] }],
  templates: [{ id: "cashier", name: "كاشير", permissions: [{ module: "cashier_journal", actions: ["view", "create"] }] }],
};

let renderer: any;
beforeEach(() => {
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});

function button(label: string) {
  const text = (node: any): string => typeof node === "string" ? node : (node.children ?? []).map(text).join("");
  return renderer.root.findAllByType("button").find((node: any) => text(node).includes(label));
}
async function mount(mode: "create" | "permissions" | "freeze" | "reopen" = "create", row = employee, data = directory) {
  const close = vi.fn(), refresh = vi.fn();
  await act(async () => { renderer = create(createElement(EmployeeAccountDialog, { employee: row, mode, directory: data, close, refresh })); });
  return { close, refresh };
}

describe("employee account dialog without browser or persistent secrets", () => {
  it("starts with a read-only employee, no credential preview, and one explicit create button", async () => {
    await mount();
    expect(renderer.root.findByProps({ id: "delegated-employee-name" }).props.readOnly).toBe(true);
    expect(renderer.root.findAllByProps({ "data-testid": "generated-password" })).toHaveLength(0);
    expect(button("توليد وإنشاء الحساب")).toBeTruthy();
    const permissions = renderer.root.findAllByType("input").filter((node: any) => node.props.type === "checkbox");
    expect(permissions).toHaveLength(1);
    expect(permissions[0].props["aria-label"]).not.toContain("إنشاء");
  });

  it("creates atomically using approved permissions and displays/copies credentials once", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      employee: { ...employee, account: { id: "unit-account", username: "unit-user", isActive: "active", permissions: [], canReactivate: false } },
      credentials: { username: "unit-user", password: "unit-password" },
    })));
    vi.stubGlobal("fetch", fetch);
    const { refresh, close } = await mount();
    await act(async () => renderer.root.findByProps({ id: "delegated-template" }).props.onChange({ target: { value: "cashier" } }));
    await act(async () => button("توليد وإنشاء الحساب").props.onClick());
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ permissions: [{ module: "cashier_journal", actions: ["view"] }] });
    expect(renderer.root.findByProps({ "data-testid": "generated-password" }).children).toEqual(["unit-password"]);
    expect(button("توليد وإنشاء الحساب")).toBeUndefined();
    await act(async () => renderer.root.findByProps({ "aria-label": "نسخ كلمة المرور" }).props.onClick());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("unit-password");
    expect(refresh).toHaveBeenCalled();
    await act(async () => button("حفظت البيانات").props.onClick());
    expect(close).toHaveBeenCalledOnce();
    expect(renderer.root.findAllByProps({ "data-testid": "generated-password" })).toHaveLength(0);
  });

  it("rejects a late creation response after the dialog closes", async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>(done => { resolve = done; })));
    const { close } = await mount();
    let pending!: Promise<void>;
    await act(async () => { pending = button("توليد وإنشاء الحساب").props.onClick(); });
    await act(async () => button("إلغاء").props.onClick());
    expect(close).toHaveBeenCalledOnce();
    await act(async () => {
      resolve(new Response(JSON.stringify({ employee, credentials: { username: "late-user", password: "late-secret" } })));
      await pending;
    });
    expect(JSON.stringify(renderer.toJSON())).not.toContain("late-secret");
  });

  it("surfaces safe-copy failure explicitly instead of falling back to insecure DOM copying", async () => {
    vi.stubGlobal("window", { isSecureContext: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ employee, credentials: { username: "unit-user", password: "unit-password" } }))));
    await mount();
    await act(async () => button("توليد وإنشاء الحساب").props.onClick());
    await act(async () => renderer.root.findByProps({ "aria-label": "نسخ كلمة المرور" }).props.onClick());
    expect(JSON.stringify(renderer.toJSON())).toContain("تعذر النسخ الآمن");
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("requires explicit status confirmation and uses only the status payload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ employee }))));
    await mount("freeze", { ...employee, account: { id: "unit-account", username: "unit-user", isActive: "active", permissions: [], canReactivate: false } });
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.stringify(renderer.toJSON())).toContain("هل تؤكد تجميد الحساب");
    await act(async () => button("تأكيد التجميد").props.onClick());
    expect(fetch).toHaveBeenCalledWith("/api/operations/employee-accounts/19/status", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ isActive: "inactive" }) }));
  });

  it("shows backend errors without hiding them and blocks creation when unapproved", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "الموظف مرتبط بحساب بالفعل" }), { status: 409 })));
    await mount();
    await act(async () => button("توليد وإنشاء الحساب").props.onClick());
    expect(JSON.stringify(renderer.toJSON())).toContain("الموظف مرتبط بحساب بالفعل (409)");
    await act(async () => renderer.unmount());
    renderer = undefined;
    await mount("create", employee, { ...directory, policy: { enabled: false, permissions: [] } });
    expect(button("توليد وإنشاء الحساب").props.disabled).toBe(true);
  });

  it("does not reactivate a protected/ineligible account", async () => {
    await mount("reopen", { ...employee, account: { id: "unit-account", username: "unit-user", isActive: "inactive", permissions: [], canReactivate: false } });
    expect(button("تأكيد إعادة الفتح").props.disabled).toBe(true);
  });

  it("can revoke all approved direct permissions through the exact permissions PUT", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ employee }))));
    await mount("permissions", { ...employee, account: { id: "unit-account", username: "unit-user", isActive: "active", permissions: [{ module: "cashier_journal", actions: ["view"] }], canReactivate: false } });
    await act(async () => renderer.root.findAllByType("input").find((node: any) => node.props.type === "checkbox").props.onChange({ target: { checked: false } }));
    await act(async () => button("حفظ الصلاحيات").props.onClick());
    expect(fetch).toHaveBeenCalledWith("/api/operations/employee-accounts/19/permissions", expect.objectContaining({ method: "PUT", body: JSON.stringify({ permissions: [] }) }));
  });

  it("keeps a disabled-policy editor usable but never offers additions to existing permissions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ employee }))));
    const current = { ...employee, account: { id: "unit-account", username: "unit-user", isActive: "active" as const, permissions: [{ module: "cashier_journal", actions: ["view"] }], canReactivate: false } };
    const disabled = {
      ...directory,
      policy: { enabled: false, permissions: [{ module: "cashier_journal", actions: ["view", "create"] }] },
      templates: [],
    };
    await mount("permissions", current, disabled);
    const checkboxes = renderer.root.findAllByType("input").filter((node: any) => node.props.type === "checkbox");
    expect(checkboxes).toHaveLength(1);
    expect(checkboxes[0].props.checked).toBe(true);
    expect(renderer.root.findAllByProps({ id: "delegated-template" })).toHaveLength(0);
    expect(button("حفظ تخفيض الصلاحيات").props.disabled).toBe(false);
    expect(JSON.stringify(renderer.toJSON())).toContain("تعطيل السياسة لا يسحب تلقائيًا وصول الحسابات الحالية");
    await act(async () => checkboxes[0].props.onChange({ target: { checked: false } }));
    await act(async () => button("حفظ تخفيض الصلاحيات").props.onClick());
    expect(fetch).toHaveBeenCalledWith("/api/operations/employee-accounts/19/permissions", expect.objectContaining({ method: "PUT", body: JSON.stringify({ permissions: [] }) }));
  });

  it("only reduces an out-of-ceiling account, even if enabled approval contains other new choices", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ employee }))));
    const current = { ...employee, account: { id: "unit-account", username: "unit-user", isActive: "active" as const, permissions: [{ module: "cashier_journal", actions: ["view", "create"] }], canReactivate: false } };
    const narrowed = {
      ...directory,
      policy: { enabled: true, permissions: [{ module: "cashier_journal", actions: ["view", "edit"] }] },
      availablePermissions: [{ module: "cashier_journal", actions: ["view", "create", "edit"] }],
    };
    await mount("permissions", current, narrowed);
    expect(renderer.root.findAllByType("input").filter((node: any) => node.props.type === "checkbox")).toHaveLength(1);
    expect(renderer.root.findAllByProps({ id: "delegated-template" })).toHaveLength(0);
    await act(async () => button("حفظ تخفيض الصلاحيات").props.onClick());
    expect(fetch).toHaveBeenCalledWith("/api/operations/employee-accounts/19/permissions", expect.objectContaining({ method: "PUT", body: JSON.stringify({ permissions: [{ module: "cashier_journal", actions: ["view"] }] }) }));
  });

  it("allows empty reduction when no existing permissions remain inside the approved ceiling", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ employee }))));
    const current = { ...employee, account: { id: "unit-account", username: "unit-user", isActive: "active" as const, permissions: [{ module: "cashier_journal", actions: ["view"] }], canReactivate: false } };
    await mount("permissions", current, { ...directory, policy: { enabled: false, permissions: [] }, availablePermissions: [], templates: [] });
    expect(button("حفظ تخفيض الصلاحيات").props.disabled).toBe(false);
    expect(JSON.stringify(renderer.toJSON())).toContain("حفظ القائمة الفارغة");
    await act(async () => button("حفظ تخفيض الصلاحيات").props.onClick());
    expect(fetch).toHaveBeenCalledWith("/api/operations/employee-accounts/19/permissions", expect.objectContaining({ method: "PUT", body: JSON.stringify({ permissions: [] }) }));
  });

  it("still allows approved additions for an in-ceiling account under enabled policy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ employee }))));
    const current = { ...employee, account: { id: "unit-account", username: "unit-user", isActive: "active" as const, permissions: [{ module: "cashier_journal", actions: ["view"] }], canReactivate: false } };
    await mount("permissions", current, { ...directory, policy: { enabled: true, permissions: directory.availablePermissions } });
    const checkboxes = renderer.root.findAllByType("input").filter((node: any) => node.props.type === "checkbox");
    expect(checkboxes).toHaveLength(2);
    await act(async () => checkboxes[1].props.onChange({ target: { checked: true } }));
    await act(async () => button("حفظ الصلاحيات").props.onClick());
    expect(fetch).toHaveBeenCalledWith("/api/operations/employee-accounts/19/permissions", expect.objectContaining({ method: "PUT", body: JSON.stringify({ permissions: [{ module: "cashier_journal", actions: ["view", "create"] }] }) }));
  });

  it("reopens only after explicit confirmation and does not regenerate credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ employee }))));
    await mount("reopen", { ...employee, account: { id: "unit-account", username: "unit-user", isActive: "inactive", permissions: [], canReactivate: true } });
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => button("تأكيد إعادة الفتح").props.onClick());
    expect(fetch).toHaveBeenCalledWith("/api/operations/employee-accounts/19/status", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ isActive: "active" }) }));
    expect(renderer.root.findAllByProps({ "data-testid": "generated-password" })).toHaveLength(0);
  });

  it("keeps admin policy disabled until explicit approval and sends the exact PUT contract", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ policy: directory.policy })));
    vi.stubGlobal("fetch", fetch);
    await act(async () => {
      renderer = create(createElement(EmployeeAccountPolicyEditor, { directory: { ...directory, policy: { enabled: false, permissions: [] } }, refresh: vi.fn() }));
    });
    const checkboxes = renderer.root.findAllByType("input");
    expect(checkboxes[0].props.checked).toBe(false);
    expect(JSON.stringify(renderer.toJSON())).toContain("تعطيل السياسة أو تضييقها لا يسحب تلقائيًا وصول الحسابات الحالية");
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => checkboxes[0].props.onChange({ target: { checked: true } }));
    expect(button("اعتماد وحفظ السياسة").props.disabled).toBe(true);
    await act(async () => checkboxes[1].props.onChange({ target: { checked: true } }));
    await act(async () => button("اعتماد وحفظ السياسة").props.onClick());
    expect(fetch).toHaveBeenCalledWith("/api/admin/employee-account-policy", expect.objectContaining({
      method: "PUT", body: JSON.stringify({ enabled: true, permissions: [{ module: "cashier_journal", actions: ["view"] }] }),
    }));
  });
});