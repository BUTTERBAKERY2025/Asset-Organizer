import { AlertTriangle, ArrowUpLeft, Info } from "lucide-react";
import type { OperationsCard, OperationsMetric, OperationsQueueItem } from "@shared/operations-center";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { operationsSourceLabel } from "@/lib/operations-center-presentation";

export function time(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" }).format(date)
    : "غير متاح";
}
export const coverageLabel = (coverage: OperationsMetric["coverage"]) =>
  coverage === "complete" ? "تغطية كاملة" : coverage === "partial" ? "تغطية جزئية" : "غير متاح";
export function Metric({ metric }: { metric: OperationsMetric }) {
  return <div className="rounded-lg border border-border bg-card p-4" data-testid={`operations-metric-${metric.key}`}>
    <div className="flex items-start justify-between gap-3"><p className="text-sm font-bold text-muted-foreground">{metric.label}</p>
      <details className="relative shrink-0"><summary className="cursor-pointer list-none text-muted-foreground hover:text-primary" aria-label={`تعريف ومصدر ${metric.label}`}><Info className="h-4 w-4" /></summary>
        <div className="absolute left-0 z-20 w-60 max-w-[70vw] space-y-1 rounded-xl border border-border bg-popover p-3 text-xs leading-5 text-popover-foreground shadow-lg">
          <p>التعريف: {metric.definition}</p><p>المصدر: {metric.source}</p><p>الفترة: {metric.period}</p><p>النطاق: {metric.scope.join("، ") || "غير متاح"}</p><p>آخر تحديث: {time(metric.asOf)}</p><p>{coverageLabel(metric.coverage)}</p>
        </div></details></div>
    <p className="mt-2 text-xl font-black text-foreground">{metric.value === null || metric.coverage === "unavailable" ? "غير متاح" : `${new Intl.NumberFormat("ar-SA").format(metric.value)}${metric.unit ? ` ${metric.unit}` : ""}`}</p>
    {metric.coverage !== "complete" && <p className="mt-1 text-xs font-bold text-destructive">{coverageLabel(metric.coverage)}</p>}
  </div>;
}
export function RecordSheet({ record, card, branch, onClose, open, retry }: {
  record: OperationsQueueItem | null; card: OperationsCard | null; branch: string;
  onClose: () => void; open: (href: string, branchId: string, item?: OperationsQueueItem) => void; retry: () => void;
}) {
  return <Sheet open={!!record || !!card} onOpenChange={isOpen => { if (!isOpen) onClose(); }}>
    <SheetContent side="left" dir="rtl" className="!w-full !max-w-[500px] overflow-y-auto border-border bg-background p-0 text-foreground">
      <div className="border-b border-border bg-secondary px-5 pb-5 pt-8 sm:px-6">
        <p className="text-xs font-bold text-primary">{branch} / {record ? operationsSourceLabel(record.sourceType) : card?.title}</p>
        <SheetTitle className="mt-2 text-right text-xl font-black leading-relaxed text-foreground">{record?.title ?? card?.title ?? "تفاصيل المصدر"}</SheetTitle>
        <SheetDescription className="mt-2 text-right text-sm text-muted-foreground">{record ? "سجل متابعة محدد" : "مؤشرات المصدر للفرع المحدد"}</SheetDescription>
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        {record && <div className="divide-y divide-border rounded-xl border border-border bg-card text-sm">{[
          ["الحالة", record.status], ["الخطوة", record.step], ["جهة المتابعة", record.owner || "غير معروفة"],
          ["الإسناد الفردي", record.ownerId ? "مسجل" : "غير معروف"], ["الموعد", record.dueAt ? time(record.dueAt) : "غير معروف"],
        ].map(([label, value]) => <div key={label} className="flex justify-between gap-3 px-4 py-3"><span className="text-muted-foreground">{label}</span><strong className="text-left">{value}</strong></div>)}</div>}
        {card && (card.state === "error" ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><AlertTriangle className="mb-2 h-5 w-5" />{card.error || "تعذر جلب المصدر؛ المؤشرات غير متاحة."}<Button variant="outline" className="mt-3 block" onClick={retry}>إعادة المحاولة</Button></div> : <>
          {card.state !== "ready" && <p className="text-sm text-destructive">المصدر غير متاح. الغياب لا يعني صفرًا.</p>}
          {card.state === "ready" && <div className="grid gap-3 sm:grid-cols-2">{card.metrics.map((metric, index) => <Metric key={`${metric.key}-${index}`} metric={metric} />)}</div>}
          {card.alerts.length > 0 && <div className="rounded-xl border border-border bg-card p-4 text-sm"><h3 className="mb-2 font-bold">تنبيهات المصدر</h3>{card.alerts.map((alert, index) => <p key={`${alert.label}-${index}`} className="flex justify-between border-t border-border py-2"><span>{alert.label}</span><strong>{alert.count}</strong></p>)}</div>}
        </>)}
        {record && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">الهوية الفنية للسجل</summary><p className="mt-2">{record.sourceType} · {record.sourceId}</p></details>}
        {(record || card) && <Button className="min-h-11 w-full" onClick={() => record ? open(record.href, record.branchId, record) : card && open(card.href, card.branchId)}>فتح {record ? "السجل المحدد" : "المصدر"} <ArrowUpLeft className="mr-2 h-4 w-4" /></Button>}
      </div>
    </SheetContent>
  </Sheet>;
}