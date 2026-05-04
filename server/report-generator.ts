import { db } from "./db";
import { sql, and, eq, gte, lte, desc } from "drizzle-orm";
import {
  cashierSalesJournals,
  branches,
  constructionProjects,
  projectExpenses,
  attendanceRecords,
  branchEmployees,
  dailyProductionBatches,
} from "@shared/schema";

export type ReportType =
  | "monthly_sales"
  | "monthly_pnl"
  | "monthly_construction"
  | "monthly_attendance"
  | "monthly_production";

export interface ReportResult {
  title: string;
  body: string;
  summary: Record<string, any>;
}

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "0";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function getPeriodRange(periodMonth: string): { start: string; end: string; label: string } {
  const [y, m] = periodMonth.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  const monthsAr = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return { start, end, label: `${monthsAr[m - 1]} ${y}` };
}

async function branchName(branchId: string | null | undefined): Promise<string> {
  if (!branchId) return "جميع الفروع";
  const [b] = await db.select({ name: branches.name }).from(branches).where(eq(branches.id, branchId));
  return b?.name || branchId;
}

async function generateMonthlySales(periodMonth: string, branchId?: string | null): Promise<ReportResult> {
  const { start, end, label } = getPeriodRange(periodMonth);
  const bName = await branchName(branchId);

  const conditions = [gte(cashierSalesJournals.journalDate, start), lte(cashierSalesJournals.journalDate, end)];
  if (branchId) conditions.push(eq(cashierSalesJournals.branchId, branchId));

  const rows = await db.select({
    totalSales: sql<number>`COALESCE(SUM(${cashierSalesJournals.totalSales}), 0)`,
    cashTotal: sql<number>`COALESCE(SUM(${cashierSalesJournals.cashTotal}), 0)`,
    networkTotal: sql<number>`COALESCE(SUM(${cashierSalesJournals.networkTotal}), 0)`,
    deliveryTotal: sql<number>`COALESCE(SUM(${cashierSalesJournals.deliveryTotal}), 0)`,
    customerCount: sql<number>`COALESCE(SUM(${cashierSalesJournals.customerCount}), 0)`,
    transactionCount: sql<number>`COALESCE(SUM(${cashierSalesJournals.transactionCount}), 0)`,
    discrepancy: sql<number>`COALESCE(SUM(${cashierSalesJournals.discrepancyAmount}), 0)`,
    journalsCount: sql<number>`COUNT(*)`,
  }).from(cashierSalesJournals).where(and(...conditions));

  const r = rows[0] || { totalSales: 0, cashTotal: 0, networkTotal: 0, deliveryTotal: 0, customerCount: 0, transactionCount: 0, discrepancy: 0, journalsCount: 0 };
  const avgTicket = Number(r.transactionCount) > 0 ? Number(r.totalSales) / Number(r.transactionCount) : 0;

  const title = `تقرير مبيعات شهري - ${bName} - ${label}`;
  const body =
    `*${title}*\n\n` +
    `إجمالي المبيعات: ${fmt(r.totalSales)} ر.س\n` +
    `النقد: ${fmt(r.cashTotal)} ر.س\n` +
    `الشبكة: ${fmt(r.networkTotal)} ر.س\n` +
    `التوصيل: ${fmt(r.deliveryTotal)} ر.س\n` +
    `عدد العملاء: ${fmt(r.customerCount)}\n` +
    `عدد الفواتير: ${fmt(r.transactionCount)}\n` +
    `متوسط الفاتورة: ${fmt(avgTicket)} ر.س\n` +
    `صافي الفروقات: ${fmt(r.discrepancy)} ر.س\n` +
    `عدد اليوميات: ${fmt(r.journalsCount)}\n\n` +
    `شركة الزبد الأفضل التجارية`;

  return { title, body, summary: { ...r, avgTicket, branch: bName, period: label } };
}

