import type { Request } from "express";
import {
  operationsPeopleSources, peopleJoiningHref, peoplePagePlan,
  type OperationsPeopleRecord, type OperationsPeopleResponse, type OperationsPeopleSource,
} from "@shared/operations-people";
import { makeOperationsQueueItem, operationsDecisionMetadata } from "@shared/operations-center";
import { getAllowedBranchIds, HR_SPECIALIST_PERMISSIONS } from "./auth";
import { hasAuthoritativePermission } from "./branch-operations";
import { pool } from "./db";
import { resolveReviewerJobTitle } from "./leave-helpers";
import {
  operationsPeopleSql, peopleAdvanceAuthority, peopleBranchAllowed, peopleLeaveReviewer, peopleSourceEnabled, peopleTools,
  type PeopleActor, type PeopleGrants,
} from "./operations-people-predicates";

export type PeopleRow = {
  id: number; branch_id: string; status: string; current_level?: number; approval_chain?: unknown;
  exit_confirmed_at?: Date | string | null; return_confirmed_at?: Date | string | null;
  approved_at?: Date | string | null; employee_id?: number | null;
  employee_name?: string | null; employee_number?: string | null; job_title?: string | null; offer_id?: number;
  attendance_date?: string | null; actual_check_in?: string | null; actual_check_out?: string | null;
};
const descriptions: Record<OperationsPeopleSource, { label: string; definition: string }> = {
  leaves: { label: "طلبات إجازة معلقة", definition: "جميع طلبات الإجازة pending ضمن الفروع المحددة؛ القرار حسب سلسلة الاعتماد الحالية وسلطة المراجع." },
  leave_movements: { label: "متابعة خروج وعودة الإجازة", definition: "إجازات approved بلا تأكيد عودة بدأت بلا تأكيد خروج مسجل، أو انتهت بعد خروج مؤكد؛ ليست إثبات غياب أو تأخر." },
  advances: { label: "طلبات سلف مفتوحة", definition: "طلبات pending/pre_approved/awaiting_signature/signed؛ المبدئي منفصل عن مراجعة الموارد والتوقيع والاعتماد النهائي." },
  attendance: { label: "سجلات حضور اليوم للمتابعة", definition: "سجلات اليوم بلا توقيت اعتماد محفوظ؛ للعرض والمتابعة فقط، وليست طلبات اعتماد أو دليلاً على الغياب." },
  joining: { label: "مباشرات موقعة بانتظار اعتماد التشغيل", definition: "إشعارات signed بتوقيع مسجل وعرض accepted في الفرع نفسه بلا تأكيد أو تحويل أو حظر؛ ليست جميع عروض التوظيف." },
};

/** Real middleware, not role aliases, cached cross-request grants, or inferred HR access. */
export async function peopleGrants(req: Request): Promise<PeopleGrants> {
  const has = (module: string, action = "view") => hasAuthoritativePermission(req, module, action);
  const [leavesView, leavesApprove, leavesCreate, advancesView, advancesApprove, advancesEdit,
    attendanceView, attendanceEdit, operationsHr, joiningView, joiningApprove, transfersView, payrollView] = await Promise.all([
    has("hr_leaves"), has("hr_leaves", "approve"), has("hr_leaves", "create"),
    has("hr_advances"), has("hr_advances", "approve"), has("hr_advances", "edit"),
    has("attendance"), has("attendance", "edit"), has("operations_hr"),
    has("operations_joining"), has("operations_joining", "approve"),
    has("operations_employee_transfer"), has("operations_payroll"),
  ]);
  return { leavesView, leavesApprove, leavesCreate, advancesView, advancesApprove, advancesEdit,
    attendanceView, attendanceEdit, operationsHr, joiningView, joiningApprove, transfersView, payrollView,
    specialistEditConfigured: (HR_SPECIALIST_PERMISSIONS.hr_advances || []).includes("edit") };
}

