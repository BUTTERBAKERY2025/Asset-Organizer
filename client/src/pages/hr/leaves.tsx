import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { useReactToPrint } from "react-to-print";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarDays, Plus, CheckCircle2, XCircle, Clock, Trash2, ArrowRight,
  Wallet, Printer, FileSpreadsheet, Ban, Paperclip, Pencil, ChevronRight, ChevronLeft, ListChecks, Sun, FileText,
} from "lucide-react";
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS } from "@shared/schema";
import butterLogo from "@assets/logo_-5_1765206843638.png";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import * as XLSX from "xlsx";

type Leave = any;
type Emp = { id: number; employeeName: string; jobTitle: string; branchId: string };
type Balance = any;

const initialForm = {
  branchEmployeeId: "",
  branchId: "",
  leaveType: "annual",
  startDate: "",
  endDate: "",
  reason: "",
  attachmentUrl: "",
  requiredLevels: "1",
};

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(0, Math.round((e - s) / (24 * 60 * 60 * 1000)) + 1);
}

const arNum = (v: any) => Number(v || 0).toLocaleString("ar-SA-u-nu-latn");

const fmtDate = (d?: string | null) => {
  if (!d) return "-";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("ar-SA-u-nu-latn-ca-gregory", { day: "numeric", month: "short" });
  } catch { return d; }
};

const serviceYears = (hireDate?: string | null): number | null => {
  if (!hireDate) return null;
  const h = new Date(hireDate + "T00:00:00").getTime();
  if (isNaN(h)) return null;
  return Math.floor((Date.now() - h) / (365.25 * 86400000));
};

