// طباعة نموذج السلفة الرسمي الموقّع من الموظف (مستند A4 RTL بصفحة واحدة)
import { openPrintWindow, renderToPrintWindow } from "./print-window";
import { getCompanyLogoDataUri } from "./company-logo-data";

const escapeHtml = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const fmt = (n: any) =>
  Number(n || 0).toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("ar-SA-u-nu-latn") : "-");

const COMPANY = {
  nameAr: "شركة الزبد الأفضل التجارية",
  nameEn: "THE BUTTER BEST TRADING COMPANY",
  cr: "7026155296",
  details: "شركة مساهمة مقفلة | المملكة العربية السعودية",
  city: "خميس مشيط",
};

function addMonth(month: string, add: number): string {
  const [y, m] = month.split("-").map((v) => parseInt(v, 10));
  const total = y * 12 + (m - 1) + add;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

function buildPlan(amount: number, months: number, startMonth: string) {
  const monthly = Math.round((amount / months) * 100) / 100;
  const plan: Array<{ month: string; amount: number }> = [];
  let allocated = 0;
  for (let i = 0; i < months; i++) {
    const isLast = i === months - 1;
    const a = isLast ? Math.round((amount - allocated) * 100) / 100 : monthly;
    allocated = Math.round((allocated + a) * 100) / 100;
    plan.push({ month: addMonth(startMonth, i), amount: a });
  }
  return plan;
}

const STATUS_AR: Record<string, string> = {
  signed: "موقّع من الموظف — بانتظار الاعتماد النهائي",
  approved: "معتمَد نهائياً",
  disbursed: "معتمَد ومصروف",
};

export async function printAdvanceDocument(r: any) {
  const target = openPrintWindow();
  const logo = await getCompanyLogoDataUri();
  const amount = r.approvedAmount ?? r.amount ?? 0;
  const months = r.installmentMonths ?? r.installments ?? 1;
  const startMonth = r.startMonth || r.requestedMonth || "";
  const monthly = r.monthlyInstallment ?? (months ? Math.round((amount / months) * 100) / 100 : amount);
  const plan = amount > 0 && months > 0 && startMonth ? buildPlan(amount, months, startMonth) : [];
  const today = new Date().toLocaleDateString("ar-SA-u-nu-latn");

  const sig = typeof r.signatureData === "string" && /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(r.signatureData)
    ? r.signatureData
    : null;

  // جدول الأقساط: عمودان جنباً إلى جنب عند كثرة الأقساط للحفاظ على صفحة واحدة
  const planTable = plan.length
    ? (() => {
        const half = Math.ceil(plan.length / 2);
        const rowsCount = plan.length > 6 ? half : plan.length;
        const twoCols = plan.length > 6;
        let rows = "";
        for (let i = 0; i < rowsCount; i++) {
          const a = plan[i];
          const b = twoCols ? plan[i + half] : undefined;
          rows += `<tr>
            <td class="num">${i + 1}</td><td class="num">${escapeHtml(a.month)}</td><td class="num">${fmt(a.amount)}</td>
            ${twoCols ? (b ? `<td class="num">${i + half + 1}</td><td class="num">${escapeHtml(b.month)}</td><td class="num">${fmt(b.amount)}</td>` : `<td colspan="3" style="border:none"></td>`) : ""}
          </tr>`;
        }
        return `<table class="plan">
          <tr><th>#</th><th>شهر الاستقطاع</th><th>القسط (ر.س)</th>${twoCols ? "<th>#</th><th>شهر الاستقطاع</th><th>القسط (ر.س)</th>" : ""}</tr>
          ${rows}
        </table>`;
      })()
    : "";

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>نموذج سلفة - ${escapeHtml(r.employeeName || "")}</title>
<style>
  @page { size: A4; margin: 10mm 12mm; }
  * { box-sizing: border-box; }
  html, body { display: block !important; height: auto !important; width: auto !important; text-align: initial !important; }
  body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; color: #1a1a1a; margin: 0; font-size: 11px; line-height: 1.55; }
  .letterhead { text-align: center; border-bottom: 2.5px solid #b8860b; padding-bottom: 6px; margin-bottom: 8px; }
  .lh-row { display: flex; align-items: center; justify-content: center; gap: 12px; }
  .lh-logo { width: 52px; height: 52px; object-fit: contain; }
  .lh-co-ar { font-size: 15pt; font-weight: 800; color: #7a5c00; }
  .lh-co-en { font-size: 7.5pt; color: #666; letter-spacing: 1px; }
  .lh-co-meta { font-size: 8pt; color: #555; margin-top: 1px; }
  h2.doc-title { text-align: center; font-size: 13pt; margin: 6px 0 1px; color: #333; }
  .doc-sub { text-align: center; font-size: 8.5pt; color: #666; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #999; padding: 3.5px 8px; text-align: right; }
  th { background: #f5efdc; font-weight: 700; width: 17%; white-space: nowrap; }
  td { width: 33%; }
  .plan th, .plan td { width: auto; }
  .plan th { text-align: center; }
  .plan td.num, .plan th { text-align: center; font-variant-numeric: tabular-nums; padding: 2.5px 6px; }
  .ack { background: #fbf7ec; border: 1px solid #d9c98a; border-radius: 5px; padding: 7px 12px; margin: 8px 0 10px; font-size: 10.5px; text-align: justify; line-height: 1.75; }
  .sigs { display: flex; justify-content: space-between; gap: 16px; margin-top: 14px; }
  .sig { flex: 1; text-align: center; font-size: 10.5px; }
  .sig .line { border-top: 1px solid #333; margin-top: 5px; padding-top: 3px; }
  .sig img { max-height: 52px; max-width: 100%; display: block; margin: 0 auto; }
  .sig .empty-space { height: 52px; }
  .footer { margin-top: 12px; font-size: 8.5px; color: #777; text-align: center; border-top: 1.5px solid #b8860b; padding-top: 4px; }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="letterhead">
    <div class="lh-row">
      ${logo ? `<img class="lh-logo" src="${logo}" alt="${escapeHtml(COMPANY.nameAr)}" />` : ""}
      <div>
        <div class="lh-co-ar">${escapeHtml(COMPANY.nameAr)}</div>
        <div class="lh-co-en">${escapeHtml(COMPANY.nameEn)}</div>
        <div class="lh-co-meta">${escapeHtml(COMPANY.details)} — س.ت ${escapeHtml(COMPANY.cr)} — مدينة ${escapeHtml(COMPANY.city)}</div>
      </div>
    </div>
  </div>

  <h2 class="doc-title">إقرار وموافقة على سلفة واستقطاع من الراتب</h2>
  <div class="doc-sub">نموذج رسمي مُوقَّع إلكترونياً من الموظف — رقم الطلب ADV-${r.id} — تاريخ الإصدار: ${today}</div>

  <table>
    <tr>
      <th>اسم الموظف</th><td>${escapeHtml(r.employeeName || "-")}</td>
      <th>المسمى الوظيفي</th><td>${escapeHtml(r.employeeJob || "-")}</td>
    </tr>
    <tr>
      <th>الفرع</th><td>${escapeHtml(r.branchName || "-")}</td>
      <th>حالة الطلب</th><td>${escapeHtml(STATUS_AR[r.status] || r.status || "-")}</td>
    </tr>
    <tr>
      <th>قيمة السلفة المعتمدة</th><td><b>${fmt(amount)} ر.س</b></td>
      <th>عدد الأقساط</th><td>${months} قسطاً شهرياً</td>
    </tr>
    <tr>
      <th>قيمة القسط الشهري</th><td>${fmt(monthly)} ر.س</td>
      <th>أول شهر استقطاع</th><td>${escapeHtml(startMonth || "-")}</td>
    </tr>
    <tr>
      <th>تاريخ توقيع الموظف</th><td>${fmtDate(r.signedAt)}</td>
      <th>تاريخ الصرف</th><td>${fmtDate(r.disbursedAt)}</td>
    </tr>
    ${r.reason ? `<tr><th>سبب الطلب</th><td colspan="3">${escapeHtml(r.reason)}</td></tr>` : ""}
  </table>

  <table>
    <tr><th colspan="4" style="width:auto;text-align:center;background:#efe6c8">بيانات التحويل البنكي — للإدارة المالية (الصرف على حساب الموظف أدناه)</th></tr>
    <tr>
      <th>اسم صاحب الحساب</th><td>${escapeHtml(r.employeeName || "-")}</td>
      <th>اسم البنك</th><td>${escapeHtml(r.bankName || "غير مسجل — يُستكمل يدوياً")}</td>
    </tr>
    <tr>
      <th>رقم الحساب / الآيبان</th><td colspan="3" style="font-variant-numeric:tabular-nums;direction:ltr;text-align:right"><b>${escapeHtml(r.bankAccountNumber || "غير مسجل — يُستكمل يدوياً")}</b></td>
    </tr>
  </table>

  <div class="ack">
    أقر أنا الموظف <b>${escapeHtml(r.employeeName || "-")}</b> بموافقتي على الحصول على سلفة من
    ${escapeHtml(COMPANY.nameAr)} بمبلغ <b>${fmt(amount)} ريال سعودي</b>، وأفوض إدارة الشركة تفويضاً غير قابل
    للرجوع فيه باستقطاع قيمة هذه السلفة من راتبي الشهري على <b>${months}</b> قسطاً شهرياً متساوياً بقيمة
    <b>${fmt(monthly)}</b> ريال للقسط الواحد، اعتباراً من راتب شهر <b>${escapeHtml(startMonth || "-")}</b> وحتى
    سداد كامل المبلغ. كما أقر بأن هذا النموذج يُعد مستنداً رسمياً ملزماً، وبأنه في حال انتهاء خدمتي لأي سبب
    قبل سداد كامل السلفة يحق للشركة خصم المتبقي من مستحقاتي النهائية.
  </div>

  ${planTable}

  <div class="sigs">
    <div class="sig">
      ${sig ? `<img src="${sig}" alt="توقيع الموظف" />` : `<div class="empty-space"></div>`}
      <div class="line">توقيع الموظف${r.signedAt ? ` — ${fmtDate(r.signedAt)}` : ""}</div>
    </div>
    <div class="sig"><div class="empty-space"></div><div class="line">الموارد البشرية</div></div>
    <div class="sig"><div class="empty-space"></div><div class="line">الإدارة المالية</div></div>
  </div>

  <div class="footer">${escapeHtml(COMPANY.nameAr)} — س.ت ${escapeHtml(COMPANY.cr)} — رقم المرجع: ADV-${r.id} — تاريخ الطباعة: ${today}</div>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 300); });</script>
</body>
</html>`;

  renderToPrintWindow(target, html);
}
