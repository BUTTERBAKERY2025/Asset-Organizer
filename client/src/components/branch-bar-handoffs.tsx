import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Handoff = {
  id: number; productName: string; quantity: number; unit: string;
  productionDate: string; status: string; usableQuantity: number | null;
  damagedQuantity: number | null; shortageQuantity: number | null;
  settlementStatus: string | null; receiptNotes: string | null; createdByName: string | null;
  createdAt: string; dispatchedAt: string | null; receivedAt: string | null;
};
type BarStock = { id: number; productId: number; productionDate: string; quantity: number; quarantineQuantity: number; unit: string };

export function BranchBarHandoffs({ branchId, canEdit, onChanged }: {
  branchId: string; canEdit: boolean; onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [entry, setEntry] = useState<Record<number, { usable: string; damaged: string; notes: string }>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const retryKeys = useRef<Record<string, string>>({});
  const query = useQuery<{ handoffs: Handoff[]; balances: BarStock[] }>({
    queryKey: ["/api/branch-bar-handoffs", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const response = await fetch(`/api/branch-bar-handoffs?branchId=${encodeURIComponent(branchId)}`, { credentials: "include" });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `HTTP ${response.status}`);
      return response.json();
    },
  });
  const submit = async (row: Handoff, action: "dispatch" | "receive" | "cancel") => {
    if (pending || !canEdit) return;
    const identifier = `${row.id}:${action}`;
    const values = entry[row.id];
    const usable = Number(values?.usable);
    const damaged = Number(values?.damaged);
    if (action === "receive" && (
      !values || !/^\d+$/.test(values.usable) || !/^\d+$/.test(values.damaged)
      || usable + damaged > row.quantity || ((damaged || usable + damaged < row.quantity) && (values.notes?.trim().length || 0) < 3)
    )) { setError("أدخل الصحيح والتالف بأعداد صحيحة، وسبب الفرق أو التلف إن وجد."); return; }
    if (!retryKeys.current[identifier]) retryKeys.current[identifier] = crypto.randomUUID();
    setPending(identifier); setError("");
    try {
      await apiRequest("POST", `/api/branch-bar-handoffs/${row.id}/${action}`, {
        idempotencyKey: retryKeys.current[identifier],
        ...(action === "receive" ? { usableQuantity: usable, damagedQuantity: damaged, notes: values.notes.trim() } : {}),
      });
      delete retryKeys.current[identifier];
      await qc.invalidateQueries({ queryKey: ["/api/branch-bar-handoffs", branchId] });
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تحديث المحضر، أعد المحاولة بنفس البيانات."); }
    finally { setPending(null); }
  };
  return <Card id="branch-bar-handoffs" className="border-primary/20">
    <CardHeader><CardTitle>استلام المنتجات للفرع</CardTitle></CardHeader>
    <Tabs defaultValue="branch" dir="rtl">
      <TabsList className="mx-4"><TabsTrigger value="branch">من مطبخ الفرع</TabsTrigger><TabsTrigger value="central">من المطبخ المركزي</TabsTrigger></TabsList>
      <TabsContent value="central" className="px-4 pb-4"><p className="mb-2 text-sm">طلبات المطبخ المركزي ترتبط بسائقها وإيصالها الأصلي. افتح الطلب لإتمام الاستلام؛ لا يُسجّل لها إيصال ثانٍ هنا.</p>
        <Link className="underline" href="/central-kitchen-orders">فتح طلبات المطبخ المركزي واستلامها</Link>
      </TabsContent>
      <TabsContent value="branch">
      <p className="px-4 text-sm text-muted-foreground">تسليم داخلي من المطبخ إلى البار؛ لا يحتاج إلى سائق. يسجل موظف آخر مخوّل الاستلام الفعلي.</p>
    <CardContent className="space-y-3">
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {query.isError && <p role="alert" className="text-destructive">{query.error instanceof Error ? query.error.message : "تعذر عرض المحاضر"}</p>}
      {query.isLoading && <p>جارٍ تحميل محاضر التسليم...</p>}
      {query.data?.handoffs.length === 0 && <p className="text-muted-foreground">لا توجد محاضر تسليم داخلية لهذا الفرع.</p>}
      {query.data?.handoffs.map(row => <div key={row.id} className="space-y-2 rounded-md border p-3">
        <div className="flex flex-wrap justify-between gap-2"><strong>#{row.id} · {row.productName} · {row.quantity} {row.unit}</strong>
          <span>{row.status === "pending" ? "محجوز لدى المطبخ" : row.status === "in_transit" ? "خرج من المطبخ · بانتظار استلام البار" : row.status === "received" ? "استلم البار" : "ملغى"}</span></div>
        <p className="text-xs text-muted-foreground">دفعة {row.productionDate} · أنشأه {row.createdByName || "مسؤول المطبخ"} · {row.createdAt ? new Date(row.createdAt).toLocaleString("ar-SA") : ""}</p>
        {row.status === "pending" && canEdit && <div className="flex flex-wrap gap-2">
          <Button disabled={!!pending} onClick={() => submit(row, "dispatch")}>توثيق خروج الكمية من المطبخ</Button>
          <Button variant="outline" disabled={!!pending} onClick={() => submit(row, "cancel")}>إلغاء الحجز</Button>
        </div>}
        {row.status === "in_transit" && canEdit && <div className="space-y-2">
          <p className="text-sm">موظف آخر مخوّل داخل الفرع يؤكد الكمية المستلمة فعليًا؛ الناقص يبقى فرقًا مفتوحًا.</p>
          <div className="flex flex-wrap gap-2"><div><Label htmlFor={`usable-${row.id}`}>صالح للبار</Label><Input id={`usable-${row.id}`} type="number" min="0" max={row.quantity} value={entry[row.id]?.usable ?? ""} onChange={e => setEntry(old => ({ ...old, [row.id]: { usable: e.target.value, damaged: old[row.id]?.damaged ?? "", notes: old[row.id]?.notes ?? "" } }))} /></div>
            <div><Label htmlFor={`damaged-${row.id}`}>تالف بالحجر</Label><Input id={`damaged-${row.id}`} type="number" min="0" max={row.quantity} value={entry[row.id]?.damaged ?? ""} onChange={e => setEntry(old => ({ ...old, [row.id]: { usable: old[row.id]?.usable ?? "", damaged: e.target.value, notes: old[row.id]?.notes ?? "" } }))} /></div></div>
          <Label htmlFor={`reason-${row.id}`}>سبب النقص / التلف (عند وجوده)</Label><Input id={`reason-${row.id}`} value={entry[row.id]?.notes ?? ""} onChange={e => setEntry(old => ({ ...old, [row.id]: { usable: old[row.id]?.usable ?? "", damaged: old[row.id]?.damaged ?? "", notes: e.target.value } }))} />
          <Button disabled={!!pending} onClick={() => submit(row, "receive")}>اعتماد استلام البار الفعلي</Button>
        </div>}
        {row.status === "received" && <p className="text-sm">صالح {row.usableQuantity} · تالف بالحجر {row.damagedQuantity} · ناقص {row.shortageQuantity} {row.unit} {row.settlementStatus === "open" && <strong className="text-amber-700">· فرق مفتوح للمراجعة (لم يُسوَّ)</strong>} {row.receiptNotes && `· ملاحظة المستلم: ${row.receiptNotes}`}</p>}
      </div>)}
      {query.data?.balances.length ? <div className="rounded border p-3 text-sm"><strong>كميات الاستلام المؤكّد للبار (للمحاضر الجديدة فقط)</strong>
        <p className="text-xs text-muted-foreground">هذه كميات استلام تراكمية وليست رصيد البار الحالي؛ لا تشمل خصم المبيعات أو الهدر، ولا تُدخل الاستلامات التاريخية.</p>
        {query.data.balances.map(balance => <p key={balance.id}>منتج #{balance.productId} · دفعة {balance.productionDate}: صالح مستلم {balance.quantity} / تالف مثبت بالحجر {balance.quarantineQuantity} {balance.unit}</p>)}</div> : null}
    </CardContent>
      </TabsContent>
    </Tabs>
  </Card>;
}