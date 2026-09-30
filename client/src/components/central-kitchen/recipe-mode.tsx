import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

type Mode = { enabled: boolean; canManage: boolean; activationId: number | null;
  history: Array<{ id: number; enabled: boolean; actorId: string; reason: string; createdAt: string }> };
export function useRecipeMode(kitchenId: string) {
  return useQuery<Mode>({
    queryKey: ["/api/production/recipe-mode", kitchenId],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/production/recipe-mode?kitchenId=${encodeURIComponent(kitchenId)}`, { credentials: "include", signal });
      if (!response.ok) throw new Error("تعذر التحقق من وضع السحب على المكشوف");
      return response.json();
    }, enabled: !!kitchenId, retry: false, refetchInterval: 30000,
  });
}
export function RecipeModeControl({ kitchenId }: { kitchenId: string }) {
  const query = useRecipeMode(kitchenId);
  const client = useQueryClient();
  const [targetEnabled, setTargetEnabled] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const change = useMutation({
    mutationFn: async () => {
      if (targetEnabled === null) throw new Error("اختر التغيير المطلوب أولًا");
      await apiRequest("PATCH", "/api/production/recipe-mode", { kitchenId, enabled: targetEnabled, reason });
    },
    onSuccess: async () => {
      setTargetEnabled(null); setReason("");
      await client.invalidateQueries({ queryKey: ["/api/production/recipe-mode", kitchenId] });
    },
  });
  if (query.isError) return <p role="alert" className="text-sm text-destructive">تعذر التحقق من السحب على المكشوف. <Button variant="outline" onClick={() => void query.refetch()}>إعادة المحاولة</Button></p>;
  if (!query.data) return <p role="status" className="text-sm">جارٍ التحقق من سياسة الوصفات…</p>;
  const mode = query.data;
  return <div data-testid="production-recipe-mode" className="rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-2 text-sm">
    <p className="font-bold">السحب على المكشوف: {mode.enabled ? "مفعّل — إنتاج دون وصفة أو خصم خام" : "متوقف — تطبق سياسة الوصفات المعتادة"}</p>
    <p className="text-xs">التغيير للدفعات الجديدة فقط؛ الدفعات القائمة تحتفظ بوضع إنشائها. لا يعني هذا صرف مخزون سالبًا أو إثبات تكلفة خام. الإنتاج المستقل السابق يبقى وفق مساره الأصلي.</p>
    {mode.canManage && <Button variant="outline" disabled={change.isPending} onClick={() => { setTargetEnabled(targetEnabled === null ? !mode.enabled : null); setReason(""); change.reset(); }}>{mode.enabled ? "إيقاف السحب على المكشوف" : "تفعيل السحب على المكشوف"}</Button>}
    {targetEnabled !== null && mode.canManage && <div role="group" aria-label="تأكيد تغيير السحب على المكشوف" className="space-y-2">
      <p>{targetEnabled ? "تأكيد التفعيل: سيتمكن جميع المصرح لهم بالإنتاج في هذا المطبخ من إنشاء ناتج دون وصفة أو خصم خام، حتى عند وجود وصفة." : "تأكيد الإيقاف: ستحتاج الدفعات المرتبطة الجديدة للوصفة أو الاستثناء المعتاد."}</p>
      <label className="block">سبب التغيير<textarea className="block w-full rounded border bg-background p-2" value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} /></label>
      <Button disabled={reason.trim().length < 5 || change.isPending || query.isFetching} onClick={() => change.mutate()}>تأكيد التغيير</Button>
      <Button variant="ghost" disabled={change.isPending} onClick={() => setTargetEnabled(null)}>إلغاء</Button>
      {change.isError && <p role="alert" className="text-destructive">تعذر تغيير الوضع: {change.error.message}</p>}
    </div>}
    <details><summary className="min-h-10 cursor-pointer">سجل التغييرات — آخر 30 تغييرًا</summary>
      {mode.history.map(event => <p key={event.id} className="border-t py-2 break-words">#{event.id} · {event.enabled ? "تفعيل" : "إيقاف"} · {new Date(event.createdAt).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })} · المسؤول {event.actorId} · {event.reason}</p>)}
    </details>
  </div>;
}