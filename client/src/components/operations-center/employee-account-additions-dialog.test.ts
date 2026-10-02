import { createElement } from "react";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DelegatedEmployeeAccount } from "@/lib/employee-account-types";
import type { EmployeeAccountAddition, EmployeeAccountAdditionsResponse } from "@/lib/employee-account-additions";
import { additionDateInput, additionDateISO } from "@/lib/employee-account-additions";
import { EmployeeAccountAdditionsDialog } from "./employee-account-additions-dialog";
import { EmployeeAccountAdditionsReadOnly } from "./employee-account-additions-list";

const { act, create } = createRequire(import.meta.url)("react-test-renderer");
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.mock("@/components/ui/dialog", () => {
  const element = ({ children }: { children: React.ReactNode }) => createElement("section", null, children);
  const dialog = ({ children, onOpenChange }: { children: React.ReactNode; onOpenChange: (open: boolean) => void }) =>
    createElement("section", { "data-testid": "test-dialog", onOpenChange }, children);
  return { Dialog: dialog, DialogContent: element, DialogHeader: element, DialogTitle: element, DialogDescription: element, DialogFooter: element };
});
const employee: DelegatedEmployeeAccount = {
  employeeId: 19, employeeName: "موظف الإضافات", branchId: "a", branchName: "فرع الاختبار",
  hasAccount: true, management: { allowed: true, reason: "allowed" },
  account: { id: "linked-user", username: "test-user", isActive: "active", permissions: [], canReactivate: true },
};
const addition: EmployeeAccountAddition = {
  id: 41, module: "cashier_journal", action: "edit", allow: false, scopeType: "global", branchId: null,
  startsAt: "2026-10-01T06:30:17.123Z", endsAt: "2026-10-03T17:45:00.456Z", reason: "منع مؤقت للمراجعة",
  revision: "11111111-1111-4111-8111-111111111111", createdBy: "admin-test",
  createdAt: "2026-09-30T07:00:00Z", updatedAt: "2026-09-30T07:00:00Z", integrity: "managed",
};
let response: EmployeeAccountAdditionsResponse;
let renderer: any;
let write: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;
const text = (node: any): string => typeof node === "string" ? node : (node.children ?? []).map(text).join("");
const button = (label: string) => renderer.root.findAllByType("button").find((node: any) => text(node).includes(label));
const serialized = () => JSON.stringify(renderer.toJSON());
const change = async (id: string, value: string) => act(async () => renderer.root.findByProps({ id }).props.onChange({ target: { value } }));
const confirm = async () => act(async () => renderer.root.findByProps({ id: "addition-confirm" }).props.onChange({ target: { checked: true } }));
async function mount(actorRole = "admin") {
  const close = vi.fn(), refresh = vi.fn();
  await act(async () => { renderer = create(createElement(EmployeeAccountAdditionsDialog, { actorRole, employee, close, refresh })); });
  return { close, refresh };
}
async function draftCreate(scope = "global", module = "cashier_journal", action = "view", effect = "allow") {
  await act(async () => button("إضافة مستقلة جديدة").props.onClick());
  await change("addition-scope", scope);
  await change("addition-module", module);
  await change("addition-action", action);
  await change("addition-effect", effect);
  await change("addition-reason", "سبب صريح لسجل مستقل");
}
beforeEach(() => {
  response = {
    employeeId: 19, branchId: "a", userId: "linked-user", additions: [addition],
    capabilities: {
      globalModules: [{ module: "cashier_journal", actions: ["view", "edit"] }, { module: "users", actions: ["view", "create"] }],
      branchModules: [{ module: "hr_documents", actions: ["view", "create", "edit", "delete"] }, { module: "hr_evaluations", actions: ["view", "create", "edit", "approve", "delete"] }],
      unsupportedScopes: ["department", "self", "assigned_tasks"], globalScopeLabel: "عام — لا يقيّد الإجراء بفرع الموظف",
    },
  };
  write = vi.fn().mockResolvedValue(new Response(JSON.stringify({ addition: { ...addition, id: 42 } })));
  fetchMock = vi.fn((url: string, options: { method: string }) => options.method === "GET"
    ? Promise.resolve(new Response(JSON.stringify(response))) : write(url, options));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});