export function projectPeopleRecord(domain: OperationsPeopleSource, row: PeopleRow, actor: PeopleActor,
  grants: PeopleGrants, businessDate: string): OperationsPeopleRecord {
  if (!operationsPeopleSources.includes(domain)) throw new Error("Unknown people source");
  let item: OperationsPeopleRecord;
  if (domain === "joining") {
    if (!row.offer_id) throw new Error("Joining offer identity missing");
    const href = peopleJoiningHref(row.branch_id, row.id);
    item = {
      id: `joining_notification:${row.id}:signed:${row.branch_id}`, canonicalId: `joining_notification:${row.id}`,
      sourceType: "joining_notification", sourceId: String(row.id), step: "signed", domain, branchId: row.branch_id,
      module: "operations_joining", title: "مباشرة موقعة تنتظر اعتماد التشغيل", status: row.status,
      owner: "مدير التشغيل المخول", ownerId: null, dueAt: null, href,
      offerId: row.offer_id, notificationId: row.id, actions: [{ label: "عرض إشعار المباشرة", href, capability: "read" }],
      reason: "توقيع المباشرة مسجل والعرض مقبول في الفرع نفسه؛ لم يسجل تأكيد التشغيل أو التحويل",
    };
    item.decision = operationsDecisionMetadata(item, actor.id,
      actor.role === "operations_manager" && actor.allowed?.includes(row.branch_id) === true
        && grants.operationsHr && grants.joiningView && grants.joiningApprove,
      row.status === "signed", { module: "operations_joining", action: "approve" }, "مراجعة واعتماد المباشرة");
  } else {
    const sourceType = domain === "advances" ? "advance" : domain === "attendance" ? "attendance_record" : "leave";
    const module = domain === "advances" ? "hr_advances" : domain === "attendance" ? "attendance" : "hr_leaves";
    const stage = domain === "leaves" ? `level_${row.current_level}`
      : domain === "leave_movements" ? row.exit_confirmed_at ? "confirm_return" : "confirm_exit"
      : domain === "attendance" ? "attendance_review" : row.status;
    const path = domain === "advances" ? "/hr/advances" : domain === "attendance" ? "/employee-attendance-report" : "/hr/leaves";
    const query = new URLSearchParams({ branchId: row.branch_id,
      ...(domain === "attendance" ? { startDate: businessDate, endDate: businessDate } : {}) });
    item = { ...makeOperationsQueueItem(sourceType, row.id, stage, row.branch_id, module,
      descriptions[domain].label, row.status, `${path}?${query}`), domain };
    if (domain === "leaves") {
      const reviewer = peopleLeaveReviewer(row.current_level!, row.approval_chain, actor);
      item.owner = reviewer.owner;
      item.decision = operationsDecisionMetadata(item, actor.id, grants.leavesApprove, row.status === "pending" && reviewer.matches,
        { module, action: "approve" }, "مراجعة قرار الإجازة في المصدر");
    } else if (domain === "advances") {
      const authority = peopleAdvanceAuthority(row.status, actor, grants);
      item.owner = row.status === "awaiting_signature" ? "الموظف" : row.status === "pending" ? "المراجع المبدئي المخول" : "شؤون الموظفين";
      item.decision = operationsDecisionMetadata(item, actor.id, authority.eligible, true,
        { module, action: authority.action }, !authority.final ? "موافقة أولية فقط"
          : row.status === "signed" ? "مراجعة الاعتماد النهائي بعد التوقيع" : "مراجعة السلفة وإرسالها للتوقيع");
      if (item.decision) {
        item.decision.capability = authority.final && row.status !== "signed" ? "review" : "approve";
        item.decision.reason = !authority.final ? "الطلب pending وصلاحيتك مبدئية فقط؛ ليست اعتماداً نهائياً"
          : row.status === "signed" ? "الطلب signed وسلطة الاعتماد النهائي محصورة بدور الموارد المخول"
          : "مراجعة شروط السلفة وإرسالها للتوقيع قبل الاعتماد النهائي";
      }
    } else if (domain === "attendance") {
      item.reason = "متابعة سجل الحضور فقط؛ عدم وجود توقيت اعتماد لا يعني وجود طلب اعتماد مطلوب منك.";
      item.actions = [{ label: "عرض سجل الحضور", href: item.href, capability: "read" }];
      item.attendance = { date: row.attendance_date ?? null,
        checkIn: row.actual_check_in ?? null, checkOut: row.actual_check_out ?? null };
    } else {
      item.owner = "مسجل حركة الإجازة المخول";
      item.reason = stage === "confirm_exit" ? "بدأ موعد الإجازة ولا يوجد تأكيد خروج مسجل؛ ليس إثبات غياب"
        : "يوجد خروج مؤكد وانتهى الموعد ولا يوجد تأكيد عودة مسجل؛ ليست عودة متأخرة مثبتة";
      // Source movement handlers require create, not approve; this is follow-up, never an approval decision.
      if (grants.leavesCreate) item.actions = [{ label: stage === "confirm_exit" ? "مراجعة تسجيل الخروج في المصدر" : "مراجعة تسجيل العودة في المصدر",
        href: item.href, capability: "read" }];
    }
  }
  if (row.employee_name) item.employee = {
    ...(row.employee_id != null ? { id: row.employee_id } : {}),
    name: row.employee_name,
    number: row.employee_number ?? null,
    ...(row.job_title !== undefined ? { jobTitle: row.job_title } : {}),
  };
  return item;
}

function countValue(value: string) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error("Invalid source cardinality");
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid source cardinality");
  return count;
}

