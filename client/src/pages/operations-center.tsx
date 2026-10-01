import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { AlertTriangle, Download, RefreshCw, ChevronDown, Bell, Check, X } from "lucide-react";
import type { OperationsCenterResponse, OperationsQueueItem } from "@shared/operations-center";
import { Layout } from "@/components/layout";
import { time } from "@/components/operations-center/workspace";
import { OperationsDecisionBoard } from "@/components/operations-center/decision-board";
import { performanceDataForRange, type PerformanceDays } from "@/components/operations-center/analytics-model";
import { OperationsCenterScreen } from "@/components/operations-center/operations-screen";
import { attachCenterContext, centerNoticeDestination, monthlySourceIntent, navigateCenterSourceWithHistory, peopleRecordFromSource, peopleSourceIntent, performanceDaysIntent, purgeOperationsCenterQueries, refreshOperationsCenterQueries, validatePeopleSourceNavigation, withPeopleReturn } from "@/lib/operations-center-navigation";
import { createOperationsHrCommandGuard } from "@/lib/operations-hr-state";
import { operationsJoiningFocus, type OperationsJoining } from "@/lib/operations-employees";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { syncAppBadge } from "@/lib/app-badge";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { usePermissions } from "@/hooks/usePermissions";
import { useOperationsCenterLive } from "@/hooks/useOperationsCenterLive";
const RECORD_PARAMS: Record<string, string> = {
  maintenance: "ticketId", branch_complaint: "complaintId", kitchen_order: "orderId", transfer: "transferId",
  reverse_movement: "movementId", delivery_assignment: "deliveryId",
  leave: "leaveId", attendance_record: "attendanceId", advance: "advanceId",
  quality_check: "checkId",
};
function Empty({ message }: { message: string }) {
  return <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">{message}</p>;
}

interface CenterNotice {
  id: number; title: string; content: string; messageType: string; priority: number;
  createdAt: string; buttonText: string | null; buttonAction: string | null;
  kind: "general" | "branch"; branchIds: string[]; read: boolean;
  sourceState?: "current" | "history";
}

