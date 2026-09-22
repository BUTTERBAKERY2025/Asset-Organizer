import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, PlusCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type DemandRow = {
  id: number; originalOrderId: number; originalOrderItemId: number; productName: string; unit: string;
  requestedQuantity: number; originalGoodReceivedQuantity: number; acceptedSubstituteQuantity: string;
  compensationGoodReceivedQuantity: string; waivedQuantity: string; remainingQuantity: string;
  preparationShortfallQuantity: number; transitLossQuantity: number; substituteOfferedQuantity: number;
  status: string; reasonCode: string; inventoryMode: string | null; serviceFulfilled: boolean;
  originalReceiptBasis: "estimated_original_first" | "branch_confirmed";
  actions: Array<{ id: number; actionType: string; quantity: number; dueDate?: string; responsibleUserId?: string; replacementOrderId?: number; reason?: string }>;
};

const csvCell = (value: unknown) => {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

export function DemandCommitments({ orderId, kitchenId, items, canConsent }: {
  orderId: string | number;
  kitchenId?: string;
  items: Array<{ id?: string | number; productName: string }>;
  canConsent: boolean;
}) {
  const client = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [activeDecisionId, setActiveDecisionId] = useState<number | null>(null);
  const [decision, setDecision] = useState<Record<number, { type: string; quantity: string; secondaryQuantity: string; dueDate: string; responsibleUserId: string; reason: string; acknowledged: boolean }>>({});
  const reportUrl = `/api/central-kitchen-demand?originalOrderId=${encodeURIComponent(String(orderId))}&pageSize=200`;
  const report = useQuery<{ rows: DemandRow[] }>({ queryKey: [reportUrl], retry: false });
  const candidatesUrl = `/api/central-kitchen-orders/routing/candidates?branchId=${encodeURIComponent(kitchenId || "")}`;
  const candidates = useQuery<{ kitchenCandidates: Array<{ id: string; name: string }> }>({
    queryKey: [candidatesUrl], enabled: !!kitchenId, retry: false,
  });
  const rows = useMemo(() => (report.data?.rows || []).filter((row) =>
    String(row.originalOrderId) === String(orderId)
    && (status === "all" || row.status === status)
    && (!search || row.productName.toLocaleLowerCase("ar").includes(search.toLocaleLowerCase("ar")))),
  [orderId, report.data, search, status]);
  const activate = useMutation({
    mutationFn: async (itemId: string | number) => (await apiRequest("POST", `/api/central-kitchen-demand/activate/${itemId}`, {})).json(),
    onSuccess: () => { void client.invalidateQueries({ queryKey: [reportUrl] }); toast({ title: "تم تفعيل متابعة المتبقي دون أي حركة مخزون" }); },
    onError: (error) => toast({ title: "تعذر تفعيل المتابعة", description: error instanceof Error ? error.message : "", variant: "destructive" }),
  });
  const act = useMutation({
    mutationFn: async ({ id, form }: { id: number; form: { type: string; quantity: string; secondaryQuantity: string; dueDate: string; responsibleUserId: string; reason: string; acknowledged: boolean } }) => {
      const payload = form.type === "replacement"
        ? { type: "replacement", quantity: form.quantity, dueDate: form.dueDate, responsibleUserId: form.responsibleUserId }
        : form.type === "confirm_receipt_components"
          ? { type: form.type, originalGoodQuantity: form.quantity, substituteGoodQuantity: form.secondaryQuantity, reason: form.reason }
        : { type: form.type, quantity: form.quantity, reason: form.reason, acknowledged: form.acknowledged };
      return (await apiRequest("POST", `/api/central-kitchen-demand/${id}/actions`, { ...payload, idempotencyKey: crypto.randomUUID() })).json();
    },
    onSuccess: () => { void client.invalidateQueries({ queryKey: [reportUrl] }); toast({ title: "تم حفظ القرار في سجل التدقيق" }); },
    onError: (error) => toast({ title: "لم يُحفظ القرار", description: error instanceof Error ? error.message : "", variant: "destructive" }),
  });
  const exportCsv = () => {
    const headings = ["الصنف", "الوحدة", "الوضع", "المطلوب الأصلي", "المستلم الجيد الأصلي", "بديل مقبول", "تعويض مستلم", "متنازل عنه", "المتبقي", "إتمام الخدمة", "الإغلاق الإداري"];
    const lines = rows.map((row) => [
      row.productName, row.unit, row.inventoryMode || "legacy", row.requestedQuantity, row.originalGoodReceivedQuantity,
      row.acceptedSubstituteQuantity, row.compensationGoodReceivedQuantity, row.waivedQuantity, row.remainingQuantity,
      row.serviceFulfilled ? "نعم" : "لا", row.status,
    ].map(csvCell).join(","));
    const url = URL.createObjectURL(new Blob([`\uFEFF${headings.map(csvCell).join(",")}\r\n${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `unmet-demand-${orderId}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  if (report.isLoading) return <section className="rounded-lg border p-4 text-sm text-muted-foreground"><Loader2 className="ml-2 inline h-4 w-4 animate-spin" />جارٍ تحميل التزامات المتبقي…</section>;
  if (report.isError) return <section role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">تعذر تحميل تقرير الطلب غير الملبّى. لم تُفترض أي تسوية.</section>;
  return <section className="rounded-lg border p-4" aria-labelledby="demand-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 id="demand-title" className="font-semibold">التزام الطلب غير الملبّى</h3><p className="mt-1 text-xs text-muted-foreground">يتتبع الطلب الأصلي فقط. الإنشاء أو الإرسال لا يحقق التعويض؛ يُحتسب الاستلام الجيد الفعلي فقط، ولا تنشأ هنا أي حركة مخزون.</p></div><Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="ml-1 h-4 w-4" />CSV عربي</Button></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2"><Input aria-label="بحث الصنف" placeholder="بحث بالصنف" value={search} onChange={(event) => setSearch(event.target.value)} /><Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="حالة الالتزام"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل الحالات</SelectItem><SelectItem value="open">مفتوح</SelectItem><SelectItem value="substitute_pending">بديل ينتظر الفرع</SelectItem><SelectItem value="replacement_planned">تعويض مخطط</SelectItem><SelectItem value="partially_settled">مسوى جزئياً</SelectItem><SelectItem value="fulfilled">خدمة مكتملة</SelectItem><SelectItem value="waived">متنازل عنه</SelectItem></SelectContent></Select></div>
    {items.some((item) => item.id != null && !rows.some((row) => String(row.originalOrderItemId) === String(item.id))) && <div className="mt-3 rounded bg-muted/30 p-3 text-sm"><p>بنود لم تُفعّل متابعتها بعد:</p><div className="mt-2 flex flex-wrap gap-2">{items.filter((item) => item.id != null && !rows.some((row) => String(row.originalOrderItemId) === String(item.id))).map((item) => <Button key={item.id} size="sm" variant="outline" disabled={activate.isPending} onClick={() => activate.mutate(item.id!)}><PlusCircle className="ml-1 h-4 w-4" />فحص وتفعيل: {item.productName}</Button>)}</div></div>}
    {!!rows.length && <><div className="mt-3 space-y-2 md:hidden">{rows.map((row) => <article key={row.id} className="rounded-lg border bg-background p-3 text-sm"><div className="flex items-start justify-between gap-3"><div><strong>{row.productName}</strong><p className="text-xs text-muted-foreground">{row.unit} · {row.reasonCode === "transit_loss" ? "فقد أثناء النقل" : "عجز تجهيز"}</p></div><div className="rounded bg-amber-50 px-2 py-1 text-left"><span className="block text-[11px] text-amber-900">المتبقي</span><strong>{row.remainingQuantity} {row.unit}</strong></div></div><dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-muted-foreground">المطلوب</dt><dd>{row.requestedQuantity}</dd></div><div><dt className="text-muted-foreground">الأصلي الجيد</dt><dd>{row.originalGoodReceivedQuantity}</dd></div><div><dt className="text-muted-foreground">البديل المقبول</dt><dd>{row.acceptedSubstituteQuantity}</dd></div><div><dt className="text-muted-foreground">التعويض المستلم</dt><dd>{row.compensationGoodReceivedQuantity}</dd></div></dl>{Number(row.remainingQuantity) > 0 && <Button className="mt-3 min-h-11 w-full" variant={activeDecisionId === row.id ? "secondary" : "outline"} onClick={() => setActiveDecisionId(current => current === row.id ? null : row.id)} aria-expanded={activeDecisionId === row.id}>{activeDecisionId === row.id ? "إخفاء القرار" : "اختيار هذا البند واتخاذ قرار"}</Button>}</article>)}</div><div className="mt-3 hidden overflow-x-auto md:block"><Table><TableHeader><TableRow><TableHead>الصنف</TableHead><TableHead>المطلوب</TableHead><TableHead>الأصلي الجيد</TableHead><TableHead>البديل المقبول</TableHead><TableHead>التعويض المستلم</TableHead><TableHead>المتنازل</TableHead><TableHead>المتبقي</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell>{row.productName}<span className="block text-xs text-muted-foreground">{row.reasonCode === "transit_loss" ? "فقد أثناء النقل" : "عجز تجهيز"} · {row.inventoryMode || "قديم غير مرحّل"}</span></TableCell><TableCell>{row.requestedQuantity} {row.unit}</TableCell><TableCell>{row.originalGoodReceivedQuantity}</TableCell><TableCell>{row.acceptedSubstituteQuantity}</TableCell><TableCell>{row.compensationGoodReceivedQuantity}</TableCell><TableCell>{row.waivedQuantity}</TableCell><TableCell className="font-semibold">{row.remainingQuantity}</TableCell></TableRow>)}</TableBody></Table></div></>}
    <div className="mt-3 hidden gap-2 md:flex md:flex-wrap">{rows.filter((row) => Number(row.remainingQuantity) > 0).map((row) => <Button key={`pick-${row.id}`} size="sm" variant={activeDecisionId === row.id ? "secondary" : "outline"} onClick={() => setActiveDecisionId(row.id)}>اتخاذ قرار: {row.productName}</Button>)}</div>
    {rows.filter((row) => Number(row.remainingQuantity) > 0 && activeDecisionId === row.id).map((row) => {
      const needsConfirmation = row.originalReceiptBasis !== "branch_confirmed";
      const form = decision[row.id] || { type: needsConfirmation ? "confirm_receipt_components" : "replacement", quantity: "", secondaryQuantity: "", dueDate: "", responsibleUserId: "", reason: "", acknowledged: false };
      const update = (patch: Partial<typeof form>) => setDecision((all) => ({ ...all, [row.id]: { ...form, ...patch } }));
      const needsConsent = form.type === "waive" || form.type === "accept_substitute";
      const decisionInvalid = form.quantity === "" || (form.type === "replacement" && (!form.responsibleUserId || candidates.isError))
        || (form.type === "confirm_receipt_components" && (form.secondaryQuantity === "" || form.reason.trim().length < 3))
        || (needsConsent && (form.reason.trim().length < 3 || !form.acknowledged));
      return <div key={`action-${row.id}`} className="mt-4 rounded border bg-muted/20 p-3"><div className="flex items-start justify-between gap-2"><h4 className="text-sm font-medium">قرار {row.productName}</h4><span className="rounded bg-amber-50 px-2 py-1 text-xs font-semibold">المتبقي {row.remainingQuantity} {row.unit}</span></div>{needsConfirmation && <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-900">الإسناد الحالي تقديري. يجب أن يؤكد مسؤول استلام الفرع توزيع الكمية الجيدة قبل أي تعويض أو قبول أو تنازل.</p>}<div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div><Label>النتيجة</Label><Select value={form.type} onValueChange={(value) => update({ type: value, acknowledged: false })}><SelectTrigger className="mt-1 min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="confirm_receipt_components" disabled={!needsConfirmation}>تأكيد توزيع الاستلام من الفرع</SelectItem><SelectItem value="replacement" disabled={needsConfirmation}>طلب تعويض لاحق</SelectItem><SelectItem value="accept_substitute" disabled={needsConfirmation}>قبول البديل من الفرع</SelectItem><SelectItem value="waive" disabled={needsConfirmation}>إلغاء المتبقي بموافقة الفرع</SelectItem></SelectContent></Select></div><div><Label>{form.type === "confirm_receipt_components" ? "المستلم الأصلي الجيد" : "الكمية"}</Label><Input className="mt-1 min-h-11" inputMode="decimal" value={form.quantity} onChange={(e) => update({ quantity: e.target.value })} /></div>{form.type === "confirm_receipt_components" && <div><Label>المستلم البديل الجيد</Label><Input className="mt-1 min-h-11" inputMode="decimal" value={form.secondaryQuantity} onChange={(e) => update({ secondaryQuantity: e.target.value })} /></div>}{form.type === "replacement" ? <><div><Label>تاريخ الاستحقاق</Label><Input className="mt-1 min-h-11" type="date" value={form.dueDate} onChange={(e) => update({ dueDate: e.target.value })} /></div><div><Label>المسؤول المؤهل</Label><Select value={form.responsibleUserId} onValueChange={(value) => update({ responsibleUserId: value })}><SelectTrigger className="mt-1 min-h-11"><SelectValue placeholder={candidates.isLoading ? "جارٍ تحميل المؤهلين" : "اختر مسؤول المطبخ"} /></SelectTrigger><SelectContent>{(candidates.data?.kitchenCandidates || []).map((person) => <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>)}</SelectContent></Select>{candidates.isError && <p className="mt-1 text-xs text-red-700">تعذر تحميل المؤهلين؛ لا يمكن افتراض مسؤول.</p>}</div></> : <div className="sm:col-span-2"><Label>التوثيق / السبب (3 أحرف على الأقل)</Label><Input className="mt-1 min-h-11" value={form.reason} onChange={(e) => update({ reason: e.target.value })} /></div>}</div>{needsConsent && <label className="mt-3 flex items-start gap-3 rounded border bg-background p-3 text-xs leading-5"><Checkbox className="mt-0.5 h-5 w-5" checked={form.acknowledged} onCheckedChange={(checked) => update({ acknowledged: checked === true })} /><span>{form.type === "waive" ? "أقرّ بصفتي ممثل الفرع الطالب أن هذه الكمية ستغلق إدارياً دون احتسابها كإتمام خدمة." : "أقرّ بصفتي ممثل الفرع الطالب بقبول البديل المستلم وتوثيقه كإتمام خدمة."}</span></label>}<Button className="mt-3 min-h-11 w-full sm:w-auto" disabled={act.isPending || decisionInvalid || (!canConsent && form.type !== "replacement")} onClick={() => act.mutate({ id: row.id, form })}>{act.isPending && <Loader2 className="ml-1 h-4 w-4 animate-spin" />}حفظ القرار</Button>{!canConsent && form.type !== "replacement" && <p className="mt-2 text-xs text-muted-foreground">تأكيد التوزيع أو قبول البديل أو التنازل يتطلب صلاحية التحرير وتكليف الاستلام الحالي للفرع الطالب.</p>}</div>;
    })}
  </section>;
}