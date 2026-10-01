import { sandboxFetch as fetch } from "../../../../../_stubs/effects.ts";
import React, { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "../../../../../_stubs/query.ts";
import { Button } from "../ui/button.tsx";
import { Skeleton } from "../ui/skeleton.tsx";
import { cn } from "../../lib/utils.ts";
import { usePermissions } from "../../../../../_stubs/data.ts";
import type { KitchenOrderJourney } from "../../../../shared/central-kitchen-journey.ts";

const DeliveryWorkspace = React.lazy(() => import("../../pages/driver-deliveries.tsx").then(module => ({ default: module.DeliveryWorkspace })));
const FinishedGoodsWorkspace = React.lazy(() => import("../../pages/finished-goods-inventory.tsx").then(module => ({ default: module.FinishedGoodsWorkspace })));

export function OrderJourney({ orderId, status, onChanged, onStageSelected }: { orderId: number; status: string; onChanged: () => void; onStageSelected?: (key: string) => void }) {
  const client = useQueryClient();
  const { canView, canApprove } = usePermissions();
  const [expanded, setExpanded] = useState<"delivery" | "inventory" | "closed" | null>(null);
  const [deniedOrderId, setDeniedOrderId] = useState<number | null>(null);
  const query = useQuery<KitchenOrderJourney>({
    queryKey: ["/api/central-kitchen-order-journey", orderId],
    queryFn: async () => {
      const response = await fetch(`/api/central-kitchen-orders/${orderId}/journey`, { credentials: "include", cache: "no-store" });
      if (response.status === 403) {
        // Do not reuse cached stages after a denied refetch, including when
        // another observer shares this query key.
        setDeniedOrderId(orderId);
      }
      if (!response.ok) throw new Error(`${response.status}: تعذر تحميل مسار الطلب وصلاحيات أقسامه`);
      const result = await response.json() as KitchenOrderJourney;
      setDeniedOrderId(null);
      return result;
    },
    staleTime: 0,
    retry: false,
    refetchOnMount: "always",
    placeholderData: undefined,
  });
  const changed = () => {
    void client.invalidateQueries({ queryKey: ["/api/central-kitchen-order-journey", orderId] });
    onChanged();
  };
  if (deniedOrderId === orderId || query.isError) return <div role="status" className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">مسار الطلب الإضافي غير متاح حالياً؛ بنود الطلب وإجراءاته الأساسية متاحة في أقسامها. <Button variant="outline" size="sm" className="mr-2" onClick={() => void query.refetch()}>إعادة المحاولة</Button></div>;
  if (query.isPending || query.isFetching) return <div aria-label="تحميل مسار الطلب" className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>;
  if (!query.data || query.data.orderId !== orderId) return <div role="status" className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">مسار الطلب الإضافي غير متاح حالياً؛ بنود الطلب وإجراءاته الأساسية متاحة في أقسامها.</div>;
  const journey = query.data;
  const received = status.toLowerCase() === "received";
  const deliveryNeedsAction = journey.delivery !== null && journey.delivery.status !== "completed" && journey.delivery.status !== "cancelled";
  const deliveryOpen = expanded === "delivery" || (expanded === null && (status === "prepared" || status === "dispatched" || deliveryNeedsAction));
  const inventoryOpen = expanded === "inventory";
  const canSeeDelivery = journey.sections.delivery && journey.sectionState.delivery !== "restricted"
    && journey.sectionState.delivery !== "error" && (canView("delivery_tasks") || canApprove("delivery_tasks"));
  const canSeeInventory = canView("production") && journey.sections.inventory
    && journey.sectionState.inventory !== "restricted" && journey.sectionState.inventory !== "error";
  return <section aria-label="مسار العمل اليومي" className="space-y-3">
    <div className="rounded-xl border bg-background p-3">
      <h3 className="mb-2 text-sm font-semibold">مسار الطلب · من الطلب إلى البار</h3>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {journey.stages.map(stage => <li key={stage.key} className={cn("rounded-lg border p-2.5 text-xs", stage.status === "current" && "border-primary bg-primary/5", stage.status === "complete" && "border-emerald-200 bg-emerald-50/50", stage.status === "blocked" && "border-amber-300 bg-amber-50")}>
          <div className="flex items-center justify-between gap-1"><button type="button" className="font-semibold underline-offset-2 hover:underline focus-visible:underline" onClick={() => { if (stage.key === "delivery") setExpanded("delivery"); else if (stage.key === "inventory" || stage.key === "bar") setExpanded("inventory"); else onStageSelected?.(stage.key); }}>{stage.label}</button><span className="text-muted-foreground">{({ complete: "تم", current: "الآن", pending: "لاحقاً", blocked: "معلّق", unknown: "غير مؤكد" } as const)[stage.status]}</span></div>
          <p className="mt-1 leading-5">{stage.summary}</p>
          {stage.owner && stage.status !== "complete" && <p className="mt-1 font-medium text-primary">المسؤول: {stage.owner}</p>}
        </li>)}
      </ol>
    </div>
    {journey.warnings.length > 0 && <details className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs"><summary className="cursor-pointer font-medium">تنبيهات المسار ({journey.warnings.length})</summary><ul className="mt-2 list-inside list-disc space-y-1">{journey.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
    {canSeeDelivery && <section className="rounded-lg border p-3">
      <button type="button" className="font-semibold" aria-expanded={deliveryOpen} onClick={() => setExpanded(deliveryOpen ? "closed" : "delivery")}>التوصيل · التكليف والمحضر وتأكيد السائق والتسليم {deliveryOpen ? "−" : "+"}</button>
      {deliveryOpen && <div className="mt-3"><Suspense fallback={<Skeleton className="h-24" />}><DeliveryWorkspace key={`${orderId}:${journey.delivery?.id ?? "unassigned"}`} embedded sourceType="kitchen" sourceId={orderId} deliveryId={journey.delivery?.id} onChanged={changed} /></Suspense></div>}
    </section>}
    {received && journey.inventoryMode === "real" && canSeeInventory && <section className="rounded-lg border p-3">
      <button type="button" className="font-semibold" aria-expanded={inventoryOpen} onClick={() => setExpanded(inventoryOpen ? "closed" : "inventory")}>مخزون الفرع{journey.sections.bar ? " والبار" : ""} {inventoryOpen ? "−" : "+"}</button>
      {inventoryOpen && <>
      <p className="my-2 text-xs text-muted-foreground">هذا عرض لمخزون الفرع المشترك للأصناف المرتبطة، وليس إثباتاً لنقل بنود هذا الطلب تحديداً إلى البار. راجع الرصيد والحركات قبل أي إجراء.</p>
      <Suspense fallback={<Skeleton className="h-24" />}><FinishedGoodsWorkspace embedded initialBranchId={journey.destinationBranchId} productIds={journey.inventoryProductIds} onChanged={changed} /></Suspense>
      </>}
    </section>}
  </section>;
}