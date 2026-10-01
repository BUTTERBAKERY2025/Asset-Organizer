import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { makeOperationsQueueItem } from "../shared/operations-center";
import { peopleJoiningHref, type OperationsPeopleRecord, type OperationsPeopleResponse } from "../shared/operations-people";
import {
  filterPeopleRecords, peopleCoverageText, peopleEmptyText, peopleHasDecision, peopleNextAction, peoplePageFacts,
  peopleReadToolHref, peopleRecordKey, peopleRequestParams, peopleScopeMatches, peopleSelectionIntent,
  peopleSourceHref, peopleStageLabel, peopleToolHref,
} from "../client/src/components/operations-center/people-workspace-model";
import {
  OperationsPeopleWorkspace, PeopleCounters, PeopleJoiningGuide, PeopleRecordDetail, PeopleSummaries, PeopleTools, peopleQueryKey,
} from "../client/src/components/operations-center/people-workspace";

const branches = [{ id: "a", name: "فرع الشرق" }, { id: "b", name: "فرع الغرب" }];
const generatedAt = "2026-10-01T10:00:00Z";
const origin = "https://bakery.example";
const leave: OperationsPeopleRecord = {
  ...makeOperationsQueueItem("leave", 7, "pending", "a", "hr_leaves", "طلب إجازة", "pending",
    "/hr/leaves?branchId=a", "مدير الفرع", null, "me"),
  domain: "leaves", employee: { id: 21, name: "الموظف المصرح", number: "E-21", jobTitle: "خباز" },
};
const advance: OperationsPeopleRecord = {
  ...makeOperationsQueueItem("advance", 8, "pending_ops", "b", "hr_advances", "طلب سلفة", "pending_ops",
    "/hr/advances?branchId=b", "مدير التشغيل"),
  domain: "advances", employee: { name: "صاحب السلفة" },
  decision: {
    awaitingActor: true, actorId: "me", label: "اعتماد التشغيل", reason: "خطوة التشغيل الحالية وصلاحية المصدر",
    href: "/hr/advances?branchId=b&advanceId=8", capability: "approve",
    permission: { module: "hr_advances", action: "approve" },
  },
};
const attendance: OperationsPeopleRecord = {
  ...makeOperationsQueueItem("attendance_record", 22, "pending", "a", "attendance", "سجل حضور معلّق", "pending",
    "/employee-attendance-report?branchId=a", "مسؤول الحضور", null, "me"),
  domain: "attendance", employee: { name: "صاحب سجل الحضور" },
};
const joining: OperationsPeopleRecord = {
  id: "joining_notification:41:signed:a", canonicalId: "joining_notification:41",
  sourceType: "joining_notification", sourceId: "41", step: "signed", branchId: "a",
  module: "operations_joining", title: "إشعار مباشرة موقّع", status: "signed", owner: "التشغيل",
  ownerId: null, dueAt: null, domain: "joining", offerId: 13, notificationId: 41,
  employee: { name: "صاحب المباشرة" }, href: peopleJoiningHref("a", 41),
  actions: [{ label: "مراجعة إشعار المباشرة", href: peopleJoiningHref("a", 41), capability: "read" }],
  decision: {
    awaitingActor: true, actorId: "me", label: "اعتماد المباشرة", reason: "مباشرة موقعة غير محجوبة تنتظر اعتماد التشغيل",
    href: peopleJoiningHref("a", 41), capability: "approve",
    permission: { module: "operations_joining", action: "approve" },
  },
};
const records = [leave, advance, attendance, joining];
const request = { branchIds: ["a", "b"], source: "all" as const, offset: 0, limit: 30 };
const response: OperationsPeopleResponse = {
  generatedAt, businessDate: "2026-10-01", scope: { ...request, requested: ["a", "b"] }, branches, records,
  summaries: [
    { source: "leaves", label: "طلبات الإجازة", value: 12, coverage: "complete", definition: "طلبات إجازة مفتوحة حاليًا" },
    { source: "advances", label: "السلف", value: 0, coverage: "complete", definition: "سلف تحتاج متابعة" },
    { source: "leave_movements", label: "حركات الإجازة", value: null, coverage: "unavailable", definition: "حركات إجازة مفتوحة" },
  ],
  employees: { value: 72, active: 70, coverage: "complete", definition: "عدد موظفي النطاق؛ ليس عدد حالات المتابعة" },
  tools: [
    { id: "directory", label: "دليل الموظفين", module: "operations_employees", branchId: "a", kind: "directory", href: "/hr-hub?tab=employees&section=directory&branchId=a" },
    { id: "joining", label: "المباشرات", module: "operations_joining", branchId: "a", kind: "workflow", href: "/hr-hub?tab=employees&section=joining&branchId=a" },
    { id: "transfers", label: "سجل النقل", module: "operations_transfers", branchId: "a", kind: "history", href: "/hr-hub?tab=employees&section=transfers&branchId=a" },
    { id: "payroll", label: "مراجعة الرواتب", module: "operations_payroll", branchId: "a", kind: "advisory", href: "/hr-hub?tab=payroll&branchId=a" },
  ],
  coverage: { total: null, nextOffset: 30, sources: {
    leaves: { state: "complete", reason: null }, advances: { state: "complete", reason: null },
    leave_movements: { state: "unavailable", reason: "تعذر تحميل حركات الإجازة" },
    attendance: { state: "complete", reason: null }, joining: { state: "complete", reason: null },
  } },
};

