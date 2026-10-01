import { sandboxFetch as fetch, previewWindow as window } from "../../../../_stubs/effects.ts";
import React, { useRef, useState } from "react";
import { useQuery, useQueryClient } from "../../../../_stubs/query.ts";
import { Link } from "../../../../_stubs/router.tsx";
import { apiRequest, getHttpStatus, HttpError } from "../../../../_stubs/actions.ts";
import { Button } from "./ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.tsx";
import { Input } from "./ui/input.tsx";
import { Label } from "./ui/label.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs.tsx";

type Handoff = {
  id: number; productId: number | null; productName: string; quantity: number; unit: string;
  productionDate: string; status: string; usableQuantity: number | null;
  damagedQuantity: number | null; shortageQuantity: number | null;
  settlementStatus: string | null; receiptNotes: string | null; createdByName: string | null;
  createdAt: string; dispatchedAt: string | null; receivedAt: string | null;
};
type BarStock = { id: number; productId: number; productionDate: string; quantity: number; quarantineQuantity: number; unit: string };

export async function fetchBranchBarHandoffs(branchId: string): Promise<{ handoffs: Handoff[]; balances: BarStock[] }> {
  const response = await fetch(`/api/branch-bar-handoffs?branchId=${encodeURIComponent(branchId)}`, { credentials: "include" });
  if (!response.ok) throw new HttpError(response.status, (await response.json().catch(() => ({}))).error || "تعذر عرض عهدة البار");
  return response.json();
}

