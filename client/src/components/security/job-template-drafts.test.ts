import { createElement } from "react";
import { createRequire } from "node:module";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JobTemplateDrafts } from "./job-template-drafts";
import { apiRequest, HttpError } from "@/lib/queryClient";
import { JOB_TEMPLATE_PROPOSALS, type TemplateDetail } from "@shared/job-permission-templates";
import { permissionDiff } from "@/lib/job-template-draft-diff";

const { act, create } = createRequire(import.meta.url)("react-test-renderer");
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const auth = vi.hoisted(() => ({ admin: true }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "admin-test" }, isAdmin: auth.admin, isLoading: false, isFetchedAfterMount: true, isAuthError: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/queryClient", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/queryClient")>(), apiRequest: vi.fn(),
}));
vi.mock("@/components/ui/dialog", () => {
  const part = ({ children }: any) => createElement("section", null, children);
  return { Dialog: ({ open, children }: any) => open ? part({ children }) : null, DialogContent: part, DialogHeader: part, DialogTitle: part, DialogDescription: part, DialogFooter: part };
});
vi.mock("@/components/ui/select", () => {
  const part = ({ children }: any) => createElement("div", null, children);
  return {
    Select: ({ value, onValueChange, children, disabled }: any) => createElement("select", { value, disabled, onChange: (event: any) => onValueChange(event.target.value) }, children),
    SelectTrigger: part, SelectValue: part, SelectContent: part,
    SelectItem: ({ children, value }: any) => createElement("option", { value }, children),
  };
});
vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, disabled, onCheckedChange, ...props }: any) => createElement("input", { ...props, type: "checkbox", checked, disabled, onChange: (event: any) => onCheckedChange(event.target.checked) }),
}));

const base = "/api/rbac/job-template-drafts";
const proposal = JOB_TEMPLATE_PROPOSALS.find(item => item.key === "cashier")!;
let detail: TemplateDetail;
let seeded = false;
let stale = false;
let migration = false;
let refreshFailure = false;
let renderer: any;
let client: QueryClient;
const text = (node: any): string => typeof node === "string" ? node : (node.children ?? []).map(text).join("");
const testId = (id: string) => renderer.root.findAllByType("button").find((node: any) => node.props["data-testid"] === id);
const input = (id: string) => renderer.root.findAll((node: any) => (node.type === "input" || node.type === "textarea") && node.props.id === id)[0];
const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); }); };
const click = async (id: string) => { await act(async () => testId(id).props.onClick()); await settle(); };
const edit = async (id: string, value: string) => { await act(async () => input(id).props.onChange({ target: { value } })); };
const history = async (value: string) => {
  const select = renderer.root.findAllByType("select").find((node: any) =>
    node.findAllByType("option").some((option: any) => option.props.value === "edit"));
  await act(async () => select.props.onChange({ target: { value } }));
};
async function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  await act(async () => { renderer = create(createElement(QueryClientProvider, { client }, createElement(JobTemplateDrafts))); });
  await settle();
}
beforeEach(() => {
  auth.admin = true; seeded = false; stale = false; migration = false; refreshFailure = false;
  detail = { id: 7, versions: [
    { version: 1, content: { ...proposal, permissions: [] }, status: "draft", changeReason: "البداية", createdAt: "2026-10-02T09:00:00Z", createdBy: "admin-test" },
    { version: 2, content: proposal, status: "draft", changeReason: "إضافة اليومية", createdAt: "2026-10-02T10:00:00Z", createdBy: "admin-test" },
  ] };
  vi.stubGlobal("window", { confirm: vi.fn(() => true) });
  vi.mocked(apiRequest).mockReset().mockImplementation(async (method, url, body) => {
    if (migration) throw new HttpError(503, JSON.stringify({ error: "migration_required" }));
    if (method === "GET" && url === `${base}/catalog`) return { json: async () => ({ modules: [{ id: "cashier_journal", label: "يوميات الكاشير", actions: ["view", "create"] }], proposals: JOB_TEMPLATE_PROPOSALS }) } as Response;
    if (method === "GET" && url === base) return { json: async () => {
      const latest = detail.versions[detail.versions.length - 1];
      return seeded ? [{ id: 7, key: latest.content.key, name: latest.content.name, latestVersion: latest.version, scopeType: latest.content.scopeType, permissionCount: latest.content.permissions.reduce((sum, item) => sum + item.actions.length, 0), status: "draft" }] : [];
    } } as Response;
    if (method === "GET" && url === `${base}/7`) {
      if (refreshFailure) throw new HttpError(503, JSON.stringify({ error: "migration_required" }));
      return { json: async () => detail } as Response;
    }
    if (method === "POST" && url === `${base}/7/versions` && stale) throw new HttpError(409, JSON.stringify({ error: "stale_version" }));
    if (method === "POST" && url === `${base}/seed-proposals`) seeded = true;
    if (method === "POST" && (url === base || url === `${base}/7/versions`)) {
      const input = body as { content: typeof proposal; expectedLatestVersion?: number; changeReason?: string };
      const latest = detail.versions[detail.versions.length - 1];
      if (url !== base && input.expectedLatestVersion !== latest.version) throw new HttpError(409, "stale_version");
      const version = { version: url === base ? 1 : latest.version + 1, content: input.content, status: "draft" as const, changeReason: input.changeReason ?? "إنشاء", createdAt: "2026-10-02T11:00:00Z", createdBy: "admin-test" };
      detail = { id: 7, versions: url === base ? [version] : [...detail.versions, version] };
      seeded = true;
      return { json: async () => detail } as Response;
    }
    return { json: async () => ({ id: 7, versions: [{ version: 1, content: (body as any)?.content, status: "draft" }] }) } as Response;
  });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined; client?.clear(); vi.unstubAllGlobals();
});

