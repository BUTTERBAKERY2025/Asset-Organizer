import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { RecipeMaterialsPreview, useRecipeMaterialRequirements } from "@/components/central-kitchen/recipe-materials";
import { getFinishReadiness } from "@/components/central-kitchen/finish-readiness";
import { useVisualViewportDialog } from "@/components/central-kitchen/use-visual-viewport-dialog";
import { RecipeExceptions, useOrderRecipeExceptions } from "@/components/central-kitchen/recipe-exceptions";

type Batch = {
  id: number;
  orderItemId: number;
  quantity: number;
  productId?: number;
  productionDate: string | null;
  status: string | null;
};

type FinishError = {
  batchId: number;
  message: string;
  outcomeUnknown: boolean;
};

const FINISH_REFRESH_ROOTS = [
  "/api/central-kitchen-orders",
  "/api/central-kitchen/production/batches",
  "/api/daily-production/batches",
  "/api/daily-production/stats",
  "/api/daily-production/unfinished",
  "/api/finished-goods-inventory",
  "/api/production-inventory-logs",
  "/api/inventory",
  "/api/warehouse/items",
  "/api/warehouse/bundle",
  "/api/production/reports",
  "/api/production/operations-report",
  "/api/command-center",
  "/api/production/hub",
  "/api/advanced-production-orders",
] as const;

function finishErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "");
  const body = raw.replace(/^\d{3}:\s*/, "");
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed.error === "string") return parsed.error;
  } catch {
    // Network errors and non-JSON server responses use their original message.
  }
  return raw || "تعذر تأكيد إنهاء الدفعة. راجع الحالة ثم حاول مجدداً.";
}

function isNetworkFinishError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return /(failed to fetch|network|timed out|timeout|abort|انقطع الاتصال|تعذر الاتصال)/i.test(message);
}

async function refreshFinishRelatedQueries(client: ReturnType<typeof useQueryClient>): Promise<void> {
  await client.invalidateQueries({
    predicate: query => {
      const first = query.queryKey[0];
      return typeof first === "string" && FINISH_REFRESH_ROOTS.some(root =>
        first === root || first.startsWith(`${root}/`) || first.startsWith(`${root}?`),
      );
    },
  });
}

