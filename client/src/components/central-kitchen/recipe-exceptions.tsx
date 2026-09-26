import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RecipeException } from "@shared/recipe-exceptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { exceptionDecisionPayload, exceptionRequestPayload, matchingApprovedException, normalizeException, type ExceptionBinding } from "./recipe-exception-flow";
import { formatKitchenSaudiDateTime } from "./display-format";

export type ExceptionList = { exceptions: RecipeException[]; canApprove: boolean };
export const exceptionQueryKey = (orderId: number | string) => [`/api/central-kitchen-orders/${orderId}/recipe-exceptions`];
const showTime = (value: string | null) => value ? formatKitchenSaudiDateTime(value, { dateStyle: "medium", timeStyle: "short" }) : "—";

export function useOrderRecipeExceptions(orderId: number | string, enabled = true) {
  return useQuery<ExceptionList>({
    queryKey: exceptionQueryKey(orderId),
    enabled,
    queryFn: async () => {
      const response = await fetch(`/api/central-kitchen-orders/${orderId}/recipe-exceptions`, { credentials: "include", cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "تعذر تحميل استثناءات الوصفة.");
      }
      const body = await response.json() as { exceptions: Array<Record<string, unknown>>; canApprove: boolean };
      if (!Array.isArray(body.exceptions) || typeof body.canApprove !== "boolean") throw new Error("استجابة استثناءات الوصفة غير صالحة.");
      return { exceptions: body.exceptions.map(normalizeException), canApprove: body.canApprove };
    },
  });
}