describe("draft-only job templates frontend", () => {
  it("does not request or render drafts for non-admins", async () => {
    auth.admin = false; await mount();
    expect(apiRequest).not.toHaveBeenCalled();
    expect(text(renderer.toJSON())).toContain("لمسؤول النظام فقط");
  });
  it("shows a true empty state and does not seed automatically", async () => {
    await mount();
    expect(text(renderer.toJSON())).toContain("لم تُنشأ مسودات بعد");
    expect(vi.mocked(apiRequest).mock.calls.every(([method]) => method === "GET")).toBe(true);
  });
  it("creates an empty valid self-portal template using the real POST contract", async () => {
    await mount(); await click("new-job-draft");
    expect(input("draft-key").props.value).toBe("");
    expect(input("draft-name").props.value).toBe("");
    expect(input("draft-key").props.placeholder).toBeUndefined();
    await edit("draft-name", "باريستا"); await edit("draft-key", "barista");
    expect(text(renderer.toJSON())).toContain("بوابة الموظف الذاتية مستقلة");
    await click("save-job-draft");
    expect(apiRequest).toHaveBeenCalledWith("POST", base, { content: expect.objectContaining({ key: "barista", permissions: [], scopeType: "self" }) });
    expect(vi.mocked(apiRequest).mock.calls.some(([, url]) => !url.startsWith(base))).toBe(false);
  });
  it("creates blank v1, appends v2, previews v1, then returns to the latest saved work copy and appends v3", async () => {
    await mount(); await click("new-job-draft");
    await edit("draft-key", "empty_review"); await edit("draft-name", "قالب فارغ");
    await edit("draft-description", "وصف الإصدار الأول");
    await click("save-job-draft"); await click("job-draft-7");
    expect(text(renderer.toJSON())).toContain("مرجع الحفظ: الإصدار 1");
    await edit("draft-description", "وصف الإصدار الثاني");
    await edit("draft-reason", "تعديل الوصف");
    await click("save-job-draft");
    expect(text(testId("job-draft-7"))).toContain("إصدار 2");
    await click("job-draft-7");
    await history("2");
    expect(input("draft-description").props.value).toBe("وصف الإصدار الثاني");
    await history("1");
    expect(input("draft-description").props.value).toBe("وصف الإصدار الأول");
    await history("edit");
    expect(input("draft-description").props.value).toBe("وصف الإصدار الثاني");
    expect(text(renderer.toJSON())).toContain("مرجع الحفظ: الإصدار 2");
    expect(input("draft-reason").props.value).toBe("");
    await edit("draft-description", "وصف الإصدار الثالث"); await edit("draft-reason", "مراجعة ثالثة");
    await click("save-job-draft");
    expect(vi.mocked(apiRequest).mock.calls).toContainEqual(["POST", `${base}/7/versions`, expect.objectContaining({ expectedLatestVersion: 2, content: expect.objectContaining({ description: "وصف الإصدار الثالث", permissions: [] }) })]);
    expect(text(testId("job-draft-7"))).toContain("إصدار 3");
  });
  it("refreshes a clean cached work copy but never overwrites genuine unsaved edits during history preview", async () => {
    seeded = true; await mount(); await click("job-draft-7");
    detail = { ...detail, versions: [...detail.versions, { ...detail.versions[1], version: 3, content: { ...proposal, description: "أحدث وصف محفوظ" } }] };
    await act(async () => { await client.invalidateQueries({ queryKey: [`${base}/7`] }); }); await settle();
    await history("1"); await history("edit");
    expect(input("draft-description").props.value).toBe("أحدث وصف محفوظ");
    expect(text(renderer.toJSON())).toContain("مرجع الحفظ: الإصدار 3");
    await edit("draft-description", "تعديل لم يُحفظ"); await edit("draft-reason", "سبب لم يُحفظ");
    await history("1");
    detail = { ...detail, versions: [...detail.versions, { ...detail.versions[2], version: 4 }] };
    await act(async () => { await client.invalidateQueries({ queryKey: [`${base}/7`] }); }); await settle();
    await history("edit");
    expect(input("draft-description").props.value).toBe("تعديل لم يُحفظ");
    expect(input("draft-reason").props.value).toBe("سبب لم يُحفظ");
    expect(text(renderer.toJSON())).toContain("مرجع الحفظ: الإصدار 3");
  });
  it("keeps proposal keys provided by the catalog, without pre-populating the next blank draft", async () => {
    await mount(); await click("new-job-draft");
    const select = renderer.root.findAllByType("select").find((node: any) => node.props.value === undefined);
    await act(async () => select.props.onChange({ target: { value: "team_leader" } }));
    expect(input("draft-key").props.value).toBe("team_leader");
    expect(input("draft-name").props.value).toBe("تيم ليدر");
    await click("new-job-draft");
    expect(input("draft-key").props.value).toBe("");
    expect(input("draft-name").props.value).toBe("");
  });
  it("seeds only after explicit administrator confirmation", async () => {
    await mount(); await click("seed-job-proposals");
    expect(vi.mocked(apiRequest).mock.calls.every(([method]) => method === "GET")).toBe(true);
    const confirm = renderer.root.findAllByType("button").find((node: any) => text(node).includes("إضافة كمسودات فقط"));
    await act(async () => confirm.props.onClick()); await settle();
    expect(apiRequest).toHaveBeenCalledWith("POST", `${base}/seed-proposals`, {});
    expect(testId("job-draft-7")).toBeDefined();
  });
  it("inspects historical versions read-only and compares permission pairs", async () => {
    seeded = true; await mount(); await click("job-draft-7");
    expect(text(renderer.toJSON())).toContain("إضافات (2)");
    const history = renderer.root.findAllByType("select").find((node: any) => node.props.value === "edit");
    await act(async () => history.props.onChange({ target: { value: "1" } }));
    expect(renderer.root.findByType("fieldset").props.disabled).toBe(true);
    expect(renderer.root.findAllByType("input").filter((node: any) => node.props.type === "checkbox").every((node: any) => node.props.disabled)).toBe(true);
    expect(testId("save-job-draft")).toBeUndefined();
    expect(text(renderer.toJSON())).toContain("هذه نسخة تاريخية للقراءة فقط");
  });
  it("preserves unsaved edits after stale 409 and failed refresh, then retries explicitly against the latest version", async () => {
    seeded = true; stale = true; await mount(); await click("job-draft-7");
    await edit("draft-name", "كاشير للمراجعة"); await edit("draft-reason", "مراجعة الاسم");
    await click("save-job-draft");
    expect(input("draft-name").props.value).toBe("كاشير للمراجعة");
    expect(testId("save-job-draft").props.disabled).toBe(true);
    refreshFailure = true; await click("refresh-job-draft-conflict");
    expect(input("draft-name").props.value).toBe("كاشير للمراجعة");
    expect(text(renderer.toJSON())).toContain("migration_required");
    refreshFailure = false;
    detail = { ...detail, versions: [...detail.versions, { ...detail.versions[1], version: 3 }] };
    await click("refresh-job-draft-conflict");
    expect(input("draft-name").props.value).toBe("كاشير للمراجعة");
    await history("1"); await history("edit");
    expect(input("draft-name").props.value).toBe("كاشير للمراجعة");
    expect(input("draft-reason").props.value).toBe("مراجعة الاسم");
    expect(text(renderer.toJSON())).toContain("مرجع الحفظ: الإصدار 3");
    expect(testId("save-job-draft").props.disabled).toBe(false);
    stale = false; await click("save-job-draft");
    expect(apiRequest).toHaveBeenLastCalledWith("GET", base, undefined, undefined, expect.anything());
    expect(vi.mocked(apiRequest).mock.calls).toContainEqual(["POST", `${base}/7/versions`, expect.objectContaining({ expectedLatestVersion: 3, changeReason: "مراجعة الاسم", content: expect.objectContaining({ name: "كاشير للمراجعة" }) })]);
  });
  it("shows migration_required as unavailable, not an empty library", async () => {
    migration = true; await mount();
    expect(text(renderer.toJSON())).toContain("migration_required");
    expect(text(renderer.toJSON())).not.toContain("لم تُنشأ مسودات بعد");
    expect(testId("new-job-draft").props.disabled).toBe(true);
  });
  it("diffs module/action pairs, ignores order, and supports removal to empty", () => {
    expect(permissionDiff(proposal, { ...proposal, permissions: [] })).toEqual({ added: [], removed: ["cashier_journal:create", "cashier_journal:view"] });
    expect(permissionDiff(proposal, { ...proposal, permissions: [{ module: "cashier_journal", actions: ["create", "view"] }] })).toEqual({ added: [], removed: [] });
  });
});