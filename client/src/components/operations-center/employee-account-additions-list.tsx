import { ShieldCheck } from "lucide-react";
import { ACTION_LABELS, MODULE_LABELS } from "@shared/schema";
import type { EmployeeAccountAddition } from "@/lib/employee-account-additions";
import { additionDateLabel } from "@/lib/employee-account-additions";

export const additionModuleLabel = (module: string) => MODULE_LABELS[module as keyof typeof MODULE_LABELS] ?? module;
export const additionActionLabel = (action: string) => ACTION_LABELS[action as keyof typeof ACTION_LABELS] ?? action;

export function EmployeeAccountAdditionDetails({ addition, branchName }: { addition: EmployeeAccountAddition; branchName: string }) {
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <h4 className="text-xs font-bold">{additionModuleLabel(addition.module)} · {additionActionLabel(addition.action)}</h4>
      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${addition.allow ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"}`}>{addition.allow ? "منح مستقل" : "منع مستقل"}</span>
      {addition.integrity === "changed" && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-900">المحتوى تغيّر خارج سجل الإدارة</span>}
    </div>
    <p className="text-[11px] leading-6 text-muted-foreground">النطاق: {addition.scopeType === "global" ? "عام — غير مقيد بفرع الموظف" : <>فرع السجل: <bdi className="font-mono">{addition.branchId ?? "غير محدد"}</bdi> · فرع الموظف الحالي: {branchName}</>}<br />من: {additionDateLabel(addition.startsAt)} · حتى: {additionDateLabel(addition.endsAt)} · بتوقيت السعودية</p>
    <p className="break-words text-xs leading-6">{addition.reason}</p>
    <p className="text-[10px] leading-5 text-muted-foreground">البداية مشمولة والنهاية غير مشمولة. السجل لا يفعّل الوصول خارج فترة صلاحيته؛ قيود الدور والمسار والملكية تظل قائمة.</p>
  </div>;
}

/** No edit controls, request hooks, or mutation paths in the operations preview. */
export function EmployeeAccountAdditionsReadOnly({ additions, branchName }: { additions: EmployeeAccountAddition[]; branchName: string }) {
  return <section aria-label="الإضافات المستقلة المحفوظة" className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3" data-testid="employee-additions-readonly">
    <h3 className="flex items-center gap-2 text-sm font-bold text-amber-900"><ShieldCheck className="h-4 w-4" />الإضافات المستقلة · للقراءة فقط</h3>
    <p className="text-xs leading-6 text-amber-900">منح ومنع مستقلان عن القالب الأساسي. تبقى هذه السجلات ومددها كما هي عند تغيير القالب؛ لا تدخل في فرق الأساس ولا يمكن تعديلها هنا. إدارتها للأدمن فقط.</p>
    {!additions.length ? <p className="rounded-lg border border-dashed border-amber-200 p-3 text-xs text-muted-foreground">لا توجد إضافات مستقلة مُدارة في هذه المعاينة. لا يتم تبني الاستثناءات القديمة تلقائيًا.</p> : additions.map(addition => <article key={addition.id} className="rounded-lg border border-amber-200 bg-background p-3" data-testid={`readonly-addition-${addition.id}`}><EmployeeAccountAdditionDetails addition={addition} branchName={branchName} /></article>)}
  </section>;
}