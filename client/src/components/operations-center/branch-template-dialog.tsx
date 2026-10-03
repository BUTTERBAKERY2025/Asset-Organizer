import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { MODULE_LABELS, ALL_ACTION_LABELS } from "@shared/schema";

export function BranchTemplateDialog({ employee, onClose }: { employee: { employeeId: number; employeeName: string; branchName: string }; onClose: () => void }) {
  const url = `/api/operations/employee-accounts/${employee.employeeId}/branch-template`;
  const cache = useQueryClient();
  const review = useQuery<any>({ queryKey: [url], queryFn: async () => (await apiRequest("GET", url)).json(), staleTime: 0, gcTime: 0, retry: false });
  const [choice, setChoice] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const selected = review.data?.templates.find((t: any) => `${t.templateId}:${t.version}` === choice);
  const reload = () => { setConfirmed(false); setChoice(""); setError(""); void review.refetch(); };
  const save = async () => {
    if (!selected || !confirmed || !reason.trim() || pending || review.isFetching) return;
    setPending(true); setError("");
    try {
      await apiRequest("POST", url, { templateId: selected.templateId, version: selected.version,
        branchId: review.data.branchId, expectedAssignmentRevision: review.data.expectedAssignmentRevision,
        reason: reason.trim() });
      setSaved(true);
      await cache.invalidateQueries({ queryKey: ["/api/operations/employee-accounts"] });
    } catch (e: any) { setError(e.message); setConfirmed(false); }
    finally { setPending(false); }
  };
  const list = (items: any[]) => items.length ? <ul className="space-y-2">{items.map(p => <li key={p.module}>
    {(MODULE_LABELS as any)[p.module] ?? p.module}: {p.actions.map((a: string) => (ALL_ACTION_LABELS as any)[a] ?? a).join("، ")}
  </li>)}</ul> : <p>لا صلاحيات أساسية في هذا الفرع.</p>;
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <DialogContent dir="rtl" className="max-h-[85dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>تخصيص قالب الفرع · {employee.employeeName}</DialogTitle></DialogHeader>
      {saved ? <><p role="status">حُفظ قالب {employee.branchName}. لم تتغير صلاحيات الفروع الأخرى أو حالة الحساب.</p><Button onClick={onClose}>إغلاق</Button></> : <>
        <p className="text-sm">التغيير يخص {employee.branchName} فقط. صلاحيات الفروع الأخرى والمنح والمنع المستقل تبقى كما هي. لا ينقل الموظف ولا يفتح الحساب المجمّد.</p>
        {review.isLoading && <p>جارٍ تحميل المعاينة…</p>}
        {review.error && <p role="alert" className="text-destructive">{(review.error as Error).message}</p>}
        {review.data && !review.error && <>
          {review.data.assignment && <p>القالب المسند لهذا الفرع: #{review.data.assignment.templateId} · الإصدار {review.data.assignment.version}</p>}
          <label>القالب المعتمد<select className="w-full rounded border p-2" value={choice} disabled={pending || review.isFetching}
            onChange={e => { setChoice(e.target.value); setConfirmed(false); }}>
            <option value="">اختر قالبًا</option>{review.data.templates.map((t: any) => <option key={`${t.templateId}:${t.version}`} value={`${t.templateId}:${t.version}`}>{t.name} · إصدار {t.version}</option>)}
          </select></label>
          {review.data.excludedTemplates.map((t: any, i: number) => <p key={i} className="text-xs text-amber-800">{t.name}: {t.reason}</p>)}
          {selected && <div className="grid grid-cols-2 gap-3 text-xs"><section><h3 className="font-bold mb-2">قبل · هذا الفرع</h3>{list(review.data.currentPermissions)}</section><section><h3 className="font-bold mb-2">بعد · هذا الفرع</h3>{list(selected.permissions)}</section></div>}
          {!!review.data.independentPermissions?.length && <section className="text-xs space-y-1"><h3 className="font-bold">المنح والمنع المستقل · لا يتغير</h3>{review.data.independentPermissions.map((p: any, i: number) => <p key={i}>
            {p.deny ? "منع" : "منح"} · {(MODULE_LABELS as any)[p.module] ?? p.module} · {(ALL_ACTION_LABELS as any)[p.action] ?? p.action} · {p.branchId ? `فرع ${p.branchId}` : "نطاق عام"}
          </p>)}</section>}
          <label>سبب الإسناد<Input value={reason} maxLength={2000} disabled={pending} onChange={e => { setReason(e.target.value); setConfirmed(false); }} /></label>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={!selected || !reason.trim() || pending || review.isFetching} onChange={e => setConfirmed(e.target.checked)} />راجعت صلاحيات هذا الفرع وأؤكد الإسناد.</label>
        </>}
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <div className="flex gap-2"><Button disabled={!confirmed || pending || review.isFetching || !!review.error || !!error} onClick={save}>{pending ? "جارٍ الحفظ…" : "حفظ قالب الفرع"}</Button>
          <Button variant="outline" disabled={pending || review.isFetching} onClick={reload}>تحديث المعاينة</Button>
          <Button variant="outline" disabled={pending} onClick={onClose}>إلغاء</Button></div>
      </>}
    </DialogContent>
  </Dialog>;
}