export function RecipeExceptions({ orderId, binding, allowRequest = false }: {
  orderId: number | string;
  binding?: ExceptionBinding | null;
  allowRequest?: boolean;
}) {
  const client = useQueryClient();
  const { toast } = useToast();
  const query = useOrderRecipeExceptions(orderId);
  const [reason, setReason] = useState("");
  const [reviewReasons, setReviewReasons] = useState<Record<number, string>>({});
  const invalidate = () => void client.invalidateQueries({ queryKey: exceptionQueryKey(orderId) });
  const request = useMutation({
    mutationFn: async () => {
      if (!binding || !Number.isInteger(binding.quantity) || binding.quantity < 1 || !binding.productionDate || !reason.trim()) throw new Error("أدخل كمية صحيحة وتاريخ إنتاج وسبب الاستثناء.");
      const response = await apiRequest("POST", `/api/central-kitchen-orders/${binding.orderId}/items/${binding.itemId}/recipe-exceptions`, exceptionRequestPayload(binding, reason));
      return response.json();
    },
    onSuccess: () => { setReason(""); invalidate(); toast({ title: "أُرسل طلب الاستثناء للمراجعة" }); },
    onError: error => toast({ title: "تعذر طلب الاستثناء", description: error instanceof Error ? error.message : "حاول مجدداً.", variant: "destructive" }),
  });
  const decision = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "approve" | "reject" }) => {
      const reviewReason = reviewReasons[id]?.trim();
      if (!reviewReason) throw new Error("سبب القرار مطلوب.");
      const response = await apiRequest("POST", `/api/central-kitchen-orders/${orderId}/recipe-exceptions/${id}/${action}`, exceptionDecisionPayload(reviewReason));
      return response.json();
    },
    onSuccess: (_, variables) => {
      setReviewReasons(current => ({ ...current, [variables.id]: "" }));
      invalidate();
      toast({ title: variables.action === "approve" ? "تم اعتماد الاستثناء" : "تم رفض الاستثناء" });
    },
    onError: error => toast({ title: "تعذر تسجيل القرار", description: error instanceof Error ? error.message : "حاول مجدداً.", variant: "destructive" }),
  });
  const statusLabels = { pending: "بانتظار مراجعة مسؤول الإنتاج", approved: "معتمد للاستخدام مرة واحدة", rejected: "مرفوض", consumed: "استُخدم في دفعة" };
  return <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-4" dir="rtl">
    <h3 className="font-semibold">استثناءات الإنتاج دون وصفة</h3>
    <p className="text-xs text-muted-foreground">الاستثناء لا يُثبت وصفة ولا يسجل استهلاك مواد خام. يلزم اعتماد مسؤول الإنتاج قبل إنشاء دفعة دون وصفة.</p>
    {allowRequest && binding && <div className="space-y-2 rounded-md border bg-background p-3 text-sm">
      <p className="font-medium">طلب استثناء للبند #{binding.itemId} · {binding.quantity} {binding.unit} · {binding.productionDate}</p>
      <Label htmlFor={`recipe-exception-reason-${orderId}`}>سبب طلب الإنتاج دون وصفة</Label>
      <Textarea id={`recipe-exception-reason-${orderId}`} value={reason} maxLength={2000} onChange={event => setReason(event.target.value)} placeholder="وضح سبب الحاجة لهذا الاستثناء" />
      <Button type="button" variant="outline" disabled={request.isPending || !reason.trim() || !Number.isInteger(binding.quantity) || binding.quantity < 1 || !binding.productionDate} onClick={() => request.mutate()}>إرسال للموافقة</Button>
    </div>}
    {query.isLoading && <p className="text-sm">جارٍ تحميل طلبات الاستثناء...</p>}
    {query.isError && <div role="alert" className="text-sm text-rose-800">{query.error.message} <Button variant="outline" size="sm" onClick={() => void query.refetch()}>إعادة المحاولة</Button></div>}
    {query.data?.exceptions.length === 0 && <p className="text-sm text-muted-foreground">لا توجد طلبات استثناء لهذا الطلب.</p>}
    {query.data?.exceptions.map(exception => <article key={exception.id} className="space-y-2 rounded-md border bg-background p-3 text-sm">
      <p className="font-semibold">استثناء #{exception.id} · بند #{exception.itemId} · {exception.quantity} {exception.unit} · {exception.productionDate}</p>
      <p>{statusLabels[exception.status]}{binding && matchingApprovedException([exception], binding) ? " · مطابق للدفعة الحالية" : ""}</p>
      {exception.status === "pending" && <p>السبب: {exception.reason}</p>}
      <details className="rounded border p-2">
        <summary className="cursor-pointer">تفاصيل {exception.status === "pending" ? "الطلب" : "الاستثناء وسجل المراجعة"}</summary>
        {exception.status !== "pending" && <p className="mt-2">السبب: {exception.reason}</p>}
        <p className="mt-2 text-xs text-muted-foreground">الطلب: {exception.requestedBy} · {showTime(exception.requestedAt)}</p>
        {exception.reviewedBy && <p className="text-xs text-muted-foreground">المراجع: {exception.reviewedBy} · {showTime(exception.reviewedAt)} · سبب القرار: {exception.reviewReason}</p>}
        {exception.consumedBatchId && <p className="text-xs text-muted-foreground">استُخدم في الدفعة #{exception.consumedBatchId} · {showTime(exception.consumedAt)}</p>}
      </details>
      {exception.status === "pending" && query.data?.canApprove && <div className="space-y-2">
        <Label htmlFor={`exception-decision-${exception.id}`}>سبب قرار المراجعة</Label>
        <Input id={`exception-decision-${exception.id}`} maxLength={2000} value={reviewReasons[exception.id] || ""} onChange={event => setReviewReasons(current => ({ ...current, [exception.id]: event.target.value }))} />
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={decision.isPending || !reviewReasons[exception.id]?.trim()} onClick={() => decision.mutate({ id: exception.id, action: "approve" })}>اعتماد</Button>
          <Button type="button" size="sm" variant="destructive" disabled={decision.isPending || !reviewReasons[exception.id]?.trim()} onClick={() => decision.mutate({ id: exception.id, action: "reject" })}>رفض</Button>
        </div>
      </div>}
    </article>)}
  </section>;
}