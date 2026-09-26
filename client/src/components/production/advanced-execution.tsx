import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type Row = {
  itemId: number; productId: number | null; productName: string; unit: string | null;
  plannedQuantity: number; linkageStatus: "linked" | "unknown";
  completedQuantity: number | null; inProgressQuantity: number | null; remainingQuantity: number | null;
  batches: Array<{ id: number; quantity: number; status: string; requestItemId?: number | null }>;
  requestLink?: { requestItemId: number; requestOrderId: number; requestedQuantity: number; allocatedQuantity: number; reason: string } | null;
};
type Pending = { key: string; itemId: number; body: { quantity: number; unit: string; productionDate: string; destination: string } };
type DemandCandidate = {
  requestItemId: number; requestOrderId: number; requestNumber: string; requestBranchId: string;
  kitchenId: string; neededDate: string; productId: number; unit: string;
  requestedQuantity: number; availableQuantity: number; alreadyLinked: boolean;
};
type CandidatePage = {
  candidates: DemandCandidate[]; limit: number; offset: number; truncated: boolean;
  nextOffset: number | null; availabilityBasis: string;
};

export function validDemandLinkInput(quantity: number, requestItemId: number | null, reason: string): boolean {
  return Number.isSafeInteger(quantity) && quantity > 0 &&
    requestItemId !== null && Number.isSafeInteger(requestItemId) && requestItemId > 0 &&
    reason.trim().length > 0 && reason.trim().length <= 500;
}