function CenterNotifications({ actorId, branchIds, names, liveManaged, open, refresh, revoke }: {
  actorId: string; branchIds: string[]; names: Record<string, string>; liveManaged: boolean;
  open: (notice: CenterNotice) => void; refresh: () => void;
  revoke: () => void;
}) {
  const client = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("unread");
  const [limit, setLimit] = useState(4);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const scope = branchIds.slice().sort().join(",");
  const queryKey = ["/api/operations-center/notifications", actorId, scope];
  const notices = useQuery<CenterNotice[]>({
    queryKey,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/operations-center/notifications?${new URLSearchParams({ branchIds: scope })}`, { credentials: "include", signal, cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    retry: false, staleTime: 0, refetchInterval: liveManaged ? false : 60_000,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  const action = useMutation({
    mutationFn: async ({ id, verb }: { id: number; verb: "read" | "dismiss" }) => {
      const response = await fetch(`/api/operations-center/notifications/${id}/${verb}?${new URLSearchParams({ branchIds: scope })}`,
        { method: "POST", credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    },
    onSuccess: (_result, { verb }) => {
      setError("");
      if (verb === "dismiss") setDetailId(null);
      void client.invalidateQueries({ queryKey });
      void client.invalidateQueries({ queryKey: ["/api/active-notifications"] });
      void client.invalidateQueries({ queryKey: ["/api/system-notifications/my-reads"] });
      void syncAppBadge();
    },
    onError: () => { setDetailId(null); setError("تعذر تحديث الإشعار أو تغيرت صلاحية الوصول. حدّث الإشعارات."); revoke(); },
  });
  const rows = notices.isError ? [] : notices.data || [];
  const unread = rows.filter(row => !row.read).length;
  const filtered = filter === "unread" ? rows.filter(row => !row.read) : rows;
  const detail = rows.find(row => row.id === detailId);
  const label = (row: CenterNotice) => row.kind === "general" ? "إعلان عام"
    : `فرع: ${row.branchIds.map(id => names[id] || id).join("، ")}`;
  const priority = (value: number) => value >= 4 ? "عاجل" : value === 3 ? "مهم" : null;
  return <Sheet>
    <SheetTrigger asChild><Button type="button" variant="outline" size="sm" className="min-h-11 gap-2" aria-label={`إشعارات مركز التشغيل: ${notices.isError ? "تعذر تحميلها" : `${unread} غير مقروء`}`}><Bell className="h-4 w-4" />الإشعارات <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-800">{notices.isLoading ? "…" : notices.isError ? "!" : unread.toLocaleString("en-US")}</span></Button></SheetTrigger>
    <SheetContent side="left" dir="rtl" className="w-full overflow-y-auto sm:max-w-lg">
      <SheetTitle className="text-right">الإشعارات</SheetTitle>
      <SheetDescription className="text-right">رسائل النظام في نطاق الفروع المختار؛ قراءة الإشعار لا تُنجز المهمة.</SheetDescription>
      <div className="mt-5">
      <p className="mb-3 text-xs text-muted-foreground">رسائل النظام الموجهة إليك ضمن نطاق الفروع المختار في رأس الصفحة. تُحدَّث تلقائيًا وبشكل دوري، ويمكن تحديثها يدويًا. قراءة الرسالة أو إخفاؤها لا تنفّذ إجراءً على السجل المرتبط.</p>
      <div className="mb-3 flex gap-2">
        <Button size="sm" variant={filter === "unread" ? "default" : "outline"} onClick={() => { setFilter("unread"); setLimit(4); }}>غير المقروءة ({unread})</Button>
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => { setFilter("all"); setLimit(4); }}>الكل ({rows.length})</Button>
         <Button size="sm" variant="ghost" disabled={notices.isFetching} onClick={refresh}><RefreshCw className={`h-4 w-4 ${notices.isFetching ? "animate-spin" : ""}`} /><span className="sr-only">تحديث الإشعارات</span></Button>
      </div>
      {error && <p role="alert" className="mb-2 text-xs text-destructive">{error}</p>}
      {notices.isLoading ? <p role="status" className="text-sm text-muted-foreground">جار تحميل الإشعارات…</p>
        : notices.isError ? <p role="alert" className="text-sm text-destructive">تعذر تحميل الإشعارات. أعد المحاولة.</p>
        : !rows.length ? <Empty message="لا توجد إشعارات في نطاق الفروع المحدد." />
        : !filtered.length ? <Empty message="لا توجد إشعارات غير مقروءة في هذا النطاق." />
        : <div className="space-y-2">{filtered.slice(0, limit).map(row => <article key={row.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-3 sm:flex-nowrap">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><span className={`text-sm ${row.read ? "text-muted-foreground" : "font-bold"}`}>{row.title}</span>{priority(row.priority) && <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${row.priority >= 4 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{priority(row.priority)}</span>}</div>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{row.content}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{label(row)} · {time(row.createdAt)}{row.read ? " · مقروء" : ""}</p>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => setDetailId(row.id)}>التفاصيل</Button>
            {!row.read && <Button size="icon" variant="ghost" disabled={action.isPending} aria-label={`تحديد ${row.title} كمقروء`} onClick={() => action.mutate({ id: row.id, verb: "read" })}><Check className="h-4 w-4" /></Button>}
            <Button size="icon" variant="ghost" disabled={action.isPending} aria-label={`إخفاء ${row.title}`} onClick={() => action.mutate({ id: row.id, verb: "dismiss" })}><X className="h-4 w-4" /></Button>
          </div>
        </article>)}{filtered.length > limit && <Button variant="outline" size="sm" onClick={() => setLimit(value => value + 8)}>عرض المزيد ({filtered.length - limit})</Button>}</div>}
    </div>
    </SheetContent>
    <Dialog open={!!detail} onOpenChange={open => { if (!open) setDetailId(null); }}>
      <DialogContent dir="rtl" className="max-w-lg">
        {detail && <><DialogHeader><DialogTitle className="text-right">{detail.title}</DialogTitle><DialogDescription className="text-right">{label(detail)} · {time(detail.createdAt)}</DialogDescription></DialogHeader>
          <p className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words text-sm leading-relaxed">{detail.content}</p>
          {detail.sourceState === "history" && <p className="text-xs text-muted-foreground">سجل سابق؛ لم يعد هذا الإشعار إجراءً مطلوبًا في المرحلة الحالية.</p>}
          <DialogFooter className="gap-2 sm:gap-2">
             {detail.buttonAction && <Button onClick={() => { setDetailId(null); open(detail); }}>{detail.buttonText || "فتح المصدر"}</Button>}
            {!detail.read && <Button variant="outline" disabled={action.isPending} onClick={() => action.mutate({ id: detail.id, verb: "read" })}>تحديد كمقروء</Button>}
            <Button variant="outline" disabled={action.isPending} onClick={() => action.mutate({ id: detail.id, verb: "dismiss" })}>إخفاء</Button>
          </DialogFooter></>}
      </DialogContent>
    </Dialog>
  </Sheet>;
}

export default function OperationsCenterPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const client = useQueryClient();
  const purgeCenter = () => purgeOperationsCenterQueries(client);
  const refreshCenter = (cancelRefetch = true) => refreshOperationsCenterQueries(client, cancelRefetch);
  const { user } = useAuth();
  const { branches, isLoading: branchesLoading, isError: branchesError, refetch: refetchBranches } = useBranches();
  const { canExport, canView, isLoading: permissionsLoading } = usePermissions();
  const [scopeChecked, setScopeChecked] = useState(false);
  const [selected, setSelected] = useState<string[]>(() => new URLSearchParams(window.location.search).get("branchIds")?.split(",").filter(Boolean) ?? []);
  const [invalidSelection, setInvalidSelection] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("branchIds");
    const ids = raw?.split(",") ?? [];
    return params.getAll("branchIds").length > 1 || (raw !== null && (!ids.length
      || ids.some(id => !/^[\w-]{1,80}$/.test(id) || id.toLowerCase() === "all") || new Set(ids).size !== ids.length));
  });
  const [offset, setOffset] = useState(0);
  const [performanceDays, setPerformanceDays] = useState<PerformanceDays>(() => performanceDaysIntent(window.location.search) || 7);
  const [message, setMessage] = useState("");
  const [scopeSearch, setScopeSearch] = useState("");
  const [scopeOpen, setScopeOpen] = useState(false);
  const allowedIds = useMemo(() => branches.map(branch => branch.id), [branches]);
  const previousGrants = useRef<string[]>([]);
  const sourceViewGrants = (["warehouse", "branch_supply", "central_kitchen_orders", "production", "delivery_tasks", "operations_payroll", "salary_closing", "pnl", "pnl_dashboard", "daily_closures", "sales_analytics", "hr_leaves", "hr_advances", "attendance", "operations_hr", "operations_joining", "operations_employee_transfer"] as const).map(module => canView(module));
  const previousSourceViews = useRef<boolean[]>([]);
  // An empty selection means the server's current authorized scope, not cached client-side "all".
  const effectiveIds = selected.filter(id => allowedIds.includes(id));
  const selectionAuthorized = selected.every(id => allowedIds.includes(id));
  const key = ["/api/operations-center", user?.id, [...effectiveIds].sort().join(","), offset, performanceDays];
  const allowed = !permissionsLoading && canView("operations");
  const sourceAccess = useRef({ actorId: user?.id, allowed, selected, grants: sourceViewGrants.join(",") });
  sourceAccess.current = { actorId: user?.id, allowed, selected, grants: sourceViewGrants.join(",") };
  const sourceBranchScope = useRef("");
  if (scopeChecked && !branchesLoading && !branchesError) sourceBranchScope.current = allowedIds.slice().sort().join(",");
  const sourceCommands = useRef(createOperationsHrCommandGuard()).current;
  sourceCommands.update(JSON.stringify([user?.id, user?.role, allowed, selected, sourceViewGrants,
    sourceBranchScope.current, search, invalidSelection, branchesError]));
  useEffect(() => () => sourceCommands.invalidate(), [sourceCommands]);
  // Keep the last validated scope while useBranches temporarily hides rows
  // during an authorization refetch; a transient empty list is not a revoke.
  const liveScope = useRef<string[]>([]);
  // Monthly scope is independent of the outer center selection. Subscribe to
  // all actual authorized branches, without broadening any board data request.
  if (scopeChecked && !branchesLoading && !branchesError) liveScope.current = allowedIds;
  useEffect(() => {
    setScopeChecked(false);
    purgeCenter();
    void refetchBranches().then(result => setScopeChecked(!result.isError));
  }, [user?.id]);
  useEffect(() => {
    const removed = selected.some(id => !allowedIds.includes(id));
    const revoked = !branchesLoading && !branchesError && previousGrants.current.some(id => !allowedIds.includes(id));
    const sourceRevoked = !permissionsLoading && previousSourceViews.current.some((granted, index) => granted && !sourceViewGrants[index]);
    if (!branchesLoading && !branchesError) previousGrants.current = allowedIds;
    if (!permissionsLoading) previousSourceViews.current = sourceViewGrants;
    if (removed || revoked || sourceRevoked || branchesError || !allowed) {
      purgeCenter();
      if (revoked || sourceRevoked) { setScopeChecked(false); void refetchBranches().then(result => setScopeChecked(!result.isError)); }
      if (removed && !branchesLoading && scopeChecked) setInvalidSelection(true);
    }
  }, [allowedIds.join(","), branchesError, branchesLoading, scopeChecked, allowed, permissionsLoading, sourceViewGrants.join(",")]);
  useEffect(() => {
    const refreshScope = () => {
      setScopeChecked(false);
      purgeCenter();
      void refetchBranches().then(result => setScopeChecked(!result.isError));
    };
    window.addEventListener("focus", refreshScope);
    return () => window.removeEventListener("focus", refreshScope);
  }, [refetchBranches]);
  // One polling authority: the live hook already polls even while SSE is healthy.
  // Window focus first revalidates branch authorization above, then mounts queries.
  const liveEnabled = !!user?.id && allowed && scopeChecked && selectionAuthorized && !invalidSelection && !branchesError && !branchesLoading && allowedIds.length > 0 && allowedIds.length <= 25;
  const live = useOperationsCenterLive({
    enabled: liveEnabled,
    branchIds: liveScope.current,
    onInvalidate: reason => {
      if (reason === "scope-invalidated") {
        setScopeChecked(false);
        purgeCenter();
        void refetchBranches().then(result => setScopeChecked(!result.isError));
      } else {
        refreshCenter(reason === "change");
      }
    },
  });

  const center = useQuery<OperationsCenterResponse>({
    queryKey: key,
    enabled: !!user?.id && allowed && scopeChecked && selectionAuthorized && !invalidSelection && !branchesLoading && !branchesError && allowedIds.length > 0,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.set("performanceDays", String(performanceDays));
      if (effectiveIds.length) params.set("branchIds", effectiveIds.join(","));
      if (offset) params.set("offset", String(offset));
      const res = await fetch(`/api/operations-center${params.size ? `?${params}` : ""}`, { credentials: "include", signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    retry: false, staleTime: 0, refetchInterval: liveEnabled ? false : 60_000,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
    // Only a performance-range transition may retain workflow snapshots.
    // Actor, branch scope and queue page transitions never inherit old data.
    placeholderData: (previous, previousQuery) =>
      JSON.stringify(previousQuery?.queryKey.slice(0, 4)) === JSON.stringify(key.slice(0, 4)) ? previous : undefined,
  });
  const data = scopeChecked && allowed && selectionAuthorized && !invalidSelection && !branchesLoading && !branchesError && !center.isError &&
    center.data?.scope.branchIds.every(id => allowedIds.includes(id)) &&
    center.data.scope.branchIds.length === (effectiveIds.length ? effectiveIds.length : allowedIds.length) &&
    (effectiveIds.length ? effectiveIds : allowedIds).every(id => center.data.scope.branchIds.includes(id))
    ? performanceDataForRange(center.data, performanceDays) : undefined;
  const changePerformanceDays = (days: PerformanceDays) => {
    sourceCommands.invalidate();
    setPerformanceDays(days);
    const params = new URLSearchParams(window.location.search);
    params.set("performanceDays", String(days));
    navigate(`/operations-center?${params}`, { replace: true });
  };
  const changeScope = (ids: string[]) => {
    sourceCommands.invalidate();
    setScopeOpen(false);
    setScopeSearch("");
    setMessage("");
    setOffset(0);
    setInvalidSelection(false);
    purgeCenter();
    const next = ids.filter(id => allowedIds.includes(id));
    setSelected(next);
    const params = new URLSearchParams({ performanceDays: String(performanceDays) });
    if (next.length) params.set("branchIds", next.join(","));
    navigate(`/operations-center?${params}`, { replace: true });
  };
  const go = async (href: string, branchId: string, item?: OperationsQueueItem, isIntentCurrent: () => boolean = () => true) => {
    sourceCommands.invalidate();
    const commandToken = sourceCommands.capture();
    try {
      const url = new URL(href, window.location.origin);
      const monthlyRequested = url.searchParams.getAll("centerWorkspace").includes("monthly")
        || url.searchParams.has("centerMonth") || url.searchParams.has("centerMonthBranchId") || url.searchParams.has("centerMonthFile");
      const analyticReturn = url.searchParams.get("centerWorkspace") === "analysis";
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/") || url.pathname.startsWith("//")) throw new Error();
      const peopleRequested = !monthlyRequested && !analyticReturn && (
        ["/hr/leaves", "/hr/advances", "/employee-attendance-report", "/hr-hub"].includes(url.pathname)
        || url.searchParams.getAll("centerWorkspace").includes("people") || url.searchParams.has("centerPeopleRecord")
        || url.searchParams.has("centerPeopleBranchId"));
      if (peopleRequested) {
        if (!data?.scope.branchIds.includes(branchId) || !scopeChecked || !allowed || invalidSelection) throw new Error();
        const record = peopleRecordFromSource(url);
        if (item && (!record || item.branchId !== branchId || item.sourceId !== record.id
          || (!record.type.startsWith("joining_") && item.sourceType !== record.type))) throw new Error();
        const hasPeopleContext = url.searchParams.has("centerWorkspace") || url.searchParams.has("centerPeopleRecord")
          || url.searchParams.has("centerPeopleBranchId");
        const destination = hasPeopleContext ? url : new URL(withPeopleReturn(
          `${url.pathname}${url.search}${url.hash}`, branchId, record?.record ?? null, window.location.origin), window.location.origin);
        attachCenterContext(destination, branchId, effectiveIds, performanceDays);
        const token = sourceCommands.capture();
        const intent = peopleSourceIntent(destination, data.scope.branchIds);
        if (!intent) throw new Error();
        const hrTool = destination.pathname === "/hr-hub";
        if (hrTool && user?.role !== "operations_manager") throw new Error();
        const module = destination.pathname === "/hr/leaves" ? "hr_leaves" : destination.pathname === "/hr/advances" ? "hr_advances"
          : destination.pathname === "/employee-attendance-report" ? "attendance" : record ? "operations_joining"
          : destination.searchParams.get("tab") === "payroll" ? "operations_payroll"
          : destination.searchParams.get("section") === "joining" ? "operations_joining"
          : destination.searchParams.get("section") === "transfers" ? "operations_employee_transfer" : "operations_hr";
        if (!canView(module) || (hrTool && !canView("operations_hr"))) throw new Error();
        const freshIds = await validatePeopleSourceNavigation(destination, {
          branches: async () => {
            // A source preflight is an independent authorization read. Refetching
            // useBranches hides manager branch rows while fetching, which removes
            // the board/workspace and invalidates the very click being checked.
            // Keep that fail-closed hook behavior for actual center refreshes;
            // do not mutate its query/UI while validating a source click.
            const response = await fetch("/api/branches", { credentials: "include", cache: "no-store" });
            if (!response.ok) return null;
            const rows = await response.json() as { id: string }[];
            if (!sourceCommands.isCurrent(token) || !isIntentCurrent()
              || !Array.isArray(rows) || !rows.every(branch => branch && typeof branch.id === "string")) return null;
            const ids = rows.map(branch => branch.id);
            if (sourceBranchScope.current.split(",").some(id => id && !ids.includes(id))) {
              // A real revoke, unlike the hook's transient fetching state, must
              // hide the old authorized snapshot immediately. Publish only this
              // current, confirmed loss; unchanged preflights never touch cache.
              setMessage("تغير نطاق صلاحيات الفروع؛ أخفيت البيانات السابقة ولم يُفتح المصدر.");
              sourceCommands.invalidate();
              client.setQueryData(["/api/branches"], rows);
              purgeCenter();
              return null;
            }
            return ids;
          },
          permission: async () => {
            const response = await fetch("/api/my-permissions", { credentials: "include", cache: "no-store" });
            if (!response.ok) return false;
            const grants = await response.json() as { module: string; actions: string[] }[];
            if (!Array.isArray(grants)) return false;
            const view = (key: string) => grants.some(grant => grant.module === key && grant.actions.includes("view"));
            return (["admin", "super_admin"].includes(user?.role || "") || (view("operations") && view(module)))
              && (!hrTool || (user?.role === "operations_manager" && view("operations_hr")));
          },
          record: async () => {
            if (!record) return true; // Existing directory/history/advisory tool, not a synthetic task.
            const endpoint = record.type === "leave" ? "/api/hr/leaves"
              : record.type === "advance" ? "/api/hr/advance-requests"
              : record.type === "attendance_record" ? `/api/attendance/${record.id}` : "/api/operations-hr/joining";
            const response = await fetch(`${endpoint}?${new URLSearchParams({ branchId })}`, { credentials: "include", cache: "no-store" });
            if (!response.ok) return false;
            const payload = await response.json();
            if (record.type.startsWith("joining_")) {
              if (!Array.isArray(payload)) return false;
              const focused = operationsJoiningFocus(destination.search, payload as OperationsJoining[], branchId).row;
              return !!focused && (!item || (!focused.blockedExisting && focused.status !== "converted"
                && focused.notification?.status === item.status));
            }
            const rows = record.type === "attendance_record" ? [payload] : payload;
            return Array.isArray(rows) && rows.some(row => String(row.id) === record.id && row.branchId === branchId
              && (!item || row.status === item.status));
          },
          isCurrent: () => sourceCommands.isCurrent(token) && sourceAccess.current.allowed && isIntentCurrent(),
        });
        if (!freshIds) throw new Error();
        navigateCenterSourceWithHistory(destination, freshIds, navigate);
        return;
      }
      if (monthlyRequested) {
        if (!data || !scopeChecked || !allowed || invalidSelection || item) throw new Error();
        const access = sourceAccess.current;
        const token = sourceCommands.capture();
        // Never trust a drill link's raw branch, nor the outer center subset as
        // the full monthly authorization scope. Revalidate actual grants now.
        const fresh = await refetchBranches();
        const current = sourceAccess.current;
        if (!sourceCommands.isCurrent(token) || fresh.isError || !fresh.data || !current.allowed || access.actorId !== current.actorId
          || access.grants !== current.grants || access.selected.join(",") !== current.selected.join(",")) throw new Error();
        const freshIds = fresh.data.map(branch => branch.id);
        if (!freshIds.includes(branchId) || current.selected.some(id => !freshIds.includes(id))) throw new Error();
        attachCenterContext(url, branchId, current.selected, performanceDays);
        const intent = monthlySourceIntent(url, freshIds);
        if (!intent || intent.branchId !== branchId) throw new Error();
        navigateCenterSourceWithHistory(url, freshIds, navigate);
        return;
      }
      if (!data?.scope.branchIds.includes(branchId)) throw new Error();
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
      if (analyticReturn) url.searchParams.set("centerWorkspace", "analysis");
      attachCenterContext(url, branchId, effectiveIds, performanceDays);
      navigateCenterSourceWithHistory(url, data.scope.branchIds, navigate);
    } catch { if (sourceCommands.isCurrent(commandToken) && isIntentCurrent()) setMessage("رابط المصدر غير صالح أو تغيّر السجل أو صلاحية الوصول؛ لم يتم فتحه."); }
  };
  const openNotice = (notice: CenterNotice) => {
    if (!data) return;
    const destination = centerNoticeDestination(notice.buttonAction, notice.branchIds, data.scope.branchIds,
      effectiveIds, performanceDays, window.location.origin, new URLSearchParams(window.location.search).get("workspace") || undefined);
    if (!destination) { setMessage("رابط المصدر غير صالح أو خارج نطاق الفروع المختار؛ لم يتم فتحه."); return; }
    if (destination.navigationKind === "external") {
      window.open(destination.href, "_blank", "noopener,noreferrer");
      return;
    }
    if (destination.navigationKind === "general") {
      navigate(destination.href);
      return;
    }
    go(destination.href, destination.branchId);
  };
  const exportScope = async () => {
    if (!canExport("operations") || !data) return;
    setMessage("");
    try {
      const params = new URLSearchParams();
       params.set("performanceDays", String(performanceDays));
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
  return <Layout><OperationsCenterScreen data={data} status={live.status === "connected" ? "مباشر" : live.status === "polling" ? "تحديث دوري" : live.status === "access-invalidated" ? "الصلاحيات تغيرت" : "جار التحقق"} actions={<>
          <Popover open={scopeOpen} onOpenChange={setScopeOpen}>
            <PopoverTrigger asChild><button type="button" className="flex min-h-11 min-w-[190px] flex-1 items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 text-sm font-bold text-foreground hover:bg-accent sm:flex-none"><span>نطاق الفروع · {effectiveIds.length ? `${effectiveIds.length} مختارة` : `${allowedIds.length} متاحة`}</span><ChevronDown className="h-4 w-4 text-muted-foreground" /></button></PopoverTrigger>
            <PopoverContent dir="rtl" align="end" className="w-[min(320px,calc(100vw-24px))] rounded-xl p-2">
              <input aria-label="بحث نطاق الفروع" value={scopeSearch} onChange={event => setScopeSearch(event.target.value)} placeholder="ابحث عن فرع" className="mb-2 min-h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              <div className="max-h-52 overflow-y-auto">
              <Button variant="ghost" className="w-full justify-start text-xs" onClick={() => changeScope([])}>كل الفروع المسموح بها</Button>
              {branches.filter(branch => branch.name.toLocaleLowerCase().includes(scopeSearch.toLocaleLowerCase().trim())).map(branch => <label key={branch.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded px-2 text-xs hover:bg-accent"><input type="checkbox" checked={effectiveIds.includes(branch.id)} onChange={event => changeScope(event.target.checked ? [...effectiveIds, branch.id] : effectiveIds.length ? effectiveIds.filter(id => id !== branch.id) : allowedIds.filter(id => id !== branch.id))} />{branch.name}</label>)}
              </div>
            </PopoverContent>
          </Popover>
           <Button variant="outline" size="sm" className="min-h-11" disabled={!data || center.isFetching} onClick={() => refreshCenter()}><RefreshCw className={`ml-2 h-4 w-4 ${center.isFetching ? "animate-spin" : ""}`} />تحديث</Button>
          {canExport("operations") && <Button variant="outline" size="sm" className="min-h-11" disabled={!data} onClick={exportScope}><Download className="ml-2 h-4 w-4" />تصدير</Button>}
           {data && user?.id && data.scope.branchIds.length > 0 && <CenterNotifications key={`${user.id}:${data.scope.branchIds.slice().sort().join(",")}`} actorId={user.id} branchIds={data.scope.branchIds} names={Object.fromEntries(data.branches.map(branch => [branch.id, branch.name]))} liveManaged={liveEnabled} open={openNotice} refresh={() => refreshCenter()} revoke={() => { setScopeChecked(false); purgeCenter(); void refetchBranches().then(result => setScopeChecked(!result.isError)); }} />}
    </>}>
    {message && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{message}</p>}
     {branchesError ? <div className="rounded-xl border bg-card p-6 text-center"><AlertTriangle className="mx-auto mb-2 h-6 w-6 text-destructive" /><p>تعذر التحقق من الفروع المسموح بها.</p><Button variant="outline" className="mt-3" onClick={() => { setScopeChecked(false); void refetchBranches().then(result => setScopeChecked(!result.isError)); }}>إعادة المحاولة</Button></div> : !allowed && !permissionsLoading ? <Empty message="لا تملك صلاحية عرض مركز التشغيل." /> : invalidSelection && !branchesLoading && scopeChecked ? <Empty message="تغير نطاق الصلاحيات أو الفرع المطلوب غير مسموح. اختر نطاقًا جديدًا من الفروع المتاحة أعلاه." /> : !branchesLoading && scopeChecked && !allowedIds.length ? <Empty message="لا توجد فروع مسموح بها لهذا الحساب." /> : branchesLoading || !scopeChecked || center.isLoading ? <div role="status" className="grid gap-3 rounded-xl border border-border bg-card p-5"><div className="h-6 w-48 animate-pulse rounded-lg bg-muted" /><div className="grid gap-3 md:grid-cols-2">{[0, 1].map(index => <div key={index} className="h-36 animate-pulse rounded-xl bg-muted" />)}</div><span className="sr-only">جار تحميل نطاق الفروع والبيانات</span></div> : center.isError ? <div className="rounded-xl border bg-card p-6 text-center"><AlertTriangle className="mx-auto mb-2 h-6 w-6 text-destructive" /><p>تعذر تحميل المركز ({center.error instanceof Error ? center.error.message : "خطأ غير معروف"}). لم نعرض بيانات قديمة.</p><Button variant="outline" className="mt-3" onClick={() => center.refetch()}>إعادة المحاولة</Button></div> : data ?
        <OperationsDecisionBoard key={effectiveIds.slice().sort().join(",")} data={data} actorId={user?.id} offset={offset} onOffset={setOffset} open={go} openBranch={id => navigate(`/branch-operations?branchId=${encodeURIComponent(id)}`)} retry={() => refreshCenter()} canOpenEmployees={user?.role === "operations_manager" && canView("operations_hr")} performanceDays={performanceDays} onPerformanceDays={changePerformanceDays} performanceLoading={center.isPlaceholderData} evidenceRefreshing={center.isFetching} monthlyBranches={branches} monthlyReady={scopeChecked && !branchesLoading && !branchesError} monthlyLiveManaged={liveEnabled} />
      : <Empty message="تعذر التحقق من نطاق الاستجابة. حدّث الصفحة بعد مراجعة صلاحيات الفروع." />}
  </OperationsCenterScreen></Layout>;
}