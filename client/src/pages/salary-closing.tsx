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
  DialogDescription,
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
import { usePermissions } from "@/hooks/usePermissions";
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
  History,
  Building2,
  Landmark,
  TrendingUp,
  TrendingDown,
  Minus,
  FileBarChart2,
} from "lucide-react";
import { printHtmlDocument } from "@/lib/export-utils";
import type { BranchEmployee, AttendanceRecord, SalaryDeduction } from "@shared/schema";
import { SALARY_DEDUCTION_TYPE_LABELS, LEAVE_TYPE_LABELS, SALARY_PAYMENT_METHOD_LABELS, type SalaryPayment } from "@shared/schema";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Checkbox } from "@/components/ui/checkbox";

// تسميات حالة الموظف — تُعرض كملاحظة بجوار الاسم في تقرير إغلاق الرواتب
const EMPLOYEE_STATUS_LABELS: Record<string, string> = {
  active: "نشط",
  inactive: "غير نشط",
  terminated: "منتهي الخدمة",
  on_leave: "في إجازة",
  unknown: "غير معروف",
};
const employeeStatusLabel = (s: string | null | undefined) =>
  s ? (EMPLOYEE_STATUS_LABELS[s] || s) : "";

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
  canEdit,
}: {
  branchEmployeeId: number;
  branchId: string;
  month: string;
  employeeName: string;
  initialDeductions: SalaryDeduction[];
  totalAmount: number;
  onChanged: () => void;
  canEdit: boolean;
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
                  {canEdit && (
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
                  )}
                </div>
              ))}
              <div className="text-xs font-bold text-orange-900 text-left pt-1 border-t border-orange-200">
                الإجمالي: - {totalAmount.toLocaleString("ar-SA-u-nu-latn", { maximumFractionDigits: 2 })} ر.س
              </div>
            </div>
          )}

          {canEdit && (
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
          )}

          <div className="text-[10px] text-gray-500 pt-1 border-t">
            💡 المبلغ المُسجَّل سيُخصم من صافي الراتب تلقائياً عند إغلاق هذا الشهر.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ===== تأشير صرف الراتب وتحديد طريقة الدفع (حوالة بنكية / حماية أجور / نقدي) =====
