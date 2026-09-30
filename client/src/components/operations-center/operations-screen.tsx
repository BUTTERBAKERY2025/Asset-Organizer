import type { ReactNode } from "react";
import { Radio } from "lucide-react";
import type { OperationsCenterResponse } from "@shared/operations-center";
import { time } from "./record-sheet";

/** Shared real page composition: live route and isolated visual proof use one header. */
export function OperationsCenterScreen({ data, status, actions, children }: {
  data?: OperationsCenterResponse;
  status: string;
  actions: ReactNode;
  children: ReactNode;
}) {
  return <main dir="rtl" className="page-container mx-auto max-w-[1550px] space-y-4 pb-8" data-testid="operations-center-page">
    <header className="border-b border-[#e7def0] pb-3 pt-2">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0"><p className="text-[11px] font-bold tracking-wide text-violet-700">BUTTER BAKERY · OPERATIONS</p><h1 className="text-2xl font-black text-[#302840]">مركز إدارة التشغيل</h1></div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
      {data && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="font-semibold text-[#302840]">يوم العمل: {data.businessDate}</span>
        <span>آخر تحديث: {time(data.generatedAt)} · السعودية</span>
        <span className="inline-flex items-center gap-1.5"><Radio className="h-3.5 w-3.5 text-primary" />{status}</span>
      </div>}
    </header>
    {children}
  </main>;
}