export function isSelectedDemandCandidate(page: CandidatePage | undefined, offset: number, id: number | null): boolean {
  return !!page && page.offset === offset && id !== null &&
    page.candidates.some(candidate => candidate.requestItemId === id && !candidate.alreadyLinked);
}

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
  const [linkError, setLinkError] = useState("");
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
  const unlink = useMutation({
    mutationFn: async (row: Row) => {
      const response = await fetch(`/api/advanced-production-orders/${orderId}/items/${row.itemId}/request-link`, {
        method: "DELETE", credentials: "include", cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `تعذر إلغاء الربط (${response.status})`);
      }
    },
    onSuccess: () => {
      setLinkError("");
      void cache.invalidateQueries({ queryKey: [url] });
      void cache.invalidateQueries({ queryKey: ["/api/production/planning"] });
      toast({ title: "أُلغي ربط الطلب بالخطة" });
    },
    onError: (error: Error) => setLinkError(error.message),
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
      {linkError && <p role="alert" className="text-destructive">{linkError}</p>}
      {pending && <p className="text-amber-700">توجد محاولة إنشاء محفوظة للبند #{pending.itemId}. أعد المحاولة بنفس البيانات قبل بدء دفعة جديدة.</p>}
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr>{["البند / الوحدة", "سبب الخطة / طلب الفرع", "المخطط", "قيد التنفيذ", "المكتمل", "متبقٍ للإنشاء", "الإجراءات"].map(label => <th key={label} className="p-2 text-right">{label}</th>)}</tr></thead>
        <tbody>{!query.isError && query.data?.map(row => <tr key={row.itemId} className="border-t">
          <td className="p-2">{row.productName} / {row.unit || "غير محددة"}{row.linkageStatus === "unknown" && <p className="text-xs text-amber-700">لا يوجد تنفيذ صريح — المقارنة غير متاحة</p>}</td>
          <td className="p-2 text-xs">{row.requestLink ? <div className="space-y-1">
            <Link href={`/central-kitchen-orders?orderId=${row.requestLink.requestOrderId}`} className="font-medium text-primary underline">طلب الفرع #{row.requestLink.requestOrderId} · البند #{row.requestLink.requestItemId}</Link>
            <p>الكمية المرتبطة: {row.requestLink.allocatedQuantity} {row.unit} من أصل {row.requestLink.requestedQuantity} {row.unit}</p>
            <p>السبب: {row.requestLink.reason}</p>
            {canEdit("production") && row.batches.every(batch => batch.status === "cancelled") && ["approved", "in_progress"].includes(status) && <Button variant="outline" size="sm" disabled={unlink.isPending} onClick={() => { if (window.confirm("إلغاء الربط الصريح لهذا البند؟ لا يغيّر ذلك المخزون.")) { setLinkError(""); unlink.mutate(row); } }}>إلغاء ربط الطلب</Button>}
          </div> : <span className="text-muted-foreground">خطة مستقلة عن طلبات الفروع في النظام: لا يوجد ربط صريح. سبب السجلات التاريخية غير المرتبطة غير معروف.</span>}
            {!row.requestLink && canEdit("production") && ["approved", "in_progress"].includes(status) && row.batches.length === 0 &&
              <DemandLinkSelector orderId={orderId} row={row} executionUrl={url} />}
          </td>
          <td>{Number(row.plannedQuantity).toLocaleString("en-US")}</td><td>{quantityText(row.inProgressQuantity)}</td><td>{quantityText(row.completedQuantity)}</td><td>{quantityText(row.remainingQuantity)}</td>
          <td className="space-y-2 p-2">
            {canCreate("production") && <Button size="sm" variant="outline" disabled={!active || !row.productId || !row.unit || mutation.isPending || (pending ? pending.itemId !== row.itemId : row.remainingQuantity === 0)} onClick={() => open(row)}>{pending?.itemId === row.itemId ? "إعادة محاولة إنشاء الدفعة" : "إنشاء دفعة من البند"}</Button>}
            {row.batches.map(batch => <div key={batch.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span>#{batch.id} — {batch.quantity} — {batch.status === "finished" ? "مكتملة" : batch.status === "cancelled" ? "ملغاة" : "قيد التنفيذ"} · {batch.requestItemId ? `بند طلب الفرع #${batch.requestItemId} (رابط الدفعة المجمد)` : "لا رابط طلب فرع مجمد لهذه الدفعة؛ لا يُستنتج مصدر الدفعات التاريخية"}</span>
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

function DemandLinkSelector({ orderId, row, executionUrl }: { orderId: number; row: Row; executionUrl: string }) {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [requestItemId, setRequestItemId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const cache = useQueryClient();
  const { toast } = useToast();
  const base = `/api/advanced-production-orders/${orderId}/items/${row.itemId}/request-link`;
  const limit = 50;
  const candidates = useQuery<CandidatePage>({
    queryKey: [base, "candidates", offset],
    queryFn: async () => {
      const response = await fetch(`${base}/candidates?limit=${limit}&offset=${offset}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `تعذر تحميل الطلبات المؤهلة (${response.status})`);
      }
      return response.json();
    },
    enabled: open,
    staleTime: 0,
  });
  const link = useMutation({
    mutationFn: async () => {
      if (!validDemandLinkInput(row.plannedQuantity, requestItemId, reason)) throw new Error("اختر طلباً مؤهلاً وأدخل سبباً (حتى 500 حرف)؛ يجب أن تكون كمية الخطة عدداً صحيحاً موجباً.");
      if (!isSelectedDemandCandidate(candidates.data, offset, requestItemId))
        throw new Error("اختر بنداً مؤهلاً من الصفحة الحالية قبل الربط.");
      const response = await fetch(base, {
        method: "PUT", credentials: "include", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestItemId, reason: reason.trim() }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `تعذر ربط طلب الفرع (${response.status})`);
      }
    },
    onSuccess: () => {
      setError("");
      setOpen(false);
      setRequestItemId(null);
      setReason("");
      void cache.invalidateQueries({ queryKey: [executionUrl] });
      void cache.invalidateQueries({ queryKey: ["/api/production/planning"] });
      toast({ title: "رُبط بند الخطة بطلب الفرع صراحةً" });
    },
    onError: (failure: Error) => { setError(failure.message); void candidates.refetch(); },
  });
  const page = candidates.data?.offset === offset ? candidates.data : undefined;
  const changePage = (next: number) => { setRequestItemId(null); setError(""); setOffset(next); };
  return <div className="mt-2">
    <Button size="sm" variant="outline" onClick={() => { setOpen(value => !value); setRequestItemId(null); setError(""); setOffset(0); }}>
      {open ? "إغلاق اختيار الطلب" : "ربط بطلب فرع مؤهل"}
    </Button>
    {open && <div className="mt-2 min-w-[310px] max-w-lg space-y-2 rounded-md border bg-background p-3">
      <p className="font-medium">ربط كامل كمية البند: {row.plannedQuantity} {row.unit} (عدد صحيح، لا ربط جزئي)</p>
      <p className="text-muted-foreground">الطلبات المؤهلة لهذا المنتج والوحدة والمطبخ والفرع والتاريخ فقط. الكمية المتاحة تخص ارتباطات الإنتاج المحفوظة، وليست رصيد مخزون أو ضمان تنفيذ. يعاد التحقق عند الحفظ.</p>
      {candidates.isLoading || (candidates.isFetching && !page) ? <p role="status">جارٍ تحميل الطلبات المؤهلة…</p> :
        candidates.isError ? <div role="alert" className="text-destructive">{candidates.error.message}<Button size="sm" variant="outline" onClick={() => candidates.refetch()}>إعادة المحاولة</Button></div> :
        !page ? <p role="status">لا تتوفر نتائج لهذه الصفحة.</p> :
        <>
          {!page.candidates.length && <p>لا توجد طلبات مؤهلة في هذه الصفحة. تبقى الخطة مستقلة.</p>}
          <div className="max-h-72 space-y-2 overflow-y-auto">{page.candidates.map(candidate =>
            <label key={candidate.requestItemId} className="flex cursor-pointer items-start gap-2 rounded border p-2">
              <input type="radio" name={`demand-${orderId}-${row.itemId}`} checked={requestItemId === candidate.requestItemId} disabled={candidate.alreadyLinked} onChange={() => { setRequestItemId(candidate.requestItemId); setError(""); }} />
              <span>
                <strong>{candidate.requestNumber} · طلب #{candidate.requestOrderId} / بند #{candidate.requestItemId}</strong>
                <span className="block">المنتج #{candidate.productId} · {candidate.unit} · تاريخ الاحتياج {candidate.neededDate}</span>
                <span className="block">فرع الطالب {candidate.requestBranchId} · المطبخ {candidate.kitchenId}</span>
                <span className="block">المطلوب {candidate.requestedQuantity} · المتاح للربط {candidate.availableQuantity} {candidate.unit}{candidate.alreadyLinked ? " · مرتبط بالفعل بهذا البند" : ""}</span>
              </span>
            </label>)}</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={offset === 0 || candidates.isFetching} onClick={() => changePage(Math.max(0, offset - limit))}>السابق</Button>
            <span>صفحة {Math.floor(offset / limit) + 1}</span>
            <Button size="sm" variant="outline" disabled={!page.truncated || page.nextOffset === null || candidates.isFetching} onClick={() => page.nextOffset !== null && changePage(page.nextOffset)}>التالي</Button>
            {page.truncated && page.nextOffset === null && <span className="text-amber-700">بلغت النتائج حد الصفحات؛ لا يمكن تأكيد اكتمالها.</span>}
          </div>
        </>}
      <label className="block">سبب الربط
        <Input value={reason} maxLength={500} onChange={event => { setReason(event.target.value); setError(""); }} placeholder="سبب حاجة الفرع لهذا البند" />
      </label>
      <p className="text-muted-foreground">{reason.length}/500 حرف</p>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <Button size="sm" disabled={link.isPending || candidates.isFetching || !isSelectedDemandCandidate(page, offset, requestItemId) || !validDemandLinkInput(row.plannedQuantity, requestItemId, reason)} onClick={() => { setError(""); link.mutate(); }}>
        {link.isPending ? "جارٍ حفظ الربط…" : `ربط ${row.plannedQuantity} ${row.unit} بالطلب المحدد`}
      </Button>
    </div>}
  </div>;
}