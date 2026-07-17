import { useState, useMemo, useRef, useEffect } from "react";
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
  Wallet, Printer, FileSpreadsheet, Ban, Paperclip, Pencil, ChevronRight, ChevronLeft, ListChecks, Sun, FileText, Calculator,
  Banknote, LogOut, LogIn, AlertTriangle, LayoutDashboard, Coins, UserX, MoreHorizontal, Download,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS } from "@shared/schema";
import butterLogo from "@assets/logo_-5_1765206843638.png";
import { Layout } from "@/components/layout";
import { usePermissions } from "@/hooks/usePermissions";
import { Link } from "wouter";
import * as XLSX from "xlsx";

type Leave = any;
type Emp = { id: number; employeeName: string; jobTitle: string; branchId: string; hireDate?: string | null; status?: string };
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

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const PIE_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#0ea5e9", "#f97316", "#64748b"];

const fmtDate = (d?: string | null) => {
  if (!d) return "-";
  try {
    const dt = new Date(d + "T00:00:00");
    const opts: Intl.DateTimeFormatOptions = dt.getFullYear() === new Date().getFullYear()
      ? { day: "numeric", month: "short" }
      : { day: "numeric", month: "short", year: "numeric" };
    return dt.toLocaleDateString("ar-SA-u-nu-latn-ca-gregory", opts);
  } catch { return d; }
};

// عرض فترة (من ← إلى) بترتيب ثابت لا تكسره اتجاهية النص RTL
const Period = ({ start, end }: { start?: string | null; end?: string | null }) => (
  <bdi className="inline-block whitespace-nowrap tabular-nums" dir="rtl">
    <span className="whitespace-nowrap">{fmtDate(start)}</span>
    {" ← "}
    <span className="whitespace-nowrap">{fmtDate(end)}</span>
  </bdi>
);

const serviceYears = (hireDate?: string | null): number | null => {
  if (!hireDate) return null;
  const h = new Date(hireDate + "T00:00:00").getTime();
  if (isNaN(h)) return null;
  return Math.floor((Date.now() - h) / (365.25 * 86400000));
};

