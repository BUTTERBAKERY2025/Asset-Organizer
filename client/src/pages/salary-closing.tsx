import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import {
  FileSpreadsheet,
  Download,
  Users,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Wallet,
  Plus,
  Trash2,
  Search,
  Filter,
  X,
  ArrowUpDown,
  SlidersHorizontal,
  ShieldAlert,
} from "lucide-react";
import type { BranchEmployee, AttendanceRecord, SalaryDeduction } from "@shared/schema";
import { SALARY_DEDUCTION_TYPE_LABELS } from "@shared/schema";

// =====================================================
// مكوّن نافذة إدارة السُلف والخصومات اليدوية للموظف
// =====================================================
function DeductionsPopover({
  branchEmployeeId,
  branchId,
  month,
  employeeName,
  initialDeductions,
  totalAmount,
  onChanged,
}: {
  branchEmployeeId: number;
  branchId: string;
  month: string;
  employeeName: string;
  initialDeductions: SalaryDeduction[];
  totalAmount: number;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [newType, setNewType] = useState<string>("advance");
  const [newAmount, setNewAmount] = useState<string>("");
  const [newDescription, setNewDescription] = useState<string>("");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/employee-reports/bundle", "salary-closing"] });
    onChanged();
  };

  const createMutation = useMutation({
    mutationFn: async (payload: { type: string; amount: number; description: string }) => {
      const res = await fetch("/api/salary-deductions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchEmployeeId,
          branchId,
          month,
          type: payload.type,
          amount: payload.amount,
          description: payload.description || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "فشل الحفظ");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم الإضافة", description: "تم تسجيل السلفة/الخصم بنجاح" });
      setNewAmount("");
      setNewDescription("");
      refresh();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/salary-deductions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error || "فشل الحذف");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم الحذف", description: "تم حذف السجل بنجاح" });
      refresh();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const handleAdd = () => {
    const amount = parseFloat(newAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "مبلغ غير صحيح", description: "أدخل مبلغ موجب", variant: "destructive" });
      return;
    }
    createMutation.mutate({ type: newType, amount, description: newDescription.trim() });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={`btn-deductions-${branchEmployeeId}`}
          className="flex flex-col items-center gap-0.5 hover:bg-orange-50 rounded p-1 transition-colors w-full"
          title="إضافة/تعديل السُلف والخصومات اليدوية"
        >
          {totalAmount > 0 ? (
            <Badge className="bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200 cursor-pointer text-xs">
              - {totalAmount.toLocaleString("ar-SA-u-nu-latn", { maximumFractionDigits: 2 })} ر.س
            </Badge>
          ) : (
            <span className="text-gray-400 text-xs flex items-center gap-1">
              <Plus className="w-3 h-3" /> إضافة
            </span>
          )}
          {initialDeductions.length > 0 && (
            <span className="text-[10px] text-gray-500">{initialDeductions.length} عنصر</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-[500px] overflow-y-auto" side="top">
        <div className="space-y-3">
          <div className="border-b pb-2">
            <div className="text-sm font-bold text-gray-900">السُلف والخصومات اليدوية</div>
            <div className="text-xs text-gray-600">{employeeName} — {month}</div>
          </div>

          {initialDeductions.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-700">السجلات الحالية:</div>
              {initialDeductions.map(d => (
                <div key={d.id} className="flex items-start justify-between gap-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge className="bg-orange-200 text-orange-900 text-[10px] px-1.5 py-0">
                        {SALARY_DEDUCTION_TYPE_LABELS[d.type] || d.type}
                      </Badge>
                      <span className="font-bold text-orange-900">
                        {d.amount.toLocaleString("ar-SA-u-nu-latn", { maximumFractionDigits: 2 })} ر.س
                      </span>
                    </div>
                    {d.description && (
                      <div className="text-gray-600 mt-0.5 break-words">{d.description}</div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`حذف ${SALARY_DEDUCTION_TYPE_LABELS[d.type]} بمبلغ ${d.amount} ر.س؟`)) {
                        deleteMutation.mutate(d.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    data-testid={`btn-delete-deduction-${d.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              <div className="text-xs font-bold text-orange-900 text-left pt-1 border-t border-orange-200">
                الإجمالي: - {totalAmount.toLocaleString("ar-SA-u-nu-latn", { maximumFractionDigits: 2 })} ر.س
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t">
            <div className="text-xs font-semibold text-gray-700">إضافة جديدة:</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px]">النوع</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-deduction-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SALARY_DEDUCTION_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">المبلغ (ر.س)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-xs"
                  data-testid="input-deduction-amount"
                />
              </div>
            </div>
            <div>
              <Label className="text-[11px]">الوصف (اختياري)</Label>
              <Textarea
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder="مثال: سلفة شهر يناير، خصم تأخير..."
                rows={2}
                className="text-xs resize-none"
                data-testid="input-deduction-description"
              />
            </div>
            <Button
              type="button"
              onClick={handleAdd}
              disabled={createMutation.isPending || !newAmount}
              size="sm"
              className="w-full h-8 text-xs bg-orange-600 hover:bg-orange-700"
              data-testid="btn-add-deduction"
            >
              <Plus className="w-3.5 h-3.5 ml-1" />
              {createMutation.isPending ? "جاري الحفظ..." : "إضافة"}
            </Button>
          </div>

          <div className="text-[10px] text-gray-500 pt-1 border-t">
            💡 المبلغ المُسجَّل سيُخصم من صافي الراتب تلقائياً عند إغلاق هذا الشهر.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function formatCurrency(value: number | null | undefined, isRTL: boolean = true): string {
  if (value == null) return isRTL ? "0 ريال" : "0 SAR";
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value) + (isRTL ? " ريال" : " SAR");
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) return "0";
  return new Intl.NumberFormat('en-US').format(value);
}

// توحيد الأسماء العربية للمطابقة الذكية (يطابق منطق الخادم في salary-closing-calc.ts)
function normalizeArabicName(s: any): string {
  return String(s || "")
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0624/g, "\u0648")
    .replace(/\u0626/g, "\u064A")
    .toLowerCase();
}

// اقتراح أقرب موظف لمجموعة سجلات غير مرتبطة
function suggestEmployeeForGroup(
  group: { employeeNumber?: string; name?: string },
  employees: any[],
): { employee: any; confidence: "high" | "low" } | null {
  if (!employees || employees.length === 0) return null;
  const num = String(group.employeeNumber || "").trim();
  if (num) {
    const byNum = employees.find((e) => String(e.employeeNumber || "").trim() === num);
    if (byNum) return { employee: byNum, confidence: "high" };
  }
  const recNorm = normalizeArabicName(group.name);
  if (!recNorm) return null;
  const recNoSpace = recNorm.replace(/\s+/g, "");
  const exactMatches = employees.filter((e) => {
    const en = normalizeArabicName(e.employeeName || e.name);
    return en && en.replace(/\s+/g, "") === recNoSpace;
  });
  if (exactMatches.length === 1) return { employee: exactMatches[0], confidence: "high" };
  if (exactMatches.length > 1) return null;
  const recTokens = recNorm.split(/\s+/).filter(Boolean);
  let best: any = null;
  let bestScore = 0;
  let tie = false;
  for (const e of employees) {
    const en = normalizeArabicName(e.employeeName || e.name);
    if (!en) continue;
    const enTokens = new Set(en.split(/\s+/).filter(Boolean));
    let score = 0;
    for (const t of recTokens) if (enTokens.has(t)) score++;
    if (score > bestScore) {
      bestScore = score;
      best = e;
      tie = false;
    } else if (score === bestScore && score > 0) {
      tie = true;
    }
  }
  const threshold = recTokens.length >= 2 ? 2 : 1;
  if (best && bestScore >= threshold && !tie) return { employee: best, confidence: "low" };
  return null;
}

const TOGGLEABLE_COLUMNS: { key: string; label: string }[] = [
  { key: "jobTitle", label: "الوظيفة" },
  { key: "bank", label: "البنك / الآيبان" },
  { key: "workDays", label: "أيام العمل" },
  { key: "off", label: "الإجازات" },
  { key: "hours", label: "الساعات" },
  { key: "salary", label: "الراتب" },
  { key: "allowances", label: "البدلات" },
  { key: "dailyRate", label: "قيمة اليوم" },
  { key: "absenceDeduction", label: "خصم الغياب" },
  { key: "insurance", label: "التأمينات" },
];

export default function SalaryClosingPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();
  const isHrManager = user?.role === "hr_manager";
  const canCloseSalary = isAdmin || isHrManager;
  const canApproveSalaryClosing = isAdmin || isHrManager;

  const { branches, userBranchId } = useBranches();

  const [branch, setBranch] = useState<string>("");
  const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  // تهيئة الفرع الافتراضي
  useEffect(() => {
    if (!branch) {
      if (userBranchId) setBranch(userBranchId);
      else if (branches && branches.length > 0) setBranch(branches[0].id);
    }
  }, [branch, userBranchId, branches]);

  // حالة نوافذ الإجراءات
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closeNotes, setCloseNotes] = useState("");
  const [acknowledgeClose, setAcknowledgeClose] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [groupSel, setGroupSel] = useState<Record<string, string>>({});

  // حالة البحث والفلترة المتقدمة (تؤثر على الجدول فقط)
  const [search, setSearch] = useState("");
  const [jobTitleFilter, setJobTitleFilter] = useState("all");
  const [nationalityFilter, setNationalityFilter] = useState("all");
  const [dataSourceFilter, setDataSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [netMin, setNetMin] = useState("");
  const [netMax, setNetMax] = useState("");
  const [sortField, setSortField] = useState("employeeName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(true);
  const [cols, setCols] = useState<Record<string, boolean>>({
    jobTitle: true,
    bank: true,
    workDays: true,
    off: true,
    hours: true,
    salary: true,
    allowances: true,
    dailyRate: true,
    absenceDeduction: true,
    insurance: true,
  });
  const toggleCol = (k: string) => setCols((p) => ({ ...p, [k]: !p[k] }));

  const branchActive = !!branch && branch !== "all";

  // bundle خاص بالإغلاق — لقائمة الموظفين المستخدمة في نافذة الربط
  const { data: salaryClosingBundle } = useQuery<{
    employees: BranchEmployee[];
    attendance: AttendanceRecord[];
    schedules: any[];
    signedTimesheets?: Array<{ report: any; entries: any[] }>;
    salaryDeductions?: SalaryDeduction[];
  }>({
    queryKey: ["/api/employee-reports/bundle", "salary-closing", branch, month],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branch && branch !== "all") params.set("branchId", branch);
      if (month) params.set("month", month);
      const res = await fetch(`/api/employee-reports/bundle?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch salary closing bundle");
      return res.json();
    },
    enabled: branchActive,
    staleTime: 60_000,
  });

  // الاحتساب المركزي على الخادم (مصدر الحقيقة)
  const salaryClosingPreviewQuery = useQuery<{
    lines: any[];
    totals: any;
    unlinked: AttendanceRecord[];
    unlinkedSummary: { totalRecords: number; presentRecords: number; totalHours: number };
    warnings: Array<{ branchEmployeeId: number | null; employeeName: string; code: string; message: string }>;
    closure: any | null;
    isLocked: boolean;
  }>({
    queryKey: ["/api/salary-closing/preview", branch, month],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("branchId", branch);
      params.set("month", month);
      const res = await fetch(`/api/salary-closing/preview?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch salary closing preview");
      return res.json();
    },
    enabled: branchActive,
    staleTime: 30_000,
  });
  const salaryClosingPreview = salaryClosingPreviewQuery.data;
  const previewLoading = salaryClosingPreviewQuery.isLoading;

  // اللقطة المحفوظة (لمعرفات السطور لطباعة قسائم الراتب)
  const savedClosureQuery = useQuery<{ closure: any | null; lines: any[] }>({
    queryKey: ["/api/salary-closing", branch, month],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("branchId", branch);
      params.set("month", month);
      const res = await fetch(`/api/salary-closing?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch saved closure");
      return res.json();
    },
    enabled: branchActive && !!salaryClosingPreview?.isLocked,
    staleTime: 30_000,
  });
  const closureLineIdByBranchEmployee = useMemo(() => {
    const map = new Map<number, number>();
    for (const l of savedClosureQuery.data?.lines ?? []) {
      if (l.branchEmployeeId != null) map.set(Number(l.branchEmployeeId), Number(l.id));
    }
    return map;
  }, [savedClosureQuery.data]);
  const savedClosureId = savedClosureQuery.data?.closure?.id ?? null;

  const salaryClosingData: any[] = salaryClosingPreview?.lines ?? [];
  const salaryClosingUnlinkedRecords: AttendanceRecord[] = salaryClosingPreview?.unlinked ?? [];

  const unlinkedGroups = useMemo(() => {
    const emps = salaryClosingBundle?.employees ?? [];
    const groups = new Map<
      string,
      { key: string; name: string; employeeNumber: string; records: any[]; suggestion: any | null }
    >();
    for (const rec of salaryClosingUnlinkedRecords as any[]) {
      const name = rec.employeeName || (rec as any).name || "";
      const num = String(rec.employeeNumber || "").trim();
      const norm = normalizeArabicName(name);
      const key = num ? `num:${num}` : norm ? `name:${norm}` : `id:${rec.id}`;
      let g = groups.get(key);
      if (!g) {
        g = { key, name, employeeNumber: num, records: [], suggestion: null };
        groups.set(key, g);
      }
      g.records.push(rec);
    }
    const groupList = Array.from(groups.values());
    groupList.forEach((g) => { g.suggestion = suggestEmployeeForGroup(g, emps); });
    return groupList.sort((a, b) => b.records.length - a.records.length);
  }, [salaryClosingUnlinkedRecords, salaryClosingBundle]);

  const salaryClosingUnlinkedSummary = salaryClosingPreview?.unlinkedSummary ?? { totalRecords: 0, presentRecords: 0, totalHours: 0 };
  const salaryClosingUnlinkedCount = salaryClosingUnlinkedSummary.totalRecords;
  const salaryClosingWarnings = salaryClosingPreview?.warnings ?? [];
  const salaryClosingClosure = salaryClosingPreview?.closure ?? null;
  const salaryClosingIsLocked = !!salaryClosingPreview?.isLocked;
  const salaryClosingBlockingWarnings = salaryClosingWarnings.filter((w: any) => w.code === "no_work_at_all");

  const getBranchName = (branchId: string) => {
    const b = branches?.find((x) => x.id === branchId);
    return b?.name || branchId;
  };

  const refreshSalaryClosing = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/salary-closing/preview"] });
    queryClient.invalidateQueries({ queryKey: ["/api/salary-closing/list"] });
    queryClient.invalidateQueries({ queryKey: ["/api/employee-reports/bundle", "salary-closing"] });
  };

  const closeSalaryMutation = useMutation({
    mutationFn: async (payload: { acknowledgeWarnings?: boolean; notes?: string }) => {
      const res = await apiRequest("POST", "/api/salary-closing/close", {
        branchId: branch,
        month,
        acknowledgeWarnings: payload.acknowledgeWarnings ?? false,
        notes: payload.notes,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم إغلاق الشهر", description: "تم حفظ لقطة ثابتة للرواتب وقفل الشهر." });
      refreshSalaryClosing();
    },
    onError: (err: any) => {
      toast({ title: "تعذّر الإغلاق", description: err?.message || "حدث خطأ", variant: "destructive" });
    },
  });

  const reopenSalaryMutation = useMutation({
    mutationFn: async (payload: { id: number; reason: string }) => {
      const res = await apiRequest("POST", `/api/salary-closing/${payload.id}/reopen`, { reason: payload.reason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم إعادة الفتح", description: "أصبح بإمكانك التعديل ثم الإغلاق من جديد." });
      refreshSalaryClosing();
    },
    onError: (err: any) => {
      toast({ title: "تعذّر إعادة الفتح", description: err?.message || "حدث خطأ", variant: "destructive" });
    },
  });

  const bulkLinkMutation = useMutation({
    mutationFn: async (payload: { attendanceIds: number[]; branchEmployeeId: number }) => {
      const res = await apiRequest("POST", "/api/salary-closing/link-attendance-bulk", payload);
      return res.json();
    },
    onSuccess: (data: any) => {
      const linked = data?.linked ?? 0;
      const skipped = data?.skipped?.length ?? 0;
      toast({
        title: "تم الربط",
        description: `تم ربط ${linked} سجل${skipped ? ` (تم تخطّي ${skipped})` : ""}.`,
      });
      refreshSalaryClosing();
    },
    onError: (err: any) => {
      toast({ title: "تعذّر الربط", description: err?.message || "حدث خطأ", variant: "destructive" });
    },
  });

  const downloadFile = async (url: string, fallbackName: string) => {
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "فشل التنزيل");
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fallbackName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (err: any) {
      toast({ title: "تعذّر التنزيل", description: err?.message || "حدث خطأ", variant: "destructive" });
    }
  };

  const exportSalaryClosingToExcel = async () => {
    if (salaryClosingData.length === 0) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const summaryData = [
      { [isRTL ? "البيان" : "Item"]: isRTL ? "الفرع" : "Branch", [isRTL ? "القيمة" : "Value"]: getBranchName(branch) },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "الشهر" : "Month", [isRTL ? "القيمة" : "Value"]: month },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "عدد الموظفين" : "Employee Count", [isRTL ? "القيمة" : "Value"]: salaryClosingData.length },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "إجمالي الرواتب (شامل البدلات)" : "Total Salaries (Incl. Allowances)", [isRTL ? "القيمة" : "Value"]: salaryClosingData.reduce((sum, e) => sum + e.grossSalary, 0) },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "إجمالي خصم الغياب" : "Total Absence Deduction", [isRTL ? "القيمة" : "Value"]: salaryClosingData.reduce((sum, e) => sum + e.absenceDeduction, 0) },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "إجمالي التأمينات الاجتماعية" : "Total Social Insurance", [isRTL ? "القيمة" : "Value"]: salaryClosingData.reduce((sum, e) => sum + e.socialInsurance, 0) },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "إجمالي السُلف والخصومات اليدوية" : "Total Manual Deductions", [isRTL ? "القيمة" : "Value"]: salaryClosingData.reduce((sum, e) => sum + (e.manualDeductionsTotal || 0), 0) },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "صافي الرواتب المستحقة" : "Net Salaries Due", [isRTL ? "القيمة" : "Value"]: salaryClosingData.reduce((sum, e) => sum + e.netSalary, 0) },
      { [isRTL ? "البيان" : "Item"]: "", [isRTL ? "القيمة" : "Value"]: "" },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "سجلات حضور غير مرتبطة" : "Unlinked Attendance Records", [isRTL ? "القيمة" : "Value"]: salaryClosingUnlinkedCount },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "سجلات حضور (غير مرتبطة)" : "Present Records (Unlinked)", [isRTL ? "القيمة" : "Value"]: salaryClosingUnlinkedSummary.presentRecords },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "إجمالي ساعات غير مرتبطة" : "Total Unlinked Hours", [isRTL ? "القيمة" : "Value"]: Math.round(salaryClosingUnlinkedSummary.totalHours * 10) / 10 },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "ملاحظة" : "Note", [isRTL ? "القيمة" : "Value"]: salaryClosingUnlinkedCount > 0 ? (isRTL ? "توجد سجلات حضور غير مرتبطة بموظفين - راجع ورقة السجلات غير المرتبطة للتفاصيل والمراجعة" : "Unlinked attendance records exist - see Unlinked Records sheet for details") : (isRTL ? "جميع السجلات مرتبطة بموظفين" : "All records are linked to employees") },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, isRTL ? "ملخص" : "Summary");

    const data = salaryClosingData.map((emp, index) => ({
      [isRTL ? "م" : "#"]: index + 1,
      [isRTL ? "رقم الموظف" : "Employee #"]: emp.employeeNumber,
      [isRTL ? "الاسم" : "Name"]: emp.employeeName,
      [isRTL ? "الوظيفة" : "Job Title"]: emp.jobTitle,
      [isRTL ? "الجنسية" : "Nationality"]: emp.nationality,
      [isRTL ? "البنك" : "Bank"]: emp.bankName || "",
      [isRTL ? "الآيبان / رقم الحساب" : "IBAN / Account #"]: emp.bankAccountNumber || "",
      [isRTL ? "السُلف والخصومات اليدوية" : "Manual Deductions"]: emp.manualDeductionsTotal || 0,
      [isRTL ? "تفاصيل السُلف/الخصومات" : "Deductions Detail"]: (emp.manualDeductions || [])
        .map((d: any) => `${SALARY_DEDUCTION_TYPE_LABELS[d.type] || d.type}: ${d.amount}${d.description ? ` (${d.description})` : ""}`)
        .join(" | "),
      [isRTL ? "مصدر البيانات" : "Data Source"]:
        emp.dataSource === "signed_timesheet"
          ? (isRTL ? "تايم شيت موقّع ✓" : "Signed Timesheet ✓")
          : emp.dataSource === "schedule_attendance"
          ? (isRTL ? "جدول + بصمة" : "Schedule + Attendance")
          : (isRTL ? "بصمة فقط" : "Attendance only"),
      [isRTL ? "أيام العمل المجدولة" : "Scheduled Work Days"]: emp.scheduledWorkDays,
      [isRTL ? "أيام الإجازة" : "Off Days"]: emp.offDays,
      [isRTL ? "ساعات الجدول" : "Scheduled Hours"]: emp.scheduledHours,
      [isRTL ? "أيام الحضور" : "Present Days"]: emp.presentDays,
      [isRTL ? "أيام الغياب" : "Absent Days"]: emp.absentDays,
      [isRTL ? "أيام التأخير" : "Late Days"]: emp.lateDays,
      [isRTL ? "إجمالي الساعات" : "Total Hours"]: emp.totalHours,
      [isRTL ? "الراتب الأساسي" : "Base Salary"]: emp.baseSalary,
      [isRTL ? "البدلات" : "Allowances"]: emp.allowances,
      [isRTL ? "إجمالي الراتب" : "Gross Salary"]: emp.grossSalary,
      [isRTL ? "قيمة اليوم" : "Daily Rate"]: emp.dailyRate,
      [isRTL ? "خصم الغياب" : "Absence Deduction"]: emp.absenceDeduction,
      [isRTL ? "التأمينات الاجتماعية" : "Social Insurance"]: emp.socialInsurance,
      [isRTL ? "صافي الراتب" : "Net Salary"]: emp.netSalary,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, isRTL ? "تفاصيل الرواتب" : "Salary Details");

    if (salaryClosingUnlinkedRecords.length > 0) {
      const unlinkedData = salaryClosingUnlinkedRecords.map((rec, index) => ({
        [isRTL ? "م" : "#"]: index + 1,
        [isRTL ? "التاريخ" : "Date"]: rec.attendanceDate,
        [isRTL ? "اسم الموظف (غير مرتبط)" : "Employee Name (Unlinked)"]: rec.employeeName,
        [isRTL ? "معرف الموظف" : "Employee ID"]: rec.employeeId || "-",
        [isRTL ? "الحالة" : "Status"]: rec.status === "present" ? (isRTL ? "حاضر" : "Present") : rec.status === "absent" ? (isRTL ? "غائب" : "Absent") : rec.status === "late" ? (isRTL ? "متأخر" : "Late") : rec.status,
        [isRTL ? "وقت الحضور" : "Check In"]: rec.actualCheckIn || "-",
        [isRTL ? "وقت الانصراف" : "Check Out"]: rec.actualCheckOut || "-",
        [isRTL ? "ساعات العمل" : "Working Hours"]: rec.workingHours || 0,
        [isRTL ? "ملاحظات" : "Notes"]: rec.notes || "-",
      }));
      const wsUnlinked = XLSX.utils.json_to_sheet(unlinkedData);
      XLSX.utils.book_append_sheet(wb, wsUnlinked, isRTL ? "سجلات غير مرتبطة" : "Unlinked Records");
    }

    XLSX.writeFile(wb, `${isRTL ? "إغلاق_الرواتب" : "salary_closing"}_${getBranchName(branch)}_${month}.xlsx`);
  };

  const exportSalaryClosingToPDF = async () => {
    if (salaryClosingData.length === 0) {
      alert(isRTL ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }
    try {
      const requestData = {
        branchName: getBranchName(branch),
        month,
        employees: salaryClosingData.map(emp => ({
          employeeName: emp.employeeName,
          jobTitle: emp.jobTitle,
          bankName: emp.bankName,
          bankAccountNumber: emp.bankAccountNumber,
          scheduledWorkDays: emp.scheduledWorkDays,
          offDays: emp.offDays,
          presentDays: emp.presentDays,
          absentDays: emp.absentDays,
          totalHours: emp.totalHours,
          baseSalary: emp.baseSalary,
          allowances: emp.allowances,
          dailyRate: emp.dailyRate,
          absenceDeduction: emp.absenceDeduction,
          socialInsurance: emp.socialInsurance,
          manualDeductions: (emp.manualDeductions || []).map((d: any) => ({
            type: SALARY_DEDUCTION_TYPE_LABELS[d.type] || d.type,
            amount: d.amount,
            description: d.description,
          })),
          manualDeductionsTotal: emp.manualDeductionsTotal || 0,
          netSalary: emp.netSalary,
          dataSource: emp.dataSource,
        })),
        dataSourceSummary: {
          signed: salaryClosingData.filter(e => e.dataSource === "signed_timesheet").length,
          schedule: salaryClosingData.filter(e => e.dataSource === "schedule_attendance").length,
          attendanceOnly: salaryClosingData.filter(e => e.dataSource === "attendance_only").length,
        },
      };

      const response = await fetch("/api/pdf/salary-closing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestData),
      });
      if (!response.ok) {
        throw new Error(isRTL ? "فشل في إنشاء ملف PDF" : "Failed to generate PDF");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${isRTL ? "إغلاق_الرواتب" : "salary_closing"}_${getBranchName(branch)}_${month}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert((isRTL ? "خطأ في تصدير PDF: " : "PDF export error: ") + (error as Error).message);
    }
  };

  // قوائم الفلاتر المشتقة
  const uniqueJobTitles = useMemo(
    () => Array.from(new Set(salaryClosingData.map((e) => e.jobTitle).filter(Boolean))).sort(),
    [salaryClosingData],
  );
  const uniqueNationalities = useMemo(
    () => Array.from(new Set(salaryClosingData.map((e) => e.nationality).filter(Boolean))).sort(),
    [salaryClosingData],
  );

  const filteredLines = useMemo(() => {
    let result = [...salaryClosingData];
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (e) =>
          (e.employeeName || "").toLowerCase().includes(q) ||
          String(e.employeeNumber || "").toLowerCase().includes(q) ||
          (e.jobTitle || "").toLowerCase().includes(q) ||
          (e.bankName || "").toLowerCase().includes(q) ||
          String(e.bankAccountNumber || "").toLowerCase().includes(q) ||
          (e.nationality || "").toLowerCase().includes(q),
      );
    }
    if (jobTitleFilter !== "all") result = result.filter((e) => e.jobTitle === jobTitleFilter);
    if (nationalityFilter !== "all") result = result.filter((e) => e.nationality === nationalityFilter);
    if (dataSourceFilter !== "all") result = result.filter((e) => e.dataSource === dataSourceFilter);
    if (statusFilter === "has_absence") result = result.filter((e) => e.absentDays > 0);
    else if (statusFilter === "has_deductions") result = result.filter((e) => (e.manualDeductionsTotal || 0) > 0);
    else if (statusFilter === "no_work") result = result.filter((e) => e.noWorkAtAll);
    else if (statusFilter === "no_bank") result = result.filter((e) => !e.bankAccountNumber && !e.bankName);
    const min = netMin ? parseFloat(netMin) : -Infinity;
    const max = netMax ? parseFloat(netMax) : Infinity;
    result = result.filter((e) => (e.netSalary || 0) >= min && (e.netSalary || 0) <= max);
    result.sort((a, b) => {
      let av: any, bv: any;
      switch (sortField) {
        case "employeeNumber": av = a.employeeNumber || ""; bv = b.employeeNumber || ""; break;
        case "jobTitle": av = a.jobTitle || ""; bv = b.jobTitle || ""; break;
        case "presentDays": av = a.presentDays || 0; bv = b.presentDays || 0; break;
        case "absentDays": av = a.absentDays || 0; bv = b.absentDays || 0; break;
        case "totalHours": av = a.totalHours || 0; bv = b.totalHours || 0; break;
        case "baseSalary": av = a.baseSalary || 0; bv = b.baseSalary || 0; break;
        case "netSalary": av = a.netSalary || 0; bv = b.netSalary || 0; break;
        case "absenceDeduction": av = a.absenceDeduction || 0; bv = b.absenceDeduction || 0; break;
        default: av = a.employeeName || ""; bv = b.employeeName || "";
      }
      if (typeof av === "string") {
        return sortOrder === "asc" ? av.localeCompare(bv, "ar") : bv.localeCompare(av, "ar");
      }
      return sortOrder === "asc" ? av - bv : bv - av;
    });
    return result;
  }, [salaryClosingData, search, jobTitleFilter, nationalityFilter, dataSourceFilter, statusFilter, netMin, netMax, sortField, sortOrder]);

  const hasActiveFilters =
    !!search ||
    jobTitleFilter !== "all" ||
    nationalityFilter !== "all" ||
    dataSourceFilter !== "all" ||
    statusFilter !== "all" ||
    !!netMin ||
    !!netMax;

  const clearFilters = () => {
    setSearch("");
    setJobTitleFilter("all");
    setNationalityFilter("all");
    setDataSourceFilter("all");
    setStatusFilter("all");
    setNetMin("");
    setNetMax("");
  };

  if (!canCloseSalary) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 text-center" dir={isRTL ? "rtl" : "ltr"}>
          <ShieldAlert className="w-14 h-14 text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-1">غير مصرّح بالوصول</h2>
          <p className="text-gray-500">صفحة إغلاق الرواتب الشهرية متاحة للمدير ومدير الموارد البشرية فقط.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
        <PageHeader
          icon={Wallet}
          tone="executive"
          title="إغلاق الرواتب الشهرية"
          description="تقرير شهري شامل للرواتب يتضمن الحضور والغياب وساعات العمل، مع بحث وفلترة متقدمة"
          backHref="/employee-reports"
        />

        {/* شريط التحكم: الفرع + الشهر + الإجراءات */}
        <Card data-testid="card-controls">
          <CardContent className="py-4">
            <div className="flex flex-col lg:flex-row lg:items-end gap-3">
              <div className="flex-1 min-w-[180px] space-y-1">
                <Label>الفرع *</Label>
                <Select value={branch} onValueChange={setBranch}>
                  <SelectTrigger data-testid="select-branch">
                    <SelectValue placeholder="اختر الفرع" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {branches?.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[160px] space-y-1">
                <Label>الشهر *</Label>
                <Input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  data-testid="input-month"
                />
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  variant="outline"
                  onClick={exportSalaryClosingToExcel}
                  disabled={previewLoading || salaryClosingData.length === 0}
                  data-testid="button-export-salary-excel"
                >
                  <FileSpreadsheet className="w-4 h-4 ml-2" />
                  تصدير Excel
                </Button>
                <Button
                  variant="outline"
                  onClick={exportSalaryClosingToPDF}
                  disabled={previewLoading || salaryClosingData.length === 0}
                  data-testid="button-export-salary-pdf"
                >
                  <Download className="w-4 h-4 ml-2" />
                  تصدير PDF
                </Button>
                {salaryClosingClosure && (
                  <Button
                    variant="outline"
                    onClick={() => downloadFile(`/api/salary-closing/${salaryClosingClosure.id}/bank-file`, `bank_transfer_${month}.csv`)}
                    data-testid="button-bank-file"
                  >
                    <Download className="w-4 h-4 ml-2" />
                    ملف التحويل البنكي
                  </Button>
                )}
                {!salaryClosingIsLocked && canApproveSalaryClosing && (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      setCloseNotes("");
                      setAcknowledgeClose(false);
                      setShowCloseConfirm(true);
                    }}
                    disabled={previewLoading || salaryClosingData.length === 0 || closeSalaryMutation.isPending}
                    data-testid="button-close-month"
                  >
                    <CheckCircle2 className="w-4 h-4 ml-2" />
                    إغلاق الشهر نهائياً
                  </Button>
                )}
                {salaryClosingIsLocked && isAdmin && (
                  <Button
                    variant="outline"
                    className="text-amber-700 border-amber-300"
                    onClick={() => { setReopenReason(""); setShowReopenDialog(true); }}
                    data-testid="button-reopen-closure"
                  >
                    إعادة فتح
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {previewLoading && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-sm text-blue-800" data-testid="alert-loading-salary">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>جاري تحميل بيانات الجدول والبصمات لـ {getBranchName(branch)} - {month}...</span>
          </div>
        )}

        {/* حالة الإغلاق */}
        {salaryClosingClosure && (
          <Card className={salaryClosingIsLocked ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"} data-testid="card-closure-status">
            <CardContent className="py-3">
              <div className="flex items-start gap-3">
                {salaryClosingIsLocked
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                  : <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />}
                <div>
                  <p className={salaryClosingIsLocked ? "font-bold text-emerald-800" : "font-bold text-amber-800"}>
                    {salaryClosingIsLocked ? "✓ هذا الشهر مغلق نهائياً (لقطة ثابتة)" : "⚠ تم إعادة فتح هذا الإغلاق"}
                  </p>
                  <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                    {salaryClosingClosure.closedByName && (
                      <div>اعتمد الإغلاق: <strong>{salaryClosingClosure.closedByName}</strong>{salaryClosingClosure.closedAt ? ` — ${new Date(salaryClosingClosure.closedAt).toLocaleString("ar-SA")}` : ""}</div>
                    )}
                    {salaryClosingClosure.reopenedByName && (
                      <div className="text-amber-700">أعاد الفتح: <strong>{salaryClosingClosure.reopenedByName}</strong>{salaryClosingClosure.reopenReason ? ` — السبب: ${salaryClosingClosure.reopenReason}` : ""}</div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* تحذير الموظفين بدون بيانات */}
        {!salaryClosingIsLocked && salaryClosingBlockingWarnings.length > 0 && (
          <Card className="border-red-200 bg-red-50" data-testid="card-blocking-warnings">
            <CardContent className="py-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-red-800">
                    تحذير: {formatNumber(salaryClosingBlockingWarnings.length)} موظف بدون أي بيانات حضور لهذا الشهر
                  </p>
                  <ul className="text-sm text-red-700 mt-1 list-disc pr-5 space-y-0.5 max-h-32 overflow-y-auto">
                    {salaryClosingBlockingWarnings.map((w: any, i: number) => (
                      <li key={i}>{w.employeeName} — سيُحتسب الشهر كاملاً غياباً (الراتب = 0)</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* سجلات غير مرتبطة */}
        {salaryClosingUnlinkedCount > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="py-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-orange-800">
                    تنبيه: {formatNumber(salaryClosingUnlinkedCount)} سجل حضور غير مرتبط لهذا الفرع/الشهر
                  </p>
                  <div className="flex gap-4 mt-1 text-sm text-orange-700">
                    <span>سجلات حضور: {formatNumber(salaryClosingUnlinkedSummary.presentRecords)}</span>
                    <span>إجمالي الساعات: {formatNumber(Math.round(salaryClosingUnlinkedSummary.totalHours * 10) / 10)}</span>
                  </div>
                  <p className="text-sm text-orange-600 mt-1">
                    هذه السجلات غير مضمنة في حساب الرواتب - اربطها بالموظف الصحيح قبل الإغلاق.
                  </p>
                  {!salaryClosingIsLocked && canApproveSalaryClosing && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 text-orange-700 border-orange-300"
                      onClick={() => setShowLinkDialog(true)}
                      data-testid="button-open-link-dialog"
                    >
                      ربط السجلات بالموظفين
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {branchActive && salaryClosingData.length > 0 && (
          <>
            {/* ملخص الرواتب */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  ملخص الرواتب - {getBranchName(branch)} - {month}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg" data-testid="card-employee-count">
                    <p className="text-2xl font-bold text-blue-600">{salaryClosingData.length}</p>
                    <p className="text-sm text-gray-600">عدد الموظفين</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg" data-testid="card-gross-salary">
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(salaryClosingData.reduce((sum, e) => sum + e.grossSalary, 0))}
                    </p>
                    <p className="text-sm text-gray-600">إجمالي الرواتب</p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg" data-testid="card-absence-deduction" title="إجمالي خصومات الغياب: عدد أيام الغياب × (الراتب الإجمالي ÷ 30)">
                    <p className="text-2xl font-bold text-orange-600">
                      {formatCurrency(salaryClosingData.reduce((sum, e) => sum + e.absenceDeduction, 0))}
                    </p>
                    <p className="text-sm text-gray-600">خصم الغياب</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg" data-testid="card-social-insurance">
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(salaryClosingData.reduce((sum, e) => sum + e.socialInsurance, 0))}
                    </p>
                    <p className="text-sm text-gray-600">التأمينات الاجتماعية</p>
                  </div>
                  <div className="text-center p-3 bg-orange-100 rounded-lg border border-orange-300" data-testid="card-manual-deductions" title="إجمالي السُلف والخصومات اليدوية المُدخلة لهذا الشهر">
                    <p className="text-2xl font-bold text-orange-700">
                      {formatCurrency(salaryClosingData.reduce((sum, e) => sum + (e.manualDeductionsTotal || 0), 0))}
                    </p>
                    <p className="text-sm text-gray-700">سُلف وخصومات</p>
                  </div>
                  <div className="text-center p-3 bg-amber-50 rounded-lg" data-testid="card-net-salary">
                    <p className="text-2xl font-bold text-amber-600">
                      {formatCurrency(salaryClosingData.reduce((sum, e) => sum + e.netSalary, 0))}
                    </p>
                    <p className="text-sm text-gray-600">صافي الرواتب</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-2">
                  <div className="text-center p-2 bg-blue-50 rounded-lg border border-blue-100" data-testid="summary-scheduled-days">
                    <p className="text-xl font-bold text-blue-700">
                      {salaryClosingData.reduce((sum, e) => sum + e.scheduledWorkDays, 0)}
                    </p>
                    <p className="text-[11px] text-gray-600">أيام عمل مجدولة</p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded-lg border border-green-100" data-testid="summary-present">
                    <p className="text-xl font-bold text-green-700">
                      {salaryClosingData.reduce((sum, e) => sum + e.presentDays, 0)}
                    </p>
                    <p className="text-[11px] text-gray-600">إجمالي الحضور</p>
                  </div>
                  <div className="text-center p-2 bg-red-50 rounded-lg border border-red-100" data-testid="summary-absent">
                    <p className="text-xl font-bold text-red-700">
                      {salaryClosingData.reduce((sum, e) => sum + e.absentDays, 0)}
                    </p>
                    <p className="text-[11px] text-gray-600">إجمالي الغياب</p>
                  </div>
                  <div className="text-center p-2 bg-amber-50 rounded-lg border border-amber-100" data-testid="summary-off">
                    <p className="text-xl font-bold text-amber-700">
                      {salaryClosingData.reduce((sum, e) => sum + e.offDays, 0)}
                    </p>
                    <p className="text-[11px] text-gray-600">إجمالي الإجازات</p>
                  </div>
                  <div className="text-center p-2 bg-purple-50 rounded-lg border border-purple-100" data-testid="summary-hours">
                    <p className="text-xl font-bold text-purple-700">
                      {Math.round(salaryClosingData.reduce((sum, e) => sum + e.totalHours, 0) * 10) / 10}
                    </p>
                    <p className="text-[11px] text-gray-600">إجمالي الساعات</p>
                  </div>
                </div>

                {/* مؤشر مصدر البيانات */}
                {(() => {
                  const signedCount = salaryClosingData.filter(e => e.dataSource === "signed_timesheet").length;
                  const scheduleCount = salaryClosingData.filter(e => e.dataSource === "schedule_attendance").length;
                  const attendanceOnlyCount = salaryClosingData.filter(e => e.dataSource === "attendance_only").length;
                  const total = salaryClosingData.length;
                  if (total === 0) return null;
                  const signedPct = Math.round((signedCount / total) * 100);
                  return (
                    <div className="mt-4 p-3 border rounded-lg bg-gradient-to-r from-emerald-50 to-blue-50" data-testid="data-source-summary">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-gray-700">مصدر بيانات الحضور لكل موظف</p>
                        <Badge className={signedPct === 100 ? "bg-emerald-600" : signedPct >= 50 ? "bg-emerald-500" : "bg-orange-500"}>
                          {signedPct}% موقّع
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex items-center gap-2 p-2 bg-emerald-100 rounded text-xs" data-testid="count-signed">
                          <span className="text-emerald-700 font-bold text-lg">{signedCount}</span>
                          <div>
                            <p className="font-semibold text-emerald-900">✓ تايم شيت موقّع</p>
                            <p className="text-[10px] text-emerald-700">مصدر الحقيقة</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-blue-100 rounded text-xs" data-testid="count-schedule">
                          <span className="text-blue-700 font-bold text-lg">{scheduleCount}</span>
                          <div>
                            <p className="font-semibold text-blue-900">جدول + بصمة</p>
                            <p className="text-[10px] text-blue-700">لم يتم توقيع التايم شيت</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-orange-100 rounded text-xs" data-testid="count-attendance-only">
                          <span className="text-orange-700 font-bold text-lg">{attendanceOnlyCount}</span>
                          <div>
                            <p className="font-semibold text-orange-900">بصمة فقط</p>
                            <p className="text-[10px] text-orange-700">بدون جدول ولا توقيع</p>
                          </div>
                        </div>
                      </div>
                      {signedCount < total && (
                        <p className="text-[11px] text-gray-600 mt-2">
                          💡 لضمان الدقة الكاملة وحل أي تناقض في البيانات، أنصح بإصدار وتوقيع التايم شيت لكل الموظفين قبل إغلاق الرواتب.
                        </p>
                      )}
                    </div>
                  );
                })()}

                {salaryClosingData.every(e => e.scheduledWorkDays === 0) && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-sm text-amber-800" data-testid="alert-no-schedule">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">لا يوجد جدول دوام موقّع لهذا الفرع في هذا الشهر</p>
                      <p className="text-xs text-amber-700 mt-1">الأرقام تعتمد على سجلات الحضور المباشرة فقط. لحساب أدق، أنشئ الجدول الأسبوعي للموظفين من قسم "جدول الدوام".</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* شريط البحث والفلترة المتقدمة */}
            <Card data-testid="card-filters">
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-700">بحث وفلترة</span>
                    <Badge variant="secondary" data-testid="text-result-count">
                      عرض {filteredLines.length} من {salaryClosingData.length}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                        <X className="w-4 h-4 ml-1" />
                        مسح الفلاتر
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters((s) => !s)}
                      data-testid="button-toggle-filters"
                    >
                      <SlidersHorizontal className="w-4 h-4 ml-1" />
                      {showFilters ? "إخفاء" : "إظهار"}
                    </Button>
                  </div>
                </div>

                {showFilters && (
                  <div className="mt-3 space-y-3">
                    <div className="relative">
                      <Search className={`w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 ${isRTL ? "right-3" : "left-3"}`} />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="بحث بالاسم، الرقم الوظيفي، الوظيفة، البنك، الآيبان، الجنسية..."
                        className={isRTL ? "pr-9" : "pl-9"}
                        data-testid="input-search"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">الوظيفة</Label>
                        <Select value={jobTitleFilter} onValueChange={setJobTitleFilter}>
                          <SelectTrigger data-testid="select-filter-jobtitle"><SelectValue /></SelectTrigger>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            <SelectItem value="all">كل الوظائف</SelectItem>
                            {uniqueJobTitles.map((j) => (
                              <SelectItem key={j} value={j}>{j}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">الجنسية</Label>
                        <Select value={nationalityFilter} onValueChange={setNationalityFilter}>
                          <SelectTrigger data-testid="select-filter-nationality"><SelectValue /></SelectTrigger>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            <SelectItem value="all">كل الجنسيات</SelectItem>
                            {uniqueNationalities.map((n) => (
                              <SelectItem key={n} value={n}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">مصدر البيانات</Label>
                        <Select value={dataSourceFilter} onValueChange={setDataSourceFilter}>
                          <SelectTrigger data-testid="select-filter-datasource"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">كل المصادر</SelectItem>
                            <SelectItem value="signed_timesheet">تايم شيت موقّع</SelectItem>
                            <SelectItem value="schedule_attendance">جدول + بصمة</SelectItem>
                            <SelectItem value="attendance_only">بصمة فقط</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">الحالة</Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger data-testid="select-filter-status"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">الكل</SelectItem>
                            <SelectItem value="has_absence">لديه غياب</SelectItem>
                            <SelectItem value="has_deductions">لديه سُلف/خصومات</SelectItem>
                            <SelectItem value="no_work">غائب الشهر كامل</SelectItem>
                            <SelectItem value="no_bank">بدون بيانات بنكية</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">أقل صافي راتب</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={netMin}
                          onChange={(e) => setNetMin(e.target.value)}
                          placeholder="0"
                          data-testid="input-net-min"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">أعلى صافي راتب</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={netMax}
                          onChange={(e) => setNetMax(e.target.value)}
                          placeholder="∞"
                          data-testid="input-net-max"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">ترتيب حسب</Label>
                        <Select value={sortField} onValueChange={setSortField}>
                          <SelectTrigger data-testid="select-sort-field"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employeeName">الاسم</SelectItem>
                            <SelectItem value="employeeNumber">رقم الموظف</SelectItem>
                            <SelectItem value="jobTitle">الوظيفة</SelectItem>
                            <SelectItem value="presentDays">أيام الحضور</SelectItem>
                            <SelectItem value="absentDays">أيام الغياب</SelectItem>
                            <SelectItem value="totalHours">إجمالي الساعات</SelectItem>
                            <SelectItem value="baseSalary">الراتب الأساسي</SelectItem>
                            <SelectItem value="absenceDeduction">خصم الغياب</SelectItem>
                            <SelectItem value="netSalary">صافي الراتب</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">الاتجاه / الأعمدة</Label>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
                            data-testid="button-sort-order"
                          >
                            <ArrowUpDown className="w-4 h-4 ml-1" />
                            {sortOrder === "asc" ? "تصاعدي" : "تنازلي"}
                          </Button>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" data-testid="button-column-visibility" title="إظهار/إخفاء الأعمدة">
                                <SlidersHorizontal className="w-4 h-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56" align="end">
                              <div className="space-y-2">
                                <div className="text-xs font-semibold text-gray-700 border-b pb-1">الأعمدة الظاهرة</div>
                                {TOGGLEABLE_COLUMNS.map((c) => (
                                  <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={cols[c.key]}
                                      onChange={() => toggleCol(c.key)}
                                      data-testid={`checkbox-col-${c.key}`}
                                    />
                                    {c.label}
                                  </label>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* جدول الرواتب */}
            <Card>
              <CardContent className="py-3 overflow-x-auto">
                {filteredLines.length === 0 ? (
                  <div className="text-center py-10 text-gray-500" data-testid="empty-filtered">
                    <Search className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>لا توجد نتائج مطابقة للفلاتر الحالية</p>
                    {hasActiveFilters && (
                      <Button variant="link" onClick={clearFilters} data-testid="button-clear-filters-empty">مسح الفلاتر</Button>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className={isRTL ? "text-right" : "text-left"}>#</TableHead>
                        <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "رقم الموظف" : "Employee #"}</TableHead>
                        <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الاسم" : "Name"}</TableHead>
                        {cols.jobTitle && <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الوظيفة" : "Job Title"}</TableHead>}
                        {cols.bank && <TableHead className={isRTL ? "text-right" : "text-left"} title={isRTL ? "البنك ورقم الحساب البنكي / الآيبان (من ملف الموظف)" : "Bank & IBAN"}>{isRTL ? "البنك / الآيبان" : "Bank / IBAN"}</TableHead>}
                        {cols.workDays && <TableHead className="text-center" title={isRTL ? "أيام العمل المجدولة (من الجدول الموقّع)" : "Scheduled work days"}>{isRTL ? "أيام العمل" : "Work Days"}</TableHead>}
                        <TableHead className="text-center">{isRTL ? "الحضور" : "Present"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "الغياب" : "Absent"}</TableHead>
                        {cols.off && <TableHead className="text-center" title={isRTL ? "الإجازات (isOff في الجدول الموقّع)" : "Off days"}>{isRTL ? "الإجازات" : "Off"}</TableHead>}
                        {cols.hours && <TableHead className="text-center">{isRTL ? "الساعات" : "Hours"}</TableHead>}
                        {cols.salary && <TableHead className="text-center">{isRTL ? "الراتب" : "Salary"}</TableHead>}
                        {cols.allowances && <TableHead className="text-center">{isRTL ? "البدلات" : "Allowances"}</TableHead>}
                        {cols.dailyRate && <TableHead className="text-center" title={isRTL ? "قيمة اليوم = الراتب الإجمالي ÷ 30" : "Daily rate"}>{isRTL ? "قيمة اليوم" : "Daily Rate"}</TableHead>}
                        {cols.absenceDeduction && <TableHead className="text-center" title={isRTL ? "خصم الغياب = أيام الغياب × قيمة اليوم" : "Absence deduction"}>{isRTL ? "خصم الغياب" : "Absence Deduction"}</TableHead>}
                        {cols.insurance && <TableHead className="text-center">{isRTL ? "التأمينات" : "Insurance"}</TableHead>}
                        <TableHead className="text-center bg-orange-50" title={isRTL ? "السُلف والخصومات اليدوية الشهرية — اضغط للإضافة/التعديل" : "Manual advances & deductions"}>{isRTL ? "سُلف/خصومات" : "Advances/Deductions"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "الصافي" : "Net"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "قسيمة" : "Payslip"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLines.map((emp, index) => (
                        <TableRow key={emp.id} className={emp.noWorkAtAll ? "bg-red-50/60" : (emp.dataSource === "signed_timesheet" ? "bg-emerald-50/30" : "")}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell className="font-mono">{emp.employeeNumber}</TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{emp.employeeName}</span>
                              {emp.dataSource === "signed_timesheet" && (
                                <Badge
                                  className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] px-1.5 py-0"
                                  title={`تايم شيت موقّع #${emp.signedReportInfo?.id} — مصدر الحقيقة`}
                                  data-testid={`badge-signed-${emp.id}`}
                                >
                                  ✓ موقّع
                                </Badge>
                              )}
                              {emp.dataSource === "schedule_attendance" && (
                                <Badge
                                  className="bg-blue-100 text-blue-800 border-blue-300 text-[10px] px-1.5 py-0"
                                  title="محسوب من الجدول + البصمة (لا يوجد تايم شيت موقّع)"
                                  data-testid={`badge-schedule-${emp.id}`}
                                >
                                  جدول
                                </Badge>
                              )}
                              {emp.dataSource === "attendance_only" && !emp.noWorkAtAll && (
                                <Badge
                                  className="bg-orange-100 text-orange-800 border-orange-300 text-[10px] px-1.5 py-0"
                                  title="محسوب من البصمة فقط (لا يوجد جدول ولا تايم شيت موقّع)"
                                  data-testid={`badge-attendance-only-${emp.id}`}
                                >
                                  بصمة فقط
                                </Badge>
                              )}
                              {emp.noWorkAtAll && (
                                <Badge
                                  className="bg-red-100 text-red-800 border-red-400 text-[10px] px-1.5 py-0"
                                  title="لا يوجد أي حضور أو جدول أو تايم شيت موقّع لهذا الموظف خلال الشهر — يُحتسب غياب كامل والراتب يصير صفر"
                                  data-testid={`badge-no-work-${emp.id}`}
                                >
                                  ⚠️ غائب الشهر كامل
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          {cols.jobTitle && <TableCell>{emp.jobTitle}</TableCell>}
                          {cols.bank && (
                            <TableCell className="text-xs" data-testid={`cell-bank-${emp.id}`}>
                              {emp.bankAccountNumber || emp.bankName ? (
                                <div className="flex flex-col gap-0.5 leading-tight">
                                  {emp.bankName && (
                                    <span className="text-gray-700 font-medium">{emp.bankName}</span>
                                  )}
                                  {emp.bankAccountNumber && (
                                    <span className="font-mono text-[11px] text-gray-900" style={{ direction: "ltr", textAlign: "left" }}>
                                      {emp.bankAccountNumber}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0" title="لا توجد بيانات بنكية في ملف الموظف — أضفها من شاشة الموظفين">
                                  ⚠️ غير مسجّل
                                </Badge>
                              )}
                            </TableCell>
                          )}
                          {cols.workDays && (
                            <TableCell className="text-center">
                              <Badge className="bg-blue-100 text-blue-800">{emp.scheduledWorkDays}</Badge>
                            </TableCell>
                          )}
                          <TableCell className="text-center">
                            <Popover>
                              <PopoverTrigger asChild>
                                <button type="button" data-testid={`btn-present-${emp.id}`}>
                                  <Badge className="bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer">{emp.presentDays}</Badge>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-72 max-h-80 overflow-y-auto" side="top">
                                <div className="text-xs font-semibold mb-2 text-green-800">
                                  أيام الحضور المحتسبة ({emp.presentDays})
                                </div>
                                {emp.presentDates.length === 0 ? (
                                  <p className="text-xs text-gray-500">لا توجد أيام حضور.</p>
                                ) : (
                                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                                    {emp.presentDates.map((d: string) => (
                                      <div key={d} className="bg-green-50 px-2 py-1 rounded text-center font-mono">{d}</div>
                                    ))}
                                  </div>
                                )}
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                          <TableCell className="text-center">
                            <Popover>
                              <PopoverTrigger asChild>
                                <button type="button" data-testid={`btn-absent-${emp.id}`}>
                                  <Badge className="bg-red-100 text-red-800 hover:bg-red-200 cursor-pointer">{emp.absentDays}</Badge>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 max-h-96 overflow-y-auto" side="top">
                                <div className="text-xs font-semibold mb-2 text-red-800">
                                  أيام الغياب المحتسبة ({emp.absentDays})
                                </div>
                                {emp.absentDays === 0 ? (
                                  <p className="text-xs text-gray-500">لا توجد أيام غياب.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {emp.absentDatesExplicit.length > 0 && (
                                      <div>
                                        <div className="text-[11px] font-semibold text-red-700 mb-1">
                                          مسجل كغياب صريح ({emp.absentDatesExplicit.length}):
                                        </div>
                                        <div className="grid grid-cols-2 gap-1 text-[11px]">
                                          {emp.absentDatesExplicit.map((d: string) => (
                                            <div key={d} className="bg-red-50 px-2 py-1 rounded text-center font-mono">{d}</div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {emp.absentDatesMissing.length > 0 && (
                                      <div>
                                        <div className="text-[11px] font-semibold text-orange-700 mb-1">
                                          يوم مجدول بدون سجل حضور ({emp.absentDatesMissing.length}):
                                        </div>
                                        <div className="grid grid-cols-2 gap-1 text-[11px]">
                                          {emp.absentDatesMissing.map((d: string) => (
                                            <div key={d} className="bg-orange-50 px-2 py-1 rounded text-center font-mono">{d}</div>
                                          ))}
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-1">
                                          لو تم تسجيل الحضور لاحقاً، سيتم إعادة الحساب تلقائياً.
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                          {cols.off && (
                            <TableCell className="text-center">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button type="button" data-testid={`btn-off-${emp.id}`}>
                                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer">{emp.offDays}</Badge>
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 max-h-80 overflow-y-auto" side="top">
                                  <div className="text-xs font-semibold mb-2 text-amber-800">
                                    أيام الإجازة ({emp.offDays})
                                  </div>
                                  {emp.offDates.length === 0 ? (
                                    <p className="text-xs text-gray-500">لا توجد أيام إجازة.</p>
                                  ) : (
                                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                                      {emp.offDates.map((d: string) => (
                                        <div key={d} className="bg-amber-50 px-2 py-1 rounded text-center font-mono">{d}</div>
                                      ))}
                                    </div>
                                  )}
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                          )}
                          {cols.hours && <TableCell className="text-center">{emp.totalHours}</TableCell>}
                          {cols.salary && <TableCell className="text-center">{formatCurrency(emp.baseSalary, isRTL)}</TableCell>}
                          {cols.allowances && <TableCell className="text-center">{formatCurrency(emp.allowances, isRTL)}</TableCell>}
                          {cols.dailyRate && <TableCell className="text-center text-gray-600 text-xs">{formatCurrency(emp.dailyRate, isRTL)}</TableCell>}
                          {cols.absenceDeduction && (
                            <TableCell className="text-center text-red-600">
                              {emp.absenceDeduction > 0 ? `- ${formatCurrency(emp.absenceDeduction, isRTL)}` : "-"}
                            </TableCell>
                          )}
                          {cols.insurance && (
                            <TableCell className="text-center text-red-600">
                              {emp.socialInsurance > 0 ? `- ${formatCurrency(emp.socialInsurance, isRTL)}` : "-"}
                            </TableCell>
                          )}
                          <TableCell className="text-center bg-orange-50/40">
                            {salaryClosingIsLocked ? (
                              <span className="text-red-600" data-testid={`text-locked-deductions-${emp.id}`}>
                                {(emp.manualDeductionsTotal || 0) > 0 ? `- ${formatCurrency(emp.manualDeductionsTotal || 0, isRTL)}` : "-"}
                              </span>
                            ) : (
                              <DeductionsPopover
                                branchEmployeeId={emp.id}
                                branchId={branch}
                                month={month}
                                employeeName={emp.employeeName}
                                initialDeductions={emp.manualDeductions || []}
                                totalAmount={emp.manualDeductionsTotal || 0}
                                onChanged={refreshSalaryClosing}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-center font-bold">{formatCurrency(emp.netSalary, isRTL)}</TableCell>
                          <TableCell className="text-center">
                            {salaryClosingIsLocked && savedClosureId && closureLineIdByBranchEmployee.has(Number(emp.branchEmployeeId ?? emp.id)) ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-blue-700"
                                onClick={() => {
                                  const lineId = closureLineIdByBranchEmployee.get(Number(emp.branchEmployeeId ?? emp.id))!;
                                  downloadFile(
                                    `/api/salary-closing/${savedClosureId}/payslip/${lineId}`,
                                    `payslip_${month}_${emp.employeeNumber || emp.id}.pdf`
                                  );
                                }}
                                data-testid={`button-payslip-${emp.id}`}
                                title="تحميل قسيمة الراتب"
                              >
                                <Download className="w-3.5 h-3.5 ml-1" />
                                قسيمة
                              </Button>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {branchActive && !previewLoading && salaryClosingData.length === 0 && (
          <div className="text-center py-16 text-gray-500" data-testid="empty-no-employees">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{isRTL ? "لا يوجد موظفين نشطين في هذا الفرع" : "No active employees in this branch"}</p>
          </div>
        )}

        {!branchActive && (
          <div className="text-center py-16 text-gray-500" data-testid="empty-no-branch">
            <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>اختر الفرع والشهر لعرض تقرير إغلاق الرواتب</p>
          </div>
        )}

        {/* تأكيد إغلاق الشهر */}
        <Dialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
          <DialogContent className="max-w-md" data-testid="dialog-close-confirm">
            <DialogHeader>
              <DialogTitle>تأكيد إغلاق الشهر نهائياً</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>
                سيتم حفظ لقطة ثابتة لرواتب <strong>{getBranchName(branch)}</strong> لشهر{" "}
                <strong>{month}</strong> وقفل الشهر. لن يمكن التعديل بعد الإغلاق إلا بإعادة فتحه (مدير فقط).
              </p>
              {salaryClosingBlockingWarnings.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                  <p className="font-bold text-red-800">
                    تحذير: {formatNumber(salaryClosingBlockingWarnings.length)} موظف بدون أي بيانات حضور (الراتب = 0).
                  </p>
                  <label className="flex items-center gap-2 text-red-700">
                    <input
                      type="checkbox"
                      checked={acknowledgeClose}
                      onChange={(e) => setAcknowledgeClose(e.target.checked)}
                      data-testid="checkbox-acknowledge-warnings"
                    />
                    أؤكد أنني راجعت هذه الحالات وأرغب في المتابعة
                  </label>
                </div>
              )}
              <div>
                <label className="text-sm font-medium">ملاحظات (اختياري)</label>
                <Textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="أي ملاحظات على هذا الإغلاق..."
                  data-testid="input-close-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCloseConfirm(false)} data-testid="button-cancel-close">
                إلغاء
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={
                  closeSalaryMutation.isPending ||
                  (salaryClosingBlockingWarnings.length > 0 && !acknowledgeClose)
                }
                onClick={() => {
                  closeSalaryMutation.mutate(
                    { acknowledgeWarnings: acknowledgeClose, notes: closeNotes || undefined },
                    { onSuccess: () => setShowCloseConfirm(false) }
                  );
                }}
                data-testid="button-confirm-close"
              >
                {closeSalaryMutation.isPending ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 ml-2" />}
                تأكيد الإغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* إعادة فتح الإغلاق */}
        <Dialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
          <DialogContent className="max-w-md" data-testid="dialog-reopen">
            <DialogHeader>
              <DialogTitle>إعادة فتح الإغلاق</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>سيتم فتح الشهر للتعديل من جديد. هذا الإجراء مسجّل في سجل التدقيق.</p>
              <div>
                <label className="text-sm font-medium">سبب إعادة الفتح <span className="text-red-600">*</span></label>
                <Textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="اذكر سبب إعادة الفتح..."
                  data-testid="input-reopen-reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReopenDialog(false)} data-testid="button-cancel-reopen">
                إلغاء
              </Button>
              <Button
                variant="destructive"
                disabled={reopenSalaryMutation.isPending || reopenReason.trim().length === 0 || !salaryClosingClosure}
                onClick={() => {
                  if (!salaryClosingClosure) return;
                  reopenSalaryMutation.mutate(
                    { id: salaryClosingClosure.id, reason: reopenReason.trim() },
                    { onSuccess: () => setShowReopenDialog(false) }
                  );
                }}
                data-testid="button-confirm-reopen"
              >
                {reopenSalaryMutation.isPending ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
                إعادة الفتح
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ربط سجلات الحضور غير المرتبطة */}
        <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
          <DialogContent className="max-w-2xl" data-testid="dialog-link-attendance">
            <DialogHeader>
              <DialogTitle>ربط سجلات الحضور غير المرتبطة</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto">
              <p className="text-gray-600">
                تم تجميع السجلات حسب الموظف. النظام يقترح أقرب موظف تلقائياً — تأكّد من الاختيار ثم اضغط "ربط الكل". سيُعاد احتساب الرواتب تلقائياً.
              </p>
              {unlinkedGroups.length === 0 && (
                <p className="text-center text-gray-500 py-6">لا توجد سجلات غير مرتبطة.</p>
              )}
              {unlinkedGroups.length > 0 && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={
                      bulkLinkMutation.isPending ||
                      !unlinkedGroups.some(
                        (g) => groupSel[g.key] ?? (g.suggestion?.confidence === "high" ? String(g.suggestion.employee.id) : ""),
                      )
                    }
                    onClick={async () => {
                      for (const g of unlinkedGroups) {
                        const sel = groupSel[g.key] ?? (g.suggestion?.confidence === "high" ? String(g.suggestion.employee.id) : "");
                        if (!sel) continue;
                        await bulkLinkMutation.mutateAsync({
                          attendanceIds: g.records.map((r: any) => r.id),
                          branchEmployeeId: Number(sel),
                        });
                      }
                    }}
                    data-testid="button-link-all-suggested"
                  >
                    {bulkLinkMutation.isPending ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
                    ربط المطابقات المؤكدة
                  </Button>
                </div>
              )}
              {unlinkedGroups.map((g) => {
                const sel = groupSel[g.key] ?? (g.suggestion ? String(g.suggestion.employee.id) : "");
                return (
                  <div key={g.key} className="flex items-center gap-2 border rounded-lg p-2" data-testid={`row-unlinked-group-${g.key}`}>
                    <div className="flex-1 text-xs">
                      <div className="font-medium">
                        {g.name || `سجل #${g.records[0]?.id}`}
                        {g.employeeNumber ? ` (${g.employeeNumber})` : ""}
                      </div>
                      <div className="text-gray-500">
                        {g.records.length} يوم/سجل
                        {g.suggestion ? (
                          <span className={g.suggestion.confidence === "high" ? "text-emerald-600" : "text-amber-600"}>
                            {" "}· {g.suggestion.confidence === "high" ? "مطابقة مؤكدة" : "اقتراح تقريبي — راجعه"}: {g.suggestion.employee.employeeName || g.suggestion.employee.name}
                          </span>
                        ) : (
                          <span className="text-amber-600"> · لا يوجد اقتراح — اختر يدوياً</span>
                        )}
                      </div>
                    </div>
                    <Select
                      value={sel}
                      onValueChange={(v) => setGroupSel((prev) => ({ ...prev, [g.key]: v }))}
                    >
                      <SelectTrigger className="w-56" data-testid={`select-link-employee-${g.key}`}>
                        <SelectValue placeholder="اختر الموظف" />
                      </SelectTrigger>
                      <SelectContent>
                        {(salaryClosingBundle?.employees ?? []).map((emp: any) => (
                          <SelectItem key={emp.id} value={String(emp.id)}>
                            {emp.employeeName || emp.name}{emp.employeeNumber ? ` (${emp.employeeNumber})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={bulkLinkMutation.isPending || !sel}
                      onClick={() =>
                        bulkLinkMutation.mutate({
                          attendanceIds: g.records.map((r: any) => r.id),
                          branchEmployeeId: Number(sel),
                        })
                      }
                      data-testid={`button-link-group-${g.key}`}
                    >
                      ربط الكل ({g.records.length})
                    </Button>
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLinkDialog(false)} data-testid="button-close-link-dialog">
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
