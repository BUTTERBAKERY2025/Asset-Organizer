// نموذج طباعة مخالصة نهاية الخدمة — A4 عربي RTL وفق نظام العمل السعودي
import { openPrintWindow, renderToPrintWindow } from "./print-window";
import { TERMINATION_TYPE_LABELS } from "@shared/schema";

export interface EosPrintData {
  id: number;
  employeeName?: string | null;
  employeeJob?: string | null;
  branchName?: string | null;
  terminationType: string;
  startDate: string;
  endDate: string;
  calculationDate: string;
  totalServiceYears: number;
  basicSalary: number;
  totalSalary: number;
  eosAmount: number;
  vacationBalance?: number | null;
  vacationAmount?: number | null;
  otherDues?: number | null;
  totalDeductions?: number | null;
  netAmount: number;
  notes?: string | null;
  status: string;
}

function escapeHtml(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const fmt = (n: any) =>
  Number(n || 0).toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(d?: unknown): string {
  if (!d) return "-";
  try {
    const s = String(d);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return escapeHtml(s.slice(0, 10));
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) return escapeHtml(dt.toISOString().slice(0, 10));
    return escapeHtml(s);
  } catch {
    return "-";
  }
}

function serviceDuration(years: number): string {
  const totalDays = Math.round(years * 365.25);
  const y = Math.floor(totalDays / 365.25);
  const remDays = totalDays - Math.round(y * 365.25);
  const m = Math.floor(remDays / 30.44);
  const dd = Math.max(0, Math.round(remDays - m * 30.44));
  return `${y} سنة و ${m} شهر و ${dd} يوم`;
}

function ruleText(type: string, years: number): string {
  if (type === "resignation") {
    if (years < 2) return "المادة 85: مدة الخدمة أقل من سنتين — لا تستحق المكافأة";
    if (years < 5) return "المادة 85: استقالة بعد سنتين وقبل خمس سنوات — يستحق ثلث المكافأة";
    if (years < 10) return "المادة 85: استقالة بعد خمس سنوات وقبل عشر — يستحق ثلثي المكافأة";
    return "المادة 85: استقالة بعد عشر سنوات — يستحق المكافأة كاملة";
  }
  if (type === "termination_article_80") return "المادة 80: فصل لأحد الأسباب المنصوص عليها — لا تستحق المكافأة";
  if (type === "resignation_marriage_childbirth" || type === "force_majeure") return "المادة 87: تستحق المكافأة كاملة";
  return "المادة 84: إنهاء العقد من صاحب العمل / انتهاء المدة / تقاعد / وفاة — المكافأة كاملة";
}