describe("joining source explanation and zero-case access", () => {
  const empty: OperationsPeopleResponse = { ...response, records: [],
    scope: { ...response.scope, source: "joining" }, coverage: { ...response.coverage, total: 0, nextOffset: null } };
  it("distinguishes a verified empty signing queue from filtering, missing permission, and failed loading", () => {
    expect(peopleEmptyText(empty, false)).toContain("لا توجد مباشرات موقّعة تنتظر اعتماد التشغيل");
    expect(peopleEmptyText(empty, true)).toContain("لا نتائج تطابق");
    for (const state of ["forbidden", "unavailable"] as const) {
      const missing = { ...empty, coverage: { ...empty.coverage, total: null,
        sources: { ...empty.coverage.sources, joining: { state, reason: null } } } };
      expect(peopleEmptyText(missing, false)).not.toContain("لا توجد مباشرات");
      const html = renderToStaticMarkup(React.createElement(PeopleCounters, { records: [], data: missing, actorId: "me", filtered: false }));
      expect(html).toContain("غير متاح");
      expect(html).not.toContain("<dd>0</dd>");
    }
    expect(renderToStaticMarkup(React.createElement(PeopleCounters, { records: [], data: empty, actorId: "me", filtered: false }))).toContain("<dd>0</dd>");
  });
  it("offers the full source at zero only for an explicit authorized branch and disables it during refresh", () => {
    const render = (branchId: string, data: OperationsPeopleResponse | null = empty, refreshing = false) =>
      renderToStaticMarkup(React.createElement(PeopleJoiningGuide, { data, branchId, refreshing, onOpen: vi.fn() }));
    expect(render("")).toContain("اختر فرعًا واحدًا");
    expect(render("")).not.toContain("<button");
    expect(render("a")).toContain("فتح صفحة المباشرات الكاملة للفرع");
    expect(render("a")).toContain("تشمل جميع التواريخ");
    expect(render("a", empty, true)).toContain('disabled=""');
    expect(render("b")).not.toContain("<button");
    expect(render("a", { ...empty, tools: [] })).not.toContain("<button");
    expect(render("a", null)).not.toContain("<button");
  });
});

describe("people domain independently paginated requests", () => {
  it("always supplies explicit branches and source, independently of the global queue offset", () => {
    expect(peopleRequestParams(request).toString()).toBe("branchIds=a%2Cb&source=all&offset=0&limit=30");
    expect(peopleRequestParams({ ...request, branchIds: ["b", "a", "a"], source: "attendance", offset: 240 }).toString())
      .toBe("branchIds=a%2Cb&source=attendance&offset=240&limit=30");
    const page = { ...response, scope: { ...response.scope, source: "attendance" as const, offset: 240 }, records: [attendance] };
    expect(peopleScopeMatches(page, { ...request, source: "attendance", offset: 240 })).toBe(true);
    expect(peopleScopeMatches(page, request)).toBe(false);
    for (const invalid of [
      { ...request, branchIds: [] }, { ...request, branchIds: ["all"] },
      { ...request, branchIds: ["a,b"] }, { ...request, branchIds: ["a b"] },
      { ...request, branchIds: Array.from({ length: 31 }, (_, index) => String(index)) },
      { ...request, offset: -1 }, { ...request, offset: 0.5 }, { ...request, limit: 0 }, { ...request, limit: 101 },
    ]) expect(() => peopleRequestParams(invalid)).toThrow();
  });
  it("rejects a wider cached scope, other source/page, denied case, denied tool or branch", () => {
    expect(peopleScopeMatches(response, request)).toBe(true);
    expect(peopleScopeMatches(response, { ...request, branchIds: ["a"] })).toBe(false);
    expect(peopleScopeMatches(response, { ...request, source: "advances" })).toBe(false);
    expect(peopleScopeMatches(response, { ...request, offset: 30 })).toBe(false);
    expect(peopleScopeMatches({ ...response, records: [{ ...leave, branchId: "revoked" }] }, request)).toBe(false);
    expect(peopleScopeMatches({ ...response, tools: [{ ...response.tools[0], branchId: "revoked" }] }, request)).toBe(false);
    expect(peopleScopeMatches({ ...response, branches: [...branches, { id: "revoked", name: "غير مصرح" }] }, request)).toBe(false);
  });
  it("isolates actors, selected branches, source and pagination in its cache identity", () => {
    const key = peopleQueryKey(request, "me");
    expect(key).toEqual(["/api/operations-center/people", "me", "a,b", "all", 0, 30]);
    expect(peopleQueryKey({ ...request, source: "joining" }, "me")).not.toEqual(key);
    expect(peopleQueryKey({ ...request, offset: 30 }, "me")).not.toEqual(key);
    expect(peopleQueryKey({ ...request, branchIds: ["a"] }, "me")).not.toEqual(key);
    expect(peopleQueryKey(request, "another-actor")).not.toEqual(key);
  });
});

