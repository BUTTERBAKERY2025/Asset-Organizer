import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import type { OperationsCenterResponse, OperationsQueueItem } from "@shared/operations-center";
import { Layout } from "@/components/layout";
import { OperationsWorkspace, time } from "@/components/operations-center/workspace";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { usePermissions } from "@/hooks/usePermissions";
import { useOperationsCenterLive } from "@/hooks/useOperationsCenterLive";
const RECORD_PARAMS: Record<string, string> = {
  maintenance: "ticketId", kitchen_order: "orderId", transfer: "transferId",
  reverse_movement: "movementId", delivery_assignment: "deliveryId",
  leave: "leaveId", attendance_record: "attendanceId", advance: "advanceId",
  quality_check: "checkId",
};
function Empty({ message }: { message: string }) {
  return <p className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">{message}</p>;
}

export default function OperationsCenterPage() {
  const [, navigate] = useLocation();
  const client = useQueryClient();
  const { user } = useAuth();
  const { branches, isLoading: branchesLoading, isError: branchesError, refetch: refetchBranches } = useBranches();
  const { canExport, canView, isLoading: permissionsLoading } = usePermissions();
  const [scopeChecked, setScopeChecked] = useState(false);
  const [selected, setSelected] = useState<string[]>(() => new URLSearchParams(window.location.search).get("branchIds")?.split(",").filter(Boolean) ?? []);
  const [invalidSelection, setInvalidSelection] = useState(false);
  const [offset, setOffset] = useState(0);
  const [message, setMessage] = useState("");
  const [scopeSearch, setScopeSearch] = useState("");
  const allowedIds = useMemo(() => branches.map(branch => branch.id), [branches]);
  // An empty selection means the server's current authorized scope, not cached client-side "all".
  const effectiveIds = selected.filter(id => allowedIds.includes(id));
  const key = ["/api/operations-center", user?.id, [...effectiveIds].sort().join(","), offset];
  const allowed = !permissionsLoading && canView("operations");
  // Keep the last validated scope while useBranches temporarily hides rows
  // during an authorization refetch; a transient empty list is not a revoke.
  const liveScope = useRef<string[]>([]);
  if (scopeChecked && !branchesLoading && !branchesError) liveScope.current = effectiveIds.length ? effectiveIds : allowedIds;
  useEffect(() => {
    setScopeChecked(false);
    client.removeQueries({ queryKey: ["/api/operations-center"] });
    void refetchBranches().then(result => setScopeChecked(!result.isError));
  }, [user?.id]);
  useEffect(() => {
    const removed = selected.some(id => !allowedIds.includes(id));
    if (removed || branchesError || !allowed) {
      void client.cancelQueries({ queryKey: ["/api/operations-center"] });
      client.removeQueries({ queryKey: ["/api/operations-center"] });
      if (removed && !branchesLoading && scopeChecked) setInvalidSelection(true);
    }
  }, [allowedIds.join(","), branchesError, branchesLoading, scopeChecked, allowed]);
  useEffect(() => {
    const refreshScope = () => {
      setScopeChecked(false);
      void client.cancelQueries({ queryKey: ["/api/operations-center"] });
      client.removeQueries({ queryKey: ["/api/operations-center"] });
      void refetchBranches().then(result => setScopeChecked(!result.isError));
    };
    window.addEventListener("focus", refreshScope);
    return () => window.removeEventListener("focus", refreshScope);
  }, [refetchBranches]);
  const live = useOperationsCenterLive({
    enabled: !!user?.id && allowed && scopeChecked && !invalidSelection && !branchesError && !branchesLoading && allowedIds.length > 0 && (effectiveIds.length || allowedIds.length) <= 25,
    branchIds: liveScope.current,
    onInvalidate: reason => {
      if (reason === "scope-invalidated") {
        setScopeChecked(false);
        void client.cancelQueries({ queryKey: ["/api/operations-center"] });
        client.removeQueries({ queryKey: ["/api/operations-center"] });
        void refetchBranches().then(result => setScopeChecked(!result.isError));
      } else void client.invalidateQueries({ queryKey: ["/api/operations-center"] });
    },
  });

  const center = useQuery<OperationsCenterResponse>({
    queryKey: key,
    enabled: !!user?.id && allowed && scopeChecked && !invalidSelection && !branchesLoading && !branchesError && allowedIds.length > 0,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (effectiveIds.length) params.set("branchIds", effectiveIds.join(","));
      if (offset) params.set("offset", String(offset));
      const res = await fetch(`/api/operations-center${params.size ? `?${params}` : ""}`, { credentials: "include", signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    retry: false, staleTime: 0, refetchInterval: 60_000, refetchOnWindowFocus: "always",
    placeholderData: undefined,
  });
  const data = scopeChecked && allowed && !branchesLoading && !branchesError && !center.isError &&
    center.data?.scope.branchIds.every(id => allowedIds.includes(id)) &&
    (!effectiveIds.length || center.data.scope.branchIds.every(id => effectiveIds.includes(id)))
    ? center.data : undefined;
  const changeScope = (ids: string[]) => {
    setMessage("");
    setOffset(0);
    setInvalidSelection(false);
    void client.cancelQueries({ queryKey: ["/api/operations-center"] });
    client.removeQueries({ queryKey: ["/api/operations-center"] });
    const next = ids.filter(id => allowedIds.includes(id));
    setSelected(next);
    navigate(`/operations-center${next.length ? `?${new URLSearchParams({ branchIds: next.join(",") })}` : ""}`, { replace: true });
  };
  const go = (href: string, branchId: string, item?: OperationsQueueItem) => {
    if (!data?.scope.branchIds.includes(branchId)) return;
    try {
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/") || url.pathname.startsWith("//")) throw new Error();
      if (item) {
        const parameter = RECORD_PARAMS[item.sourceType];
        if (!/^[1-9]\d*$/.test(item.sourceId) ||
          (item.sourceType === "cashier_journal"
            ? url.pathname !== `/cashier-journals/${item.sourceId}`
            : item.sourceType !== "daily_closure" && (!parameter || url.searchParams.get(parameter) !== item.sourceId))) throw new Error();
      }
      // The existing daily-closure detail route fetches the exact authorized
      // closure; the creation page does not understand closureId.
      if (item?.sourceType === "daily_closure") {
        if (!/^[1-9]\d*$/.test(item.sourceId)) throw new Error();
        url.pathname = `/branch-daily-closures/${item.sourceId}`;
        url.search = "";
      }
      url.searchParams.set("branchId", branchId);
      url.searchParams.set("from", "operations-center");
      url.searchParams.set("centerBranchIds", effectiveIds.join(","));
      navigate(`${url.pathname}${url.search}${url.hash}`);
    } catch { setMessage("رابط المصدر غير صالح؛ لم يتم فتحه."); }
  };
  const exportScope = async () => {
    if (!canExport("operations") || !data) return;
    setMessage("");
    try {
      const params = new URLSearchParams();
      if (effectiveIds.length) params.set("branchIds", effectiveIds.join(","));
      const res = await fetch(`/api/operations-center/export?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = new Blob([await res.text()], { type: "application/json;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "operations-center.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch { setMessage("تعذر التصدير من الخادم. حاول مرة أخرى."); }
  };
  return <Layout><main dir="rtl" className="page-container mx-auto max-w-[1550px] space-y-4 pb-8 pt-4" data-testid="operations-center-page">
    <header className="relative rounded-2xl bg-[#3e2b3a] text-[#fff8f3] shadow-[0_12px_28px_rgba(48,27,42,0.12)]">
      <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-7">
        <div className="min-w-0"><p className="text-[11px] font-bold tracking-[.12em] text-[#e4b6a4]">BUTTER BAKERY / OPERATIONS</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">مركز إدارة التشغيل</h1></div>
        <div className="flex flex-wrap items-center gap-2">
          <details className="relative min-w-[175px] flex-1 rounded-xl border border-[#765d6b] bg-[#523b4e] lg:flex-none">
            <summary className="min-h-10 cursor-pointer px-3 py-2.5 text-xs font-bold">نطاق الفروع · {effectiveIds.length ? `${effectiveIds.length} مختارة` : `${allowedIds.length} مسموح بها`}</summary>
            <div className="absolute left-0 right-0 z-30 mt-1 min-w-[260px] rounded-xl border border-[#e5d9d8] bg-[#fffdfa] p-2 text-[#342832] shadow-xl">
              <input aria-label="بحث نطاق الفروع" value={scopeSearch} onChange={event => setScopeSearch(event.target.value)} placeholder="ابحث عن فرع" className="mb-2 min-h-10 w-full rounded-lg border border-[#e5d9d8] bg-[#fffdfa] px-3 text-sm outline-none" />
              <div className="max-h-52 overflow-y-auto">
              <Button variant="ghost" className="w-full justify-start text-xs" onClick={() => changeScope([])}>كل الفروع المسموح بها</Button>
              {branches.filter(branch => branch.name.toLocaleLowerCase().includes(scopeSearch.toLocaleLowerCase().trim())).map(branch => <label key={branch.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded px-2 text-xs hover:bg-[#f4ece8]"><input type="checkbox" checked={effectiveIds.includes(branch.id)} onChange={event => changeScope(event.target.checked ? [...effectiveIds, branch.id] : effectiveIds.length ? effectiveIds.filter(id => id !== branch.id) : allowedIds.filter(id => id !== branch.id))} />{branch.name}</label>)}
              </div>
            </div>
          </details>
          <Button variant="outline" size="sm" className="min-h-10 border-[#765d6b] bg-[#523b4e] text-[#fff8f3] hover:bg-[#694d60] hover:text-[#fff8f3]" disabled={!data || center.isFetching} onClick={() => center.refetch()}><RefreshCw className={`ml-2 h-4 w-4 ${center.isFetching ? "animate-spin" : ""}`} />تحديث</Button>
          {canExport("operations") && <Button variant="outline" size="sm" className="min-h-10 border-[#765d6b] bg-[#523b4e] text-[#fff8f3] hover:bg-[#694d60] hover:text-[#fff8f3]" disabled={!data} onClick={exportScope}><Download className="ml-2 h-4 w-4" />تصدير</Button>}
        </div>
      </div>
      {data && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#654b5c] px-5 py-2 text-[11px] text-[#e2d2d5] lg:px-7"><span>يوم العمل: {data.businessDate}</span><span>آخر توليد: {time(data.generatedAt)} · السعودية</span><span>الاتصال: {live.status === "connected" ? "مباشر" : live.status === "polling" ? "تحديث دوري" : live.status === "access-invalidated" ? "الصلاحيات تغيرت" : "جار التحقق"}</span><span>آخر فحص للاتصال: {live.lastCheckedAt ? time(new Date(live.lastCheckedAt).toISOString()) : "غير متاح"}</span></div>}
    </header>
    {message && <p role="alert" className="rounded-xl border border-[#e5c5ba] bg-[#fff2eb] p-3 text-sm text-[#944c36]">{message}</p>}
    {branchesError ? <div className="rounded-xl border bg-card p-6 text-center"><AlertTriangle className="mx-auto mb-2 h-6 w-6 text-destructive" /><p>تعذر التحقق من الفروع المسموح بها.</p><Button variant="outline" className="mt-3" onClick={() => { setScopeChecked(false); void refetchBranches().then(result => setScopeChecked(!result.isError)); }}>إعادة المحاولة</Button></div> : !allowed && !permissionsLoading ? <Empty message="لا تملك صلاحية عرض مركز التشغيل." /> : invalidSelection && !branchesLoading && scopeChecked ? <Empty message="تغير نطاق الصلاحيات أو الفرع المطلوب غير مسموح. اختر نطاقًا جديدًا من الفروع المتاحة أعلاه." /> : !branchesLoading && scopeChecked && !allowedIds.length ? <Empty message="لا توجد فروع مسموح بها لهذا الحساب." /> : branchesLoading || !scopeChecked || center.isLoading ? <div role="status" className="grid gap-3 rounded-2xl border bg-card p-5"><div className="h-6 w-48 animate-pulse rounded-lg bg-muted" /><div className="grid gap-3 lg:grid-cols-[210px_1fr_345px]">{[0, 1, 2].map(index => <div key={index} className="h-64 animate-pulse rounded-xl bg-muted" />)}</div><span className="sr-only">جار تحميل نطاق الفروع والبيانات</span></div> : center.isError ? <div className="rounded-xl border bg-card p-6 text-center"><AlertTriangle className="mx-auto mb-2 h-6 w-6 text-destructive" /><p>تعذر تحميل المركز ({center.error instanceof Error ? center.error.message : "خطأ غير معروف"}). لم نعرض بيانات قديمة.</p><Button variant="outline" className="mt-3" onClick={() => center.refetch()}>إعادة المحاولة</Button></div> : data ?
      <OperationsWorkspace key={effectiveIds.slice().sort().join(",")} data={data} actorId={user?.id} offset={offset} onOffset={setOffset} open={go} openBranch={id => navigate(`/branch-operations?branchId=${encodeURIComponent(id)}`)} retry={() => { void center.refetch(); }} />
      : <Empty message="تعذر التحقق من نطاق الاستجابة. حدّث الصفحة بعد مراجعة صلاحيات الفروع." />}
  </main></Layout>;
}