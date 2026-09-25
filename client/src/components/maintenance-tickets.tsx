import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle, CheckCircle2, Clock3, Download, History, Loader2, Paperclip,
  Pencil, Plus, RefreshCw, RotateCcw, Search, ShieldAlert, Upload, UserRound, Wrench,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useVisualViewportDialog } from "@/components/central-kitchen/use-visual-viewport-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { useBranchNavigation } from "@/hooks/use-branch-navigation";
import { usePermissions } from "@/hooks/usePermissions";
import { HttpError, apiRequest, getHttpStatus } from "@/lib/queryClient";
import { useSearch } from "wouter";

type Status = "open" | "assigned" | "in_progress" | "closed";
type Priority = "low" | "normal" | "high" | "urgent";
type Action = "assign" | "start" | "close" | "reopen";

type Ticket = {
  id: number;
  branchId: string;
  assetId?: string | null;
  description: string;
  priority: Priority;
  status: Status;
  assigneeUserId?: string | null;
  dueAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt?: string;
};
type TicketEvent = { id: number; eventType: string; actorName?: string | null; fromStatus?: Status | null; toStatus?: Status | null; reason?: string | null; createdAt: string };
type Attachment = { id: number; originalName: string; sizeBytes?: number; createdAt: string };
type Detail = Ticket & { history: TicketEvent[]; attachments: Attachment[] };
type Option = { id: string; name: string };
type Options = { assets: Option[]; users: Option[] };
type ListResult = { items: Ticket[]; total: number; page: number; pageSize: number };

const statuses: Record<Status, string> = { open: "مفتوحة", assigned: "مسندة", in_progress: "قيد التنفيذ", closed: "مغلقة" };
const priorities: Record<Priority, string> = { low: "منخفضة", normal: "عادية", high: "مرتفعة", urgent: "عاجلة" };
const events: Record<string, string> = {
  created: "إنشاء البلاغ", edited: "تعديل البلاغ", assign: "إسناد البلاغ", assigned: "إسناد البلاغ",
  start: "بدء العمل", close: "إغلاق البلاغ", reopen: "إعادة فتح البلاغ",
  attachment_added: "إضافة مرفق", attachment_archived: "حذف مرفق",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    timeZone: "Asia/Riyadh", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}