export function printEosSettlement(d: EosPrintData) {
  const target = openPrintWindow();
  const years = Number(d.totalServiceYears) || 0;
  const firstFive = Math.min(5, years);
  const afterFive = Math.max(0, years - 5);
  const today = new Date().toLocaleDateString("ar-SA-u-nu-latn");

  const rows = [
    ["مكافأة نهاية الخدمة (المواد 84/85/87)", fmt(d.eosAmount)],
    ["بدل رصيد الإجازات المستحق (المادة 111)" + (d.vacationBalance ? ` — ${d.vacationBalance} يوم` : ""), fmt(d.vacationAmount)],
    ["مستحقات أخرى (رواتب متبقية / بدلات..)", fmt(d.otherDues)],
    ["يُخصم: التزامات على الموظف (سلف / خصومات)", `(${fmt(d.totalDeductions)})`],
  ];

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>مخالصة نهاية خدمة - ${escapeHtml(d.employeeName || "")}</title>
<style>
  @page { size: A4; margin: 18mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; color: #1a1a1a; margin: 0; font-size: 13px; line-height: 1.9; }
  .header { text-align: center; border-bottom: 3px double #b8860b; padding-bottom: 10px; margin-bottom: 14px; }
  .header h1 { font-size: 20px; margin: 0 0 2px; color: #7a5c00; }
  .header .sub { font-size: 12px; color: #555; }
  h2.doc-title { text-align: center; font-size: 17px; margin: 10px 0 4px; }
  .doc-sub { text-align: center; font-size: 11.5px; color: #666; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid #999; padding: 6px 10px; text-align: right; }
  th { background: #f5efdc; font-weight: 700; width: 38%; }
  .amounts th { width: auto; }
  .amounts td.num { text-align: left; direction: ltr; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .net td { background: #f0f7f0; font-weight: 800; font-size: 14px; }
  .rule { background: #fbf7ec; border: 1px solid #d9c98a; border-radius: 6px; padding: 8px 12px; margin: 10px 0 14px; font-size: 12px; }
  .clearance { font-size: 12.5px; text-align: justify; margin: 12px 0 18px; }
  .sigs { display: flex; justify-content: space-between; gap: 20px; margin-top: 30px; }
  .sig { flex: 1; text-align: center; font-size: 12px; }
  .sig .line { border-top: 1px solid #333; margin-top: 45px; padding-top: 4px; }
  .footer { margin-top: 24px; font-size: 10.5px; color: #777; text-align: center; border-top: 1px solid #ddd; padding-top: 6px; }
</style>
</head>
<body>
  <div class="header">
    <h1>مخبز الزبدة — Butter Bakery</h1>
    <div class="sub">المملكة العربية السعودية</div>
  </div>

  <h2 class="doc-title">مخالصة نهائية ومستحقات نهاية الخدمة</h2>
  <div class="doc-sub">محسوبة وفق نظام العمل السعودي (المواد 84 - 87 والمادة 111)</div>

  <table>
    <tr><th>اسم الموظف</th><td>${escapeHtml(d.employeeName || "-")}</td></tr>
    <tr><th>المسمى الوظيفي</th><td>${escapeHtml(d.employeeJob || "-")}</td></tr>
    <tr><th>الفرع</th><td>${escapeHtml(d.branchName || "-")}</td></tr>
    <tr><th>سبب نهاية الخدمة</th><td>${escapeHtml((TERMINATION_TYPE_LABELS as any)[d.terminationType] || d.terminationType)}</td></tr>
    <tr><th>تاريخ بداية الخدمة</th><td>${fmtDate(d.startDate)}</td></tr>
    <tr><th>تاريخ نهاية الخدمة</th><td>${fmtDate(d.endDate)}</td></tr>
    <tr><th>مدة الخدمة</th><td>${escapeHtml(serviceDuration(years))} (${years.toFixed(3)} سنة)</td></tr>
    <tr><th>الراتب الأساسي</th><td>${fmt(d.basicSalary)} ر.س</td></tr>
    <tr><th>الأجر الأخير الشامل (أساس الحساب)</th><td>${fmt(d.totalSalary)} ر.س</td></tr>
  </table>

  <div class="rule">
    <b>القاعدة النظامية المطبّقة:</b> ${escapeHtml(ruleText(d.terminationType, years))}<br/>
    الاحتساب: نصف أجر شهر × ${firstFive.toFixed(2)} سنة (الخمس الأولى)${afterFive > 0 ? ` + أجر شهر كامل × ${afterFive.toFixed(2)} سنة (ما بعد الخامسة)` : ""}، مع احتساب كسور السنة نسبياً.
  </div>

  <table class="amounts">
    <tr><th>البند</th><th style="width:160px">المبلغ (ر.س)</th></tr>
    ${rows.map(([l, v]) => `<tr><td>${escapeHtml(l)}</td><td class="num">${v}</td></tr>`).join("")}
    <tr class="net"><td>صافي المستحق النهائي</td><td class="num">${fmt(d.netAmount)}</td></tr>
  </table>

  ${d.notes ? `<table><tr><th>ملاحظات</th><td>${escapeHtml(d.notes)}</td></tr></table>` : ""}

  <div class="clearance">
    أقرّ أنا الموظف الموضّحة بياناته أعلاه بأنني استلمت كامل مستحقاتي المبيّنة في هذه المخالصة،
    وأنه لا يحق لي المطالبة بأي مبالغ أو حقوق أخرى تجاه المنشأة عن فترة عملي المذكورة،
    وأن هذه مخالصة نهائية مبرئة للذمة.
  </div>

  <div class="sigs">
    <div class="sig"><div class="line">توقيع الموظف</div></div>
    <div class="sig"><div class="line">الموارد البشرية</div></div>
    <div class="sig"><div class="line">المدير المالي</div></div>
    <div class="sig"><div class="line">ختم المنشأة</div></div>
  </div>

  <div class="footer">رقم السجل: EOS-${d.id} — تاريخ الإصدار: ${today} — تاريخ الاحتساب: ${fmtDate(d.calculationDate)}</div>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 300); });</script>
</body>
</html>`;

  renderToPrintWindow(target, html);
}