export function BranchBarHandoffs({ branchId, canEdit, onChanged, productIds, embedded = false }: {
  branchId: string; canEdit: boolean; onChanged: () => void; productIds?: number[]; embedded?: boolean;
}) {
  const qc = useQueryClient();
  const [entry, setEntry] = useState<Record<number, { usable: string; damaged: string; notes: string }>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const retryKeys = useRef<Record<string, string>>({});
  const query = useQuery<{ handoffs: Handoff[]; balances: BarStock[] }>({
    queryKey: ["/api/branch-bar-handoffs", branchId],
    enabled: !!branchId,
    queryFn: () => fetchBranchBarHandoffs(branchId),
  });
  const accessDenied = query.isError && [401, 403].includes(getHttpStatus(query.error) ?? 0);
  const actionable = canEdit && !query.isError && !query.isLoading && !!query.data;
  const submit = async (row: Handoff, action: "dispatch" | "receive" | "cancel") => {
    if (pending || !actionable || !query.data?.handoffs.some(current => current.id === row.id && current.status === row.status && current.quantity === row.quantity)) return;
    if (!window.confirm(action === "receive" ? `تأكيد استلام البار الفعلي للتسليم #${row.id}؟` : action === "dispatch" ? `تأكيد خروج التسليم #${row.id} من المطبخ؟` : `إلغاء حجز التسليم #${row.id}؟`)) return;
    const identifier = `${row.id}:${action}`;
    const values = entry[row.id] || (action === "receive" ? { usable: String(row.quantity), damaged: "0", notes: "" } : undefined);
    const usable = Number(values?.usable);
    const damaged = Number(values?.damaged);
    if (action === "receive" && (
      !values || !/^\d+$/.test(values.usable) || !/^\d+$/.test(values.damaged)
      || usable + damaged > row.quantity || ((damaged || usable + damaged < row.quantity) && (values.notes?.trim().length || 0) < 3)
    )) { setError("أدخل الصحيح والتالف بأعداد صحيحة، وسبب الفرق أو التلف إن وجد."); return; }
    if (!retryKeys.current[identifier]) retryKeys.current[identifier] = crypto.randomUUID();
    setPending(identifier); setError(""); setSuccess("");
    try {
      await apiRequest("POST", `/api/branch-bar-handoffs/${row.id}/${action}`, {
        idempotencyKey: retryKeys.current[identifier],
        ...(action === "receive" ? { usableQuantity: usable, damagedQuantity: damaged, notes: values.notes.trim() } : {}),
      });
      delete retryKeys.current[identifier];
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/branch-bar-handoffs", branchId] }),
        qc.invalidateQueries({ queryKey: ["/api/finished-goods-inventory"] }),
        qc.invalidateQueries({ queryKey: ["/api/finished-goods-transfers"] }),
        qc.invalidateQueries({ queryKey: ["/api/central-kitchen-order-journey"] }),
      ]);
      setSuccess(action === "receive" ? `تم تأكيد استلام التسليم #${row.id}` : action === "dispatch" ? `تم توثيق خروج التسليم #${row.id}؛ بانتظار استلام موظف آخر` : `تم إلغاء الحجز #${row.id}`);
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تحديث المحضر، أعد المحاولة بنفس البيانات."); }
    finally { setPending(null); }
  };
  const visible = (!query.isError ? query.data?.handoffs || [] : []).filter(row => !productIds || productIds.includes(row.productId ?? -1))
    .sort((a, b) => (a.status === "in_transit" ? 0 : a.status === "pending" ? 1 : 2) -
      (b.status === "in_transit" ? 0 : b.status === "pending" ? 1 : 2));
  const balances = (!query.isError ? query.data?.balances || [] : []).filter(row => !productIds || productIds.includes(row.productId));
  return <Card id="branch-bar-handoffs" className="border-primary/20">
    <CardHeader className={embedded ? "p-3 pb-1" : undefined}><CardTitle className={embedded ? "text-base" : undefined}>تسليم المطبخ إلى البار {visible.some(row => row.status === "in_transit" || row.status === "pending") && <span className="text-sm font-normal">· {visible.filter(row => row.status === "in_transit" || row.status === "pending").length} إجراء بانتظار الإكمال</span>}</CardTitle></CardHeader>
    {embedded ? <div className="px-3 pb-1 text-xs text-muted-foreground">حجز ← توثيق خروج ← استلام فعلي بواسطة موظف آخر. المحاضر تخص مخزون الفرع المشترك.</div> : null}
    <Tabs defaultValue="branch" dir="rtl">
      {!embedded && <>
      <TabsList className="mx-4"><TabsTrigger value="branch">من مطبخ الفرع</TabsTrigger><TabsTrigger value="central">من المطبخ المركزي</TabsTrigger></TabsList>
      <TabsContent value="central" className="px-4 pb-4"><p className="mb-2 text-sm">طلبات المطبخ المركزي ترتبط بسائقها وإيصالها الأصلي. افتح الطلب لإتمام الاستلام؛ لا يُسجّل لها إيصال ثانٍ هنا.</p>
        <Link className="underline" href="/central-kitchen-orders">فتح طلبات المطبخ المركزي واستلامها</Link>
      </TabsContent>
      </>}
      <TabsContent value="branch">
      {!embedded && <p className="px-4 text-sm text-muted-foreground">تسليم داخلي من المطبخ إلى البار؛ لا يحتاج إلى سائق. يسجل موظف آخر مخوّل الاستلام الفعلي.</p>}
    <CardContent className={embedded ? "space-y-2 p-3 pt-1" : "space-y-3"}>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {success && <p role="status" className="text-sm text-green-700">{success}</p>}
      {query.isError && <p role="alert" className="text-destructive">{accessDenied ? "لم يعد الوصول إلى عهدة البار متاحاً. تحقق من صلاحيتك." : query.error instanceof Error ? query.error.message : "تعذر عرض المحاضر"}</p>}
      {query.isError && <Button size="sm" variant="outline" onClick={() => void query.refetch()}>إعادة التحقق من عهدة البار</Button>}
      {query.isLoading && <p>جارٍ تحميل محاضر التسليم...</p>}
      {!query.isError && query.data && visible.length === 0 && <p className="text-muted-foreground">لا توجد محاضر تسليم داخلية لهذه المنتجات.</p>}
      {visible.map(row => <div key={row.id} className="space-y-2 rounded-md border p-3">
        <div className="flex flex-wrap justify-between gap-2"><strong>#{row.id} · {row.productName} · {row.quantity} {row.unit}</strong>
          <span>{row.status === "pending" ? "محجوز لدى المطبخ" : row.status === "in_transit" ? "خرج من المطبخ · بانتظار استلام البار" : row.status === "received" ? "استلم البار" : "ملغى"}</span></div>
        <p className="text-xs text-muted-foreground">دفعة {row.productionDate} · أنشأه {row.createdByName || "مسؤول المطبخ"} · {row.createdAt ? new Date(row.createdAt).toLocaleString("ar-SA") : ""}</p>
        {row.status === "pending" && actionable && <div className="flex flex-wrap gap-2">
          <Button disabled={!!pending} onClick={() => submit(row, "dispatch")}>توثيق خروج الكمية من المطبخ</Button>
          <Button variant="outline" disabled={!!pending} onClick={() => submit(row, "cancel")}>إلغاء الحجز</Button>
        </div>}
        {row.status === "in_transit" && actionable && <div className="space-y-2">
          <p className="text-sm">موظف آخر مخوّل داخل الفرع يؤكد الكمية المستلمة فعليًا؛ الناقص يبقى فرقًا مفتوحًا.</p>
          <div className="flex flex-wrap gap-2"><div><Label htmlFor={`usable-${row.id}`}>صالح للبار</Label><Input id={`usable-${row.id}`} type="number" min="0" max={row.quantity} value={entry[row.id]?.usable ?? String(row.quantity)} onChange={e => setEntry(old => ({ ...old, [row.id]: { usable: e.target.value, damaged: old[row.id]?.damaged ?? "0", notes: old[row.id]?.notes ?? "" } }))} /></div>
            <div><Label htmlFor={`damaged-${row.id}`}>تالف بالحجر</Label><Input id={`damaged-${row.id}`} type="number" min="0" max={row.quantity} value={entry[row.id]?.damaged ?? "0"} onChange={e => setEntry(old => ({ ...old, [row.id]: { usable: old[row.id]?.usable ?? String(row.quantity), damaged: e.target.value, notes: old[row.id]?.notes ?? "" } }))} /></div></div>
          <Label htmlFor={`reason-${row.id}`}>سبب النقص / التلف (عند وجوده)</Label><Input id={`reason-${row.id}`} value={entry[row.id]?.notes ?? ""} onChange={e => setEntry(old => ({ ...old, [row.id]: { usable: old[row.id]?.usable ?? "", damaged: old[row.id]?.damaged ?? "", notes: e.target.value } }))} />
          <Button disabled={!!pending} onClick={() => submit(row, "receive")}>اعتماد استلام البار الفعلي</Button>
        </div>}
        {row.status === "received" && <p className="text-sm">صالح {row.usableQuantity} · تالف بالحجر {row.damagedQuantity} · ناقص {row.shortageQuantity} {row.unit} {row.settlementStatus === "open" && <strong className="text-amber-700">· فرق مفتوح للمراجعة (لم يُسوَّ)</strong>} {row.receiptNotes && `· ملاحظة المستلم: ${row.receiptNotes}`}</p>}
      </div>)}
      {balances.length ? <div className="rounded border p-3 text-sm"><strong>كميات الاستلام المؤكّد للبار (للمحاضر الجديدة فقط)</strong>
        <p className="text-xs text-muted-foreground">هذه كميات استلام تراكمية وليست رصيد البار الحالي؛ لا تشمل خصم المبيعات أو الهدر، ولا تُدخل الاستلامات التاريخية.</p>
        {balances.map(balance => <p key={balance.id}>منتج #{balance.productId} · دفعة {balance.productionDate}: صالح مستلم {balance.quantity} / تالف مثبت بالحجر {balance.quarantineQuantity} {balance.unit}</p>)}</div> : null}
    </CardContent>
      </TabsContent>
    </Tabs>
  </Card>;
}