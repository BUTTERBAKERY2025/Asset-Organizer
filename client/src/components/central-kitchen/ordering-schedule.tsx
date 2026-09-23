import React, { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { getOrderSchedule, getOrderingPolicy } from "@shared/central-kitchen-ordering-policy";
import { formatKitchenSaudiDateTime } from "./display-format";

export type KitchenOrderingPolicy = NonNullable<ReturnType<typeof getOrderingPolicy>>;
type Schedule = ReturnType<typeof getOrderSchedule>;

export function useKitchenOrderingPolicy(active: boolean) {
  const clock = useRef<{ timestamp: number; receivedAt: number } | null>(null);
  const query = useQuery<KitchenOrderingPolicy>({
    queryKey: ["/api/central-kitchen-orders/policy"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/central-kitchen-orders/policy");
      const policy = await response.json() as KitchenOrderingPolicy | null;
      const timestamp = policy ? Date.parse(policy.serverNow) : NaN;
      if (!policy || !Number.isFinite(timestamp) || !/^\d{4}-\d{2}-\d{2}$/.test(policy.defaultNeededDate)) {
        throw new Error("تعذر قراءة توقيت الخادم");
      }
      clock.current = { timestamp, receivedAt: performance.now() };
      return policy;
    },
    staleTime: 0,
    refetchInterval: active ? 15_000 : 60_000,
    refetchOnWindowFocus: "always",
  });
  // Never derive the Saudi day or deadline from the user's wall clock.
  const serverNow = clock.current
    ? new Date(clock.current.timestamp + Math.max(0, performance.now() - clock.current.receivedAt))
    : null;
  return { query, serverNow };
}

const displayTime = (value?: string) => value
  ? formatKitchenSaudiDateTime(new Date(`2000-01-01T${value}:00+03:00`), {
      hour: "numeric", minute: "2-digit", hour12: true,
    })
  : "—";

export function DailyOrderingNotice({ policy }: { policy?: Pick<KitchenOrderingPolicy, "requestDeadline" | "reviewTime" | "defaultNeededTime"> }) {
  return <section className="rounded-lg border bg-sky-50/50 p-4 text-sm" aria-label="مواعيد الطلب اليومية">
    <h2 className="font-semibold">مواعيد الطلب اليومية — بتوقيت السعودية</h2>
    <div className="mt-2 grid gap-2 sm:grid-cols-3">
      <p><strong>{displayTime(policy?.requestDeadline)}:</strong> آخر موعد لطلبات اليوم التالي.</p>
      <p><strong>{displayTime(policy?.reviewTime)}:</strong> موعد مراجعة المطبخ لطلبات الغد.</p>
      <p><strong>{displayTime(policy?.defaultNeededTime)}:</strong> وقت التسليم الافتراضي في يوم الحاجة.</p>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">الطلب المتأخر مسموح مع تنبيه. إرسال الطلب والاعتماد يتمان يدوياً؛ لا تُنشأ طلبات أو كميات تلقائياً.</p>
  </section>;
}

export function LateSubmissionBadge({ schedule }: { schedule?: Schedule }) {
  return schedule?.isLate
    ? <Badge variant="outline" className="mr-1 border-amber-300 bg-amber-50 text-amber-900">أُرسل بعد الموعد</Badge>
    : null;
}

function saudiTimestamp(value: string) {
  return formatKitchenSaudiDateTime(value, {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

export function OrderScheduleNotice({ schedule, preview = false }: { schedule?: Schedule; preview?: boolean }) {
  if (!schedule) return null;
  return <section className="rounded-lg border bg-muted/20 p-3 text-sm" aria-label="جدول الطلب">
    <div className="grid gap-2 sm:grid-cols-3">
      <p>موعد إرسال الطلب: <strong>{saudiTimestamp(schedule.cutoffAt)}</strong></p>
      <p>مراجعة المطبخ: <strong>{saudiTimestamp(schedule.reviewAt)}</strong></p>
      <p>التسليم المطلوب: <strong>{saudiTimestamp(schedule.deliveryAt)}</strong></p>
    </div>
    {schedule.isLate && <p role="status" className="mt-3 rounded bg-amber-50 p-2 text-amber-900">
      {preview
        ? "تجاوزت موعد الطلب لهذا التاريخ. يمكنك إرساله، وسيظهر للمطبخ أنه أُرسل بعد الموعد؛ يرجى التنسيق معه لتأكيد التجهيز."
        : "أُرسل الطلب بعد الموعد المحدد لتاريخ الحاجة الحالي. الطلب مسموح، وموعد مراجعة المطبخ لا يعني اعتماداً تلقائياً."}
    </p>}
    <p className="mt-2 text-xs text-muted-foreground">جميع المواعيد بتوقيت السعودية. {preview ? "التنبيه مبدئي بحسب توقيت الخادم؛ يُثبت وقت الإرسال عند الحفظ." : "التأخير محسوب من وقت الإرسال الأصلي وتاريخ الحاجة الحالي."}</p>
  </section>;
}