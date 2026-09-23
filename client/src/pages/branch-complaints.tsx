import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle, ArrowRight, CheckCircle2, Clock3, Download,
  History, Loader2, MessageSquareWarning, Paperclip, Pencil, Plus, RefreshCw,
  RotateCcw, Search, ShieldAlert, Trash2, Upload, UserRound,
} from "lucide-react";
import { Layout } from "@/components/layout";
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

type Status = "open" | "in_progress" | "resolved" | "closed";
type Priority = "low" | "normal" | "high" | "urgent";
type Category = "service" | "product" | "cleanliness" | "staff" | "other";

type Complaint = {
  id: number;
  branchId: string;
  subject: string;
  description: string;
  category: Category;
  priority: Priority;
  status: Status;
  ownerUserId?: string | null;
  ownerName?: string | null;
  responseDue?: string | null;
  version: number;
  createdAt: string;
  updatedAt?: string;
};

type ComplaintEvent = {
  id: number;
  eventType: string;
  actorName?: string | null;
  fromStatus?: Status | null;
  toStatus?: Status | null;
  reason?: string | null;
  createdAt: string;
};

type Attachment = {
  id: number;
  originalName: string;
  mimeType?: string;
  sizeBytes?: number;
  uploaderName?: string | null;
  createdAt: string;
};

type Detail = Complaint & { history: ComplaintEvent[]; attachments: Attachment[] };
type Assignee = { id: string; name: string };
type ListResult = { items: Complaint[]; total: number; page: number; pageSize: number };

