import { useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getButterBakeryLogoDataUri } from "@/lib/company-logo-data";
import { useVisualViewportDialog } from "./use-visual-viewport-dialog";
import { preparationSheetPrintHtml, SHORTAGE_LABELS, type PreparationSheet } from "./kitchen-order-share-model";
import { formatKitchenNumber, formatKitchenSaudiDateTime } from "./display-format";
import {
  downloadKitchenPdf,
  kitchenOrderPdfDefinition,
  preparationSheetPdfDefinition,
  type PdfKitchenOrder,
} from "./kitchen-order-pdf";
import { downloadKitchenExcel } from "./kitchen-order-excel";

function Quantity({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warning" | "danger" }) {
  const tones = {
    default: "border-border bg-background text-foreground",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    danger: "border-red-200 bg-red-50 text-red-900",
  };
  return <div className={`min-w-0 rounded-lg border px-2.5 py-2 ${tones[tone]}`}>
    <span className="block text-[11px] font-medium text-muted-foreground">{label}</span>
    <strong className="mt-0.5 block text-base tabular-nums">{value ? formatKitchenNumber(value) : "—"}</strong>
  </div>;
}

function PreparationGroupCard({ group }: { group: PreparationSheet["groups"][number] }) {
  return <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
    <header className="border-b bg-muted/30 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold leading-6">{group.productName}</h3>
          <p className="text-xs text-muted-foreground">{group.unit} · {group.provenance === "substitute" ? "بديل مجهز معتمد" : "صنف أصلي"}</p>
        </div>
        {group.actualShortageQuantity > 0 && <span className="shrink-0 rounded-full bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-800">نقص فعلي</span>}
      </div>
    </header>
    <div className="grid grid-cols-3 gap-2 p-3">
      <Quantity label="المطلوب" value={group.requestedQuantity} />
      <Quantity label="المعتمد" value={group.approvedQuantity} />
      <Quantity label="الأصلي المجهز" value={group.preparedQuantity} />
      <Quantity label="البديل" value={group.substitutedQuantity} />
      <Quantity label="لم يُحسم بعد" value={group.unpreparedQuantity} tone="warning" />
      <Quantity label="نقص فعلي" value={group.actualShortageQuantity} tone="danger" />
    </div>
    <div className="space-y-2 border-t bg-muted/10 p-3">
      <p className="text-xs font-semibold text-muted-foreground">تتبّع الطلبات</p>
      {group.orders.map(order => <div key={order.id} className="rounded-lg border bg-background p-2.5 text-xs leading-5">
        <a className="font-semibold text-primary underline underline-offset-2" href={`/central-kitchen-orders?orderId=${encodeURIComponent(String(order.id))}`}>{order.orderNumber}</a>
        <span className="text-muted-foreground"> · {order.branchName}</span>
        <p className="mt-1 text-muted-foreground">مطلوب {order.requestedQuantity} · أصلي {order.preparedQuantity}{order.substitutedQuantity ? ` · بديل ${order.substitutedQuantity} ${order.substituteUnit || group.unit} — ${order.substituteProductName}` : ""}</p>
        {order.unpreparedQuantity > 0 && <p className="mt-1 text-amber-800">لم يُحسم بعد: {order.unpreparedQuantity} — قيد التجهيز وليس نقصاً فعلياً.</p>}
        {order.actualShortageQuantity > 0 && <p className="mt-1 text-red-800">نقص فعلي: {order.actualShortageQuantity}{order.shortageReason ? ` · ${SHORTAGE_LABELS[order.shortageReason] || order.shortageReason}` : ""}</p>}
        {order.preparationNotes && <p className="mt-1 border-t pt-1 text-muted-foreground">تفاصيل معتمدة: {order.preparationNotes}</p>}
      </div>)}
    </div>
  </article>;
}

export function SheetPreviewDialog({ sheet, open, onOpenChange, canPrint, canExport }: {
  sheet: PreparationSheet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canPrint: boolean;
  canExport: boolean;
}) {
  const { toast } = useToast();
  const [actionError, setActionError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const dialogStyle = useVisualViewportDialog({ open, maxHeight: 900, viewportFraction: 0.94 });
  if (!sheet) return null;
  const print = async () => {
    const popup = window.open("", "_blank", "width=1100,height=800");
    if (!popup) {
      setActionError("حظر المتصفح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم اضغط طباعة مرة أخرى.");
      toast({ title: "حظر المتصفح نافذة الطباعة", description: "اسمح بالنوافذ المنبثقة ثم اضغط طباعة مرة أخرى.", variant: "destructive" });
      return;
    }
    setActionError(null);
    try {
      const logo = await getButterBakeryLogoDataUri();
      popup.document.write(preparationSheetPrintHtml(sheet, logo));
      popup.document.close();
    } catch (error) {
      popup.close();
      const message = error instanceof Error ? error.message : "تعذرت الطباعة";
      setActionError(message);
      toast({ title: "تعذرت الطباعة", description: message, variant: "destructive" });
    }
  };
  const exportPdf = async () => {
    try {
       setExporting("pdf");
       const logo = await getButterBakeryLogoDataUri();
       await downloadKitchenPdf(preparationSheetPdfDefinition(sheet, logo), `ورقة-التجهيز-${sheet.generatedAt.slice(0, 10)}.pdf`);
      setActionError(null);
      toast({ title: "تم تنزيل ملف PDF" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر إنشاء ملف PDF";
      setActionError(message);
      toast({ title: "تعذر تصدير PDF", description: message, variant: "destructive" });
    } finally {
       setExporting(null);
    }
  };
  const exportExcel = async () => {
    try {
      setExporting("excel");
      await downloadKitchenExcel("sheet", sheet);
      setActionError(null);
      toast({ title: "تم تنزيل ملف Excel" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر إنشاء ملف Excel";
      setActionError(message);
      toast({ title: "تعذر تصدير Excel", description: message, variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };
  return <Dialog open={open} onOpenChange={value => { if (!exporting) onOpenChange(value); }}><DialogContent dir="rtl" style={{ ...dialogStyle, width: "calc(100vw - 1rem)", maxWidth: "72rem", display: "flex", flexDirection: "column" }} className="box-border h-[94dvh] min-w-0 gap-0 overflow-hidden p-0 sm:rounded-xl [&>button.absolute]:left-2 [&>button.absolute]:right-auto [&>button.absolute]:top-2 [&>button.absolute]:flex [&>button.absolute]:h-11 [&>button.absolute]:w-11 [&>button.absolute]:items-center [&>button.absolute]:justify-center">
    <DialogHeader className="shrink-0 min-w-0 break-words border-b px-4 py-3 pl-16 text-right sm:px-6 sm:pl-16"><DialogTitle className="leading-normal">معاينة ورقة التجهيز المجمعة</DialogTitle><DialogDescription className="break-words">{formatKitchenNumber(sheet.orders.length)} طلبات · لقطة {formatKitchenSaudiDateTime(sheet.generatedAt)} · راجع الكميات أولاً، ثم اختر الطباعة أو التصدير.</DialogDescription></DialogHeader>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 sm:px-6">
    <div role="status" className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-900">حالة اللقطة: محدثة وقت الإنشاء. «لم يُحسم» يعني أن التجهيز لم يكتمل بعد، ولا يُعد نقصاً فعلياً.</div>
    <div className="space-y-3 md:hidden" aria-label="بطاقات ورقة التجهيز">{sheet.groups.map(group => <PreparationGroupCard key={`${group.provenance}:${group.identity}:${group.unit}`} group={group} />)}</div>
    <div className="hidden min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-lg border md:block" tabIndex={0} aria-label="جدول ورقة التجهيز؛ مرّر أفقياً لعرض بقية الأعمدة"><table className="w-full min-w-[850px] text-sm"><thead className="bg-muted/50"><tr>{["الصنف", "الوحدة", "المطلوب", "المعتمد", "الأصلي", "البديل", "لم يُحسم", "نقص فعلي", "تفاصيل الطلبات"].map(value => <th key={value} className="p-2 text-right">{value}</th>)}</tr></thead><tbody>{sheet.groups.map(group => <tr key={`${group.provenance}:${group.identity}:${group.unit}`} className="border-t align-top">
      <td className="p-2 font-medium">{group.productName}<span className="block text-xs text-muted-foreground">{group.provenance === "substitute" ? "بديل مجهز معتمد" : "صنف أصلي"}</span></td><td className="p-2">{group.unit}</td><td className="p-2">{group.requestedQuantity}</td><td className="p-2">{group.approvedQuantity}</td><td className="p-2">{group.preparedQuantity}</td><td className="p-2">{group.substitutedQuantity || "—"}</td><td className="p-2 text-amber-800">{group.unpreparedQuantity || "—"}</td><td className="p-2 text-red-800">{group.actualShortageQuantity || "—"}</td>
      <td className="space-y-2 p-2">{group.orders.map(order => <div key={order.id}><a className="font-medium text-primary underline" href={`/central-kitchen-orders?orderId=${encodeURIComponent(String(order.id))}`}>{order.orderNumber}</a> · {order.branchName}<span className="block text-xs text-muted-foreground">مطلوب {order.requestedQuantity} · أصلي {order.preparedQuantity}{order.substitutedQuantity ? ` · بديل ${order.substitutedQuantity} ${order.substituteUnit || group.unit} — ${order.substituteProductName}` : ""}{order.unpreparedQuantity ? ` · لم يُحسم ${order.unpreparedQuantity}` : ""}{order.actualShortageQuantity ? ` · نقص فعلي ${order.actualShortageQuantity}` : ""}{order.shortageReason ? ` · ${SHORTAGE_LABELS[order.shortageReason] || order.shortageReason}` : ""}{order.preparationNotes ? ` · ${order.preparationNotes}` : ""}</span></div>)}</td>
    </tr>)}</tbody></table></div>
    {actionError && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</p>}
    </div><div data-testid="sheet-preview-controls" className="grid shrink-0 min-w-0 grid-cols-2 gap-2 border-t bg-background px-3 py-2 pb-[max(.5rem,env(safe-area-inset-bottom))] sm:flex sm:justify-end sm:px-6">{exporting && <p role="status" className="col-span-2 text-xs text-muted-foreground sm:self-center">جارٍ إعداد الملف؛ انتظر اكتمال التنزيل.</p>}{canPrint && <Button className="col-span-2 min-h-11 w-full sm:w-auto" disabled={!!exporting} onClick={() => void print()}><Printer className="ml-1 h-4 w-4" />طباعة</Button>}{canExport && <><Button data-testid="sheet-export-pdf" variant="outline" className="min-h-11 min-w-0 w-full sm:w-auto" disabled={!!exporting} onClick={() => void exportPdf()}>{exporting === "pdf" ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <Download className="ml-1 h-4 w-4" />}{exporting === "pdf" ? "جارٍ إنشاء PDF…" : "تصدير PDF"}</Button><Button data-testid="sheet-export-excel" variant="outline" className="min-h-11 min-w-0 w-full sm:w-auto" disabled={!!exporting} onClick={() => void exportExcel()}>{exporting === "excel" ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <Download className="ml-1 h-4 w-4" />}{exporting === "excel" ? "جارٍ إنشاء Excel…" : "تصدير Excel"}</Button></>}</div>
  </DialogContent></Dialog>;
}

export function OrderActionsMenu({ order, canPrint, canExport, onPrint }: {
  order: PdfKitchenOrder;
  canPrint: boolean;
  canExport: boolean;
    onPrint: () => boolean | Promise<boolean>;
}) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const exportPdf = async () => {
    try {
       setExporting("pdf");
       const logo = await getButterBakeryLogoDataUri();
       await downloadKitchenPdf(kitchenOrderPdfDefinition(order, logo), `طلب-المطبخ-${order.orderNumber}.pdf`);
      setActionError(null);
      toast({ title: "تم تنزيل ملف PDF" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر إنشاء ملف PDF";
      setActionError(message);
      toast({ title: "تعذر تصدير PDF", description: message, variant: "destructive" });
    } finally {
       setExporting(null);
    }
  };
  const exportExcel = async () => {
    try {
      setExporting("excel");
      await downloadKitchenExcel("order", order);
      setActionError(null);
      toast({ title: "تم تنزيل ملف Excel" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر إنشاء ملف Excel";
      setActionError(message);
      toast({ title: "تعذر تصدير Excel", description: message, variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };
  return <div className="flex flex-wrap items-center justify-end gap-2">
    {canPrint && <Button data-testid="order-print" size="sm" variant="outline" className="min-h-11" onClick={async () => { try { if (!await onPrint()) { const message = "حظر المتصفح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة."; setActionError(message); toast({ title: "حظر المتصفح نافذة الطباعة", description: message, variant: "destructive" }); } else setActionError(null); } catch (error) { const message = error instanceof Error ? error.message : "تعذرت الطباعة"; setActionError(message); toast({ title: "تعذرت الطباعة", description: message, variant: "destructive" }); } }}><Printer className="ml-1 h-4 w-4" />طباعة</Button>}
    {canExport && <><Button data-testid="order-export-pdf" size="sm" variant="outline" className="min-h-11" disabled={!!exporting} onClick={() => void exportPdf()}>{exporting === "pdf" ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <Download className="ml-1 h-4 w-4" />}{exporting === "pdf" ? "جارٍ إنشاء PDF…" : "تصدير PDF"}</Button><Button data-testid="order-export-excel" size="sm" variant="outline" className="min-h-11" disabled={!!exporting} onClick={() => void exportExcel()}>{exporting === "excel" ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <Download className="ml-1 h-4 w-4" />}{exporting === "excel" ? "جارٍ إنشاء Excel…" : "تصدير Excel"}</Button></>}
    {actionError && <span role="alert" className="w-full text-xs text-red-700">{actionError}</span>}
  </div>;
}
