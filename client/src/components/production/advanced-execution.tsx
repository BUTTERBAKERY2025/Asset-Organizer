import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type Row = {
  itemId: number; productId: number | null; productName: string; unit: string | null;
  plannedQuantity: number; linkageStatus: "linked" | "unknown";
  completedQuantity: number | null; inProgressQuantity: number | null; remainingQuantity: number | null;
  batches: Array<{ id: number; quantity: number; status: string }>;
};
type Pending = { key: string; itemId: number; body: { quantity: number; unit: string; productionDate: string; destination: string } };

export function AdvancedExecution({ orderId, status, startDate }: { orderId: number; status: string; startDate: string }) {
  const { user } = useAuth();
  const { canCreate, canEdit } = usePermissions();
  const { toast } = useToast();
  const cache = useQueryClient();
  const url = `/api/advanced-production-orders/${orderId}/execution`;
  const query = useQuery<Row[]>({ queryKey: [url, user?.id], enabled: !!user?.id, staleTime: 0, refetchOnWindowFocus: true });
  const storageKey = `advanced-execution:${user?.id}:${orderId}`;
  const [selected, setSelected] = useState<Row | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [date, setDate] = useState(startDate);
  const [destination, setDestination] = useState("display_bar");
  const [pending, setPending] = useState<Pending | null>(null);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  useEffect(() => {
    setSelected(null);
    setHydratedKey(null);
    if (!user?.id) { setPending(null); return; }
    try {
      setPending(JSON.parse(sessionStorage.getItem(storageKey) || "null"));
      setHydratedKey(storageKey);
    } catch {
      toast({ title: "تعذر قراءة محاولة الإنتاج المحفوظة؛ أعد فتح الصفحة قبل إنشاء دفعة", variant: "destructive" });
    }
  }, [storageKey, user?.id, toast]);
  const active = !!user?.id && hydratedKey === storageKey && !query.isError && !!query.data && ["approved", "in_progress"].includes(status);
  const mutation = useMutation({
    mutationFn: async (operation: { row: Row; batchId?: number; action?: "finish" | "cancel" }) => {
      if (!user?.id || hydratedKey !== storageKey) throw new Error("انتظر تحميل محاولة المستخدم المحفوظة");
      const base = `/api/advanced-production-orders/${orderId}/items/${operation.row.itemId}/batches`;
      const creating = !operation.action;
      let saved = pending;
      if (creating && !saved) {
        saved = { key: crypto.randomUUID(), itemId: operation.row.itemId, body: {
          quantity: Number(quantity), unit: operation.row.unit || "", productionDate: date, destination,
        } };
        // Persist before sending; ambiguous network failures retain exactly this operation.
        sessionStorage.setItem(storageKey, JSON.stringify(saved));
        setPending(saved);
      }
      const response = await fetch(creating ? base : `${base}/${operation.batchId}/${operation.action}`, {
        method: "POST", credentials: "include", signal: AbortSignal.timeout(30000),
        headers: { "Content-Type": "application/json", ...(creating ? { "Idempotency-Key": saved!.key } : {}) },
        body: JSON.stringify(creating ? saved!.body : {}),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        // Only a server-confirmed rolled-back rejection permits changed input.
        // Unknown conflicts/server/network failures retain the operation key.
        if (creating && body.safeToRevise === true) {
          sessionStorage.removeItem(storageKey); setPending(null);
        }
        throw new Error(body.error || `تعذر التنفيذ (${response.status})`);
      }
      if (creating) { sessionStorage.removeItem(storageKey); setPending(null); }
      return response.json();
    },
    onSuccess: () => {
      setSelected(null);
      cache.invalidateQueries({ queryKey: [url] });
      cache.invalidateQueries({ queryKey: [`/api/advanced-production-orders/${orderId}`] });
      cache.invalidateQueries({ predicate: q => String(q.queryKey[0]).includes("operations-report") || String(q.queryKey[0]).includes("daily-production") });
      toast({ title: "تم حفظ عملية الدفعة المرتبطة" });
    },
    onError: (error: Error) => toast({ title: "تعذر تنفيذ الدفعة", description: error.message, variant: "destructive" }),
  });
  const open = (row: Row) => {
    setSelected(row);
    setQuantity(String(pending?.body.quantity ?? Math.max(1, Number(row.remainingQuantity ?? row.plannedQuantity))));
    setDate(pending?.body.productionDate ?? startDate);
    setDestination(pending?.body.destination ?? "display_bar");
  };
  const quantityText = (value: number | null) => value === null ? "غير معلوم" : Number(value).toLocaleString("en-US");
  return <Card>
    <CardHeader><CardTitle>تنفيذ بنود الخطة — دفعات مرتبطة صراحة</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">الأرقام تخص الدفعات المرتبطة بالبند فقط. السجل التاريخي غير المرتبط غير معلوم ولا يُستنتج من الاسم أو التاريخ. إنشاء دفعة يتطلب وصفة معتمدة؛ الإتمام يصرف المواد ويرحّل الناتج مرة واحدة. المتبقي = المخطط − المكتمل − قيد التنفيذ.</p>
      {query.isLoading && <p>جارٍ تحميل التنفيذ…</p>}
      {query.isError && <p role="alert" className="text-destructive">{query.error.message}</p>}
      {pending && <p className="text-amber-700">توجد محاولة إنشاء محفوظة للبند #{pending.itemId}. أعد المحاولة بنفس البيانات قبل بدء دفعة جديدة.</p>}
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr>{["البند / الوحدة", "المخطط", "قيد التنفيذ", "المكتمل", "متبقٍ للإنشاء", "الإجراءات"].map(label => <th key={label} className="p-2 text-right">{label}</th>)}</tr></thead>
        <tbody>{!query.isError && query.data?.map(row => <tr key={row.itemId} className="border-t">
          <td className="p-2">{row.productName} / {row.unit || "غير محددة"}{row.linkageStatus === "unknown" && <p className="text-xs text-amber-700">لا يوجد تنفيذ صريح — المقارنة غير متاحة</p>}</td>
          <td>{Number(row.plannedQuantity).toLocaleString("en-US")}</td><td>{quantityText(row.inProgressQuantity)}</td><td>{quantityText(row.completedQuantity)}</td><td>{quantityText(row.remainingQuantity)}</td>
          <td className="space-y-2 p-2">
            {canCreate("production") && <Button size="sm" variant="outline" disabled={!active || !row.productId || !row.unit || mutation.isPending || (pending ? pending.itemId !== row.itemId : row.remainingQuantity === 0)} onClick={() => open(row)}>{pending?.itemId === row.itemId ? "إعادة محاولة إنشاء الدفعة" : "إنشاء دفعة من البند"}</Button>}
            {row.batches.map(batch => <div key={batch.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span>#{batch.id} — {batch.quantity} — {batch.status === "finished" ? "مكتملة" : batch.status === "cancelled" ? "ملغاة" : "قيد التنفيذ"}</span>
              {batch.status === "in_progress" && active && canEdit("production") && <>
                <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate({ row, batchId: batch.id, action: "finish" })}>إتمام وصرف المواد</Button>
                <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => { if (window.confirm("إلغاء هذه الدفعة غير المكتملة وإعادة الكمية المتاحة للخطة؟")) mutation.mutate({ row, batchId: batch.id, action: "cancel" }); }}>إلغاء الدفعة</Button>
              </>}
            </div>)}
          </td>
        </tr>)}</tbody>
      </table></div>
      <Dialog open={!!selected} onOpenChange={open => { if (!open && !mutation.isPending) setSelected(null); }}>
        <DialogContent dir="rtl"><DialogHeader><DialogTitle>دفعة مرتبطة — {selected?.productName}</DialogTitle></DialogHeader>
          <p className="text-sm">وحدة التنفيذ: {selected?.unit}. تُجمّد الوصفة المعتمدة ولا يُرحّل مخزون قبل الإتمام.</p>
          <label>الكمية<Input lang="en" type="number" min={1} step={1} value={quantity} disabled={!!pending} onChange={e => setQuantity(e.target.value)} /></label>
          <label>تاريخ الإنتاج<Input lang="en" type="date" value={date} disabled={!!pending} onChange={e => setDate(e.target.value)} /></label>
          <label>الوجهة<select className="block w-full rounded border p-2" value={destination} disabled={!!pending} onChange={e => setDestination(e.target.value)}>
            <option value="display_bar">العرض</option><option value="kitchen_trolley">عربة المطبخ</option><option value="freezer">الفريزر</option><option value="refrigerator">الثلاجة</option>
          </select></label>
          <Button disabled={mutation.isPending || !Number.isInteger(Number(quantity)) || Number(quantity) <= 0} onClick={() => selected && mutation.mutate({ row: selected })}>{mutation.isPending ? "جارٍ التنفيذ…" : pending ? "إعادة المحاولة بنفس المفتاح" : "إنشاء الدفعة وتجميد الوصفة"}</Button>
        </DialogContent>
      </Dialog>
    </CardContent>
  </Card>;
}