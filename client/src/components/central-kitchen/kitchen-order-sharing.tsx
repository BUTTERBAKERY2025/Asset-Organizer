import { useState } from "react";
import { Copy, EllipsisVertical, MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  buildOrderSafeSummary, buildSheetSafeSummary, preparationSheetPrintHtml,
  SHORTAGE_LABELS, type PreparationSheet,
} from "./kitchen-order-share-model";

async function copyText(text: string) {
  if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
  await navigator.clipboard.writeText(text);
}

function openWhatsApp(text: string) {
  const popup = window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  if (popup) popup.opener = null;
  return !!popup;
}

function Quantity({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warning" | "danger" }) {
  const tones = {
    default: "border-border bg-background text-foreground",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    danger: "border-red-200 bg-red-50 text-red-900",
  };
  return <div className={`min-w-0 rounded-lg border px-2.5 py-2 ${tones[tone]}`}>
    <span className="block text-[11px] font-medium text-muted-foreground">{label}</span>
    <strong className="mt-0.5 block text-base tabular-nums">{value || "—"}</strong>
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

export function SheetPreviewDialog({ sheet, open, onOpenChange }: {
  sheet: PreparationSheet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [actionError, setActionError] = useState<string | null>(null);
  const [shareReviewOpen, setShareReviewOpen] = useState(false);
  if (!sheet) return null;
  const safeText = buildSheetSafeSummary(sheet);
  const print = () => {
    const popup = window.open("", "_blank", "width=1100,height=800");
    if (!popup) {
      setActionError("حظر المتصفح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم اضغط طباعة مرة أخرى.");
      toast({ title: "حظر المتصفح نافذة الطباعة", description: "اسمح بالنوافذ المنبثقة ثم اضغط طباعة مرة أخرى.", variant: "destructive" });
      return;
    }
    setActionError(null);
    popup.document.write(preparationSheetPrintHtml(sheet));
    popup.document.close();
  };
  const copy = async () => {
    try {
      await copyText(safeText);
      setActionError(null);
      toast({ title: "تم نسخ الملخص الآمن" });
    } catch {
      setActionError("تعذر النسخ تلقائياً. حدد النص الظاهر وانسخه يدوياً.");
      toast({ title: "تعذر النسخ", description: "حدد النص الظاهر وانسخه يدوياً.", variant: "destructive" });
    }
  };
  const whatsapp = () => {
    if (!openWhatsApp(safeText)) {
      setActionError("حظر المتصفح نافذة واتساب. اسمح بالنوافذ المنبثقة أو انسخ الملخص يدوياً.");
      toast({ title: "حظر المتصفح نافذة واتساب", description: "اسمح بالنوافذ المنبثقة أو انسخ الملخص يدوياً.", variant: "destructive" });
    } else setActionError(null);
  };
  return <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen) setShareReviewOpen(false); onOpenChange(nextOpen); }}><DialogContent dir="rtl" style={{ width: "calc(100vw - 1rem)", maxWidth: "72rem" }} className="box-border min-w-0 max-h-[92dvh] overflow-x-hidden overflow-y-auto p-3 sm:p-6">
    <DialogHeader className="min-w-0 break-words pl-7 text-right"><DialogTitle className="leading-normal">معاينة ورقة التجهيز المجمعة</DialogTitle><DialogDescription className="break-words">{sheet.orders.length} طلبات · لقطة {new Date(sheet.generatedAt).toLocaleString("ar-SA")} · راجع الكميات أولاً، ثم اختر الطباعة أو المشاركة.</DialogDescription></DialogHeader>
    <div role="status" className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-900">حالة اللقطة: محدثة وقت الإنشاء. «لم يُحسم» يعني أن التجهيز لم يكتمل بعد، ولا يُعد نقصاً فعلياً.</div>
    <div className="space-y-3 md:hidden" aria-label="بطاقات ورقة التجهيز">{sheet.groups.map(group => <PreparationGroupCard key={`${group.provenance}:${group.identity}:${group.unit}`} group={group} />)}</div>
    <div className="hidden min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-lg border md:block" tabIndex={0} aria-label="جدول ورقة التجهيز؛ مرّر أفقياً لعرض بقية الأعمدة"><table className="w-full min-w-[850px] text-sm"><thead className="bg-muted/50"><tr>{["الصنف", "الوحدة", "المطلوب", "المعتمد", "الأصلي", "البديل", "لم يُحسم", "نقص فعلي", "تفاصيل الطلبات"].map(value => <th key={value} className="p-2 text-right">{value}</th>)}</tr></thead><tbody>{sheet.groups.map(group => <tr key={`${group.provenance}:${group.identity}:${group.unit}`} className="border-t align-top">
      <td className="p-2 font-medium">{group.productName}<span className="block text-xs text-muted-foreground">{group.provenance === "substitute" ? "بديل مجهز معتمد" : "صنف أصلي"}</span></td><td className="p-2">{group.unit}</td><td className="p-2">{group.requestedQuantity}</td><td className="p-2">{group.approvedQuantity}</td><td className="p-2">{group.preparedQuantity}</td><td className="p-2">{group.substitutedQuantity || "—"}</td><td className="p-2 text-amber-800">{group.unpreparedQuantity || "—"}</td><td className="p-2 text-red-800">{group.actualShortageQuantity || "—"}</td>
      <td className="space-y-2 p-2">{group.orders.map(order => <div key={order.id}><a className="font-medium text-primary underline" href={`/central-kitchen-orders?orderId=${encodeURIComponent(String(order.id))}`}>{order.orderNumber}</a> · {order.branchName}<span className="block text-xs text-muted-foreground">مطلوب {order.requestedQuantity} · أصلي {order.preparedQuantity}{order.substitutedQuantity ? ` · بديل ${order.substitutedQuantity} ${order.substituteUnit || group.unit} — ${order.substituteProductName}` : ""}{order.unpreparedQuantity ? ` · لم يُحسم ${order.unpreparedQuantity}` : ""}{order.actualShortageQuantity ? ` · نقص فعلي ${order.actualShortageQuantity}` : ""}{order.shortageReason ? ` · ${SHORTAGE_LABELS[order.shortageReason] || order.shortageReason}` : ""}{order.preparationNotes ? ` · ${order.preparationNotes}` : ""}</span></div>)}</td>
    </tr>)}</tbody></table></div>
    {shareReviewOpen && <section id="sheet-share-review" className="min-w-0 rounded-lg border bg-muted/10 p-3 sm:p-4" aria-label="نص المشاركة الآمن"><div className="mb-2"><h3 className="text-sm font-semibold">راجع نص المشاركة الآمن</h3><p className="mt-1 break-words text-xs text-muted-foreground">لا يتضمن ملاحظات التجهيز أو المخزون أو تفاصيل النقص؛ الروابط محمية بتسجيل الدخول والصلاحيات.</p></div><textarea readOnly aria-label="نص المشاركة الآمن للمراجعة" className="block min-h-32 w-full max-w-full rounded-md border bg-background p-3 text-xs leading-5" value={safeText} /></section>}
    {actionError && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</p>}
    <div data-testid="sheet-preview-controls" className="flex min-w-0 flex-col gap-2 border-t pt-3 sm:flex-row sm:justify-end"><Button className="w-full sm:w-auto sm:order-3" onClick={print}><Printer className="ml-1 h-4 w-4" />طباعة / حفظ PDF</Button><Button variant="outline" className="w-full sm:w-auto sm:order-1" onClick={() => setShareReviewOpen(value => !value)} aria-expanded={shareReviewOpen} aria-controls="sheet-share-review"><MessageCircle className="ml-1 h-4 w-4" />{shareReviewOpen ? "إخفاء المشاركة" : "مراجعة ومشاركة"}</Button>{shareReviewOpen && <><Button variant="outline" className="w-full sm:w-auto sm:order-2" onClick={copy}><Copy className="ml-1 h-4 w-4" />نسخ الملخص</Button><Button variant="outline" className="w-full sm:w-auto sm:order-2" onClick={whatsapp}><MessageCircle className="ml-1 h-4 w-4" />فتح واتساب</Button></>}</div>
  </DialogContent></Dialog>;
}

