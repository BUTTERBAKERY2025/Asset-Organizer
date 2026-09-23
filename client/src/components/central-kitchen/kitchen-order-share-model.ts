export type PreparationSheet = {
  generatedAt: string;
  snapshotStatus: "current_at_generation";
  orders: Array<{ id: number; orderNumber: string; status: string; requestBranchName?: string | null }>;
  groups: Array<{
    identity: string;
    provenance: "original" | "substitute";
    productName: string;
    unit: string;
    requestedQuantity: number;
    approvedQuantity: number;
    preparedQuantity: number;
    substitutedQuantity: number;
    actualShortageQuantity: number;
    unpreparedQuantity: number;
    orders: Array<{
      id: number;
      orderNumber: string;
      branchName: string;
      requestedQuantity: number;
      preparedQuantity: number;
      substitutedQuantity: number;
      substituteProductName: string | null;
      substituteUnit: string | null;
      substituteIdentity: string | null;
      actualShortageQuantity: number;
      unpreparedQuantity: number;
      shortageReason: string | null;
      preparationNotes: string | null;
    }>;
  }>;
};

export const SHORTAGE_LABELS: Record<string, string> = {
  unavailable: "غير متوفر",
  out_of_stock: "نفاد المخزون",
  production_issue: "تعذر الإنتاج",
  quality_issue: "مشكلة جودة",
  other: "سبب آخر",
};

export function formatSaudiDateTime(input: string | Date | null | undefined) {
  if (!input) return "—";
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export const orderDeepLink = (
  orderId: string | number,
  origin = typeof window === "undefined" ? "" : window.location.origin,
) => `${origin}/central-kitchen-orders?orderId=${encodeURIComponent(String(orderId))}`;

export function buildOrderSafeSummary(order: {
  id: string | number;
  orderNumber: string;
  status: string;
  requestBranchName?: string | null;
  centralKitchenName?: string | null;
  neededDate?: string;
}, origin?: string) {
  return [
    `طلب مطبخ ${order.orderNumber}`,
    `${order.requestBranchName || "الفرع"} ← ${order.centralKitchenName || "المطبخ المركزي"}`,
    order.neededDate ? `تاريخ الحاجة: ${order.neededDate}` : null,
    `الحالة: ${order.status}`,
    `رابط الطلب (يتطلب تسجيل الدخول والصلاحية): ${orderDeepLink(order.id, origin)}`,
  ].filter(Boolean).join("\n");
}

export function buildSheetSafeSummary(sheet: PreparationSheet, origin?: string) {
  return [
    `ملخص ورقة تجهيز مجمعة — ${sheet.orders.length} طلبات`,
    `لقطة وقت الإنشاء: ${new Date(sheet.generatedAt).toLocaleString("ar-SA")}`,
    ...sheet.orders.map(order =>
      `${order.orderNumber} · ${order.requestBranchName || "—"}\n${orderDeepLink(order.id, origin)}`),
    "الروابط تتطلب تسجيل الدخول والصلاحية. راجع الورقة داخل النظام للكميات والتفاصيل.",
  ].join("\n");
}

export const escapePrintHtml = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character));

export function preparationSheetPrintHtml(sheet: PreparationSheet, logoDataUri?: string | null) {
  const escapeHtml = escapePrintHtml;
  const rows = sheet.groups.map(group => `<tr>
    <td>${escapeHtml(group.productName)}<small>${escapeHtml(group.identity)} · ${group.provenance === "substitute" ? "بديل مجهز" : "صنف أصلي"}</small></td>
    <td>${escapeHtml(group.unit)}</td>
    <td>${escapeHtml(group.requestedQuantity)}</td>
    <td>${escapeHtml(group.approvedQuantity)}</td>
    <td>${escapeHtml(group.preparedQuantity)}</td>
    <td>${escapeHtml(group.substitutedQuantity)}</td>
    <td>${group.unpreparedQuantity > 0 ? `${escapeHtml(group.unpreparedQuantity)} (التجهيز لم يُحسم بعد)` : "—"}</td>
    <td>${group.actualShortageQuantity > 0 ? escapeHtml(group.actualShortageQuantity) : "—"}</td>
    <td>${group.orders.map(order => {
      const detail = [
        `مطلوب ${escapeHtml(order.requestedQuantity)}`,
        `أصلي ${escapeHtml(order.preparedQuantity)}`,
        order.substitutedQuantity > 0 ? `بديل ${escapeHtml(order.substitutedQuantity)} ${escapeHtml(order.substituteUnit || group.unit)} — ${escapeHtml(order.substituteProductName)} (${escapeHtml(order.substituteIdentity)})` : null,
        order.unpreparedQuantity > 0 ? `غير مجهز بعد ${escapeHtml(order.unpreparedQuantity)}` : null,
        order.actualShortageQuantity > 0 ? `نقص فعلي ${escapeHtml(order.actualShortageQuantity)}` : null,
        order.shortageReason ? escapeHtml(SHORTAGE_LABELS[order.shortageReason] || order.shortageReason) : null,
        order.preparationNotes ? escapeHtml(order.preparationNotes) : null,
      ].filter(Boolean).join(" · ");
      return `<a href="${escapeHtml(orderDeepLink(order.id))}">${escapeHtml(order.orderNumber)}</a> · ${escapeHtml(order.branchName)}<small>${detail}</small>`;
    }).join("<br>")}</td>
  </tr>`).join("");
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>ورقة التجهيز المجمعة</title><style>html,body{display:block!important;height:auto!important}*{box-sizing:border-box}body{font-family:Arial,sans-serif;padding:28px;color:#4a2d20}.brand{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #d9822b;padding-bottom:12px;margin-bottom:16px}.brand img{width:66px;height:66px;object-fit:contain}.brand h1{font-size:22px;margin:0}.brand p{margin:3px 0 0}.doc{direction:ltr;color:#8b5a37;font-weight:bold}p{color:#715745}table{width:100%;border-collapse:collapse}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}tbody tr:nth-child(even){background:#fff9f0}th,td{border:1px solid #dfcdbb;padding:8px;text-align:right;vertical-align:top;font-size:11px;overflow-wrap:anywhere}th{background:#8b4f2d;color:#fff}small{display:block;color:#806d60;margin-top:3px}a{color:#8b4f2d}.footer{position:fixed;bottom:-7mm;left:0;right:0;text-align:center;color:#8b7564;font-size:9px}@page{size:A4 landscape;margin:12mm 10mm 14mm}@media print{body{padding:0}a{text-decoration:none;color:inherit}}</style></head><body><header class="brand">${logoDataUri ? `<img src="${escapeHtml(logoDataUri)}" alt="Butter Bakery">` : ""}<div><h1>ورقة التجهيز المجمعة</h1><p>باتر بيكري · المطبخ المركزي</p></div><div class="doc">${sheet.orders.length} طلبات</div></header><p>لقطة ${escapeHtml(formatSaudiDateTime(sheet.generatedAt))} بتوقيت السعودية · التجميع فقط عند تطابق هوية الصنف والوحدة والمصدر. غير المجهز في طلب لم يكتمل تجهيزه لا يُعد نقصاً فعلياً.</p><table><thead><tr><th>الصنف</th><th>الوحدة</th><th>المطلوب</th><th>المعتمد</th><th>الأصلي المجهز</th><th>البديل</th><th>لم يُحسم</th><th>نقص فعلي</th><th>تفاصيل الطلبات</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">باتر بيكري · ورقة تجهيز مجمعة</div><script>window.onload=()=>window.print()<\/script></body></html>`;
}