describe("page filters, source identity and real decision facts", () => {
  it("filters loaded cases by stage, authorized employee label/number, source number, branch and owner", () => {
    expect(filterPeopleRecords(records, { stage: "pending", search: "الموظف المصرح" }, branches)).toEqual([leave]);
    expect(filterPeopleRecords(records, { stage: "all", search: "E-21" }, branches)).toEqual([leave]);
    expect(filterPeopleRecords(records, { stage: "all", search: "خباز" }, branches)).toEqual([leave]);
    expect(filterPeopleRecords(records, { stage: "all", search: "فرع الغرب" }, branches)).toEqual([advance]);
    expect(filterPeopleRecords(records, { stage: "all", search: "مسؤول الحضور" }, branches)).toEqual([attendance]);
    expect(filterPeopleRecords(records, { stage: "signed", search: "41" }, branches)).toEqual([joining]);
    expect(filterPeopleRecords(records, { stage: "pending", search: "موقّع" }, branches)).toEqual([]);
    expect(filterPeopleRecords(records, { stage: "all", search: " " }, branches)).toEqual(records);
  });
  it("never equates assignment, pending attendance, a stage or another actor with decision authority", () => {
    expect(peoplePageFacts(records, "me")).toEqual({ count: 4, awaitingActor: 2 });
    expect(peoplePageFacts(records, "other")).toEqual({ count: 4, awaitingActor: 0 });
    expect(peopleHasDecision(leave, "me")).toBe(false);
    expect(peopleHasDecision(attendance, "me")).toBe(false);
    expect(peopleHasDecision({ ...attendance, decision: joining.decision }, "me")).toBe(false);
    expect(peopleHasDecision(joining, undefined)).toBe(false);
    expect(peopleNextAction(attendance, "me")).not.toContain("اعتماد");
    expect(peopleNextAction(advance, "me")).toBe("اعتماد التشغيل");
    expect(peopleNextAction({ ...joining, decision: undefined }, "me")).toBe("مراجعة إشعار المباشرة");
  });
  it("keeps canonical identity through stage changes but never merges different persisted source types", () => {
    const changed = { ...joining, id: "joining_notification:41:approved:a", status: "approved", step: "approved" };
    expect(peopleRecordKey(changed)).toBe("joining_notification:41");
    expect(peopleRecordKey({ ...leave, sourceId: "41" })).not.toBe(peopleRecordKey(joining));
    expect(peoplePageFacts([...records, changed], "me").count).toBe(4);
    expect(peopleStageLabel("unknown_internal_stage")).not.toContain("unknown_internal_stage");
    expect(peopleStageLabel("level_2")).toBe("مرحلة مراجعة الإجازة 2");
    expect(peopleStageLabel("confirm_exit")).toBe("متابعة تأكيد الخروج");
    expect(peopleStageLabel("pre_approved")).toContain("ليست اعتمادًا نهائيًا");
    const movement = { ...leave, domain: "leave_movements" as const, status: "approved", step: "confirm_return" };
    expect(filterPeopleRecords([movement], { stage: "confirm_return", search: "العودة" }, branches)).toEqual([movement]);
    expect(filterPeopleRecords([movement], { stage: "approved", search: "" }, branches)).toEqual([]);
  });
  it("qualifies incomplete coverage and counts only page cases, not employee/source summary totals", () => {
    expect(peopleCoverageText(response)).toContain("تغطية غير مكتملة");
    const narrowed = { ...response, scope: { ...response.scope, source: "advances" as const }, records: [advance], coverage: { ...response.coverage, total: 1 } };
    expect(peopleCoverageText(narrowed)).toContain("حالات قابلة للعرض");
    const html = renderToStaticMarkup(React.createElement(PeopleCounters, { records: [attendance], data: response, actorId: "me", filtered: true }));
    expect(html).toContain("للنتائج المرشحة");
    expect(html).toContain("ليست عدد الموظفين");
    expect(html).not.toContain(">72<");
    expect(html).not.toContain(">12<");
  });
});