export default function LeavesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [tab, setTab] = useState("requests");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof initialForm>(initialForm);
  const [reviewing, setReviewing] = useState<{ id: number; decision: "approved" | "rejected"; leave: Leave } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [allowOver, setAllowOver] = useState(false);
  const [cancelling, setCancelling] = useState<Leave | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [printLeave, setPrintLeave] = useState<Leave | null>(null);
  const [editingDates, setEditingDates] = useState<Leave | null>(null);
  const [datesForm, setDatesForm] = useState({ startDate: "", endDate: "", note: "" });

  // balances state
  const [balYear, setBalYear] = useState(currentYear);
  const [balType, setBalType] = useState("annual");
  const [editBal, setEditBal] = useState<Balance | null>(null);
  const [balForm, setBalForm] = useState({ entitledDays: "21", carriedOverDays: "0", adjustmentDays: "0", note: "" });

  // calendar state
  const [calMonth, setCalMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const printRef = useRef<HTMLDivElement>(null);
  const { uploadFile, isUploading } = useUpload({ folder: "leaves" });

  const { data: leaves = [], isLoading } = useQuery<Leave[]>({
    queryKey: ["/api/hr/leaves", filterStatus, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterType !== "all") params.set("type", filterType);
      const res = await apiRequest("GET", `/api/hr/leaves?${params}`);
      return res.json();
    },
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/hr/leaves/stats"],
    queryFn: async () => (await apiRequest("GET", "/api/hr/leaves/stats")).json(),
  });

  const { data: employees = [] } = useQuery<Emp[]>({
    queryKey: ["/api/branch-employees"],
    queryFn: async () => (await apiRequest("GET", "/api/branch-employees")).json(),
  });

  const { data: balances = [], isLoading: balLoading } = useQuery<Balance[]>({
    queryKey: ["/api/hr/leave-balances", balYear, balType],
    queryFn: async () =>
      (await apiRequest("GET", `/api/hr/leave-balances?year=${balYear}&type=${balType}`)).json(),
    enabled: tab === "balances",
  });

  // balance for the employee selected in the create form
  const { data: formBalance } = useQuery<Balance>({
    queryKey: ["/api/hr/leave-balances/emp", form.branchEmployeeId, form.leaveType],
    queryFn: async () =>
      (await apiRequest("GET", `/api/hr/leave-balances/${form.branchEmployeeId}?year=${currentYear}&type=${form.leaveType}`)).json(),
    enabled: open && !!form.branchEmployeeId && form.leaveType !== "unpaid",
  });

  // مسار الاعتماد المطبّق على فرع الموظف المختار (لعرضه داخل النموذج)
  const { data: applicableChainResp } = useQuery<{ chain: any[] }>({
    queryKey: ["/api/hr/leaves/applicable-chain", form.branchId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/hr/leaves/applicable-chain?branchId=${encodeURIComponent(form.branchId)}`)).json(),
    enabled: open && !!form.branchId,
  });
  const applicableChain = applicableChainResp?.chain ?? [];

  // ===== العطلات الرسمية =====
  const [holOpen, setHolOpen] = useState(false);
  const [holForm, setHolForm] = useState({ name: "", startDate: "", endDate: "", note: "" });
  const { data: holidays = [] } = useQuery<any[]>({
    queryKey: ["/api/hr/public-holidays"],
    queryFn: async () => (await apiRequest("GET", "/api/hr/public-holidays")).json(),
    enabled: tab === "holidays" || tab === "calendar",
  });
  const createHolidayMutation = useMutation({
    mutationFn: async (body: any) => (await apiRequest("POST", "/api/hr/public-holidays", body)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/public-holidays"] });
      setHolOpen(false);
      setHolForm({ name: "", startDate: "", endDate: "", note: "" });
      toast({ title: "تمت إضافة العطلة الرسمية" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const toggleHolidayMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) =>
      (await apiRequest("PATCH", `/api/hr/public-holidays/${id}`, { isActive })).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/hr/public-holidays"] }),
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/hr/public-holidays/${id}`)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/public-holidays"] });
      toast({ title: "تم حذف العطلة" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  // تفصيل مراحل الإجازة المرضية (المادة 117) — معاينة في نموذج الإنشاء
  const { data: sickPreview } = useQuery<any>({
    queryKey: ["/api/hr/leaves/sick-tier-preview", form.branchEmployeeId, form.startDate, form.endDate],
    queryFn: async () =>
      (await apiRequest("GET", `/api/hr/leaves/sick-tier-preview?branchEmployeeId=${form.branchEmployeeId}&startDate=${form.startDate}&endDate=${form.endDate}`)).json(),
    enabled: open && form.leaveType === "sick" && !!form.branchEmployeeId && !!form.startDate && !!form.endDate && form.endDate >= form.startDate,
  });

  // ===== كشف حساب إجازات موظف =====
  const [stmtEmpId, setStmtEmpId] = useState<number | null>(null);
  const [stmtYear, setStmtYear] = useState(currentYear);
  const { data: statement, isLoading: stmtLoading } = useQuery<any>({
    queryKey: ["/api/hr/leaves/employee-statement", stmtEmpId, stmtYear],
    queryFn: async () =>
      (await apiRequest("GET", `/api/hr/leaves/employee-statement?branchEmployeeId=${stmtEmpId}&year=${stmtYear}`)).json(),
    enabled: !!stmtEmpId,
  });
  const stmtPrintRef = useRef<HTMLDivElement>(null);
  const printStatement = useReactToPrint({ contentRef: stmtPrintRef });
  // رصيد متحرك لكل نوع: يبدأ من (مستحق+مرحّل+تعديل) ويخصم الحركات المعتمدة تباعاً
  const stmtRows = useMemo(() => {
    if (!statement) return [];
    const running: Record<string, number> = {};
    for (const b of statement.balances || []) {
      running[b.leaveType] = Number(b.entitledDays) + Number(b.carriedOverDays) + Number(b.adjustmentDays);
    }
    return (statement.movements || []).map((m: any) => {
      let after: number | null = null;
      if (m.status === "approved" && m.leaveType !== "unpaid" && running[m.leaveType] !== undefined) {
        running[m.leaveType] -= m.daysInYear;
        after = running[m.leaveType];
      }
      return { ...m, balanceAfter: after };
    });
  }, [statement]);

  // أيام العطلات ضمن الشهر المعروض في التقويم
  const holidayDatesSet = useMemo(() => {
    const set = new Map<string, string>();
    for (const h of holidays) {
      if (h.isActive === false) continue;
      const d = new Date(h.startDate + "T00:00:00Z");
      const end = new Date(h.endDate + "T00:00:00Z");
      let guard = 0;
      while (d.getTime() <= end.getTime() && guard < 60) {
        set.set(d.toISOString().slice(0, 10), h.name);
        d.setUTCDate(d.getUTCDate() + 1);
        guard++;
      }
    }
    return set;
  }, [holidays]);

  const filtered = useMemo(() => {
    if (!search.trim()) return leaves;
    const q = search.toLowerCase();
    return leaves.filter((l: any) => (l.employeeName || "").toLowerCase().includes(q));
  }, [leaves, search]);

  const totalDays = calcDays(form.startDate, form.endDate);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/hr/leaves", payload);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leave-balances"] });
      toast({ title: "تم تسجيل طلب الإجازة" });
      setForm(initialForm);
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الحفظ", variant: "destructive" }),
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, decision, note, allowOverBalance }: any) => {
      const res = await apiRequest("POST", `/api/hr/leaves/${id}/review`, { decision, note, allowOverBalance });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leave-balances"] });
      toast({ title: "تم تحديث الطلب" });
      setReviewing(null);
      setReviewNote("");
      setAllowOver(false);
    },
    onError: (e: any) => {
      const msg: string = e?.message || "";
      let parsed: any = null;
      const jsonStart = msg.indexOf("{");
      if (jsonStart >= 0) {
        try { parsed = JSON.parse(msg.slice(jsonStart)); } catch {}
      }
      if (parsed?.error === "balance_exceeded" || msg.includes("balance_exceeded")) {
        setAllowOver(true);
        toast({ title: "تحذير الرصيد", description: parsed?.message || "الرصيد المتبقي لا يكفي لهذه الإجازة", variant: "destructive" });
      } else {
        toast({ title: "خطأ", description: msg || "فشل", variant: "destructive" });
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: any) => {
      const res = await apiRequest("POST", `/api/hr/leaves/${id}/cancel`, { reason });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leave-balances"] });
      toast({ title: "تم إلغاء الإجازة" });
      setCancelling(null);
      setCancelReason("");
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الإلغاء", variant: "destructive" }),
  });

  const editDatesMutation = useMutation({
    mutationFn: async ({ id, startDate, endDate, note }: any) => {
      const res = await apiRequest("PATCH", `/api/hr/leaves/${id}/dates`, { startDate, endDate, note });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leave-balances"] });
      toast({ title: "تم تعديل التواريخ وإشعار الموظف" });
      setEditingDates(null);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل التعديل", variant: "destructive" }),
  });

  const applyChainsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/hr/leaves/apply-chains", {});
      return res.json();
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves"] });
      const parts: string[] = [`تم تفعيل المستويات على ${r?.updated ?? 0} طلب`];
      if (r?.skippedNoChain) parts.push(`${r.skippedNoChain} طلب بلا سلسلة لفرعه`);
      if (r?.skippedInFlight) parts.push(`${r.skippedInFlight} طلب جارٍ اعتماده (لم يُمَس)`);
      toast({ title: "اكتمل التفعيل", description: parts.join(" • ") });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل التفعيل", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/hr/leaves/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves/stats"] });
      toast({ title: "تم الحذف" });
    },
  });

  const carryoverMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/hr/leave-balances/carryover", {
        fromYear: balYear - 1,
        leaveType: balType,
      });
      return res.json();
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leave-balances"] });
      const parts: string[] = [`تم ترحيل رصيد ${arNum(r?.carried ?? 0)} موظف من ${arNum(r?.fromYear)} إلى ${arNum(r?.toYear)}`];
      if (r?.unchanged) parts.push(`${arNum(r.unchanged)} بدون تغيير (مرحّل مسبقاً)`);
      if (r?.skippedZero) parts.push(`${arNum(r.skippedZero)} بلا رصيد متبقٍ`);
      toast({ title: "اكتمل الترحيل", description: parts.join(" • ") });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الترحيل", variant: "destructive" }),
  });

  const saveBalMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/hr/leave-balances", payload);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leave-balances"] });
      toast({ title: "تم حفظ الرصيد" });
      setEditBal(null);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل", variant: "destructive" }),
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "نموذج إجازة",
    pageStyle: `@page { size: A4; margin: 16mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`,
  });

  const submit = () => {
    if (!form.branchEmployeeId || !form.startDate || !form.endDate) {
      toast({ title: "بيانات ناقصة", variant: "destructive" });
      return;
    }
    const emp = employees.find((e) => e.id === parseInt(form.branchEmployeeId, 10));
    if (!emp) return;
    saveMutation.mutate({
      branchEmployeeId: parseInt(form.branchEmployeeId, 10),
      branchId: emp.branchId,
      leaveType: form.leaveType,
      startDate: form.startDate,
      endDate: form.endDate,
      totalDays,
      reason: form.reason,
      attachmentUrl: form.attachmentUrl || undefined,
      requiredLevels: parseInt(form.requiredLevels, 10) || 1,
    });
  };

  const onUpload = async (file: File | undefined, target: "form") => {
    if (!file) return;
    const res = await uploadFile(file);
    if (res?.downloadUrl) {
      if (target === "form") setForm((f) => ({ ...f, attachmentUrl: res.downloadUrl }));
      toast({ title: "تم رفع المرفق" });
    }
  };

  const openEditBal = (b: Balance) => {
    setEditBal(b);
    setBalForm({
      entitledDays: String(b.entitledDays ?? b.suggestedEntitlement ?? 21),
      carriedOverDays: String(b.carriedOverDays ?? 0),
      adjustmentDays: String(b.adjustmentDays ?? 0),
      note: b.note ?? "",
    });
  };

  const submitBal = () => {
    if (!editBal) return;
    saveBalMutation.mutate({
      branchEmployeeId: editBal.branchEmployeeId,
      year: balYear,
      leaveType: balType,
      entitledDays: parseFloat(balForm.entitledDays) || 0,
      carriedOverDays: parseFloat(balForm.carriedOverDays) || 0,
      adjustmentDays: parseFloat(balForm.adjustmentDays) || 0,
      note: balForm.note || undefined,
    });
  };

  const exportLeavesExcel = () => {
    const rows = filtered.map((l: any) => ({
      "الموظف": l.employeeName || "",
      "الوظيفة": l.employeeJob || "",
      "الفرع": l.branchName || "",
      "النوع": LEAVE_TYPE_LABELS[l.leaveType] || l.leaveType,
      "من": l.startDate,
      "إلى": l.endDate,
      "الأيام": Number(l.totalDays),
      "أيام العمل": l.workingDays != null ? Number(l.workingDays) : "",
      "الحالة": LEAVE_STATUS_LABELS[l.status] || l.status,
      "المراجع": l.reviewerName || "",
      "السبب": l.reason || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الإجازات");
    XLSX.writeFile(wb, `leaves_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportBalancesExcel = () => {
    const rows = balances.map((b: any) => ({
      "الموظف": b.employeeName || "",
      "الوظيفة": b.jobTitle || "",
      "الفرع": b.branchName || "",
      "السنة": b.year,
      "المستحق": Number(b.entitledDays),
      "المرحّل": Number(b.carriedOverDays),
      "تعديل": Number(b.adjustmentDays),
      "المستخدم": Number(b.usedDays),
      "المتبقي": Number(b.remainingDays),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الأرصدة");
    XLSX.writeFile(wb, `leave_balances_${balYear}.xlsx`);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-amber-100 text-amber-700",
      approved: "bg-emerald-100 text-emerald-700",
      rejected: "bg-red-100 text-red-700",
      cancelled: "bg-slate-100 text-slate-600",
    };
    return <Badge className={map[s] || ""}>{LEAVE_STATUS_LABELS[s] || s}</Badge>;
  };

  // Calendar data: approved leaves overlapping the selected month
  const calDays = useMemo(() => {
    const [y, m] = calMonth.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const startWeekday = first.getUTCDay(); // 0=Sun
    const cells: { date: string | null; leaves: Leave[] }[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null, leaves: [] });
    const approved = leaves.filter((l: any) => l.status === "approved");
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calMonth}-${String(d).padStart(2, "0")}`;
      const dayLeaves = approved.filter((l: any) => l.startDate <= dateStr && l.endDate >= dateStr);
      cells.push({ date: dateStr, leaves: dayLeaves });
    }
    return cells;
  }, [leaves, calMonth]);

  const printEmp = printLeave ? employees.find((e) => e.id === printLeave.branchEmployeeId) : null;

  return (
    <Layout>
    <div className="container mx-auto p-4 space-y-4" dir="rtl" data-testid="page-hr-leaves">
      <Link href="/hr-hub">
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" data-testid="button-back-hr-hub">
          <ArrowRight className="h-4 w-4 ms-1" />العودة لمركز الموارد البشرية
        </Button>
      </Link>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">طلبات الإجازات</h1>
            <p className="text-sm text-muted-foreground">إدارة الطلبات والأرصدة والموافقات والتقويم</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="button-add-leave">
          <Plus className="h-4 w-4 ms-2" />طلب إجازة جديد
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="إجمالي الطلبات" value={stats?.total ?? 0} icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label="قيد المراجعة" value={stats?.pending ?? 0} icon={<Clock className="h-5 w-5" />} accent="amber" />
        <StatCard label="معتمدة" value={stats?.approved ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} accent="emerald" />
        <StatCard label="مرفوضة" value={stats?.rejected ?? 0} icon={<XCircle className="h-5 w-5" />} accent="red" />
        <StatCard label="في إجازة اليوم" value={stats?.onLeaveToday ?? 0} icon={<CalendarDays className="h-5 w-5" />} accent="blue" />
      </div>

      {/* حركة الإجازات: من في إجازة الآن، من سيغادر، من سيعود */}
      {((stats?.onLeaveNow?.length ?? 0) > 0 || (stats?.departingSoon?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="border-blue-200 bg-blue-50/40">
            <CardContent className="pt-4 space-y-2">
              <div className="text-sm font-bold text-blue-800 flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />في إجازة الآن ({arNum(stats?.onLeaveNow?.length ?? 0)})
              </div>
              {(stats?.onLeaveNow ?? []).length === 0 && <div className="text-xs text-muted-foreground">لا يوجد</div>}
              {(stats?.onLeaveNow ?? []).slice(0, 6).map((m: any) => (
                <div key={m.id} className="text-xs flex items-center justify-between gap-2 bg-white rounded p-1.5 border border-blue-100" data-testid={`movement-onleave-${m.id}`}>
                  <div>
                    <span className="font-medium">{m.employeeName}</span>
                    <span className="text-muted-foreground me-1"> — {LEAVE_TYPE_LABELS[m.leaveType] || m.leaveType}</span>
                  </div>
                  <span className="text-blue-700 whitespace-nowrap">يعود {fmtDate(m.returnDate)}</span>
                </div>
              ))}
              {(stats?.onLeaveNow?.length ?? 0) > 6 && <div className="text-[10px] text-muted-foreground">+{arNum(stats.onLeaveNow.length - 6)} آخرين</div>}
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/40">
            <CardContent className="pt-4 space-y-2">
              <div className="text-sm font-bold text-amber-800 flex items-center gap-1">
                <Clock className="h-4 w-4" />سيغادرون خلال ٧ أيام ({arNum(stats?.departingSoon?.length ?? 0)})
              </div>
              {(stats?.departingSoon ?? []).length === 0 && <div className="text-xs text-muted-foreground">لا يوجد</div>}
              {(stats?.departingSoon ?? []).slice(0, 6).map((m: any) => (
                <div key={m.id} className="text-xs flex items-center justify-between gap-2 bg-white rounded p-1.5 border border-amber-100" data-testid={`movement-departing-${m.id}`}>
                  <div>
                    <span className="font-medium">{m.employeeName}</span>
                    <span className="text-muted-foreground me-1"> — {LEAVE_TYPE_LABELS[m.leaveType] || m.leaveType}</span>
                  </div>
                  <span className="text-amber-700 whitespace-nowrap">يغادر {fmtDate(m.startDate)}</span>
                </div>
              ))}
              {(stats?.departingSoon?.length ?? 0) > 6 && <div className="text-[10px] text-muted-foreground">+{arNum(stats.departingSoon.length - 6)} آخرين</div>}
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50/40">
            <CardContent className="pt-4 space-y-2">
              <div className="text-sm font-bold text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />سيعودون خلال ٧ أيام ({arNum(stats?.returningSoon?.length ?? 0)})
              </div>
              {(stats?.returningSoon ?? []).length === 0 && <div className="text-xs text-muted-foreground">لا يوجد</div>}
              {(stats?.returningSoon ?? []).slice(0, 6).map((m: any) => (
                <div key={m.id} className="text-xs flex items-center justify-between gap-2 bg-white rounded p-1.5 border border-emerald-100" data-testid={`movement-returning-${m.id}`}>
                  <div>
                    <span className="font-medium">{m.employeeName}</span>
                    <span className="text-muted-foreground me-1"> — {LEAVE_TYPE_LABELS[m.leaveType] || m.leaveType}</span>
                  </div>
                  <span className="text-emerald-700 whitespace-nowrap">يعود {fmtDate(m.returnDate)}</span>
                </div>
              ))}
              {(stats?.returningSoon?.length ?? 0) > 6 && <div className="text-[10px] text-muted-foreground">+{arNum(stats.returningSoon.length - 6)} آخرين</div>}
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList data-testid="tabs-leaves">
          <TabsTrigger value="requests" data-testid="tab-requests"><CalendarDays className="h-4 w-4 ms-1" />الطلبات</TabsTrigger>
          <TabsTrigger value="balances" data-testid="tab-balances"><Wallet className="h-4 w-4 ms-1" />الأرصدة</TabsTrigger>
          <TabsTrigger value="calendar" data-testid="tab-calendar"><CalendarDays className="h-4 w-4 ms-1" />التقويم</TabsTrigger>
          <TabsTrigger value="holidays" data-testid="tab-holidays"><Sun className="h-4 w-4 ms-1" />العطلات الرسمية</TabsTrigger>
        </TabsList>

        {/* ---------- REQUESTS TAB ---------- */}
        <TabsContent value="requests">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Input placeholder="بحث باسم الموظف" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-leaves" />
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger data-testid="select-filter-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الحالات</SelectItem>
                    {Object.entries(LEAVE_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger data-testid="select-filter-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأنواع</SelectItem>
                    {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={exportLeavesExcel} data-testid="button-export-leaves">
                  <FileSpreadsheet className="h-4 w-4 ms-1" />تصدير Excel
                </Button>
                <Button
                  variant="outline"
                  disabled={applyChainsMutation.isPending}
                  onClick={() => {
                    if (window.confirm("سيتم تطبيق سلسلة الموافقات الحالية على الطلبات المعلّقة التي أُنشئت قبل إعداد المستويات. الطلبات التي بدأ اعتمادها فعلياً لن تتأثر. متابعة؟")) {
                      applyChainsMutation.mutate();
                    }
                  }}
                  data-testid="button-apply-chains"
                >
                  <ListChecks className="h-4 w-4 ms-1" />
                  {applyChainsMutation.isPending ? "جارٍ التفعيل..." : "تفعيل المستويات على الطلبات الحالية"}
                </Button>
              </div>

              <div className="overflow-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-right p-2">الموظف</th>
                      <th className="text-right p-2">النوع</th>
                      <th className="text-right p-2">من - إلى</th>
                      <th className="text-right p-2">أيام</th>
                      <th className="text-right p-2">الحالة</th>
                      <th className="text-right p-2">المراجع</th>
                      <th className="text-right p-2">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">جاري التحميل...</td></tr>}
                    {!isLoading && filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا توجد طلبات</td></tr>}
                    {filtered.map((l: any) => (
                      <tr key={l.id} className="border-t hover:bg-slate-50" data-testid={`row-leave-${l.id}`}>
                        <td className="p-2">
                          <div className="font-medium flex items-center gap-1">
                            {l.employeeName || "-"}
                            {l.attachmentUrl && <a href={l.attachmentUrl} target="_blank" rel="noreferrer" title="مرفق"><Paperclip className="h-3 w-3 text-blue-500" /></a>}
                          </div>
                          <div className="text-xs text-muted-foreground">{l.employeeJob || ""}</div>
                        </td>
                        <td className="p-2">{LEAVE_TYPE_LABELS[l.leaveType] || l.leaveType}</td>
                        <td className="p-2 text-xs">
                          {l.startDate} → {l.endDate}
                          {l.status === "approved" && (
                            <span className="block text-[10px] text-emerald-600" data-testid={`text-return-date-${l.id}`}>
                              العودة للعمل: {fmtDate((() => { const d = new Date(l.endDate + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })())}
                            </span>
                          )}
                        </td>
                        <td className="p-2 tabular-nums">
                          {arNum(l.totalDays)}
                          {l.requiredLevels > 1 && l.status === "pending" && (
                            <span className="block text-[10px] text-amber-600">موافقة {arNum(l.currentLevel)}/{arNum(l.requiredLevels)}</span>
                          )}
                          {l.leaveType === "sick" && l.sickTierBreakdown && (
                            <span className="block text-[10px] text-purple-700" data-testid={`text-sick-tiers-${l.id}`}
                              title={`مادة 117 — مستخدم سابقاً: ${l.sickTierBreakdown.usedBefore} يوم`}>
                              كامل {arNum(l.sickTierBreakdown.fullPayDays)} · ¾ {arNum(l.sickTierBreakdown.threeQuarterPayDays)} · بدون {arNum(l.sickTierBreakdown.unpaidDays)}
                            </span>
                          )}
                        </td>
                        <td className="p-2">{statusBadge(l.status)}</td>
                        <td className="p-2 text-xs">
                          {l.status === "pending"
                            ? (() => {
                                const step = Array.isArray(l.approvalChain)
                                  ? l.approvalChain.find((c: any) => Number(c.level) === Number(l.currentLevel))
                                  : null;
                                return step
                                  ? <span className="text-amber-700" data-testid={`text-pending-approver-${l.id}`}>بانتظار: {step.stepName || step.jobTitle}</span>
                                  : (l.reviewerName || "-");
                              })()
                            : (l.reviewerName || "-")}
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1 flex-wrap">
                            {l.status === "pending" && (
                              <>
                                <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => { setAllowOver(false); setReviewing({ id: l.id, decision: "approved", leave: l }); }} data-testid={`button-approve-${l.id}`}>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setReviewing({ id: l.id, decision: "rejected", leave: l })} data-testid={`button-reject-${l.id}`}>
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            {(l.status === "approved" || l.status === "pending") && (
                              <Button size="sm" variant="ghost" className="text-blue-600" title="تعديل التواريخ" onClick={() => { setDatesForm({ startDate: l.startDate, endDate: l.endDate, note: "" }); setEditingDates(l); }} data-testid={`button-edit-dates-${l.id}`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {(l.status === "approved" || l.status === "pending") && (
                              <Button size="sm" variant="ghost" className="text-orange-600" title="إلغاء/سحب" onClick={() => { setCancelReason(""); setCancelling(l); }} data-testid={`button-cancel-${l.id}`}>
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" title="طباعة نموذج" onClick={() => setPrintLeave(l)} data-testid={`button-print-${l.id}`}>
                              <Printer className="h-3.5 w-3.5 text-slate-600" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { if (confirm("حذف هذا الطلب؟")) deleteMutation.mutate(l.id); }} data-testid={`button-delete-${l.id}`}>
                              <Trash2 className="h-3.5 w-3.5 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- BALANCES TAB ---------- */}
        <TabsContent value="balances">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={String(balYear)} onValueChange={(v) => setBalYear(parseInt(v, 10))}>
                  <SelectTrigger className="w-32" data-testid="select-bal-year"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={balType} onValueChange={setBalType}>
                  <SelectTrigger className="w-40" data-testid="select-bal-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEAVE_TYPE_LABELS).filter(([k]) => k !== "unpaid").map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={exportBalancesExcel} data-testid="button-export-balances">
                  <FileSpreadsheet className="h-4 w-4 ms-1" />تصدير Excel
                </Button>
                <Button
                  variant="outline"
                  className="text-purple-700 border-purple-300"
                  disabled={carryoverMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`سيتم ترحيل الرصيد المتبقي لكل موظف من سنة ${balYear - 1} إلى خانة "المرحّل" في سنة ${balYear} (${LEAVE_TYPE_LABELS[balType] || balType}). إعادة التشغيل آمنة ولا تضاعف الأرصدة. متابعة؟`)) {
                      carryoverMutation.mutate();
                    }
                  }}
                  data-testid="button-carryover-balances"
                >
                  <Wallet className="h-4 w-4 ms-1" />
                  {carryoverMutation.isPending ? "جارٍ الترحيل..." : `ترحيل أرصدة ${balYear - 1} ←`}
                </Button>
              </div>
              <div className="overflow-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-right p-2">الموظف</th>
                      <th className="text-right p-2">الفرع</th>
                      <th className="text-right p-2">المستحق</th>
                      <th className="text-right p-2">المرحّل</th>
                      <th className="text-right p-2">تعديل</th>
                      <th className="text-right p-2">المستخدم</th>
                      <th className="text-right p-2">المتبقي</th>
                      <th className="text-right p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {balLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">جاري التحميل...</td></tr>}
                    {!balLoading && balances.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">لا يوجد موظفون</td></tr>}
                    {balances.map((b: any) => (
                      <tr key={b.branchEmployeeId} className="border-t hover:bg-slate-50" data-testid={`row-balance-${b.branchEmployeeId}`}>
                        <td className="p-2">
                          <div className="font-medium">{b.employeeName}</div>
                          <div className="text-xs text-muted-foreground">
                            {b.jobTitle}
                            {serviceYears(b.hireDate) != null && (
                              <span className="text-[10px] text-slate-400 me-1"> • خدمة {arNum(serviceYears(b.hireDate))} سنة</span>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-xs">{b.branchName}</td>
                        <td className="p-2 tabular-nums">{arNum(b.entitledDays)}{!b.hasRow && <span className="text-[10px] text-amber-500 me-1">مقترح</span>}</td>
                        <td className="p-2 tabular-nums">{arNum(b.carriedOverDays)}</td>
                        <td className="p-2 tabular-nums">{arNum(b.adjustmentDays)}</td>
                        <td className="p-2 tabular-nums">{arNum(b.usedDays)}</td>
                        <td className={`p-2 tabular-nums font-bold ${b.remainingDays < 0 ? "text-red-600" : "text-emerald-600"}`} data-testid={`text-remaining-${b.branchEmployeeId}`}>{arNum(b.remainingDays)}</td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEditBal(b)} data-testid={`button-edit-balance-${b.branchEmployeeId}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-blue-600" title="كشف حساب الإجازات"
                              onClick={() => { setStmtYear(balYear); setStmtEmpId(b.branchEmployeeId); }}
                              data-testid={`button-statement-${b.branchEmployeeId}`}>
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- CALENDAR TAB ---------- */}
        <TabsContent value="calendar">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => {
                  const [y, m] = calMonth.split("-").map(Number);
                  const d = new Date(Date.UTC(y, m - 2, 1));
                  setCalMonth(d.toISOString().slice(0, 7));
                }} data-testid="button-cal-prev"><ChevronRight className="h-4 w-4" /></Button>
                <div className="font-bold" data-testid="text-cal-month">{calMonth}</div>
                <Button variant="outline" size="sm" onClick={() => {
                  const [y, m] = calMonth.split("-").map(Number);
                  const d = new Date(Date.UTC(y, m, 1));
                  setCalMonth(d.toISOString().slice(0, 7));
                }} data-testid="button-cal-next"><ChevronLeft className="h-4 w-4" /></Button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"].map((d) => (
                  <div key={d} className="font-bold text-muted-foreground p-1">{d}</div>
                ))}
                {calDays.map((c, i) => (
                  <div key={i} className={`min-h-[64px] border rounded p-1 text-right ${c.date ? (holidayDatesSet.has(c.date) ? "bg-amber-50 border-amber-300" : "bg-white") : "bg-slate-50"}`} data-testid={c.date ? `cal-day-${c.date}` : undefined}>
                    {c.date && <div className="text-[10px] text-muted-foreground">{Number(c.date.slice(-2))}</div>}
                    {c.date && holidayDatesSet.has(c.date) && (
                      <div className="text-[9px] bg-amber-200 text-amber-900 rounded px-1 truncate" title={holidayDatesSet.get(c.date)}>
                        {holidayDatesSet.get(c.date)}
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {c.leaves.slice(0, 3).map((l: any) => (
                        <div key={l.id} className="text-[9px] bg-emerald-100 text-emerald-800 rounded px-1 truncate" title={`${l.employeeName} - ${LEAVE_TYPE_LABELS[l.leaveType] || l.leaveType}`}>
                          {l.employeeName}
                        </div>
                      ))}
                      {c.leaves.length > 3 && <div className="text-[9px] text-muted-foreground">+{arNum(c.leaves.length - 3)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- HOLIDAYS TAB ---------- */}
        <TabsContent value="holidays">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs text-muted-foreground">
                  أيام العطلات الرسمية المفعّلة تُستثنى تلقائياً من "أيام العمل" عند حساب أي إجازة جديدة.
                </div>
                <Button size="sm" onClick={() => setHolOpen(true)} data-testid="button-add-holiday">
                  <Plus className="h-4 w-4 ms-1" />إضافة عطلة
                </Button>
              </div>
              <div className="overflow-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-right p-2">العطلة</th>
                      <th className="text-right p-2">من - إلى</th>
                      <th className="text-right p-2">الأيام</th>
                      <th className="text-right p-2">الحالة</th>
                      <th className="text-right p-2">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">لا توجد عطلات مسجلة — أضف عطلات مثل عيد الفطر وعيد الأضحى واليوم الوطني</td></tr>
                    )}
                    {holidays.map((h: any) => (
                      <tr key={h.id} className="border-t hover:bg-slate-50" data-testid={`row-holiday-${h.id}`}>
                        <td className="p-2">
                          <div className="font-medium">{h.name}</div>
                          {h.note && <div className="text-xs text-muted-foreground">{h.note}</div>}
                        </td>
                        <td className="p-2 text-xs">{h.startDate} → {h.endDate}</td>
                        <td className="p-2 tabular-nums">{arNum(calcDays(h.startDate, h.endDate))}</td>
                        <td className="p-2">
                          {h.isActive
                            ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">مفعّلة</Badge>
                            : <Badge variant="secondary">موقوفة</Badge>}
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" title={h.isActive ? "إيقاف" : "تفعيل"}
                              onClick={() => toggleHolidayMutation.mutate({ id: h.id, isActive: !h.isActive })}
                              data-testid={`button-toggle-holiday-${h.id}`}>
                              {h.isActive ? <Ban className="h-3.5 w-3.5 text-orange-600" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                            </Button>
                            <Button size="sm" variant="ghost"
                              onClick={() => { if (confirm(`حذف عطلة "${h.name}"؟`)) deleteHolidayMutation.mutate(h.id); }}
                              data-testid={`button-delete-holiday-${h.id}`}>
                              <Trash2 className="h-3.5 w-3.5 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add holiday dialog */}
      <Dialog open={holOpen} onOpenChange={setHolOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>إضافة عطلة رسمية</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>اسم العطلة</Label>
              <Input value={holForm.name} onChange={(e) => setHolForm({ ...holForm, name: e.target.value })} placeholder="مثال: عيد الفطر المبارك" data-testid="input-holiday-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>من تاريخ</Label>
                <Input type="date" value={holForm.startDate} onChange={(e) => setHolForm({ ...holForm, startDate: e.target.value, endDate: holForm.endDate || e.target.value })} data-testid="input-holiday-start" />
              </div>
              <div>
                <Label>إلى تاريخ</Label>
                <Input type="date" value={holForm.endDate} onChange={(e) => setHolForm({ ...holForm, endDate: e.target.value })} data-testid="input-holiday-end" />
              </div>
            </div>
            {holForm.startDate && holForm.endDate && (
              <div className="text-sm text-muted-foreground">عدد الأيام: <span className="font-bold tabular-nums">{arNum(calcDays(holForm.startDate, holForm.endDate))}</span></div>
            )}
            <div>
              <Label>ملاحظة (اختياري)</Label>
              <Input value={holForm.note} onChange={(e) => setHolForm({ ...holForm, note: e.target.value })} data-testid="input-holiday-note" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHolOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => createHolidayMutation.mutate({ name: holForm.name.trim(), startDate: holForm.startDate, endDate: holForm.endDate, note: holForm.note.trim() || undefined })}
              disabled={createHolidayMutation.isPending || !holForm.name.trim() || !holForm.startDate || !holForm.endDate || holForm.endDate < holForm.startDate}
              data-testid="button-save-holiday"
            >
              {createHolidayMutation.isPending ? "جاري الحفظ..." : "حفظ العطلة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) { setForm(initialForm); setOpen(false); } else setOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto" dir="rtl">
          <DialogHeader><DialogTitle>طلب إجازة جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الموظف</Label>
              <Select value={form.branchEmployeeId} onValueChange={(v) => {
                const emp = employees.find((e) => e.id === parseInt(v, 10));
                setForm({ ...form, branchEmployeeId: v, branchId: emp?.branchId || "" });
              }}>
                <SelectTrigger data-testid="select-employee"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.employeeName} — {e.jobTitle}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.leaveType === "unpaid" ? (
              <div className="text-xs bg-amber-50 text-amber-700 rounded p-2" data-testid="text-form-unpaid-note">
                إجازة بدون راتب — لا تُحتسب من رصيد الإجازات.
              </div>
            ) : formBalance && form.branchEmployeeId ? (
              <div className="text-xs bg-blue-50 rounded p-2 space-y-1" data-testid="text-form-balance">
                <div className="flex justify-between">
                  <span>الرصيد المتبقي ({LEAVE_TYPE_LABELS[form.leaveType]}):</span>
                  <span className={`font-bold ${formBalance.remainingDays < 0 ? "text-red-600" : "text-emerald-700"}`}>
                    {arNum(formBalance.remainingDays)} يوم
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  مستحق {arNum(formBalance.entitledDays)} + مرحّل {arNum(formBalance.carriedOverDays)} + تعديل {arNum(formBalance.adjustmentDays)} − مستخدم {arNum(formBalance.usedDays)}
                </div>
                {totalDays > 0 && totalDays > Number(formBalance.remainingDays) && (
                  <div className="text-red-600 font-bold bg-red-50 rounded p-1.5" data-testid="text-form-balance-warning">
                    ⚠ الأيام المطلوبة ({arNum(totalDays)}) تتجاوز الرصيد المتبقي ({arNum(formBalance.remainingDays)}) — سيتطلب الاعتماد سماحاً بتجاوز الرصيد.
                  </div>
                )}
              </div>
            ) : null}
            {form.leaveType === "sick" && sickPreview && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs space-y-1.5" data-testid="box-sick-tiers">
                <div className="font-semibold text-purple-800">توزيع الأجر حسب نظام العمل (المادة 117)</div>
                <div className="text-[10px] text-purple-600">
                  المرضية المستخدمة سابقاً في {sickPreview.year}: {arNum(sickPreview.usedBefore)} يوم
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded bg-white border border-emerald-200 p-1.5">
                    <div className="font-bold text-emerald-700 tabular-nums" data-testid="text-sick-full">{arNum(sickPreview.fullPayDays)}</div>
                    <div className="text-[10px] text-muted-foreground">أجر كامل</div>
                  </div>
                  <div className="rounded bg-white border border-amber-200 p-1.5">
                    <div className="font-bold text-amber-700 tabular-nums" data-testid="text-sick-three-quarter">{arNum(sickPreview.threeQuarterPayDays)}</div>
                    <div className="text-[10px] text-muted-foreground">¾ الأجر</div>
                  </div>
                  <div className="rounded bg-white border border-red-200 p-1.5">
                    <div className="font-bold text-red-700 tabular-nums" data-testid="text-sick-unpaid">{arNum(sickPreview.unpaidDays)}</div>
                    <div className="text-[10px] text-muted-foreground">بدون أجر</div>
                  </div>
                </div>
                {sickPreview.unpaidDays > 0 && (
                  <div className="text-red-600 bg-red-50 rounded p-1.5">
                    ⚠ جزء من هذه الإجازة سيكون بدون أجر لتجاوز 90 يوماً مرضياً خلال السنة.
                  </div>
                )}
              </div>
            )}
            <div>
              <Label>نوع الإجازة</Label>
              <Select value={form.leaveType} onValueChange={(v) => setForm({ ...form, leaveType: v })}>
                <SelectTrigger data-testid="select-leave-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>من تاريخ</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} data-testid="input-start-date" />
              </div>
              <div>
                <Label>إلى تاريخ</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} data-testid="input-end-date" />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">إجمالي الأيام: <span className="font-bold tabular-nums">{arNum(totalDays)}</span></div>
            {applicableChain.length > 0 ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3" data-testid="box-approval-path">
                <div className="text-xs font-semibold text-blue-800 mb-1.5">مسار الاعتماد لهذا الطلب</div>
                <div className="flex items-center gap-1 flex-wrap text-xs">
                  {applicableChain.map((step: any, i: number) => (
                    <span key={step.level} className="flex items-center gap-1">
                      <span className="rounded-full bg-white border border-blue-300 px-2 py-0.5 text-blue-700" data-testid={`chip-approval-step-${step.level}`}>
                        {arNum(step.level)}. {step.stepName || step.jobTitle}
                      </span>
                      {i < applicableChain.length - 1 && <ChevronLeft className="h-3.5 w-3.5 text-blue-400" />}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <Label>مستويات الموافقة المطلوبة</Label>
                <Select value={form.requiredLevels} onValueChange={(v) => setForm({ ...form, requiredLevels: v })}>
                  <SelectTrigger data-testid="select-required-levels"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">مستوى واحد (موافقة مباشرة)</SelectItem>
                    <SelectItem value="2">مستويان</SelectItem>
                    <SelectItem value="3">ثلاثة مستويات</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">لا توجد سلسلة اعتماد محددة لهذا الفرع — يمكنك ضبطها من إعدادات الموافقات.</p>
              </div>
            )}
            <div>
              <Label>المرفق (اختياري)</Label>
              <div className="flex items-center gap-2">
                <Input type="file" onChange={(e) => onUpload(e.target.files?.[0], "form")} disabled={isUploading} data-testid="input-attachment" />
                {form.attachmentUrl && <a href={form.attachmentUrl} target="_blank" rel="noreferrer" className="text-blue-600 text-xs whitespace-nowrap">عرض</a>}
              </div>
              {isUploading && <div className="text-xs text-muted-foreground mt-1">جاري الرفع...</div>}
            </div>
            <div>
              <Label>السبب / ملاحظات</Label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} data-testid="textarea-reason" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setForm(initialForm); setOpen(false); }}>إلغاء</Button>
            <Button onClick={submit} disabled={saveMutation.isPending} data-testid="button-save-leave">
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ الطلب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dates dialog */}
      <Dialog open={!!editingDates} onOpenChange={(o) => { if (!o) setEditingDates(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>تعديل تواريخ الإجازة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-xs bg-blue-50 text-blue-700 rounded p-2">
              {editingDates?.employeeName} — يبقى الاعتماد كما هو، وسيتم إشعار الموظف بالتعديل.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>من تاريخ</Label>
                <Input type="date" value={datesForm.startDate} onChange={(e) => setDatesForm({ ...datesForm, startDate: e.target.value })} data-testid="input-edit-start-date" />
              </div>
              <div>
                <Label>إلى تاريخ</Label>
                <Input type="date" value={datesForm.endDate} onChange={(e) => setDatesForm({ ...datesForm, endDate: e.target.value })} data-testid="input-edit-end-date" />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">إجمالي الأيام: <span className="font-bold tabular-nums">{arNum(calcDays(datesForm.startDate, datesForm.endDate))}</span></div>
            <div>
              <Label>سبب التعديل (اختياري — يظهر للموظف)</Label>
              <Textarea value={datesForm.note} onChange={(e) => setDatesForm({ ...datesForm, note: e.target.value })} data-testid="textarea-edit-dates-note" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDates(null)}>إلغاء</Button>
            <Button
              onClick={() => editingDates && editDatesMutation.mutate({ id: editingDates.id, startDate: datesForm.startDate, endDate: datesForm.endDate, note: datesForm.note })}
              disabled={editDatesMutation.isPending || !datesForm.startDate || !datesForm.endDate}
              data-testid="button-confirm-edit-dates"
            >
              {editDatesMutation.isPending ? "جاري الحفظ..." : "حفظ التواريخ وإشعار الموظف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review dialog */}
      <Dialog open={!!reviewing} onOpenChange={(o) => { if (!o) { setReviewing(null); setReviewNote(""); setAllowOver(false); } }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{reviewing?.decision === "approved" ? "اعتماد طلب الإجازة" : "رفض طلب الإجازة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {reviewing?.leave?.requiredLevels > 1 && (
              <div className="text-xs bg-amber-50 text-amber-700 rounded p-2">
                هذا الطلب يتطلب {arNum(reviewing.leave.requiredLevels)} مستويات موافقة — أنت على المستوى {arNum(reviewing.leave.currentLevel)}.
              </div>
            )}
            {allowOver && (
              <div className="text-xs bg-red-50 text-red-700 rounded p-2" data-testid="text-balance-warning">
                تنبيه: الرصيد لا يكفي. فعّل التجاوز للاعتماد رغم ذلك.
              </div>
            )}
            <Label>ملاحظة المراجع (اختياري)</Label>
            <Textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} data-testid="textarea-review-note" />
            {allowOver && reviewing?.decision === "approved" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={allowOver} onChange={(e) => setAllowOver(e.target.checked)} data-testid="checkbox-allow-over" />
                تجاوز تحذير الرصيد والاعتماد
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReviewing(null); setReviewNote(""); setAllowOver(false); }}>إلغاء</Button>
            <Button
              variant={reviewing?.decision === "approved" ? "default" : "destructive"}
              onClick={() => reviewing && reviewMutation.mutate({ id: reviewing.id, decision: reviewing.decision, note: reviewNote, allowOverBalance: allowOver })}
              disabled={reviewMutation.isPending}
              data-testid="button-confirm-review"
            >
              {reviewMutation.isPending ? "..." : reviewing?.decision === "approved" ? "اعتماد" : "رفض"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel approved dialog */}
      <Dialog open={!!cancelling} onOpenChange={(o) => { if (!o) { setCancelling(null); setCancelReason(""); } }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>إلغاء / سحب الإجازة</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              سيتم إلغاء إجازة {cancelling?.employeeName} ({cancelling?.startDate} → {cancelling?.endDate}) وعكس سجلات الحضور المرتبطة.
            </p>
            <Label>سبب الإلغاء (إلزامي)</Label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} data-testid="textarea-cancel-reason" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelling(null); setCancelReason(""); }}>تراجع</Button>
            <Button variant="destructive" disabled={cancelMutation.isPending || cancelReason.trim().length < 3}
              onClick={() => cancelling && cancelMutation.mutate({ id: cancelling.id, reason: cancelReason })}
              data-testid="button-confirm-cancel">
              {cancelMutation.isPending ? "..." : "تأكيد الإلغاء"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit balance dialog */}
      <Dialog open={!!editBal} onOpenChange={(o) => { if (!o) setEditBal(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>تعديل رصيد {editBal?.employeeName} — {balYear}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>المستحق</Label>
                <Input type="number" value={balForm.entitledDays} onChange={(e) => setBalForm({ ...balForm, entitledDays: e.target.value })} data-testid="input-entitled" />
              </div>
              <div>
                <Label>المرحّل</Label>
                <Input type="number" value={balForm.carriedOverDays} onChange={(e) => setBalForm({ ...balForm, carriedOverDays: e.target.value })} data-testid="input-carried" />
              </div>
              <div>
                <Label>تعديل ±</Label>
                <Input type="number" value={balForm.adjustmentDays} onChange={(e) => setBalForm({ ...balForm, adjustmentDays: e.target.value })} data-testid="input-adjustment" />
              </div>
            </div>
            <div>
              <Label>ملاحظة</Label>
              <Textarea value={balForm.note} onChange={(e) => setBalForm({ ...balForm, note: e.target.value })} data-testid="textarea-bal-note" />
            </div>
            <div className="text-xs text-muted-foreground">المستخدم حالياً: {arNum(editBal?.usedDays)} يوم</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBal(null)}>إلغاء</Button>
            <Button onClick={submitBal} disabled={saveBalMutation.isPending} data-testid="button-save-balance">
              {saveBalMutation.isPending ? "..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print leave form dialog */}
      <Dialog open={!!printLeave} onOpenChange={(o) => { if (!o) setPrintLeave(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto" dir="rtl">
          <DialogHeader><DialogTitle>نموذج إجازة قابل للطباعة</DialogTitle></DialogHeader>
          <div ref={printRef} className="leave-print bg-white text-black p-8" dir="rtl">
            {printLeave && (
              <>
                {/* رأس رسمي بهوية باتر */}
                <div className="flex items-center justify-between border-b-4 pb-4 mb-6" style={{ borderColor: "#C8932A" }}>
                  <div className="flex items-center gap-3">
                    <img src={butterLogo} alt="Butter Bakery" className="h-16 w-16 object-contain" />
                    <div className="text-start">
                      <h2 className="text-xl font-extrabold leading-tight" style={{ color: "#8A6212" }}>شركة الزبد الأفضل التجارية</h2>
                      <div className="text-sm font-semibold" style={{ color: "#C8932A" }}>Butter Bakery Trading Co.</div>
                      <div className="text-[11px] text-gray-700 mt-0.5">شركة مساهمة مقفلة · سجل تجاري: 7026155296</div>
                      <div className="text-[11px] text-gray-600">إدارة الموارد البشرية</div>
                    </div>
                  </div>
                  <div className="text-end text-[11px] text-gray-600 leading-relaxed">
                    <div>رقم الطلب: <span className="font-bold text-black">#{printLeave.id}</span></div>
                    <div>الفرع: <span className="font-bold text-black">{printLeave.branchName || "-"}</span></div>
                    <div>التاريخ: <span className="font-bold text-black">{new Date().toLocaleDateString("ar-SA-u-nu-latn")}</span></div>
                  </div>
                </div>
                <div className="text-center mb-6">
                  <h3 className="inline-block text-lg font-bold px-8 py-1.5 rounded" style={{ backgroundColor: "#FBF3E0", color: "#8A6212" }}>
                    نموذج طلب / اعتماد إجازة
                  </h3>
                </div>
                <table className="w-full text-sm border-collapse mb-4">
                  <tbody>
                    <PrintRow label="اسم الموظف" value={printLeave.employeeName} />
                    <PrintRow label="الوظيفة" value={printLeave.employeeJob || printEmp?.jobTitle || "-"} />
                    <PrintRow label="نوع الإجازة" value={LEAVE_TYPE_LABELS[printLeave.leaveType] || printLeave.leaveType} />
                    <PrintRow label="من تاريخ" value={printLeave.startDate} />
                    <PrintRow label="إلى تاريخ" value={printLeave.endDate} />
                    <PrintRow label="عدد الأيام" value={`${arNum(printLeave.totalDays)} يوم`} />
                    {printLeave.workingDays != null && <PrintRow label="أيام العمل" value={`${arNum(printLeave.workingDays)} يوم`} />}
                    <PrintRow label="الحالة" value={LEAVE_STATUS_LABELS[printLeave.status] || printLeave.status} />
                    <PrintRow label="السبب / الملاحظات" value={printLeave.reason || "-"} />
                    {printLeave.reviewerName && <PrintRow label="المعتمد" value={printLeave.reviewerName} />}
                    {printLeave.cancelReason && <PrintRow label="سبب الإلغاء" value={printLeave.cancelReason} />}
                  </tbody>
                </table>
                <div className="grid grid-cols-3 gap-6 mt-16 text-center text-sm">
                  <div><div className="border-t-2 pt-1" style={{ borderColor: "#C8932A" }}>توقيع الموظف</div></div>
                  <div><div className="border-t-2 pt-1" style={{ borderColor: "#C8932A" }}>مدير الفرع</div></div>
                  <div><div className="border-t-2 pt-1" style={{ borderColor: "#C8932A" }}>الموارد البشرية</div></div>
                </div>
                <div className="border-t border-gray-300 mt-10 pt-3 text-[10px] text-center text-gray-500">
                  شركة الزبد الأفضل التجارية (شركة مساهمة مقفلة) · سجل تجاري: 7026155296 · المملكة العربية السعودية — هذا النموذج صادر آلياً من نظام إدارة الموارد البشرية
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintLeave(null)}>إغلاق</Button>
            <Button onClick={handlePrint} data-testid="button-do-print"><Printer className="h-4 w-4 ms-1" />طباعة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Employee leave statement dialog */}
      <Dialog open={!!stmtEmpId} onOpenChange={(o) => { if (!o) setStmtEmpId(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              كشف حساب الإجازات
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Label className="text-xs">السنة</Label>
            <Select value={String(stmtYear)} onValueChange={(v) => setStmtYear(Number(v))}>
              <SelectTrigger className="w-28 h-8" data-testid="select-stmt-year"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {stmtLoading && <div className="text-center py-8 text-muted-foreground text-sm">جارٍ التحميل...</div>}
          {!stmtLoading && statement && (
            <div ref={stmtPrintRef} className="leave-print bg-white text-black p-6" dir="rtl">
              {/* رأس رسمي */}
              <div className="flex items-center justify-between border-b-4 pb-3 mb-4" style={{ borderColor: "#C8932A" }}>
                <div className="flex items-center gap-3">
                  <img src={butterLogo} alt="Butter Bakery" className="h-14 w-14 object-contain" />
                  <div className="text-start">
                    <h2 className="text-lg font-extrabold leading-tight" style={{ color: "#8A6212" }}>شركة الزبد الأفضل التجارية</h2>
                    <div className="text-xs font-semibold" style={{ color: "#C8932A" }}>Butter Bakery Trading Co.</div>
                    <div className="text-[10px] text-gray-600">إدارة الموارد البشرية — كشف حساب إجازات لسنة {statement.year}</div>
                  </div>
                </div>
                <div className="text-end text-[10px] text-gray-600 leading-relaxed">
                  <div>تاريخ الإصدار: <span className="font-bold text-black">{new Date().toLocaleDateString("ar-SA-u-nu-latn")}</span></div>
                </div>
              </div>

              {/* بيانات الموظف */}
              <table className="w-full text-xs border-collapse mb-4">
                <tbody>
                  <tr>
                    <td className="border p-1.5 font-bold" style={{ borderColor: "#E5C98F", backgroundColor: "#FBF3E0", color: "#8A6212" }}>اسم الموظف</td>
                    <td className="border p-1.5" style={{ borderColor: "#E5C98F" }} data-testid="text-stmt-name">{statement.employee.employeeName}</td>
                    <td className="border p-1.5 font-bold" style={{ borderColor: "#E5C98F", backgroundColor: "#FBF3E0", color: "#8A6212" }}>الرقم الوظيفي</td>
                    <td className="border p-1.5" style={{ borderColor: "#E5C98F" }}>{statement.employee.employeeNumber || "-"}</td>
                  </tr>
                  <tr>
                    <td className="border p-1.5 font-bold" style={{ borderColor: "#E5C98F", backgroundColor: "#FBF3E0", color: "#8A6212" }}>الوظيفة</td>
                    <td className="border p-1.5" style={{ borderColor: "#E5C98F" }}>{statement.employee.jobTitle}</td>
                    <td className="border p-1.5 font-bold" style={{ borderColor: "#E5C98F", backgroundColor: "#FBF3E0", color: "#8A6212" }}>الفرع</td>
                    <td className="border p-1.5" style={{ borderColor: "#E5C98F" }}>{statement.employee.branchName}</td>
                  </tr>
                  <tr>
                    <td className="border p-1.5 font-bold" style={{ borderColor: "#E5C98F", backgroundColor: "#FBF3E0", color: "#8A6212" }}>تاريخ التعيين</td>
                    <td className="border p-1.5" style={{ borderColor: "#E5C98F" }}>{statement.employee.hireDate || "-"}</td>
                    <td className="border p-1.5 font-bold" style={{ borderColor: "#E5C98F", backgroundColor: "#FBF3E0", color: "#8A6212" }}>سنوات الخدمة</td>
                    <td className="border p-1.5" style={{ borderColor: "#E5C98F" }}>{serviceYears(statement.employee.hireDate) != null ? `${arNum(serviceYears(statement.employee.hireDate))} سنة` : "-"}</td>
                  </tr>
                </tbody>
              </table>

              {/* الأرصدة لكل نوع */}
              <h4 className="font-bold text-sm mb-1.5" style={{ color: "#8A6212" }}>ملخص الأرصدة</h4>
              <table className="w-full text-xs border-collapse mb-4">
                <thead>
                  <tr style={{ backgroundColor: "#FBF3E0" }}>
                    {["نوع الإجازة", "المستحق", "المرحّل", "تعديلات", "المستخدم", "المتبقي"].map((h) => (
                      <th key={h} className="border p-1.5 font-bold" style={{ borderColor: "#E5C98F", color: "#8A6212" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(statement.balances || []).map((b: any) => (
                    <tr key={b.leaveType} data-testid={`row-stmt-bal-${b.leaveType}`}>
                      <td className="border p-1.5 font-semibold" style={{ borderColor: "#E5C98F" }}>{LEAVE_TYPE_LABELS[b.leaveType] || b.leaveType}</td>
                      <td className="border p-1.5 tabular-nums text-center" style={{ borderColor: "#E5C98F" }}>{arNum(b.entitledDays)}{!b.hasRow && b.leaveType === "annual" ? " (مقترح)" : ""}</td>
                      <td className="border p-1.5 tabular-nums text-center" style={{ borderColor: "#E5C98F" }}>{arNum(b.carriedOverDays)}</td>
                      <td className="border p-1.5 tabular-nums text-center" style={{ borderColor: "#E5C98F" }}>{arNum(b.adjustmentDays)}</td>
                      <td className="border p-1.5 tabular-nums text-center" style={{ borderColor: "#E5C98F" }}>{arNum(b.usedDays)}</td>
                      <td className={`border p-1.5 tabular-nums text-center font-bold ${b.remainingDays < 0 ? "text-red-600" : ""}`} style={{ borderColor: "#E5C98F" }}>{arNum(b.remainingDays)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* سجل الحركات */}
              <h4 className="font-bold text-sm mb-1.5" style={{ color: "#8A6212" }}>سجل الحركات خلال السنة</h4>
              {stmtRows.length === 0 ? (
                <div className="text-center text-xs text-gray-500 border rounded py-4" style={{ borderColor: "#E5C98F" }}>لا توجد حركات إجازة خلال هذه السنة</div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: "#FBF3E0" }}>
                      {["النوع", "من", "إلى", "أيام ضمن السنة", "الحالة", "الرصيد بعد الحركة"].map((h) => (
                        <th key={h} className="border p-1.5 font-bold" style={{ borderColor: "#E5C98F", color: "#8A6212" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stmtRows.map((m: any) => (
                      <tr key={m.id} data-testid={`row-stmt-mov-${m.id}`}>
                        <td className="border p-1.5" style={{ borderColor: "#E5C98F" }}>{LEAVE_TYPE_LABELS[m.leaveType] || m.leaveType}</td>
                        <td className="border p-1.5 tabular-nums" style={{ borderColor: "#E5C98F" }}>{m.startDate}</td>
                        <td className="border p-1.5 tabular-nums" style={{ borderColor: "#E5C98F" }}>{m.endDate}</td>
                        <td className="border p-1.5 tabular-nums text-center" style={{ borderColor: "#E5C98F" }}>{arNum(m.daysInYear)}</td>
                        <td className="border p-1.5" style={{ borderColor: "#E5C98F" }}>{LEAVE_STATUS_LABELS[m.status] || m.status}</td>
                        <td className="border p-1.5 tabular-nums text-center font-bold" style={{ borderColor: "#E5C98F" }}>
                          {m.balanceAfter != null ? arNum(m.balanceAfter) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="border-t border-gray-300 mt-6 pt-2 text-[9px] text-center text-gray-500">
                شركة الزبد الأفضل التجارية · سجل تجاري: 7026155296 — كشف صادر آلياً من نظام إدارة الموارد البشرية ولا يحتاج توقيعاً
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStmtEmpId(null)}>إغلاق</Button>
            <Button onClick={printStatement} disabled={!statement} data-testid="button-print-statement">
              <Printer className="h-4 w-4 ms-1" />طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </Layout>
  );
}

function PrintRow({ label, value }: { label: string; value: any }) {
  return (
    <tr>
      <td className="border p-2 font-bold w-1/3" style={{ borderColor: "#E5C98F", backgroundColor: "#FBF3E0", color: "#8A6212" }}>{label}</td>
      <td className="border p-2" style={{ borderColor: "#E5C98F" }}>{value ?? "-"}</td>
    </tr>
  );
}

function StatCard({ label, value, icon, accent = "amber" }: { label: string; value: any; icon: any; accent?: string }) {
  const accents: Record<string, string> = {
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground mb-1">{label}</div>
          <div className="text-2xl font-bold tabular-nums">{Number(value).toLocaleString("ar-SA-u-nu-latn")}</div>
        </div>
        <div className={`p-2 rounded-lg ${accents[accent] || accents.amber}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}
