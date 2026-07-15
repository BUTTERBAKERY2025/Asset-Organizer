// كشف حساب سلف موظف + التقرير الشهري الشامل — تصدير Excel وطباعة PDF
import { openPrintWindow, renderToPrintWindow } from "./print-window";

const escapeHtml = (s: any) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const fmt = (n: any) =>
  Number(n || 0).toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const TYPE_AR: Record<string, string> = {
  advance: "سلفة",
  loan_installment: "قسط قرض",
  sales_deficit: "عجز يوميات مبيعات",
};

const BASE_CSS = `
  @page { size: A4; margin: 15mm 12mm; }
  * { box-sizing: border-box; }
  html, body { display: block !important; height: auto !important; width: auto !important; text-align: initial !important; }
  body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; color: #1a1a1a; margin: 0; font-size: 12px; line-height: 1.7; }
  .header { text-align: center; border-bottom: 3px double #b8860b; padding-bottom: 8px; margin-bottom: 12px; }
  .header h1 { font-size: 18px; margin: 0; color: #7a5c00; }
  h2.doc-title { text-align: center; font-size: 15px; margin: 8px 0 2px; }
  .doc-sub { text-align: center; font-size: 11px; color: #666; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid #999; padding: 4px 8px; text-align: right; }
  th { background: #f5efdc; font-weight: 700; }
  td.num, th.num { text-align: center; font-variant-numeric: tabular-nums; }
  tr.subtotal td { background: #fbf7ec; font-weight: 700; }
  tr.grand td { background: #efe3bd; font-weight: 800; font-size: 12.5px; }
  .footer { margin-top: 16px; font-size: 10px; color: #777; text-align: center; border-top: 1px solid #ddd; padding-top: 5px; }
  .info { background: #fbf7ec; border: 1px solid #d9c98a; border-radius: 6px; padding: 6px 12px; margin-bottom: 10px; font-size: 12px; }
`;

function docShell(title: string, sub: string, body: string) {
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title><style>${BASE_CSS}</style></head>
<body>
  <div class="header"><h1>مخبز الزبدة — Butter Bakery</h1></div>
  <h2 class="doc-title">${escapeHtml(title)}</h2>
  <div class="doc-sub">${escapeHtml(sub)}</div>
  ${body}
  <div class="footer">تاريخ الإصدار: ${new Date().toLocaleDateString("ar-SA-u-nu-latn")} — نظام إدارة مخبز الزبدة</div>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 300); });</script>