describe("strict canonical people source navigation", () => {
  it("preserves the exact source receiver and stable canonical selection before current go", () => {
    for (const record of records) {
      const destination = peopleSourceHref(record, "me", origin);
      expect(destination.href).not.toBeNull();
      const url = new URL(destination.href!, origin);
      expect(url.searchParams.get("branchId")).toBe(record.branchId);
      expect(url.searchParams.get("centerWorkspace")).toBe("people");
      expect(url.searchParams.get("centerPeopleBranchId")).toBe(record.branchId);
      expect(url.searchParams.get("centerPeopleRecord")).toBe(peopleRecordKey(record));
    }
    expect(peopleSourceHref(joining, "me", origin).href).toContain("tab=employees&section=joining");
    expect(peopleSourceHref(joining, "me", origin).href).toContain("notificationId=41");
    expect(peopleSourceHref(joining, "me", origin)).toMatchObject({ decision: true, label: "اعتماد المباشرة في المصدر" });
    expect(peopleSourceHref(joining, "other", origin)).toMatchObject({ decision: false, label: "فتح السجل للمتابعة في المصدر" });
  });
  it("fails closed on other routes, conflicting branch/ID, duplicate selectors, unsafe IDs and arbitrary parameters", () => {
    for (const href of [
      "/hr/leaves?branchId=a&leaveId=8", "/hr/leaves?branchId=b&leaveId=7",
      "/hr/leaves?branchId=a&branchId=a&leaveId=7", "/hr/leaves?branchId=a&leaveId=7&leaveId=7",
      "/hr/leaves?leaveId=7", "/hr/advances?branchId=a&leaveId=7",
      "/hr/leaves?branchId=a&leaveId=7&redirect=/admin", "/hr/leaves?branchId=a&leaveId=7#edit",
      "https://evil.example/hr/leaves?branchId=a&leaveId=7",
    ]) expect(peopleSourceHref({ ...leave, href }, "me", origin).href).toBeNull();
    expect(peopleSourceHref({ ...leave, sourceId: "9007199254740992" }, "me", origin).href).toBeNull();
    expect(peopleSourceHref({ ...joining, decision: undefined, href: "/hr-hub?tab=joining&branchId=a&notificationId=41" }, "me", origin).href).toBeNull();
    expect(peopleSourceHref({ ...joining, decision: { ...joining.decision!, href: "/hr-hub?tab=employees&section=joining&branchId=a&notificationId=42" } }, "me", origin).href).toBeNull();
    expect(peopleSourceHref({ ...joining, decision: undefined, href: `${joining.href}&offerId=14` }, "me", origin).href).toBeNull();
    expect(peopleSourceHref({ ...joining, decision: undefined, href: `${joining.href}&offerId=13` }, "me", origin).href).not.toBeNull();
  });
  it("retains exact current-day attendance receiver filters without permitting stale or conflicting dates", () => {
    const record = { ...attendance, href: attendance.href + "&startDate=2026-10-01&endDate=2026-10-01" };
    expect(peopleSourceHref(record, "me", origin, "2026-10-01").href).toContain("startDate=2026-10-01&endDate=2026-10-01");
    expect(peopleSourceHref(record, "me", origin, "2026-10-02").href).toBeNull();
    expect(peopleSourceHref({ ...record, href: attendance.href + "&startDate=2026-10-01&endDate=2026-10-02" }, "me", origin).href).toBeNull();
    expect(peopleSourceHref({ ...record, href: attendance.href + "&startDate=2026-02-30&endDate=2026-02-30" }, "me", origin).href).toBeNull();
    expect(peopleSourceHref({ ...record, href: record.href + "&startDate=2026-10-01" }, "me", origin).href).toBeNull();
    expect(peopleSourceHref({ ...leave, href: leave.href + "&startDate=2026-10-01&endDate=2026-10-01" }, "me", origin).href).toBeNull();
  });
  it("restores only unambiguous, allowed people intent and never treats status as identity", () => {
    expect(peopleSelectionIntent("?workspace=people&peopleBranchId=a&peopleRecord=joining_notification:41", ["a", "b"]))
      .toEqual({ branchId: "a", source: "joining", record: "joining_notification:41", valid: true });
    expect(peopleSelectionIntent("?workspace=people&peopleBranchId=a", ["a"])).toEqual({ branchId: "a", source: "all", record: null, valid: true });
    // The same leave identity may now represent an approved exit/return movement.
    expect(peopleSelectionIntent("?workspace=people&peopleBranchId=a&peopleRecord=leave:7", ["a"]).source).toBe("all");
    for (const search of [
      "?workspace=people&peopleBranchId=revoked&peopleRecord=leave:7",
      "?workspace=people&peopleBranchId=a&peopleRecord=leave:7:pending",
      "?workspace=people&peopleBranchId=a&peopleRecord=leave:0",
      "?workspace=people&peopleBranchId=a&peopleRecord=leave:9007199254740992",
      "?workspace=people&peopleBranchId=a&peopleRecord=leave:7&peopleRecord=advance:8",
      "?workspace=people&peopleBranchId=a&peopleBranchId=a&peopleRecord=leave:7",
      "?workspace=people&workspace=people&peopleBranchId=a&peopleRecord=leave:7",
      "?workspace=analysis&peopleBranchId=a&peopleRecord=leave:7",
    ]) expect(peopleSelectionIntent(search, ["a"]).record).toBeNull();
  });
  it("preserves invalid return scope instead of silently turning it into an all-branches request", () => {
    for (const search of [
      "?workspace=people&peopleBranchId=revoked",
      "?workspace=people&peopleBranchId=__invalid_scope__",
      "?workspace=people&peopleBranchId=all",
      "?workspace=people&peopleBranchId=",
      "?workspace=people&peopleBranchId=a&peopleBranchId=a",
      "?workspace=people&peopleBranchId=a&peopleRecord=leave:7&peopleRecord=leave:7",
      "?workspace=people&workspace=people&peopleBranchId=a",
      "?workspace=people&branchIds=a&peopleBranchId=b",
      "?workspace=people&branchIds=revoked&peopleBranchId=a",
      "?workspace=people&branchIds=a,a&peopleBranchId=a",
      "?workspace=people&peopleRecord=leave:7",
    ]) expect(peopleSelectionIntent(search, ["a", "b"])).toMatchObject({ valid: false, record: null });
    expect(peopleSelectionIntent("?workspace=people&branchIds=a,b", ["a", "b"]).valid).toBe(true);
    expect(peopleSelectionIntent("", ["a", "b"]).valid).toBe(true);
  });
  it("renders actual source/employee/stage/owner and read-only attendance caveats without an inline approval", () => {
    const html = renderToStaticMarkup(React.createElement(PeopleRecordDetail, { record: attendance, branches, actorId: "me", refreshing: true, onOpen: vi.fn() }));
    expect(html).toContain("#22");
    expect(html).toContain("صاحب سجل الحضور");
    expect(html).not.toContain("الجهة المسؤولة");
    expect(html).toContain("السجل المعلّق لا يعني الغياب");
    expect(html).not.toContain("الموعد المسجل");
    expect(html).not.toContain("الإسناد الفردي");
    expect(html).toContain("وقت الدخول");
    expect(html).toContain("لم يُسجل خروج بعد");
    expect(html).toContain("عرض سجل الحضور");
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("بانتظار قرارك وفق");
    expect(html).not.toContain("اعتماد وإكمال");
    const decisionHtml = renderToStaticMarkup(React.createElement(PeopleRecordDetail, { record: advance, branches, actorId: "me", refreshing: false, onOpen: vi.fn() }));
    expect(decisionHtml).toContain("بانتظار قرارك وفق صلاحية الحالة الحالية");
    expect(decisionHtml).toContain("اعتماد التشغيل في المصدر");
  });
});