async function generateMonthlyPnL(periodMonth: string, branchId?: string | null): Promise<ReportResult> {
  const { start, end, label } = getPeriodRange(periodMonth);
  const bName = await branchName(branchId);

  const salesConds = [gte(cashierSalesJournals.journalDate, start), lte(cashierSalesJournals.journalDate, end)];
  if (branchId) salesConds.push(eq(cashierSalesJournals.branchId, branchId));
  const [sales] = await db.select({
    revenue: sql<number>`COALESCE(SUM(${cashierSalesJournals.totalSales}), 0)`,
  }).from(cashierSalesJournals).where(and(...salesConds));

  const expConds = [gte(projectExpenses.expenseDate, start), lte(projectExpenses.expenseDate, end)];
  let expenses = 0;
  if (branchId) {
    const projIds = await db.select({ id: constructionProjects.id }).from(constructionProjects).where(eq(constructionProjects.branchId, branchId));
    if (projIds.length > 0) {
      const ids = projIds.map(p => p.id);
      const [r] = await db.select({ total: sql<number>`COALESCE(SUM(${projectExpenses.amount}), 0)` })
        .from(projectExpenses)
        .where(and(...expConds, sql`${projectExpenses.projectId} IN (${sql.join(ids.map(i => sql`${i}`), sql`, `)})`));
      expenses = Number(r?.total || 0);
    }
  } else {
    const [r] = await db.select({ total: sql<number>`COALESCE(SUM(${projectExpenses.amount}), 0)` })
      .from(projectExpenses).where(and(...expConds));
    expenses = Number(r?.total || 0);
  }

  const revenue = Number(sales?.revenue || 0);
  const vat = revenue * (15 / 115);
  const netRevenue = revenue - vat;
  const grossProfit = netRevenue - expenses;
  const margin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

  const title = `تقرير ربح وخسارة شهري - ${bName} - ${label}`;
  const body =
    `*${title}*\n\n` +
    `إجمالي الإيرادات (شامل ضريبة): ${fmt(revenue)} ر.س\n` +
    `ضريبة القيمة المضافة 15%: ${fmt(vat)} ر.س\n` +
    `صافي الإيرادات: ${fmt(netRevenue)} ر.س\n` +
    `إجمالي المصروفات: ${fmt(expenses)} ر.س\n` +
    `الربح الإجمالي: ${fmt(grossProfit)} ر.س\n` +
    `هامش الربح: ${fmt(margin)}%\n\n` +
    `شركة الزبد الأفضل التجارية`;

  return { title, body, summary: { revenue, vat, netRevenue, expenses, grossProfit, margin, branch: bName, period: label } };
}

async function generateMonthlyConstruction(periodMonth: string, branchId?: string | null): Promise<ReportResult> {
  const { start, end, label } = getPeriodRange(periodMonth);
  const bName = await branchName(branchId);

  const projConds: any[] = [];
  if (branchId) projConds.push(eq(constructionProjects.branchId, branchId));
  const projects = await db.select().from(constructionProjects)
    .where(projConds.length > 0 ? and(...projConds) : undefined);

  const inProgress = projects.filter(p => p.status === "in_progress").length;
  const completed = projects.filter(p => p.status === "completed").length;
  const onHold = projects.filter(p => p.status === "on_hold").length;
  const planned = projects.filter(p => p.status === "planned").length;
  const totalBudget = projects.reduce((s, p) => s + Number(p.budget || 0), 0);

  const projIds = projects.map(p => p.id);
  let monthExpenses = 0;
  if (projIds.length > 0) {
    const [r] = await db.select({ total: sql<number>`COALESCE(SUM(${projectExpenses.amount}), 0)` })
      .from(projectExpenses)
      .where(and(
        gte(projectExpenses.expenseDate, start),
        lte(projectExpenses.expenseDate, end),
        sql`${projectExpenses.projectId} IN (${sql.join(projIds.map(i => sql`${i}`), sql`, `)})`,
      ));
    monthExpenses = Number(r?.total || 0);
  }

  const title = `تقرير مشروعات الإنشاء الشهري - ${bName} - ${label}`;
  const body =
    `*${title}*\n\n` +
    `إجمالي المشروعات: ${projects.length}\n` +
    `قيد التنفيذ: ${inProgress}\n` +
    `مخططة: ${planned}\n` +
    `معلقة: ${onHold}\n` +
    `مكتملة: ${completed}\n` +
    `إجمالي الميزانيات: ${fmt(totalBudget)} ر.س\n` +
    `مصروفات الشهر: ${fmt(monthExpenses)} ر.س\n\n` +
    `شركة الزبد الأفضل التجارية`;

  return {
    title,
    body,
    summary: { totalProjects: projects.length, inProgress, planned, onHold, completed, totalBudget, monthExpenses, branch: bName, period: label },
  };
}

