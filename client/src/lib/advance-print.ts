// طباعة نموذج السلفة الرسمي الموقّع من الموظف (مستند A4 RTL)
import { openPrintWindow, renderToPrintWindow } from "./print-window";

const escapeHtml = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const fmt = (n: any) =>
  Number(n || 0).toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("ar-SA-u-nu-latn") : "-");

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

export function printAdvanceDocument(r: any) {
  const target = openPrintWindow();
  const amount = r.approvedAmount ?? r.amount ?? 0;
  const months = r.installmentMonths ?? r.installments ?? 1;
  const startMonth = r.startMonth || r.requestedMonth || "";
  const monthly = r.monthlyInstallment ?? (months ? Math.round((amount / months) * 100) / 100 : amount);
  const plan = amount > 0 && months > 0 && startMonth ? buildPlan(amount, months, startMonth) : [];
  const today = new Date().toLocaleDateString("ar-SA-u-nu-latn");

  const sig = typeof r.signatureData === "string" && /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(r.signatureData)
    ? r.signatureData
    : null;

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>نموذج سلفة - ${escapeHtml(r.employeeName || "")}</title>
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
  .plan th { width: auto; background: #f5efdc; text-align: center; }
  .plan td { text-align: center; font-variant-numeric: tabular-nums; }
  .ack { background: #fbf7ec; border: 1px solid #d9c98a; border-radius: 6px; padding: 10px 14px; margin: 12px 0 16px; font-size: 12.5px; text-align: justify; }
  .sigs { display: flex; justify-content: space-between; gap: 20px; margin-top: 26px; }
  .sig { flex: 1; text-align: center; font-size: 12px; }
  .sig .line { border-top: 1px solid #333; margin-top: 8px; padding-top: 4px; }
  .sig img { max-height: 70px; max-width: 100%; display: block; margin: 0 auto; }
  .sig .empty-space { height: 70px; }
  .footer { margin-top: 24px; font-size: 10.5px; color: #777; text-align: center; border-top: 1px solid #ddd; padding-top: 6px; }
</style>
</head>
<body>
  <div class="header">
    <h1>مخبز الزبدة — Butter Bakery</h1>
    <div class="sub">المملكة العربية السعودية</div>
  </div>

  <h2 class="doc-title">إقرار وموافقة على سلفة واستقطاع من الراتب</h2>
  <div class="doc-sub">نموذج رسمي مُوقَّع إلكترونياً من الموظف — رقم الطلب ADV-${r.id}</div>

  <table>
    <tr><th>اسم الموظف</th><td>${escapeHtml(r.employeeName || "-")}</td></tr>
    <tr><th>المسمى الوظيفي</th><td>${escapeHtml(r.employeeJob || "-")}</td></tr>
    <tr><th>الفرع</th><td>${escapeHtml(r.branchName || "-")}</td></tr>
    <tr><th>قيمة السلفة المعتمدة</th><td><b>${fmt(amount)} ر.س</b>${r.approvedAmount != null && r.approvedAmount !== r.amount ? ` (المطلوب أصلاً: ${fmt(r.amount)} ر.س)` : ""}</td></tr>
    <tr><th>عدد الأقساط</th><td>${months} قسطاً شهرياً</td></tr>
    <tr><th>قيمة القسط الشهري</th><td>${fmt(monthly)} ر.س</td></tr>
    <tr><th>أول شهر استقطاع</th><td>${escapeHtml(startMonth || "-")}</td></tr>
    ${r.reason ? `<tr><th>سبب الطلب</th><td>${escapeHtml(r.reason)}</td></tr>` : ""}
    <tr><th>حالة الطلب</th><td>${escapeHtml(STATUS_AR[r.status] || r.status || "-")}</td></tr>
    <tr><th>تاريخ توقيع الموظف</th><td>${fmtDate(r.signedAt)}</td></tr>
    ${r.disbursedAt ? `<tr><th>تاريخ الصرف</th><td>${fmtDate(r.disbursedAt)}</td></tr>` : ""}
  </table>

  <div class="ack">
    أقر أنا الموظف <b>${escapeHtml(r.employeeName || "-")}</b> بموافقتي على الحصول على سلفة من الشركة بمبلغ
    <b>${fmt(amount)} ريال سعودي</b>، وأفوض إدارة الشركة تفويضاً غير قابل للرجوع فيه باستقطاع قيمة هذه السلفة
    من راتبي الشهري على <b>${months}</b> قسطاً شهرياً متساوياً بقيمة <b>${fmt(monthly)}</b> ريال للقسط الواحد،
    اعتباراً من راتب شهر <b>${escapeHtml(startMonth || "-")}</b> وحتى سداد كامل المبلغ.
    كما أقر بأن هذا النموذج يُعد مستنداً رسمياً ملزماً، وبأنه في حال انتهاء خدمتي لأي سبب قبل سداد كامل السلفة
    يحق للشركة خصم المتبقي من مستحقاتي النهائية.
  </div>

  ${plan.length ? `
  <table class="plan">
    <tr><th>#</th><th>شهر الاستقطاع</th><th>قيمة القسط (ر.س)</th></tr>
    ${plan.map((p, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(p.month)}</td><td>${fmt(p.amount)}</td></tr>`).join("")}
  </table>` : ""}

  <div class="sigs">
    <div class="sig">
      ${sig ? `<img src="${sig}" alt="توقيع الموظف" />` : `<div class="empty-space"></div>`}
      <div class="line">توقيع الموظف${r.signedAt ? ` — ${fmtDate(r.signedAt)}` : ""}</div>
    </div>
    <div class="sig"><div class="empty-space"></div><div class="line">الموارد البشرية</div></div>
    <div class="sig"><div class="empty-space"></div><div class="line">الإدارة المالية</div></div>
  </div>

  <div class="footer">رقم المرجع: ADV-${r.id} — تاريخ الطباعة: ${today}${r.signedAt ? ` — التوقيع الإلكتروني بتاريخ ${fmtDate(r.signedAt)}` : ""}</div>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 300); });</script>
</body>
</html>`;

  renderToPrintWindow(target, html);
}
