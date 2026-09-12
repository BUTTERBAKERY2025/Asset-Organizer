import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { RecipeMaterialsPreview, useRecipeMaterialRequirements } from "@/components/central-kitchen/recipe-materials";

type Batch = { id: number; orderItemId: number; quantity: number; productId?: number; productionDate: string | null; status: string | null };
export function LinkedBatches({ batches, orderId, kitchenAccessible }: { batches: Batch[]; orderId: string | number; kitchenAccessible: boolean }) {
  const { canEdit } = usePermissions();
  const { toast } = useToast();
  const client = useQueryClient();
  const [finishError, setFinishError] = useState<{ batchId: number; message: string } | null>(null);
  const finish = useMutation({
    mutationFn: async (id: number) => { const response = await apiRequest("POST", `/api/daily-production/batches/${id}/finish`); return response.json(); },
    onSuccess: () => { setFinishError(null); client.invalidateQueries({ queryKey: [`/api/central-kitchen-orders/${orderId}`] }); client.invalidateQueries({ queryKey: ["/api/central-kitchen-orders/operations"] }); client.invalidateQueries({ queryKey: ["/api/central-kitchen/production/batches"] }); toast({ title: "تم إنهاء دفعة الإنتاج" }); },
    onError: (error, id) => { const message = error instanceof Error ? error.message : "راجع الرصيد وصلاحية الإنتاج."; setFinishError({ batchId: id, message }); toast({ title: "تعذر إنهاء الدفعة", description: message, variant: "destructive" }); },
  });
  if (!batches.length) return null;
   return <section className="rounded-lg border border-violet-200 bg-violet-50/40 p-4"><h3 className="font-semibold">دفعات إنتاج مرتبطة</h3><p className="mb-3 text-xs text-muted-foreground">الدفعات قيد التنفيذ تغطي الاحتياج قبل الشحن. الدفعات السابقة لا تُعاد ربطها بوصفة بأثر رجعي.</p><div className="space-y-3">{batches.map(batch => <LinkedBatchRow key={batch.id} batch={batch} kitchenAccessible={kitchenAccessible} canFinish={canEdit("production")} finishPending={finish.isPending} finishError={finishError?.batchId === batch.id ? finishError.message : null} onFinish={() => finish.mutate(batch.id)} />)}</div></section>;
}

function LinkedBatchRow({ batch, kitchenAccessible, canFinish, finishPending, finishError, onFinish }: { batch: Batch; kitchenAccessible: boolean; canFinish: boolean; finishPending: boolean; finishError: string | null; onFinish: () => void }) {
  const materials = useRecipeMaterialRequirements({ batchId: batch.id });
  return <div className="rounded-md border bg-background p-3 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><span>دفعة #{batch.id} · {batch.quantity} · {batch.productionDate || "بدون تاريخ"}</span><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{batch.status || "غير محددة"}</span>{batch.status === "in_progress" && kitchenAccessible && canFinish && <Button size="sm" onClick={onFinish} disabled={finishPending}>{finishPending ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="ml-1 h-3.5 w-3.5" />}إنهاء الدفعة</Button>}</div></div>
    <div className="mt-3"><RecipeMaterialsPreview query={materials} batchId={batch.id} kitchenId={materials.data?.kitchenId} /></div>
    {finishError && <p className="mt-2 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800"><AlertTriangle className="mt-0.5 h-3.5 w-3.5" />{finishError}</p>}
  </div>;
}