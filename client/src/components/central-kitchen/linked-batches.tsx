import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Batch = { id: number; orderItemId: number; quantity: number; productionDate: string | null; status: string | null };
export function LinkedBatches({ batches, orderId, kitchenAccessible }: { batches: Batch[]; orderId: string | number; kitchenAccessible: boolean }) {
  const { canEdit } = usePermissions();
  const { toast } = useToast();
  const client = useQueryClient();
  const finish = useMutation({
    mutationFn: async (id: number) => { const response = await apiRequest("POST", `/api/daily-production/batches/${id}/finish`); return response.json(); },
    onSuccess: () => { client.invalidateQueries({ queryKey: [`/api/central-kitchen-orders/${orderId}`] }); client.invalidateQueries({ queryKey: ["/api/central-kitchen-orders/operations"] }); toast({ title: "تم إنهاء دفعة الإنتاج" }); },
    onError: (error) => toast({ title: "تعذر إنهاء الدفعة", description: error instanceof Error ? error.message : "راجع صلاحية الإنتاج.", variant: "destructive" }),
  });
  if (!batches.length) return null;
  return <section className="rounded-lg border border-violet-200 bg-violet-50/40 p-4"><h3 className="font-semibold">دفعات إنتاج مرتبطة</h3><p className="mb-3 text-xs text-muted-foreground">الدفعات قيد التنفيذ تغطي الاحتياج قبل الشحن.</p><div className="space-y-2">{batches.map(batch => <div key={batch.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"><span>دفعة #{batch.id} · {batch.quantity} · {batch.productionDate || "بدون تاريخ"}</span><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{batch.status || "غير محددة"}</span>{batch.status === "in_progress" && kitchenAccessible && canEdit("production") && <Button size="sm" onClick={() => finish.mutate(batch.id)} disabled={finish.isPending}>{finish.isPending ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="ml-1 h-3.5 w-3.5" />}إنهاء الدفعة</Button>}</div></div>)}</div></section>;
}