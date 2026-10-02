import { Copy, ShieldCheck } from "lucide-react";
import type { EmployeeAccountCreatedResponse } from "@shared/employee-account-delegation";
import { Button } from "@/components/ui/button";

/** Shared one-display handoff. No persistence, analytics, or hidden password DOM. */
export function EmployeeAccountCredentials({ credentials, copied, saved, onCopy, onSaved }: {
  credentials: EmployeeAccountCreatedResponse["credentials"];
  copied: string;
  saved: boolean;
  onCopy: (kind: "username" | "password") => void;
  onSaved: (saved: boolean) => void;
}) {
  return <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
    <p className="flex items-center gap-2 text-sm font-bold text-emerald-800"><ShieldCheck className="h-4 w-4" />حساب جاهز للتسليم للموظف</p>
    <p className="text-xs leading-6 text-emerald-900">تظهر بيانات الدخول مرة واحدة فقط. احفظها بطريقة آمنة قبل الإغلاق؛ لن يمكن عرض كلمة المرور مجددًا. لا تشاركها إلا مع الموظف المعني.</p>
    {(["username", "password"] as const).map(kind => <div key={kind}>
      <p className="mb-1 text-xs font-bold">{kind === "username" ? "اسم المستخدم المولّد" : "كلمة المرور القوية المولّدة"}</p>
      <div className="flex items-center gap-2 rounded-lg border bg-background px-3">
        <code dir="ltr" className="min-w-0 flex-1 select-text break-all py-3 text-left text-sm" data-testid={`generated-${kind}`}>{credentials[kind]}</code>
        <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={() => onCopy(kind)} aria-label={kind === "username" ? "نسخ اسم المستخدم" : "نسخ كلمة المرور"}><Copy className="h-4 w-4" /></Button>
      </div>
    </div>)}
    {copied && <p role="status" className="text-xs text-emerald-800">{copied}</p>}
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-bold text-emerald-900">
      <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={saved} onChange={event => onSaved(event.target.checked)} />
      حفظت بيانات الدخول بطريقة آمنة لتسليمها للموظف المعني
    </label>
  </section>;
}