</body></html>`;
}

// ======================= كشف حساب موظف =======================

export type StatementRow = {
  month: string; type: string; amount: any; description?: string | null;
};

export function buildStatementSummary(rows: StatementRow[]) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const due = rows.filter((r) => r.month <= currentMonth).reduce((s, r) => s + Number(r.amount || 0), 0);
  const upcoming = total - due;
  const byType: Record<string, number> = {};
  for (const r of rows) byType[r.type] = (byType[r.type] || 0) + Number(r.amount || 0);
  return { total, due, upcoming, byType, currentMonth };
}

export function printEmployeeStatement(emp: { employeeName: string; jobTitle?: string; branchName?: string }, rows: StatementRow[]) {
  const target = openPrintWindow();
  const sorted = [...rows].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
  const s = buildStatementSummary(sorted);
  let running = 0;
  const body = `
  <div class="info">
    <b>الموظف:</b> ${escapeHtml(emp.employeeName)}
    ${emp.jobTitle ? ` — <b>الوظيفة:</b> ${escapeHtml(emp.jobTitle)}` : ""}
    ${emp.branchName ? ` — <b>الفرع:</b> ${escapeHtml(emp.branchName)}` : ""}
  </div>
  <table>
    <tr><th class="num">#</th><th class="num">الشهر</th><th>النوع</th><th class="num">المبلغ (ر.س)</th><th class="num">الرصيد التراكمي</th><th>الوصف</th></tr>
    ${sorted.map((r, i) => {
      running += Number(r.amount || 0);
      return `<tr>
        <td class="num">${i + 1}</td>
        <td class="num">${escapeHtml(r.month)}</td>
        <td>${escapeHtml(TYPE_AR[r.type] || r.type)}</td>
        <td class="num">${fmt(r.amount)}</td>
        <td class="num">${fmt(running)}</td>
        <td>${escapeHtml(r.description || "-")}</td>
      </tr>`;
    }).join("")}
    <tr class="grand"><td colspan="3">الإجمالي</td><td class="num">${fmt(s.total)}</td><td colspan="2"></td></tr>
  </table>
  <table style="width:60%">
    <tr><th>المستحق حتى شهر ${escapeHtml(s.currentMonth)}</th><td class="num">${fmt(s.due)} ر.س</td></tr>
    <tr><th>أقساط قادمة (لم تُستقطع بعد)</th><td class="num">${fmt(s.upcoming)} ر.س</td></tr>
    ${Object.entries(s.byType).map(([t, v]) => `<tr><th>إجمالي ${escapeHtml(TYPE_AR[t] || t)}</th><td class="num">${fmt(v)} ر.س</td></tr>`).join("")}
  </table>`;
  renderToPrintWindow(target, docShell("كشف حساب سلف وقروض", `الموظف: ${emp.employeeName}`, body));
}

export async function exportEmployeeStatementExcel(emp: { employeeName: string; jobTitle?: string; branchName?: string }, rows: StatementRow[]) {
  const XLSX = await import("xlsx");
  const sorted = [...rows].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
  const s = buildStatementSummary(sorted);
  let running = 0;
  const data = sorted.map((r, i) => {
    running += Number(r.amount || 0);
    return {
      "#": i + 1,
      "الموظف": emp.employeeName,
      "الشهر": r.month,
      "النوع": TYPE_AR[r.type] || r.type,
      "المبلغ (ر.س)": Number(r.amount || 0),
      "الرصيد التراكمي": running,
      "الوصف": r.description || "",
    };
  });
  data.push({ "#": "" as any, "الموظف": "الإجمالي", "الشهر": "", "النوع": "", "المبلغ (ر.س)": s.total, "الرصيد التراكمي": s.total, "الوصف": "" });
  const summary = [
    { "البند": "الموظف", "القيمة": emp.employeeName },
    { "البند": "الوظيفة", "القيمة": emp.jobTitle || "" },
    { "البند": "الفرع", "القيمة": emp.branchName || "" },
    { "البند": `المستحق حتى ${s.currentMonth}`, "القيمة": s.due },
    { "البند": "أقساط قادمة", "القيمة": s.upcoming },
    { "البند": "الإجمالي الكلي", "القيمة": s.total },
    ...Object.entries(s.byType).map(([t, v]) => ({ "البند": `إجمالي ${TYPE_AR[t] || t}`, "القيمة": v })),
  ];
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] } as any;
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "كشف الحساب");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "الملخص");
  XLSX.writeFile(wb, `كشف_حساب_سلف_${emp.employeeName.replace(/\s+/g, "_")}.xlsx`);
}

// ======================= التقرير الشهري الشامل =======================

export type ReportRow = StatementRow & { employeeName?: string | null; employeeJob?: string | null; branchName?: string | null };

function groupByEmployee(rows: ReportRow[]) {
  const map = new Map<string, { name: string; job: string; branch: string; rows: ReportRow[]; total: number }>();
  for (const r of rows) {
    const key = `${r.employeeName || "-"}|${r.branchName || "-"}`;
    if (!map.has(key)) map.set(key, { name: r.employeeName || "-", job: r.employeeJob || "", branch: r.branchName || "", rows: [], total: 0 });
    const g = map.get(key)!;
    g.rows.push(r);
    g.total += Number(r.amount || 0);
  }
  return [...map.values()].sort((a, b) => a.branch.localeCompare(b.branch, "ar") || a.name.localeCompare(b.name, "ar"));
}

export function printMonthlyReport(monthLabel: string, rows: ReportRow[]) {
  const target = openPrintWindow();
  const groups = groupByEmployee(rows);
  const grand = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const byType: Record<string, number> = {};
  for (const r of rows) byType[r.type] = (byType[r.type] || 0) + Number(r.amount || 0);
  const body = `
  <div class="info"><b>الفترة:</b> ${escapeHtml(monthLabel)} — <b>عدد الموظفين:</b> ${groups.length} — <b>عدد البنود:</b> ${rows.length}</div>
  <table>
    <tr><th>الموظف</th><th>الفرع</th><th class="num">الشهر</th><th>النوع</th><th class="num">المبلغ (ر.س)</th><th>الوصف</th></tr>
    ${groups.map((g) => `
      ${g.rows.map((r, i) => `<tr>
        ${i === 0 ? `<td rowspan="${g.rows.length + 1}"><b>${escapeHtml(g.name)}</b>${g.job ? `<br/><span style="font-size:10px;color:#666">${escapeHtml(g.job)}</span>` : ""}</td>` : ""}
        <td>${escapeHtml(r.branchName || g.branch || "-")}</td>
        <td class="num">${escapeHtml(r.month)}</td>
        <td>${escapeHtml(TYPE_AR[r.type] || r.type)}</td>
        <td class="num">${fmt(r.amount)}</td>
        <td>${escapeHtml(r.description || "-")}</td>
      </tr>`).join("")}
      <tr class="subtotal"><td colspan="3">إجمالي ${escapeHtml(g.name)}</td><td class="num">${fmt(g.total)}</td><td></td></tr>
    `).join("")}
    <tr class="grand"><td colspan="4">الإجمالي العام</td><td class="num">${fmt(grand)}</td><td></td></tr>
  </table>
  <table style="width:55%">
    ${Object.entries(byType).map(([t, v]) => `<tr><th>إجمالي ${escapeHtml(TYPE_AR[t] || t)}</th><td class="num">${fmt(v)} ر.س</td></tr>`).join("")}
    <tr class="grand"><td>الإجمالي العام</td><td class="num">${fmt(grand)} ر.س</td></tr>
  </table>`;
  renderToPrintWindow(target, docShell("التقرير الشهري الشامل للسلف والقروض", `الفترة: ${monthLabel}`, body));
}

export async function exportMonthlyReportExcel(monthLabel: string, rows: ReportRow[]) {
  const XLSX = await import("xlsx");
  const groups = groupByEmployee(rows);
  const grand = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const detail: any[] = [];
  for (const g of groups) {
    for (const r of g.rows) {
      detail.push({
        "الموظف": g.name,
        "الوظيفة": g.job,
        "الفرع": r.branchName || g.branch,
        "الشهر": r.month,
        "النوع": TYPE_AR[r.type] || r.type,
        "المبلغ (ر.س)": Number(r.amount || 0),
        "الوصف": r.description || "",
      });
    }
    detail.push({ "الموظف": `إجمالي ${g.name}`, "الوظيفة": "", "الفرع": "", "الشهر": "", "النوع": "", "المبلغ (ر.س)": g.total, "الوصف": "" });
  }
  detail.push({ "الموظف": "الإجمالي العام", "الوظيفة": "", "الفرع": "", "الشهر": "", "النوع": "", "المبلغ (ر.س)": grand, "الوصف": "" });
  const summary = groups.map((g) => ({ "الموظف": g.name, "الفرع": g.branch, "عدد البنود": g.rows.length, "الإجمالي (ر.س)": g.total }));
  summary.push({ "الموظف": "الإجمالي العام", "الفرع": "", "عدد البنود": rows.length, "الإجمالي (ر.س)": grand } as any);
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] } as any;
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "ملخص حسب الموظف");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "التفاصيل");
  XLSX.writeFile(wb, `تقرير_السلف_الشامل_${monthLabel.replace(/\s+/g, "_")}.xlsx`);
}