export function OrderActionsMenu({ order, canPrint, onPrint }: {
  order: Parameters<typeof buildOrderSafeSummary>[0];
  canPrint: boolean;
  onPrint: () => boolean;
}) {
  const { toast } = useToast();
  const [preview, setPreview] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const text = buildOrderSafeSummary(order);
  const copy = async () => {
    try { await copyText(text); setActionError(null); toast({ title: "تم نسخ ملخص الطلب والرابط" }); }
    catch { setPreview(true); setActionError("تعذر النسخ تلقائياً. انسخ النص يدوياً من المعاينة."); toast({ title: "تعذر النسخ", description: "انسخ النص يدوياً من المعاينة.", variant: "destructive" }); }
  };
  return <><DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline" aria-label="خيارات طباعة ومشاركة الطلب"><EllipsisVertical className="ml-1 h-4 w-4" />طباعة ومشاركة</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="text-right">
    {canPrint && <DropdownMenuItem onSelect={() => { if (!onPrint()) { setActionError("حظر المتصفح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة."); setPreview(true); toast({ title: "حظر المتصفح نافذة الطباعة", description: "اسمح بالنوافذ المنبثقة ثم أعد المحاولة.", variant: "destructive" }); } else setActionError(null); }}><Printer />سند التجهيز</DropdownMenuItem>}
    <DropdownMenuItem onSelect={() => setPreview(true)}><MessageCircle />معاينة مشاركة واتساب</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => void copy()}><Copy />نسخ الملخص والرابط</DropdownMenuItem>
  </DropdownMenuContent></DropdownMenu>
  <Dialog open={preview} onOpenChange={setPreview}><DialogContent dir="rtl" className="w-[calc(100%-1rem)] max-w-lg"><DialogHeader className="text-right"><DialogTitle>راجع نص مشاركة الطلب</DialogTitle><DialogDescription>لن يتم الإرسال تلقائياً. الرابط يتطلب تسجيل الدخول والصلاحية.</DialogDescription></DialogHeader><textarea readOnly value={text} className="min-h-48 w-full rounded-md border bg-muted/20 p-3 text-sm" />{actionError && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</p>}<div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => void copy()}><Copy className="ml-1 h-4 w-4" />نسخ</Button><Button onClick={() => { if (!openWhatsApp(text)) { setActionError("حظر المتصفح نافذة واتساب. اسمح بالنوافذ المنبثقة أو انسخ النص."); toast({ title: "حظر المتصفح نافذة واتساب", description: "اسمح بالنوافذ المنبثقة أو انسخ النص.", variant: "destructive" }); } else setActionError(null); }}><MessageCircle className="ml-1 h-4 w-4" />فتح واتساب</Button></div></DialogContent></Dialog></>;
}