const statusLabels: Record<Status, string> = { open: "مفتوحة", in_progress: "قيد المعالجة", resolved: "تم الحل", closed: "مغلقة" };
const priorityLabels: Record<Priority, string> = { low: "منخفضة", normal: "عادية", high: "مرتفعة", urgent: "عاجلة" };
const categoryLabels: Record<Category, string> = { service: "الخدمة", product: "المنتج", cleanliness: "النظافة", staff: "الموظفون", other: "أخرى" };
const eventLabels: Record<string, string> = {
  created: "إنشاء البلاغ", edited: "تعديل البلاغ", start: "بدء المعالجة",
  resolve: "تسجيل الحل", close: "إغلاق البلاغ", reopen: "إعادة فتح البلاغ",
  attachment_added: "إضافة مرفق", attachment_removed: "حذف مرفق",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    timeZone: "Asia/Riyadh", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function isoToSaudiInput(value?: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function saudiInputToIso(value: string) {
  return value ? new Date(`${value}:00+03:00`).toISOString() : null;
}

async function json<T>(res: Response): Promise<T> {
  return res.json();
}

function listShape(value: any, page: number): ListResult {
  const items = Array.isArray(value) ? value : value.items ?? value.complaints ?? value.data ?? [];
  return {
    items,
    total: Number(value?.total ?? value?.pagination?.total ?? items.length),
    page: Number(value?.page ?? value?.pagination?.page ?? page),
    pageSize: Number(value?.pageSize ?? value?.pagination?.pageSize ?? 20),
  };
}

function errorMessage(error: unknown) {
  const status = getHttpStatus(error);
  if (status === 403) return "لا تملك الصلاحية المطلوبة لهذا الإجراء.";
  if (status === 404) return "لم يعد البلاغ متاحًا.";
  if (status === 409) return "عُدّل البلاغ من مستخدم آخر. تم جلب أحدث نسخة؛ راجعها ثم أعد المحاولة.";
  return "تعذر إتمام الطلب. حاول مرة أخرى.";
}

export default function BranchComplaintsPage() {
  const client = useQueryClient();
  const { activeBranchId, switchBranch, isSwitchingBranch, user } = useAuth();
  const { branches, userBranchId, canSelectBranch, isLoading: branchesLoading } = useBranches();
  const navigation = useBranchNavigation(branches, branchesLoading, userBranchId);
  const { canView, canCreate, canEdit, canApprove, isLoading: permissionsLoading } = usePermissions();
  const viewAllowed = canView("branch_complaints");
  const createAllowed = canCreate("branch_complaints");
  const editAllowed = canEdit("branch_complaints");
  const approveAllowed = canApprove("branch_complaints");
  const params = new URLSearchParams(window.location.search);
  const initialBranch = navigation.branchId ?? activeBranchId ?? userBranchId ?? branches[0]?.id ?? null;
  const [branchId, setBranchId] = useState<string | null>(initialBranch);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const id = Number(params.get("complaintId"));
    return Number.isInteger(id) && id > 0 ? id : null;
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Detail | null>(null);
  const [transition, setTransition] = useState<{ action: "start" | "resolve" | "close" | "reopen"; label: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);

  useEffect(() => {
    if (!branchId && initialBranch) setBranchId(initialBranch);
  }, [branchId, initialBranch]);

  useEffect(() => {
    if (!navigation.isResolving && navigation.hasBranchParam && navigation.branchId && navigation.branchId !== branchId) {
      setSelectedId(null);
      setPage(1);
      setBranchId(navigation.branchId);
    }
  }, [navigation.isResolving, navigation.hasBranchParam, navigation.branchId, branchId]);

  useEffect(() => {
    if (permissionsLoading || viewAllowed) return;
    client.removeQueries({ queryKey: ["/api/branch-complaints"] });
    setSelectedId(null);
  }, [client, permissionsLoading, viewAllowed, user?.id]);

  const queryString = useMemo(() => {
    if (!branchId) return "";
    const query = new URLSearchParams({ branchId, page: String(page) });
    if (status !== "all") query.set("status", status);
    if (priority !== "all") query.set("priority", priority);
    return query.toString();
  }, [branchId, page, status, priority]);

  const complaints = useQuery<ListResult>({
    queryKey: ["/api/branch-complaints", branchId, page, status, priority],
    enabled: Boolean(branchId && viewAllowed && !isSwitchingBranch && !navigation.isResolving),
    staleTime: 0,
    placeholderData: undefined,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/branch-complaints?${queryString}`, { credentials: "include", signal });
      if (!res.ok) throw new HttpError(res.status, await res.text());
      return listShape(await res.json(), page);
    },
  });

  const detail = useQuery<Detail>({
    queryKey: ["/api/branch-complaints/detail", branchId, selectedId],
    enabled: Boolean(branchId && selectedId && viewAllowed && !isSwitchingBranch && !navigation.isResolving),
    staleTime: 0,
    placeholderData: undefined,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/branch-complaints/${selectedId}`, { credentials: "include", signal });
      if (!res.ok) throw new HttpError(res.status, await res.text());
      const data = await res.json();
      if (data.branchId !== branchId) throw new HttpError(403, "branch scope mismatch");
      return { ...data, history: data.history ?? data.events ?? [], attachments: data.attachments ?? [] };
    },
  });

  const validDetail = detail.data?.branchId === branchId ? detail.data : undefined;

  const chooseBranch = async (next: string) => {
    if (next === branchId) return;
    setSwitchError(null);
    setSelectedId(null);
    setNotice(null);
    await client.cancelQueries({ queryKey: ["/api/branch-complaints"] });
    client.removeQueries({ queryKey: ["/api/branch-complaints"] });
    setBranchId(next);
    setPage(1);
    const url = new URL(window.location.href);
    url.searchParams.set("branchId", next);
    url.searchParams.delete("complaintId");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    try {
      await switchBranch(next);
    } catch {
      setSwitchError("تعذر تغيير الفرع. لم نعرض بيانات الفرع السابق.");
    }
  };

  const openDetail = (id: number) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (branchId) url.searchParams.set("branchId", branchId);
    url.searchParams.set("complaintId", String(id));
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  const closeDetail = () => {
    setSelectedId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("complaintId");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  const refresh = async () => {
    setNotice(null);
    await Promise.all([complaints.refetch(), selectedId ? detail.refetch() : Promise.resolve()]);
  };

  if (!permissionsLoading && !viewAllowed) {
    return <Layout><main dir="rtl" className="page-container py-16"><Empty icon={ShieldAlert} title="لا تملك صلاحية عرض شكاوى الفروع" /></main></Layout>;
  }

  return (
    <Layout>
      <main dir="rtl" className="page-container min-h-screen pb-12" data-testid="branch-complaints-page">
        <header className="pt-5 sm:pt-8">
          <div className="flex flex-col gap-4 border-b border-[#decdbd] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#713b5d] text-[#fffaf3]"><MessageSquareWarning className="h-6 w-6" /></span>
              <div><p className="text-xs font-bold tracking-[.15em] text-[#713b5d]">BUTTER BAKERY · BRANCH CARE</p><h1 className="mt-1 text-2xl font-black text-[#332c3d] sm:text-3xl">شكاوى الفروع</h1><p className="mt-1 text-sm text-[#6d6270]">متابعة البلاغ من الاستلام حتى توثيق الحل والإغلاق.</p></div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={refresh} disabled={complaints.isFetching || !branchId}><RefreshCw className={`ml-2 h-4 w-4 ${complaints.isFetching ? "animate-spin" : ""}`} />تحديث</Button>
              {createAllowed && <Button className="bg-[#713b5d] hover:bg-[#593049]" onClick={() => { setEditing(null); setFormOpen(true); }} data-testid="button-create-complaint"><Plus className="ml-2 h-4 w-4" />بلاغ جديد</Button>}
            </div>
          </div>
          <div className="mt-4 grid gap-3 rounded-2xl border border-[#e7d7c7] bg-[#fffdf9] p-3 sm:grid-cols-3">
            <div><Label>الفرع</Label><Select value={branchId ?? undefined} onValueChange={chooseBranch} disabled={branchesLoading || isSwitchingBranch || !canSelectBranch}><SelectTrigger className="mt-1 min-h-11"><SelectValue placeholder="اختر الفرع" /></SelectTrigger><SelectContent>{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>الحالة</Label><Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}><SelectTrigger className="mt-1 min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل الحالات</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>الأولوية</Label><Select value={priority} onValueChange={(value) => { setPriority(value); setPage(1); }}><SelectTrigger className="mt-1 min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل الأولويات</SelectItem>{Object.entries(priorityLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          {switchError && <Alert variant="destructive" className="mt-3"><AlertCircle className="h-4 w-4" /><AlertDescription>{switchError}</AlertDescription></Alert>}
          {notice && <Alert className="mt-3 border-amber-300 bg-amber-50 text-amber-900"><AlertCircle className="h-4 w-4" /><AlertDescription>{notice}</AlertDescription></Alert>}
        </header>

        {(branchesLoading || navigation.isResolving || isSwitchingBranch || complaints.isLoading) && <ListSkeleton />}
        {!branchId && !branchesLoading && <Empty icon={MessageSquareWarning} title="اختر فرعًا لعرض شكاواه" />}
        {complaints.isError && <Empty icon={AlertCircle} title="تعذر تحميل الشكاوى" action={() => complaints.refetch()} />}
        {complaints.data && complaints.data.items.length === 0 && <Empty icon={Search} title="لا توجد شكاوى مطابقة" />}
        {complaints.data && complaints.data.items.length > 0 && (
          <section className="mt-5 space-y-3" aria-label="قائمة الشكاوى">
            {complaints.data.items.map((item) => <ComplaintCard key={item.id} item={item} onOpen={() => openDetail(item.id)} />)}
            <div className="flex items-center justify-between pt-2 text-sm text-[#6d6270]">
              <span>{complaints.data.total.toLocaleString("en-US")} بلاغ</span>
              <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</Button><span className="flex min-w-10 items-center justify-center font-bold">{page.toLocaleString("en-US")}</span><Button variant="outline" size="sm" disabled={page * complaints.data.pageSize >= complaints.data.total} onClick={() => setPage((p) => p + 1)}>التالي</Button></div>
            </div>
          </section>
        )}
      </main>

      <ComplaintForm
        open={formOpen}
        onOpenChange={setFormOpen}
        branchId={branchId}
        complaint={editing}
        onConflict={async () => {
          setNotice(errorMessage(new HttpError(409, "conflict")));
          const latest = await detail.refetch();
          if (latest.data) setEditing(latest.data);
        }}
        onSaved={(saved) => { setFormOpen(false); setEditing(null); openDetail(saved.id); client.invalidateQueries({ queryKey: ["/api/branch-complaints"] }); }}
      />
      <DetailDialog
        open={selectedId !== null}
        onOpenChange={(open) => { if (!open) closeDetail(); }}
        detail={validDetail}
        loading={detail.isLoading || isSwitchingBranch}
        error={detail.isError ? errorMessage(detail.error) : null}
        canEdit={editAllowed}
        canApprove={approveAllowed}
        onRetry={() => detail.refetch()}
        onEdit={() => { if (validDetail) { setEditing(validDetail); setFormOpen(true); } }}
        onTransition={(action, label) => setTransition({ action, label })}
        onChanged={() => { client.invalidateQueries({ queryKey: ["/api/branch-complaints"] }); detail.refetch(); }}
      />
      <TransitionDialog open={transition !== null} value={transition} complaint={validDetail} onOpenChange={(open) => { if (!open) setTransition(null); }} onConflict={() => { setNotice(errorMessage(new HttpError(409, "conflict"))); detail.refetch(); }} onSaved={() => { setTransition(null); client.invalidateQueries({ queryKey: ["/api/branch-complaints"] }); detail.refetch(); }} />
    </Layout>
  );
}

function ComplaintCard({ item, onOpen }: { item: Complaint; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="w-full rounded-2xl border border-[#e4d5c8] bg-[#fffdf9] p-4 text-right shadow-sm transition hover:border-[#b98ca8] hover:shadow-md" data-testid={`complaint-${item.id}`}>
    <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><StatusBadge status={item.status} /><PriorityBadge priority={item.priority} /><span className="text-xs text-[#776973]">#{item.id.toLocaleString("en-US")}</span></div><h2 className="mt-2 font-black text-[#332c3d]">{item.subject}</h2></div><ArrowRight className="mt-1 h-5 w-5 rotate-180 text-[#713b5d]" /></div>
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#6d6270]"><span>{categoryLabels[item.category]}</span><span><UserRound className="ml-1 inline h-3.5 w-3.5" />{item.ownerName ?? "غير مسند"}</span><span><Clock3 className="ml-1 inline h-3.5 w-3.5" />الاستجابة: {formatDate(item.responseDue)}</span></div>
  </button>;
}

function StatusBadge({ status }: { status: Status }) {
  const style: Record<Status, string> = { open: "bg-sky-100 text-sky-800", in_progress: "bg-amber-100 text-amber-900", resolved: "bg-emerald-100 text-emerald-800", closed: "bg-slate-200 text-slate-700" };
  return <Badge className={style[status]}>{statusLabels[status]}</Badge>;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const style: Record<Priority, string> = { low: "bg-slate-100 text-slate-700", normal: "bg-blue-50 text-blue-700", high: "bg-orange-100 text-orange-800", urgent: "bg-red-100 text-red-800" };
  return <Badge className={style[priority]}>{priorityLabels[priority]}</Badge>;
}

function ComplaintForm({ open, onOpenChange, branchId, complaint, onConflict, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; branchId: string | null; complaint: Detail | null; onConflict: () => void; onSaved: (value: Complaint) => void }) {
  const style = useVisualViewportDialog({ open, maxHeight: 850, viewportFraction: 0.94 });
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("service");
  const [priority, setPriority] = useState<Priority>("normal");
  const [ownerUserId, setOwnerUserId] = useState("none");
  const [responseDue, setResponseDue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubject(complaint?.subject ?? "");
    setDescription(complaint?.description ?? "");
    setCategory(complaint?.category ?? "service");
    setPriority(complaint?.priority ?? "normal");
    setOwnerUserId(complaint?.ownerUserId ?? "none");
    setResponseDue(isoToSaudiInput(complaint?.responseDue));
    setError(null);
  }, [open, complaint]);

  const assignees = useQuery<Assignee[]>({
    queryKey: ["/api/branch-complaints/assignees", branchId],
    enabled: Boolean(open && branchId),
    placeholderData: undefined,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/branch-complaints/assignees?branchId=${encodeURIComponent(branchId!)}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : data.items ?? data.assignees ?? [];
      return items.map((person: any) => ({
        id: person.id,
        name: person.name || [person.firstName, person.lastName].filter(Boolean).join(" ") || person.username,
      }));
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const fields = { subject: subject.trim(), description: description.trim(), category, priority, ownerUserId: ownerUserId === "none" ? null : ownerUserId, responseDue: saudiInputToIso(responseDue) };
      const res = complaint
        ? await apiRequest("PATCH", `/api/branch-complaints/${complaint.id}`, { version: complaint.version, ...fields })
        : await apiRequest("POST", "/api/branch-complaints", { branchId, ...fields });
      return json<Complaint>(res);
    },
    onSuccess: onSaved,
    onError: (problem) => {
      if (getHttpStatus(problem) === 409) onConflict();
      setError(errorMessage(problem));
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !description.trim() || !responseDue) { setError("أكمل الموضوع والوصف وموعد الاستجابة."); return; }
    save.mutate();
  };

  return <Dialog open={open} onOpenChange={(value) => { if (!save.isPending) onOpenChange(value); }}><DialogContent dir="rtl" className="flex max-w-2xl flex-col overflow-hidden p-0" style={style}><DialogHeader className="border-b p-5 text-right"><DialogTitle>{complaint ? "تعديل البلاغ" : "بلاغ شكوى جديد"}</DialogTitle></DialogHeader><form onSubmit={submit} className="flex min-h-0 flex-1 flex-col"><div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
    {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    <div><Label htmlFor="complaint-subject">الموضوع</Label><Input id="complaint-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className="mt-1" /></div>
    <div><Label htmlFor="complaint-description">وصف الشكوى</Label><Textarea id="complaint-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className="mt-1" /></div>
    <div className="grid gap-4 sm:grid-cols-2"><div><Label>التصنيف</Label><Select value={category} onValueChange={(value: Category) => setCategory(value)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(categoryLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div><Label>الأولوية</Label><Select value={priority} onValueChange={(value: Priority) => setPriority(value)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(priorityLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div>
    <div className="grid gap-4 sm:grid-cols-2"><div><Label>المسؤول</Label><Select value={ownerUserId} onValueChange={setOwnerUserId} disabled={assignees.isLoading}><SelectTrigger className="mt-1"><SelectValue placeholder="اختر المسؤول" /></SelectTrigger><SelectContent><SelectItem value="none">غير مسند</SelectItem>{assignees.data?.map((person) => <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>)}</SelectContent></Select>{assignees.isError && <p className="mt-1 text-xs text-red-700">تعذر تحميل المسؤولين المؤهلين.</p>}</div><div><Label htmlFor="complaint-due">موعد الاستجابة (بتوقيت السعودية)</Label><Input id="complaint-due" type="datetime-local" value={responseDue} onChange={(e) => setResponseDue(e.target.value)} className="mt-1" dir="ltr" /></div></div>
  </div><DialogFooter className="border-t p-4"><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>إلغاء</Button><Button type="submit" className="bg-[#713b5d] hover:bg-[#593049]" disabled={save.isPending}>{save.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}حفظ</Button></DialogFooter></form></DialogContent></Dialog>;
}

function DetailDialog({ open, onOpenChange, detail, loading, error, canEdit, canApprove, onRetry, onEdit, onTransition, onChanged }: { open: boolean; onOpenChange: (open: boolean) => void; detail?: Detail; loading: boolean; error: string | null; canEdit: boolean; canApprove: boolean; onRetry: () => void; onEdit: () => void; onTransition: (action: "start" | "resolve" | "close" | "reopen", label: string) => void; onChanged: () => void }) {
  const style = useVisualViewportDialog({ open, maxHeight: 900, viewportFraction: 0.96 });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir="rtl" className="flex max-w-3xl flex-col overflow-hidden p-0" style={style}><DialogHeader className="border-b p-5 text-right"><DialogTitle>{detail ? `البلاغ #${detail.id.toLocaleString("en-US")} · ${detail.subject}` : "تفاصيل البلاغ"}</DialogTitle></DialogHeader><div className="min-h-0 flex-1 overflow-y-auto p-5">
    {loading && <div className="flex min-h-52 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#713b5d]" /></div>}
    {error && <Empty icon={AlertCircle} title={error} action={onRetry} />}
    {detail && !loading && <>
      <div className="flex flex-wrap items-center gap-2"><StatusBadge status={detail.status} /><PriorityBadge priority={detail.priority} />{canEdit && detail.status !== "closed" && <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="ml-2 h-4 w-4" />تعديل</Button>}</div>
      <section className="mt-5 rounded-2xl bg-[#fff8f0] p-4"><h3 className="font-black text-[#403442]">نظرة عامة</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#594f58]">{detail.description}</p><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-[#7b6b74]">التصنيف</dt><dd className="font-bold">{categoryLabels[detail.category]}</dd></div><div><dt className="text-[#7b6b74]">المسؤول</dt><dd className="font-bold">{detail.ownerName ?? "غير مسند"}</dd></div><div><dt className="text-[#7b6b74]">موعد الاستجابة</dt><dd className="font-bold">{formatDate(detail.responseDue)}</dd></div><div><dt className="text-[#7b6b74]">تاريخ الإنشاء</dt><dd className="font-bold">{formatDate(detail.createdAt)}</dd></div></dl></section>
      <section className="mt-5"><h3 className="font-black text-[#403442]">الإجراءات</h3><div className="mt-2 flex flex-wrap gap-2">{canEdit && detail.status === "open" && <Button onClick={() => onTransition("start", "بدء المعالجة")}><Clock3 className="ml-2 h-4 w-4" />بدء المعالجة</Button>}{canEdit && detail.status === "in_progress" && <Button onClick={() => onTransition("resolve", "تسجيل الحل")}><CheckCircle2 className="ml-2 h-4 w-4" />تسجيل الحل</Button>}{canApprove && detail.status === "resolved" && <Button onClick={() => onTransition("close", "إغلاق البلاغ")}><CheckCircle2 className="ml-2 h-4 w-4" />إغلاق البلاغ</Button>}{canApprove && (detail.status === "closed" || detail.status === "resolved") && <Button variant="outline" onClick={() => onTransition("reopen", "إعادة فتح البلاغ")}><RotateCcw className="ml-2 h-4 w-4" />إعادة فتح</Button>}</div></section>
      <Attachments complaint={detail} canEdit={canEdit} onChanged={onChanged} />
      <section className="mt-6"><h3 className="flex items-center gap-2 font-black text-[#403442]"><History className="h-5 w-5" />سجل البلاغ</h3><div className="mt-3 space-y-3">{detail.history.length === 0 ? <p className="text-sm text-[#786b72]">لا توجد أحداث مسجلة.</p> : detail.history.map((event) => <div key={event.id} className="border-r-2 border-[#d9b9ca] pr-3"><div className="flex flex-wrap items-center gap-2"><b className="text-sm">{eventLabels[event.eventType] ?? event.eventType}</b><span className="text-xs text-[#786b72]">{formatDate(event.createdAt)}</span></div><p className="mt-1 text-xs text-[#6d6270]">{event.actorName ?? "مستخدم النظام"}{event.fromStatus && event.toStatus ? ` · ${statusLabels[event.fromStatus]} ← ${statusLabels[event.toStatus]}` : ""}</p>{event.reason && <p className="mt-1 rounded-lg bg-slate-50 p-2 text-sm">{event.reason}</p>}</div>)}</div></section>
    </>}
  </div></DialogContent></Dialog>;
}

function Attachments({ complaint, canEdit, onChanged }: { complaint: Detail; canEdit: boolean; onChanged: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const upload = (file?: File) => {
    if (!file) return;
    setError(null);
    setProgress(0);
    const body = new FormData();
    body.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/branch-complaints/${complaint.id}/attachments`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100)); };
    xhr.onload = () => {
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) { if (inputRef.current) inputRef.current.value = ""; onChanged(); }
      else setError(xhr.status === 403 ? "لا تملك صلاحية إضافة مرفق." : "فشل رفع المرفق. يمكنك إعادة المحاولة.");
    };
    xhr.onerror = () => { setProgress(null); setError("تعذر الاتصال أثناء رفع المرفق. يمكنك إعادة المحاولة."); };
    xhr.send(body);
  };

  const remove = async (attachment: Attachment) => {
    setDeleting(attachment.id); setError(null);
    try {
      await apiRequest("DELETE", `/api/branch-complaints/${complaint.id}/attachments/${attachment.id}`);
      onChanged();
    } catch (problem) { setError(errorMessage(problem)); }
    finally { setDeleting(null); }
  };

  return <section className="mt-6"><div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-black text-[#403442]"><Paperclip className="h-5 w-5" />المرفقات</h3>{canEdit && <><input ref={inputRef} type="file" className="hidden" onChange={(e) => upload(e.target.files?.[0])} /><Button size="sm" variant="outline" disabled={progress !== null} onClick={() => inputRef.current?.click()}><Upload className="ml-2 h-4 w-4" />إضافة ملف</Button></>}</div>
    {progress !== null && <div className="mt-3"><div className="mb-1 flex justify-between text-xs"><span>جار الرفع</span><span>{progress.toLocaleString("en-US")}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-[#713b5d]" style={{ width: `${progress}%` }} /></div></div>}
    {error && <p className="mt-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
    <div className="mt-3 space-y-2">{complaint.attachments.length === 0 ? <p className="text-sm text-[#786b72]">لا توجد مرفقات.</p> : complaint.attachments.map((file) => <div key={file.id} className="flex items-center gap-3 rounded-xl border bg-white p-3"><Paperclip className="h-5 w-5 text-[#713b5d]" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{file.originalName}</p><p className="text-xs text-[#786b72]">{file.sizeBytes ? `${(file.sizeBytes / 1024).toLocaleString("en-US", { maximumFractionDigits: 1 })} KB · ` : ""}{formatDate(file.createdAt)}</p></div><Button asChild size="icon" variant="ghost"><a href={`/api/branch-complaints/${complaint.id}/attachments/${file.id}`} aria-label={`تنزيل ${file.originalName}`}><Download className="h-4 w-4" /></a></Button>{canEdit && <Button size="icon" variant="ghost" className="text-red-700" disabled={deleting !== null} onClick={() => remove(file)} aria-label={`حذف ${file.originalName}`}>{deleting === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button>}</div>)}</div>
  </section>;
}

function TransitionDialog({ open, value, complaint, onOpenChange, onConflict, onSaved }: { open: boolean; value: { action: "start" | "resolve" | "close" | "reopen"; label: string } | null; complaint?: Detail; onOpenChange: (open: boolean) => void; onConflict: () => void; onSaved: () => void }) {
  const style = useVisualViewportDialog({ open, maxHeight: 520, viewportFraction: 0.9 });
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setReason(""); setError(null); } }, [open, value?.action]);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!complaint || !value) throw new Error("missing complaint");
      return apiRequest("POST", `/api/branch-complaints/${complaint.id}/transition`, {
        version: complaint.version,
        action: value.action,
        ...(value.action === "resolve" ? { resolution: reason.trim() } : reason.trim() ? { reason: reason.trim() } : {}),
      });
    },
    onSuccess: onSaved,
    onError: (problem) => { if (getHttpStatus(problem) === 409) { onOpenChange(false); onConflict(); } else setError(errorMessage(problem)); },
  });
  const needsReason = value?.action !== "start";
  return <Dialog open={open} onOpenChange={(next) => { if (!mutation.isPending) onOpenChange(next); }}><DialogContent dir="rtl" className="max-w-md" style={style}><DialogHeader className="text-right"><DialogTitle>{value?.label}</DialogTitle></DialogHeader>{error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}<div><Label htmlFor="transition-reason">{needsReason ? "السبب / تفاصيل الحل" : "ملاحظة (اختيارية)"}</Label><Textarea id="transition-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={4} className="mt-1" /></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>إلغاء</Button><Button className="bg-[#713b5d] hover:bg-[#593049]" disabled={mutation.isPending || (needsReason && !reason.trim())} onClick={() => mutation.mutate()}>{mutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}{value?.label}</Button></DialogFooter></DialogContent></Dialog>;
}

function Empty({ icon: Icon, title, action }: { icon: typeof AlertCircle; title: string; action?: () => void }) {
  return <section className="mt-8 rounded-3xl border border-dashed border-[#d6bdac] bg-[#fffdf9] px-5 py-12 text-center"><Icon className="mx-auto h-9 w-9 text-[#713b5d]" /><h2 className="mt-3 font-black text-[#332c3d]">{title}</h2>{action && <Button variant="outline" className="mt-4" onClick={action}><RefreshCw className="ml-2 h-4 w-4" />إعادة المحاولة</Button>}</section>;
}

function ListSkeleton() {
  return <div className="mt-6 space-y-3" aria-label="جار تحميل الشكاوى">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-[#eadfd6]" />)}</div>;
}