export function LinkedBatches({
  batches,
  orderId,
  kitchenAccessible,
}: {
  batches: Batch[];
  orderId: string | number;
  kitchenAccessible: boolean;
}) {
  const { canEdit, canView } = usePermissions();
  const exceptions = useOrderRecipeExceptions(orderId, canView("production"));
  const { toast } = useToast();
  const client = useQueryClient();
  const [finishError, setFinishError] = useState<FinishError | null>(null);
  const finish = useMutation({
    mutationFn: async (id: number) => {
      // Keep the existing idempotent server operation. The browser deliberately
      // does not invent a second key for this locked endpoint.
      const response = await apiRequest("POST", `/api/daily-production/batches/${id}/finish`);
      return response.json();
    },
    onSuccess: async () => {
      setFinishError(null);
      await refreshFinishRelatedQueries(client);
      toast({ title: "تم إنهاء دفعة الإنتاج" });
    },
    onError: (error, id) => {
      setFinishError({
        batchId: id,
        message: finishErrorMessage(error),
        outcomeUnknown: isNetworkFinishError(error),
      });
      toast({
        title: "تعذر تأكيد إنهاء الدفعة",
        description: isNetworkFinishError(error)
          ? "نتيجة الطلب غير معروفة؛ أعد التحقق من حالة الدفعة قبل إعادة المحاولة."
          : finishErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-3">
    {canView("production") && <RecipeExceptions orderId={orderId} />}
    {batches.length > 0 && <section className="rounded-lg border border-violet-200 bg-violet-50/40 p-4">
      <h3 className="font-semibold">دفعات إنتاج مرتبطة</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        الدفعات قيد التنفيذ تغطي الاحتياج قبل الشحن. الدفعات السابقة لا تُعاد
        ربطها بوصفة بأثر رجعي.
      </p>
      <div className="space-y-3">
        {batches.map(batch => (
          <LinkedBatchRow
            key={batch.id}
            batch={batch}
            isException={exceptions.data?.exceptions.some(exception => exception.consumedBatchId === batch.id) === true}
            orderId={orderId}
            kitchenAccessible={kitchenAccessible}
            canFinish={canEdit("production")}
            finishPending={finish.isPending}
            finishError={finishError?.batchId === batch.id ? finishError : null}
            onFinish={() => finish.mutate(batch.id)}
            onClearFinishError={() => setFinishError(current => current?.batchId === batch.id ? null : current)}
          />
        ))}
      </div>
    </section>}
    </div>
  );
}

function LinkedBatchRow({
  batch,
  isException,
  orderId,
  kitchenAccessible,
  canFinish,
  finishPending,
  finishError,
  onFinish,
  onClearFinishError,
}: {
  batch: Batch;
  isException: boolean;
  orderId: string | number;
  kitchenAccessible: boolean;
  canFinish: boolean;
  finishPending: boolean;
  finishError: FinishError | null;
  onFinish: () => void;
  onClearFinishError: () => void;
}) {
  const client = useQueryClient();
  const materials = useRecipeMaterialRequirements({ batchId: batch.id });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const confirmDialogStyle = useVisualViewportDialog({ open: confirmOpen, maxHeight: 820, viewportFraction: 0.94 });
  const readiness = getFinishReadiness({
    data: materials.data,
    isLoading: materials.isLoading,
    isFetching: materials.isFetching || refreshing,
    isError: materials.isError,
    error: materials.error,
  });
  const isInProgress = batch.status === "in_progress";

  const refreshRequirements = async (openConfirmation: boolean) => {
    if (refreshing) return false;
    setRefreshing(true);
    try {
      const result = await materials.refetch();
      if (result.isError || !result.data) return false;
      onClearFinishError();
      const freshReadiness = getFinishReadiness({
        data: result.data,
        isLoading: false,
        isFetching: false,
        isError: false,
      });
      if (openConfirmation && freshReadiness.canFinish) setConfirmOpen(true);
      return true;
    } catch {
      // The query's error state is rendered below and keeps the row visible.
      return false;
    } finally {
      setRefreshing(false);
    }
  };

  const recheckBatch = async () => {
    const checked = await refreshRequirements(false);
    if (checked) {
      await client.refetchQueries({ queryKey: [`/api/central-kitchen-orders/${orderId}`] });
    }
  };

  const requestFinishConfirmation = async () => {
    if (
      !isInProgress
      || !kitchenAccessible
      || !canFinish
      || finishPending
      || refreshing
      || readiness.kind === "shortage"
      || readiness.kind === "already_consumed"
      || readiness.kind === "inconsistent"
    ) return;
    await refreshRequirements(true);
  };

  const canConfirm = !finishPending && !refreshing && readiness.canFinish;
  const recipeBacked = readiness.kind === "ready"
    || readiness.kind === "already_consumed"
    || (materials.data?.recipeBacked === true);

  return (
    <div className="rounded-md border bg-background p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>دفعة #{batch.id} · {batch.quantity} · {batch.productionDate || "بدون تاريخ"}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{batch.status || "غير محددة"}</span>
          {isInProgress && kitchenAccessible && canFinish && (
            <Button
              size="sm"
              onClick={() => void requestFinishConfirmation()}
              disabled={finishPending || refreshing || !readiness.canFinish}
              title={readiness.reason}
            >
              {finishPending || refreshing
                ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" />
                : <CheckCircle2 className="ml-1 h-3.5 w-3.5" />}
              إنهاء الدفعة
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3">
        <RecipeMaterialsPreview
          query={materials}
          batchId={batch.id}
          kitchenId={materials.data?.kitchenId}
          onRetry={() => void refreshRequirements(false)}
        />
      </div>

      {isInProgress && readiness.kind === "shortage" && (
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">لا يمكن إنهاء الدفعة الآن</p>
            <p className="mt-1">يوجد نقص في رصيد مواد المطبخ. اطلب التوريد من الروابط أعلاه ثم أعد التحقق؛ المعاينة لا تحجز الرصيد.</p>
          </div>
          <Button type="button" size="sm" variant="outline" disabled={refreshing} onClick={() => void refreshRequirements(false)}>إعادة التحقق</Button>
        </div>
      )}
      {isInProgress && readiness.kind === "already_consumed" && (
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">تم صرف مواد هذه الدفعة بالفعل</p>
            <p className="mt-1">أُوقف الإنهاء من هذا العرض حتى لا يتكرر الأثر الفعلي. أعد تحديث تفاصيل الطلب لمعرفة الحالة الحالية.</p>
          </div>
          <Button type="button" size="sm" variant="outline" disabled={refreshing} onClick={() => void recheckBatch()}>إعادة قراءة الحالة</Button>
        </div>
      )}
      {isInProgress && readiness.kind === "inconsistent" && (
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">بيانات الوصفة غير متسقة</p>
            <p className="mt-1">{readiness.reason || "لا يمكن تأكيد أثر المخزون من بيانات غير مكتملة."} أعد التحقق أو اطلب مراجعة السجل.</p>
          </div>
          <Button type="button" size="sm" variant="outline" disabled={refreshing} onClick={() => void refreshRequirements(false)}>إعادة التحقق</Button>
        </div>
      )}

      {finishError && (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              <p className="font-semibold">
                {finishError.outcomeUnknown
                  ? "نتيجة طلب الإنهاء غير معروفة"
                  : "لم يتم تأكيد إنهاء الدفعة"}
              </p>
              <p className="mt-1">
                {finishError.outcomeUnknown
                  ? "تبقى الدفعة معروضة قيد التنفيذ حتى تنجح إعادة قراءة الحالة من الخادم. لا يفترض هذا العرض أن الرصيد حُجز أو صُرف."
                  : "تبقى الدفعة قيد التنفيذ ويمكنك مراجعة السبب ثم المحاولة مجدداً."}
              </p>
              <p className="mt-1 text-rose-800/80">{finishError.message}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={refreshing}
              onClick={() => void recheckBatch()}
            >
              {refreshing && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" />}
              {!refreshing && <RefreshCw className="ml-1 h-3.5 w-3.5" />}
              إعادة التحقق
            </Button>
            {isInProgress && kitchenAccessible && canFinish && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={refreshing || finishPending || !readiness.canFinish}
                onClick={() => void requestFinishConfirmation()}
              >
                إعادة المحاولة بعد التحقق
              </Button>
            )}
          </div>
        </div>
      )}

      {isInProgress && (readiness.kind === "error" || readiness.kind === "loading") && !finishError && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
          <span>{readiness.kind === "loading" ? "جارٍ تحميل حالة مواد الدفعة؛ لا يمكن الإنهاء قبل اكتمالها." : "لا يمكن الإنهاء قبل نجاح قراءة احتياج المواد."}</span>
          {readiness.kind === "error" && <Button type="button" size="sm" variant="outline" disabled={refreshing} onClick={() => void refreshRequirements(false)}>إعادة التحقق</Button>}
        </div>
      )}

      {isInProgress && (readiness.kind === "ready" || readiness.kind === "legacy") && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent dir="rtl" style={{ ...confirmDialogStyle, width: "calc(100vw - 1rem)", maxWidth: "42rem", display: "flex", flexDirection: "column" }} className="box-border min-w-0 gap-0 overflow-hidden p-0">
            <AlertDialogHeader className="shrink-0 border-b px-4 py-3 text-right sm:px-6">
              <AlertDialogTitle>تأكيد إنهاء دفعة الإنتاج #{batch.id}</AlertDialogTitle>
              <AlertDialogDescription>
                هذا إجراء لا يمكن التراجع عنه. راجع أثر المخزون ثم أكد الإنهاء صراحةً.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            {recipeBacked && materials.data?.recipeBacked && materials.data.recipe ? (
              <>
                <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-950">
                  <p className="font-semibold">الأثر الفعلي غير القابل للعكس</p>
                  <p className="mt-1">سيُخصم احتياج الوصفة من مخزون مواد المطبخ، ويُضاف ناتج الدفعة {materials.data.batchQuantity} {materials.data.recipe.outputUnit} إلى مخزون المنتج النهائي. المعاينة لا تحجز رصيداً؛ الخادم يعيد التحقق ويطبق الحركة ذرّياً، وقد يرفض العملية إذا تغيّر الرصيد.</p>
                </div>
                <div className="space-y-3 md:hidden" aria-label="مواد الوصفة التي ستخصم">
                  {materials.data.requirements.map(item => (
                    <article key={item.warehouseItemId} className="rounded-lg border bg-background p-3">
                      <h3 className="break-words text-sm font-semibold">{item.materialName}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">الوحدة: {item.unit}</p>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-md bg-muted/40 p-2"><dt className="text-muted-foreground">سيُخصم فعلياً</dt><dd className="mt-1 font-mono font-semibold">{item.requiredQuantity} {item.unit}</dd></div>
                        <div className="rounded-md bg-muted/40 p-2"><dt className="text-muted-foreground">مخزون المطبخ الحالي</dt><dd className="mt-1 font-mono font-semibold">{item.currentQuantity} {item.unit}</dd></div>
                        <div className="rounded-md bg-muted/40 p-2"><dt className="text-muted-foreground">المتاح بعد الحجوزات</dt><dd className="mt-1 font-mono font-semibold">{item.availableQuantity} {item.unit}</dd></div>
                        <div className={item.shortageQuantity === "0.000000" ? "rounded-md bg-emerald-50 p-2 text-emerald-800" : "rounded-md bg-rose-50 p-2 text-rose-800"}><dt>النقص</dt><dd className="mt-1 font-mono font-semibold">{item.shortageQuantity} {item.unit}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto rounded-md border md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="p-2 text-right font-medium">المادة</th>
                        <th className="p-2 text-right font-medium">سيُخصم فعلياً</th>
                        <th className="p-2 text-right font-medium">مخزون المطبخ الحالي</th>
                        <th className="p-2 text-right font-medium">المتاح بعد الحجوزات</th>
                        <th className="p-2 text-right font-medium">النقص</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materials.data.requirements.map(item => (
                        <tr key={item.warehouseItemId} className="border-t">
                          <td className="p-2 font-medium">{item.materialName}<span className="block text-xs text-muted-foreground">{item.unit}</span></td>
                          <td className="p-2 font-mono">{item.requiredQuantity} {item.unit}</td>
                          <td className="p-2 font-mono">{item.currentQuantity} {item.unit}</td>
                          <td className="p-2 font-mono">{item.availableQuantity} {item.unit}</td>
                          <td className={`p-2 font-mono ${item.shortageQuantity === "0.000000" ? "text-emerald-700" : "font-semibold text-rose-700"}`}>{item.shortageQuantity} {item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">الوصفة المعتمدة #{materials.data.recipe.recipeId} · الإصدار {materials.data.recipe.recipeVersion} · كمية الناتج {materials.data.batchQuantity} {materials.data.recipe.outputUnit}</p>
              </>
            ) : (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-semibold">{isException ? "دفعة باستثناء معتمد دون وصفة" : "دفعة غير مرتبطة بوصفة"}</p>
                <p className="mt-1">يسجل الإنهاء ناتج الدفعة ({batch.quantity}) في مخزون المنتج النهائي فقط. لا توجد لقطة مواد أو إثبات لاستهلاكها، ولن يُخصم مخزون خام.</p>
              </div>
            )}
            {finishError && <div role="alert" className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-950"><p className="font-semibold">لم يتم إنهاء الدفعة</p><p className="mt-1">{finishError.outcomeUnknown ? "نتيجة الطلب غير معروفة. أغلق المراجعة واستخدم «إعادة التحقق» قبل أي محاولة أخرى." : finishError.message}</p></div>}
            </div>
            <AlertDialogFooter className="grid shrink-0 grid-cols-2 gap-2 border-t bg-background px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:flex sm:px-6">
              <AlertDialogCancel className="min-h-11" disabled={finishPending}>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                className="min-h-11"
                disabled={!canConfirm}
                onClick={event => {
                  event.preventDefault();
                  if (!canConfirm) {
                    return;
                  }
                  onFinish();
                }}
              >
                {finishPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                تأكيد الإنهاء
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}