describe("actual attendance detail", () => {
  it("renders linked employee number and recorded times instead of task placeholders", () => {
    const html = renderToStaticMarkup(React.createElement(PeopleRecordDetail, {
      record: { ...attendance, employee: { id: 5, name: "Test", number: "MED-005" },
        attendance: { date: "2026-10-01", checkIn: "08:05:00", checkOut: "16:15:00" } },
      branches, actorId: "me", refreshing: false, onOpen: vi.fn(),
    }));
    for (const value of ["MED-005", "2026-10-01", "08:05:00", "16:15:00"]) expect(html).toContain(value);
    expect(html).not.toContain("غير مسجل في المصدر");
    expect(html).not.toContain("الإسناد الفردي");
  });
});

describe("zero-case tools, source summaries and intentional payroll month", () => {
  it("uses only branch-matching server tools and canonical HR sections, never an employee edit URL", () => {
    for (const tool of response.tools) {
      const href = peopleToolHref(tool, "a", "2026-09", origin);
      expect(href).not.toBeNull();
      expect(new URL(href!, origin).searchParams.get("centerPeopleBranchId")).toBe("a");
      expect(peopleToolHref(tool, "b", "2026-09", origin)).toBeNull();
      expect(peopleToolHref(tool, "", "2026-09", origin)).toBeNull();
      expect(peopleToolHref({ ...tool, href: tool.href + "&employeeId=21" }, "a", "2026-09", origin)).toBeNull();
    }
    expect(peopleToolHref(response.tools[2], "a", "", origin)).toContain("section=transfers");
    const payroll = response.tools[3];
    expect(peopleToolHref(payroll, "a", "", origin)).toBeNull();
    expect(peopleToolHref(payroll, "a", "2026-13", origin)).toBeNull();
    expect(peopleToolHref(payroll, "a", "2026-09", origin)).toContain("month=2026-09");
    expect(peopleToolHref({ ...payroll, href: payroll.href + "&month=2026-10" }, "a", "2026-09", origin)).toBeNull();
  });
  it("keeps attendance/leaves/advances reachable even at zero but never enables unavailable or aggregate tools", () => {
    expect(peopleReadToolHref("advances", "a", { ...response, records: [] }, origin)).toContain("/hr/advances?");
    expect(peopleReadToolHref("attendance", "a", response, origin)).toContain("/employee-attendance-report?");
    expect(peopleReadToolHref("leaves", "", response, origin)).toBeNull();
    expect(peopleReadToolHref("leaves", "all", response, origin)).toBeNull();
    expect(peopleReadToolHref("leaves", "revoked", response, origin)).toBeNull();
    const denied = { ...response, coverage: { ...response.coverage, sources: { ...response.coverage.sources, advances: { state: "forbidden" as const, reason: "لا صلاحية" } } } };
    expect(peopleReadToolHref("advances", "a", denied, origin)).toBeNull();
    const html = renderToStaticMarkup(React.createElement(PeopleTools, { data: denied, branchId: "a", month: "", onMonth: vi.fn(), refreshing: false, onOpen: vi.fn() }));
    expect(html).toContain("السلف · غير متاح");
    expect(html).toContain("شهر الرواتب · اختيار صريح");
    expect(html).toContain("النقل سجل حركة وليس قائمة مهام");
    expect(html).toContain("لن يُرسل شهر افتراضي");
    const allHtml = renderToStaticMarkup(React.createElement(PeopleTools, { data: response, branchId: "", month: "", onMonth: vi.fn(), refreshing: false, onOpen: vi.fn() }));
    expect(allHtml).toContain("اختر فرعًا واحدًا صراحةً");
    expect(allHtml).not.toContain('type="month"');
  });
  it("collapses summaries and distinguishes genuine zero, unavailable and employee aggregate", () => {
    const html = renderToStaticMarkup(React.createElement(PeopleSummaries, { data: response }));
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
    expect(html).toContain("ليست حالات عمل");
    expect(html).toContain(">0</b>");
    expect(html).toContain("غير متاح");
    expect(html).toContain("ليس صفرًا");
    expect(html).toContain("الموظفون في النطاق:");
    expect(html).toContain("لا تُجمع");
    expect(html).not.toContain("72 حالات");
  });
});

