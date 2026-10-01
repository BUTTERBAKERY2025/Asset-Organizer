import { MapPin, ShieldAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { operationsQueryError } from "@/lib/operations-payroll-report";
import type { operationsBranchPrerequisite } from "@/lib/operations-employees";

export function OperationsBranchPrerequisite({ state, error, retry }: {
  state: Exclude<ReturnType<typeof operationsBranchPrerequisite>, "ready">;
  error: unknown; retry: () => unknown;
}) {
  const copy = {
    loading: ["جار التحقق من الفروع", "نحمّل نطاق الفروع المصرّح به قبل عرض بيانات الموظفين."],
    error: ["تعذر تحميل الفروع", operationsQueryError(error) || "تحقق من الاتصال وأعد المحاولة."],
    denied: ["الفرع غير متاح ضمن صلاحياتك", "اختر فرعًا مسموحًا. لم نعرض بيانات فرع آخر بدلًا منه."],
    "no-grants": ["لا توجد فروع مصرّح بها", "راجع مسؤول الصلاحيات لإتاحة فروع التشغيل؛ لا تشمل هذه الصفحة الإدارة العامة."],
    choose: ["اختر الفرع للبدء", "حدد فرعًا من القائمة أعلاه لعرض دليله ومباشراته وسجل النقل. لن نختار فرعًا نيابةً عنك."],
  }[state];
  const Icon = state === "denied" ? ShieldAlert : state === "choose" ? MapPin : Users;
  return <section role={state === "error" || state === "denied" ? "alert" : "status"}
    className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center">
    <span className="mb-4 rounded-2xl bg-primary/10 p-4 text-primary"><Icon className="size-7" /></span>
    <h2 className="text-xl font-bold">{copy[0]}</h2>
    <p className="mt-2 max-w-lg text-sm leading-7 text-muted-foreground">{copy[1]}</p>
    {(state === "error" || state === "denied") && <Button className="mt-4" variant="outline" onClick={() => { void retry(); }}>إعادة التحقق من الصلاحيات</Button>}
  </section>;
}