function toInput(value?: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
const fromInput = (value: string) => value ? new Date(`${value}:00+03:00`).toISOString() : null;
const ticketDue = (ticket: Ticket) => ticket.dueAt;
const ticketAssetId = (ticket: Ticket) => ticket.assetId;

export function maintenanceTicketErrorMessage(error: unknown) {
  const status = getHttpStatus(error);
  if (status === 403) return "لا تملك الصلاحية المطلوبة لهذا الإجراء.";
  if (status === 404) return "لم يعد بلاغ الصيانة متاحًا.";
  if (status === 409) return "عُدّل البلاغ من مستخدم آخر. جُلبت أحدث نسخة؛ راجعها ثم أعد المحاولة.";
  return "تعذر إتمام الطلب. حاول مرة أخرى.";
}
export function maintenanceTicketsListUrl(branchId: string, page: number, status: string, overdue: boolean) {
  const params = new URLSearchParams({ branchId, page: String(page) });
  if (status !== "all") params.set("status", status);
  if (overdue) params.set("overdue", "true");
  return `/api/maintenance-tickets?${params.toString()}`;
}

export const maintenanceDetailQueryKey = (branchId: string | null, ticketId: number | null) =>
  ["/api/maintenance-tickets", "detail", branchId, ticketId] as const;
export const maintenanceOptionsQueryKey = (branchId: string | null) =>
  ["/api/maintenance-tickets", "options", branchId] as const;

export function maintenanceTransitionPayload(version: number, action: Action, assigneeUserId = "", reason = "") {
  if (action === "assign" && !assigneeUserId) throw new Error("assignee required");
  if (action === "reopen" && !reason.trim()) throw new Error("reason required");
  return {
    version,
    action,
    ...(action === "assign" ? { assigneeUserId } : {}),
    ...(reason.trim() ? { reason: reason.trim() } : {}),
  };
}

export function maintenanceCreatePayload(fields: {
  branchId: string;
  description: string;
  priority: Priority;
  assetId: string;
  assigneeUserId: string;
  dueAt: string | null;
}) {
  return {
    branchId: fields.branchId,
    description: fields.description.trim(),
    priority: fields.priority,
    assetId: fields.assetId === "none" ? null : fields.assetId,
    assigneeUserId: fields.assigneeUserId === "none" ? null : fields.assigneeUserId,
    dueAt: fields.dueAt,
  };
}

function optionLabel(options: Option[] | undefined, id?: string | null) {
  if (!id) return null;
  return options?.find((option) => option.id === id)?.name ?? null;
}

export function MaintenanceTickets() {
  const client = useQueryClient();
  const search = useSearch();
  const urlParams = new URLSearchParams(search);
  const { user, activeBranchId, switchBranch, isSwitchingBranch } = useAuth();
  const { branches, userBranchId, canSelectBranch, isLoading: branchesLoading } = useBranches();
  const navigation = useBranchNavigation(branches, branchesLoading, userBranchId);
  const { canView, canCreate, canEdit, canApprove, isLoading: permissionsLoading } = usePermissions();
  const allowed = canView("maintenance");
  const createAllowed = canCreate("maintenance");
  const editAllowed = canEdit("maintenance");
  const approveAllowed = canApprove("maintenance");
  const initialStatus = urlParams.get("status");
  const [branchId, setBranchId] = useState<string | null>(navigation.branchId ?? activeBranchId ?? userBranchId ?? branches[0]?.id ?? null);
  const [status, setStatus] = useState(initialStatus === "active" ? "active" : initialStatus && initialStatus in statuses ? initialStatus : "all");
  const [overdue, setOverdue] = useState(urlParams.get("overdue") === "true");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(() => Number(urlParams.get("ticketId")) || null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Detail | null>(null);
  const [transition, setTransition] = useState<{ action: Action; label: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [serverDenied, setServerDenied] = useState(false);

  useEffect(() => {
    if (!branchId) setBranchId(navigation.branchId ?? activeBranchId ?? userBranchId ?? branches[0]?.id ?? null);
  }, [branchId, navigation.branchId, activeBranchId, userBranchId, branches]);
  useEffect(() => {
    if (!navigation.isResolving && navigation.hasBranchParam && navigation.branchId && branchId !== navigation.branchId) {
      setSelectedId(null); setEditing(null); setFormOpen(false); setTransition(null); setPage(1); setBranchId(navigation.branchId);
    }
  }, [navigation.isResolving, navigation.hasBranchParam, navigation.branchId, branchId]);
  useEffect(() => {
    if (permissionsLoading || allowed) return;
    client.removeQueries({ queryKey: ["/api/maintenance-tickets"] });
    setSelectedId(null); setEditing(null); setFormOpen(false);
  }, [allowed, client, permissionsLoading, user?.id]);

  const listUrl = useMemo(() => branchId ? maintenanceTicketsListUrl(branchId, page, status, overdue) : "", [branchId, page, status, overdue]);
  const tickets = useQuery<ListResult>({
    queryKey: ["/api/maintenance-tickets", branchId, page, status, overdue],
    enabled: Boolean(branchId && allowed && !serverDenied && !isSwitchingBranch && !navigation.isResolving),
    staleTime: 0, placeholderData: undefined,
    queryFn: async ({ signal }) => {
      const response = await fetch(listUrl, { credentials: "include", signal });
      if (!response.ok) throw new HttpError(response.status, await response.text());
      return response.json();
    },
  });
  const scopedOptions = useTicketOptions(branchId, allowed && !serverDenied && !isSwitchingBranch && !navigation.isResolving
    && (!navigation.hasBranchParam || branchId === navigation.branchId));
  const detail = useQuery<Detail>({
    queryKey: maintenanceDetailQueryKey(branchId, selectedId),
    enabled: Boolean(branchId && selectedId && allowed && !serverDenied && !isSwitchingBranch && !navigation.isResolving
      && (!navigation.hasBranchParam || branchId === navigation.branchId)),
    staleTime: 0, placeholderData: undefined,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/maintenance-tickets/${selectedId}`, { credentials: "include", signal });
      if (!response.ok) throw new HttpError(response.status, await response.text());
      const data = await response.json();
      if (data.branchId !== branchId) throw new HttpError(403, "branch scope mismatch");
      return { ...data, history: data.events, attachments: data.attachments };
    },
  });
  useEffect(() => {
    if (![tickets.error, scopedOptions.error, detail.error].some((error) => getHttpStatus(error) === 403)) return;
    setServerDenied(true);
    setSelectedId(null); setEditing(null); setFormOpen(false); setTransition(null);
    void client.cancelQueries({ queryKey: ["/api/maintenance-tickets"] }).then(() => {
      client.removeQueries({ queryKey: ["/api/maintenance-tickets"] });
    });
  }, [client, tickets.error, scopedOptions.error, detail.error]);
  // Never render previously-authorized data after a refetch is rejected.
  const validDetail = !detail.isError && !navigation.isResolving && !isSwitchingBranch && detail.data?.branchId === branchId ? detail.data : undefined;

  const chooseBranch = async (next: string) => {
    if (next === branchId) return;
    setSelectedId(null); setEditing(null); setFormOpen(false); setTransition(null); setNotice(null); setPage(1);
    await client.cancelQueries({ queryKey: ["/api/maintenance-tickets"] });
    client.removeQueries({ queryKey: ["/api/maintenance-tickets"] });
    setBranchId(next);
    const url = new URL(window.location.href);
    url.searchParams.set("branchId", next); url.searchParams.delete("ticketId");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    try { await switchBranch(next); } catch { setNotice("تعذر تغيير الفرع. لم نعرض بيانات الفرع السابق."); }
  };
  const openDetail = (id: number) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (branchId) url.searchParams.set("branchId", branchId);
    url.searchParams.set("ticketId", String(id));
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };
  const closeDetail = () => {
    setSelectedId(null);
    const url = new URL(window.location.href); url.searchParams.delete("ticketId");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };
  const updateUrlFilters = (nextStatus = status, nextOverdue = overdue) => {
    const url = new URL(window.location.href);
    if (nextStatus === "all") url.searchParams.delete("status"); else url.searchParams.set("status", nextStatus);
    if (nextOverdue) url.searchParams.set("overdue", "true"); else url.searchParams.delete("overdue");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };
  const changed = () => { client.invalidateQueries({ queryKey: ["/api/maintenance-tickets"] }); detail.refetch(); };

  if ((!permissionsLoading && !allowed) || serverDenied) return <Empty icon={ShieldAlert} title="لا تملك صلاحية عرض بلاغات الصيانة" />;
  return <section dir="rtl" data-testid="maintenance-tickets">
    <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Wrench className="h-6 w-6" /></span><div><h1 className="text-2xl font-black sm:text-3xl">بلاغات الصيانة</h1><p className="mt-1 text-sm text-muted-foreground">متابعة أعطال الفرع من البلاغ حتى الإغلاق.</p></div></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => Promise.all([tickets.refetch(), selectedId ? detail.refetch() : Promise.resolve()])} disabled={tickets.isFetching}><RefreshCw className={`ml-2 h-4 w-4 ${tickets.isFetching ? "animate-spin" : ""}`} />تحديث</Button>{createAllowed && <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="ml-2 h-4 w-4" />بلاغ جديد</Button>}</div>
    </div>
    <div className="mt-4 grid gap-3 rounded-2xl border bg-card p-3 sm:grid-cols-3">
      <div><Label>الفرع</Label><Select value={branchId ?? undefined} onValueChange={chooseBranch} disabled={branchesLoading || isSwitchingBranch || !canSelectBranch}><SelectTrigger className="mt-1 min-h-11"><SelectValue placeholder="اختر الفرع" /></SelectTrigger><SelectContent>{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>الحالة</Label><Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); updateUrlFilters(value, overdue); }}><SelectTrigger className="mt-1 min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل الحالات</SelectItem><SelectItem value="active">النشطة</SelectItem>{Object.entries(statuses).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>الاستحقاق</Label><Select value={overdue ? "overdue" : "all"} onValueChange={(value) => { const next = value === "overdue"; setOverdue(next); setPage(1); updateUrlFilters(status, next); }}><SelectTrigger className="mt-1 min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل المواعيد</SelectItem><SelectItem value="overdue">المتأخرة فقط</SelectItem></SelectContent></Select></div>
    </div>
    {notice && <Alert className="mt-3 border-amber-300 bg-amber-50 text-amber-900"><AlertCircle className="h-4 w-4" /><AlertDescription>{notice}</AlertDescription></Alert>}
    {(branchesLoading || permissionsLoading || navigation.isResolving || isSwitchingBranch || tickets.isLoading) && <ListSkeleton />}
    {tickets.isError && <Empty icon={AlertCircle} title={maintenanceTicketErrorMessage(tickets.error)} action={() => tickets.refetch()} />}
    {!tickets.isError && tickets.data?.items.length === 0 && <Empty icon={Search} title="لا توجد بلاغات صيانة مطابقة" />}
    {!tickets.isError && !!tickets.data?.items.length && <div className="mt-5 space-y-3">{tickets.data.items.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} options={scopedOptions.data} onOpen={() => openDetail(ticket.id)} />)}<div className="flex items-center justify-between pt-2 text-sm text-muted-foreground"><span>{tickets.data.total.toLocaleString("en-US")} بلاغ</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>السابق</Button><b>{page.toLocaleString("en-US")}</b><Button variant="outline" size="sm" disabled={page * tickets.data.pageSize >= tickets.data.total} onClick={() => setPage((value) => value + 1)}>التالي</Button></div></div></div>}
    <TicketForm open={formOpen} onOpenChange={setFormOpen} branchId={branchId} ticket={editing} onSaved={(saved) => { setFormOpen(false); setEditing(null); openDetail(saved.id); client.invalidateQueries({ queryKey: ["/api/maintenance-tickets"] }); }} onConflict={() => { setNotice(maintenanceTicketErrorMessage(new HttpError(409, "conflict"))); detail.refetch(); }} />
    <TicketDetail open={selectedId !== null} onOpenChange={(open) => { if (!open) closeDetail(); }} ticket={validDetail} options={scopedOptions.data} loading={detail.isLoading || isSwitchingBranch || navigation.isResolving} error={detail.isError ? maintenanceTicketErrorMessage(detail.error) : null} canEdit={editAllowed} canApprove={approveAllowed} onRetry={() => detail.refetch()} onEdit={() => { if (validDetail) { setEditing(validDetail); setFormOpen(true); } }} onTransition={(action, label) => setTransition({ action, label })} onChanged={changed} />
    <TransitionDialog open={transition !== null} value={transition} ticket={validDetail} onOpenChange={(open) => { if (!open) setTransition(null); }} onSaved={() => { setTransition(null); changed(); }} onConflict={() => { setNotice(maintenanceTicketErrorMessage(new HttpError(409, "conflict"))); detail.refetch(); }} />
  </section>;
}

function TicketCard({ ticket, options, onOpen }: { ticket: Ticket; options?: Options; onOpen: () => void }) {
  const overdue = ticket.status !== "closed" && !!ticketDue(ticket) && new Date(ticketDue(ticket)!).getTime() < Date.now();
  const assignee = optionLabel(options?.users, ticket.assigneeUserId);
  const asset = optionLabel(options?.assets, ticket.assetId);
  return <button type="button" onClick={onOpen} className="w-full rounded-2xl border bg-card p-4 text-right shadow-sm transition hover:border-primary/40 hover:shadow-md" data-testid={`maintenance-ticket-${ticket.id}`}><div className="flex items-start justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={ticket.status} /><PriorityBadge priority={ticket.priority} />{overdue && <Badge variant="destructive">متأخر</Badge>}<span className="text-xs text-muted-foreground">#{ticket.id.toLocaleString("en-US")}</span></div><span className="text-primary">←</span></div><p className="mt-2 line-clamp-2 font-bold">{ticket.description}</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground"><span><UserRound className="ml-1 inline h-3.5 w-3.5" />{ticket.assigneeUserId ? assignee ?? "مسؤول غير متاح" : "غير مسند"}</span><span><Clock3 className="ml-1 inline h-3.5 w-3.5" />الاستحقاق: {formatDate(ticketDue(ticket))}</span>{ticket.assetId && <span>{asset ?? "أصل غير متاح"}</span>}</div></button>;
}
function StatusBadge({ status }: { status: Status }) {
  const style: Record<Status, string> = { open: "bg-sky-100 text-sky-800", assigned: "bg-violet-100 text-violet-800", in_progress: "bg-amber-100 text-amber-900", closed: "bg-emerald-100 text-emerald-800" };
  return <Badge className={style[status]}>{statuses[status] ?? status}</Badge>;
}
function PriorityBadge({ priority }: { priority: Priority }) {
  const style: Record<Priority, string> = { low: "bg-slate-100 text-slate-700", normal: "bg-blue-50 text-blue-700", high: "bg-orange-100 text-orange-800", urgent: "bg-red-100 text-red-800" };
  return <Badge className={style[priority]}>{priorities[priority] ?? priority}</Badge>;
}

function useTicketOptions(branchId: string | null, enabled: boolean) {
  return useQuery<Options>({
    queryKey: maintenanceOptionsQueryKey(branchId), enabled: Boolean(enabled && branchId), placeholderData: undefined,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/maintenance-tickets/options?branchId=${encodeURIComponent(branchId!)}`, { credentials: "include", signal });
      if (!response.ok) throw new HttpError(response.status, await response.text());
      const data = await response.json();
      return {
        assets: data.assets.map((asset: any) => ({ id: asset.id, name: asset.name })),
        users: data.assignees.map((person: any) => ({
          id: person.id,
          name: [person.firstName, person.lastName].filter(Boolean).join(" ") || person.username,
        })),
      };
    },
  });
}

function TicketForm({ open, onOpenChange, branchId, ticket, onSaved, onConflict }: { open: boolean; onOpenChange: (open: boolean) => void; branchId: string | null; ticket: Detail | null; onSaved: (ticket: Ticket) => void; onConflict: () => void }) {
  const style = useVisualViewportDialog({ open, maxHeight: 800, viewportFraction: 0.94 });
  const options = useTicketOptions(branchId, open);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [assetId, setAssetId] = useState("none");
  const [assigneeUserId, setAssigneeUserId] = useState("none");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setDescription(ticket?.description ?? ""); setPriority(ticket?.priority ?? "normal");
    setAssetId(ticketAssetId(ticket ?? ({} as Ticket)) ? String(ticketAssetId(ticket!)) : "none");
    setAssigneeUserId(ticket?.assigneeUserId ?? "none"); setDueDate(toInput(ticketDue(ticket ?? ({} as Ticket)))); setError(null);
  }, [open, ticket]);
  const save = useMutation({
    mutationFn: async () => {
      const fields = maintenanceCreatePayload({ branchId: branchId!, description, priority, assetId, assigneeUserId, dueAt: fromInput(dueDate) });
      const { branchId: _branchId, ...editableFields } = fields;
      const response = ticket ? await apiRequest("PATCH", `/api/maintenance-tickets/${ticket.id}`, { version: ticket.version, ...editableFields }) : await apiRequest("POST", "/api/maintenance-tickets", fields);
      return response.json() as Promise<Ticket>;
    },
    onSuccess: onSaved,
    onError: (problem) => { if (getHttpStatus(problem) === 409) onConflict(); setError(maintenanceTicketErrorMessage(problem)); },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!description.trim()) { setError("أكمل وصف العطل."); return; }
    save.mutate();
  };
  return <Dialog open={open} onOpenChange={(value) => { if (!save.isPending) onOpenChange(value); }}><DialogContent dir="rtl" className="flex max-w-2xl flex-col overflow-hidden p-0" style={style}><DialogHeader className="border-b p-5 text-right"><DialogTitle>{ticket ? "تعديل بلاغ الصيانة" : "بلاغ صيانة جديد"}</DialogTitle></DialogHeader><form onSubmit={submit} className="flex min-h-0 flex-1 flex-col"><div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
    {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    <div><Label htmlFor="maintenance-description">وصف العطل</Label><Textarea id="maintenance-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={5} maxLength={10000} className="mt-1" /></div>
    <div className="grid gap-4 sm:grid-cols-2"><div><Label>الأصل / الصنف (اختياري)</Label><Select value={assetId} onValueChange={setAssetId} disabled={options.isLoading || options.isError}><SelectTrigger className="mt-1"><SelectValue placeholder="اختر الأصل" /></SelectTrigger><SelectContent><SelectItem value="none">غير مرتبط بأصل</SelectItem>{options.data?.assets.map((asset) => <SelectItem key={asset.id} value={asset.id}>{asset.name}</SelectItem>)}</SelectContent></Select></div><div><Label>الأولوية</Label><Select value={priority} onValueChange={(value: Priority) => setPriority(value)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(priorities).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div>
    <div className="grid gap-4 sm:grid-cols-2"><div><Label>المسؤول (اختياري)</Label><Select value={assigneeUserId} onValueChange={setAssigneeUserId} disabled={options.isLoading || options.isError}><SelectTrigger className="mt-1"><SelectValue placeholder="اختر المسؤول" /></SelectTrigger><SelectContent><SelectItem value="none">غير مسند</SelectItem>{options.data?.users.map((person) => <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="maintenance-due">موعد الاستحقاق (اختياري، بتوقيت السعودية)</Label><Input id="maintenance-due" type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1" dir="ltr" /></div></div>
    {options.isError && <p className="text-sm font-semibold text-red-700">تعذر تحميل الأصول والمسؤولين المتاحين لهذا الفرع.</p>}
    {!ticket && <p className="text-xs text-muted-foreground">يمكنك إضافة الصور والمرفقات بعد حفظ البلاغ.</p>}
  </div><DialogFooter className="border-t p-4"><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>إلغاء</Button><Button type="submit" disabled={save.isPending || options.isError}>{save.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}حفظ</Button></DialogFooter></form></DialogContent></Dialog>;
}

function TicketDetail({ open, onOpenChange, ticket, options, loading, error, canEdit, canApprove, onRetry, onEdit, onTransition, onChanged }: { open: boolean; onOpenChange: (open: boolean) => void; ticket?: Detail; options?: Options; loading: boolean; error: string | null; canEdit: boolean; canApprove: boolean; onRetry: () => void; onEdit: () => void; onTransition: (action: Action, label: string) => void; onChanged: () => void }) {
  const style = useVisualViewportDialog({ open, maxHeight: 900, viewportFraction: 0.96 });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir="rtl" className="flex max-w-3xl flex-col overflow-hidden p-0" style={style}><DialogHeader className="border-b p-5 text-right"><DialogTitle>{ticket ? `بلاغ الصيانة #${ticket.id.toLocaleString("en-US")}` : "تفاصيل بلاغ الصيانة"}</DialogTitle></DialogHeader><div className="min-h-0 flex-1 overflow-y-auto p-5">
    {loading && <div className="flex min-h-52 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>}
    {error && <Empty icon={AlertCircle} title={error} action={onRetry} />}
    {ticket && !loading && <><div className="flex flex-wrap items-center gap-2"><StatusBadge status={ticket.status} /><PriorityBadge priority={ticket.priority} />{canEdit && ticket.status !== "closed" && <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="ml-2 h-4 w-4" />تعديل</Button>}</div>
      <section className="mt-5 rounded-2xl bg-muted p-4"><h3 className="font-black">وصف العطل</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7">{ticket.description}</p><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">الأصل / الصنف</dt><dd className="font-bold">{ticket.assetId ? optionLabel(options?.assets, ticket.assetId) ?? "أصل غير متاح" : "غير مرتبط"}</dd></div><div><dt className="text-muted-foreground">المسؤول</dt><dd className="font-bold">{ticket.assigneeUserId ? optionLabel(options?.users, ticket.assigneeUserId) ?? "مسؤول غير متاح" : "غير مسند"}</dd></div><div><dt className="text-muted-foreground">موعد الاستحقاق</dt><dd className="font-bold">{formatDate(ticketDue(ticket))}</dd></div><div><dt className="text-muted-foreground">تاريخ الإنشاء</dt><dd className="font-bold">{formatDate(ticket.createdAt)}</dd></div></dl></section>
      <section className="mt-5"><h3 className="font-black">الإجراءات</h3><div className="mt-2 flex flex-wrap gap-2">{canEdit && ticket.status === "open" && <Button onClick={() => onTransition("assign", "إسناد البلاغ")}><UserRound className="ml-2 h-4 w-4" />إسناد</Button>}{canEdit && ticket.status === "assigned" && <Button onClick={() => onTransition("start", "بدء العمل")}><Clock3 className="ml-2 h-4 w-4" />بدء العمل</Button>}{canApprove && ticket.status === "in_progress" && <Button onClick={() => onTransition("close", "إغلاق البلاغ")}><CheckCircle2 className="ml-2 h-4 w-4" />إغلاق</Button>}{canApprove && ticket.status === "closed" && <Button variant="outline" onClick={() => onTransition("reopen", "إعادة فتح البلاغ")}><RotateCcw className="ml-2 h-4 w-4" />إعادة فتح</Button>}</div></section>
      <Attachments ticket={ticket} canEdit={canEdit} onChanged={onChanged} />
      <section className="mt-6"><h3 className="flex items-center gap-2 font-black"><History className="h-5 w-5" />سجل البلاغ</h3><div className="mt-3 space-y-3">{ticket.history.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد أحداث مسجلة.</p> : ticket.history.map((event) => <div key={event.id} className="border-r-2 border-primary/20 pr-3"><div className="flex flex-wrap items-center gap-2"><b className="text-sm">{events[event.eventType] ?? event.eventType}</b><span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span></div><p className="mt-1 text-xs text-muted-foreground">{event.actorName ?? "مستخدم النظام"}{event.fromStatus && event.toStatus ? ` · ${statuses[event.fromStatus]} ← ${statuses[event.toStatus]}` : ""}</p>{event.reason && <p className="mt-1 rounded-lg bg-muted p-2 text-sm">{event.reason}</p>}</div>)}</div></section>
    </>}
  </div></DialogContent></Dialog>;
}

function Attachments({ ticket, canEdit, onChanged }: { ticket: Detail; canEdit: boolean; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = (file?: File) => {
    if (!file) return;
    setError(null); setProgress(0);
    const body = new FormData(); body.append("file", file); body.append("version", String(ticket.version));
    const xhr = new XMLHttpRequest(); xhr.open("POST", `/api/maintenance-tickets/${ticket.id}/attachments`); xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => { setProgress(null); if (xhr.status >= 200 && xhr.status < 300) { if (input.current) input.current.value = ""; onChanged(); } else setError(xhr.status === 403 ? "لا تملك صلاحية إضافة مرفق." : "فشل رفع المرفق."); };
    xhr.onerror = () => { setProgress(null); setError("تعذر الاتصال أثناء رفع المرفق."); }; xhr.send(body);
  };
  const remove = async (file: Attachment) => {
    setDeleting(file.id); setError(null);
    try {
      await apiRequest("DELETE", `/api/maintenance-tickets/${ticket.id}/attachments/${file.id}`, { version: ticket.version });
      onChanged();
    } catch (problem) {
      setError(maintenanceTicketErrorMessage(problem));
    } finally {
      setDeleting(null);
    }
  };
  return <section className="mt-6"><div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-black"><Paperclip className="h-5 w-5" />الصور والمرفقات</h3>{canEdit && <><input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => upload(event.target.files?.[0])} /><Button size="sm" variant="outline" disabled={progress !== null} onClick={() => input.current?.click()}><Upload className="ml-2 h-4 w-4" />إضافة صورة</Button></>}</div>{progress !== null && <p className="mt-2 text-sm">جار الرفع: {progress.toLocaleString("en-US")}%</p>}{error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}<div className="mt-3 space-y-2">{ticket.attachments.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد مرفقات.</p> : ticket.attachments.map((file) => <div key={file.id} className="flex items-center gap-3 rounded-xl border bg-card p-3"><Paperclip className="h-5 w-5 text-primary" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{file.originalName}</p><p className="text-xs text-muted-foreground">{formatDate(file.createdAt)}</p></div><Button asChild size="icon" variant="ghost"><a href={`/api/maintenance-tickets/${ticket.id}/attachments/${file.id}`} target="_blank" rel="noreferrer" aria-label={`عرض ${file.originalName}`}><Download className="h-4 w-4" /></a></Button>{canEdit && <Button size="sm" variant="ghost" className="text-red-700" disabled={deleting !== null} onClick={() => remove(file)}>{deleting === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "حذف"}</Button>}</div>)}</div></section>;
}

function TransitionDialog({ open, value, ticket, onOpenChange, onSaved, onConflict }: { open: boolean; value: { action: Action; label: string } | null; ticket?: Detail; onOpenChange: (open: boolean) => void; onSaved: () => void; onConflict: () => void }) {
  const style = useVisualViewportDialog({ open, maxHeight: 560, viewportFraction: 0.9 });
  const options = useTicketOptions(ticket?.branchId ?? null, open && value?.action === "assign");
  const [reason, setReason] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("none");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setReason(""); setAssigneeUserId(ticket?.assigneeUserId ?? "none"); setError(null); } }, [open, value?.action, ticket?.assigneeUserId]);
  const mutation = useMutation({
    mutationFn: () => {
      if (!ticket || !value) throw new Error("missing ticket");
      return apiRequest("POST", `/api/maintenance-tickets/${ticket.id}/transition`, maintenanceTransitionPayload(ticket.version, value.action, assigneeUserId, reason));
    },
    onSuccess: onSaved,
    onError: (problem) => { if (getHttpStatus(problem) === 409) { onOpenChange(false); onConflict(); } else setError(maintenanceTicketErrorMessage(problem)); },
  });
  const mandatoryReason = value?.action === "reopen";
  return <Dialog open={open} onOpenChange={(next) => { if (!mutation.isPending) onOpenChange(next); }}><DialogContent dir="rtl" className="max-w-md" style={style}><DialogHeader className="text-right"><DialogTitle>{value?.label}</DialogTitle></DialogHeader>{error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}{value?.action === "assign" && <div><Label>المسؤول</Label><Select value={assigneeUserId} onValueChange={setAssigneeUserId}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{options.data?.users.map((person) => <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>)}</SelectContent></Select></div>}<div><Label htmlFor="maintenance-transition-reason">{mandatoryReason ? "سبب إعادة الفتح (مطلوب)" : "ملاحظة (اختيارية)"}</Label><Textarea id="maintenance-transition-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="mt-1" /></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>إلغاء</Button><Button disabled={mutation.isPending || (mandatoryReason && !reason.trim()) || (value?.action === "assign" && assigneeUserId === "none")} onClick={() => mutation.mutate()}>{mutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}{value?.label}</Button></DialogFooter></DialogContent></Dialog>;
}

function Empty({ icon: Icon, title, action }: { icon: typeof AlertCircle; title: string; action?: () => void }) {
  return <section className="mt-8 rounded-3xl border border-dashed bg-card px-5 py-12 text-center"><Icon className="mx-auto h-9 w-9 text-primary" /><h2 className="mt-3 font-black">{title}</h2>{action && <Button variant="outline" className="mt-4" onClick={action}><RefreshCw className="ml-2 h-4 w-4" />إعادة المحاولة</Button>}</section>;
}
function ListSkeleton() {
  return <div className="mt-6 space-y-3" aria-label="جار تحميل بلاغات الصيانة">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted" />)}</div>;
}