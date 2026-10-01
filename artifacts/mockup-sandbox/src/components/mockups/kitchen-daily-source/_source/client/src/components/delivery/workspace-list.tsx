import { previewWindow as window } from "../../../../../_stubs/effects.ts";
import React, { useEffect, useState } from "react";
import { ArrowLeft, CircleAlert, ClipboardList, RotateCw, Search, X } from "lucide-react";
import { Badge } from "../ui/badge.tsx";
import { Button } from "../ui/button.tsx";
import { Input } from "../ui/input.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.tsx";
import { Skeleton } from "../ui/skeleton.tsx";
import { deliveryDate, deliverySourceLabel, deliveryStatus, deliveryTiming, deliveryTransportLabel } from "./delivery-ui.tsx";
import { useDeliveryWorkspace } from "../../hooks/use-delivery-workspace.ts";
import type { WorkspaceCarrier, WorkspaceFilters, WorkspaceStatus } from "../../hooks/use-delivery-workspace.ts";
import type { Delivery } from "../../pages/driver-deliveries.tsx";
import "./workspace.css";

const statusOptions: Array<{ value: WorkspaceStatus; label: string }> = [
  { value: "active", label: "النشطة" }, { value: "all", label: "جميع المهام" },
  { value: "assigned", label: "بانتظار البدء" }, { value: "in_transit", label: "في الطريق" },
  { value: "awaiting_receipt", label: "بانتظار الإيصال" }, { value: "receipt_approved", label: "معتمدة" },
  { value: "failed", label: "المتعذرة" }, { value: "completed", label: "المكتملة" }, { value: "cancelled", label: "الملغاة" },
];
const initialFilters: WorkspaceFilters = { q: "", status: "active", carrier: "all", sourceBranchId: "all", destinationBranchId: "all", page: 1, pageSize: 25 };
const countText = (value: number) => new Intl.NumberFormat("en-US").format(value);

