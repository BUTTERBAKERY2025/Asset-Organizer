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

const escapeHtml = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character));

export function preparationSheetPrintHtml(sheet: PreparationSheet) {
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
  return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>ورقة التجهيز المجمعة</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#2f1c3a}h1{font-size:22px}p{color:#666}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d8ced5;padding:9px;text-align:right;vertical-align:top;font-size:12px}th{background:#f5edf4}small{display:block;color:#777;margin-top:3px}a{color:#4f2a63}@media print{body{padding:0}a{text-decoration:none;color:inherit}}</style></head><body><h1>ورقة التجهيز المجمعة</h1><p>${sheet.orders.length} طلبات · لقطة ${escapeHtml(new Date(sheet.generatedAt).toLocaleString("ar-SA"))} · التجميع فقط عند تطابق هوية الصنف والوحدة والمصدر. غير المجهز في طلب لم يكتمل تجهيزه لا يُعد نقصاً فعلياً.</p><table><thead><tr><th>الصنف</th><th>الوحدة</th><th>المطلوب</th><th>المعتمد</th><th>الأصلي المجهز</th><th>البديل</th><th>لم يُحسم</th><th>نقص فعلي</th><th>تفاصيل الطلبات</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`;
}