describe("people workspace cached security, integration and responsive bounds", () => {
  const renderWorkspace = (client: QueryClient, actorId = "me") => renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
    React.createElement(OperationsPeopleWorkspace, { branches, actorId, open: vi.fn() })));
  it("renders its own endpoint results and all sources without a network or source write", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(peopleQueryKey(request, "me"), response);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const html = renderWorkspace(client);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect(html).toContain('data-testid="operations-people-workspace"');
    expect(html).toContain('value="leave_movements"');
    expect(html).toContain('value="attendance"');
    expect(html).toContain('value="joining"');
    expect(html).toContain("المرحلة · في الصفحة");
    expect(html).toContain("قبل ترقيم الصفحات");
    expect(html).toContain("أعمال مفتوحة حاليًا");
    expect(html).toContain("ليس إثبات غياب ولا طلب اعتماد");
    expect(html).toContain("الموظف المصرح");
    expect(html).toContain("#41");
    expect(html).toContain("العودة للحالات والمرشحات");
    expect(html).toContain('aria-label="صفحات حالات الموظفين"');
    client.clear();
  });
  it("hides a contradictory cached case for a source whose returned coverage is now forbidden", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const denied = { ...response, coverage: { ...response.coverage, sources: {
      ...response.coverage.sources, leaves: { state: "forbidden" as const, reason: "سحبت صلاحية الإجازة" },
    } } };
    client.setQueryData(peopleQueryKey(request, "me"), denied);
    const html = renderWorkspace(client);
    expect(html).not.toContain("الموظف المصرح");
    expect(html).toContain("أخفيت بيانات سابقة لا تطابق");
    expect(html).toContain("أخفيت التفاصيل والإجراء السابق");
    client.clear();
  });
  it("hides cached successful data and tools after a revoked-authority/refetch error", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = peopleQueryKey(request, "me");
    client.setQueryData(key, response);
    client.getQueryCache().find({ queryKey: key, exact: true })!.setState({
      status: "error", error: new Error("سُحبت صلاحية المصدر"), fetchStatus: "idle",
    });
    const html = renderWorkspace(client);
    expect(html).toContain("سُحبت صلاحية المصدر");
    expect(html).toContain("أخفيت التفاصيل والإجراء السابق");
    expect(html).toContain("إعادة المحاولة");
    expect(html).not.toContain("الموظف المصرح");
    expect(html).not.toContain("صاحب المباشرة");
    expect(html).not.toContain("ملخصات المصادر والموظفين ·");
    expect(html).not.toContain("أدوات الفرع ·");
    client.clear();
  });
  it("never renders another actor's cached cases or a wider response for a narrower current query", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(peopleQueryKey(request, "other"), response);
    expect(renderWorkspace(client)).not.toContain("الموظف المصرح");
    client.setQueryData(peopleQueryKey(request, "me"), { ...response, scope: { ...response.scope, branchIds: ["a", "b", "revoked"] } });
    expect(renderWorkspace(client)).not.toContain("الموظف المصرح");
    client.clear();
  });
  it("uses one existing window, independent pagination and current clicked state without modal stacking or mutations", () => {
    const source = readFileSync("client/src/components/operations-center/people-workspace.tsx", "utf8");
    const board = readFileSync("client/src/components/operations-center/decision-board.tsx", "utf8");
    expect(board).toContain('view === "people" ? <OperationsPeopleWorkspace');
    expect(source).not.toContain("data.queue");
    expect(source).not.toContain("onOffset");
    expect(source).not.toContain("useMutation");
    expect(source).not.toContain("Dialog");
    expect(source).not.toMatch(/method:\s*["'](POST|PUT|PATCH|DELETE)/);
    expect(source).toContain("client.getQueryState<OperationsPeopleResponse>");
    expect(source).toContain('state?.status === "success" && state.fetchStatus === "idle"');
    expect(source).toContain("open(destination.href, clicked.branchId, clicked, () => intentCommands.isCurrent(token))");
    expect(source).toContain("open(href, branchId, undefined, () => intentCommands.isCurrent(token))");
    expect(source).toContain("intentCommands.invalidate(); change();");
    expect(source).toContain("enabled: intentValid &&");
    expect(source).toContain("useOperationsPeopleQuery(request, actorId, intentValid)");
    expect(source).toContain("الحالة المحددة لم تعد ضمن نتائج هذه الصفحة");
    expect(source).toContain("هذا ليس تأكيدًا لإكمالها");
    expect(source).toContain("query.isError");
    expect(source).toContain("refetchInterval: false");
    expect(source).toContain("placeholderData: undefined");
  });
  it("bounds desktop columns and mobile content to min-width zero and keeps a real list-back path", () => {
    const css = readFileSync("client/src/components/operations-center/decision-board.css", "utf8");
    expect(css).toContain(".oc-people-workspace {min-width:0;max-width:100%;grid-template-columns:minmax(0,43%) minmax(0,1fr)}");
    expect(css).toContain(".oc-people-record {min-width:0;max-width:100%;overflow-wrap:anywhere;box-sizing:border-box}");
    expect(css).toContain(".oc-people-workspace .oc-workspace-detail {overflow-x:hidden}");
    expect(css).toContain("@media(max-width:767px){.oc-people-workspace");
    expect(css).toContain(".oc-people-filters{grid-template-columns:minmax(0,1fr)}");
    expect(css).toContain('[data-detail="true"] .oc-workspace-list');
    expect(css).toContain('[data-detail="false"] .oc-workspace-detail');
    expect(css).toContain(".oc-people-tools-grid{grid-template-columns:minmax(0,1fr)}");
    expect(css).toContain("white-space:normal;text-align:right");
  });
});