describe("admin independent employee additions", () => {
  it.each(["operations_manager", "employee", "branch_manager"])("does not mount admin APIs or controls for %s", async role => {
    await mount(role);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(button("إضافة مستقلة جديدة")).toBeUndefined();
    expect(serialized()).toContain("للأدمن فقط");
  });
  it("loads only the selected employee, displays records without automatically creating anything", async () => {
    await mount();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/employee-account-additions/19", expect.objectContaining({ method: "GET", credentials: "include" }));
    expect(serialized()).toContain("منع مستقل");
    expect(serialized()).toContain("منع مؤقت للمراجعة");
    expect(write).not.toHaveBeenCalled();
    await act(async () => button("إضافة مستقلة جديدة").props.onClick());
    for (const id of ["addition-scope", "addition-effect", "addition-module", "addition-action"])
      expect(renderer.root.findByProps({ id }).props.value).toBe("");
  });
  it("creates one explicit global grant, with an unmistakable global warning and no client userId", async () => {
    const { refresh } = await mount();
    await draftCreate();
    expect(serialized()).toContain("النطاق عام فعلًا");
    expect(button("تأكيد إنشاء الإضافة").props.disabled).toBe(true);
    await act(async () => button("تأكيد إنشاء الإضافة").props.onClick());
    expect(write).not.toHaveBeenCalled();
    await confirm();
    await act(async () => button("تأكيد إنشاء الإضافة").props.onClick());
    expect(write.mock.calls[0][0]).toBe("/api/admin/employee-account-additions/19");
    expect(write.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(write.mock.calls[0][1].body)).toEqual({
      module: "cashier_journal", action: "view", allow: true, scopeType: "global", branchId: null,
      startsAt: null, endsAt: null, reason: "سبب صريح لسجل مستقل",
    });
    expect(refresh).toHaveBeenCalledOnce();
    expect(renderer.root.findAllByProps({ "data-testid": "managed-addition-42" })).toHaveLength(1);
  });
  it("creates a branch-scoped deny only from contextual capabilities and persisted employee branch", async () => {
    await mount();
    await draftCreate("branch", "hr_evaluations", "approve", "deny");
    await change("addition-starts", "2026-10-04T09:15");
    await change("addition-ends", "2026-10-05T20:30");
    await confirm();
    await act(async () => button("تأكيد إنشاء الإضافة").props.onClick());
    expect(JSON.parse(write.mock.calls[0][1].body)).toEqual({
      module: "hr_evaluations", action: "approve", allow: false, scopeType: "branch", branchId: "a",
      startsAt: "2026-10-04T06:15:00.000Z", endsAt: "2026-10-05T17:30:00.000Z", reason: "سبب صريح لسجل مستقل",
    });
  });
  it("never offers department/self/task scopes or operational branch module fallbacks", async () => {
    await mount();
    await draftCreate("branch", "cashier_journal", "view");
    const scopes = renderer.root.findByProps({ id: "addition-scope" }).findAllByType("option").map((node: any) => node.props.value);
    expect(scopes).toEqual(["", "global", "branch"]);
    const modules = renderer.root.findByProps({ id: "addition-module" }).findAllByType("option").map((node: any) => node.props.value);
    // A forced unsupported selection can be displayed as unavailable but never submitted.
    expect(modules).toContain("hr_documents");
    expect(modules).toContain("hr_evaluations");
    await confirm();
    await act(async () => button("تأكيد إنشاء الإضافة").props.onClick());
    expect(write).not.toHaveBeenCalled();
  });
  it("edits an owned record with exact revision and preserves date precision when only the reason changes", async () => {
    write.mockResolvedValueOnce(new Response(JSON.stringify({ addition: { ...addition, reason: "سبب جديد", revision: "new-revision" } })));
    await mount();
    await act(async () => button("تعديل الإضافة").props.onClick());
    expect(renderer.root.findByProps({ id: "addition-effect" }).props.value).toBe("deny");
    expect(renderer.root.findByProps({ id: "addition-starts" }).props.value).toBe("2026-10-01T09:30:17.123");
    await change("addition-reason", "سبب جديد");
    await confirm();
    await act(async () => button("تأكيد حفظ التعديل").props.onClick());
    expect(write.mock.calls[0][0]).toBe("/api/admin/employee-account-additions/19/41");
    expect(write.mock.calls[0][1].method).toBe("PATCH");
    expect(JSON.parse(write.mock.calls[0][1].body)).toEqual({
      module: addition.module, action: addition.action, allow: false, scopeType: "global", branchId: null,
      startsAt: addition.startsAt, endsAt: addition.endsAt, reason: "سبب جديد", expectedRevision: addition.revision,
    });
    expect(serialized()).toContain("سبب جديد");
  });
  it("deletes only the selected addition after a new reason and explicit confirmation", async () => {
    write.mockResolvedValueOnce(new Response(JSON.stringify({ deleted: true, id: 41 })));
    await mount();
    await act(async () => button("حذف الإضافة").props.onClick());
    expect(renderer.root.findByProps({ id: "addition-reason" }).props.value).toBe("");
    expect(button("تأكيد حذف الإضافة").props.disabled).toBe(true);
    await change("addition-reason", "انتهى سبب المنع");
    await confirm();
    await act(async () => button("تأكيد حذف الإضافة").props.onClick());
    expect(write.mock.calls[0][0]).toBe("/api/admin/employee-account-additions/19/41");
    expect(write.mock.calls[0][1].method).toBe("DELETE");
    expect(JSON.parse(write.mock.calls[0][1].body)).toEqual({ reason: "انتهى سبب المنع", expectedRevision: addition.revision });
    expect(renderer.root.findAllByProps({ "data-testid": "managed-addition-41" })).toHaveLength(0);
    expect(serialized()).toContain("لم يتغير القالب الأساسي");
  });
  it.each(["edit", "delete"])("preserves the draft on %s 409 and requires reload/current-record review/reconfirmation", async mode => {
    write.mockResolvedValueOnce(new Response(JSON.stringify({ error: "الإضافة تغيرت", code: "ADDITION_REVISION_CONFLICT" }), { status: 409 }));
    await mount();
    await act(async () => button(mode === "edit" ? "تعديل الإضافة" : "حذف الإضافة").props.onClick());
    await change("addition-reason", "سبب غير محفوظ");
    await confirm();
    const submitLabel = mode === "edit" ? "تأكيد حفظ التعديل" : "تأكيد حذف الإضافة";
    await act(async () => button(submitLabel).props.onClick());
    expect(renderer.root.findByProps({ id: "addition-reason" }).props.value).toBe("سبب غير محفوظ");
    expect(renderer.root.findByProps({ id: "addition-confirm" }).props.checked).toBe(false);
    expect(button(submitLabel).props.disabled).toBe(true);
    response = { ...response, additions: [{ ...addition, revision: "22222222-2222-4222-8222-222222222222", reason: "محتوى أحدث" }] };
    await act(async () => button("تحديث السجل").props.onClick());
    expect(serialized()).toContain("محتوى أحدث");
    expect(renderer.root.findByProps({ id: "addition-reason" }).props.value).toBe("سبب غير محفوظ");
    expect(button(submitLabel).props.disabled).toBe(true);
    await confirm();
    if (mode === "delete") write.mockResolvedValueOnce(new Response(JSON.stringify({ deleted: true, id: 41 })));
    await act(async () => button(submitLabel).props.onClick());
    expect(JSON.parse(write.mock.calls[1][1].body).expectedRevision).toBe(response.additions[0].revision);
  });
  it("does not turn an externally deleted edit into creation after a conflict", async () => {
    write.mockResolvedValueOnce(new Response(JSON.stringify({ error: "تغير السجل", code: "ADDITION_REVISION_CONFLICT" }), { status: 409 }));
    await mount();
    await act(async () => button("تعديل الإضافة").props.onClick());
    await confirm();
    await act(async () => button("تأكيد حفظ التعديل").props.onClick());
    response = { ...response, additions: [] };
    await act(async () => button("تحديث السجل").props.onClick());
    expect(serialized()).toContain("لم نحول التعديل إلى إنشاء تلقائي");
    expect(button("تأكيد حفظ التعديل").props.disabled).toBe(true);
    expect(write).toHaveBeenCalledOnce();
  });
  it("shows 054 readiness explicitly instead of an empty managed-addition list", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ error: "missing metadata", code: "migration_required" }), { status: 503 })));
    await mount();
    expect(serialized()).toContain("054");
    expect(serialized()).not.toContain("لا توجد إضافات مُدارة");
    expect(button("إعادة المحاولة")).toBeTruthy();
    expect(button("إضافة مستقلة جديدة").props.disabled).toBe(true);
  });
  it("preserves unsupported-scope errors and never falls back to a global grant", async () => {
    write.mockResolvedValueOnce(new Response(JSON.stringify({ error: "نطاق غير مدعوم", code: "UNSUPPORTED_ADDITION_SCOPE" }), { status: 400 }));
    await mount();
    await draftCreate("branch", "hr_documents", "view");
    await confirm();
    await act(async () => button("تأكيد إنشاء الإضافة").props.onClick());
    expect(serialized()).toContain("نطاق غير مدعوم");
    expect(renderer.root.findByProps({ id: "addition-scope" }).props.value).toBe("branch");
    expect(write).toHaveBeenCalledOnce();
  });
  it("validates end-after-start, allows explicit expired dates, and cancels without any mutation", async () => {
    await mount();
    await draftCreate();
    await change("addition-starts", "2024-03-10T12:30");
    await change("addition-ends", "2024-03-10T12:30");
    await confirm();
    expect(button("تأكيد إنشاء الإضافة").props.disabled).toBe(true);
    expect(serialized()).toContain("يجب أن تكون النهاية بعد البداية");
    await change("addition-ends", "2024-03-11T12:30");
    await confirm();
    expect(button("تأكيد إنشاء الإضافة").props.disabled).toBe(false);
    await act(async () => button("إلغاء التعديل").props.onClick());
    expect(write).not.toHaveBeenCalled();
    expect(button("تأكيد إنشاء الإضافة")).toBeUndefined();
  });
  it("clears confirmation after changing an effect or date and documents integrity repair", async () => {
    response = { ...response, additions: [{ ...addition, integrity: "changed" }] };
    await mount();
    await act(async () => button("تعديل الإضافة").props.onClick());
    expect(serialized()).toContain("يُصلح السجل المُدار المملوك");
    await confirm();
    await change("addition-effect", "allow");
    expect(renderer.root.findByProps({ id: "addition-confirm" }).props.checked).toBe(false);
    await confirm();
    await change("addition-ends", "");
    expect(renderer.root.findByProps({ id: "addition-confirm" }).props.checked).toBe(false);
  });
  it("ignores a late mutation after dismissal and never mutates the new dialog state", async () => {
    let resolve!: (response: Response) => void;
    write.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
    const { close, refresh } = await mount();
    await draftCreate();
    await confirm();
    let pending!: Promise<void>;
    await act(async () => { pending = button("تأكيد إنشاء الإضافة").props.onClick(); });
    await act(async () => button("إغلاق").props.onClick());
    expect(close).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
    await act(async () => { resolve(new Response(JSON.stringify({ addition: { ...addition, id: 98 } }))); await pending; });
    expect(renderer.root.findAllByProps({ "data-testid": "managed-addition-98" })).toHaveLength(0);
  });
  it("uses the same read-only display for grants/denies/dates without admin API calls or editable controls", async () => {
    await act(async () => { renderer = create(createElement(EmployeeAccountAdditionsReadOnly, { additions: [addition], branchName: employee.branchName })); });
    expect(serialized()).toContain("منع مستقل");
    expect(serialized()).toContain("مددها كما هي عند تغيير القالب");
    expect(serialized()).toContain("منع مؤقت للمراجعة");
    expect(renderer.root.findAllByType("button")).toHaveLength(0);
    expect(renderer.root.findAllByType("input")).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("roundtrips Saudi datetime controls without losing sub-minute precision", () => {
    expect(additionDateISO(additionDateInput(addition.startsAt))).toBe(addition.startsAt);
    expect(additionDateISO(additionDateInput(addition.endsAt))).toBe(addition.endsAt);
    expect(additionDateISO("")).toBeNull();
  });
});