export function WorkspaceList({ onOpen, now }: { onOpen: (delivery: Delivery) => void; now: number }) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<WorkspaceFilters>(initialFilters);
  const workspace = useDeliveryWorkspace(filters);
  useEffect(() => {
    const timer = window.setTimeout(() => setFilters(current => current.q === search.trim() ? current : { ...current, q: search.trim().slice(0, 160), page: 1 }), 320);
    return () => window.clearTimeout(timer);
  }, [search]);
  const change = (patch: Partial<WorkspaceFilters>) => setFilters(current => ({ ...current, ...patch, page: 1 }));
  const clear = () => { setSearch(""); setFilters(initialFilters); };
  const data = workspace.isError || workspace.isFetching ? undefined : workspace.data;
  const counts = data?.counts;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const hasFilters = !!search || filters.status !== "active" || filters.carrier !== "all" || filters.sourceBranchId !== "all" || filters.destinationBranchId !== "all";
  const card = (item: Delivery) => {
    const timing = deliveryTiming(item, now);
    return <article key={item.id} className="dw-mobile-card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><p className="truncate font-bold">{item.sourceLabel}</p><p className="mt-1 text-xs text-muted-foreground">{deliverySourceLabel(item.sourceType)} · #{item.id}</p></div>
        <Badge variant="outline" className={`shrink-0 ${deliveryStatus(item.status).className}`}>{deliveryStatus(item.status).label}</Badge>
      </div>
      <p className="text-sm font-medium">{item.sourceBranchName} <ArrowLeft className="mx-1 inline h-3.5 w-3.5 text-teal-700" /> {item.destinationBranchName}</p>
      <div className="grid grid-cols-2 gap-2 border-t pt-3 text-xs">
        <div className="min-w-0"><span className="text-muted-foreground">النقل / البوليصة</span><p className="mt-1 truncate font-medium" title={deliveryTransportLabel(item)}>{deliveryTransportLabel(item)}</p></div>
        <div><span className="text-muted-foreground">الموعد</span><p className="mt-1 font-medium">{deliveryDate(item.scheduledAt || item.createdAt)}</p></div>
      </div>
      {timing !== "on_time" && <p className="text-xs font-semibold text-rose-700">{timing === "escalated" ? "متأخرة أكثر من ساعة" : "متأخرة عن الموعد"}</p>}
      <Button className="min-h-11 w-full" onClick={() => onOpen(item)}>فتح المهمة</Button>
    </article>;
  };
  return <section className="delivery-workspace dw-shell space-y-4" aria-label="قائمة مهام التوصيل">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div><p className="text-xs font-semibold tracking-wide text-teal-800">لوحة العمليات</p><h2 className="mt-1 text-xl font-bold">مهام التوصيل</h2><p className="mt-1 text-xs text-muted-foreground">ابحث عن المصدر أو البوليصة، ثم افتح المهمة لإكمال الإجراء.</p></div>
      <Button variant="outline" size="sm" className="min-h-10 gap-2" onClick={() => void workspace.refetch()} disabled={workspace.isFetching}><RotateCw className={`h-4 w-4 ${workspace.isFetching ? "animate-spin" : ""}`} />تحديث</Button>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8" aria-label="الحالات">
      {statusOptions.filter(option => option.value !== "all").map(option => <button type="button" key={option.value} className="dw-stat" data-selected={filters.status === option.value} onClick={() => change({ status: option.value })} aria-pressed={filters.status === option.value}>
        <span className="block truncate text-[11px] text-muted-foreground">{option.label}</span><strong className="mt-1 block text-xl tabular-nums">{counts ? countText(counts[option.value as keyof typeof counts] ?? 0) : "—"}</strong>
      </button>)}
    </div>
    <div className="dw-surface space-y-3 p-3 sm:p-4">
      <div className="relative">
        <label htmlFor="workspace-search" className="mb-1.5 block text-xs font-semibold">بحث سريع</label>
        <Search className="pointer-events-none absolute right-3 top-[37px] h-4 w-4 text-muted-foreground" />
        <Input id="workspace-search" type="search" maxLength={160} value={search} onChange={event => setSearch(event.target.value)} placeholder="اسم المصدر، رقم البوليصة، السائق…" className="h-11 pr-10" />
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div><label className="mb-1.5 block text-xs font-semibold" id="dw-status">الحالة</label><Select value={filters.status} onValueChange={(status: WorkspaceStatus) => change({ status })}><SelectTrigger aria-labelledby="dw-status" className="h-11"><SelectValue /></SelectTrigger><SelectContent>{statusOptions.map(option => <SelectItem value={option.value} key={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
        <div><label className="mb-1.5 block text-xs font-semibold" id="dw-carrier">الناقل</label><Select value={filters.carrier} onValueChange={(carrier: WorkspaceCarrier) => change({ carrier })}><SelectTrigger aria-labelledby="dw-carrier" className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل الناقلين</SelectItem><SelectItem value="internal">داخلي</SelectItem><SelectItem value="road">رود للوجيستك</SelectItem><SelectItem value="naqel">ناقل</SelectItem><SelectItem value="other">شركة أخرى</SelectItem></SelectContent></Select></div>
        <div><label className="mb-1.5 block text-xs font-semibold" id="dw-source">من فرع</label><Select value={filters.sourceBranchId} onValueChange={sourceBranchId => change({ sourceBranchId })}><SelectTrigger aria-labelledby="dw-source" className="h-11"><SelectValue placeholder="كل المصادر" /></SelectTrigger><SelectContent><SelectItem value="all">كل المصادر</SelectItem>{data?.filters.sources.map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select></div>
        <div><label className="mb-1.5 block text-xs font-semibold" id="dw-destination">إلى فرع</label><Select value={filters.destinationBranchId} onValueChange={destinationBranchId => change({ destinationBranchId })}><SelectTrigger aria-labelledby="dw-destination" className="h-11"><SelectValue placeholder="كل الوجهات" /></SelectTrigger><SelectContent><SelectItem value="all">كل الوجهات</SelectItem>{data?.filters.destinations.map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select></div>
      </div>
      {hasFilters && <Button variant="ghost" size="sm" className="min-h-9 gap-1 text-teal-800" onClick={clear}><X className="h-4 w-4" />مسح البحث والتصفية</Button>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" aria-live="polite"><span>{workspace.isFetching ? "جارٍ تحديث النتائج…" : data ? `${countText(data.total)} مهمة مطابقة · صفحة ${countText(data.page)} من ${countText(totalPages)}` : "تحميل النتائج…"}</span><div className="flex items-center gap-2"><label htmlFor="dw-page-size">في الصفحة</label><Select value={String(filters.pageSize)} onValueChange={size => change({ pageSize: Number(size) as 25 | 50 | 100 })}><SelectTrigger id="dw-page-size" className="h-9 w-20"><SelectValue /></SelectTrigger><SelectContent>{[25, 50, 100].map(size => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent></Select></div></div>
     {workspace.isError ? <div role="alert" className="dw-surface flex min-h-44 flex-col items-center justify-center gap-3 p-6 text-center"><CircleAlert className="h-6 w-6 text-rose-700" /><p className="font-semibold">تعذر تحميل المهام أو سُحبت صلاحية الوصول. أعد المحاولة.</p><Button variant="outline" onClick={() => void workspace.refetch()}>إعادة المحاولة</Button></div>
       : workspace.isPending || workspace.isFetching ? <div className="space-y-2" aria-label="جارٍ تحميل المهام"><Skeleton className="h-12 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
      : !data?.deliveries.length ? <div className="dw-surface flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center"><ClipboardList className="h-7 w-7 text-teal-700" /><p className="font-semibold">لا توجد مهام تطابق هذا العرض</p><p className="text-sm text-muted-foreground">جرّب تغيير الحالة أو تقليل عوامل التصفية.</p>{hasFilters && <Button variant="outline" onClick={clear}>عرض المهام النشطة</Button>}</div>
      : <><div className="space-y-2 md:hidden">{data.deliveries.map(card)}</div><div className="dw-surface hidden overflow-x-auto md:block"><table className="dw-table min-w-[890px]"><thead><tr><th>المهمة / المصدر</th><th>الحالة</th><th>المسار</th><th>الناقل / البوليصة</th><th>الموعد</th><th><span className="sr-only">الإجراء</span></th></tr></thead><tbody>{data.deliveries.map(item => { const timing = deliveryTiming(item, now); return <tr key={item.id}><td className="max-w-[220px]"><p className="truncate font-bold" title={item.sourceLabel}>{item.sourceLabel}</p><span className="text-xs text-muted-foreground">{deliverySourceLabel(item.sourceType)} · #{item.id}</span></td><td><Badge variant="outline" className={deliveryStatus(item.status).className}>{deliveryStatus(item.status).label}</Badge></td><td className="max-w-[200px]"><p className="truncate" title={`${item.sourceBranchName} ← ${item.destinationBranchName}`}>{item.sourceBranchName} <ArrowLeft className="inline h-3 w-3 text-teal-700" /> {item.destinationBranchName}</p></td><td className="max-w-[190px]"><p className="truncate" title={deliveryTransportLabel(item)}>{deliveryTransportLabel(item)}</p></td><td className="whitespace-nowrap"><span>{deliveryDate(item.scheduledAt || item.createdAt)}</span>{timing !== "on_time" && <span className="mt-1 block text-xs font-semibold text-rose-700">{timing === "escalated" ? "متأخرة أكثر من ساعة" : "متأخرة"}</span>}</td><td><Button size="sm" className="min-h-9 whitespace-nowrap" onClick={() => onOpen(item)}>فتح المهمة</Button></td></tr>; })}</tbody></table></div></>}
    {data && data.total > data.pageSize && <nav aria-label="صفحات المهام" className="flex items-center justify-center gap-3"><Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => setFilters(current => ({ ...current, page: current.page - 1 }))}>السابق</Button><span className="text-sm tabular-nums">{countText(data.page)} / {countText(totalPages)}</span><Button variant="outline" size="sm" disabled={filters.page >= totalPages} onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))}>التالي</Button></nav>}
  </section>;
}