describe("mounted People return denial and local asynchronous intent guards", () => {
  // React-only rendering: no browser, app workflow, source mutations or credentials.
  const rendererPackage = "react-test-renderer";
  const mounted = async (search: string) => {
    const renderer: any = await import(rendererPackage);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("window", { location: new URL(`/operations-center${search}`, origin),
      addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // A prior all-branch success must never rescue a denied return intent.
    client.setQueryData(peopleQueryKey(request, "me"), response);
    const fetchSource = vi.fn(async (input: string | URL | Request) => {
      const params = new URL(String(input), origin).searchParams;
      const ids = (params.get("branchIds") || "").split(",");
      const source = params.get("source") || "all";
      return Response.json({ ...response,
        scope: { branchIds: ids, requested: ids, source, offset: Number(params.get("offset")), limit: Number(params.get("limit")) },
        branches: branches.filter(branch => ids.includes(branch.id)),
        records: records.filter(record => ids.includes(record.branchId) && (source === "all" || record.domain === source)),
        tools: response.tools.filter(tool => ids.includes(tool.branchId)),
      });
    });
    vi.stubGlobal("fetch", fetchSource);
    const open = vi.fn();
    let root: any;
    const flush = async () => renderer.act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
    try {
      await renderer.act(async () => { root = renderer.create(React.createElement(QueryClientProvider, { client },
        React.createElement(OperationsPeopleWorkspace, { branches, actorId: "me", open }))); });
      await flush();
    } catch (error) {
      if (root) await renderer.act(async () => root.unmount());
      client.clear(); vi.unstubAllGlobals(); throw error;
    }
    const close = async () => {
      await renderer.act(async () => root.unmount());
      client.clear(); vi.unstubAllGlobals();
    };
    const event = async (change: () => void) => { await renderer.act(async () => change()); await flush(); };
    const text = (node: any): string => typeof node === "string" ? node : (node.children || []).map(text).join("");
    const caseButton = (id: string) => root.root.findAllByType("button").find((node: any) =>
      String(node.props.className).includes("oc-people-case") &&
      node.findAllByType("bdi").some((value: any) => value.children.join("") === `#${id}`));
    const captureCaseGuard = async () => {
      await event(() => caseButton("7").props.onClick());
      const button = root.root.findAllByType("button").find((node: any) => String(node.props.className).includes("oc-people-source-action"));
      expect(button.props.disabled).toBe(false);
      await event(() => button.props.onClick());
      const args = open.mock.calls.at(-1)!;
      expect(args[2].sourceId).toBe("7");
      expect(typeof args[3]).toBe("function");
      expect(args[3]()).toBe(true);
      return args[3] as () => boolean;
    };
    return { renderer, client, root, open, fetchSource, close, event, text, caseButton, captureCaseGuard };
  };

  it.each([
    "?workspace=people&peopleBranchId=revoked",
    "?workspace=people&peopleBranchId=__invalid_scope__",
    "?workspace=people&peopleBranchId=a&peopleBranchId=a",
    "?workspace=people&branchIds=a&peopleBranchId=b",
  ])("disables the real query observer and hides cached cases/tools for %s", async search => {
    const state = await mounted(search);
    try {
      expect(state.fetchSource).not.toHaveBeenCalled();
      const html = JSON.stringify(state.root.toJSON());
      expect(html).toContain("نطاق العودة إلى الموظفين غير صالح");
      expect(html).toContain("لم يُوسّع النطاق إلى كل الفروع");
      expect(html).not.toContain("الموظف المصرح");
      expect(html).not.toContain("أدوات الفرع");
      expect(state.open).not.toHaveBeenCalled();
      const observers = state.client.getQueryCache().getAll().filter(query => query.getObserversCount() > 0);
      expect(observers).toHaveLength(1);
      expect(observers[0].isDisabled()).toBe(true);
      expect(observers[0].queryKey[2]).toBe("");
    } finally { await state.close(); }
  });

  it("passes a fourth guard that rejects batched A→B→A changes to record, branch, source and page-local filters", async () => {
    const state = await mounted("?workspace=people&peopleBranchId=a&peopleRecord=leave:7");
    try {
      for (const label of ["record", "branch", "source", "stage", "search"]) {
        const guard = await state.captureCaseGuard();
        await state.event(() => {
          if (label === "record") {
            state.caseButton("22").props.onClick(); state.caseButton("7").props.onClick();
          } else {
            const aria = label === "branch" ? "فرع متابعة الموظفين" : label === "source" ? "مصدر متابعة الموظفين"
              : label === "stage" ? "مرحلة حالات الموظفين في الصفحة" : "بحث في صفحة حالات الموظفين";
            const control = state.root.root.findByProps({ "aria-label": aria });
            const first = label === "branch" ? "b" : label === "source" ? "attendance" : label === "stage" ? "pending" : "بحث مختلف";
            const restored = label === "branch" ? "a" : label === "search" ? "" : "all";
            control.props.onChange({ target: { value: first } });
            control.props.onChange({ target: { value: restored } });
          }
        });
        expect(guard(), label).toBe(false);
      }
      // Batched filters finish at the same visible values; generation, not equality, rejects the old callback.
      expect(state.root.root.findByProps({ "aria-label": "فرع متابعة الموظفين" }).props.value).toBe("a");
      expect(state.root.root.findByProps({ "aria-label": "مصدر متابعة الموظفين" }).props.value).toBe("all");
    } finally { await state.close(); }
  });

  it("rejects a pending case callback when pagination returns to the original page", async () => {
    const state = await mounted("?workspace=people&peopleBranchId=a&peopleRecord=leave:7");
    try {
      const guard = await state.captureCaseGuard();
      const nav = () => state.root.root.findByProps({ "aria-label": "صفحات حالات الموظفين" });
      expect(nav().findAllByType("button")[1].props.disabled).toBe(false);
      await state.event(() => nav().findAllByType("button")[1].props.onClick());
      expect(nav().findAllByType("button")[0].props.disabled).toBe(false);
      await state.event(() => nav().findAllByType("button")[0].props.onClick());
      expect(guard()).toBe(false);
      expect(state.fetchSource.mock.calls.map(([input]) => new URL(String(input), origin).searchParams.get("offset"))).toContain("30");
      expect(state.fetchSource.mock.calls.at(-1)![0]).toContain("offset=0");
    } finally { await state.close(); }
  });

  it("disables and explicitly denies a selected branch revoked after mounting rather than fetching remaining branches", async () => {
    const state = await mounted("?workspace=people&peopleBranchId=a&peopleRecord=leave:7");
    try {
      const guard = await state.captureCaseGuard();
      const reads = state.fetchSource.mock.calls.length;
      await state.event(() => state.root.update(React.createElement(QueryClientProvider, { client: state.client },
        React.createElement(OperationsPeopleWorkspace, { branches: [branches[1]], actorId: "me", open: state.open }))));
      expect(guard()).toBe(false);
      expect(state.fetchSource).toHaveBeenCalledTimes(reads);
      const html = JSON.stringify(state.root.toJSON());
      expect(html).toContain("نطاق العودة إلى الموظفين غير صالح");
      expect(html).not.toContain("الموظف المصرح");
      expect(html).not.toContain("أدوات الفرع");
      const observer = state.client.getQueryCache().getAll().find(query => query.getObserversCount() > 0)!;
      expect(observer.isDisabled()).toBe(true);
      expect(observer.queryKey[2]).toBe("");
    } finally { await state.close(); }
  });

  it("guards branch tools too, including intentional payroll-month ABA and workspace unmount", async () => {
    const state = await mounted("?workspace=people&peopleBranchId=a");
    let guard: () => boolean;
    try {
      const month = state.root.root.findByProps({ "aria-label": "شهر الرواتب لأداة الفرع" });
      await state.event(() => month.props.onChange({ target: { value: "2026-09" } }));
      const clickPayroll = async () => {
        const button = state.root.root.findAllByType("button").find((node: any) => state.text(node).includes("مراجعة الرواتب"));
        expect(button.props.disabled).toBe(false);
        await state.event(() => button.props.onClick());
        const args = state.open.mock.calls.at(-1)!;
        expect(args[0]).toContain("month=2026-09");
        expect(args[2]).toBeUndefined();
        expect(typeof args[3]).toBe("function");
        return args[3] as () => boolean;
      };
      guard = await clickPayroll();
      expect(guard()).toBe(true);
      await state.event(() => {
        month.props.onChange({ target: { value: "2026-10" } });
        month.props.onChange({ target: { value: "2026-09" } });
      });
      expect(guard()).toBe(false);
      guard = await clickPayroll();
      expect(guard()).toBe(true);
    } finally { await state.close(); }
    expect(guard!()).toBe(false);
  });
});