async function generateMonthlyAttendance(periodMonth: string, branchId?: string | null): Promise<ReportResult> {
  const { start, end, label } = getPeriodRange(periodMonth);
  const bName = await branchName(branchId);

  const conds = [gte(attendanceRecords.attendanceDate, start), lte(attendanceRecords.attendanceDate, end)];
  if (branchId) conds.push(eq(attendanceRecords.branchId, branchId));

  const rows = await db.select({
    status: attendanceRecords.status,
    cnt: sql<number>`COUNT(*)`,
  }).from(attendanceRecords).where(and(...conds)).groupBy(attendanceRecords.status);

  let present = 0, absent = 0, late = 0, leave = 0;
  for (const r of rows) {
    const c = Number(r.cnt);
    if (r.status === "present") present += c;
    else if (r.status === "absent") absent += c;
    else if (r.status === "late") late += c;
    else if (r.status === "leave" || r.status === "vacation") leave += c;
  }
  const total = present + absent + late + leave;
  const attendanceRate = total > 0 ? ((present + late) / total) * 100 : 0;

  const empConds: any[] = [eq(branchEmployees.status, "active")];
  if (branchId) empConds.push(eq(branchEmployees.branchId, branchId));
  const [empCount] = await db.select({ cnt: sql<number>`COUNT(*)` })
    .from(branchEmployees).where(and(...empConds));

  const title = `تقرير الحضور الشهري - ${bName} - ${label}`;
  const body =
    `*${title}*\n\n` +
    `عدد الموظفين النشطين: ${fmt(empCount?.cnt)}\n` +
    `إجمالي السجلات: ${fmt(total)}\n` +
    `حضور: ${fmt(present)}\n` +
    `تأخير: ${fmt(late)}\n` +
    `غياب: ${fmt(absent)}\n` +
    `إجازات: ${fmt(leave)}\n` +
    `معدل الحضور: ${fmt(attendanceRate)}%\n\n` +
    `شركة الزبد الأفضل التجارية`;

  return { title, body, summary: { present, absent, late, leave, total, attendanceRate, employees: Number(empCount?.cnt || 0), branch: bName, period: label } };
}

async function generateMonthlyProduction(periodMonth: string, branchId?: string | null): Promise<ReportResult> {
  const { start, end, label } = getPeriodRange(periodMonth);
  const bName = await branchName(branchId);

  const conds = [gte(dailyProductionBatches.productionDate, start), lte(dailyProductionBatches.productionDate, end)];
  if (branchId) conds.push(eq(dailyProductionBatches.branchId, branchId));

  const [r] = await db.select({
    batches: sql<number>`COUNT(*)`,
    totalQty: sql<number>`COALESCE(SUM(${dailyProductionBatches.quantity}), 0)`,
    finished: sql<number>`COUNT(CASE WHEN ${dailyProductionBatches.status} = 'finished' THEN 1 END)`,
    inProgress: sql<number>`COUNT(CASE WHEN ${dailyProductionBatches.status} = 'in_progress' THEN 1 END)`,
  }).from(dailyProductionBatches).where(and(...conds));

  const title = `تقرير الإنتاج الشهري - ${bName} - ${label}`;
  const body =
    `*${title}*\n\n` +
    `إجمالي الدفعات: ${fmt(r?.batches)}\n` +
    `إجمالي الكميات المنتجة: ${fmt(r?.totalQty)}\n` +
    `دفعات مكتملة: ${fmt(r?.finished)}\n` +
    `قيد التنفيذ: ${fmt(r?.inProgress)}\n\n` +
    `شركة الزبد الأفضل التجارية`;

  return { title, body, summary: { ...r, branch: bName, period: label } };
}

export async function generateReport(
  reportType: ReportType,
  periodMonth: string,
  branchId?: string | null,
): Promise<ReportResult> {
  switch (reportType) {
    case "monthly_sales": return generateMonthlySales(periodMonth, branchId);
    case "monthly_pnl": return generateMonthlyPnL(periodMonth, branchId);
    case "monthly_construction": return generateMonthlyConstruction(periodMonth, branchId);
    case "monthly_attendance": return generateMonthlyAttendance(periodMonth, branchId);
    case "monthly_production": return generateMonthlyProduction(periodMonth, branchId);
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
}

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  monthly_sales: "مبيعات شهري",
  monthly_pnl: "ربح وخسارة شهري",
  monthly_construction: "مشروعات الإنشاء الشهري",
  monthly_attendance: "الحضور الشهري",
  monthly_production: "الإنتاج الشهري",
};
