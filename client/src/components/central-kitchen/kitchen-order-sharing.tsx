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

export function SheetPreviewDialog({ sheet, open, onOpenChange }: {
  sheet: PreparationSheet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [actionError, setActionError] = useState<string | null>(null);
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
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir="rtl" style={{ width: "calc(100vw - 1rem)", maxWidth: "72rem" }} className="box-border min-w-0 max-h-[92dvh] overflow-x-hidden overflow-y-auto p-4 sm:p-6">
    <DialogHeader className="min-w-0 break-words pl-7 text-right"><DialogTitle className="leading-normal">معاينة ورقة التجهيز المجمعة</DialogTitle><DialogDescription className="break-words">{sheet.orders.length} طلبات · لقطة {new Date(sheet.generatedAt).toLocaleString("ar-SA")} · لا تُطبع أو تُشارك حتى تختار الإجراء.</DialogDescription></DialogHeader>
    <div role="status" className="rounded border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">حالة اللقطة: محدثة وقت الإنشاء. الكمية غير المجهزة في طلب لم يكتمل تجهيزه تظهر «لم يُحسم»، وليست نقصاً فعلياً.</div>
    <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-md border" tabIndex={0} aria-label="جدول ورقة التجهيز؛ مرّر أفقياً لعرض بقية الأعمدة"><table className="w-full min-w-[850px] text-sm"><thead className="bg-muted/50"><tr>{["الصنف / الهوية", "الوحدة", "المطلوب", "المعتمد", "الأصلي", "البديل", "لم يُحسم", "نقص فعلي", "تفاصيل الطلبات"].map(value => <th key={value} className="p-2 text-right">{value}</th>)}</tr></thead><tbody>{sheet.groups.map(group => <tr key={`${group.provenance}:${group.identity}:${group.unit}`} className="border-t align-top">
      <td className="p-2 font-medium">{group.productName}<span className="block text-xs text-muted-foreground">{group.identity} · {group.provenance === "substitute" ? "بديل مجهز" : "أصلي"}</span></td><td className="p-2">{group.unit}</td><td className="p-2">{group.requestedQuantity}</td><td className="p-2">{group.approvedQuantity}</td><td className="p-2">{group.preparedQuantity}</td><td className="p-2">{group.substitutedQuantity}</td><td className="p-2">{group.unpreparedQuantity || "—"}</td><td className="p-2">{group.actualShortageQuantity || "—"}</td>
      <td className="space-y-2 p-2">{group.orders.map(order => <div key={order.id}><a className="font-medium text-primary underline" href={`/central-kitchen-orders?orderId=${encodeURIComponent(String(order.id))}`}>{order.orderNumber}</a> · {order.branchName}<span className="block text-xs text-muted-foreground">مطلوب {order.requestedQuantity} · أصلي {order.preparedQuantity}{order.substitutedQuantity ? ` · بديل ${order.substitutedQuantity} ${order.substituteUnit || group.unit} — ${order.substituteProductName} (${order.substituteIdentity})` : ""}{order.unpreparedQuantity ? ` · لم يُحسم ${order.unpreparedQuantity}` : ""}{order.actualShortageQuantity ? ` · نقص فعلي ${order.actualShortageQuantity}` : ""}{order.shortageReason ? ` · ${SHORTAGE_LABELS[order.shortageReason] || order.shortageReason}` : ""}{order.preparationNotes ? ` · ${order.preparationNotes}` : ""}</span></div>)}</td>
    </tr>)}</tbody></table></div>
    <section className="min-w-0" aria-label="نص المشاركة الآمن"><h3 className="mb-1 text-sm font-semibold">راجع نص المشاركة الآمن</h3><textarea readOnly className="block min-h-32 w-full max-w-full rounded-md border bg-muted/20 p-3 text-xs" value={safeText} /><p className="mt-1 break-words text-xs text-muted-foreground">لا يتضمن ملاحظات التجهيز أو المخزون أو تفاصيل النقص؛ الروابط محمية بتسجيل الدخول والصلاحيات.</p></section>
    {actionError && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</p>}
    <div data-testid="sheet-preview-controls" className="flex min-w-0 flex-wrap justify-end gap-2"><Button variant="outline" onClick={copy}><Copy className="ml-1 h-4 w-4" />نسخ الملخص</Button><Button variant="outline" onClick={whatsapp}><MessageCircle className="ml-1 h-4 w-4" />فتح واتساب</Button><Button onClick={print}><Printer className="ml-1 h-4 w-4" />طباعة / حفظ PDF</Button></div>
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