export default function LeavesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  // تعديل أرصدة الإجازات (والترحيل) يتطلب صلاحية "تعديل" على وحدة الإجازات —
  // متاحة فقط لاختصاصي/مدير شؤون الموظفين والأدمن. الخادم يفرضها أيضاً.
  const { hasPermission, isAdmin } = usePermissions();
  const canEditBalances = hasPermission("hr_leaves", "edit");
  // تصفية الرصيد (سند صرف) تتطلب صلاحية "تعديل" — الأدمن ومدير/اختصاصي شؤون الموظفين.
  // حذف الطلب نهائياً للأدمن فقط (الخادم يفرض القاعدتين أيضاً).
  const canSettle = canEditBalances;
  const canDeleteLeave = isAdmin;
  const currentYear = new Date().getFullYear();

  const [tab, setTab] = useState("requests");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all"); // YYYY-MM أو all
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof initialForm>(initialForm);
  const [reviewing, setReviewing] = useState<{ id: number; decision: "approved" | "rejected"; leave: Leave } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  // تغطية الفرع عند مراجعة الاعتماد: هل هناك إجازات معتمدة متداخلة لموظفين آخرين؟
  const { data: coverage } = useQuery<any>({
    queryKey: ["/api/hr/leaves", reviewing?.id, "coverage"],
    queryFn: async () => (await apiRequest("GET", `/api/hr/leaves/${reviewing!.id}/coverage`)).json(),
    enabled: !!reviewing && reviewing.decision === "approved",
    staleTime: 30_000,
  });
  // لوحة المراجعة الذكية: سجل الموظف + رصيده + تداخل العطلات الرسمية
  const { data: reviewHistory } = useQuery<any>({
    queryKey: ["/api/hr/leaves/employee-history", reviewing?.leave?.branchEmployeeId, "review"],
    queryFn: async () => (await apiRequest("GET", `/api/hr/leaves/employee-history/${reviewing!.leave.branchEmployeeId}`)).json(),
    enabled: !!reviewing?.leave?.branchEmployeeId,
    staleTime: 30_000,
  });
  const { data: reviewBalance } = useQuery<any>({
    queryKey: ["/api/hr/leave-balances", reviewing?.leave?.branchEmployeeId, reviewing?.leave?.leaveType, reviewing?.leave?.startDate, "review"],
    queryFn: async () => {
      const yr = String(reviewing!.leave.startDate || "").slice(0, 4) || String(new Date().getFullYear());
      return (await apiRequest("GET", `/api/hr/leave-balances/${reviewing!.leave.branchEmployeeId}?type=${reviewing!.leave.leaveType}&year=${yr}`)).json();
    },
    enabled: !!reviewing?.leave?.branchEmployeeId && reviewing?.leave?.leaveType !== "unpaid",
    staleTime: 30_000,
  });
  const { data: reviewHolidays = [] } = useQuery<any[]>({
    queryKey: ["/api/hr/public-holidays", "review"],
    queryFn: async () => (await apiRequest("GET", "/api/hr/public-holidays")).json(),
    enabled: !!reviewing,
    staleTime: 300_000,
  });
  // العطلات الرسمية المتداخلة مع فترة الطلب قيد المراجعة
  const reviewHolidayOverlap = useMemo(() => {
    if (!reviewing?.leave?.startDate || !reviewing?.leave?.endDate) return [];
    const s = reviewing.leave.startDate, e = reviewing.leave.endDate;
    return (reviewHolidays || []).filter((h: any) =>
      h.isActive !== false && h.startDate && h.endDate && h.startDate <= e && h.endDate >= s
    );
  }, [reviewing?.leave?.startDate, reviewing?.leave?.endDate, reviewHolidays]);
  const [allowOver, setAllowOver] = useState(false);
  const [cancelling, setCancelling] = useState<Leave | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [printLeave, setPrintLeave] = useState<Leave | null>(null);
  const [editingDates, setEditingDates] = useState<Leave | null>(null);
  const [datesForm, setDatesForm] = useState({ startDate: "", endDate: "", note: "" });

  // ===== دورة الخروج والعودة + التصفية =====
  const [exitLeave, setExitLeave] = useState<Leave | null>(null);
  const [exitDate, setExitDate] = useState("");
  const [returnLeave, setReturnLeave] = useState<Leave | null>(null);
  const [returnDate, setReturnDate] = useState("");
  const [settleLeave, setSettleLeave] = useState<Leave | null>(null);
  const [settleForm, setSettleForm] = useState({ days: "", useManual: false, manualAmount: "", note: "" });
  const [receiptSettlement, setReceiptSettlement] = useState<any | null>(null);

  // ===== تبويب كشف الحساب والتصفيات =====
  const [wfStatus, setWfStatus] = useState("all");
  const [wfFrom, setWfFrom] = useState("");
  const [wfTo, setWfTo] = useState("");
  const [wfEmpId, setWfEmpId] = useState("all");
  const [disbursing, setDisbursing] = useState<any | null>(null);
  const [disburseNote, setDisburseNote] = useState("");
  const receiptPrintRef = useRef<HTMLDivElement>(null);
  const printReceipt = useReactToPrint({ contentRef: receiptPrintRef });

  // balances state
  const [balYear, setBalYear] = useState(currentYear);
  const [balType, setBalType] = useState("annual");
  const [editBal, setEditBal] = useState<Balance | null>(null);
  const [balForm, setBalForm] = useState({ entitledDays: "21", carriedOverDays: "0", adjustmentDays: "0", note: "" });

  // الرصيد التراكمي "حتى تاريخه" (النظام التعاقدي)
  const [accrualSearch, setAccrualSearch] = useState("");
  const [balView, setBalView] = useState<"accrual" | "yearly">("accrual");
  const [reqShown, setReqShown] = useState(50);
  const [accrualShown, setAccrualShown] = useState(50);
  const [editAccrual, setEditAccrual] = useState<any | null>(null);
  const [accrualForm, setAccrualForm] = useState({ annualLeaveDays: "", leaveOpeningBalance: "", leaveOpeningBalanceDate: "" });

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

  // الرصيد المستحق حتى تاريخه لكل الموظفين (الإجازة السنوية فقط)
  const { data: accruals = [], isLoading: accrualLoading } = useQuery<any[]>({
    queryKey: ["/api/hr/leave-accrual"],
    queryFn: async () => (await apiRequest("GET", "/api/hr/leave-accrual")).json(),
    enabled: (tab === "balances" && balType === "annual") || tab === "dashboard",
  });

  // موظفون برصيد إجازات مرتفع (30 يوماً فأكثر) — تنبيه التزام مالي
  const highAccrualEmployees = useMemo(
    () =>
      (accruals as any[])
        .filter((a) => Number(a.remainingDays) >= 30)
        .sort((a, b) => Number(b.remainingDays) - Number(a.remainingDays)),
    [accruals]
  );

  const accrualMutation = useMutation({
    mutationFn: async (payload: { employeeId: number; annualLeaveDays: string; leaveOpeningBalance: string; leaveOpeningBalanceDate: string }) => {
      const res = await apiRequest("PATCH", `/api/hr/leave-accrual/${payload.employeeId}`, {
        annualLeaveDays: payload.annualLeaveDays === "" ? null : Number(payload.annualLeaveDays),
        leaveOpeningBalance: payload.leaveOpeningBalance === "" ? null : Number(payload.leaveOpeningBalance),
        leaveOpeningBalanceDate: payload.leaveOpeningBalanceDate || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم حفظ بيانات الاستحقاق" });
      setEditAccrual(null);
      qc.invalidateQueries({ queryKey: ["/api/hr/leave-accrual"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leave-balances"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves/stats"] });
    },
    onError: (e: any) => {
      let msg = e?.message || "خطأ غير متوقع";
      const idx = msg.indexOf("{");
      if (idx >= 0) { try { msg = JSON.parse(msg.slice(idx)).error || msg; } catch {} }
      toast({ title: "تعذّر الحفظ", description: msg, variant: "destructive" });
    },
  });

  const openEditAccrual = (row: any) => {
    setAccrualForm({
      annualLeaveDays: row.rawAnnualLeaveDays != null ? String(row.rawAnnualLeaveDays) : "",
      leaveOpeningBalance: row.rawOpeningBalance != null ? String(row.rawOpeningBalance) : "",
      leaveOpeningBalanceDate: row.rawOpeningBalanceDate || "",
    });
    setEditAccrual(row);
  };

  // balance for the employee selected in the create form
  const { data: formBalance } = useQuery<Balance>({
    queryKey: ["/api/hr/leave-balances/emp", form.branchEmployeeId, form.leaveType],
    queryFn: async () =>
      (await apiRequest("GET", `/api/hr/leave-balances/${form.branchEmployeeId}?year=${currentYear}&type=${form.leaveType}`)).json(),
    enabled: open && !!form.branchEmployeeId && form.leaveType !== "unpaid",
  });

  // سجل إجازات الموظف المختار في نموذج الإنشاء (آخر إجازة + هستري مختصر)
  const { data: formHistory } = useQuery<any>({
    queryKey: ["/api/hr/leaves/employee-history", form.branchEmployeeId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/hr/leaves/employee-history/${form.branchEmployeeId}`)).json(),
    enabled: open && !!form.branchEmployeeId,
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

  // ===== خطة الإجازات السنوية =====
  const [planYear, setPlanYear] = useState(currentYear);
  const [planBranch, setPlanBranch] = useState("all");
  const [planOpen, setPlanOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<any | null>(null);
  const [planForm, setPlanForm] = useState({ branchEmployeeId: "", plannedStartDate: "", plannedEndDate: "", note: "" });
  const { data: planEntries = [], isLoading: planLoading } = useQuery<any[]>({
    queryKey: ["/api/hr/leave-plan", planYear],
    queryFn: async () => (await apiRequest("GET", `/api/hr/leave-plan?year=${planYear}`)).json(),
    enabled: tab === "plan",
  });
  const { data: planHolidays = [] } = useQuery<any[]>({
    queryKey: ["/api/hr/public-holidays", planYear],
    queryFn: async () => (await apiRequest("GET", `/api/hr/public-holidays?year=${planYear}`)).json(),
    enabled: tab === "plan",
  });
  const savePlanMutation = useMutation({
    mutationFn: async (body: any) => {
      if (editPlan) return (await apiRequest("PATCH", `/api/hr/leave-plan/${editPlan.id}`, body)).json();
      return (await apiRequest("POST", "/api/hr/leave-plan", body)).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leave-plan"] });
      setPlanOpen(false);
      setEditPlan(null);
      setPlanForm({ branchEmployeeId: "", plannedStartDate: "", plannedEndDate: "", note: "" });
      toast({ title: editPlan ? "تم تعديل الإجازة المخططة" : "تمت إضافة الإجازة المخططة" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const deletePlanMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/hr/leave-plan/${id}`)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leave-plan"] });
      toast({ title: "تم حذف الإجازة المخططة" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  // ===== أرشيف مستندات الإجازات =====
  const [docSearch, setDocSearch] = useState("");
  const [docType, setDocType] = useState("all");
  const { data: allLeavesForDocs = [], isLoading: docsLoading } = useQuery<Leave[]>({
    queryKey: ["/api/hr/leaves", "docs-archive"],
    queryFn: async () => (await apiRequest("GET", "/api/hr/leaves")).json(),
    enabled: tab === "docs",
  });
  const docsByEmployee = useMemo(() => {
    const withDocs = (allLeavesForDocs as any[]).filter((l) => {
      if (!l.attachmentUrl) return false;
      if (docType !== "all" && l.leaveType !== docType) return false;
      if (docSearch.trim() && !(l.employeeName || "").includes(docSearch.trim())) return false;
      return true;
    });
    const map = new Map<number, { employeeName: string; jobTitle: string; branchName: string; docs: any[] }>();
    for (const l of withDocs) {
      const g = map.get(l.branchEmployeeId) || { employeeName: l.employeeName || "-", jobTitle: l.employeeJob || "", branchName: l.branchName || "", docs: [] };
      g.docs.push(l);
      map.set(l.branchEmployeeId, g);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].employeeName.localeCompare(b[1].employeeName, "ar"));
  }, [allLeavesForDocs, docSearch, docType]);

  // كشف التعارضات: تداخل إجازات مخططة لموظفَين أو أكثر بنفس الفرع + تداخل مع عطلة رسمية (موسم ذروة)
  const planAnalysis = useMemo(() => {
    const visible = planEntries.filter((p: any) => p.status !== "cancelled" && (planBranch === "all" || p.branchId === planBranch));
    const overlapIds = new Set<number>();
    const holidayIds = new Set<number>();
    for (let i = 0; i < visible.length; i++) {
      const a = visible[i];
      for (let j = i + 1; j < visible.length; j++) {
        const b = visible[j];
        if (a.branchId === b.branchId && a.plannedStartDate <= b.plannedEndDate && b.plannedStartDate <= a.plannedEndDate) {
          overlapIds.add(a.id); overlapIds.add(b.id);
        }
      }
      for (const h of planHolidays as any[]) {
        if (h.isActive !== false && a.plannedStartDate <= h.endDate && h.startDate <= a.plannedEndDate) {
          holidayIds.add(a.id);
        }
      }
    }
    return { visible, overlapIds, holidayIds };
  }, [planEntries, planBranch, planHolidays]);

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
    const accrualConfigured = !!statement.accrual?.configured;
    return (statement.movements || []).map((m: any) => {
      let after: number | null = null;
      // السنوية تُدار بالنظام التلقائي — لا نعرض رصيداً متحركاً من سجل السنوات كي لا تظهر أرقام سالبة مضللة
      if (accrualConfigured && m.leaveType === "annual") return { ...m, balanceAfter: null };
      if (m.status === "approved" && m.leaveType !== "unpaid" && running[m.leaveType] !== undefined) {
        running[m.leaveType] -= m.daysInYear;
        after = running[m.leaveType];
      }
      return { ...m, balanceAfter: after };
    });
  }, [statement]);

  // ===== حاسبة الرصيد المستحق =====
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcEmpId, setCalcEmpId] = useState<string>("");
  const [calcAsOf, setCalcAsOf] = useState<string>(new Date().toLocaleDateString("en-CA"));
  const [calcType, setCalcType] = useState<string>("annual");
  const calcYear = Number(calcAsOf?.slice(0, 4)) || currentYear;
  const { data: calcBalance } = useQuery<any>({
    queryKey: ["/api/hr/leave-balances/calc", calcEmpId, calcYear, calcType],
    queryFn: async () =>
      (await apiRequest("GET", `/api/hr/leave-balances/${calcEmpId}?year=${calcYear}&type=${calcType}`)).json(),
    enabled: calcOpen && !!calcEmpId && calcType !== "unpaid",
  });
  // الرصيد الفعلي التراكمي (النظام التلقائي) — للإجازة السنوية فقط
  const { data: calcAccrual } = useQuery<any>({
    queryKey: ["/api/hr/leave-accrual/single", calcEmpId, calcAsOf],
    queryFn: async () =>
      (await apiRequest("GET", `/api/hr/leave-accrual/${calcEmpId}?asOf=${calcAsOf}`)).json(),
    enabled: calcOpen && !!calcEmpId && calcType === "annual" && !!calcAsOf,
  });
  const calcResult = useMemo(() => {
    if (!calcEmpId || !calcBalance || !calcAsOf) return null;
    const emp = employees.find((e) => e.id === Number(calcEmpId));
    if (!emp) return null;
    const hire = emp.hireDate ? new Date(emp.hireDate + "T00:00:00Z") : null;
    const asOf = new Date(calcAsOf + "T00:00:00Z");
    if (hire && asOf < hire) return { error: "التاريخ المختار قبل تاريخ التعيين" } as any;
    // مدة الخدمة الكلية
    let serviceText = "-";
    if (hire) {
      const totalMonths = Math.max(0, (asOf.getUTCFullYear() - hire.getUTCFullYear()) * 12 + (asOf.getUTCMonth() - hire.getUTCMonth()) - (asOf.getUTCDate() < hire.getUTCDate() ? 1 : 0));
      serviceText = `${arNum(Math.floor(totalMonths / 12))} سنة و ${arNum(totalMonths % 12)} شهر`;
    }
    // الاستحقاق التراكمي (pro-rata) داخل سنة الحساب: من بداية السنة أو تاريخ التعيين أيهما أحدث
    const yearStart = new Date(Date.UTC(calcYear, 0, 1));
    const accrualStart = hire && hire > yearStart ? hire : yearStart;
    const daysElapsed = Math.max(0, Math.round((asOf.getTime() - accrualStart.getTime()) / 86400000) + 1);
    const daysInYear = ((calcYear % 4 === 0 && calcYear % 100 !== 0) || calcYear % 400 === 0) ? 366 : 365;
    const entitled = Number(calcBalance.entitledDays);
    const accrued = Math.round(entitled * Math.min(1, daysElapsed / daysInYear) * 10) / 10;
    const carried = Number(calcBalance.carriedOverDays);
    const adjust = Number(calcBalance.adjustmentDays);
    const used = Number(calcBalance.usedDays);
    const accruedNet = Math.round((accrued + carried + adjust - used) * 10) / 10;
    return {
      empName: emp.employeeName, jobTitle: emp.jobTitle, hireDate: emp.hireDate, serviceText,
      entitled, accrued, carried, adjust, used, accruedNet,
      fullYearRemaining: Number(calcBalance.remainingDays),
      monthlyAccrual: Math.round((entitled / 12) * 100) / 100,
    } as any;
  }, [calcEmpId, calcBalance, calcAsOf, employees, calcYear]);

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

  // خيارات فلتر الفرع من الطلبات المعروضة
  const branchOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of leaves as any[]) if (l.branchId) map.set(l.branchId, l.branchName || l.branchId);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "ar"));
  }, [leaves]);
  // خيارات فلتر الشهر: آخر 12 شهرًا + الأشهر القادمة الموجودة في الطلبات
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of leaves as any[]) {
      if (l.startDate) set.add(l.startDate.slice(0, 7));
      if (l.endDate) set.add(l.endDate.slice(0, 7));
    }
    return Array.from(set).sort().reverse();
  }, [leaves]);

  const filtered = useMemo(() => {
    let list = leaves as any[];
    if (filterBranch !== "all") list = list.filter((l) => l.branchId === filterBranch);
    if (filterMonth !== "all") {
      // مقارنة على مستوى الشهر (YYYY-MM) لتغطية كل أطوال الشهور
      list = list.filter((l) =>
        (l.startDate || "").slice(0, 7) <= filterMonth && (l.endDate || "").slice(0, 7) >= filterMonth
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) => (l.employeeName || "").toLowerCase().includes(q));
    }
    return list;
  }, [leaves, search, filterBranch, filterMonth]);

  // إعادة ضبط "عرض المزيد" عند تغيير الفلاتر أو البحث
  useEffect(() => { setReqShown(50); }, [search, filterStatus, filterType, filterBranch, filterMonth]);
  useEffect(() => { setAccrualShown(50); }, [accrualSearch, balType]);

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

  // سجل إجازات الموظف عند فتح نافذة التصفية
  const { data: settleHistory } = useQuery<any>({
    queryKey: ["/api/hr/leaves/employee-history", settleLeave?.branchEmployeeId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/hr/leaves/employee-history/${settleLeave!.branchEmployeeId}`)).json(),
    enabled: !!settleLeave?.branchEmployeeId,
  });

  // ===== معاينة التصفية (عند فتح نافذة التصفية) =====
  const { data: settlePreview, isLoading: settlePreviewLoading } = useQuery<any>({
    queryKey: ["/api/hr/leaves/settlement-preview", settleLeave?.id],
    queryFn: async () =>
      (await apiRequest("GET", `/api/hr/leaves/${settleLeave!.id}/settlement-preview`)).json(),
    enabled: !!settleLeave,
  });

  const settlementMutation = useMutation({
    mutationFn: async ({ id, days, manualAmount, note }: any) => {
      const res = await apiRequest("POST", `/api/hr/leaves/${id}/settlement`, { days, manualAmount, note });
      return res.json();
    },
    onSuccess: (s: any) => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leave-balances"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves/employee-statement"] });
      toast({ title: "تمت تصفية الرصيد", description: `المبلغ: ${arNum(s.finalAmount)} ريال عن ${arNum(s.settledDays)} يوم` });
      const empName = settleLeave?.employeeName;
      setSettleLeave(null);
      setSettleForm({ days: "", useManual: false, manualAmount: "", note: "" });
      setReceiptSettlement({ ...s, employeeName: empName });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشلت التصفية", variant: "destructive" }),
  });

  const cancelSettlementMutation = useMutation({
    mutationFn: async ({ id, reason }: any) => {
      const res = await apiRequest("POST", `/api/hr/leave-settlements/${id}/cancel`, { reason });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leave-balances"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves/settlement-preview"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves/employee-statement"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leave-settlements"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves/settlement-candidates"] });
      toast({ title: "تم إلغاء التصفية وإعادة الأيام للرصيد" });
      setSettleLeave(null);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الإلغاء", variant: "destructive" }),
  });

  // ===== تبويب كشف الحساب والتصفيات: بيانات وعمليات =====
  const { data: wfAllSettlements = [], isLoading: wfLoading } = useQuery<any[]>({
    queryKey: ["/api/hr/leave-settlements", wfFrom, wfTo, wfEmpId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (wfFrom) p.set("from", wfFrom);
      if (wfTo) p.set("to", wfTo);
      if (wfEmpId !== "all") p.set("employeeId", wfEmpId);
      return (await apiRequest("GET", `/api/hr/leave-settlements?${p}`)).json();
    },
    enabled: tab === "settlements",
  });
  // فلترة الحالة محلياً حتى تبقى بطاقات المؤشرات شاملة كل الحالات
  const wfSettlements = useMemo(
    () => wfStatus === "all" ? wfAllSettlements : wfAllSettlements.filter((s: any) => s.workflowStatus === wfStatus),
    [wfAllSettlements, wfStatus],
  );
  const wfCounts = useMemo(() => {
    const c = { issued: 0, awaiting_signature: 0, signed: 0, disbursed: 0, disbursedAmount: 0 };
    for (const s of wfAllSettlements) {
      if (s.workflowStatus in c) (c as any)[s.workflowStatus]++;
      if (s.workflowStatus === "disbursed") c.disbursedAmount += s.finalAmount || 0;
    }
    return c;
  }, [wfAllSettlements]);
  // تصدير سجل التصفيات إلى Excel
  const exportSettlementsXlsx = () => {
    const rows = wfSettlements.map((s: any) => ({
      "الموظف": s.employeeName,
      "الوظيفة": s.jobTitle || "",
      "الفرع": s.branchName || "",
      "فترة الإجازة": s.leaveStart ? `${s.leaveStart} → ${s.leaveEnd}` : "",
      "الأيام المصفاة": s.settledDays,
      "بدل اليوم (ر.س)": s.dailyRate,
      "المبلغ (ر.س)": s.finalAmount,
      "تاريخ التصفية": s.settlementDate,
      "الحالة": ({ issued: "صادرة", awaiting_signature: "بانتظار توقيع الموظف", signed: "موقّعة", disbursed: "مصروفة" } as any)[s.workflowStatus] || s.workflowStatus,
      "تاريخ الصرف": s.disbursedAt ? String(s.disbursedAt).slice(0, 10) : "",
      "ملاحظة الصرف": s.disbursementNote || "",
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, ws, "التصفيات");
    XLSX.writeFile(wb, `leave-settlements-${new Date().toLocaleDateString("en-CA")}.xlsx`);
  };

  const { data: settleCandidates = [], isLoading: candLoading } = useQuery<any[]>({
    queryKey: ["/api/hr/leaves/settlement-candidates"],
    queryFn: async () => (await apiRequest("GET", "/api/hr/leaves/settlement-candidates")).json(),
    enabled: tab === "settlements",
  });

  const sendFinanceMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/hr/leave-settlements/${id}/send-finance`)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leave-settlements"] });
      toast({ title: "تم التحويل للإدارة المالية", description: "أُشعر الموظف عبر بوابتي والواتساب للتوقيع والإقرار بالاستلام" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل التحويل", variant: "destructive" }),
  });

  const disburseMutation = useMutation({
    mutationFn: async ({ id, note }: any) => (await apiRequest("POST", `/api/hr/leave-settlements/${id}/disburse`, { note })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leave-settlements"] });
      toast({ title: "تم تأكيد الصرف", description: "حُفظت التصفية ضمن تصفيات الإجازات المصروفة" });
      setDisbursing(null);
      setDisburseNote("");
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل تأكيد الصرف", variant: "destructive" }),
  });

  // طباعة سند تصفية رسمي مع سلسلة الاعتمادات وتوقيع الموظف
  const printSettlementDoc = async (id: number) => {
    try {
      const d = await (await apiRequest("GET", `/api/hr/leave-settlements/${id}`)).json();
      const esc = (v: any) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const flow: any[] = Array.isArray(d.approvalFlow) ? d.approvalFlow : [];
      const flowRows = flow.filter((f) => f?.decision === "approved").map((f, i) =>
        `<tr><td>${arNum(f.level ?? i + 1)}</td><td>${esc(f.title || "—")}</td><td>${esc(f.approverName || "—")}</td><td>${f.at ? esc(fmtDate(String(f.at).slice(0, 10))) : "—"}</td><td>${esc(f.note || "—")}</td></tr>`
      ).join("");
      const fallbackApproval = !flowRows && d.reviewerName
        ? `<tr><td>١</td><td>الاعتماد</td><td>${esc(d.reviewerName)}</td><td>${d.reviewedAt ? esc(fmtDate(String(d.reviewedAt).slice(0, 10))) : "—"}</td><td>—</td></tr>` : "";
      const wfLabel: any = { issued: "صادرة", awaiting_signature: "محوّلة للمالية — بانتظار توقيع الموظف", signed: "موقّعة من الموظف", disbursed: "مصروفة" };
      const w = window.open("", "_blank", "width=900,height=700");
      if (!w) return;
      w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>سند تصفية إجازة</title>
<style>
  body{font-family:'Cairo','Segoe UI',Tahoma,sans-serif;padding:28px;color:#222;font-size:13px}
  h1{font-size:18px;text-align:center;margin:4px 0}
  .sub{text-align:center;color:#666;font-size:11px;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  th,td{border:1px solid #bbb;padding:6px 8px;text-align:right;font-size:12px}
  th{background:#f6f1e7}
  .box{border:1px solid #bbb;border-radius:6px;padding:10px 14px;margin:8px 0}
  .row{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .sig{margin-top:18px;display:flex;justify-content:space-between;gap:24px}
  .sig div{flex:1;text-align:center}
  .sig img{max-height:70px}
  .line{border-top:1px solid #999;margin-top:46px;padding-top:4px;font-size:11px}
  .badge{display:inline-block;border:1px solid #b58a2e;color:#8a6414;border-radius:4px;padding:1px 8px;font-size:11px}
  @media print{.noprint{display:none}}
</style></head><body>
<h1>سند تصفية رصيد إجازة سنوية</h1>
<div class="sub">مخبز باتر — إدارة شؤون الموظفين · رقم التصفية: ${arNum(d.id)} · الحالة: <span class="badge">${esc(wfLabel[d.workflowStatus] || d.workflowStatus)}</span></div>
<div class="box row">
  <span><b>الموظف:</b> ${esc(d.employeeName)}</span>
  <span><b>المسمى:</b> ${esc(d.jobTitle || "—")}</span>
  <span><b>الفرع:</b> ${esc(d.branchName || "—")}</span>
  ${d.employeeNumber ? `<span><b>الرقم الوظيفي:</b> ${esc(d.employeeNumber)}</span>` : ""}
</div>
<table>
  <tr><th>فترة الإجازة</th><th>الأيام المصفاة</th><th>بدل اليوم (ر.س)</th><th>المبلغ المستحق (ر.س)</th><th>تاريخ التصفية</th></tr>
  <tr>
    <td>${d.leaveStart ? `${esc(fmtDate(d.leaveStart))} → ${esc(fmtDate(d.leaveEnd))}` : "—"}</td>
    <td>${arNum(d.settledDays)}</td>
    <td>${arNum(d.dailyRate)}</td>
    <td><b>${arNum(d.finalAmount)}</b></td>
    <td>${esc(fmtDate(d.settlementDate))}</td>
  </tr>
</table>
${d.note ? `<div class="box"><b>ملاحظات:</b> ${esc(d.note)}</div>` : ""}
<h1 style="font-size:14px;text-align:right;margin-top:14px">سلسلة الاعتمادات على طلب الإجازة</h1>
${flowRows || fallbackApproval
  ? `<table><tr><th>المستوى</th><th>الصفة</th><th>المعتمد</th><th>التاريخ</th><th>ملاحظة</th></tr>${flowRows || fallbackApproval}</table>`
  : `<div class="box" style="color:#777">لا توجد سلسلة اعتمادات مسجلة على الطلب</div>`}
${d.workflowStatus === "disbursed" ? `<div class="box"><b>الصرف:</b> تم الصرف بتاريخ ${d.disbursedAt ? esc(fmtDate(String(d.disbursedAt).slice(0, 10))) : "—"}${d.disbursementNote ? ` — ${esc(d.disbursementNote)}` : ""}</div>` : ""}
<div class="sig">
  <div>
    <b>توقيع الموظف والإقرار بالاستلام</b><br/>
    ${d.signatureData ? `<img src="${d.signatureData.startsWith("data:image/") ? d.signatureData : ""}" alt="توقيع"/><div style="font-size:11px;color:#555">وقّع بتاريخ ${d.signedAt ? esc(fmtDate(String(d.signedAt).slice(0, 10))) : "—"}</div>` : `<div class="line">الاسم والتوقيع</div>`}
  </div>
  <div><b>الإدارة المالية</b><div class="line">الاسم والتوقيع</div></div>
  <div><b>شؤون الموظفين</b><div class="line">الاسم والتوقيع</div></div>
</div>
<div class="noprint" style="text-align:center;margin-top:18px"><button onclick="window.print()" style="padding:8px 26px;font-family:inherit">طباعة</button></div>
</body></html>`);
      w.document.close();
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "تعذر تحميل بيانات التصفية", variant: "destructive" });
    }
  };

  const confirmExitMutation = useMutation({
    mutationFn: async ({ id, actualExitDate }: any) => {
      const res = await apiRequest("POST", `/api/hr/leaves/${id}/confirm-exit`, { actualExitDate });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves"] });
      toast({ title: "تم تأكيد مباشرة الخروج" });
      setExitLeave(null);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل تأكيد الخروج", variant: "destructive" }),
  });

  const confirmReturnMutation = useMutation({
    mutationFn: async ({ id, actualReturnDate }: any) => {
      const res = await apiRequest("POST", `/api/hr/leaves/${id}/confirm-return`, { actualReturnDate });
      return res.json();
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves"] });
      const late = Number(r?.lateDays || 0);
      toast({
        title: "تم تسجيل مباشرة العمل",
        description: late > 0
          ? `تأخر ${arNum(late)} يوم عن موعد العودة — سُجّلت الأيام غياباً`
          : "عاد في الموعد المحدد",
      });
      setReturnLeave(null);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل تسجيل المباشرة", variant: "destructive" }),
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
    mutationFn: async (maxDays: number | null) => {
      const res = await apiRequest("POST", "/api/hr/leave-balances/carryover", {
        fromYear: balYear - 1,
        leaveType: balType,
        maxDays,
      });
      return res.json();
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leave-balances"] });
      const parts: string[] = [`تم ترحيل رصيد ${arNum(r?.carried ?? 0)} موظف من ${arNum(r?.fromYear)} إلى ${arNum(r?.toYear)}`];
      if (r?.capped) parts.push(`${arNum(r.capped)} طُبّق عليهم السقف`);
      if (r?.unchanged) parts.push(`${arNum(r.unchanged)} بدون تغيير (مرحّل مسبقاً)`);
      if (r?.skippedZero) parts.push(`${arNum(r.skippedZero)} بلا رصيد متبقٍ`);
      toast({ title: "اكتمل الترحيل", description: parts.join(" • ") });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الترحيل", variant: "destructive" }),
  });

  const provisionMutation = useMutation({
    mutationFn: async (replace: boolean) => {
      const res = await apiRequest("POST", "/api/hr/leaves/provision-journal", { replace, year: stats?.year });
      return res.json();
    },
    onSuccess: (r: any) => {
      toast({
        title: r?.replaced ? "تم استبدال قيد المخصص" : "تم إنشاء قيد المخصص",
        description: `${r?.entry?.entryNumber ?? ""} — ${arNum(Math.round(r?.liabilityAmount ?? 0))} ر.س لـ ${arNum(r?.liabilityEmployees ?? 0)} موظف (مسودة في دفتر اليومية)`,
      });
    },
    onError: (e: any) => {
      const msg = e?.message || "فشل إنشاء القيد";
      if (msg.includes("409") || msg.includes("مسبقاً")) {
        if (window.confirm(`${msg}\n\nهل تريد استبداله بقيد جديد بالقيمة الحالية؟`)) {
          provisionMutation.mutate(true);
          return;
        }
      } else {
        toast({ title: "خطأ", description: msg, variant: "destructive" });
      }
    },
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
      "المتبقي": balType === "annual" ? "— (الرصيد الصحيح في تبويب الرصيد الفعلي التلقائي)" : Number(b.remainingDays),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الأرصدة");
    XLSX.writeFile(wb, `leave_balances_${balYear}.xlsx`);
  };

  // تقرير شهري إداري شامل (متعدد الأوراق)
  const exportMonthlyReport = async () => {
    // بيانات الأرصدة قد لا تكون محمّلة إن لم يُفتح تبويب الأرصدة بعد
    let accrualData: any[] = accruals as any[];
    if (!accrualData.length) {
      try {
        accrualData = await (await apiRequest("GET", "/api/hr/leave-accrual")).json();
      } catch { accrualData = []; }
    }
    const month = filterMonth !== "all" ? filterMonth : new Date().toISOString().slice(0, 7);
    const monthLeaves = (leaves as any[]).filter(
      (l) => (l.startDate || "").slice(0, 7) <= month && (l.endDate || "").slice(0, 7) >= month
    );
    const wb = XLSX.utils.book_new();

    // ورقة 1: ملخص
    const summary = [
      { "البند": "الشهر", "القيمة": month },
      { "البند": "إجمالي طلبات الإجازة المتقاطعة مع الشهر", "القيمة": monthLeaves.length },
      { "البند": "المعتمدة", "القيمة": monthLeaves.filter((l) => l.status === "approved").length },
      { "البند": "قيد الموافقة", "القيمة": monthLeaves.filter((l) => l.status === "pending").length },
      { "البند": "المرفوضة", "القيمة": monthLeaves.filter((l) => l.status === "rejected").length },
      { "البند": "إجمالي أيام الإجازات المعتمدة", "القيمة": monthLeaves.filter((l) => l.status === "approved").reduce((s, l) => s + (Number(l.totalDays) || 0), 0) },
      { "البند": "المتأخرون عن العودة حالياً", "القيمة": (stats?.overdueReturns || []).length },
      { "البند": "تاريخ إصدار التقرير", "القيمة": new Date().toLocaleDateString("en-CA") },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "الملخص");

    // ورقة 2: إجازات الشهر
    const leavesRows = monthLeaves.map((l) => ({
      "الموظف": l.employeeName || "",
      "الوظيفة": l.employeeJob || "",
      "الفرع": l.branchName || "",
      "النوع": LEAVE_TYPE_LABELS[l.leaveType] || l.leaveType,
      "من": l.startDate,
      "إلى": l.endDate,
      "الأيام": Number(l.totalDays),
      "الحالة": LEAVE_STATUS_LABELS[l.status] || l.status,
      "المعتمد": l.reviewerName || "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leavesRows.length ? leavesRows : [{ "ملاحظة": "لا توجد إجازات خلال الشهر" }]), "إجازات الشهر");

    // ورقة 3: المتأخرون عن العودة
    const overdueRows = (stats?.overdueReturns || []).map((m: any) => ({
      "الموظف": m.employeeName || "",
      "الوظيفة": m.jobTitle || "",
      "نوع الإجازة": LEAVE_TYPE_LABELS[m.leaveType] || m.leaveType,
      "نهاية الإجازة": m.endDate,
      "العودة المتوقعة": m.expectedReturn,
      "أيام التأخير": Number(m.lateDaysSoFar) || 0,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overdueRows.length ? overdueRows : [{ "ملاحظة": "لا يوجد متأخرون عن العودة" }]), "المتأخرون");

    // ورقة 4: أرصدة مرتفعة (التزام مالي)
    const highBalances = accrualData
      .filter((a) => Number(a.remainingDays) >= 30)
      .sort((a, b) => Number(b.remainingDays) - Number(a.remainingDays))
      .map((a) => ({
        "الموظف": a.employeeName || "",
        "الوظيفة": a.jobTitle || "",
        "الفرع": a.branchName || "",
        "الرصيد المتبقي (يوم)": Number(a.remainingDays),
      }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(highBalances.length ? highBalances : [{ "ملاحظة": "لا يوجد موظفون برصيد 30 يوماً فأكثر" }]), "أرصدة مرتفعة");

    XLSX.writeFile(wb, `leave_monthly_report_${month}.xlsx`);
    toast({ title: "تم تصدير التقرير الشهري", description: `4 أوراق: الملخص، إجازات ${month}، المتأخرون، الأرصدة المرتفعة` });
  };

  // تصدير كشف حساب الموظف إكسل
  const exportStatementExcel = () => {
    if (!statement) return;
    const wb = XLSX.utils.book_new();
    const emp = statement.employee || {};
    const info = [
      { "البند": "اسم الموظف", "القيمة": emp.employeeName || "" },
      { "البند": "الوظيفة", "القيمة": emp.jobTitle || "" },
      { "البند": "الفرع", "القيمة": emp.branchName || "" },
      { "البند": "تاريخ التعيين", "القيمة": emp.hireDate || "" },
      { "البند": "السنة", "القيمة": statement.year },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(info), "بيانات الموظف");
    const balRows = (statement.balances || []).filter((b: any) => !(b.leaveType === "sick" && !b.hasRow && Number(b.usedDays) === 0)).map((b: any) => {
      const acc = b.leaveType === "annual" && statement.accrual?.configured ? statement.accrual : null;
      if (acc) {
        return {
          "نوع الإجازة": `${LEAVE_TYPE_LABELS[b.leaveType]} (فعلي تلقائي)`,
          "المستحق السنوي حسب العقد": Number(acc.annualDays),
          "المرحّل": Number(acc.openingBalance),
          "تعديلات": 0,
          "المستخدم": Math.round((Number(acc.usedToDate) + Number(acc.upcomingDays) + Number(acc.settledDays)) * 100) / 100,
          "المتبقي": Number(acc.remainingDays),
        };
      }
      return {
      "نوع الإجازة": LEAVE_TYPE_LABELS[b.leaveType] || b.leaveType,
      "المستحق السنوي حسب العقد": Number(b.entitledDays),
      "المرحّل": Number(b.carriedOverDays),
      "تعديلات": Number(b.adjustmentDays),
      "المستخدم": Number(b.usedDays),
      "المتبقي": Number(b.remainingDays),
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(balRows.length ? balRows : [{ "ملاحظة": "لا أرصدة" }]), "الأرصدة");
    const movRows = (statement.movements || []).map((m: any) => ({
      "النوع": LEAVE_TYPE_LABELS[m.leaveType] || m.leaveType,
      "من": m.startDate,
      "إلى": m.endDate,
      "أيام ضمن السنة": Number(m.daysInYear),
      "الحالة": LEAVE_STATUS_LABELS[m.status] || m.status,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movRows.length ? movRows : [{ "ملاحظة": "لا حركات" }]), "الحركات");
    XLSX.writeFile(wb, `leave_statement_${emp.employeeName || stmtEmpId}_${statement.year}.xlsx`);
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

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="إجمالي الطلبات" value={stats?.total ?? 0} icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label="قيد المراجعة" value={stats?.pending ?? 0} icon={<Clock className="h-5 w-5" />} accent="amber" />
        <StatCard label="معتمدة" value={stats?.approved ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} accent="emerald" />
        <StatCard label="مرفوضة" value={stats?.rejected ?? 0} icon={<XCircle className="h-5 w-5" />} accent="red" />
        <StatCard label="في إجازة اليوم" value={stats?.onLeaveToday ?? 0} icon={<CalendarDays className="h-5 w-5" />} accent="blue" />
        <StatCard label="متأخرون عن العودة" value={stats?.overdueReturns?.length ?? 0} icon={<UserX className="h-5 w-5" />} accent="red" />
      </div>

      {/* تنبيه: موظفون تأخروا عن العودة من الإجازة */}
      {(stats?.overdueReturns?.length ?? 0) > 0 && (
        <Card className="border-red-300 bg-red-50/60" data-testid="card-overdue-returns">
          <CardContent className="pt-4 space-y-2">
            <div className="text-sm font-bold text-red-800 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              متأخرون عن العودة من الإجازة ({arNum(stats.overdueReturns.length)}) — يُسجَّل غيابهم تلقائياً يومياً
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {stats.overdueReturns.slice(0, 8).map((m: any) => (
                <div key={m.id} className="text-xs flex items-center justify-between gap-2 bg-white rounded p-2 border border-red-200" data-testid={`overdue-return-${m.id}`}>
                  <div>
                    <span className="font-medium">{m.employeeName}</span>
                    <span className="text-muted-foreground me-1"> — {LEAVE_TYPE_LABELS[m.leaveType] || m.leaveType}</span>
                    <span className="block text-[10px] text-red-600">كان متوقعاً عودته {fmtDate(m.expectedReturn)} — متأخر {arNum(m.lateDaysSoFar)} يوم</span>
                  </div>
                  <Button
                    size="sm" variant="outline" className="text-emerald-700 border-emerald-300 h-7 text-[11px] whitespace-nowrap"
                    onClick={() => { setReturnDate(new Date().toLocaleDateString("en-CA")); setReturnLeave(m); }}
                    data-testid={`button-overdue-return-${m.id}`}
                  >
                    <LogIn className="h-3 w-3 ms-1" />تسجيل المباشرة
                  </Button>
                </div>
              ))}
            </div>
            {(stats.overdueReturns.length > 8) && <div className="text-[10px] text-muted-foreground">+{arNum(stats.overdueReturns.length - 8)} آخرين — راجع تبويب لوحة المؤشرات</div>}
          </CardContent>
        </Card>
      )}

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
          <TabsTrigger value="dashboard" data-testid="tab-dashboard"><LayoutDashboard className="h-4 w-4 ms-1" />لوحة المؤشرات</TabsTrigger>
          <TabsTrigger value="balances" data-testid="tab-balances"><Wallet className="h-4 w-4 ms-1" />الأرصدة</TabsTrigger>
          <TabsTrigger value="calendar" data-testid="tab-calendar"><CalendarDays className="h-4 w-4 ms-1" />التقويم</TabsTrigger>
          <TabsTrigger value="holidays" data-testid="tab-holidays"><Sun className="h-4 w-4 ms-1" />العطلات الرسمية</TabsTrigger>
          <TabsTrigger value="plan" data-testid="tab-plan"><CalendarDays className="h-4 w-4 ms-1" />الخطة السنوية</TabsTrigger>
          <TabsTrigger value="docs" data-testid="tab-docs"><Paperclip className="h-4 w-4 ms-1" />المستندات</TabsTrigger>
          <TabsTrigger value="settlements" data-testid="tab-settlements"><Banknote className="h-4 w-4 ms-1" />كشف الحساب والتصفيات</TabsTrigger>
        </TabsList>

        {/* ---------- DASHBOARD TAB ---------- */}
        <TabsContent value="dashboard">
          <div className="space-y-4">
            {/* المؤشرات المالية */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="border-amber-200 bg-gradient-to-bl from-amber-50 to-white" data-testid="card-fin-liability">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">الالتزام المالي لأرصدة الإجازات السنوية {stats?.year ?? ""}</div>
                      <div className="text-2xl font-bold text-amber-700 tabular-nums" data-testid="text-liability-amount">
                        {arNum(Math.round(stats?.financial?.liabilityAmount ?? 0))} <span className="text-sm font-normal">ر.س</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {arNum(stats?.financial?.liabilityDays ?? 0)} يوم متبقٍ لـ {arNum(stats?.financial?.liabilityEmployees ?? 0)} موظف — بدل اليوم = الراتب ÷ 30
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 text-xs text-amber-700 border-amber-300"
                        disabled={provisionMutation.isPending || !(stats?.financial?.liabilityAmount > 0)}
                        onClick={() => {
                          if (window.confirm(`سيتم إنشاء قيد محاسبي (مسودة) بمخصص الإجازات السنوية لسنة ${stats?.year}: مدين "مصروف مخصص الإجازات 5210" / دائن "مخصص الإجازات المستحقة 2310" بمبلغ ${arNum(Math.round(stats?.financial?.liabilityAmount ?? 0))} ر.س تقريباً. متابعة؟`)) {
                            provisionMutation.mutate(false);
                          }
                        }}
                        data-testid="button-provision-journal"
                      >
                        {provisionMutation.isPending ? "جارٍ الإنشاء..." : "إنشاء قيد المخصص"}
                      </Button>
                    </div>
                    <Coins className="h-8 w-8 text-amber-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-emerald-200 bg-gradient-to-bl from-emerald-50 to-white" data-testid="card-fin-settlements">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">تصفيات الأرصدة المدفوعة {stats?.year ?? ""}</div>
                      <div className="text-2xl font-bold text-emerald-700 tabular-nums" data-testid="text-settlements-ytd">
                        {arNum(Math.round(stats?.financial?.settlementsYtd ?? 0))} <span className="text-sm font-normal">ر.س</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {arNum(stats?.financial?.settlementsCount ?? 0)} تصفية / {arNum(stats?.financial?.settlementsYtdDays ?? 0)} يوم مُصفّى
                      </div>
                    </div>
                    <Banknote className="h-8 w-8 text-emerald-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-gradient-to-bl from-red-50 to-white" data-testid="card-fin-late">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">مباشرات متأخرة مسجّلة {stats?.year ?? ""}</div>
                      <div className="text-2xl font-bold text-red-700 tabular-nums" data-testid="text-late-returns">
                        {arNum(stats?.financial?.lateReturnsCount ?? 0)} <span className="text-sm font-normal">موظف</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        إجمالي أيام التأخير المخصومة غياباً: {arNum(stats?.financial?.lateDaysYtd ?? 0)} يوم
                      </div>
                    </div>
                    <UserX className="h-8 w-8 text-red-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* تنبيه الأرصدة المرتفعة */}
            {highAccrualEmployees.length > 0 && (
              <Card className="border-orange-300 bg-orange-50/50" data-testid="card-high-balances">
                <CardContent className="pt-4 space-y-2">
                  <div className="text-sm font-bold text-orange-800 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    موظفون برصيد إجازات مرتفع — {arNum(highAccrualEmployees.length)} موظف تجاوز رصيده ٣٠ يوماً
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    الأرصدة المتراكمة التزام مالي على الشركة — يُنصح بجدولة إجازاتهم أو تصفية جزء من الرصيد.
                  </div>
                  <div className="overflow-auto border rounded-lg bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-orange-100/60">
                        <tr>
                          <th className="text-right p-2 whitespace-nowrap">الموظف</th>
                          <th className="text-right p-2 whitespace-nowrap">الفرع</th>
                          <th className="text-center p-2 whitespace-nowrap">الرصيد المتبقي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {highAccrualEmployees.slice(0, 10).map((a: any) => (
                          <tr key={a.branchEmployeeId} className="border-t" data-testid={`row-high-balance-${a.branchEmployeeId}`}>
                            <td className="p-2">
                              <div className="font-medium">{a.employeeName}</div>
                              <div className="text-xs text-muted-foreground">{a.jobTitle}</div>
                            </td>
                            <td className="p-2 text-xs">{a.branchName}</td>
                            <td className="p-2 text-center">
                              <Badge className={Number(a.remainingDays) >= 45 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}>
                                {arNum(a.remainingDays)} يوم
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {highAccrualEmployees.length > 10 && (
                    <div className="text-[11px] text-muted-foreground text-center">
                      +{arNum(highAccrualEmployees.length - 10)} آخرون — راجع تبويب الأرصدة لعرض القائمة كاملة
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* الرسوم البيانية */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card data-testid="card-chart-monthly">
                <CardContent className="pt-4">
                  <div className="text-sm font-bold mb-2 flex items-center gap-1">
                    <CalendarDays className="h-4 w-4 text-blue-600" />أيام الإجازات المعتمدة شهرياً — {stats?.year ?? ""}
                  </div>
                  <div style={{ direction: "ltr" }}>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={(stats?.byMonthDays ?? []).map((v: number, i: number) => ({ name: MONTHS_AR[i], أيام: v }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: "Cairo" }} interval={0} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={28} />
                        <ChartTooltip contentStyle={{ fontFamily: "Cairo", fontSize: 12, direction: "rtl" }} />
                        <Bar dataKey="أيام" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-chart-types">
                <CardContent className="pt-4">
                  <div className="text-sm font-bold mb-2 flex items-center gap-1">
                    <FileText className="h-4 w-4 text-amber-600" />توزيع الطلبات حسب النوع
                  </div>
                  <div style={{ direction: "ltr" }}>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={Object.entries(stats?.byType ?? {}).map(([k, v]) => ({ name: LEAVE_TYPE_LABELS[k] || k, value: v as number }))}
                          dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45}
                          label={({ value }: any) => arNum(value)}
                        >
                          {Object.keys(stats?.byType ?? {}).map((k, i) => (
                            <Cell key={k} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend wrapperStyle={{ fontFamily: "Cairo", fontSize: 11 }} />
                        <ChartTooltip contentStyle={{ fontFamily: "Cairo", fontSize: 12, direction: "rtl" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* جدول المتأخرين الكامل */}
            {(stats?.overdueReturns?.length ?? 0) > 0 && (
              <Card data-testid="card-overdue-table">
                <CardContent className="pt-4">
                  <div className="text-sm font-bold mb-2 flex items-center gap-1 text-red-800">
                    <AlertTriangle className="h-4 w-4" />جميع المتأخرين عن العودة ({arNum(stats.overdueReturns.length)})
                  </div>
                  <div className="overflow-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-red-50">
                        <tr>
                          <th className="text-right p-2 whitespace-nowrap">الموظف</th>
                          <th className="text-center p-2 whitespace-nowrap">نوع الإجازة</th>
                          <th className="text-center p-2 whitespace-nowrap">نهاية الإجازة</th>
                          <th className="text-center p-2 whitespace-nowrap">العودة المتوقعة</th>
                          <th className="text-center p-2 whitespace-nowrap">أيام التأخير</th>
                          <th className="text-center p-2 whitespace-nowrap">إجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.overdueReturns.map((m: any) => (
                          <tr key={m.id} className="border-t" data-testid={`row-overdue-${m.id}`}>
                            <td className="p-2">
                              <div className="font-medium">{m.employeeName}</div>
                              <div className="text-xs text-muted-foreground">{m.jobTitle}</div>
                            </td>
                            <td className="p-2 text-center">{LEAVE_TYPE_LABELS[m.leaveType] || m.leaveType}</td>
                            <td className="p-2 text-xs text-center">{fmtDate(m.endDate)}</td>
                            <td className="p-2 text-xs text-center">{fmtDate(m.expectedReturn)}</td>
                            <td className="p-2 text-center"><Badge className="bg-red-100 text-red-700">{arNum(m.lateDaysSoFar)} يوم</Badge></td>
                            <td className="p-2 text-center">
                              <Button
                                size="sm" variant="outline" className="text-emerald-700 border-emerald-300 h-7 text-[11px]"
                                onClick={() => { setReturnDate(new Date().toLocaleDateString("en-CA")); setReturnLeave(m); }}
                                data-testid={`button-table-return-${m.id}`}
                              >
                                <LogIn className="h-3 w-3 ms-1" />تسجيل المباشرة
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ---------- REQUESTS TAB ---------- */}
        <TabsContent value="requests">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
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
                <Select value={filterBranch} onValueChange={setFilterBranch}>
                  <SelectTrigger data-testid="select-filter-branch"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الفروع</SelectItem>
                    {branchOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger data-testid="select-filter-month"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الشهور</SelectItem>
                    {monthOptions.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={exportLeavesExcel} data-testid="button-export-leaves">
                  <FileSpreadsheet className="h-4 w-4 ms-1" />تصدير Excel
                </Button>
                <Button variant="outline" className="text-emerald-700 border-emerald-300" onClick={exportMonthlyReport} data-testid="button-export-monthly-report">
                  <FileSpreadsheet className="h-4 w-4 ms-1" />التقرير الشهري الشامل
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
                      <th className="text-right p-2 whitespace-nowrap">الموظف</th>
                      <th className="text-center p-2 whitespace-nowrap">النوع</th>
                      <th className="text-right p-2 whitespace-nowrap">من - إلى</th>
                      <th className="text-center p-2 whitespace-nowrap">الأيام</th>
                      <th className="text-center p-2 whitespace-nowrap">الحالة</th>
                      <th className="text-right p-2 whitespace-nowrap">المراجع</th>
                      <th className="text-center p-2 whitespace-nowrap">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">جاري التحميل...</td></tr>}
                    {!isLoading && filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا توجد طلبات</td></tr>}
                    {filtered.slice(0, reqShown).map((l: any) => (
                      <tr key={l.id} className="border-t hover:bg-slate-50" data-testid={`row-leave-${l.id}`}>
                        <td className="p-2">
                          <div className="font-medium flex items-center gap-1">
                            {l.employeeName || "-"}
                            {l.attachmentUrl && <a href={l.attachmentUrl} target="_blank" rel="noreferrer" title="مرفق"><Paperclip className="h-3 w-3 text-blue-500" /></a>}
                          </div>
                          <div className="text-xs text-muted-foreground">{l.employeeJob || ""}</div>
                        </td>
                        <td className="p-2 text-center">{LEAVE_TYPE_LABELS[l.leaveType] || l.leaveType}</td>
                        <td className="p-2 text-xs">
                          {l.startDate} → {l.endDate}
                          {l.status === "approved" && (
                            <span className="block text-[10px] text-emerald-600" data-testid={`text-return-date-${l.id}`}>
                              العودة للعمل: {fmtDate((() => { const d = new Date(l.endDate + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })())}
                            </span>
                          )}
                          <span className="flex flex-wrap gap-1 mt-0.5">
                            {l.exitConfirmedAt && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-sky-300 text-sky-700" data-testid={`badge-exit-${l.id}`}>
                                خرج {fmtDate(l.actualExitDate)}
                              </Badge>
                            )}
                            {l.returnConfirmedAt && (
                              l.returnStatus === "late" ? (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-300 text-red-700" data-testid={`badge-return-${l.id}`}>
                                  باشر متأخراً {arNum(l.lateDays)} يوم
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-300 text-emerald-700" data-testid={`badge-return-${l.id}`}>
                                  باشر {fmtDate(l.actualReturnDate)}
                                </Badge>
                              )
                            )}
                            {l.settlementId && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-300 text-amber-700" data-testid={`badge-settlement-${l.id}`}>
                                مُصفّى {arNum(l.settlementDays)} يوم / {arNum(l.settlementAmount)} ر.س
                              </Badge>
                            )}
                          </span>
                        </td>
                        <td className="p-2 text-center tabular-nums">
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
                        <td className="p-2 text-center">{statusBadge(l.status)}</td>
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
                          <div className="flex gap-1 items-center justify-center flex-nowrap">
                            {l.status === "pending" && (
                              <>
                                <Button size="sm" variant="ghost" className="text-emerald-600" title="اعتماد" onClick={() => { setAllowOver(false); setReviewing({ id: l.id, decision: "approved", leave: l }); }} data-testid={`button-approve-${l.id}`}>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-red-600" title="رفض" onClick={() => setReviewing({ id: l.id, decision: "rejected", leave: l })} data-testid={`button-reject-${l.id}`}>
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            {l.status === "approved" && !l.returnConfirmedAt && (
                              <Button size="sm" variant="ghost" className="text-emerald-700" title="تسجيل مباشرة العمل" onClick={() => { setReturnDate(new Date().toLocaleDateString("en-CA")); setReturnLeave(l); }} data-testid={`button-confirm-return-${l.id}`}>
                                <LogIn className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" title="المزيد من الإجراءات" data-testid={`button-more-${l.id}`}>
                                  <MoreHorizontal className="h-4 w-4 text-slate-500" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="text-sm">
                                {(l.status === "approved" || l.status === "pending") && (
                                  <DropdownMenuItem onClick={() => { setDatesForm({ startDate: l.startDate, endDate: l.endDate, note: "" }); setEditingDates(l); }} data-testid={`button-edit-dates-${l.id}`}>
                                    <Pencil className="h-3.5 w-3.5 ms-2 text-blue-600" />تعديل التواريخ
                                  </DropdownMenuItem>
                                )}
                                {l.status === "approved" && !l.exitConfirmedAt && (
                                  <DropdownMenuItem onClick={() => { setExitDate(l.startDate); setExitLeave(l); }} data-testid={`button-confirm-exit-${l.id}`}>
                                    <LogOut className="h-3.5 w-3.5 ms-2 text-sky-600" />تأكيد مباشرة الخروج
                                  </DropdownMenuItem>
                                )}
                                {canSettle && l.status === "approved" && l.leaveType === "annual" && (
                                  <DropdownMenuItem onClick={() => { setSettleForm({ days: "", useManual: false, manualAmount: "", note: "" }); setSettleLeave(l); }} data-testid={`button-settle-${l.id}`}>
                                    <Banknote className="h-3.5 w-3.5 ms-2 text-amber-600" />{l.settlementId ? "عرض/إلغاء التصفية" : "تصفية الرصيد (سند صرف)"}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => setPrintLeave(l)} data-testid={`button-print-${l.id}`}>
                                  <Printer className="h-3.5 w-3.5 ms-2 text-slate-600" />طباعة نموذج
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setStmtYear(Number(l.startDate?.slice(0, 4)) || currentYear); setStmtEmpId(l.branchEmployeeId); }} data-testid={`button-req-statement-${l.id}`}>
                                  <FileText className="h-3.5 w-3.5 ms-2 text-blue-600" />كشف حساب الإجازات
                                </DropdownMenuItem>
                                {((l.status === "approved" || l.status === "pending") || canDeleteLeave) && <DropdownMenuSeparator />}
                                {(l.status === "approved" || l.status === "pending") && (
                                  <DropdownMenuItem className="text-orange-600 focus:text-orange-700" onClick={() => { setCancelReason(""); setCancelling(l); }} data-testid={`button-cancel-${l.id}`}>
                                    <Ban className="h-3.5 w-3.5 ms-2" />إلغاء/سحب الطلب
                                  </DropdownMenuItem>
                                )}
                                {canDeleteLeave && (
                                  <DropdownMenuItem className="text-red-600 focus:text-red-700" onClick={() => { if (confirm("حذف هذا الطلب؟")) deleteMutation.mutate(l.id); }} data-testid={`button-delete-${l.id}`}>
                                    <Trash2 className="h-3.5 w-3.5 ms-2" />حذف الطلب
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length > reqShown && (
                <div className="text-center">
                  <Button variant="outline" size="sm" onClick={() => setReqShown((n) => n + 50)} data-testid="button-show-more-leaves">
                    عرض المزيد ({arNum(filtered.length - reqShown)} طلب متبقٍ)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- BALANCES TAB ---------- */}
        <TabsContent value="balances" className="space-y-4">
          <div className="flex rounded-lg border overflow-hidden w-fit" data-testid="switch-balance-view">
            <button
              className={`px-4 py-2 text-sm font-medium transition-colors ${balView === "accrual" ? "bg-amber-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              onClick={() => { setBalView("accrual"); setBalType("annual"); }}
              data-testid="button-view-accrual"
            >
              الرصيد الفعلي حتى اليوم (تلقائي)
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium transition-colors border-r ${balView === "yearly" ? "bg-slate-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              onClick={() => setBalView("yearly")}
              data-testid="button-view-yearly"
            >
              سجل السنوات (للترحيل والتعديل)
            </button>
          </div>
          {balView === "accrual" && balType === "annual" && (
            <Card className="border-amber-200">
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-bold text-amber-800 flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      الرصيد المستحق حتى تاريخه (حسب العقد)
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      يُحتسب يومياً من تاريخ الرصيد المرحل (أو تاريخ التعيين) × أيام العقد ÷ 365، وتُخصم منه الإجازات المعتمدة والأيام المصفّاة نقداً.
                    </div>
                  </div>
                  <Input
                    className="w-56"
                    placeholder="بحث بالاسم..."
                    value={accrualSearch}
                    onChange={(e) => setAccrualSearch(e.target.value)}
                    data-testid="input-accrual-search"
                  />
                </div>
                <div className="overflow-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-amber-50">
                      <tr>
                        <th className="text-right p-2 whitespace-nowrap">الموظف</th>
                        <th className="text-center p-2 whitespace-nowrap">أيام العقد/سنة</th>
                        <th className="text-center p-2 whitespace-nowrap">الرصيد المرحل</th>
                        <th className="text-center p-2 whitespace-nowrap">بداية الاحتساب</th>
                        <th className="text-center p-2 whitespace-nowrap">المستحق حتى اليوم</th>
                        <th className="text-center p-2 whitespace-nowrap">المستخدم</th>
                        <th className="text-center p-2 whitespace-nowrap">محجوز قادم</th>
                        <th className="text-center p-2 whitespace-nowrap">مصفّى</th>
                        <th className="text-center p-2 whitespace-nowrap">المتبقي</th>
                        <th className="p-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {accrualLoading && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">جاري التحميل...</td></tr>}
                      {!accrualLoading && accruals.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">لا يوجد موظفون</td></tr>}
                      {accruals
                        .filter((a: any) => !accrualSearch.trim() || (a.employeeName || "").includes(accrualSearch.trim()))
                        .slice(0, accrualShown)
                        .map((a: any) => (
                        <tr key={a.branchEmployeeId} className="border-t hover:bg-amber-50/40" data-testid={`row-accrual-${a.branchEmployeeId}`}>
                          <td className="p-2">
                            <div className="font-medium">{a.employeeName}</div>
                            <div className="text-xs text-muted-foreground">{a.jobTitle} • {a.branchName}</div>
                          </td>
                          <td className="p-2 text-center tabular-nums">
                            {arNum(a.annualDays)}
                            {a.annualDaysSource === "suggested" && <span className="text-[10px] text-amber-500 me-1">مقترح</span>}
                          </td>
                          <td className="p-2 text-center tabular-nums">{a.rawOpeningBalanceDate ? arNum(a.openingBalance) : "—"}</td>
                          <td className="p-2 text-center text-xs">
                            {a.accrualStart || "—"}
                            {a.accrualStart && !a.rawOpeningBalanceDate && <span className="text-[10px] text-slate-400 block">من تاريخ التعيين</span>}
                          </td>
                          <td className="p-2 text-center tabular-nums font-medium text-blue-700" data-testid={`text-accrued-${a.branchEmployeeId}`}>{a.accrualStart ? arNum(a.accruedToDate) : "—"}</td>
                          <td className="p-2 text-center tabular-nums">{arNum(a.usedToDate)}</td>
                          <td className="p-2 text-center tabular-nums">{arNum(a.upcomingDays)}</td>
                          <td className="p-2 text-center tabular-nums">{arNum(a.settledDays)}</td>
                          <td className={`p-2 text-center tabular-nums font-bold ${a.remainingDays < 0 ? "text-red-600" : "text-emerald-600"}`} data-testid={`text-accrual-remaining-${a.branchEmployeeId}`}>
                            {a.accrualStart ? arNum(a.remainingDays) : "—"}
                          </td>
                          <td className="p-2 text-center">
                            {canEditBalances && (
                              <Button size="sm" variant="ghost" onClick={() => openEditAccrual(a)} data-testid={`button-edit-accrual-${a.branchEmployeeId}`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(() => {
                  const cnt = accruals.filter((a: any) => !accrualSearch.trim() || (a.employeeName || "").includes(accrualSearch.trim())).length;
                  return cnt > accrualShown ? (
                    <div className="text-center">
                      <Button variant="outline" size="sm" onClick={() => setAccrualShown((n) => n + 50)} data-testid="button-show-more-accrual">
                        عرض المزيد ({arNum(cnt - accrualShown)} موظف متبقٍ)
                      </Button>
                    </div>
                  ) : null;
                })()}
              </CardContent>
            </Card>
          )}

          {balView === "yearly" && (
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div>
                <div className="font-bold text-slate-700 flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  سجل أرصدة السنوات
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  سجل يدوي لكل سنة على حدة — تستخدمه لترحيل رصيد سنة سابقة، أو تعديل رصيد موظف يدوياً، أو تصدير كشف السنة. أما "الرصيد الفعلي حتى اليوم" فيُحتسب تلقائياً من العقد ولا يحتاج إدخال يدوي.
                </div>
              </div>
              {balType === "annual" && (
                <div className="text-xs bg-amber-50 border border-amber-300 text-amber-800 rounded-lg p-3 leading-relaxed" data-testid="banner-yearly-annual-note">
                  <b>تنبيه — الإجازة السنوية تُدار بالنظام التلقائي:</b> الرصيد الصحيح المعتمد هو الظاهر في تبويب
                  {" "}
                  <button className="underline font-bold text-amber-900" onClick={() => { setBalView("accrual"); setBalType("annual"); }} data-testid="link-goto-accrual">
                    «الرصيد الفعلي حتى اليوم (تلقائي)»
                  </button>
                  . هذا السجل أرشيف يدوي فقط (ترحيل/تعديل)، لذلك لا يُعرض فيه "المتبقي" للسنوية حتى لا تختلط الأرقام.
                </div>
              )}
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
                {canEditBalances && <Button
                  variant="outline"
                  className="text-purple-700 border-purple-300"
                  disabled={carryoverMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`سيتم ترحيل الرصيد المتبقي لكل موظف من سنة ${balYear - 1} إلى خانة "المرحّل" في سنة ${balYear} (${LEAVE_TYPE_LABELS[balType] || balType}). إعادة التشغيل آمنة ولا تضاعف الأرصدة. متابعة؟`)) {
                      const capStr = window.prompt("سقف أيام الترحيل لكل موظف (اتركه فارغاً بدون سقف):", "");
                      if (capStr === null) return; // إلغاء
                      const cap = capStr.trim() === "" ? null : Number(capStr);
                      if (cap !== null && (!Number.isFinite(cap) || cap < 0)) {
                        toast({ title: "قيمة السقف غير صحيحة", variant: "destructive" });
                        return;
                      }
                      carryoverMutation.mutate(cap);
                    }
                  }}
                  data-testid="button-carryover-balances"
                >
                  <Wallet className="h-4 w-4 ms-1" />
                  {carryoverMutation.isPending ? "جارٍ الترحيل..." : `ترحيل أرصدة ${balYear - 1} ←`}
                </Button>}
                <Button variant="outline" className="text-blue-700 border-blue-300" onClick={() => setCalcOpen(true)} data-testid="button-open-calculator">
                  <Calculator className="h-4 w-4 ms-1" />حاسبة الرصيد المستحق
                </Button>
              </div>
              <div className="overflow-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-right p-2 whitespace-nowrap">الموظف</th>
                      <th className="text-right p-2 whitespace-nowrap">الفرع</th>
                      <th className="text-center p-2 whitespace-nowrap">المستحق</th>
                      <th className="text-center p-2 whitespace-nowrap">المرحّل</th>
                      <th className="text-center p-2 whitespace-nowrap">تعديل</th>
                      <th className="text-center p-2 whitespace-nowrap">المستخدم</th>
                      <th className="text-center p-2 whitespace-nowrap">المتبقي</th>
                      <th className="p-2 w-16"></th>
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
                        <td className="p-2 text-center tabular-nums">{arNum(b.entitledDays)}{!b.hasRow && <span className="text-[10px] text-amber-500 me-1">مقترح</span>}</td>
                        <td className="p-2 text-center tabular-nums">{arNum(b.carriedOverDays)}</td>
                        <td className="p-2 text-center tabular-nums">{arNum(b.adjustmentDays)}</td>
                        <td className="p-2 text-center tabular-nums">{arNum(b.usedDays)}</td>
                        <td className={`p-2 text-center tabular-nums font-bold ${b.remainingDays < 0 ? "text-red-600" : "text-emerald-600"}`} data-testid={`text-remaining-${b.branchEmployeeId}`}>
                          {balType === "annual" ? <span className="text-slate-400 font-normal" title="الرصيد الصحيح في تبويب الرصيد الفعلي حتى اليوم (تلقائي)">—</span> : arNum(b.remainingDays)}
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1 justify-center">
                            {canEditBalances && <Button size="sm" variant="ghost" onClick={() => openEditBal(b)} data-testid={`button-edit-balance-${b.branchEmployeeId}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>}
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
          )}
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
                      <th className="text-right p-2 whitespace-nowrap">العطلة</th>
                      <th className="text-right p-2 whitespace-nowrap">من - إلى</th>
                      <th className="text-center p-2 whitespace-nowrap">الأيام</th>
                      <th className="text-center p-2 whitespace-nowrap">الحالة</th>
                      <th className="text-center p-2 whitespace-nowrap">إجراءات</th>
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
                        <td className="p-2 text-center tabular-nums">{arNum(calcDays(h.startDate, h.endDate))}</td>
                        <td className="p-2 text-center">
                          {h.isActive
                            ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">مفعّلة</Badge>
                            : <Badge variant="secondary">موقوفة</Badge>}
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1 justify-center">
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

        {/* ---------- ANNUAL PLAN TAB ---------- */}
        <TabsContent value="plan">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={String(planYear)} onValueChange={(v) => setPlanYear(Number(v))}>
                    <SelectTrigger className="w-28" data-testid="select-plan-year"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={planBranch} onValueChange={setPlanBranch}>
                    <SelectTrigger className="w-44" data-testid="select-plan-branch"><SelectValue placeholder="كل الفروع" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الفروع</SelectItem>
                      {Array.from(new Map((planEntries as any[]).map((p) => [p.branchId, p.branchName || p.branchId])).entries()).map(([id, name]) => (
                        <SelectItem key={id} value={id as string}>{name as string}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {canEditBalances && (
                  <Button size="sm" onClick={() => { setEditPlan(null); setPlanForm({ branchEmployeeId: "", plannedStartDate: "", plannedEndDate: "", note: "" }); setPlanOpen(true); }} data-testid="button-add-plan">
                    <Plus className="h-4 w-4 ms-1" />إضافة إجازة مخططة
                  </Button>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                خطط إجازات موظفيك مقدماً على مستوى السنة. الصف الأحمر يعني تعارض: موظفان أو أكثر من نفس الفرع في إجازة بنفس الفترة. شارة ☀️ تعني أن الإجازة تتداخل مع موسم عطلة رسمية (ذروة عمل للمخبز).
              </div>

              {planAnalysis.overlapIds.size > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 flex items-center gap-1" data-testid="alert-plan-conflicts">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  يوجد {arNum(planAnalysis.overlapIds.size)} إجازة مخططة متعارضة (نفس الفرع ونفس الفترة) — راجع الصفوف المظللة بالأحمر وعدّل التواريخ.
                </div>
              )}

              {planLoading ? (
                <div className="p-8 text-center text-muted-foreground">جارٍ التحميل...</div>
              ) : (
                <div className="space-y-3">
                  {MONTHS_AR.map((monthName, mi) => {
                    const mm = String(mi + 1).padStart(2, "0");
                    const monthEntries = planAnalysis.visible.filter((p: any) => p.plannedStartDate.slice(5, 7) === mm);
                    if (monthEntries.length === 0) return null;
                    return (
                      <div key={mm} className="border rounded-lg overflow-hidden" data-testid={`plan-month-${mm}`}>
                        <div className="bg-slate-100 px-3 py-1.5 text-sm font-bold flex items-center justify-between">
                          <span>{monthName} {arNum(planYear)}</span>
                          <span className="text-xs font-normal text-muted-foreground">{arNum(monthEntries.length)} إجازة مخططة</span>
                        </div>
                        <table className="w-full text-sm">
                          <tbody>
                            {monthEntries.map((p: any) => {
                              const conflict = planAnalysis.overlapIds.has(p.id);
                              const nearHoliday = planAnalysis.holidayIds.has(p.id);
                              return (
                                <tr key={p.id} className={`border-t ${conflict ? "bg-red-50" : "hover:bg-slate-50"}`} data-testid={`row-plan-${p.id}`}>
                                  <td className="p-2">
                                    <div className="font-medium flex items-center gap-1">
                                      {p.employeeName}
                                      {conflict && <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
                                      {nearHoliday && <span title="تتداخل مع عطلة رسمية (موسم ذروة)">☀️</span>}
                                    </div>
                                    <div className="text-xs text-muted-foreground">{p.jobTitle} • {p.branchName}</div>
                                  </td>
                                  <td className="p-2 text-xs whitespace-nowrap">{p.plannedStartDate} → {p.plannedEndDate}</td>
                                  <td className="p-2 text-center tabular-nums whitespace-nowrap">{arNum(p.days)} يوم</td>
                                  <td className="p-2 text-center">
                                    {p.status === "converted"
                                      ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">تحوّلت لطلب</Badge>
                                      : <Badge variant="secondary">مخططة</Badge>}
                                  </td>
                                  <td className="p-2">
                                    {canEditBalances && (
                                      <div className="flex gap-1 justify-center">
                                        <Button size="sm" variant="ghost" title="تعديل"
                                          onClick={() => { setEditPlan(p); setPlanForm({ branchEmployeeId: String(p.branchEmployeeId), plannedStartDate: p.plannedStartDate, plannedEndDate: p.plannedEndDate, note: p.note || "" }); setPlanOpen(true); }}
                                          data-testid={`button-edit-plan-${p.id}`}>
                                          <Pencil className="h-3.5 w-3.5 text-blue-600" />
                                        </Button>
                                        <Button size="sm" variant="ghost" title="حذف"
                                          onClick={() => { if (confirm(`حذف الإجازة المخططة لـ ${p.employeeName}؟`)) deletePlanMutation.mutate(p.id); }}
                                          data-testid={`button-delete-plan-${p.id}`}>
                                          <Trash2 className="h-3.5 w-3.5 text-red-600" />
                                        </Button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                  {planAnalysis.visible.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground border rounded-lg">
                      لا توجد إجازات مخططة لسنة {arNum(planYear)} — ابدأ بإضافة مواعيد إجازات موظفيك المقترحة لتجنب تعارض المواعيد في المواسم.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- DOCUMENTS ARCHIVE TAB ---------- */}
        <TabsContent value="docs">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  className="w-56"
                  placeholder="بحث باسم الموظف..."
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  data-testid="input-doc-search"
                />
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="w-44" data-testid="select-doc-type"><SelectValue placeholder="كل الأنواع" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأنواع</SelectItem>
                    {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v as string}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground mr-auto" data-testid="text-docs-count">
                  {arNum(docsByEmployee.reduce((s, [, g]) => s + g.docs.length, 0))} مستند لـ {arNum(docsByEmployee.length)} موظف
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                كل المرفقات المرفوعة مع طلبات الإجازات (تقارير طبية، تذاكر سفر، مستندات...) مجمعة حسب الموظف في مكان واحد.
              </div>

              {docsLoading ? (
                <div className="p-8 text-center text-muted-foreground">جارٍ التحميل...</div>
              ) : docsByEmployee.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground border rounded-lg">
                  لا توجد مستندات مرفقة{docSearch || docType !== "all" ? " مطابقة للفلتر الحالي" : " — المرفقات تُضاف عند إنشاء طلب إجازة"}
                </div>
              ) : (
                <div className="space-y-3">
                  {docsByEmployee.map(([empId, g]) => (
                    <div key={empId} className="border rounded-lg overflow-hidden" data-testid={`docs-employee-${empId}`}>
                      <div className="bg-slate-100 px-3 py-1.5 flex items-center justify-between">
                        <div>
                          <span className="text-sm font-bold">{g.employeeName}</span>
                          <span className="text-xs text-muted-foreground mr-2">{g.jobTitle}{g.branchName ? ` • ${g.branchName}` : ""}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{arNum(g.docs.length)} مستند</span>
                      </div>
                      <table className="w-full text-sm">
                        <tbody>
                          {g.docs.map((l: any) => (
                            <tr key={l.id} className="border-t hover:bg-slate-50" data-testid={`row-doc-${l.id}`}>
                              <td className="p-2">
                                <div className="font-medium text-xs">{LEAVE_TYPE_LABELS[l.leaveType] || l.leaveType}</div>
                                <div className="text-xs text-muted-foreground">{l.startDate} → {l.endDate} ({arNum(l.totalDays)} يوم)</div>
                              </td>
                              <td className="p-2 text-center">{statusBadge(l.status)}</td>
                              <td className="p-2 text-center">
                                <a href={l.attachmentUrl} target="_blank" rel="noreferrer" data-testid={`link-doc-${l.id}`}>
                                  <Button size="sm" variant="outline" className="h-7 text-xs">
                                    <Paperclip className="h-3.5 w-3.5 ms-1" />عرض المستند
                                  </Button>
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- SETTLEMENTS TAB ---------- */}
        <TabsContent value="settlements">
          <div className="space-y-4">
            {/* بطاقات مؤشرات دورة التصفية — اضغط للفلترة */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {([
                { key: "all", label: "كل التصفيات", count: wfAllSettlements.length, cls: "border-slate-200 bg-slate-50 text-slate-700" },
                { key: "issued", label: "صادرة", count: wfCounts.issued, cls: "border-slate-300 bg-white text-slate-700" },
                { key: "awaiting_signature", label: "بانتظار التوقيع", count: wfCounts.awaiting_signature, cls: "border-amber-200 bg-amber-50 text-amber-800" },
                { key: "signed", label: "جاهزة للصرف", count: wfCounts.signed, cls: "border-blue-200 bg-blue-50 text-blue-800" },
                { key: "disbursed", label: "مصروفة", count: wfCounts.disbursed, cls: "border-emerald-200 bg-emerald-50 text-emerald-800", sub: `${arNum(Math.round(wfCounts.disbursedAmount))} ر.س` },
              ] as any[]).map((k) => (
                <button
                  key={k.key}
                  onClick={() => setWfStatus(k.key)}
                  className={`rounded-lg border p-2 text-center transition ${k.cls} ${wfStatus === k.key ? "ring-2 ring-primary" : "hover:opacity-80"}`}
                  data-testid={`card-wf-${k.key}`}
                >
                  <div className="text-xl font-bold tabular-nums">{arNum(k.count)}</div>
                  <div className="text-[11px]">{k.label}</div>
                  {k.sub && <div className="text-[10px] font-semibold">{k.sub}</div>}
                </button>
              ))}
            </div>

            {/* كشف حساب موظف */}
            <Card>
              <CardContent className="pt-4 space-y-2">
                <div className="text-sm font-bold flex items-center gap-1"><FileText className="h-4 w-4" />كشف حساب الإجازات لموظف</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={wfEmpId} onValueChange={setWfEmpId}>
                    <SelectTrigger className="w-64" data-testid="select-wf-employee"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الموظفين</SelectItem>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.employeeName} — {e.jobTitle}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={wfEmpId === "all"}
                    onClick={() => { setStmtYear(currentYear); setStmtEmpId(Number(wfEmpId)); }}
                    data-testid="button-open-statement"
                  >
                    <FileText className="h-4 w-4 ms-1" />عرض كشف الحساب
                  </Button>
                  <span className="text-xs text-muted-foreground">اختر موظفاً لعرض كشف حسابه التفصيلي، أو اترك «كل الموظفين» لعرض كل التصفيات أدناه.</span>
                </div>
              </CardContent>
            </Card>

            {/* إجازات معتمدة جاهزة للتصفية */}
            <Card className="border-amber-200">
              <CardContent className="pt-4 space-y-2">
                <div className="text-sm font-bold text-amber-800 flex items-center gap-1">
                  <Banknote className="h-4 w-4" />إجازات سنوية معتمدة بانتظار التصفية ({arNum(settleCandidates.length)})
                </div>
                {candLoading ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">جارٍ التحميل...</div>
                ) : settleCandidates.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm border rounded-lg">لا توجد إجازات معتمدة بحاجة إلى تصفية</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-amber-50 text-xs">
                        <th className="p-2 text-right">الموظف</th><th className="p-2 text-right">الفرع</th>
                        <th className="p-2 text-center">الفترة</th><th className="p-2 text-center">الأيام</th><th className="p-2 text-center">إجراء</th>
                      </tr></thead>
                      <tbody>
                        {settleCandidates.map((c: any) => (
                          <tr key={c.id} className="border-t" data-testid={`row-candidate-${c.id}`}>
                            <td className="p-2"><div className="font-medium">{c.employeeName}</div><div className="text-xs text-muted-foreground">{c.jobTitle}</div></td>
                            <td className="p-2 text-xs">{c.branchName || "—"}</td>
                            <td className="p-2 text-center text-xs"><Period start={c.startDate} end={c.endDate} /></td>
                            <td className="p-2 text-center tabular-nums">{arNum(c.totalDays)}</td>
                            <td className="p-2 text-center">
                              <Button size="sm" className="h-7 text-xs" onClick={() => { setSettleForm({ days: "", useManual: false, manualAmount: "", note: "" }); setSettleLeave(c); }} data-testid={`button-candidate-settle-${c.id}`}>
                                <Banknote className="h-3.5 w-3.5 ms-1" />تصفية الرصيد
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* سجل التصفيات ودورة العمل */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-bold flex items-center gap-1"><ListChecks className="h-4 w-4" />سجل التصفيات</div>
                  <Select value={wfStatus} onValueChange={setWfStatus}>
                    <SelectTrigger className="w-56" data-testid="select-wf-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الحالات</SelectItem>
                      <SelectItem value="issued">صادرة (لم تُحوّل للمالية)</SelectItem>
                      <SelectItem value="awaiting_signature">بانتظار توقيع الموظف</SelectItem>
                      <SelectItem value="signed">موقّعة — جاهزة للصرف</SelectItem>
                      <SelectItem value="disbursed">تصفيات مصروفة (الأرشيف)</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1 text-xs">
                    <span>من</span>
                    <Input type="date" className="w-36 h-8" value={wfFrom} onChange={(e) => setWfFrom(e.target.value)} data-testid="input-wf-from" />
                    <span>إلى</span>
                    <Input type="date" className="w-36 h-8" value={wfTo} onChange={(e) => setWfTo(e.target.value)} data-testid="input-wf-to" />
                  </div>
                  <div className="mr-auto flex items-center gap-2">
                    <span className="text-xs text-muted-foreground" data-testid="text-wf-count">{arNum(wfSettlements.length)} تصفية</span>
                    <Button size="sm" variant="outline" className="h-8 text-xs" disabled={wfSettlements.length === 0} onClick={exportSettlementsXlsx} data-testid="button-export-settlements">
                      <Download className="h-3.5 w-3.5 ms-1" />تصدير Excel
                    </Button>
                  </div>
                </div>

                {wfSettlements.length > 0 && (
                  <div className="text-xs bg-slate-50 border rounded p-2 text-slate-700" data-testid="text-wf-totals">
                    إجمالي القائمة الحالية: <b>{arNum(Math.round(wfSettlements.reduce((s: number, x: any) => s + (x.finalAmount || 0), 0)))} ر.س</b> عن {arNum(wfSettlements.reduce((s: number, x: any) => s + (x.settledDays || 0), 0))} يوم مُصفّى
                    {wfStatus === "disbursed" && <span className="text-emerald-700 font-semibold"> (مبالغ مصروفة فعلياً)</span>}
                  </div>
                )}

                {wfLoading ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">جارٍ التحميل...</div>
                ) : wfSettlements.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm border rounded-lg">لا توجد تصفيات مطابقة للفلتر الحالي</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-slate-100 text-xs">
                        <th className="p-2 text-right">الموظف</th>
                        <th className="p-2 text-center">فترة الإجازة</th>
                        <th className="p-2 text-center">الأيام</th>
                        <th className="p-2 text-center">المبلغ (ر.س)</th>
                        <th className="p-2 text-center">تاريخ التصفية</th>
                        <th className="p-2 text-center">الحالة</th>
                        <th className="p-2 text-center">إجراءات</th>
                      </tr></thead>
                      <tbody>
                        {wfSettlements.map((s: any) => {
                          const wfBadge = s.workflowStatus === "disbursed"
                            ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200" data-testid={`badge-wf-${s.id}`}>مصروفة</Badge>
                            : s.workflowStatus === "signed"
                            ? <Badge className="bg-blue-100 text-blue-800 border-blue-200" data-testid={`badge-wf-${s.id}`}>موقّعة — جاهزة للصرف</Badge>
                            : s.workflowStatus === "awaiting_signature"
                            ? <Badge className="bg-amber-100 text-amber-800 border-amber-200" data-testid={`badge-wf-${s.id}`}>بانتظار توقيع الموظف</Badge>
                            : <Badge variant="outline" data-testid={`badge-wf-${s.id}`}>صادرة</Badge>;
                          return (
                            <tr key={s.id} className="border-t hover:bg-slate-50" data-testid={`row-settlement-${s.id}`}>
                              <td className="p-2"><div className="font-medium">{s.employeeName}</div><div className="text-xs text-muted-foreground">{s.jobTitle}{s.branchName ? ` • ${s.branchName}` : ""}</div></td>
                              <td className="p-2 text-center text-xs">{s.leaveStart ? <Period start={s.leaveStart} end={s.leaveEnd} /> : "—"}</td>
                              <td className="p-2 text-center tabular-nums">{arNum(s.settledDays)}</td>
                              <td className="p-2 text-center tabular-nums font-semibold">{arNum(s.finalAmount)}</td>
                              <td className="p-2 text-center text-xs">{fmtDate(s.settlementDate)}</td>
                              <td className="p-2 text-center">{wfBadge}</td>
                              <td className="p-2 text-center">
                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                  {s.workflowStatus === "issued" && (
                                    <Button size="sm" variant="outline" className="h-7 text-xs text-amber-700 border-amber-300"
                                      disabled={sendFinanceMutation.isPending}
                                      onClick={() => {
                                        if (window.confirm(`سيتم تحويل التصفية للإدارة المالية وإشعار ${s.employeeName} للتوقيع والإقرار بالاستلام. متابعة؟`)) sendFinanceMutation.mutate(s.id);
                                      }}
                                      data-testid={`button-send-finance-${s.id}`}>
                                      <ArrowRight className="h-3.5 w-3.5 ms-1" />تحويل للمالية
                                    </Button>
                                  )}
                                  {s.workflowStatus === "signed" && (
                                    <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                                      onClick={() => { setDisburseNote(""); setDisbursing(s); }}
                                      data-testid={`button-disburse-${s.id}`}>
                                      <CheckCircle2 className="h-3.5 w-3.5 ms-1" />تأكيد الصرف
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => printSettlementDoc(s.id)} data-testid={`button-print-settlement-${s.id}`}>
                                    <Printer className="h-3.5 w-3.5 ms-1" />سند التصفية
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setStmtYear(Number(s.settlementDate?.slice(0, 4)) || currentYear); setStmtEmpId(s.branchEmployeeId); }} data-testid={`button-settlement-statement-${s.id}`}>
                                    <FileText className="h-3.5 w-3.5 ms-1" />كشف الحساب
                                  </Button>
                                  {s.workflowStatus !== "disbursed" && canEditBalances && (
                                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600"
                                      disabled={cancelSettlementMutation.isPending}
                                      onClick={() => {
                                        const reason = window.prompt(`سبب إلغاء تصفية ${s.employeeName}؟ (سيُعاد ${arNum(s.settledDays)} يوم لرصيده)`);
                                        if (reason && reason.trim().length >= 3) cancelSettlementMutation.mutate({ id: s.id, reason: reason.trim() });
                                        else if (reason !== null) toast({ title: "سبب الإلغاء مطلوب (3 أحرف على الأقل)", variant: "destructive" });
                                      }}
                                      data-testid={`button-cancel-settlement-${s.id}`}>
                                      <Ban className="h-3.5 w-3.5 ms-1" />إلغاء
                                    </Button>
                                  )}
                                </div>
                                {s.workflowStatus === "awaiting_signature" && <div className="text-[10px] text-muted-foreground mt-1">أُشعر الموظف — بانتظار توقيعه من بوابتي</div>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* تأكيد صرف تصفية */}
      <Dialog open={!!disbursing} onOpenChange={(o) => { if (!o) setDisbursing(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>تأكيد صرف التصفية</DialogTitle></DialogHeader>
          {disbursing && (
            <div className="space-y-3">
              <div className="bg-slate-50 rounded p-3 text-sm">
                <div className="font-semibold">{disbursing.employeeName}</div>
                <div className="text-xs text-muted-foreground">{arNum(disbursing.settledDays)} يوم × {arNum(disbursing.dailyRate)} ر.س</div>
                <div className="text-lg font-bold text-emerald-700 mt-1">{arNum(disbursing.finalAmount)} ر.س</div>
                {disbursing.signedAt && <div className="text-xs text-emerald-700 mt-1">وقّع الموظف وأقرّ بالاستلام بتاريخ {fmtDate(String(disbursing.signedAt).slice(0, 10))}</div>}
              </div>
              <div>
                <Label className="text-xs">ملاحظة الصرف (اختياري — مثل رقم الحوالة)</Label>
                <Input value={disburseNote} onChange={(e) => setDisburseNote(e.target.value)} placeholder="مثال: حوالة بنكية رقم 12345" data-testid="input-disburse-note" />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDisbursing(null)}>إلغاء</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={disburseMutation.isPending}
                  onClick={() => disburseMutation.mutate({ id: disbursing.id, note: disburseNote || undefined })}
                  data-testid="button-confirm-disburse">
                  {disburseMutation.isPending ? "جارٍ التأكيد..." : "تأكيد الصرف وحفظها في الأرشيف"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Plan entry dialog */}
      <Dialog open={planOpen} onOpenChange={(o) => { setPlanOpen(o); if (!o) setEditPlan(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>{editPlan ? "تعديل إجازة مخططة" : "إضافة إجازة مخططة"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الموظف</Label>
              <Select value={planForm.branchEmployeeId} onValueChange={(v) => setPlanForm({ ...planForm, branchEmployeeId: v })} disabled={!!editPlan}>
                <SelectTrigger data-testid="select-plan-employee"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.employeeName} — {e.jobTitle}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>من تاريخ</Label>
                <Input type="date" value={planForm.plannedStartDate} onChange={(e) => setPlanForm({ ...planForm, plannedStartDate: e.target.value, plannedEndDate: planForm.plannedEndDate || e.target.value })} data-testid="input-plan-start" />
              </div>
              <div>
                <Label>إلى تاريخ</Label>
                <Input type="date" value={planForm.plannedEndDate} onChange={(e) => setPlanForm({ ...planForm, plannedEndDate: e.target.value })} data-testid="input-plan-end" />
              </div>
            </div>
            {planForm.plannedStartDate && planForm.plannedEndDate && planForm.plannedEndDate >= planForm.plannedStartDate && (
              <div className="text-sm text-muted-foreground">عدد الأيام: <span className="font-bold tabular-nums">{arNum(calcDays(planForm.plannedStartDate, planForm.plannedEndDate))}</span></div>
            )}
            <div>
              <Label>ملاحظة (اختياري)</Label>
              <Input value={planForm.note} onChange={(e) => setPlanForm({ ...planForm, note: e.target.value })} placeholder="مثال: سفر عائلي" data-testid="input-plan-note" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPlanOpen(false); setEditPlan(null); }}>إلغاء</Button>
            <Button
              onClick={() => savePlanMutation.mutate(editPlan
                ? { plannedStartDate: planForm.plannedStartDate, plannedEndDate: planForm.plannedEndDate, note: planForm.note.trim() || null }
                : { branchEmployeeId: Number(planForm.branchEmployeeId), plannedStartDate: planForm.plannedStartDate, plannedEndDate: planForm.plannedEndDate, note: planForm.note.trim() || undefined })}
              disabled={savePlanMutation.isPending || (!editPlan && !planForm.branchEmployeeId) || !planForm.plannedStartDate || !planForm.plannedEndDate || planForm.plannedEndDate < planForm.plannedStartDate}
              data-testid="button-save-plan"
            >
              {savePlanMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            {form.branchEmployeeId && formHistory && (
              <div className="text-xs bg-slate-50 border rounded p-2 space-y-1" data-testid="box-form-history">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700">آخر إجازة للموظف</span>
                  {formHistory.lastApproved ? (
                    <span className="tabular-nums text-slate-700">
                      {LEAVE_TYPE_LABELS[formHistory.lastApproved.leaveType] || formHistory.lastApproved.leaveType} · {formHistory.lastApproved.startDate} → {formHistory.lastApproved.endDate}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">لا توجد إجازات سابقة معتمدة</span>
                  )}
                </div>
                {(formHistory.history || []).length > 0 && (
                  <details className="text-[10px]">
                    <summary className="cursor-pointer text-blue-700">عرض سجل الإجازات ({arNum((formHistory.history || []).length)})</summary>
                    <div className="mt-1 space-y-0.5">
                      {(formHistory.history || []).map((h: any) => (
                        <div key={h.id} className="flex justify-between border-b border-dashed border-slate-200 pb-0.5" data-testid={`row-form-history-${h.id}`}>
                          <span>{LEAVE_TYPE_LABELS[h.leaveType] || h.leaveType} ({LEAVE_STATUS_LABELS[h.status] || h.status})</span>
                          <span className="tabular-nums">{h.startDate} → {h.endDate} · {arNum(h.totalDays)} يوم</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
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
            {/* ملخص الطلب */}
            {reviewing && (
              <div className="text-xs bg-slate-50 border rounded p-2 flex flex-wrap gap-x-4 gap-y-1" data-testid="text-review-summary">
                <span><strong>{reviewing.leave?.employeeName}</strong></span>
                <span>{LEAVE_TYPE_LABELS[reviewing.leave?.leaveType] || reviewing.leave?.leaveType}</span>
                <span className="tabular-nums">{reviewing.leave?.startDate} ← {reviewing.leave?.endDate} ({arNum(reviewing.leave?.totalDays)} يوم)</span>
              </div>
            )}
            {/* بطاقة الرصيد */}
            {reviewing?.leave?.leaveType !== "unpaid" && reviewBalance && !reviewBalance.error && (
              <div className="grid grid-cols-3 gap-1 text-center text-xs" data-testid="text-review-balance">
                <div className="bg-blue-50 rounded p-1.5">
                  <div className="text-blue-500">المستحق</div>
                  <div className="font-bold tabular-nums">{arNum((reviewBalance.entitledDays || 0) + (reviewBalance.carriedOverDays || 0) + (reviewBalance.adjustmentDays || 0))}</div>
                </div>
                <div className="bg-amber-50 rounded p-1.5">
                  <div className="text-amber-600">المستخدم</div>
                  <div className="font-bold tabular-nums">{arNum(reviewBalance.usedDays)}</div>
                </div>
                <div className={`rounded p-1.5 ${(reviewBalance.remainingDays ?? 0) < (reviewing?.leave?.totalDays ?? 0) ? "bg-red-50" : "bg-emerald-50"}`}>
                  <div className={(reviewBalance.remainingDays ?? 0) < (reviewing?.leave?.totalDays ?? 0) ? "text-red-600" : "text-emerald-600"}>المتبقي</div>
                  <div className="font-bold tabular-nums">{arNum(reviewBalance.remainingDays)}</div>
                </div>
              </div>
            )}
            {/* تداخل مع عطلة رسمية */}
            {reviewHolidayOverlap.length > 0 && (
              <div className="text-xs bg-purple-50 text-purple-800 rounded p-2" data-testid="text-holiday-overlap">
                <span className="font-semibold">تنبيه موسم:</span> الفترة تتداخل مع {reviewHolidayOverlap.map((h: any) => h.name).join("، ")} — قد يكون الفرع بحاجة لكامل الطاقم.
              </div>
            )}
            {/* آخر إجازات الموظف */}
            {(reviewHistory?.history?.filter((h: any) => h.id !== reviewing?.id && h.status === "approved").length ?? 0) > 0 && (
              <div className="text-xs bg-slate-50 border rounded p-2 space-y-0.5" data-testid="text-review-history">
                <div className="font-semibold text-slate-600">آخر إجازات الموظف:</div>
                {reviewHistory.history
                  .filter((h: any) => h.id !== reviewing?.id && h.status === "approved")
                  .slice(0, 3)
                  .map((h: any) => (
                    <div key={h.id} className="flex justify-between text-slate-600">
                      <span>{LEAVE_TYPE_LABELS[h.leaveType] || h.leaveType}</span>
                      <span className="tabular-nums">{h.startDate} ← {h.endDate} ({arNum(h.totalDays)} يوم)</span>
                    </div>
                  ))}
              </div>
            )}
            {(reviewing?.leave?.requiredLevels ?? 0) > 1 && (
              <div className="text-xs bg-amber-50 text-amber-700 rounded p-2">
                هذا الطلب يتطلب {arNum(reviewing?.leave?.requiredLevels)} مستويات موافقة — أنت على المستوى {arNum(reviewing?.leave?.currentLevel)}.
              </div>
            )}
            {reviewing?.decision === "approved" && coverage && coverage.onLeaveCount > 0 && (
              <div className="text-xs bg-amber-50 text-amber-800 rounded p-2 space-y-1" data-testid="text-coverage-warning">
                <div className="font-semibold">
                  تنبيه تغطية الفرع: {arNum(coverage.onLeaveCount)} موظف آخر في إجازة متداخلة مع هذه الفترة
                  {coverage.totalActive > 0 && <> — سيغيب {arNum(coverage.absentIfApproved)} من {arNum(coverage.totalActive)} ({arNum(coverage.absencePercent)}٪)</>}
                </div>
                <ul className="list-disc pr-4">
                  {(coverage.overlapping || []).slice(0, 5).map((o: any, i: number) => (
                    <li key={i}>{o.employeeName} ({LEAVE_TYPE_LABELS[o.leaveType] || o.leaveType}): {o.startDate} ← {o.endDate}</li>
                  ))}
                </ul>
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

      {/* تعديل بيانات الاستحقاق التعاقدي */}
      <Dialog open={!!editAccrual} onOpenChange={(o) => { if (!o) setEditAccrual(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>بيانات استحقاق الإجازة — {editAccrual?.employeeName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>أيام الإجازة السنوية حسب العقد</Label>
              <Input
                type="number" inputMode="decimal" min={0} max={90}
                placeholder="مثال: 21 أو 30"
                value={accrualForm.annualLeaveDays}
                onChange={(e) => setAccrualForm({ ...accrualForm, annualLeaveDays: e.target.value })}
                data-testid="input-accrual-annual-days"
              />
              <div className="text-[11px] text-muted-foreground mt-1">
                اتركه فارغاً لاستخدام المقترح حسب الأقدمية (21 يوم، و30 بعد 5 سنوات خدمة).
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الرصيد المرحل (أيام)</Label>
                <Input
                  type="number" inputMode="decimal"
                  placeholder="مثال: 12.5"
                  value={accrualForm.leaveOpeningBalance}
                  onChange={(e) => setAccrualForm({ ...accrualForm, leaveOpeningBalance: e.target.value })}
                  data-testid="input-accrual-opening-balance"
                />
              </div>
              <div>
                <Label>حتى تاريخ</Label>
                <Input
                  type="date"
                  value={accrualForm.leaveOpeningBalanceDate}
                  onChange={(e) => setAccrualForm({ ...accrualForm, leaveOpeningBalanceDate: e.target.value })}
                  data-testid="input-accrual-opening-date"
                />
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              الرصيد المرحل هو رصيد الموظف المتجمّع حتى التاريخ المحدد — يبدأ النظام الاحتساب اليومي بعد هذا التاريخ. إن تُرك فارغاً يبدأ الاحتساب من تاريخ التعيين{editAccrual?.hireDate ? ` (${editAccrual.hireDate})` : ""}.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAccrual(null)}>إلغاء</Button>
            <Button
              onClick={() => accrualMutation.mutate({ employeeId: editAccrual.branchEmployeeId, ...accrualForm })}
              disabled={accrualMutation.isPending}
              data-testid="button-save-accrual"
            >
              {accrualMutation.isPending ? "..." : "حفظ"}
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
                    <div>الرقم المرجعي: <span className="font-bold text-black">LV-{(printLeave.startDate || "").slice(0, 4)}-{String(printLeave.id).padStart(4, "0")}</span></div>
                    <div>الفرع: <span className="font-bold text-black">{printLeave.branchName || "-"}</span></div>
                    <div>تاريخ الإصدار: <span className="font-bold text-black">{new Date().toLocaleDateString("ar-SA-u-nu-latn")}</span></div>
                  </div>
                </div>
                <div className="text-center mb-4">
                  <h3 className="inline-block text-lg font-bold px-8 py-1.5 rounded" style={{ backgroundColor: "#FBF3E0", color: "#8A6212" }}>
                    {printLeave.status === "approved" ? "قرار اعتماد إجازة" : "نموذج طلب إجازة"}
                  </h3>
                </div>
                {printLeave.status === "approved" && (
                  <p className="text-sm leading-7 text-justify mb-4 text-gray-800">
                    بناءً على طلب الموظف الموضحة بياناته أدناه، واستناداً إلى نظام العمل السعودي ولائحة تنظيم العمل الداخلية للشركة،
                    وبعد التحقق من رصيد الإجازات المستحق، فقد تقرر اعتماد منح الموظف <span className="font-bold">{printLeave.employeeName}</span> إجازة
                    {" "}<span className="font-bold">{LEAVE_TYPE_LABELS[printLeave.leaveType] || printLeave.leaveType}</span> لمدة
                    {" "}<span className="font-bold">{arNum(printLeave.totalDays)} يوماً</span>، تبدأ من تاريخ
                    {" "}<span className="font-bold">{printLeave.startDate}</span> وتنتهي بتاريخ
                    {" "}<span className="font-bold">{printLeave.endDate}</span>، على أن يباشر الموظف عمله في يوم العمل التالي لانتهائها مباشرة.
                  </p>
                )}
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
      {/* Entitlement calculator dialog */}
      <Dialog open={calcOpen} onOpenChange={setCalcOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-600" />
              حاسبة الرصيد المستحق
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الموظف</Label>
              <Select value={calcEmpId} onValueChange={setCalcEmpId}>
                <SelectTrigger data-testid="select-calc-employee"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.employeeName} — {e.jobTitle}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>نوع الإجازة</Label>
                <Select value={calcType} onValueChange={setCalcType}>
                  <SelectTrigger data-testid="select-calc-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEAVE_TYPE_LABELS).filter(([k]) => k !== "unpaid").map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>حتى تاريخ</Label>
                <Input type="date" value={calcAsOf} onChange={(e) => setCalcAsOf(e.target.value)} data-testid="input-calc-asof" />
              </div>
            </div>

            {calcResult?.error && (
              <div className="text-xs bg-red-50 text-red-700 rounded p-2">{calcResult.error}</div>
            )}
            {calcResult && !calcResult.error && (
              <div className="space-y-2" data-testid="box-calc-result">
                <div className="rounded-lg border bg-slate-50 p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">الموظف</span><span className="font-semibold">{calcResult.empName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">تاريخ التعيين</span><span className="font-semibold tabular-nums">{calcResult.hireDate || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">مدة الخدمة حتى {calcAsOf}</span><span className="font-semibold">{calcResult.serviceText}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">الاستحقاق السنوي ({LEAVE_TYPE_LABELS[calcType]})</span><span className="font-semibold tabular-nums">{arNum(calcType === "annual" && calcAccrual?.configured ? calcAccrual.annualDays : calcResult.entitled)} يوم</span></div>
                </div>
                {calcType === "annual" && calcAccrual?.configured ? (
                  <>
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs space-y-1" data-testid="box-calc-accrual">
                      <div className="font-bold text-amber-800 mb-1">الرصيد الفعلي حتى {calcAsOf} (تلقائي)</div>
                      <div className="flex justify-between"><span>الرصيد الافتتاحي {calcAccrual.accrualStart ? `(${calcAccrual.accrualStart})` : ""}</span><span className="font-semibold tabular-nums">{arNum(calcAccrual.openingBalance)} يوم</span></div>
                      <div className="flex justify-between"><span>+ المكتسب حتى التاريخ ({arNum(calcAccrual.elapsedDays)} يوم عمل × {arNum(calcAccrual.annualDays)}÷365)</span><span className="font-semibold tabular-nums" data-testid="text-calc-accrual-accrued">{arNum(Math.round((calcAccrual.accruedToDate - calcAccrual.openingBalance) * 100) / 100)} يوم</span></div>
                      <div className="flex justify-between"><span>− الإجازات السنوية المعتمدة المنقضية</span><span className="font-semibold tabular-nums text-red-600">{arNum(calcAccrual.usedToDate)} يوم</span></div>
                      {Number(calcAccrual.upcomingDays) > 0 && (
                        <div className="flex justify-between"><span>− إجازات معتمدة قادمة (محجوزة)</span><span className="font-semibold tabular-nums text-red-600">{arNum(calcAccrual.upcomingDays)} يوم</span></div>
                      )}
                      {Number(calcAccrual.settledDays) > 0 && (
                        <div className="flex justify-between"><span>− أيام مصفّاة نقداً</span><span className="font-semibold tabular-nums text-red-600">{arNum(calcAccrual.settledDays)} يوم</span></div>
                      )}
                      <div className="flex justify-between border-t border-amber-300 pt-1 mt-1">
                        <span className="font-bold">الرصيد المتبقي الفعلي</span>
                        <span className={`font-bold tabular-nums ${calcAccrual.remainingDays < 0 ? "text-red-600" : "text-emerald-700"}`} data-testid="text-calc-accrual-remaining">{arNum(calcAccrual.remainingDays)} يوم</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground leading-relaxed">
                      هذا هو نفس الرقم الظاهر في تبويب الأرصدة — «الرصيد الفعلي حتى اليوم (تلقائي)» — ويُحسب من الرصيد الافتتاحي المُدخل مضافاً إليه الاكتساب اليومي ومخصوماً منه الإجازات السنوية المعتمدة والتصفيات النقدية.
                    </div>
                  </>
                ) : (
                <>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs space-y-1">
                  <div className="font-bold text-blue-800 mb-1">الرصيد المتراكم حتى {calcAsOf}</div>
                  <div className="flex justify-between"><span>المستحق تراكمياً (نسبة وتناسب)</span><span className="font-semibold tabular-nums" data-testid="text-calc-accrued">{arNum(calcResult.accrued)} يوم</span></div>
                  <div className="flex justify-between"><span>+ المرحّل من سنوات سابقة</span><span className="font-semibold tabular-nums">{arNum(calcResult.carried)} يوم</span></div>
                  <div className="flex justify-between"><span>+ تعديلات يدوية</span><span className="font-semibold tabular-nums">{arNum(calcResult.adjust)} يوم</span></div>
                  <div className="flex justify-between"><span>− المستخدم خلال {calcYear}</span><span className="font-semibold tabular-nums text-red-600">{arNum(calcResult.used)} يوم</span></div>
                  <div className="flex justify-between border-t border-blue-200 pt-1 mt-1">
                    <span className="font-bold">الصافي المتراكم المستحق الآن</span>
                    <span className={`font-bold tabular-nums ${calcResult.accruedNet < 0 ? "text-red-600" : "text-emerald-700"}`} data-testid="text-calc-net">{arNum(calcResult.accruedNet)} يوم</span>
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs flex justify-between">
                  <span className="font-semibold text-emerald-800">الرصيد المتبقي على أساس السنة كاملة</span>
                  <span className="font-bold tabular-nums text-emerald-700" data-testid="text-calc-fullyear">{arNum(calcResult.fullYearRemaining)} يوم</span>
                </div>
                <div className="text-[10px] text-muted-foreground leading-relaxed">
                  المستحق التراكمي يُحسب نسبةً من الاستحقاق السنوي بعدد الأيام المنقضية من بداية السنة (أو من تاريخ التعيين إن كان خلالها) حتى التاريخ المختار. الاستحقاق السنوي حسب نظام العمل: 21 يومًا، ويصبح 30 يومًا بعد إتمام 5 سنوات خدمة.
                </div>
                </>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setStmtYear(calcYear); setStmtEmpId(Number(calcEmpId)); }} data-testid="button-calc-to-statement">
                    <FileText className="h-3.5 w-3.5 ms-1" />عرض كشف الحساب الكامل
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCalcOpen(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تأكيد مباشرة الخروج */}
      <Dialog open={!!exitLeave} onOpenChange={(o) => { if (!o) setExitLeave(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><LogOut className="h-5 w-5 text-sky-600" />تأكيد مباشرة الخروج للإجازة</DialogTitle></DialogHeader>
          {exitLeave && (
            <div className="space-y-3">
              <div className="text-sm bg-slate-50 rounded p-2">
                <div className="font-semibold">{exitLeave.employeeName}</div>
                <div className="text-xs text-muted-foreground">{LEAVE_TYPE_LABELS[exitLeave.leaveType] || exitLeave.leaveType} · {exitLeave.startDate} → {exitLeave.endDate}</div>
              </div>
              <div>
                <Label>تاريخ الخروج الفعلي</Label>
                <Input type="date" value={exitDate} onChange={(e) => setExitDate(e.target.value)} data-testid="input-exit-date" />
              </div>
              <div className="text-xs text-muted-foreground">
                موعد العودة المتوقع: <span className="font-bold">{fmtDate((() => { const d = new Date(exitLeave.endDate + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })())}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExitLeave(null)}>إلغاء</Button>
            <Button
              onClick={() => confirmExitMutation.mutate({ id: exitLeave.id, actualExitDate: exitDate })}
              disabled={confirmExitMutation.isPending || !exitDate}
              data-testid="button-save-exit"
            >
              {confirmExitMutation.isPending ? "جارٍ الحفظ..." : "تأكيد الخروج"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تسجيل مباشرة العمل (العودة) */}
      <Dialog open={!!returnLeave} onOpenChange={(o) => { if (!o) setReturnLeave(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><LogIn className="h-5 w-5 text-emerald-700" />تسجيل مباشرة العمل</DialogTitle></DialogHeader>
          {returnLeave && (() => {
            const expected = (() => { const d = new Date(returnLeave.endDate + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
            const late = returnDate && returnDate > expected ? Math.round((new Date(returnDate + "T00:00:00Z").getTime() - new Date(expected + "T00:00:00Z").getTime()) / 86400000) : 0;
            return (
              <div className="space-y-3">
                <div className="text-sm bg-slate-50 rounded p-2">
                  <div className="font-semibold">{returnLeave.employeeName}</div>
                  <div className="text-xs text-muted-foreground">{LEAVE_TYPE_LABELS[returnLeave.leaveType] || returnLeave.leaveType} · {returnLeave.startDate} → {returnLeave.endDate}</div>
                  <div className="text-xs mt-1">موعد العودة المتوقع: <span className="font-bold">{expected}</span></div>
                </div>
                <div>
                  <Label>تاريخ المباشرة الفعلي</Label>
                  <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} data-testid="input-return-date" />
                </div>
                {late > 0 && (
                  <div className="text-xs bg-red-50 text-red-700 rounded p-2 flex items-start gap-1.5" data-testid="text-late-warning">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>الموظف متأخر <b>{arNum(late)}</b> يوم عن موعد العودة — ستُسجَّل أيام التأخير <b>غياباً بدون أجر</b> تلقائياً في سجل الحضور.</span>
                  </div>
                )}
                {returnDate && returnDate <= expected && (
                  <div className="text-xs bg-emerald-50 text-emerald-700 rounded p-2" data-testid="text-ontime-note">
                    ✓ عودة في الموعد — لن تُسجَّل أي غيابات.
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnLeave(null)}>إلغاء</Button>
            <Button
              onClick={() => confirmReturnMutation.mutate({ id: returnLeave.id, actualReturnDate: returnDate })}
              disabled={confirmReturnMutation.isPending || !returnDate}
              data-testid="button-save-return"
            >
              {confirmReturnMutation.isPending ? "جارٍ الحفظ..." : "تسجيل المباشرة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تصفية رصيد الإجازة السنوية */}
      <Dialog open={!!settleLeave} onOpenChange={(o) => { if (!o) setSettleLeave(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto" dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Banknote className="h-5 w-5 text-amber-600" />تصفية رصيد الإجازة السنوية</DialogTitle></DialogHeader>
          {settleLeave && settlePreviewLoading && <div className="text-center py-6 text-sm text-muted-foreground">جارٍ تحميل المعاينة...</div>}
          {settleLeave && !settlePreviewLoading && settlePreview && (() => {
            const p = settlePreview;
            if (p.alreadySettled && p.settlement) {
              return (
                <div className="space-y-3">
                  <div className="text-sm bg-amber-50 rounded p-3 space-y-1" data-testid="box-existing-settlement">
                    <div className="font-semibold text-amber-800">توجد تصفية سارية لهذا الطلب</div>
                    <div className="text-xs">الأيام: <b>{arNum(p.settlement.settledDays)}</b> · المبلغ: <b>{arNum(p.settlement.finalAmount)}</b> ر.س · قيمة اليوم: {arNum(p.settlement.dailyRate)} ر.س</div>
                    {p.settlement.note && <div className="text-xs text-muted-foreground">ملاحظة: {p.settlement.note}</div>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setReceiptSettlement({ ...p.settlement, employeeName: settleLeave.employeeName })} data-testid="button-reprint-receipt">
                      <Printer className="h-4 w-4 ms-1" />طباعة سند الصرف
                    </Button>
                    <Button
                      variant="destructive" className="flex-1"
                      onClick={() => { if (confirm("سيتم إلغاء التصفية وإعادة الأيام إلى رصيد الموظف. متابعة؟")) cancelSettlementMutation.mutate({ id: p.settlement.id, reason: "إلغاء من شاشة الإجازات" }); }}
                      disabled={cancelSettlementMutation.isPending}
                      data-testid="button-cancel-settlement"
                    >
                      {cancelSettlementMutation.isPending ? "جارٍ الإلغاء..." : "إلغاء التصفية"}
                    </Button>
                  </div>
                </div>
              );
            }
            const remainingDays = Number(p.balance?.remainingDays ?? 0);
            const days = settleForm.days !== "" ? Number(settleForm.days) : Number(p.suggestedDays || 0);
            const autoAmount = Math.round(days * Number(p.dailyRate || 0) * 100) / 100;
            const finalAmount = settleForm.useManual && settleForm.manualAmount !== "" ? Number(settleForm.manualAmount) : autoAmount;
            return (
              <div className="space-y-3">
                <div className="text-sm bg-slate-50 rounded p-2">
                  <div className="font-semibold">{settleLeave.employeeName}</div>
                  <div className="text-xs text-muted-foreground">إجازة سنوية · {settleLeave.startDate} → {settleLeave.endDate}</div>
                </div>
                {settleHistory && (
                  <div className="text-xs bg-slate-50 border rounded p-2 space-y-1" data-testid="box-settle-history">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-700">آخر إجازة للموظف</span>
                      {settleHistory.lastApproved ? (
                        <span className="tabular-nums text-slate-700">
                          {LEAVE_TYPE_LABELS[settleHistory.lastApproved.leaveType] || settleHistory.lastApproved.leaveType} · {settleHistory.lastApproved.startDate} → {settleHistory.lastApproved.endDate}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">لا توجد إجازات سابقة معتمدة</span>
                      )}
                    </div>
                    {(settleHistory.history || []).length > 0 && (
                      <details className="text-[10px]">
                        <summary className="cursor-pointer text-blue-700">عرض سجل الإجازات ({arNum((settleHistory.history || []).length)})</summary>
                        <div className="mt-1 space-y-0.5">
                          {(settleHistory.history || []).map((h: any) => (
                            <div key={h.id} className="flex justify-between border-b border-dashed border-slate-200 pb-0.5" data-testid={`row-settle-history-${h.id}`}>
                              <span>{LEAVE_TYPE_LABELS[h.leaveType] || h.leaveType} ({LEAVE_STATUS_LABELS[h.status] || h.status})</span>
                              <span className="tabular-nums">{h.startDate} → {h.endDate} · {arNum(h.totalDays)} يوم</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs bg-blue-50 rounded p-2" data-testid="box-settle-preview">
                  <div>الراتب الإجمالي: <b>{arNum(p.grossSalary)}</b> ر.س</div>
                  <div>قيمة اليوم (÷{arNum(p.divisor)}): <b>{arNum(p.dailyRate)}</b> ر.س</div>
                  <div>الرصيد المتبقي: <b className={remainingDays < 0 ? "text-red-600" : ""}>{arNum(remainingDays)}</b> يوم</div>
                  <div>الأيام المقترحة: <b>{arNum(p.suggestedDays)}</b> يوم</div>
                </div>
                <div>
                  <Label>عدد الأيام المراد تصفيتها</Label>
                  <Input type="number" inputMode="decimal" min="0.5" step="0.5" value={settleForm.days !== "" ? settleForm.days : String(p.suggestedDays || "")} onChange={(e) => setSettleForm({ ...settleForm, days: e.target.value })} data-testid="input-settle-days" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="manual-amount" checked={settleForm.useManual} onChange={(e) => setSettleForm({ ...settleForm, useManual: e.target.checked })} data-testid="checkbox-manual-amount" />
                  <Label htmlFor="manual-amount" className="cursor-pointer">تحديد المبلغ يدوياً</Label>
                </div>
                {settleForm.useManual && (
                  <div>
                    <Label>المبلغ اليدوي (ر.س)</Label>
                    <Input type="number" inputMode="decimal" min="0" step="0.01" value={settleForm.manualAmount} onChange={(e) => setSettleForm({ ...settleForm, manualAmount: e.target.value })} data-testid="input-manual-amount" />
                  </div>
                )}
                <div>
                  <Label>ملاحظة (اختياري)</Label>
                  <Input value={settleForm.note} onChange={(e) => setSettleForm({ ...settleForm, note: e.target.value })} data-testid="input-settle-note" />
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm flex justify-between items-center" data-testid="text-settle-total">
                  <span>المبلغ النهائي للصرف:</span>
                  <span className="font-extrabold text-lg text-amber-800 tabular-nums">{arNum(finalAmount)} ر.س</span>
                </div>
                {days > remainingDays && (
                  <div className="text-xs bg-red-50 text-red-700 rounded p-2" data-testid="text-settle-over-warning">
                    ⚠ الأيام المطلوبة تتجاوز الرصيد المتبقي ({arNum(remainingDays)} يوم) — سيرفض النظام التصفية.
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSettleLeave(null)}>إلغاء</Button>
                  <Button
                    onClick={() => settlementMutation.mutate({
                      id: settleLeave.id,
                      days,
                      manualAmount: settleForm.useManual && settleForm.manualAmount !== "" ? Number(settleForm.manualAmount) : undefined,
                      note: settleForm.note.trim() || undefined,
                    })}
                    disabled={settlementMutation.isPending || !days || days <= 0 || (settleForm.useManual && (settleForm.manualAmount === "" || Number(settleForm.manualAmount) < 0))}
                    data-testid="button-save-settlement"
                  >
                    {settlementMutation.isPending ? "جارٍ التصفية..." : "اعتماد التصفية"}
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* سند صرف تصفية الإجازة */}
      <Dialog open={!!receiptSettlement} onOpenChange={(o) => { if (!o) setReceiptSettlement(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto" dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Printer className="h-5 w-5" />سند صرف — تصفية رصيد إجازة</DialogTitle></DialogHeader>
          {receiptSettlement && (
            <div ref={receiptPrintRef} className="leave-print bg-white text-black p-6" dir="rtl">
              <div className="flex items-center justify-between border-b-4 pb-3 mb-4" style={{ borderColor: "#C8932A" }}>
                <div className="flex items-center gap-3">
                  <img src={butterLogo} alt="Butter Bakery" className="h-14 w-14 object-contain" />
                  <div className="text-start">
                    <h2 className="text-lg font-extrabold leading-tight" style={{ color: "#8A6212" }}>شركة الزبد الأفضل التجارية</h2>
                    <div className="text-xs font-semibold" style={{ color: "#C8932A" }}>Butter Bakery Trading Co.</div>
                    <div className="text-[10px] text-gray-600">إدارة الموارد البشرية — سند صرف تصفية رصيد إجازة سنوية</div>
                  </div>
                </div>
                <div className="text-end text-[10px] text-gray-600 leading-relaxed">
                  <div>رقم السند: <span className="font-bold text-black" data-testid="text-receipt-number">LS-{receiptSettlement.id}</span></div>
                  <div>التاريخ: <span className="font-bold text-black">{receiptSettlement.settlementDate || (receiptSettlement.createdAt || new Date().toISOString()).slice(0, 10)}</span></div>
                </div>
              </div>
              <table className="w-full text-sm border-collapse mb-4">
                <tbody>
                  <PrintRow label="اسم الموظف" value={receiptSettlement.employeeName || "-"} />
                  <PrintRow label="عدد الأيام المصفّاة" value={`${arNum(receiptSettlement.settledDays)} يوم`} />
                  <PrintRow label="الراتب الإجمالي" value={`${arNum(receiptSettlement.grossSalary)} ريال`} />
                  <PrintRow label="قيمة اليوم الواحد" value={`${arNum(receiptSettlement.dailyRate)} ريال (الراتب ÷ ${arNum(receiptSettlement.divisor)})`} />
                  <PrintRow label="المبلغ المحسوب" value={`${arNum(receiptSettlement.calculatedAmount)} ريال`} />
                  {receiptSettlement.isManualAmount && (
                    <PrintRow label="طريقة التحديد" value="مبلغ محدَّد يدوياً" />
                  )}
                  <PrintRow label="المبلغ النهائي المستحق" value={<span className="font-extrabold text-base">{arNum(receiptSettlement.finalAmount)} ريال سعودي</span>} />
                  {receiptSettlement.note && <PrintRow label="ملاحظات" value={receiptSettlement.note} />}
                </tbody>
              </table>
              <div className="text-xs text-gray-700 leading-relaxed mb-8">
                أُصرف للموظف المذكور أعلاه مبلغ التصفية النقدية لرصيد إجازته السنوية وفقاً لنظام العمل السعودي، ويُعد هذا السند إثباتاً لاستلام المبلغ.
              </div>
              <div className="grid grid-cols-3 gap-6 text-center text-xs mt-10">
                {["توقيع الموظف (المستلم)", "الموارد البشرية", "المدير المالي"].map((t) => (
                  <div key={t}>
                    <div className="border-t border-gray-400 pt-1 font-bold">{t}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-300 mt-8 pt-2 text-[9px] text-center text-gray-500">
                شركة الزبد الأفضل التجارية · سجل تجاري: 7026155296
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptSettlement(null)}>إغلاق</Button>
            <Button onClick={printReceipt} data-testid="button-print-receipt">
              <Printer className="h-4 w-4 ms-1" />طباعة السند
            </Button>
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
                    {["نوع الإجازة", "المستحق السنوي حسب العقد", "المرحّل", "تعديلات", "المستخدم", "المتبقي"].map((h) => (
                      <th key={h} className="border p-1.5 font-bold" style={{ borderColor: "#E5C98F", color: "#8A6212" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(statement.balances || []).filter((b: any) => !(b.leaveType === "sick" && !b.hasRow && Number(b.usedDays) === 0)).map((b: any) => {
                    const acc = b.leaveType === "annual" && statement.accrual?.configured ? statement.accrual : null;
                    if (acc) {
                      return (
                        <tr key={b.leaveType} data-testid={`row-stmt-bal-${b.leaveType}`} style={{ backgroundColor: "#FFFBEB" }}>
                          <td className="border p-1.5 font-semibold" style={{ borderColor: "#E5C98F" }}>{LEAVE_TYPE_LABELS[b.leaveType]} <span className="text-[9px] text-amber-700">(فعلي تلقائي)</span></td>
                          <td className="border p-1.5 tabular-nums text-center" style={{ borderColor: "#E5C98F" }}>{arNum(acc.annualDays)}</td>
                          <td className="border p-1.5 tabular-nums text-center" style={{ borderColor: "#E5C98F" }}>{arNum(acc.openingBalance)}</td>
                          <td className="border p-1.5 tabular-nums text-center" style={{ borderColor: "#E5C98F" }}>—</td>
                          <td className="border p-1.5 tabular-nums text-center" style={{ borderColor: "#E5C98F" }}>{arNum(Math.round((Number(acc.usedToDate) + Number(acc.upcomingDays) + Number(acc.settledDays)) * 100) / 100)}</td>
                          <td className={`border p-1.5 tabular-nums text-center font-bold ${acc.remainingDays < 0 ? "text-red-600" : ""}`} style={{ borderColor: "#E5C98F" }}>{arNum(acc.remainingDays)}</td>
                        </tr>
                      );
                    }
                    if (b.leaveType === "sick" && !b.hasRow) {
                      return (
                        <tr key={b.leaveType} data-testid={`row-stmt-bal-${b.leaveType}`}>
                          <td className="border p-1.5 font-semibold" style={{ borderColor: "#E5C98F" }}>{LEAVE_TYPE_LABELS[b.leaveType]} <span className="text-[9px] text-purple-700">(حسب نظام العمل)</span></td>
                          <td className="border p-1.5 text-center text-[10px]" style={{ borderColor: "#E5C98F" }}>١٢٠ يوم نظاماً</td>
                          <td className="border p-1.5 text-center" style={{ borderColor: "#E5C98F" }}>—</td>
                          <td className="border p-1.5 text-center" style={{ borderColor: "#E5C98F" }}>—</td>
                          <td className="border p-1.5 tabular-nums text-center" style={{ borderColor: "#E5C98F" }}>{arNum(b.usedDays)}</td>
                          <td className="border p-1.5 text-center" style={{ borderColor: "#E5C98F" }}>—</td>
                        </tr>
                      );
                    }
                    return (
                    <tr key={b.leaveType} data-testid={`row-stmt-bal-${b.leaveType}`}>
                      <td className="border p-1.5 font-semibold" style={{ borderColor: "#E5C98F" }}>{LEAVE_TYPE_LABELS[b.leaveType] || b.leaveType}</td>
                      <td className="border p-1.5 tabular-nums text-center" style={{ borderColor: "#E5C98F" }}>{arNum(b.entitledDays)}{!b.hasRow && b.leaveType === "annual" ? " (مقترح)" : ""}</td>
                      <td className="border p-1.5 tabular-nums text-center" style={{ borderColor: "#E5C98F" }}>{arNum(b.carriedOverDays)}</td>
                      <td className="border p-1.5 tabular-nums text-center" style={{ borderColor: "#E5C98F" }}>{arNum(b.adjustmentDays)}</td>
                      <td className="border p-1.5 tabular-nums text-center" style={{ borderColor: "#E5C98F" }}>{arNum(b.usedDays)}</td>
                      <td className={`border p-1.5 tabular-nums text-center font-bold ${b.remainingDays < 0 ? "text-red-600" : ""}`} style={{ borderColor: "#E5C98F" }}>{arNum(b.remainingDays)}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              {statement.accrual?.configured && (
                <div className="text-[10px] text-amber-800 -mt-3 mb-4 leading-relaxed">
                  سطر الإجازة السنوية يعرض الرصيد الفعلي التراكمي حتى اليوم (النظام التلقائي): المستحق = الاستحقاق السنوي بالعقد، المرحّل = الرصيد الافتتاحي بتاريخ {statement.accrual.accrualStart}، المستخدم يشمل الإجازات المعتمدة (المنقضية والقادمة) والتصفيات النقدية منذ ذلك التاريخ.
                </div>
              )}
              {(statement.balances || []).some((b: any) => b.leaveType === "sick" && (b.hasRow || Number(b.usedDays) > 0)) && (
                <div className="text-[10px] text-purple-800 mb-4 leading-relaxed">
                  الإجازة المرضية لا ترتبط برصيد سنوي مثل السنوية — استحقاقها حسب نظام العمل السعودي (المادة 117): أول ٣٠ يوماً بأجر كامل، ثم ٦٠ يوماً بثلاثة أرباع الأجر، ثم ٣٠ يوماً بلا أجر خلال السنة الواحدة، ويظهر هنا فقط عدد الأيام المستخدمة.
                </div>
              )}

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

              {/* التصفيات النقدية */}
              {(statement.settlements || []).length > 0 && (
                <>
                  <h4 className="font-bold text-sm mb-1.5 mt-4" style={{ color: "#8A6212" }}>التصفيات النقدية لرصيد الإجازات</h4>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: "#FBF3E0" }}>
                        {["التاريخ", "الأيام المصفّاة", "قيمة اليوم", "المبلغ (ر.س)", "ملاحظة"].map((h) => (
                          <th key={h} className="border p-1.5 font-bold" style={{ borderColor: "#E5C98F", color: "#8A6212" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(statement.settlements || []).map((s: any) => (
                        <tr key={s.id} data-testid={`row-stmt-settlement-${s.id}`}>
                          <td className="border p-1.5 tabular-nums" style={{ borderColor: "#E5C98F" }}>{s.settlementDate || (s.createdAt || "").slice(0, 10)}</td>
                          <td className="border p-1.5 tabular-nums text-center" style={{ borderColor: "#E5C98F" }}>{arNum(s.settledDays)}</td>
                          <td className="border p-1.5 tabular-nums text-center" style={{ borderColor: "#E5C98F" }}>{arNum(s.dailyRate)}</td>
                          <td className="border p-1.5 tabular-nums text-center font-bold" style={{ borderColor: "#E5C98F" }}>{arNum(s.finalAmount)}</td>
                          <td className="border p-1.5" style={{ borderColor: "#E5C98F" }}>{s.note || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              <div className="border-t border-gray-300 mt-6 pt-2 text-[9px] text-center text-gray-500">
                شركة الزبد الأفضل التجارية · سجل تجاري: 7026155296 — كشف صادر آلياً من نظام إدارة الموارد البشرية ولا يحتاج توقيعاً
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStmtEmpId(null)}>إغلاق</Button>
            <Button variant="outline" onClick={exportStatementExcel} disabled={!statement} data-testid="button-export-statement-excel">
              <FileSpreadsheet className="h-4 w-4 ms-1" />تصدير Excel
            </Button>
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