function PaymentStatusPopover({
  branchEmployeeId,
  month,
  employeeName,
  netSalary,
  payment,
  onChanged,
}: {
  branchEmployeeId: number;
  month: string;
  employeeName: string;
  netSalary: number;
  payment: SalaryPayment | undefined;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<string>(payment?.paymentMethod || "bank_transfer");

  useEffect(() => {
    setMethod(payment?.paymentMethod || "bank_transfer");
  }, [payment?.paymentMethod]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/salary-closing/payments", {
        branchEmployeeId,
        month,
        paymentMethod: method,
        amount: netSalary,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم تسجيل الصرف", description: `${employeeName} — ${SALARY_PAYMENT_METHOD_LABELS[method] || method}` });
      setOpen(false);
      onChanged();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/salary-closing/payments", { branchEmployeeId, month });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم إلغاء التأشير", description: `${employeeName} — أصبح ضمن المتبقّي` });
      setOpen(false);
      onChanged();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={`btn-payment-${branchEmployeeId}`}
          className="flex items-center justify-center w-full hover:opacity-80 transition-opacity"
          title="تأشير صرف الراتب وطريقة الدفع"
        >
          {payment ? (
            <Badge className="bg-green-100 text-green-800 border-green-300 cursor-pointer text-[11px] px-1.5 py-0" data-testid={`badge-paid-${branchEmployeeId}`}>
              ✓ {SALARY_PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod}
            </Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-600 border-gray-300 cursor-pointer text-[11px] px-1.5 py-0" data-testid={`badge-unpaid-${branchEmployeeId}`}>
              متبقّي
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64" side="top">
        <div className="space-y-3">
          <div className="border-b pb-2">
            <div className="text-sm font-bold text-gray-900">حالة صرف الراتب</div>
            <div className="text-xs text-gray-600">{employeeName} — {month}</div>
          </div>
          <div>
            <Label className="text-[11px]">طريقة الدفع</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="h-8 text-xs" data-testid={`select-payment-method-${branchEmployeeId}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SALARY_PAYMENT_METHOD_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-[11px] text-gray-500">
            المبلغ المسجّل: {netSalary.toLocaleString("ar-SA-u-nu-latn", { maximumFractionDigits: 2 })} ر.س
          </div>
          <Button
            type="button"
            size="sm"
            className="w-full h-8 text-xs bg-green-600 hover:bg-green-700"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid={`btn-mark-paid-${branchEmployeeId}`}
          >
            {payment ? "تحديث طريقة الدفع" : "تأشير: تم الصرف"}
          </Button>
          {payment && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs text-red-600 hover:text-red-700"
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
              data-testid={`btn-unmark-paid-${branchEmployeeId}`}
            >
              إلغاء التأشير (إرجاع للمتبقّي)
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ===== تعديل أيام الحضور اليدوي (للأدمن ومدير الموارد البشرية فقط، قبل الإغلاق) =====
function AttendanceAdjustmentPopover({
  branchEmployeeId,
  month,
  employeeName,
  presentDays,
  presentDates,
  originalPresentDays,
  adjustmentReason,
  adjustmentBy,
  canEdit,
  onChanged,
}: {
  branchEmployeeId: number;
  month: string;
  employeeName: string;
  presentDays: number;
  presentDates: string[];
  originalPresentDays: number | null;
  adjustmentReason: string | null;
  adjustmentBy: string | null;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const isAdjusted = originalPresentDays !== null && originalPresentDays !== undefined;
  const [days, setDays] = useState<string>(String(presentDays));
  const [reason, setReason] = useState<string>(adjustmentReason || "");

  useEffect(() => {
    setDays(String(presentDays));
    setReason(adjustmentReason || "");
  }, [presentDays, adjustmentReason, open]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/employee-reports/bundle", "salary-closing"] });
    onChanged();
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: { adjustedPresentDays: number; reason: string }) => {
      const res = await fetch("/api/salary-closing/attendance-adjustment", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchEmployeeId,
          month,
          adjustedPresentDays: payload.adjustedPresentDays,
          reason: payload.reason,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "فشل الحفظ");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم الحفظ", description: "تم تعديل أيام الحضور بنجاح" });
      setOpen(false);
      refresh();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/salary-closing/attendance-adjustment", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchEmployeeId, month }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "فشل الحذف");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم الإلغاء", description: "تمت إعادة أيام الحضور للقيمة المحتسبة" });
      setOpen(false);
      refresh();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    const n = parseInt(days, 10);
    if (!Number.isInteger(n) || n < 0 || n > 31) {
      toast({ title: "عدد غير صحيح", description: "أدخل عدد أيام بين 0 و 31", variant: "destructive" });
      return;
    }
    if (reason.trim().length < 3) {
      toast({ title: "السبب إلزامي", description: "اكتب سبب التعديل (3 أحرف على الأقل)", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ adjustedPresentDays: n, reason: reason.trim() });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" data-testid={`btn-present-${branchEmployeeId}`} className="relative">
          <Badge
            className={isAdjusted
              ? "bg-amber-100 text-amber-900 border border-amber-400 hover:bg-amber-200 cursor-pointer"
              : "bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer"}
          >
            {presentDays}{isAdjusted ? " ✎" : ""}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-[480px] overflow-y-auto" side="top">
        <div className="space-y-3">
          <div className="border-b pb-2">
            <div className="text-sm font-bold text-gray-900">أيام الحضور</div>
            <div className="text-xs text-gray-600">{employeeName} — {month}</div>
          </div>

          {isAdjusted && (
            <div className="rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900 space-y-0.5" data-testid={`adjustment-info-${branchEmployeeId}`}>
              <div className="font-bold">⚠ تم تعديل أيام الحضور يدوياً</div>
              <div>المحتسبة قبل التعديل: <strong>{originalPresentDays}</strong> ← بعد التعديل: <strong>{presentDays}</strong></div>
              {adjustmentReason && <div>السبب: {adjustmentReason}</div>}
              {adjustmentBy && <div>قام بالتعديل: {adjustmentBy}</div>}
            </div>
          )}

          <div>
            <div className="text-xs font-semibold mb-1 text-green-800">
              أيام الحضور المحتسبة ({presentDates.length})
            </div>
            {presentDates.length === 0 ? (
              <p className="text-xs text-gray-500">لا توجد أيام حضور.</p>
            ) : (
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                {presentDates.map((d: string) => (
                  <div key={d} className="bg-green-50 px-2 py-1 rounded text-center font-mono">{d}</div>
                ))}
              </div>
            )}
          </div>

          {canEdit && (
            <div className="space-y-2 pt-2 border-t">
              <div className="text-xs font-semibold text-gray-700">تعديل عدد أيام الحضور المعتمدة:</div>
              <div className="text-[10px] text-gray-500">
                يُستخدم عند تعطّل نظام البصمة/التوقيع. التعديل يقلّل خصم الغياب ويرفع الصافي تلقائياً.
              </div>
              <div>
                <Label className="text-[11px]">عدد أيام الحضور المعتمد</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="31"
                  step="1"
                  value={days}
                  onChange={e => setDays(e.target.value)}
                  className="h-8 text-xs"
                  data-testid={`input-adjusted-present-${branchEmployeeId}`}
                />
              </div>
              <div>
                <Label className="text-[11px]">سبب التعديل (إلزامي)</Label>
                <Textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="مثال: تعطّل جهاز البصمة يومي 3 و 4"
                  className="text-xs min-h-[56px]"
                  data-testid={`input-adjustment-reason-${branchEmployeeId}`}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs flex-1"
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  data-testid={`btn-save-adjustment-${branchEmployeeId}`}
                >
                  حفظ التعديل
                </Button>
                {isAdjusted && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-red-600 hover:text-red-700"
                    onClick={() => {
                      if (confirm("إلغاء التعديل وإعادة أيام الحضور للقيمة المحتسبة تلقائياً؟")) {
                        removeMutation.mutate();
                      }
                    }}
                    disabled={removeMutation.isPending}
                    data-testid={`btn-remove-adjustment-${branchEmployeeId}`}
                  >
                    إلغاء التعديل
                  </Button>
                )}
              </div>
            </div>
          )}
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

// ===== ملف البنك (نموذج بنك الرياض - نظام مدد) =====
// قائمة رموز البنوك (SWIFT/BIC) للبنوك السعودية - مطابقة لشيت "data" في النموذج
const BANK_DATA_CURRENCIES: [string, string][] = [
  ["AED", "UAE DIRHAM"], ["AUD", "AUSTRALIAN DOLLAR"], ["BHD", "BAHRAINI DINAR"],
  ["CAD", "CANADIAN DOLLAR"], ["CHF", "SWISS FRANC"], ["DKK", "DANISH KRONE"],
  ["EGP", "EGYPTIAN POUND"], ["EUR", "EURO CURRENCY"], ["GBP", "POUND STERLING"],
  ["HKD", "HONG KONG DOLLAR"], ["IDR", "INDONESIAN RUPIAH"], ["INR", "INDIAN RUPEE"],
  ["JOD", "JORDANIAN DINAR"], ["JPY", "JAPANESE YEN"], ["KWD", "KUWAITI DINAR"],
  ["MAD", "MOROCCAN DIRHAM"], ["NOK", "NORWEGIAN"], ["NZD", "NEW ZEALAND DOLLAR"],
  ["OMR", "OMANI RIYAL"], ["PHP", "PHILIPPINE PESO"], ["PKR", "PAKISTAN RUPEE"],
  ["QAR", "QATARI RIYAL"], ["SAR", "SAUDI RIYAL"], ["SEK", "SWEDISH KRONE"],
  ["SGD", "SINGAPORE DOLLAR"], ["TRL", "TURKISH LIRA"], ["USD", "US DOLLAR"],
  ["YER", "YEMENI RIYAL"], ["ZAR", "SOUTH AFRICAN RAND"],
];
const BANK_DATA_CODES: [string, string][] = [
  ["AAALSARIXXX", "SAUDI HOLLANDI BANK"], ["ALBISARIXXX", "BANK AL BILAD"],
  ["ARNBSARIXXX", "ARAB NATIONAL BANK"], ["BJAZSAJEXXX", "BANK AL-JAZIRA"],
  ["BMUSSARIXXX", "BANK MUSCAT"], ["BNPASARIXXX", "BNP PARIBAS SAUDI ARABIA"],
  ["BOTKSARIXXX", "MUFG BANK, LTD. RIYADH BRANCH"], ["BSFRSARIXXX", "BANQUE SAUDI FRANSI"],
  ["CHASSARIXXX", "JPMORGAN CHASE BANK, N.A. RIYADH"], ["DEUTSARIXXX", "DEUTSCHE BANK"],
  ["EBILSARIXXX", "EMIRATES BANK INTERNATIONAL PJSC"], ["FABMSARIXXX", "FIRST ABU DHABI BANK"],
  ["GULFSARIXXX", "GULF INTERNATIONAL BANK B.S.C., RIY"],
  ["ICBKSARIXXX", "INDUSTRIAL AND COMMERCIAL BANK OF CHINA RIYADH BRANCH, SA"],
  ["INMASARIXXX", "AL INMA BANK"], ["NBOBSARIXXX", "NATIONAL BANK OF BAHRAIN"],
  ["NBOKSAJEXXX", "NATIONAL BANK OF KWIT"], ["NBPASARIXXX", "NATIONAL BANK OF PAKISTAN"],
  ["NCBKSAJEXXX", "NATIONAL COMMERCIAL BANK"], ["RIBLSARIXXX", "RIYAD BANK"],
  ["RJHISARIXXX", "ALRAJHI BANKING AND INVESTMENT CORP"], ["SABBSARIXXX", "SAUDI BRITISH BANK"],
  ["SAMASARIXXX", "SAMA"], ["SAMBSARIXXX", "BANK SAMBA"], ["SBINSAJEXXX", "STATE BANK OF INDIA"],
  ["SIBCSARIXXX", "THE SAUDI INVESTMENT BANK"], ["TCZBSAJEXX", "T.C. ZIRAAT BANKASI A.S."],
  ["DBAKSARIXXX", "D360 Bank"], ["STCJSARIXXX", "STC Bank"],
];
// كلمات مفتاحية (بالعربي والإنجليزي) لمطابقة اسم البنك المسجّل مع رمز SWIFT
const BANK_SWIFT_KEYWORDS: { swift: string; keys: string[] }[] = [
  { swift: "RJHISARIXXX", keys: ["راجحي", "rajhi", "rajh"] },
  { swift: "RIBLSARIXXX", keys: ["رياض", "riyad", "ribl"] },
  { swift: "NCBKSAJEXXX", keys: ["اهلي", "snb", "ncb", "alahli", "saudi national"] },
  { swift: "INMASARIXXX", keys: ["انماء", "inma"] },
  { swift: "BSFRSARIXXX", keys: ["فرنسي", "fransi", "bsf"] },
  { swift: "SABBSARIXXX", keys: ["ساب", "بريطاني", "sabb", "british"] },
  { swift: "ARNBSARIXXX", keys: ["عربي", "arab national", "anb", "arnb"] },
  { swift: "ALBISARIXXX", keys: ["بلاد", "bilad"] },
  { swift: "BJAZSAJEXXX", keys: ["جزير", "jazira", "bjaz"] },
  { swift: "SIBCSARIXXX", keys: ["استثمار", "investment", "saib"] },
  { swift: "STCJSARIXXX", keys: ["stc", "اس تي سي"] },
  { swift: "DBAKSARIXXX", keys: ["d360", "360", "دي 360"] },
  { swift: "AAALSARIXXX", keys: ["هولندي", "الاول", "awwal", "hollandi"] },
  { swift: "SAMBSARIXXX", keys: ["سامبا", "samba"] },
];
// استنتاج رمز البنك (SWIFT) من اسم البنك المسجّل للموظف؛ يعيد فراغاً عند عدم التطابق ليُعبَّأ يدوياً
function bankNameToSwift(name: any): string {
  const n = normalizeArabicName(name);
  if (!n.trim()) return "";
  for (const { swift, keys } of BANK_SWIFT_KEYWORDS) {
    if (keys.some((k) => n.includes(normalizeArabicName(k)))) return swift;
  }
  return "";
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
  { key: "off", label: "الراحات الأسبوعية" },
  { key: "leaves", label: "الإجازات (بالنوع)" },
  { key: "hours", label: "الساعات" },
  { key: "salary", label: "الراتب" },
  { key: "allowances", label: "البدلات" },
  { key: "dailyRate", label: "قيمة اليوم" },
  { key: "absenceDeduction", label: "خصم الغياب" },
  { key: "sickLeaveDeduction", label: "خصم المرضية (75%)" },
  { key: "insurance", label: "التأمينات" },
];

// =====================================================
// حفظ تفضيلات الفلاتر والأعمدة في متصفح المستخدم
// =====================================================
const LS_PREFIX = "salaryClosing.";
function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw != null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function usePersistedState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => loadLS(key, initial));
  useEffect(() => {
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(state));
    } catch {
      /* تجاهل أخطاء التخزين */
    }
  }, [key, state]);
  return [state, setState] as const;
}

export default function SalaryClosingPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();
  const { canEdit: canEditModule } = usePermissions();
  const isHrManager = user?.role === "hr_manager";
  // Salary closing is a core financial function: allow anyone with salary_closing:edit
  // (e.g. financial_manager via role template) in addition to admin / HR manager.
  const canCloseSalary = isAdmin || isHrManager || canEditModule("salary_closing");
  const canApproveSalaryClosing = isAdmin || isHrManager || canEditModule("salary_closing");
  // Manual salary deductions/advances write to /api/salary-deductions (branch_employees:edit),
  // which a monitoring-only financial_manager lacks — gate that UI separately to avoid 403s.
  const canManageDeductions = isAdmin || isHrManager || canEditModule("branch_employees");

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
  const [bankExportOpen, setBankExportOpen] = useState(false);
  const [bankDueDate, setBankDueDate] = useState<string>("");
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [groupSel, setGroupSel] = useState<Record<string, string>>({});
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showOverviewDialog, setShowOverviewDialog] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [recordSel, setRecordSel] = useState<Record<number, string>>({});
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<number>>(new Set());
  const [showBulkDeductionDialog, setShowBulkDeductionDialog] = useState(false);
  const [bulkType, setBulkType] = useState<string>("advance");
  const [bulkAmount, setBulkAmount] = useState<string>("");
  const [bulkDescription, setBulkDescription] = useState<string>("");

  // حالة البحث والفلترة المتقدمة (تؤثر على الجدول فقط) — محفوظة في المتصفح
  const [search, setSearch] = useState("");
  const [jobTitleFilter, setJobTitleFilter] = usePersistedState("jobTitleFilter", "all");
  const [nationalityFilter, setNationalityFilter] = usePersistedState("nationalityFilter", "all");
  const [dataSourceFilter, setDataSourceFilter] = usePersistedState("dataSourceFilter", "all");
  const [statusFilter, setStatusFilter] = usePersistedState("statusFilter", "all");
  const [bankFilter, setBankFilter] = usePersistedState("bankFilter", "all");
  const [paymentStatusFilter, setPaymentStatusFilter] = usePersistedState("paymentStatusFilter", "all");
  const [paymentMethodFilter, setPaymentMethodFilter] = usePersistedState("paymentMethodFilter", "all");
  const [netMin, setNetMin] = usePersistedState("netMin", "");
  const [netMax, setNetMax] = usePersistedState("netMax", "");
  const [sortField, setSortField] = usePersistedState("sortField", "employeeName");
  const [sortOrder, setSortOrder] = usePersistedState<"asc" | "desc">("sortOrder", "asc");
  const [showFilters, setShowFilters] = usePersistedState("showFilters", true);
  const [cols, setCols] = usePersistedState<Record<string, boolean>>("cols", {
    jobTitle: true,
    bank: true,
    workDays: true,
    off: true,
    leaves: true,
    hours: true,
    salary: true,
    allowances: true,
    dailyRate: true,
    absenceDeduction: true,
    sickLeaveDeduction: true,
    insurance: true,
  });
  const toggleCol = (k: string) => setCols((p) => ({ ...p, [k]: !p[k] }));

  // ترحيل قيمة محفوظة قديمة: خيار "بدون بيانات بنكية" انتقل من فلتر الحالة إلى فلتر الحساب البنكي
  useEffect(() => {
    if (statusFilter === "no_bank") {
      setStatusFilter("all");
      setBankFilter("no_bank");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const branchActive = !!branch && branch !== "all";
  const isAllBranches = branch === "all";
  // عرض البيانات مفعّل عند اختيار فرع محدد أو "كل الفروع"
  const dataActive = branchActive || isAllBranches;

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
    enabled: dataActive && !!month,
    staleTime: 30_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(2000 * (attempt + 1), 5000),
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

  // سجل الإغلاقات السابقة عبر كل الفروع/الأشهر المسموح بها
  const closuresHistoryQuery = useQuery<any[]>({
    queryKey: ["/api/salary-closing/list"],
    queryFn: async () => {
      const res = await fetch(`/api/salary-closing/list`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch salary closures history");
      return res.json();
    },
    enabled: showHistoryDialog || showOverviewDialog,
    staleTime: 30_000,
  });
  const closuresHistory = closuresHistoryQuery.data ?? [];

  // مقارنة بالشهر السابق (#6)
  const prevMonth = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    if (!y || !m) return "";
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [month]);

  const prevPreviewQuery = useQuery<{ lines: any[] }>({
    queryKey: ["/api/salary-closing/preview", branch, prevMonth],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("branchId", branch);
      params.set("month", prevMonth);
      const res = await fetch(`/api/salary-closing/preview?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch previous month preview");
      return res.json();
    },
    enabled: branchActive && !!prevMonth,
    staleTime: 30_000,
  });
  const prevTotals = useMemo(() => {
    const lines = prevPreviewQuery.data?.lines ?? [];
    return {
      hasData: lines.length > 0,
      count: lines.length,
      gross: lines.reduce((s: number, e: any) => s + (e.grossSalary || 0), 0),
      net: lines.reduce((s: number, e: any) => s + (e.netSalary || 0), 0),
    };
  }, [prevPreviewQuery.data]);

  const renderDelta = (label: string, current: number, prev: number, currency: boolean) => {
    const diff = current - prev;
    const pct = prev !== 0 ? (diff / prev) * 100 : 0;
    const up = diff > 0;
    const down = diff < 0;
    const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
    const color = up ? "text-emerald-600" : down ? "text-red-600" : "text-gray-400";
    const val = currency ? formatCurrency(Math.abs(diff), isRTL) : formatNumber(Math.abs(diff));
    return (
      <span className={`inline-flex items-center gap-1 ${color}`} data-testid={`delta-${label}`}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-gray-600">{label}:</span>
        <span className="font-semibold">{diff === 0 ? "بدون تغيير" : `${up ? "+" : "-"}${val}`}</span>
        {prev !== 0 && diff !== 0 && (
          <span className="text-[10px]">({pct > 0 ? "+" : ""}{pct.toFixed(0)}%)</span>
        )}
      </span>
    );
  };

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

  // امسح التحديد عند تغيير الفرع/الشهر/حالة القفل لتجنّب تطبيق خصم على موظفين من سياق سابق
  useEffect(() => {
    setSelectedEmpIds(new Set());
    setShowBulkDeductionDialog(false);
  }, [branch, month, salaryClosingIsLocked]);
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

  // ===== سجلات صرف الرواتب (مدفوع/متبقّي + طريقة الدفع) =====
  const salaryPaymentsQuery = useQuery<SalaryPayment[]>({
    queryKey: ["/api/salary-closing/payments", branch, month],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("branchId", branch);
      params.set("month", month);
      const res = await fetch(`/api/salary-closing/payments?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch salary payments");
      return res.json();
    },
    enabled: dataActive && !!month,
    staleTime: 30_000,
  });
  const salaryPayments = salaryPaymentsQuery.data ?? [];
  const paymentByEmp = useMemo(() => {
    const m = new Map<number, SalaryPayment>();
    for (const p of salaryPayments) m.set(Number(p.branchEmployeeId), p);
    return m;
  }, [salaryPayments]);
  const refreshPayments = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/salary-closing/payments"] });
  };
  const fetchLatestPayments = async (): Promise<Map<number, SalaryPayment>> => {
    try {
      const r = await salaryPaymentsQuery.refetch();
      const list = r.data ?? salaryPayments;
      const m = new Map<number, SalaryPayment>();
      for (const p of list) m.set(Number(p.branchEmployeeId), p);
      return m;
    } catch {
      return paymentByEmp;
    }
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

  // ربط سجل واحد بموظف محدد (#3)
  const linkSingleMutation = useMutation({
    mutationFn: async (payload: { attendanceId: number; branchEmployeeId: number }) => {
      const res = await apiRequest("POST", "/api/salary-closing/link-attendance", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم الربط", description: "تم ربط السجل بالموظف." });
      refreshSalaryClosing();
    },
    onError: (err: any) => {
      toast({ title: "تعذّر الربط", description: err?.message || "حدث خطأ", variant: "destructive" });
    },
  });

  // تطبيق سُلفة/خصم على عدة موظفين دفعة واحدة (#7)
  const bulkDeductionMutation = useMutation({
    mutationFn: async (payload: { ids: number[]; type: string; amount: number; description: string }) => {
      const results = await Promise.allSettled(
        payload.ids.map((id) =>
          fetch("/api/salary-deductions", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              branchEmployeeId: id,
              branchId: branch,
              month,
              type: payload.type,
              amount: payload.amount,
              description: payload.description || null,
            }),
          }).then(async (r) => {
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "فشل");
            return r.json();
          }),
        ),
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      return { ok, fail: results.length - ok };
    },
    onSuccess: ({ ok, fail }) => {
      toast({ title: "تم التطبيق", description: `تم تسجيل الخصم لـ ${ok} موظف${fail ? ` (فشل ${fail})` : ""}.` });
      setSelectedEmpIds(new Set());
      setShowBulkDeductionDialog(false);
      setBulkAmount("");
      setBulkDescription("");
      refreshSalaryClosing();
    },
    onError: (err: any) => {
      toast({ title: "تعذّر التطبيق", description: err?.message || "حدث خطأ", variant: "destructive" });
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

  // يجلب أحدث نسخة من بيانات الكشف من الخادم قبل التصدير، لضمان ظهور آخر التعديلات
  // (السلف/الخصومات اليدوية وتعديلات أيام الحضور) في الملف المصدَّر حتى على الاتصال البطيء،
  // إذ قد يُنقر زر التصدير قبل اكتمال إعادة التحميل الخلفية بعد التعديل.
  const fetchLatestClosing = async (): Promise<any> => {
    let data: any;
    try {
      const r = await salaryClosingPreviewQuery.refetch();
      data = r.data ?? salaryClosingPreview;
    } catch {
      data = salaryClosingPreview;
    }
    // في وضع "كل الفروع": لو فشل حساب بعض الفروع، لا نصدّر بيانات ناقصة بدون تأكيد صريح
    const failed = (data as any)?.failedBranches as any[] | undefined;
    if (isAllBranches && failed && failed.length > 0) {
      const names = failed.map((b) => b.branchName).join("، ");
      const ok = confirm(`تنبيه: تعذّر حساب ${failed.length} من الفروع (${names}) — الملف المصدَّر لن يشملها وستكون الأرقام ناقصة.\n\nهل تريد المتابعة رغم ذلك؟`);
      if (!ok) return null;
    }
    return data;
  };

  const exportSalaryClosingToExcel = async () => {
    const fresh = await fetchLatestClosing();
    if (fresh === null) return; // ألغى المستخدم التصدير بسبب فروع متعذّرة
    const lines: any[] = fresh?.lines ?? salaryClosingData;
    const unlinkedRecords: AttendanceRecord[] = fresh?.unlinked ?? salaryClosingUnlinkedRecords;
    const unlinkedSummary = fresh?.unlinkedSummary ?? salaryClosingUnlinkedSummary;
    const unlinkedCount = unlinkedSummary?.totalRecords ?? salaryClosingUnlinkedCount;
    if (lines.length === 0) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const summaryData = [
      { [isRTL ? "البيان" : "Item"]: isRTL ? "الفرع" : "Branch", [isRTL ? "القيمة" : "Value"]: getBranchName(branch) },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "الشهر" : "Month", [isRTL ? "القيمة" : "Value"]: month },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "عدد الموظفين" : "Employee Count", [isRTL ? "القيمة" : "Value"]: lines.length },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "إجمالي الرواتب (شامل البدلات)" : "Total Salaries (Incl. Allowances)", [isRTL ? "القيمة" : "Value"]: lines.reduce((sum, e) => sum + e.grossSalary, 0) },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "إجمالي خصم الغياب" : "Total Absence Deduction", [isRTL ? "القيمة" : "Value"]: lines.reduce((sum, e) => sum + e.absenceDeduction, 0) },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "إجمالي التأمينات الاجتماعية" : "Total Social Insurance", [isRTL ? "القيمة" : "Value"]: lines.reduce((sum, e) => sum + e.socialInsurance, 0) },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "إجمالي السُلف والخصومات اليدوية" : "Total Manual Deductions", [isRTL ? "القيمة" : "Value"]: lines.reduce((sum, e) => sum + (e.manualDeductionsTotal || 0), 0) },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "صافي الرواتب المستحقة" : "Net Salaries Due", [isRTL ? "القيمة" : "Value"]: lines.reduce((sum, e) => sum + e.netSalary, 0) },
      { [isRTL ? "البيان" : "Item"]: "", [isRTL ? "القيمة" : "Value"]: "" },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "سجلات حضور غير مرتبطة" : "Unlinked Attendance Records", [isRTL ? "القيمة" : "Value"]: unlinkedCount },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "سجلات حضور (غير مرتبطة)" : "Present Records (Unlinked)", [isRTL ? "القيمة" : "Value"]: unlinkedSummary.presentRecords },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "إجمالي ساعات غير مرتبطة" : "Total Unlinked Hours", [isRTL ? "القيمة" : "Value"]: Math.round(unlinkedSummary.totalHours * 10) / 10 },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "ملاحظة" : "Note", [isRTL ? "القيمة" : "Value"]: unlinkedCount > 0 ? (isRTL ? "توجد سجلات حضور غير مرتبطة بموظفين - راجع ورقة السجلات غير المرتبطة للتفاصيل والمراجعة" : "Unlinked attendance records exist - see Unlinked Records sheet for details") : (isRTL ? "جميع السجلات مرتبطة بموظفين" : "All records are linked to employees") },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, isRTL ? "ملخص" : "Summary");

    const data = lines.map((emp, index) => ({
      [isRTL ? "م" : "#"]: index + 1,
      [isRTL ? "رقم الموظف" : "Employee #"]: emp.employeeNumber,
      [isRTL ? "الاسم" : "Name"]: emp.employeeName,
      [isRTL ? "حالة الموظف" : "Employee Status"]: employeeStatusLabel(emp.employeeStatus) || "-",
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
      [isRTL ? "الراحات الأسبوعية" : "Weekly Rest Days"]: emp.offDays,
      [isRTL ? "ساعات الجدول" : "Scheduled Hours"]: emp.scheduledHours,
      [isRTL ? "أيام الحضور" : "Present Days"]: emp.presentDays,
      [isRTL ? "أيام الغياب" : "Absent Days"]: emp.absentDays,
      [isRTL ? "إجازات مدفوعة" : "Paid Leave Days"]: emp.paidLeaveDays ?? 0,
      [isRTL ? "إجازات بدون راتب" : "Unpaid Leave Days"]: emp.unpaidLeaveDays ?? 0,
      [isRTL ? "أيام مخصومة (إجمالي)" : "Deducted Days"]: emp.unpaidDays ?? 0,
      [isRTL ? "تفصيل الإجازات" : "Leave Breakdown"]: (emp.leaveBreakdown || [])
        .map((b: any) => `${LEAVE_TYPE_LABELS[b.type] || b.type}: ${b.days} (${b.paid ? "مدفوعة" : "مخصومة"})`)
        .join("، ") || "-",
      [isRTL ? "أيام التأخير" : "Late Days"]: emp.lateDays,
      [isRTL ? "إجمالي الساعات" : "Total Hours"]: emp.totalHours,
      [isRTL ? "الراتب الأساسي" : "Base Salary"]: emp.baseSalary,
      [isRTL ? "البدلات" : "Allowances"]: emp.allowances,
      [isRTL ? "إجمالي الراتب" : "Gross Salary"]: emp.grossSalary,
      [isRTL ? "قيمة اليوم" : "Daily Rate"]: emp.dailyRate,
      [isRTL ? "خصم الغياب" : "Absence Deduction"]: emp.absenceDeduction,
      [isRTL ? "خصم المرضية" : "Sick Deduction"]: (emp as any).sickLeaveDeduction || 0,
      [isRTL ? "التأمينات الاجتماعية" : "Social Insurance"]: emp.socialInsurance,
      [isRTL ? "صافي الراتب" : "Net Salary"]: emp.netSalary,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, isRTL ? "تفاصيل الرواتب" : "Salary Details");

    if (unlinkedRecords.length > 0) {
      const unlinkedData = unlinkedRecords.map((rec, index) => ({
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

  // تصدير مخصص: الرواتب المدفوعة أو المتبقية (حسب حالة الصرف وطريقة الدفع)
  const exportPaymentsExcel = async (mode: "paid" | "remaining") => {
    const fresh = await fetchLatestClosing();
    if (fresh === null) return; // ألغى المستخدم التصدير بسبب فروع متعذّرة
    const lines: any[] = fresh?.lines ?? salaryClosingData;
    const payMap = await fetchLatestPayments();
    const isPaid = (emp: any) => payMap.has(Number(emp.branchEmployeeId ?? emp.id));
    const subset = lines.filter((emp) => (mode === "paid" ? isPaid(emp) : !isPaid(emp)));
    if (subset.length === 0) {
      alert(mode === "paid"
        ? (isRTL ? "لا توجد رواتب مدفوعة لهذا الشهر بعد." : "No paid salaries yet.")
        : (isRTL ? "لا توجد رواتب متبقية — تم صرف الجميع." : "No remaining salaries."));
      return;
    }
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const totalNet = subset.reduce((s, e) => s + (e.netSalary || 0), 0);
    const summaryData: any[] = [
      { [isRTL ? "البيان" : "Item"]: isRTL ? "الفرع" : "Branch", [isRTL ? "القيمة" : "Value"]: getBranchName(branch) },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "الشهر" : "Month", [isRTL ? "القيمة" : "Value"]: month },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "نوع الكشف" : "Report Type", [isRTL ? "القيمة" : "Value"]: mode === "paid" ? (isRTL ? "الرواتب المدفوعة" : "Paid Salaries") : (isRTL ? "الرواتب المتبقية" : "Remaining Salaries") },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "عدد الموظفين" : "Employee Count", [isRTL ? "القيمة" : "Value"]: subset.length },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "إجمالي صافي الرواتب" : "Total Net", [isRTL ? "القيمة" : "Value"]: totalNet },
    ];
    if (mode === "paid") {
      for (const [k, v] of Object.entries(SALARY_PAYMENT_METHOD_LABELS)) {
        const cnt = subset.filter((e) => payMap.get(Number(e.branchEmployeeId ?? e.id))?.paymentMethod === k).length;
        const sum = subset.filter((e) => payMap.get(Number(e.branchEmployeeId ?? e.id))?.paymentMethod === k).reduce((s, e) => s + (e.netSalary || 0), 0);
        summaryData.push({ [isRTL ? "البيان" : "Item"]: `${isRTL ? "عدد/إجمالي" : "Count/Total"} — ${v}`, [isRTL ? "القيمة" : "Value"]: `${cnt} / ${sum.toLocaleString("en-US", { maximumFractionDigits: 2 })}` });
      }
    }
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, isRTL ? "ملخص" : "Summary");

    const data = subset.map((emp, index) => {
      const p = payMap.get(Number(emp.branchEmployeeId ?? emp.id));
      const base: any = {
        [isRTL ? "م" : "#"]: index + 1,
        [isRTL ? "رقم الموظف" : "Employee #"]: emp.employeeNumber,
        [isRTL ? "الاسم" : "Name"]: emp.employeeName,
        [isRTL ? "حالة الموظف" : "Employee Status"]: employeeStatusLabel(emp.employeeStatus) || "-",
        [isRTL ? "الوظيفة" : "Job Title"]: emp.jobTitle,
        [isRTL ? "الجنسية" : "Nationality"]: emp.nationality,
        [isRTL ? "البنك" : "Bank"]: emp.bankName || "",
        [isRTL ? "الآيبان / رقم الحساب" : "IBAN / Account #"]: emp.bankAccountNumber || "",
        [isRTL ? "صافي الراتب" : "Net Salary"]: emp.netSalary,
      };
      if (mode === "paid") {
        base[isRTL ? "طريقة الدفع" : "Payment Method"] = p ? (SALARY_PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod) : "";
        base[isRTL ? "تاريخ الصرف" : "Paid At"] = p?.paidAt ? new Date(p.paidAt).toLocaleString("en-GB") : "";
        base[isRTL ? "ملاحظة" : "Note"] = p?.note || "";
      } else {
        base[isRTL ? "الحالة" : "Status"] = isRTL ? "غير مدفوع" : "Unpaid";
      }
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, mode === "paid" ? (isRTL ? "المدفوعة" : "Paid") : (isRTL ? "المتبقية" : "Remaining"));

    const tag = mode === "paid" ? (isRTL ? "الرواتب_المدفوعة" : "paid_salaries") : (isRTL ? "الرواتب_المتبقية" : "remaining_salaries");
    XLSX.writeFile(wb, `${tag}_${getBranchName(branch)}_${month}.xlsx`);
  };

  // تصدير ملف البنك (نموذج بنك الرياض - نظام مدد) المطابق للتنسيق المعتمد
  const exportBankFile = async (dueDateISO: string) => {
    const fresh = await fetchLatestClosing();
    if (fresh === null) return; // ألغى المستخدم التصدير بسبب فروع متعذّرة
    const lines: any[] = fresh?.lines ?? salaryClosingData;
    if (lines.length === 0) return;
    const xlsxMod: any = await import("xlsx-js-style");
    const XLSX: any = xlsxMod.default || xlsxMod;
    // تحويل التاريخ من YYYY-MM-DD إلى DD/MM/YYYY كما في النموذج المعتمد
    const dueDate = dueDateISO
      ? dueDateISO.split("-").reverse().join("/")
      : "";
    const round2 = (n: number) => Math.round((n || 0) * 100) / 100;

    // ===== أنماط الألوان والحدود مطابقة للنموذج المعتمد =====
    const thin = { style: "thin", color: { rgb: "FF000000" } };
    const box = { top: thin, bottom: thin, left: thin, right: thin };
    const GREEN = "FF287A51"; // أخضر داكن لرؤوس الأعمدة
    const LIGHT = "FFE2EFDA"; // أخضر فاتح لأعمدة مكوّنات الراتب
    const styGreen = {
      font: { bold: true, color: { rgb: "FFFFFFFF" }, sz: 11, name: "Calibri" },
      fill: { patternType: "solid", fgColor: { rgb: GREEN } },
      border: box,
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
    };
    const styLight = {
      font: { bold: true, color: { rgb: "FF000000" }, sz: 11, name: "Calibri" },
      fill: { patternType: "solid", fgColor: { rgb: LIGHT } },
      border: box,
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
    };
    const styCell = { border: box, alignment: { horizontal: "center", vertical: "center" } };
    const styText = { border: box, alignment: { horizontal: "center", vertical: "center" }, numFmt: "@" };

    // الجزء الأول: ترويسة الشركة (ثابتة) + الجزء الثاني: جدول الموظفين
    const headerLabels = [
      "Type", "اسم العميل ", "رمز الإتفاقية", "حساب التمويل", "رقم الفرع",
      "تاريخ الإستحقاق (DDMMYYYY)", "رقم  المنشأه في مكتب العمل ",
      "رقم المنشأه في الغرفة التجارية", "رمز البنك", "العملة",
      "رقم الدفعة ", "مرجع الملف ", "", "", "",
    ];
    const headerValues = [
      "111", "شركة الزبد الافضل ", "P0023453", "5061555359940", "506",
      dueDate, "11-2057146", "701011175690", "RIBL", "SAR", "", "", "", "", "",
    ];
    const tableHeaders = [
      "SN", "هوية المستفيد/ المرجع", "المستفيد / اسم الموظف", "رقم الحساب ",
      "رمز البنك", "إجمالي المبلغ", "الراتب الأساسي", "بدل السكن", "دخل آخر",
      "الخصومات", "العنوان", "العملة ", "الحالة", "وصف  الدفع", "مرجع  الدفع",
    ];
    const paymentDesc = `رواتب شهر ${month}`;
    // استبعاد غير النشطين من ملف البنك (يظلون في التقرير والتصديرات الأخرى)
    // ملاحظة: الحالة الفارغة (بيانات إغلاقات قديمة قبل إضافة العمود) تُعامل كنشط
    const activeOnly = lines.filter(
      (emp) => !emp.employeeStatus || emp.employeeStatus === "active",
    );
    const excludedNonActive = lines.length - activeOnly.length;
    // استبعاد الموظفين بلا رقم حساب بنكي (سيرفضها البنك) وإشعار المستخدم بعددهم
    const eligible = activeOnly.filter(
      (emp) => String(emp.bankAccountNumber || "").trim() !== "",
    );
    const excludedCount = activeOnly.length - eligible.length;
    if (eligible.length === 0) {
      toast({
        title: "لا يوجد موظفون مؤهلون للتحويل",
        description: "جميع الموظفين بدون رقم حساب بنكي مسجّل. أضف الحسابات أولاً.",
        variant: "destructive",
      });
      return;
    }
    const rows = eligible.map((emp, index) => {
      const housing = round2(emp.housingAllowance ?? 0);
      const otherIncome = round2((emp.allowances ?? 0) - housing);
      const deductions = round2(
        (emp.absenceDeduction ?? 0) +
          ((emp as any).sickLeaveDeduction ?? 0) +
          (emp.socialInsurance ?? 0) +
          (emp.manualDeductionsTotal ?? 0),
      );
      return [
        String(index + 1).padStart(4, "0"),
        String(emp.iqamaNumber || emp.employeeNumber || ""),
        emp.employeeName || "",
        String(emp.bankAccountNumber || ""),
        bankNameToSwift(emp.bankName),
        round2(emp.netSalary ?? 0),
        round2(emp.baseSalary ?? 0),
        housing,
        otherIncome,
        deductions,
        "خميس مشيط",
        "SAR",
        "نشط",
        paymentDesc,
        "",
      ];
    });

    const aoa = [headerLabels, headerValues, tableHeaders, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const NCOLS = 15;
    const setStyle = (r: number, c: number, s: any) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) ws[ref] = { t: "s", v: "" };
      ws[ref].s = s;
    };
    // صف 0: تسميات ترويسة الشركة (أخضر داكن)
    for (let c = 0; c < NCOLS; c++) setStyle(0, c, styGreen);
    // صف 1: قيم الشركة (خلايا محدودة بإطار)
    for (let c = 0; c < NCOLS; c++) setStyle(1, c, styCell);
    setStyle(1, 0, styText); // Type كنص
    setStyle(1, 3, styText); // حساب التمويل كنص
    // E2 = رقم الفرع كمعادلة LEFT(D2,3) كما في النموذج
    ws[XLSX.utils.encode_cell({ r: 1, c: 4 })] = {
      t: "str",
      f: "LEFT(D2,3)",
      v: String(headerValues[3] || "").slice(0, 3),
      s: styText,
    };
    // صف 2: رؤوس جدول الموظفين (أخضر داكن، وأخضر فاتح لمكوّنات الراتب G:J)
    for (let c = 0; c < NCOLS; c++)
      setStyle(2, c, c >= 6 && c <= 9 ? styLight : styGreen);
    // صفوف بيانات الموظفين
    for (let i = 0; i < rows.length; i++) {
      const r = 3 + i;
      for (let c = 0; c < NCOLS; c++) {
        const isTextCol = c === 0 || c === 1 || c === 3 || c === 4; // SN/الهوية/الحساب/رمز البنك
        setStyle(r, c, isTextCol ? styText : styCell);
      }
      // عمود إجمالي المبلغ (F) = الأساسي + السكن + دخل آخر - الخصومات كمعادلة
      const rn = r + 1;
      ws[XLSX.utils.encode_cell({ r, c: 5 })] = {
        t: "n",
        f: `SUM(G${rn}:I${rn})-J${rn}`,
        v: Number(rows[i][5]) || 0,
        s: styCell,
      };
    }

    ws["!merges"] = [
      { s: { c: 11, r: 0 }, e: { c: 14, r: 0 } },
      { s: { c: 11, r: 1 }, e: { c: 14, r: 1 } },
    ];
    ws["!cols"] = [
      5.16, 15, 22.16, 26.66, 12.16, 15.16, 18.16, 17.5, 10.33, 11,
      8.5, 9, 14, 37.16, 14.33,
    ].map((wch) => ({ wch }));
    ws["!rows"] = [{ hpt: 32.25 }, { hpt: 19 }, { hpt: 16 }];

    // شيت "data" المرجعي (الحالة / العملات / رموز البنوك) - قابل للتعديل في الإكسل
    const maxLen = Math.max(
      2,
      BANK_DATA_CURRENCIES.length + 1,
      BANK_DATA_CODES.length + 1,
    );
    const dataAoa: any[][] = [["Status", "", "Currency", "", "", "Bank code", ""]];
    const statusList = ["active", "inactive"];
    for (let i = 0; i < maxLen - 1; i++) {
      const cur = BANK_DATA_CURRENCIES[i];
      const code = BANK_DATA_CODES[i];
      dataAoa.push([
        statusList[i] || "",
        "",
        cur ? cur[0] : "",
        cur ? cur[1] : "",
        "",
        code ? code[0] : "",
        code ? code[1] : "",
      ]);
    }
    const wsData = XLSX.utils.aoa_to_sheet(dataAoa);

    const wb = XLSX.utils.book_new();
    // النموذج المعتمد من اليسار لليمين (LTR) وليس RTL
    wb.Workbook = { Views: [{ RTL: false }] };
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.utils.book_append_sheet(wb, wsData, "data");
    XLSX.writeFile(wb, `ملف_البنك_${getBranchName(branch)}_${month}.xlsx`);
    toast({
      title: "تم إنشاء ملف البنك",
      description:
        `تم تصدير ${eligible.length} موظف.` +
        (excludedNonActive > 0
          ? ` استُبعد ${excludedNonActive} موظف غير نشط.`
          : "") +
        (excludedCount > 0
          ? ` استُبعد ${excludedCount} موظف بدون رقم حساب بنكي.`
          : ""),
    });
  };

  const exportSalaryClosingToPDF = async () => {
    const fresh = await fetchLatestClosing();
    if (fresh === null) return; // ألغى المستخدم التصدير بسبب فروع متعذّرة
    const lines: any[] = fresh?.lines ?? salaryClosingData;
    if (lines.length === 0) {
      alert(isRTL ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }
    try {
      const requestData = {
        branchName: getBranchName(branch),
        month,
        employees: lines.map(emp => ({
          employeeName: emp.employeeName,
          employeeNumber: emp.employeeNumber,
          nationality: emp.nationality,
          iqamaNumber: emp.iqamaNumber,
          jobTitle: emp.jobTitle,
          bankName: emp.bankName,
          bankAccountNumber: emp.bankAccountNumber,
          scheduledWorkDays: emp.scheduledWorkDays,
          scheduledHours: emp.scheduledHours,
          lateDays: emp.lateDays,
          offDays: emp.offDays,
          presentDays: emp.presentDays,
          absentDays: emp.absentDays,
          totalHours: emp.totalHours,
          baseSalary: emp.baseSalary,
          allowances: emp.allowances,
          grossSalary: emp.grossSalary,
          dailyRate: emp.dailyRate,
          absenceDeduction: emp.absenceDeduction,
          sickLeaveDeduction: (emp as any).sickLeaveDeduction || 0,
          sickThreeQuarterDays: (emp as any).sickThreeQuarterDays || 0,
          sickUnpaidDays: (emp as any).sickUnpaidDays || 0,
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
          signed: lines.filter(e => e.dataSource === "signed_timesheet").length,
          schedule: lines.filter(e => e.dataSource === "schedule_attendance").length,
          attendanceOnly: lines.filter(e => e.dataSource === "attendance_only").length,
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

  // ============================================================
  // تقرير "الرواتب المستحقة" المخصّص للإدارة المالية والحسابات
  // يعرض الراتب المستحق الكامل لكل موظف "قبل أي خصومات" (غياب/تأمينات/سُلف)،
  // مع توزيع دقيق حسب الفرع وحسب الإدارة. هذا التقرير لا يطبّق أي حسميات إطلاقاً.
  // ============================================================
  const round2 = (n: number) => Math.round((n || 0) * 100) / 100;
  // تهريب أي محتوى نصّي قادم من قاعدة البيانات قبل حقنه في HTML الطباعة (منع XSS)
  const escapeHtml = (s: any) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
  const accruedBranchOf = (e: any) => e.branchName || getBranchName(branch);
  const accruedDeptOf = (e: any) => (e.department && String(e.department).trim()) || "غير محدد";
  const accruedOtherAllow = (e: any) => round2((e.allowances || 0) - (e.housingAllowance || 0));

  const accruedAbsence = (e: any) => round2(e.absenceDeduction || 0);
  const accruedInsurance = (e: any) => round2(e.socialInsurance || 0);
  const accruedManual = (e: any) => round2(e.manualDeductionsTotal || 0);
  const accruedTotalDed = (e: any) => round2(accruedAbsence(e) + accruedInsurance(e) + accruedManual(e));
  const accruedNet = (e: any) =>
    round2(e.netSalary != null ? e.netSalary : Math.max(0, (e.grossSalary || 0) - accruedTotalDed(e)));
  const manualDeductionsText = (e: any) =>
    (e.manualDeductions || [])
      .map((m: any) => `${m.type || "خصم"}${m.description ? " (" + m.description + ")" : ""}: ${round2(m.amount || 0)}`)
      .join(" | ");

  type AccruedGroup = {
    key: string; count: number; base: number; housing: number; other: number; allowances: number;
    gross: number; absence: number; insurance: number; manual: number; totalDed: number; net: number;
  };
  const buildAccruedGroups = (lines: any[], keyFn: (e: any) => string): AccruedGroup[] => {
    const map = new Map<string, AccruedGroup>();
    for (const e of lines) {
      const key = keyFn(e);
      const g = map.get(key) || { key, count: 0, base: 0, housing: 0, other: 0, allowances: 0, gross: 0, absence: 0, insurance: 0, manual: 0, totalDed: 0, net: 0 };
      g.count += 1;
      g.base += e.baseSalary || 0;
      g.housing += e.housingAllowance || 0;
      g.other += accruedOtherAllow(e);
      g.allowances += e.allowances || 0;
      g.gross += e.grossSalary || 0;
      g.absence += accruedAbsence(e);
      g.insurance += accruedInsurance(e);
      g.manual += accruedManual(e);
      g.totalDed += accruedTotalDed(e);
      g.net += accruedNet(e);
      map.set(key, g);
    }
    return Array.from(map.values())
      .map((g) => ({
        ...g,
        base: round2(g.base), housing: round2(g.housing), other: round2(g.other), allowances: round2(g.allowances),
        gross: round2(g.gross), absence: round2(g.absence), insurance: round2(g.insurance), manual: round2(g.manual),
        totalDed: round2(g.totalDed), net: round2(g.net),
      }))
      .sort((a, b) => b.gross - a.gross);
  };

  const exportAccruedSalariesExcel = async () => {
    const fresh = await fetchLatestClosing();
    if (fresh === null) return; // ألغى المستخدم التصدير بسبب فروع متعذّرة
    const lines: any[] = fresh?.lines ?? salaryClosingData;
    if (lines.length === 0) {
      alert(isRTL ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const scopeLabel = isAllBranches ? "كل الفروع" : getBranchName(branch);
    const totalBase = round2(lines.reduce((s, e) => s + (e.baseSalary || 0), 0));
    const totalHousing = round2(lines.reduce((s, e) => s + (e.housingAllowance || 0), 0));
    const totalOther = round2(lines.reduce((s, e) => s + accruedOtherAllow(e), 0));
    const totalAllow = round2(lines.reduce((s, e) => s + (e.allowances || 0), 0));
    const totalGross = round2(lines.reduce((s, e) => s + (e.grossSalary || 0), 0));
    const totalAbsence = round2(lines.reduce((s, e) => s + accruedAbsence(e), 0));
    const totalInsurance = round2(lines.reduce((s, e) => s + accruedInsurance(e), 0));
    const totalManual = round2(lines.reduce((s, e) => s + accruedManual(e), 0));
    const totalDed = round2(lines.reduce((s, e) => s + accruedTotalDed(e), 0));
    const totalNet = round2(lines.reduce((s, e) => s + accruedNet(e), 0));

    // ورقة 1: ملخص عام
    const summary = [
      { "البيان": "اسم التقرير", "القيمة": "الرواتب المستحقة (قبل وبعد الخصومات)" },
      { "البيان": "النطاق", "القيمة": scopeLabel },
      { "البيان": "الشهر", "القيمة": month },
      { "البيان": "تاريخ الإصدار", "القيمة": new Date().toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "long", day: "numeric" }) },
      { "البيان": "عدد الموظفين", "القيمة": lines.length },
      { "البيان": "", "القيمة": "" },
      { "البيان": "إجمالي الرواتب الأساسية", "القيمة": totalBase },
      { "البيان": "إجمالي بدل السكن", "القيمة": totalHousing },
      { "البيان": "إجمالي البدلات الأخرى", "القيمة": totalOther },
      { "البيان": "إجمالي البدلات", "القيمة": totalAllow },
      { "البيان": "إجمالي المستحق (قبل الخصومات)", "القيمة": totalGross },
      { "البيان": "", "القيمة": "" },
      { "البيان": "إجمالي خصم الغياب", "القيمة": totalAbsence },
      { "البيان": "إجمالي التأمينات الاجتماعية", "القيمة": totalInsurance },
      { "البيان": "إجمالي الخصومات المباشرة / السُلف", "القيمة": totalManual },
      { "البيان": "إجمالي الخصومات", "القيمة": totalDed },
      { "البيان": "", "القيمة": "" },
      { "البيان": "صافي المستحق (بعد الخصومات)", "القيمة": totalNet },
      { "البيان": "", "القيمة": "" },
      { "البيان": "ملاحظة", "القيمة": "يعرض هذا التقرير الراتب المستحق قبل الخصومات وبعدها مع تفصيل كل بند خصم (غياب / تأمينات / خصومات مباشرة وسُلف) — مخصّص لمراجعة الالتزام المالي الشهري للرواتب." },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summary);
    wsSummary["!cols"] = [{ wch: 36 }, { wch: 56 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص عام");

    const groupSheet = (groups: AccruedGroup[], label: string) => {
      const rows = groups.map((g, i) => ({
        "م": i + 1,
        [label]: g.key,
        "عدد الموظفين": g.count,
        "الراتب الأساسي": g.base,
        "بدل السكن": g.housing,
        "بدلات أخرى": g.other,
        "إجمالي البدلات": g.allowances,
        "إجمالي المستحق (قبل الخصومات)": g.gross,
        "خصم الغياب": g.absence,
        "التأمينات": g.insurance,
        "خصومات مباشرة / سُلف": g.manual,
        "إجمالي الخصومات": g.totalDed,
        "صافي المستحق (بعد الخصومات)": g.net,
      }));
      rows.push({
        "م": "" as any,
        [label]: "الإجمالي",
        "عدد الموظفين": lines.length,
        "الراتب الأساسي": totalBase,
        "بدل السكن": totalHousing,
        "بدلات أخرى": totalOther,
        "إجمالي البدلات": totalAllow,
        "إجمالي المستحق (قبل الخصومات)": totalGross,
        "خصم الغياب": totalAbsence,
        "التأمينات": totalInsurance,
        "خصومات مباشرة / سُلف": totalManual,
        "إجمالي الخصومات": totalDed,
        "صافي المستحق (بعد الخصومات)": totalNet,
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 5 }, { wch: 22 }, { wch: 12 }, { wch: 13 }, { wch: 11 }, { wch: 11 }, { wch: 13 }, { wch: 20 }, { wch: 11 }, { wch: 11 }, { wch: 18 }, { wch: 14 }, { wch: 22 }];
      return ws;
    };

    // ورقة 2: حسب الفرع
    XLSX.utils.book_append_sheet(wb, groupSheet(buildAccruedGroups(lines, accruedBranchOf), "الفرع"), "حسب الفرع");
    // ورقة 3: حسب الإدارة
    XLSX.utils.book_append_sheet(wb, groupSheet(buildAccruedGroups(lines, accruedDeptOf), "الإدارة"), "حسب الإدارة");

    // ورقة 4: تفاصيل الموظفين
    const detail = lines.map((e, i) => ({
      "م": i + 1,
      "رقم الموظف": e.employeeNumber || "",
      "الاسم": e.employeeName,
      "حالة الموظف": employeeStatusLabel(e.employeeStatus) || "-",
      "الفرع": accruedBranchOf(e),
      "الإدارة": accruedDeptOf(e),
      "الوظيفة": e.jobTitle || "",
      "الجنسية": e.nationality || "",
      "الراتب الأساسي": round2(e.baseSalary || 0),
      "بدل السكن": round2(e.housingAllowance || 0),
      "بدلات أخرى": accruedOtherAllow(e),
      "إجمالي البدلات": round2(e.allowances || 0),
      "إجمالي المستحق (قبل الخصومات)": round2(e.grossSalary || 0),
      "أيام الغياب": e.absentDays || 0,
      "خصم الغياب": accruedAbsence(e),
      "التأمينات": accruedInsurance(e),
      "خصومات مباشرة / سُلف": accruedManual(e),
      "تفصيل الخصومات المباشرة": manualDeductionsText(e),
      "إجمالي الخصومات": accruedTotalDed(e),
      "صافي المستحق (بعد الخصومات)": accruedNet(e),
    }));
    const wsDetail = XLSX.utils.json_to_sheet(detail);
    wsDetail["!cols"] = [{ wch: 5 }, { wch: 12 }, { wch: 26 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 11 }, { wch: 11 }, { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 11 }, { wch: 11 }, { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsDetail, "تفاصيل الموظفين");

    XLSX.writeFile(wb, `الرواتب_المستحقة_${scopeLabel}_${month}.xlsx`);
  };

  const exportAccruedSalariesPDF = async () => {
    const fresh = await fetchLatestClosing();
    if (fresh === null) return; // ألغى المستخدم التصدير بسبب فروع متعذّرة
    const lines: any[] = fresh?.lines ?? salaryClosingData;
    if (lines.length === 0) {
      alert(isRTL ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }
    const scopeLabel = isAllBranches ? "كل الفروع" : getBranchName(branch);
    const fmt = (n: number) => (round2(n)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const totalBase = lines.reduce((s, e) => s + (e.baseSalary || 0), 0);
    const totalAllow = lines.reduce((s, e) => s + (e.allowances || 0), 0);
    const totalGross = lines.reduce((s, e) => s + (e.grossSalary || 0), 0);
    const totalAbsence = lines.reduce((s, e) => s + accruedAbsence(e), 0);
    const totalInsurance = lines.reduce((s, e) => s + accruedInsurance(e), 0);
    const totalManual = lines.reduce((s, e) => s + accruedManual(e), 0);
    const totalDed = lines.reduce((s, e) => s + accruedTotalDed(e), 0);
    const totalNet = lines.reduce((s, e) => s + accruedNet(e), 0);

    const byBranch = buildAccruedGroups(lines, accruedBranchOf);
    const byDept = buildAccruedGroups(lines, accruedDeptOf);

    const groupTable = (title: string, label: string, groups: AccruedGroup[]) => `
      <h3 class="section-title">${title}</h3>
      <table>
        <thead><tr>
          <th>${label}</th><th>عدد</th><th>المستحق (قبل الخصومات)</th><th>خصم الغياب</th><th>التأمينات</th><th>خصومات / سُلف</th><th>إجمالي الخصومات</th><th>الصافي (بعد الخصومات)</th>
        </tr></thead>
        <tbody>
          ${groups.map((g, i) => `<tr class="${i % 2 === 0 ? "even" : "odd"}">
            <td class="rtl">${escapeHtml(g.key)}</td><td>${g.count}</td><td>${fmt(g.gross)}</td><td class="ded">${fmt(g.absence)}</td><td class="ded">${fmt(g.insurance)}</td><td class="ded">${fmt(g.manual)}</td><td class="ded strong">${fmt(g.totalDed)}</td><td class="strong net">${fmt(g.net)}</td>
          </tr>`).join("")}
          <tr class="total-row">
            <td class="rtl">الإجمالي</td><td>${lines.length}</td><td>${fmt(totalGross)}</td><td>${fmt(totalAbsence)}</td><td>${fmt(totalInsurance)}</td><td>${fmt(totalManual)}</td><td>${fmt(totalDed)}</td><td>${fmt(totalNet)}</td>
          </tr>
        </tbody>
      </table>`;

    const detailRows = lines.map((e, i) => `
      <tr class="${i % 2 === 0 ? "even" : "odd"}">
        <td>${i + 1}</td>
        <td>${escapeHtml(e.employeeNumber || "")}</td>
        <td class="rtl">${escapeHtml(e.employeeName || "")}${e.employeeStatus && e.employeeStatus !== "active" ? ` <span style="color:#b91c1c;font-size:9px;">(${escapeHtml(employeeStatusLabel(e.employeeStatus))})</span>` : ""}</td>
        <td class="rtl">${escapeHtml(accruedBranchOf(e))}</td>
        <td class="rtl">${escapeHtml(accruedDeptOf(e))}</td>
        <td>${fmt(e.baseSalary || 0)}</td>
        <td>${fmt(e.allowances || 0)}</td>
        <td class="strong">${fmt(e.grossSalary || 0)}</td>
        <td class="ded">${fmt(accruedAbsence(e))}</td>
        <td class="ded">${fmt(accruedInsurance(e))}</td>
        <td class="ded">${fmt(accruedManual(e))}</td>
        <td class="ded strong">${fmt(accruedTotalDed(e))}</td>
        <td class="strong net">${fmt(accruedNet(e))}</td>
      </tr>`).join("");

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>الرواتب المستحقة - ${escapeHtml(scopeLabel)} - ${escapeHtml(month)}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
          @page { size: A4 landscape; margin: 12mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Cairo','Segoe UI',sans-serif; margin: 0; direction: rtl; color: #1a1a1a; font-size: 11px; background: #fff; }
          .header { background: linear-gradient(135deg, #1a3a2f 0%, #2d5a47 100%); color: #fff; padding: 18px 24px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
          .brand { display: flex; align-items: center; gap: 14px; }
          .logo { width: 54px; height: 54px; background: linear-gradient(135deg,#f5a623,#e67e22); border-radius: 12px; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:800; color:#1a3a2f; }
          .brand h1 { margin: 0; font-size: 18px; }
          .brand .sub { margin-top: 3px; font-size: 11px; color: #f5a623; }
          .meta { text-align: left; font-size: 10px; opacity: .9; }
          .title-block { background: #f8f9fa; border-right: 5px solid #f5a623; padding: 12px 18px; border-radius: 0 8px 8px 0; margin-bottom: 14px; }
          .title-block h2 { margin: 0; font-size: 17px; color: #1a3a2f; }
          .title-block p { margin: 5px 0 0; font-size: 11px; color: #666; }
          .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 18px; }
          .card { background: linear-gradient(135deg,#fef9f3,#fff5eb); border: 1px solid #f5a623; border-radius: 8px; padding: 10px 12px; text-align: center; }
          .card .lbl { font-size: 9px; color: #666; margin-bottom: 4px; }
          .card .val { font-size: 14px; font-weight: 800; color: #1a3a2f; }
          .card.accent { background: linear-gradient(135deg,#1a3a2f,#2d5a47); border-color:#1a3a2f; }
          .card.accent .lbl { color: #cfe3d8; }
          .card.accent .val { color: #fff; }
          .section-title { font-size: 13px; color: #1a3a2f; margin: 18px 0 6px; padding-right: 10px; border-right: 4px solid #f5a623; }
          table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); margin-bottom: 6px; }
          thead { background: linear-gradient(135deg,#1a3a2f,#2d5a47); }
          th { color: #fff; padding: 7px 5px; font-size: 8.5px; font-weight: 600; text-align: center; border-left: 1px solid rgba(255,255,255,.1); }
          td { padding: 5px; font-size: 8.5px; text-align: center; border-bottom: 1px solid #eee; border-left: 1px solid #f0f0f0; }
          td.rtl { text-align: right; }
          td.strong { font-weight: 700; color: #1a3a2f; }
          td.ded { color: #b91c1c; }
          td.net { color: #15803d; }
          tr.even { background: #fff; } tr.odd { background: #fafbfc; }
          tr.total-row td { background: #fff3e0; font-weight: 800; color: #1a3a2f; border-top: 2px solid #f5a623; }
          .footer { margin-top: 18px; padding-top: 12px; border-top: 2px solid #1a3a2f; display: flex; justify-content: space-between; font-size: 9px; color: #666; }
          .confidential { background: #fee2e2; color: #991b1b; padding: 3px 10px; border-radius: 4px; font-weight: 600; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } .header,thead,.card,.title-block,tr.total-row td { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">
            <div class="logo">ز</div>
            <div><h1>شركة الزبد الأفضل التجارية</h1><div class="sub">BUTTER BAKERY - الإدارة المالية</div></div>
          </div>
          <div class="meta">
            <div>تاريخ الإصدار: ${new Date().toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "long", day: "numeric" })}</div>
            <div>رقم المرجع: SAL-${Date.now().toString(36).toUpperCase()}</div>
          </div>
        </div>
        <div class="title-block">
          <h2>تقرير الرواتب المستحقة (قبل وبعد الخصومات)</h2>
          <p>النطاق: ${escapeHtml(scopeLabel)} — الشهر: ${escapeHtml(month)} — الراتب المستحق قبل الخصومات وبعدها مع تفصيل كل بند (غياب / تأمينات / خصومات مباشرة وسُلف)</p>
        </div>
        <div class="cards">
          <div class="card"><div class="lbl">عدد الموظفين</div><div class="val">${lines.length}</div></div>
          <div class="card"><div class="lbl">المستحق (قبل الخصومات)</div><div class="val">${fmt(totalGross)}</div></div>
          <div class="card"><div class="lbl">خصم الغياب</div><div class="val" style="color:#b91c1c">${fmt(totalAbsence)}</div></div>
          <div class="card"><div class="lbl">التأمينات</div><div class="val" style="color:#b91c1c">${fmt(totalInsurance)}</div></div>
          <div class="card"><div class="lbl">خصومات مباشرة / سُلف</div><div class="val" style="color:#b91c1c">${fmt(totalManual)}</div></div>
          <div class="card"><div class="lbl">إجمالي الخصومات</div><div class="val" style="color:#b91c1c">${fmt(totalDed)}</div></div>
          <div class="card"><div class="lbl">إجمالي الرواتب الأساسية</div><div class="val">${fmt(totalBase)}</div></div>
          <div class="card"><div class="lbl">إجمالي البدلات</div><div class="val">${fmt(totalAllow)}</div></div>
          <div class="card"><div class="lbl">عدد الفروع / الإدارات</div><div class="val">${byBranch.length} / ${byDept.length}</div></div>
          <div class="card accent"><div class="lbl">صافي المستحق (بعد الخصومات)</div><div class="val">${fmt(totalNet)} ر.س</div></div>
        </div>
        ${groupTable("التوزيع حسب الفرع", "الفرع", byBranch)}
        ${groupTable("التوزيع حسب الإدارة", "الإدارة", byDept)}
        <h3 class="section-title">تفاصيل الموظفين</h3>
        <table>
          <thead><tr>
            <th>م</th><th>رقم الموظف</th><th>الاسم</th><th>الفرع</th><th>الإدارة</th>
            <th>الراتب الأساسي</th><th>إجمالي البدلات</th><th>المستحق (قبل الخصومات)</th>
            <th>خصم الغياب</th><th>التأمينات</th><th>خصومات / سُلف</th><th>إجمالي الخصومات</th><th>الصافي (بعد الخصومات)</th>
          </tr></thead>
          <tbody>${detailRows}</tbody>
        </table>
        <div class="footer">
          <span>BUTTER BAKERY SYSTEM — تقرير الرواتب المستحقة</span>
          <span>عدد السجلات: ${lines.length}</span>
          <span class="confidential">سري - للإدارة المالية فقط</span>
        </div>
      </body>
      </html>`;

    printHtmlDocument(html);
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
    if (bankFilter === "has_bank") result = result.filter((e) => !!(e.bankAccountNumber || e.bankName));
    else if (bankFilter === "no_bank") result = result.filter((e) => !e.bankAccountNumber && !e.bankName);
    if (paymentStatusFilter === "paid") result = result.filter((e) => paymentByEmp.has(Number(e.branchEmployeeId ?? e.id)));
    else if (paymentStatusFilter === "unpaid") result = result.filter((e) => !paymentByEmp.has(Number(e.branchEmployeeId ?? e.id)));
    if (paymentMethodFilter !== "all") result = result.filter((e) => paymentByEmp.get(Number(e.branchEmployeeId ?? e.id))?.paymentMethod === paymentMethodFilter);
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
  }, [salaryClosingData, search, jobTitleFilter, nationalityFilter, dataSourceFilter, statusFilter, bankFilter, paymentStatusFilter, paymentMethodFilter, paymentByEmp, netMin, netMax, sortField, sortOrder]);

  const hasActiveFilters =
    !!search ||
    jobTitleFilter !== "all" ||
    nationalityFilter !== "all" ||
    dataSourceFilter !== "all" ||
    statusFilter !== "all" ||
    bankFilter !== "all" ||
    paymentStatusFilter !== "all" ||
    paymentMethodFilter !== "all" ||
    !!netMin ||
    !!netMax;

  const clearFilters = () => {
    setSearch("");
    setJobTitleFilter("all");
    setNationalityFilter("all");
    setDataSourceFilter("all");
    setStatusFilter("all");
    setBankFilter("all");
    setPaymentStatusFilter("all");
    setPaymentMethodFilter("all");
    setNetMin("");
    setNetMax("");
  };

  if (!canCloseSalary) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 text-center" dir={isRTL ? "rtl" : "ltr"}>
          <ShieldAlert className="w-14 h-14 text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-1">غير مصرّح بالوصول</h2>
          <p className="text-gray-500">صفحة إغلاق الرواتب الشهرية متاحة للمدير ومدير الموارد البشرية والمدير المالي فقط.</p>
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
                    <SelectItem value="all" data-testid="select-branch-all">🏢 كل الفروع (عرض فقط)</SelectItem>
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
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={exportAccruedSalariesExcel}
                  disabled={previewLoading || salaryClosingData.length === 0}
                  data-testid="button-export-accrued-excel"
                >
                  <FileBarChart2 className="w-4 h-4 ml-2" />
                  الرواتب المستحقة (Excel)
                </Button>
                <Button
                  variant="outline"
                  className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                  onClick={exportAccruedSalariesPDF}
                  disabled={previewLoading || salaryClosingData.length === 0}
                  data-testid="button-export-accrued-pdf"
                >
                  <FileBarChart2 className="w-4 h-4 ml-2" />
                  الرواتب المستحقة (PDF)
                </Button>
                {!isAllBranches && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setBankDueDate("");
                      setBankExportOpen(true);
                    }}
                    disabled={previewLoading || salaryClosingData.length === 0}
                    data-testid="button-export-bank-file"
                  >
                    <Landmark className="w-4 h-4 ml-2" />
                    تصدير ملف البنك
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => exportPaymentsExcel("paid")}
                  disabled={previewLoading || salaryClosingData.length === 0}
                  data-testid="button-export-paid-salaries"
                >
                  <FileSpreadsheet className="w-4 h-4 ml-2" />
                  تصدير المدفوعة
                </Button>
                <Button
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => exportPaymentsExcel("remaining")}
                  disabled={previewLoading || salaryClosingData.length === 0}
                  data-testid="button-export-remaining-salaries"
                >
                  <FileSpreadsheet className="w-4 h-4 ml-2" />
                  تصدير المتبقية
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
                {!isAllBranches && !salaryClosingIsLocked && canApproveSalaryClosing && (
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
                <Button
                  variant="outline"
                  onClick={() => setShowOverviewDialog(true)}
                  data-testid="button-branches-overview"
                >
                  <Building2 className="w-4 h-4 ml-2" />
                  نظرة عامة على الفروع
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowHistoryDialog(true)}
                  data-testid="button-closures-history"
                >
                  <History className="w-4 h-4 ml-2" />
                  سجل الإغلاقات
                </Button>
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
                  {!isAllBranches && !salaryClosingIsLocked && canApproveSalaryClosing && (
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

        {isAllBranches && ((salaryClosingPreview as any)?.failedBranches?.length ?? 0) > 0 && (
          <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="pt-4 pb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-orange-800 dark:text-orange-300" data-testid="text-failed-branches">
                تعذّر حساب معاينة {((salaryClosingPreview as any).failedBranches.length)} من الفروع:{" "}
                {((salaryClosingPreview as any).failedBranches as any[]).map((b) => b.branchName).join("، ")} — الأرقام الظاهرة لا تشملها.
              </p>
              <Button variant="outline" size="sm" onClick={() => salaryClosingPreviewQuery.refetch()} data-testid="button-retry-failed-branches">
                إعادة المحاولة
              </Button>
            </CardContent>
          </Card>
        )}

        {isAllBranches && (((salaryClosingPreview as any)?.branchBreakdown?.length ?? 0) > 0) && (() => {
          const bb = ((salaryClosingPreview as any).branchBreakdown as any[]);
          const closedCount = bb.filter((b) => b.isLocked).length;
          return (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-lg">حالة الفروع — {month}</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground" data-testid="text-closing-progress">
                      أُغلق {closedCount} من {bb.length} فرعاً
                    </span>
                    <div className="w-32 h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${bb.length ? Math.round((closedCount / bb.length) * 100) : 0}%` }} />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-right p-2">الفرع</th>
                        <th className="text-right p-2">الموظفون</th>
                        <th className="text-right p-2">صافي الرواتب (ر.س)</th>
                        <th className="text-right p-2">الحالة</th>
                        <th className="text-right p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {bb.map((b) => (
                        <tr key={b.branchId} className="border-t hover:bg-slate-50" data-testid={`row-branch-status-${b.branchId}`}>
                          <td className="p-2 font-medium">{b.branchName}</td>
                          <td className="p-2 tabular-nums">{b.employeeCount}</td>
                          <td className="p-2 tabular-nums font-bold">{formatCurrency(b.totalNet || 0)}</td>
                          <td className="p-2">
                            {b.isLocked
                              ? <Badge className="bg-emerald-100 text-emerald-700">مغلق ✓</Badge>
                              : <Badge className="bg-amber-100 text-amber-700">لم يُغلق بعد</Badge>}
                          </td>
                          <td className="p-2">
                            <Button variant="outline" size="sm" onClick={() => setBranch(b.branchId)} data-testid={`button-open-branch-${b.branchId}`}>
                              فتح الفرع
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {dataActive && salaryClosingData.length > 0 && (
          <>
            {/* ملخص الرواتب */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  ملخص الرواتب - {isAllBranches ? "كل الفروع" : getBranchName(branch)} - {month}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-4">
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
                  <div className="text-center p-3 bg-teal-50 rounded-lg" data-testid="card-allowances">
                    <p className="text-2xl font-bold text-teal-600">
                      {formatCurrency(salaryClosingData.reduce((sum, e) => sum + e.allowances, 0))}
                    </p>
                    <p className="text-sm text-gray-600">إجمالي البدلات</p>
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

                {prevTotals.hasData && (
                  <div
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 p-2.5 bg-gray-50 border rounded-lg text-xs"
                    data-testid="row-prev-comparison"
                  >
                    <span className="text-gray-500 font-medium">مقارنة بالشهر السابق ({prevMonth}):</span>
                    {renderDelta("صافي الرواتب", salaryClosingData.reduce((s, e) => s + e.netSalary, 0), prevTotals.net, true)}
                    {renderDelta("إجمالي الرواتب", salaryClosingData.reduce((s, e) => s + e.grossSalary, 0), prevTotals.gross, true)}
                    {renderDelta("عدد الموظفين", salaryClosingData.length, prevTotals.count, false)}
                  </div>
                )}

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
                    <p className="text-[11px] text-gray-600">إجمالي الراحات الأسبوعية</p>
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
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">الحساب البنكي</Label>
                        <Select value={bankFilter} onValueChange={setBankFilter}>
                          <SelectTrigger data-testid="select-filter-bank"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">الكل</SelectItem>
                            <SelectItem value="has_bank">لديه حساب بنكي مسجّل</SelectItem>
                            <SelectItem value="no_bank">بدون حساب بنكي</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">حالة الدفع</Label>
                        <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                          <SelectTrigger data-testid="select-filter-payment-status"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">الكل</SelectItem>
                            <SelectItem value="paid">مدفوع</SelectItem>
                            <SelectItem value="unpaid">غير مدفوع</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">طريقة الدفع</Label>
                        <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                          <SelectTrigger data-testid="select-filter-payment-method"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">الكل</SelectItem>
                            {Object.entries(SALARY_PAYMENT_METHOD_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
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
                {!isAllBranches && !salaryClosingIsLocked && selectedEmpIds.size > 0 && (
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 mb-3 p-2.5 bg-orange-50 border border-orange-200 rounded-lg"
                    data-testid="toolbar-bulk-deduction"
                  >
                    <span className="text-sm font-medium text-orange-800">
                      تم تحديد {selectedEmpIds.size} موظف
                    </span>
                    <div className="flex items-center gap-2">
                      {canManageDeductions && (
                        <Button
                          size="sm"
                          className="bg-orange-600 hover:bg-orange-700"
                          onClick={() => setShowBulkDeductionDialog(true)}
                          data-testid="button-open-bulk-deduction"
                        >
                          <Plus className="w-3.5 h-3.5 ml-1" />
                          تطبيق سُلفة/خصم على المحددين
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedEmpIds(new Set())}
                        data-testid="button-clear-selection"
                      >
                        إلغاء التحديد
                      </Button>
                    </div>
                  </div>
                )}
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
                        {!isAllBranches && !salaryClosingIsLocked && (
                          <TableHead className="text-center w-8">
                            <Checkbox
                              checked={filteredLines.length > 0 && filteredLines.every((e: any) => selectedEmpIds.has(e.id))}
                              onCheckedChange={(v) =>
                                setSelectedEmpIds(v ? new Set(filteredLines.map((e: any) => e.id)) : new Set())
                              }
                              data-testid="checkbox-select-all"
                            />
                          </TableHead>
                        )}
                        <TableHead className={isRTL ? "text-right" : "text-left"}>#</TableHead>
                        <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "رقم الموظف" : "Employee #"}</TableHead>
                        <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الاسم" : "Name"}</TableHead>
                        {isAllBranches && <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الفرع" : "Branch"}</TableHead>}
                        {cols.jobTitle && <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الوظيفة" : "Job Title"}</TableHead>}
                        {cols.bank && <TableHead className={isRTL ? "text-right" : "text-left"} title={isRTL ? "البنك ورقم الحساب البنكي / الآيبان (من ملف الموظف)" : "Bank & IBAN"}>{isRTL ? "البنك / الآيبان" : "Bank / IBAN"}</TableHead>}
                        {cols.workDays && <TableHead className="text-center" title={isRTL ? "أيام العمل المجدولة (من الجدول الموقّع)" : "Scheduled work days"}>{isRTL ? "أيام العمل" : "Work Days"}</TableHead>}
                        <TableHead className="text-center">{isRTL ? "الحضور" : "Present"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "الغياب" : "Absent"}</TableHead>
                        {cols.off && <TableHead className="text-center" title={isRTL ? "الراحات الأسبوعية (تُحتسب ضمن أيام الصرف)" : "Weekly rest days"}>{isRTL ? "الراحات الأسبوعية" : "Weekly Rest"}</TableHead>}
                        {cols.leaves && <TableHead className="text-center" title={isRTL ? "الإجازات المعتمدة بالنوع (مدفوعة/مخصومة)" : "Approved leaves by type"}>{isRTL ? "الإجازات" : "Leaves"}</TableHead>}
                        {cols.hours && <TableHead className="text-center">{isRTL ? "الساعات" : "Hours"}</TableHead>}
                        {cols.salary && <TableHead className="text-center">{isRTL ? "الراتب" : "Salary"}</TableHead>}
                        {cols.allowances && <TableHead className="text-center">{isRTL ? "البدلات" : "Allowances"}</TableHead>}
                        {cols.dailyRate && <TableHead className="text-center" title={isRTL ? "قيمة اليوم = الراتب الإجمالي ÷ 30" : "Daily rate"}>{isRTL ? "قيمة اليوم" : "Daily Rate"}</TableHead>}
                        {cols.absenceDeduction && <TableHead className="text-center" title={isRTL ? "خصم الغياب = أيام الغياب × قيمة اليوم" : "Absence deduction"}>{isRTL ? "خصم الغياب" : "Absence Deduction"}</TableHead>}
                        {cols.sickLeaveDeduction && <TableHead className="text-center" title={isRTL ? "خصم الإجازة المرضية (المادة 117): أيام الشريحة 75% يُخصم منها ربع قيمة اليوم" : "Sick leave deduction (Art. 117)"}>{isRTL ? "خصم المرضية" : "Sick Deduction"}</TableHead>}
                        {cols.insurance && <TableHead className="text-center">{isRTL ? "التأمينات" : "Insurance"}</TableHead>}
                        <TableHead className="text-center bg-orange-50" title={isRTL ? "السُلف والخصومات اليدوية الشهرية — اضغط للإضافة/التعديل" : "Manual advances & deductions"}>{isRTL ? "سُلف/خصومات" : "Advances/Deductions"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "الصافي" : "Net"}</TableHead>
                        <TableHead className="text-center bg-green-50" title={isRTL ? "حالة صرف الراتب وطريقة الدفع — اضغط للتأشير" : "Payment status & method"}>{isRTL ? "حالة الدفع" : "Payment"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "قسيمة" : "Payslip"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLines.map((emp, index) => (
                        <TableRow key={emp.id} className={emp.noWorkAtAll ? "bg-red-50/60" : (emp.dataSource === "signed_timesheet" ? "bg-emerald-50/30" : "")}>
                          {!isAllBranches && !salaryClosingIsLocked && (
                            <TableCell className="text-center">
                              <Checkbox
                                checked={selectedEmpIds.has(emp.id)}
                                onCheckedChange={(v) =>
                                  setSelectedEmpIds((prev) => {
                                    const n = new Set(prev);
                                    if (v) n.add(emp.id);
                                    else n.delete(emp.id);
                                    return n;
                                  })
                                }
                                data-testid={`checkbox-emp-${emp.id}`}
                              />
                            </TableCell>
                          )}
                          <TableCell>{index + 1}</TableCell>
                          <TableCell className="font-mono">{emp.employeeNumber}</TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{emp.employeeName}</span>
                              {emp.employeeStatus && (
                                emp.employeeStatus === "active" ? (
                                  <Badge
                                    className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0"
                                    data-testid={`badge-emp-status-${emp.id}`}
                                  >
                                    نشط
                                  </Badge>
                                ) : (
                                  <Badge
                                    className="bg-red-100 text-red-700 border-red-300 text-[10px] px-1.5 py-0"
                                    title="موظف غير نشط حالياً — مُدرج لأن له دواماً خلال هذا الشهر"
                                    data-testid={`badge-emp-status-${emp.id}`}
                                  >
                                    {employeeStatusLabel(emp.employeeStatus)}
                                  </Badge>
                                )
                              )}
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
                          {isAllBranches && <TableCell className="text-xs text-gray-700" data-testid={`cell-branch-${emp.id}`}>{emp.branchName || "-"}</TableCell>}
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
                            {emp.branchEmployeeId != null && !salaryClosingIsLocked && !isAllBranches ? (
                              <AttendanceAdjustmentPopover
                                branchEmployeeId={Number(emp.branchEmployeeId)}
                                month={month}
                                employeeName={emp.employeeName}
                                presentDays={emp.presentDays}
                                presentDates={emp.presentDates || []}
                                originalPresentDays={(emp as any).originalPresentDays ?? null}
                                adjustmentReason={(emp as any).attendanceAdjustmentReason ?? null}
                                adjustmentBy={(emp as any).attendanceAdjustmentBy ?? null}
                                canEdit={canCloseSalary}
                                onChanged={refreshSalaryClosing}
                              />
                            ) : (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button type="button" data-testid={`btn-present-${emp.id}`}>
                                    <Badge className={((emp as any).originalPresentDays !== null && (emp as any).originalPresentDays !== undefined)
                                      ? "bg-amber-100 text-amber-900 border border-amber-400 hover:bg-amber-200 cursor-pointer"
                                      : "bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer"}>
                                      {emp.presentDays}{((emp as any).originalPresentDays !== null && (emp as any).originalPresentDays !== undefined) ? " ✎" : ""}
                                    </Badge>
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 max-h-80 overflow-y-auto" side="top">
                                  {((emp as any).originalPresentDays !== null && (emp as any).originalPresentDays !== undefined) && (
                                    <div className="rounded border border-amber-300 bg-amber-50 p-2 mb-2 text-[11px] text-amber-900 space-y-0.5">
                                      <div className="font-bold">⚠ تم تعديل أيام الحضور يدوياً</div>
                                      <div>المحتسبة قبل التعديل: <strong>{(emp as any).originalPresentDays}</strong> ← بعد التعديل: <strong>{emp.presentDays}</strong></div>
                                      {(emp as any).attendanceAdjustmentReason && <div>السبب: {(emp as any).attendanceAdjustmentReason}</div>}
                                      {(emp as any).attendanceAdjustmentBy && <div>قام بالتعديل: {(emp as any).attendanceAdjustmentBy}</div>}
                                    </div>
                                  )}
                                  <div className="text-xs font-semibold mb-2 text-green-800">
                                    أيام الحضور المحتسبة ({emp.presentDates.length})
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
                            )}
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
                                    الراحات الأسبوعية ({emp.offDays}) — تُحتسب ضمن أيام الصرف
                                  </div>
                                  {emp.offDates.length === 0 ? (
                                    <p className="text-xs text-gray-500">لا توجد راحات أسبوعية.</p>
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
                          {cols.leaves && (
                            <TableCell className="text-center">
                              {(() => {
                                const breakdown: { type: string; days: number; paid: boolean }[] = emp.leaveBreakdown || [];
                                const totalLeaveDays = breakdown.reduce((s, b) => s + (b.days || 0), 0);
                                if (totalLeaveDays === 0) {
                                  return <span className="text-gray-400 text-xs">-</span>;
                                }
                                return (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button type="button" data-testid={`btn-leaves-${emp.id}`}>
                                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer">{totalLeaveDays}</Badge>
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-72 max-h-80 overflow-y-auto" side="top">
                                      <div className="text-xs font-semibold mb-2 text-blue-800">
                                        الإجازات المعتمدة بالنوع ({totalLeaveDays})
                                      </div>
                                      <div className="space-y-1">
                                        {breakdown.map((b) => (
                                          <div key={b.type} className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-blue-50">
                                            <span>{LEAVE_TYPE_LABELS[b.type] || b.type}</span>
                                            <span className="flex items-center gap-2">
                                              <span className="font-mono">{b.days} يوم</span>
                                              {b.paid ? (
                                                <Badge className="bg-green-100 text-green-800 text-[10px]">مدفوعة</Badge>
                                              ) : (
                                                <Badge className="bg-red-100 text-red-800 text-[10px]">مخصومة</Badge>
                                              )}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                      <p className="text-[10px] text-gray-500 mt-2">
                                        المدفوعة تُحتسب ضمن أيام الصرف؛ الإجازة بدون راتب تُخصم بقيمة اليوم.
                                      </p>
                                    </PopoverContent>
                                  </Popover>
                                );
                              })()}
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
                          {cols.sickLeaveDeduction && (
                            <TableCell className="text-center text-red-600" title={(emp as any).sickThreeQuarterDays > 0 ? `${(emp as any).sickThreeQuarterDays} يوم بأجر 75%${(emp as any).sickUnpaidDays > 0 ? ` + ${(emp as any).sickUnpaidDays} يوم بدون أجر (ضمن خصم الغياب)` : ""}` : undefined}>
                              {((emp as any).sickLeaveDeduction ?? 0) > 0 ? `- ${formatCurrency((emp as any).sickLeaveDeduction, isRTL)}` : "-"}
                            </TableCell>
                          )}
                          {cols.insurance && (
                            <TableCell className="text-center text-red-600">
                              {emp.socialInsurance > 0 ? `- ${formatCurrency(emp.socialInsurance, isRTL)}` : "-"}
                            </TableCell>
                          )}
                          <TableCell className="text-center bg-orange-50/40">
                            {salaryClosingIsLocked || isAllBranches ? (
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
                                canEdit={canManageDeductions}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-center font-bold">{formatCurrency(emp.netSalary, isRTL)}</TableCell>
                          <TableCell className="text-center bg-green-50/40">
                            {isAllBranches ? (
                              (() => {
                                const pay = emp.branchEmployeeId != null ? paymentByEmp.get(Number(emp.branchEmployeeId)) : undefined;
                                return pay ? (
                                  <Badge className="bg-green-100 text-green-800" data-testid={`badge-paid-readonly-${emp.id}`}>
                                    مدفوع{pay.paymentMethod ? ` · ${SALARY_PAYMENT_METHOD_LABELS[pay.paymentMethod] || pay.paymentMethod}` : ""}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-amber-700 border-amber-300" data-testid={`badge-unpaid-readonly-${emp.id}`}>غير مدفوع</Badge>
                                );
                              })()
                            ) : (emp.branchEmployeeId != null || emp.id != null) ? (
                              <PaymentStatusPopover
                                branchEmployeeId={Number(emp.branchEmployeeId ?? emp.id)}
                                month={month}
                                employeeName={emp.employeeName}
                                netSalary={emp.netSalary || 0}
                                payment={paymentByEmp.get(Number(emp.branchEmployeeId ?? emp.id))}
                                onChanged={refreshPayments}
                              />
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </TableCell>
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

        {dataActive && !previewLoading && salaryClosingData.length === 0 && (
          <div className="text-center py-16 text-gray-500" data-testid="empty-no-employees">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{isAllBranches ? "لا يوجد موظفين نشطين في الفروع المتاحة" : (isRTL ? "لا يوجد موظفين نشطين في هذا الفرع" : "No active employees in this branch")}</p>
          </div>
        )}

        {!dataActive && (
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

        {/* تصدير ملف البنك (نموذج بنك الرياض - نظام مدد) */}
        <Dialog open={bankExportOpen} onOpenChange={setBankExportOpen}>
          <DialogContent className="max-w-md" data-testid="dialog-bank-export">
            <DialogHeader>
              <DialogTitle>تصدير ملف البنك (بنك الرياض - مدد)</DialogTitle>
              <DialogDescription>
                سيتم إنشاء ملف إكسل بالتنسيق المعتمد لبنك الرياض. حدّد تاريخ الإستحقاق (موعد صرف الرواتب) أولاً.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <Label>تاريخ الإستحقاق <span className="text-red-600">*</span></Label>
                <Input
                  type="date"
                  value={bankDueDate}
                  onChange={(e) => setBankDueDate(e.target.value)}
                  data-testid="input-bank-due-date"
                />
              </div>
              <p className="text-xs text-gray-500">
                ملاحظة: يُستنتج رمز البنك (SWIFT) من اسم البنك المسجّل لكل موظف. يمكنك تعديل أي قيمة في ملف الإكسل، واستخدام شيت "data" كمرجع لرموز البنوك.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBankExportOpen(false)} data-testid="button-cancel-bank-export">
                إلغاء
              </Button>
              <Button
                disabled={!bankDueDate}
                onClick={async () => {
                  await exportBankFile(bankDueDate);
                  setBankExportOpen(false);
                }}
                data-testid="button-confirm-bank-export"
              >
                <Landmark className="w-4 h-4 ml-2" />
                تصدير الملف
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
                  <div key={g.key} className="border rounded-lg p-2" data-testid={`row-unlinked-group-${g.key}`}>
                    <div className="flex items-center gap-2">
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
                      <SearchableSelect
                        value={sel}
                        onValueChange={(v) => setGroupSel((prev) => ({ ...prev, [g.key]: v }))}
                        className="w-56"
                        triggerClassName="h-9"
                        placeholder="اختر الموظف"
                        searchPlaceholder="ابحث بالاسم أو الرقم..."
                        dataTestid={`select-link-employee-${g.key}`}
                        options={(salaryClosingBundle?.employees ?? []).map((emp: any) => ({
                          value: String(emp.id),
                          label: emp.employeeName || emp.name,
                          sublabel: emp.employeeNumber ? `(${emp.employeeNumber})` : undefined,
                        }))}
                      />
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
                      {g.records.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 px-2"
                          onClick={() => setExpandedGroups((p) => ({ ...p, [g.key]: !p[g.key] }))}
                          data-testid={`button-expand-group-${g.key}`}
                          title="ربط سجل واحد بموظف مختلف"
                        >
                          {expandedGroups[g.key] ? "▲" : "▼"} سجلات
                        </Button>
                      )}
                    </div>
                    {expandedGroups[g.key] && g.records.length > 1 && (
                      <div className="mt-2 pt-2 border-t space-y-1.5">
                        <div className="text-[11px] text-gray-500">
                          ربط سجل واحد بموظف مختلف (للحالات التي تخص أكثر من موظف):
                        </div>
                        {g.records.map((r: any) => {
                          const rsel = recordSel[r.id] ?? "";
                          return (
                            <div key={r.id} className="flex items-center gap-2 text-xs" data-testid={`row-unlinked-record-${r.id}`}>
                              <span className="font-mono text-gray-600 w-28 shrink-0">
                                {r.attendanceDate || `#${r.id}`}
                              </span>
                              <SearchableSelect
                                value={rsel}
                                onValueChange={(v) => setRecordSel((prev) => ({ ...prev, [r.id]: v }))}
                                className="flex-1"
                                triggerClassName="h-8"
                                placeholder="اختر الموظف"
                                searchPlaceholder="ابحث بالاسم أو الرقم..."
                                dataTestid={`select-link-record-${r.id}`}
                                options={(salaryClosingBundle?.employees ?? []).map((emp: any) => ({
                                  value: String(emp.id),
                                  label: emp.employeeName || emp.name,
                                  sublabel: emp.employeeNumber ? `(${emp.employeeNumber})` : undefined,
                                }))}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 shrink-0"
                                disabled={linkSingleMutation.isPending || !rsel}
                                onClick={() =>
                                  linkSingleMutation.mutate({ attendanceId: r.id, branchEmployeeId: Number(rsel) })
                                }
                                data-testid={`button-link-record-${r.id}`}
                              >
                                ربط
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
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

        {/* سجل الإغلاقات السابقة */}
        <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="max-w-4xl" data-testid="dialog-closures-history">
            <DialogHeader>
              <DialogTitle>سجل الإغلاقات السابقة</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm max-h-[65vh] overflow-y-auto">
              {closuresHistoryQuery.isLoading && (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin ml-2" />
                  جاري التحميل...
                </div>
              )}
              {!closuresHistoryQuery.isLoading && closuresHistory.length === 0 && (
                <p className="text-center text-gray-500 py-8">لا توجد إغلاقات محفوظة بعد.</p>
              )}
              {!closuresHistoryQuery.isLoading && closuresHistory.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">الفرع</TableHead>
                      <TableHead className="text-center">الشهر</TableHead>
                      <TableHead className="text-center">الحالة</TableHead>
                      <TableHead className="text-center">الموظفون</TableHead>
                      <TableHead className="text-center">صافي الرواتب</TableHead>
                      <TableHead className="text-center">اعتمد الإغلاق</TableHead>
                      <TableHead className="text-center">إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closuresHistory.map((c: any) => (
                      <TableRow key={c.id} data-testid={`row-closure-${c.id}`}>
                        <TableCell className="text-center">{getBranchName(c.branchId)}</TableCell>
                        <TableCell className="text-center">{c.month}</TableCell>
                        <TableCell className="text-center">
                          {c.status === "reopened" ? (
                            <Badge variant="outline" className="text-amber-700 border-amber-300">معاد فتحه</Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-700 border-emerald-300">مغلق</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{formatNumber(c.employeeCount ?? 0)}</TableCell>
                        <TableCell className="text-center">{formatCurrency(c.totalNet ?? 0, isRTL)}</TableCell>
                        <TableCell className="text-center text-xs">
                          {c.closedByName || "—"}
                          {c.closedAt ? (
                            <div className="text-gray-500">{new Date(c.closedAt).toLocaleDateString("ar-SA")}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setBranch(c.branchId);
                              setMonth(c.month);
                              setShowHistoryDialog(false);
                            }}
                            data-testid={`button-open-closure-${c.id}`}
                          >
                            عرض
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowHistoryDialog(false)} data-testid="button-close-history-dialog">
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* نظرة عامة على حالة إغلاق الفروع للشهر المحدد */}
        <Dialog open={showOverviewDialog} onOpenChange={setShowOverviewDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-branches-overview">
            <DialogHeader>
              <DialogTitle>نظرة عامة على الفروع — شهر {month}</DialogTitle>
              <DialogDescription>
                حالة إغلاق الرواتب لكل فرع في الشهر المحدد. اضغط «فتح» للانتقال إلى الفرع لمراجعته وإغلاقه.
              </DialogDescription>
            </DialogHeader>
            {closuresHistoryQuery.isLoading ? (
              <div className="py-8 text-center text-gray-500">جارٍ التحميل...</div>
            ) : (
              <div className="space-y-2">
                {(branches ?? []).map((b) => {
                  const closure = closuresHistory.find(
                    (c: any) => c.branchId === b.id && c.month === month,
                  );
                  const status = closure?.status;
                  const isClosed = status === "closed";
                  const isReopened = status === "reopened";
                  return (
                    <div
                      key={b.id}
                      className="flex items-center justify-between gap-2 border rounded-lg p-3"
                      data-testid={`row-overview-branch-${b.id}`}
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">{b.name}</div>
                        <div className="text-xs text-gray-500">
                          {isClosed ? (
                            <span className="text-emerald-600">
                              مغلق · {closure.employeeCount ?? 0} موظف · صافي {formatCurrency(closure.totalNet ?? 0, isRTL)}
                            </span>
                          ) : isReopened ? (
                            <span className="text-amber-600">معاد فتحه — بحاجة لإعادة إغلاق</span>
                          ) : (
                            <span className="text-gray-400">لم يُغلق بعد</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isClosed ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">مغلق</Badge>
                        ) : isReopened ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300">معاد فتحه</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-700 border-gray-300">مفتوح</Badge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setBranch(b.id);
                            setShowOverviewDialog(false);
                          }}
                          data-testid={`button-overview-goto-${b.id}`}
                        >
                          فتح
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {(branches ?? []).length === 0 && (
                  <div className="py-8 text-center text-gray-500">لا توجد فروع متاحة.</div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowOverviewDialog(false)} data-testid="button-close-overview-dialog">
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* تطبيق سُلفة/خصم جماعي على الموظفين المحددين */}
        <Dialog open={showBulkDeductionDialog} onOpenChange={setShowBulkDeductionDialog}>
          <DialogContent className="max-w-md" data-testid="dialog-bulk-deduction">
            <DialogHeader>
              <DialogTitle>تطبيق سُلفة/خصم جماعي</DialogTitle>
              <DialogDescription>
                سيُطبَّق نفس المبلغ على {selectedEmpIds.size} موظف محدد لشهر {month}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">النوع</Label>
                <Select value={bulkType} onValueChange={setBulkType}>
                  <SelectTrigger className="h-9" data-testid="select-bulk-deduction-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SALARY_DEDUCTION_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">المبلغ (ر.س)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={bulkAmount}
                  onChange={(e) => setBulkAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-9"
                  data-testid="input-bulk-deduction-amount"
                />
              </div>
              <div>
                <Label className="text-xs">الوصف (اختياري)</Label>
                <Textarea
                  value={bulkDescription}
                  onChange={(e) => setBulkDescription(e.target.value)}
                  placeholder="مثال: سلفة رمضان، خصم عهدة..."
                  rows={2}
                  className="resize-none"
                  data-testid="input-bulk-deduction-description"
                />
              </div>
              <div className="text-[11px] text-gray-500 bg-orange-50 border border-orange-200 rounded p-2">
                💡 سيُخصم هذا المبلغ من صافي راتب كل موظف محدد عند إغلاق الشهر.
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkDeductionDialog(false)} data-testid="button-cancel-bulk-deduction">
                إلغاء
              </Button>
              <Button
                className="bg-orange-600 hover:bg-orange-700"
                disabled={bulkDeductionMutation.isPending || !bulkAmount}
                onClick={() => {
                  const amount = parseFloat(bulkAmount);
                  if (!Number.isFinite(amount) || amount <= 0) {
                    toast({ title: "مبلغ غير صحيح", description: "أدخل مبلغ موجب", variant: "destructive" });
                    return;
                  }
                  const validIds = new Set(salaryClosingData.map((e: any) => e.id));
                  const ids = Array.from(selectedEmpIds).filter((id) => validIds.has(id));
                  if (ids.length === 0) {
                    toast({ title: "لا يوجد تحديد صالح", description: "حدّد موظفين من الشهر/الفرع الحالي أولاً", variant: "destructive" });
                    setSelectedEmpIds(new Set());
                    return;
                  }
                  bulkDeductionMutation.mutate({
                    ids,
                    type: bulkType,
                    amount,
                    description: bulkDescription.trim(),
                  });
                }}
                data-testid="button-confirm-bulk-deduction"
              >
                {bulkDeductionMutation.isPending ? "جارٍ التطبيق..." : `تطبيق على ${selectedEmpIds.size} موظف`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