/** Read-only focused domain: exact SQL active filters/counts before pagination. */
export async function projectOperationsPeople(req: Request, requested: string[], source: OperationsPeopleSource | "all",
  offset = 0, limit = 50): Promise<OperationsPeopleResponse> {
  if (!requested.length || requested.length > 30 || requested.some(id => !id || id.toLowerCase() === "all")
      || new Set(requested).size !== requested.length || !Number.isSafeInteger(offset) || offset < 0
      || !Number.isSafeInteger(limit) || limit < 1 || limit > 100
      || source !== "all" && !operationsPeopleSources.includes(source))
    throw Object.assign(new Error("Invalid people query"), { status: 400 });
  const allowed = getAllowedBranchIds(req);
  if (requested.some(id => !peopleBranchAllowed(id) || allowed !== null && !allowed.includes(id)))
    throw Object.assign(new Error("Branch scope denied"), { status: 403 });
  const branchRows = (await pool.query<{ id: string; name: string }>(
    "SELECT id,name FROM branches WHERE id=ANY($1::varchar[]) ORDER BY id", [requested])).rows;
  if (branchRows.length !== requested.length || requested.some(id => !branchRows.some(row => row.id === id)))
    throw Object.assign(new Error("Branch scope denied or branch does not exist"), { status: 403 });
  const actor: PeopleActor = { id: req.currentUser!.id, role: req.currentUser!.role, allowed };
  const grants = await peopleGrants(req);
  const now = new Date(), generatedAt = now.toISOString();
  const businessDate = now.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
  const coverage = Object.fromEntries(operationsPeopleSources.map(domain =>
    [domain, { state: "forbidden", reason: "Current source permission denied" }])) as OperationsPeopleResponse["coverage"]["sources"];
  const counts: { source: OperationsPeopleSource; count: number }[] = [];
  await Promise.all(operationsPeopleSources.map(async domain => {
    if (!peopleSourceEnabled(domain, actor, grants)) return;
    try {
      const query = operationsPeopleSql(domain, requested, businessDate);
      const rows = await pool.query<{ total: string }>(`SELECT count(*)::text AS total FROM ${query.from} WHERE ${query.where}`, query.values);
      counts.push({ source: domain, count: countValue(rows.rows[0].total) });
      coverage[domain] = { state: "complete", reason: null };
    } catch {
      coverage[domain] = { state: "unavailable", reason: "Source count query failed; not zero" };
    }
  }));
  counts.sort((a, b) => operationsPeopleSources.indexOf(a.source) - operationsPeopleSources.indexOf(b.source));
  const selected = source === "all" ? [...operationsPeopleSources] : [source];
  const selectedCounts = counts.filter(entry => selected.includes(entry.source));
  const records: OperationsPeopleRecord[] = [];
  for (const page of peoplePagePlan(selectedCounts, offset, limit)) {
    try {
      if (page.source === "leaves" && grants.leavesApprove && !["admin", "super_admin"].includes(actor.role))
        actor.reviewerTitle = await resolveReviewerJobTitle(actor.id);
      const query = operationsPeopleSql(page.source, requested, businessDate);
      const rows = await pool.query<PeopleRow>(
        `SELECT ${query.select} FROM ${query.from} WHERE ${query.where} ORDER BY ${query.order}
          LIMIT $${query.values.length + 1} OFFSET $${query.values.length + 2}`,
        [...query.values, page.limit, page.offset]);
      records.push(...rows.rows.map(row => {
        if (!requested.includes(row.branch_id)) throw new Error("Source row outside selected scope");
        return projectPeopleRecord(page.source, row, actor, grants, businessDate);
      }));
    } catch {
      coverage[page.source] = { state: "unavailable", reason: "Source page query failed; records and count unavailable" };
    }
  }
  const employees: OperationsPeopleResponse["employees"] = { value: null, active: null, coverage: "forbidden",
    definition: "عدد موظفي الفروع المحددة وحالات active المسجلة؛ دليل التشغيل فقط، مستقل عن أعداد الطلبات ولا يفترض الغياب" };
  if (actor.role === "operations_manager" && grants.operationsHr && Array.isArray(actor.allowed)) {
    try {
      const rows = await pool.query<{ total: string; active: string }>(
        "SELECT count(*)::text AS total,count(*) FILTER (WHERE status='active')::text AS active FROM branch_employees WHERE branch_id=ANY($1::varchar[])",
        [requested]);
      employees.value = countValue(rows.rows[0].total);
      employees.active = countValue(rows.rows[0].active);
      employees.coverage = "complete";
    } catch {
      employees.value = null;
      employees.active = null;
      employees.coverage = "unavailable";
    }
  }
  const knownTotal = selectedCounts.filter(entry => coverage[entry.source].state === "complete").reduce((sum, entry) => sum + entry.count, 0);
  return {
    generatedAt, businessDate, branches: branchRows, scope: { branchIds: requested, requested, source, offset, limit },
    records, employees, tools: peopleTools(requested, actor, grants),
    summaries: operationsPeopleSources.map(domain => ({
      source: domain, ...descriptions[domain], coverage: coverage[domain].state,
      value: coverage[domain].state === "complete" ? counts.find(entry => entry.source === domain)!.count : null,
    })),
    coverage: { sources: coverage, total: selected.every(domain => coverage[domain].state === "complete") ? knownTotal : null,
      nextOffset: knownTotal > offset + limit ? offset + limit : null },
  };
}