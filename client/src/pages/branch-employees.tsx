import { Layout } from "@/components/layout";
import { PageHeader, KpiCard } from "@/components/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useReactToPrint } from "react-to-print";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import {
  Users,
  ChevronLeft,
  Plus,
  Edit,
  Trash2,
  Loader2,
  DollarSign,
  Building,
  Globe,
  Briefcase,
  UserCheck,
  FileText,
  Phone,
  Calendar,
  Search,
  Filter,
  Download,
  Printer,
  FileSpreadsheet,
  Eye,
  ClipboardList,
  Clock,
  Link,
  Upload,
  Network,
  Settings,
  Flag,
  CreditCard,
  Layers,
  FileCheck,
  SlidersHorizontal,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  X,
} from "lucide-react";
import type { BranchEmployee, EmployeeSetting, EmployeeTransferRequest, Branch } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, ArrowRight, History, TrendingUp, RefreshCw, Copy, MessageCircle } from "lucide-react";

// تمت إزالة JOB_TITLES و NATIONALITIES - الآن يتم استخدام البيانات من قاعدة البيانات

const STATUS_OPTIONS_AR = [
  { value: "active", label: "نشط" },
  { value: "inactive", label: "غير نشط" },
  { value: "terminated", label: "منتهي" },
  { value: "on_leave", label: "في إجازة" },
];

const STATUS_OPTIONS_EN = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "terminated", label: "Terminated" },
  { value: "on_leave", label: "On Leave" },
];

const HEALTH_CERT_OPTIONS_AR = [
  { value: "none", label: "لا يوجد" },
  { value: "valid", label: "ساري" },
  { value: "expired", label: "منتهي" },
  { value: "pending", label: "قيد التجديد" },
];

const HEALTH_CERT_OPTIONS_EN = [
  { value: "none", label: "None" },
  { value: "valid", label: "Valid" },
  { value: "expired", label: "Expired" },
  { value: "pending", label: "Pending" },
];

const employeeFormSchema = z.object({
  branchId: z.string().min(1, "الفرع مطلوب"),
  employeeName: z.string().min(1, "اسم الموظف مطلوب"),
  employeeNameEn: z.string().optional(),
  jobTitle: z.string().min(1, "الوظيفة مطلوبة"),
  department: z.string().optional(),
  nationality: z.string().min(1, "الجنسية مطلوبة"),
  salary: z.coerce.number().min(0, "الراتب يجب أن يكون رقم موجب"),
  housingAllowance: z.coerce.number().min(0).optional(),
  transportAllowance: z.coerce.number().min(0).optional(),
  foodAllowance: z.coerce.number().min(0).optional(),
  otherAllowances: z.coerce.number().min(0).optional(),
  socialInsuranceDeduction: z.coerce.number().min(0).optional(), // خصم التأمينات للسعوديين
  hireDate: z.string().optional(),
  healthCertificate: z.string().optional(),
  healthCertificateExpiry: z.string().optional(),
  iqamaNumber: z.string().optional(),
  iqamaExpiry: z.string().optional(),
  passportNumber: z.string().optional(),
  passportExpiry: z.string().optional(),
  phoneNumber: z.string().optional(),
  emergencyContact: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  status: z.string().default("active"),
  contractType: z.string().optional(),
  workPermitNumber: z.string().optional(),
  notes: z.string().optional(),
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;

function getStatusBadge(status: string, isRTL: boolean = true) {
  const variants: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-800",
    terminated: "bg-red-100 text-red-800",
    on_leave: "bg-yellow-100 text-yellow-800",
  };
  const labelsAr: Record<string, string> = {
    active: "نشط",
    inactive: "غير نشط",
    terminated: "منتهي",
    on_leave: "في إجازة",
  };
  const labelsEn: Record<string, string> = {
    active: "Active",
    inactive: "Inactive",
    terminated: "Terminated",
    on_leave: "On Leave",
  };
  const labels = isRTL ? labelsAr : labelsEn;
  return <Badge className={variants[status] || variants.active}>{labels[status] || status}</Badge>;
}

function getHealthBadge(status: string, isRTL: boolean = true) {
  const variants: Record<string, string> = {
    valid: "bg-green-100 text-green-800",
    expired: "bg-red-100 text-red-800",
    pending: "bg-yellow-100 text-yellow-800",
    none: "bg-gray-100 text-gray-800",
  };
  const labelsAr: Record<string, string> = {
    valid: "ساري",
    expired: "منتهي",
    pending: "قيد التجديد",
    none: "لا يوجد",
  };
  const labelsEn: Record<string, string> = {
    valid: "Valid",
    expired: "Expired",
    pending: "Pending",
    none: "None",
  };
  const labels = isRTL ? labelsAr : labelsEn;
  return <Badge className={variants[status] || variants.none}>{labels[status] || status}</Badge>;
}

function formatCurrency(value: number | null | undefined, isRTL: boolean = true): string {
  if (value == null) return "--";
  const suffix = isRTL ? " ريال" : " SAR";
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value) + suffix;
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) return "--";
  return new Intl.NumberFormat('en-US').format(value);
}

const getHealthLabel = (status: string, isRTL: boolean = true): string => {
  const labelsAr: Record<string, string> = {
    valid: "ساري",
    expired: "منتهي",
    pending: "قيد التجديد",
    none: "لا يوجد",
  };
  const labelsEn: Record<string, string> = {
    valid: "Valid",
    expired: "Expired",
    pending: "Pending",
    none: "None",
  };
  const labels = isRTL ? labelsAr : labelsEn;
  return labels[status] || status;
};

const getStatusLabel = (status: string, isRTL: boolean = true): string => {
  const labelsAr: Record<string, string> = {
    active: "نشط",
    inactive: "غير نشط",
    terminated: "منتهي",
    on_leave: "في إجازة",
  };
  const labelsEn: Record<string, string> = {
    active: "Active",
    inactive: "Inactive",
    terminated: "Terminated",
    on_leave: "On Leave",
  };
  const labels = isRTL ? labelsAr : labelsEn;
  return labels[status] || status;
};

const TRANSFER_STATUS_LABELS_AR: Record<string, { label: string; color: string }> = {
  pending: { label: "في انتظار موافقة مدير الفرع المصدر", color: "bg-yellow-100 text-yellow-800" },
  source_approved: { label: "موافق عليه من الفرع المصدر", color: "bg-blue-100 text-blue-800" },
  dest_approved: { label: "موافق عليه من الفرع الوجهة", color: "bg-indigo-100 text-indigo-800" },
  hr_approved: { label: "معتمد من الموارد البشرية", color: "bg-green-100 text-green-800" },
  completed: { label: "مكتمل", color: "bg-green-100 text-green-800" },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-800" },
  cancelled: { label: "ملغي", color: "bg-gray-100 text-gray-800" },
};

const TRANSFER_STATUS_LABELS_EN: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending Source Manager Approval", color: "bg-yellow-100 text-yellow-800" },
  source_approved: { label: "Approved by Source Branch", color: "bg-blue-100 text-blue-800" },
  dest_approved: { label: "Approved by Destination Branch", color: "bg-indigo-100 text-indigo-800" },
  hr_approved: { label: "Approved by HR", color: "bg-green-100 text-green-800" },
  completed: { label: "Completed", color: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-800" },
};

function EmployeeTransfersTab({ employees, branches }: { employees: BranchEmployee[]; branches: Branch[] }) {
  const { t, i18n } = useTranslation("hr");
  const isRTL = i18n.language === "ar";
  const TRANSFER_STATUS_LABELS = isRTL ? TRANSFER_STATUS_LABELS_AR : TRANSFER_STATUS_LABELS_EN;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [destinationBranch, setDestinationBranch] = useState<string>("");
  const [effectiveDate, setEffectiveDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewingTransfer, setViewingTransfer] = useState<EmployeeTransferRequest | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState<string>("");
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);

  const { data: transfers, isLoading } = useQuery<EmployeeTransferRequest[]>({
    queryKey: ["/api/employee-transfers"],
    queryFn: async () => {
      const res = await fetch("/api/employee-transfers");
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/employee-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || (isRTL ? "فشل في إنشاء طلب النقل" : "Failed to create transfer request"));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-transfers"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: isRTL ? "تم إنشاء طلب النقل بنجاح" : "Transfer request created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: isRTL ? "خطأ" : "Error", description: error.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, approverRole, notes }: { id: number; approverRole: string; notes?: string }) => {
      const res = await fetch(`/api/employee-transfers/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverRole, notes }),
      });
      if (!res.ok) throw new Error(isRTL ? "فشل في الموافقة" : "Failed to approve");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-transfers"] });
      setIsDetailsDialogOpen(false);
      toast({ title: isRTL ? "تمت الموافقة بنجاح" : "Approved successfully" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, approverRole, rejectionReason }: { id: number; approverRole: string; rejectionReason: string }) => {
      const res = await fetch(`/api/employee-transfers/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverRole, rejectionReason }),
      });
      if (!res.ok) throw new Error(isRTL ? "فشل في الرفض" : "Failed to reject");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-transfers"] });
      setIsDetailsDialogOpen(false);
      toast({ title: isRTL ? "تم رفض الطلب" : "Request rejected" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/employee-transfers/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(isRTL ? "فشل في إتمام النقل" : "Failed to complete transfer");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch-employees/bundle"] });
      setIsDetailsDialogOpen(false);
      toast({ title: isRTL ? "تم تنفيذ النقل بنجاح" : "Transfer completed successfully" });
    },
  });

  const resetForm = () => {
    setSelectedEmployee(null);
    setDestinationBranch("");
    setEffectiveDate("");
    setReason("");
    setNotes("");
    setEmployeeSearchQuery("");
    setIsEmployeeDropdownOpen(false);
  };

  const filteredEmployees = employees.filter(e => {
    if (e.status !== "active") return false;
    if (!employeeSearchQuery.trim()) return true;
    const query = employeeSearchQuery.toLowerCase().trim();
    const matchesName = e.employeeName.toLowerCase().includes(query);
    const matchesNumber = e.employeeNumber?.toLowerCase().includes(query);
    return matchesName || matchesNumber;
  });

  const getEmployeeName = (employeeId: number) => {
    const emp = employees.find(e => e.id === employeeId);
    return emp?.employeeName || (isRTL ? "غير معروف" : "Unknown");
  };

  const getBranchName = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || branchId;
  };

  const getSelectedEmployee = () => {
    return employees.find(e => e.id === selectedEmployee);
  };

  const handleCreateTransfer = () => {
    if (!selectedEmployee || !destinationBranch || !effectiveDate || !reason) {
      toast({ title: isRTL ? "خطأ" : "Error", description: isRTL ? "جميع الحقول المطلوبة يجب أن تكون موجودة" : "All required fields must be filled", variant: "destructive" });
      return;
    }
    
    const emp = getSelectedEmployee();
    if (!emp) return;
    
    createMutation.mutate({
      employeeId: selectedEmployee,
      sourceBranchId: emp.branchId,
      destinationBranchId: destinationBranch,
      effectiveDate,
      reason,
      notes,
    });
  };

  const getCurrentApproverRole = (status: string) => {
    if (status === "pending") return "source_manager";
    if (status === "source_approved") return "destination_manager";
    if (status === "dest_approved") return "hr_admin";
    return null;
  };

  const filteredTransfers = transfers?.filter(t => 
    statusFilter === "all" || t.status === statusFilter
  ) || [];

  const stats = {
    pending: transfers?.filter(t => ["pending", "source_approved", "dest_approved"].includes(t.status)).length || 0,
    approved: transfers?.filter(t => t.status === "hr_approved").length || 0,
    completed: transfers?.filter(t => t.status === "completed").length || 0,
    rejected: transfers?.filter(t => t.status === "rejected").length || 0,
  };

  return (
    <div className="page-container space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      {/* KPI Cards — transfers summary */}
      <div className="kpi-grid">
        <KpiCard label={isRTL ? "معلقة" : "Pending"} value={stats.pending} icon={Clock} tone="inventory" data-testid="kpi-transfers-pending" />
        <KpiCard label={isRTL ? "معتمدة" : "Approved"} value={stats.approved} icon={CheckCircle} tone="money" data-testid="kpi-transfers-approved" />
        <KpiCard label={isRTL ? "مكتملة" : "Completed"} value={stats.completed} icon={ArrowRight} tone="production" data-testid="kpi-transfers-completed" />
        <KpiCard label={isRTL ? "مرفوضة" : "Rejected"} value={stats.rejected} icon={XCircle} tone="alert" data-testid="kpi-transfers-rejected" />
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Network className="w-5 h-5" />
              {isRTL ? "طلبات نقل الموظفين" : "Employee Transfer Requests"}
            </CardTitle>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-amber-600 hover:bg-amber-700" data-testid="btn-create-transfer">
                  <Plus className="w-4 h-4 ml-2" />
                  {isRTL ? "طلب نقل جديد" : "New Transfer Request"}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
                <DialogHeader>
                  <DialogTitle>{isRTL ? "إنشاء طلب نقل موظف" : "Create Employee Transfer Request"}</DialogTitle>
                  <DialogDescription>{isRTL ? "اختر الموظف والفرع الجديد ومعلومات النقل" : "Select the employee, new branch, and transfer details"}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>{isRTL ? "الموظف * (ابحث بالاسم أو رقم الموظف)" : "Employee * (search by name or number)"}</Label>
                    <div className="relative">
                      <div className="relative">
                        <Search className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
                        <Input
                          value={selectedEmployee ? `${getSelectedEmployee()?.employeeName} (${getSelectedEmployee()?.employeeNumber || ""})` : employeeSearchQuery}
                          onChange={(e) => {
                            setEmployeeSearchQuery(e.target.value);
                            setSelectedEmployee(null);
                            setIsEmployeeDropdownOpen(true);
                          }}
                          onFocus={() => setIsEmployeeDropdownOpen(true)}
                          placeholder={isRTL ? "ابحث باسم الموظف أو رقمه..." : "Search by name or number..."}
                          className={isRTL ? "pr-10" : "pl-10"}
                          data-testid="input-employee-search"
                        />
                        {selectedEmployee && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                            onClick={() => {
                              setSelectedEmployee(null);
                              setEmployeeSearchQuery("");
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      {isEmployeeDropdownOpen && !selectedEmployee && (
                        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredEmployees.length === 0 ? (
                            <div className="p-3 text-center text-gray-500 text-sm">
                              {isRTL ? "لا يوجد موظفين مطابقين" : "No matching employees"}
                            </div>
                          ) : (
                            filteredEmployees.slice(0, 20).map(emp => (
                              <div
                                key={emp.id}
                                className="p-3 hover:bg-amber-50 cursor-pointer border-b last:border-b-0"
                                onClick={() => {
                                  setSelectedEmployee(emp.id);
                                  setIsEmployeeDropdownOpen(false);
                                  setEmployeeSearchQuery("");
                                }}
                                data-testid={`employee-option-${emp.id}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium">{emp.employeeName}</p>
                                    <p className="text-sm text-gray-500">
                                      {emp.employeeNumber && <span className="text-amber-600 ml-2">#{emp.employeeNumber}</span>}
                                      {getBranchName(emp.branchId)}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className="text-xs">{emp.jobTitle}</Badge>
                                </div>
                              </div>
                            ))
                          )}
                          {filteredEmployees.length > 20 && (
                            <div className="p-2 text-center text-gray-400 text-xs bg-gray-50">
                              {isRTL ? `يوجد ${filteredEmployees.length - 20} موظف آخر - حدد البحث للمزيد` : `${filteredEmployees.length - 20} more employees - refine search`}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {selectedEmployee && (
                    <div className="p-3 bg-amber-50 rounded-lg text-sm border border-amber-200">
                      <div className="flex items-center gap-2 mb-2">
                        <UserCheck className="w-4 h-4 text-amber-600" />
                        <span className="font-medium text-amber-800">{isRTL ? "الموظف المختار" : "Selected Employee"}</span>
                      </div>
                      <p><strong>{isRTL ? "الاسم:" : "Name:"}</strong> {getSelectedEmployee()?.employeeName}</p>
                      {getSelectedEmployee()?.employeeNumber && (
                        <p><strong>{isRTL ? "رقم الموظف:" : "Employee #:"}</strong> {getSelectedEmployee()?.employeeNumber}</p>
                      )}
                      <p><strong>{isRTL ? "الفرع الحالي:" : "Current Branch:"}</strong> {getBranchName(getSelectedEmployee()?.branchId || "")}</p>
                      <p><strong>{isRTL ? "الوظيفة:" : "Job Title:"}</strong> {getSelectedEmployee()?.jobTitle}</p>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label>{isRTL ? "الفرع الجديد *" : "New Branch *"}</Label>
                    <Select value={destinationBranch} onValueChange={setDestinationBranch}>
                      <SelectTrigger data-testid="select-destination">
                        <SelectValue placeholder={isRTL ? "اختر الفرع الجديد" : "Select new branch"} />
                      </SelectTrigger>
                      <SelectContent>
                        {branches
                          .filter(b => b.id !== getSelectedEmployee()?.branchId)
                          .map(branch => (
                            <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>{isRTL ? "تاريخ النقل المطلوب *" : "Requested Transfer Date *"}</Label>
                    <Input 
                      type="date" 
                      value={effectiveDate} 
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      data-testid="input-effective-date"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>{isRTL ? "سبب النقل *" : "Transfer Reason *"}</Label>
                    <Textarea 
                      value={reason} 
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={isRTL ? "اشرح سبب طلب النقل" : "Explain the reason for transfer"}
                      data-testid="input-reason"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>{isRTL ? "ملاحظات إضافية" : "Additional Notes"}</Label>
                    <Textarea 
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={isRTL ? "أي ملاحظات إضافية (اختياري)" : "Any additional notes (optional)"}
                      data-testid="input-notes"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
                  <Button 
                    onClick={handleCreateTransfer}
                    className="bg-amber-600 hover:bg-amber-700"
                    disabled={createMutation.isPending}
                    data-testid="btn-submit-transfer"
                  >
                    {createMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                    {isRTL ? "إرسال الطلب" : "Submit Request"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-status-filter">
                <SelectValue placeholder={isRTL ? "فلترة حسب الحالة" : "Filter by Status"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? "جميع الحالات" : "All Statuses"}</SelectItem>
                <SelectItem value="pending">{isRTL ? "معلق" : "Pending"}</SelectItem>
                <SelectItem value="source_approved">{isRTL ? "موافق من المصدر" : "Source Approved"}</SelectItem>
                <SelectItem value="dest_approved">{isRTL ? "موافق من الوجهة" : "Dest. Approved"}</SelectItem>
                <SelectItem value="hr_approved">{isRTL ? "معتمد" : "HR Approved"}</SelectItem>
                <SelectItem value="completed">{isRTL ? "مكتمل" : "Completed"}</SelectItem>
                <SelectItem value="rejected">{isRTL ? "مرفوض" : "Rejected"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Network className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{isRTL ? "لا توجد طلبات نقل" : "No transfer requests"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الموظف" : "Employee"}</TableHead>
                  <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "من" : "From"}</TableHead>
                  <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "إلى" : "To"}</TableHead>
                  <TableHead className={`${isRTL ? "text-right" : "text-left"} hidden md:table-cell`}>{isRTL ? "تاريخ النقل" : "Transfer Date"}</TableHead>
                  <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الحالة" : "Status"}</TableHead>
                  <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "إجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.map((transfer) => (
                  <TableRow key={transfer.id} data-testid={`row-transfer-${transfer.id}`}>
                    <TableCell className="text-xs sm:text-sm">{getEmployeeName(transfer.employeeId)}</TableCell>
                    <TableCell className="text-xs sm:text-sm">{getBranchName(transfer.sourceBranchId)}</TableCell>
                    <TableCell className="text-xs sm:text-sm">{getBranchName(transfer.destinationBranchId)}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs sm:text-sm">{transfer.effectiveDate}</TableCell>
                    <TableCell>
                      <Badge className={`${TRANSFER_STATUS_LABELS[transfer.status]?.color || "bg-gray-100"} text-[10px] sm:text-xs`}>
                        {TRANSFER_STATUS_LABELS[transfer.status]?.label || transfer.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setViewingTransfer(transfer);
                          setIsDetailsDialogOpen(true);
                        }}
                        data-testid={`btn-view-transfer-${transfer.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-lg" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isRTL ? "تفاصيل طلب النقل" : "Transfer Request Details"}</DialogTitle>
          </DialogHeader>
          {viewingTransfer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">{isRTL ? "الموظف" : "Employee"}</p>
                  <p className="font-medium">{getEmployeeName(viewingTransfer.employeeId)}</p>
                </div>
                <div>
                  <p className="text-gray-500">{isRTL ? "الحالة" : "Status"}</p>
                  <Badge className={TRANSFER_STATUS_LABELS[viewingTransfer.status]?.color}>
                    {TRANSFER_STATUS_LABELS[viewingTransfer.status]?.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-500">{isRTL ? "من فرع" : "From Branch"}</p>
                  <p className="font-medium">{getBranchName(viewingTransfer.sourceBranchId)}</p>
                </div>
                <div>
                  <p className="text-gray-500">{isRTL ? "إلى فرع" : "To Branch"}</p>
                  <p className="font-medium">{getBranchName(viewingTransfer.destinationBranchId)}</p>
                </div>
                <div>
                  <p className="text-gray-500">{isRTL ? "تاريخ النقل" : "Transfer Date"}</p>
                  <p className="font-medium">{viewingTransfer.effectiveDate}</p>
                </div>
                <div>
                  <p className="text-gray-500">{isRTL ? "تاريخ الطلب" : "Request Date"}</p>
                  <p className="font-medium">{new Date(viewingTransfer.requestedAt).toLocaleDateString(isRTL ? "en-GB" : "en-US")}</p>
                </div>
              </div>
              
              <div>
                <p className="text-gray-500 text-sm">{isRTL ? "سبب النقل" : "Transfer Reason"}</p>
                <p className="font-medium bg-gray-50 p-2 rounded">{viewingTransfer.reason}</p>
              </div>
              
              {viewingTransfer.notes && (
                <div>
                  <p className="text-gray-500 text-sm">{isRTL ? "ملاحظات" : "Notes"}</p>
                  <p className="bg-gray-50 p-2 rounded">{viewingTransfer.notes}</p>
                </div>
              )}
              
              {viewingTransfer.rejectionReason && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-red-600 text-sm font-medium">{isRTL ? "سبب الرفض" : "Rejection Reason"}</p>
                  <p className="text-red-800">{viewingTransfer.rejectionReason}</p>
                </div>
              )}

              {/* Approval Actions */}
              {["pending", "source_approved", "dest_approved"].includes(viewingTransfer.status) && (
                <div className="border-t pt-4 space-y-3">
                  <p className="font-medium">{isRTL ? "إجراءات الموافقة" : "Approval Actions"}</p>
                  <div className="space-y-2">
                    <Label>{isRTL ? "ملاحظات الموافقة (اختياري)" : "Approval Notes (optional)"}</Label>
                    <Input 
                      value={approvalNotes} 
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder={isRTL ? "أدخل ملاحظات الموافقة" : "Enter approval notes"}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => approveMutation.mutate({
                        id: viewingTransfer.id,
                        approverRole: getCurrentApproverRole(viewingTransfer.status) || "",
                        notes: approvalNotes
                      })}
                      disabled={approveMutation.isPending}
                      data-testid="btn-approve"
                    >
                      <CheckCircle className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                      {isRTL ? "موافقة" : "Approve"}
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="destructive" data-testid="btn-reject">
                          <XCircle className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                          {isRTL ? "رفض" : "Reject"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent dir={isRTL ? "rtl" : "ltr"}>
                        <DialogHeader>
                          <DialogTitle>{isRTL ? "رفض طلب النقل" : "Reject Transfer Request"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>{isRTL ? "سبب الرفض *" : "Rejection Reason *"}</Label>
                            <Textarea 
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              placeholder={isRTL ? "أدخل سبب رفض الطلب" : "Enter rejection reason"}
                            />
                          </div>
                          <Button 
                            variant="destructive" 
                            className="w-full"
                            onClick={() => rejectMutation.mutate({
                              id: viewingTransfer.id,
                              approverRole: getCurrentApproverRole(viewingTransfer.status) || "",
                              rejectionReason
                            })}
                            disabled={!rejectionReason || rejectMutation.isPending}
                          >
                            {isRTL ? "تأكيد الرفض" : "Confirm Rejection"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}

              {/* Complete Button */}
              {viewingTransfer.status === "hr_approved" && (
                <div className="border-t pt-4">
                  <Button 
                    className="w-full bg-amber-600 hover:bg-amber-700"
                    onClick={() => completeMutation.mutate(viewingTransfer.id)}
                    disabled={completeMutation.isPending}
                    data-testid="btn-complete"
                  >
                    {completeMutation.isPending && <Loader2 className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"} animate-spin`} />}
                    <ArrowRight className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                    {isRTL ? "تنفيذ النقل" : "Execute Transfer"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function BranchEmployeesPage() {
  const { t, i18n } = useTranslation("hr");
  const isRTL = i18n.language === "ar";
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { branches, canSelectBranch, userBranchId } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState<string>(userBranchId || "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNationality, setSelectedNationality] = useState<string>("all");
  const [selectedJobTitle, setSelectedJobTitle] = useState<string>("all");
  // Read initial status filter from URL (?status=inactive|terminated|suspended|on_leave|active)
  // so deep-links from HR Hub tiles land on the correct filtered view.
  const initialStatus = (() => {
    try {
      const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const s = params.get("status");
      const allowed = ["active", "inactive", "terminated", "suspended", "on_leave"];
      return s && allowed.includes(s) ? s : "all";
    } catch { return "all"; }
  })();
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatus);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<BranchEmployee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<BranchEmployee | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedUserToLink, setSelectedUserToLink] = useState<string>("");
  const [accountMode, setAccountMode] = useState<"create" | "link">("create");
  const [newAccountUsername, setNewAccountUsername] = useState<string>("");
  const [newAccountPassword, setNewAccountPassword] = useState<string>("");
  const [resetPasswordValue, setResetPasswordValue] = useState<string>("");
  const [showResetPassword, setShowResetPassword] = useState<boolean>(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importBranchId, setImportBranchId] = useState<string>("");
  const [mainTab, setMainTab] = useState<string>("employees");
  const [settingsCategory, setSettingsCategory] = useState<string>("nationality");
  const [isSettingDialogOpen, setIsSettingDialogOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<EmployeeSetting | null>(null);
  const [newSettingValue, setNewSettingValue] = useState("");
  const [newSettingLabelAr, setNewSettingLabelAr] = useState("");
  const [newSettingLabelEn, setNewSettingLabelEn] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<BranchEmployee | null>(null);
  const [salaryMin, setSalaryMin] = useState<number | undefined>(undefined);
  const [salaryMax, setSalaryMax] = useState<number | undefined>(undefined);
  const [hireDateFrom, setHireDateFrom] = useState<string>("");
  const [hireDateTo, setHireDateTo] = useState<string>("");

  React.useEffect(() => {
    if (!canSelectBranch && userBranchId && selectedBranch !== userBranchId) {
      setSelectedBranch(userBranchId);
    }
  }, [canSelectBranch, userBranchId, selectedBranch]);

  const isBranchReady = canSelectBranch || !!userBranchId;
  const { data: bundle, isLoading, error: bundleError } = useQuery<{
    employees?: any[];
    stats?: any;
    systemUsers?: any[];
  }>({
    queryKey: ["/api/branch-employees/bundle", selectedBranch, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch !== "all") params.set("branchId", selectedBranch);
      if (selectedStatus !== "all") params.set("status", selectedStatus);
      const qs = params.toString();
      const url = qs ? `/api/branch-employees/bundle?${qs}` : "/api/branch-employees/bundle";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: failed to fetch employees bundle`);
      return res.json();
    },
    enabled: isBranchReady,
    staleTime: 60 * 1000,
    retry: 1,
  });

  // Defensive dedupe by id (in case any duplicates ever slip through)
  const rawEmployees = bundle?.employees as BranchEmployee[] | undefined;
  const employees = React.useMemo(() => {
    if (!rawEmployees) return undefined;
    const seen = new Map<number, BranchEmployee>();
    for (const e of rawEmployees) if (!seen.has(e.id)) seen.set(e.id, e);
    return Array.from(seen.values());
  }, [rawEmployees]);
  const stats = bundle?.stats;
  const systemUsers = bundle?.systemUsers;

  const { data: employeeAttendance, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ["/api/branch-employees/attendance", viewingEmployee?.id],
    queryFn: async () => {
      if (!viewingEmployee?.id) return [];
      const res = await fetch(`/api/branch-employees/${viewingEmployee.id}/attendance`);
      return res.json();
    },
    enabled: !!viewingEmployee?.id,
  });

  const { data: employeeSchedules, isLoading: isLoadingSchedules } = useQuery({
    queryKey: ["/api/branch-employees/schedules", viewingEmployee?.id],
    queryFn: async () => {
      if (!viewingEmployee?.id) return [];
      const res = await fetch(`/api/branch-employees/${viewingEmployee.id}/schedules`);
      return res.json();
    },
    enabled: !!viewingEmployee?.id,
  });

  const { data: employeeStatusHistory, isLoading: isLoadingStatusHistory } = useQuery<any[]>({
    queryKey: ["/api/branch-employees/status-history", viewingEmployee?.id],
    queryFn: async () => {
      if (!viewingEmployee?.id) return [];
      const res = await fetch(`/api/branch-employees/${viewingEmployee.id}/status-history`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!viewingEmployee?.id,
  });

  const { data: employeeTimesheets, isLoading: isLoadingTimesheets } = useQuery({
    queryKey: ["/api/branch-employees/timesheets", viewingEmployee?.id],
    queryFn: async () => {
      if (!viewingEmployee?.id) return [];
      const res = await fetch(`/api/branch-employees/${viewingEmployee.id}/timesheets`);
      return res.json();
    },
    enabled: !!viewingEmployee?.id,
  });

  const handleViewDetails = (employee: BranchEmployee) => {
    setViewingEmployee(employee);
    setSelectedUserToLink("");
    setAccountMode("create");
    setNewAccountUsername("");
    setNewAccountPassword("");
    setResetPasswordValue("");
    setShowResetPassword(false);
    setIsDetailsDialogOpen(true);
  };

  const linkUserMutation = useMutation({
    mutationFn: async ({ employeeId, userId }: { employeeId: number; userId: string }) => {
      const res = await fetch(`/api/branch-employees/${employeeId}/link-user`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("فشل في ربط الموظف");
      return res.json();
    },
    onSuccess: (updatedEmployee) => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch-employees/bundle"] });
      setViewingEmployee(updatedEmployee);
      setSelectedUserToLink("");
      toast({ title: "تم ربط الموظف بالحساب بنجاح" });
    },
    onError: (e: any) => {
      toast({ title: "فشل في ربط الموظف", description: e?.message, variant: "destructive" });
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: async ({ employeeId, username, password, sendWhatsapp }: { employeeId: number; username: string; password: string; sendWhatsapp?: boolean }) => {
      const res = await fetch(`/api/branch-employees/${employeeId}/create-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password, sendWhatsapp: !!sendWhatsapp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل في إنشاء الحساب");
      return data;
    },
    onSuccess: (data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch-employees/bundle"] });
      setViewingEmployee((prev) => prev ? { ...prev, linkedUserId: "linked" } as BranchEmployee : prev);
      setNewAccountUsername("");
      setNewAccountPassword("");
      if (variables?.sendWhatsapp) {
        if (data?.whatsappSent) {
          toast({ title: "تم إنشاء الحساب وإرسال بيانات الدخول للموظف على الواتساب" });
        } else {
          toast({
            title: "تم إنشاء الحساب",
            description: data?.whatsappError === "no_phone"
              ? "لا يوجد رقم جوال مسجّل للموظف لإرسال البيانات عليه"
              : "تعذّر إرسال البيانات على الواتساب، يمكنك نسخها وإرسالها يدوياً",
            variant: "destructive",
          });
        }
      } else {
        toast({ title: "تم إنشاء حساب الدخول للموظف بنجاح" });
      }
    },
    onError: (e: any) => {
      toast({ title: "تعذّر إنشاء الحساب", description: e?.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ employeeId, password, sendWhatsapp }: { employeeId: number; password: string; sendWhatsapp?: boolean }) => {
      const res = await fetch(`/api/branch-employees/${employeeId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password, sendWhatsapp: !!sendWhatsapp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل في إعادة تعيين كلمة المرور");
      return data;
    },
    onSuccess: (data: any, variables: any) => {
      setResetPasswordValue("");
      setShowResetPassword(false);
      if (variables?.sendWhatsapp) {
        if (data?.whatsappSent) {
          toast({ title: "تم تحديث كلمة المرور وإرسالها للموظف على الواتساب" });
        } else {
          toast({
            title: "تم تحديث كلمة المرور",
            description: data?.whatsappError === "no_phone"
              ? "لا يوجد رقم جوال مسجّل للموظف لإرسال البيانات عليه"
              : "تعذّر إرسال البيانات على الواتساب، يمكنك إرسالها يدوياً",
            variant: "destructive",
          });
        }
      } else {
        toast({ title: "تم تحديث كلمة المرور بنجاح" });
      }
    },
    onError: (e: any) => {
      toast({ title: "تعذّر تحديث كلمة المرور", description: e?.message, variant: "destructive" });
    },
  });

  const unlinkUserMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      const res = await fetch(`/api/branch-employees/${employeeId}/unlink-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل في فك الارتباط");
      return data;
    },
    onSuccess: (updatedEmployee) => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch-employees/bundle"] });
      setViewingEmployee(updatedEmployee);
      toast({ title: "تم فك ارتباط الموظف بالحساب" });
    },
    onError: (e: any) => {
      toast({ title: "تعذّر فك الارتباط", description: e?.message, variant: "destructive" });
    },
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ employeeId, file }: { employeeId: number; file: File }) => {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch(`/api/uploads?folder=employees`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData?.error || "فشل في رفع الصورة");
      const photoUrl = uploadData.downloadUrl as string;
      const saveRes = await fetch(`/api/branch-employees/${employeeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ photoUrl }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData?.error || "فشل في حفظ الصورة");
      return saveData;
    },
    onSuccess: (updatedEmployee) => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch-employees/bundle"] });
      setViewingEmployee(updatedEmployee);
      toast({ title: isRTL ? "تم تحديث صورة الموظف" : "Employee photo updated" });
    },
    onError: (e: any) => {
      toast({ title: isRTL ? "تعذّر تحديث الصورة" : "Failed to update photo", description: e?.message, variant: "destructive" });
    },
  });

  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !viewingEmployee?.id) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: isRTL ? "الرجاء اختيار صورة" : "Please choose an image file", variant: "destructive" });
      e.target.value = "";
      return;
    }
    uploadPhotoMutation.mutate({ employeeId: viewingEmployee.id, file });
    e.target.value = "";
  };

  // توليد كلمة مرور قوية (حروف كبيرة + صغيرة + أرقام، بدون أحرف ملتبسة)
  const generatePassword = () => {
    const U = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const L = "abcdefghijkmnpqrstuvwxyz";
    const D = "23456789";
    const all = U + L + D;
    const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
    const chars = [pick(U), pick(L), pick(D), pick(D)];
    for (let i = 0; i < 6; i++) chars.push(pick(all));
    return chars.sort(() => Math.random() - 0.5).join("");
  };

  // توليد اسم مستخدم من بيانات الموظف (الاسم بالإنجليزية أو الرقم الوظيفي) + لاحقة عشوائية
  const generateAccountCredentials = () => {
    const emp = viewingEmployee;
    const en = (emp as any)?.employeeNameEn as string | undefined;
    let base = "";
    if (en) base = en.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
    if (!base && emp?.employeeNumber) base = `emp${String(emp.employeeNumber).replace(/[^a-zA-Z0-9]/g, "")}`;
    if (!base) base = "emp";
    const username = `${base}.${Math.floor(100 + Math.random() * 900)}`.slice(0, 50);
    setNewAccountUsername(username);
    setNewAccountPassword(generatePassword());
  };

  const copyAccountCredentials = async () => {
    if (!newAccountUsername || !newAccountPassword) return;
    try {
      await navigator.clipboard.writeText(`اسم المستخدم: ${newAccountUsername}\nكلمة المرور: ${newAccountPassword}`);
      toast({ title: isRTL ? "تم نسخ بيانات الدخول" : "Login details copied" });
    } catch {
      toast({ title: isRTL ? "تعذّر النسخ" : "Copy failed", variant: "destructive" });
    }
  };

  // Employee Settings Queries and Mutations
  const { data: employeeSettingsData, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["/api/employee-settings"],
    queryFn: async () => {
      const res = await fetch("/api/employee-settings", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const settingsByCategory = React.useMemo(() => {
    const grouped: Record<string, EmployeeSetting[]> = {};
    const settingsArr = Array.isArray(employeeSettingsData) ? employeeSettingsData : [];
    settingsArr.forEach((setting) => {
      if (!grouped[setting.category]) {
        grouped[setting.category] = [];
      }
      grouped[setting.category].push(setting);
    });
    return grouped;
  }, [employeeSettingsData]);

  // معالجة معلمة الوظيفة من الرابط
  React.useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const jobTitleParam = urlParams.get('jobTitle');
    if (jobTitleParam) {
      const decodedTitle = decodeURIComponent(jobTitleParam);
      const jobTitlesFromDB = settingsByCategory.job_title?.filter(s => s.isActive).map(s => s.labelAr) || [];
      if (jobTitlesFromDB.includes(decodedTitle)) {
        setSelectedJobTitle(decodedTitle);
        setSearchQuery("");
      } else {
        setSearchQuery(decodedTitle);
        setSelectedJobTitle("all");
      }
    } else {
      setSelectedJobTitle("all");
      setSearchQuery("");
    }
  }, [location, settingsByCategory.job_title]);

  const createSettingMutation = useMutation({
    mutationFn: async (data: { category: string; value: string; labelAr: string; labelEn?: string }) => {
      const res = await fetch("/api/employee-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("فشل في إنشاء الإعداد");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-settings"] });
      setIsSettingDialogOpen(false);
      setNewSettingValue("");
      setNewSettingLabelAr("");
      setNewSettingLabelEn("");
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<EmployeeSetting> }) => {
      const res = await fetch(`/api/employee-settings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("فشل في تحديث الإعداد");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-settings"] });
      setIsSettingDialogOpen(false);
      setEditingSetting(null);
      setNewSettingValue("");
      setNewSettingLabelAr("");
      setNewSettingLabelEn("");
    },
  });

  const deleteSettingMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/employee-settings/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("فشل في حذف الإعداد");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-settings"] });
    },
  });

  const handleSaveSetting = () => {
    if (editingSetting) {
      updateSettingMutation.mutate({
        id: editingSetting.id,
        data: {
          value: newSettingValue,
          labelAr: newSettingLabelAr,
          labelEn: newSettingLabelEn || undefined,
        },
      });
    } else {
      createSettingMutation.mutate({
        category: settingsCategory,
        value: newSettingValue,
        labelAr: newSettingLabelAr,
        labelEn: newSettingLabelEn || undefined,
      });
    }
  };

  const handleEditSetting = (setting: EmployeeSetting) => {
    setEditingSetting(setting);
    setNewSettingValue(setting.value);
    setNewSettingLabelAr(setting.labelAr);
    setNewSettingLabelEn(setting.labelEn || "");
    setIsSettingDialogOpen(true);
  };

  const handleAddSetting = () => {
    setEditingSetting(null);
    setNewSettingValue("");
    setNewSettingLabelAr("");
    setNewSettingLabelEn("");
    setIsSettingDialogOpen(true);
  };

  const SETTING_CATEGORIES = [
    { value: "nationality", labelAr: "الجنسيات", labelEn: "Nationalities", icon: Flag },
    { value: "job_title", labelAr: "الوظائف", labelEn: "Job Titles", icon: Briefcase },
    { value: "department", labelAr: "الأقسام", labelEn: "Departments", icon: Layers },
    { value: "contract_type", labelAr: "أنواع العقود", labelEn: "Contract Types", icon: FileCheck },
    { value: "bank", labelAr: "البنوك", labelEn: "Banks", icon: CreditCard },
  ];

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      branchId: "",
      employeeName: "",
      jobTitle: "",
      nationality: "",
      salary: 0,
      housingAllowance: 0,
      transportAllowance: 0,
      foodAllowance: 0,
      otherAllowances: 0,
      socialInsuranceDeduction: 0,
      status: "active",
      healthCertificate: "none",
    },
  });

  // استخدام useWatch لتحسين الأداء - مراقبة الحقول المطلوبة فقط
  const watchedBranchId = useWatch({ control: form.control, name: "branchId" });
  const watchedStatus = useWatch({ control: form.control, name: "status" });
  const watchedJobTitle = useWatch({ control: form.control, name: "jobTitle" });
  const watchedNationality = useWatch({ control: form.control, name: "nationality" });
  const watchedDepartment = useWatch({ control: form.control, name: "department" });
  const watchedHealthCertificate = useWatch({ control: form.control, name: "healthCertificate" });
  const watchedBankName = useWatch({ control: form.control, name: "bankName" });
  const watchedContractType = useWatch({ control: form.control, name: "contractType" });
  const watchedSalary = useWatch({ control: form.control, name: "salary" });
  const watchedHousingAllowance = useWatch({ control: form.control, name: "housingAllowance" });
  const watchedTransportAllowance = useWatch({ control: form.control, name: "transportAllowance" });
  const watchedFoodAllowance = useWatch({ control: form.control, name: "foodAllowance" });
  const watchedOtherAllowances = useWatch({ control: form.control, name: "otherAllowances" });
  const watchedSocialInsurance = useWatch({ control: form.control, name: "socialInsuranceDeduction" });

  const createMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      const res = await fetch("/api/branch-employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("فشل في إضافة الموظف");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch-employees/bundle"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "تمت الإضافة بنجاح",
        description: "تم إضافة الموظف الجديد بنجاح",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ في الإضافة",
        description: error.message || "فشل في إضافة الموظف",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EmployeeFormData }) => {
      const res = await fetch(`/api/branch-employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("فشل في تحديث الموظف");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch-employees/bundle"] });
      setIsDialogOpen(false);
      setEditingEmployee(null);
      form.reset();
      toast({
        title: "تم التحديث بنجاح",
        description: "تم تحديث بيانات الموظف بنجاح",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ في التحديث",
        description: error.message || "فشل في تحديث الموظف",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/branch-employees/${id}`, { 
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "فشل في حذف الموظف");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch-employees/bundle"] });
      setIsDeleteDialogOpen(false);
      setEmployeeToDelete(null);
      toast({
        title: "تم الحذف بنجاح",
        description: "تم حذف الموظف بنجاح",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ في الحذف",
        description: error.message || "فشل في حذف الموظف",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (employee: BranchEmployee) => {
    setEmployeeToDelete(employee);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (employeeToDelete) {
      deleteMutation.mutate(employeeToDelete.id);
    }
  };

  const handleEdit = (employee: BranchEmployee) => {
    setEditingEmployee(employee);
    form.reset({
      branchId: employee.branchId,
      employeeName: employee.employeeName,
      employeeNameEn: employee.employeeNameEn || "",
      jobTitle: employee.jobTitle,
      department: employee.department || "",
      nationality: employee.nationality,
      salary: employee.salary,
      housingAllowance: employee.housingAllowance || 0,
      transportAllowance: employee.transportAllowance || 0,
      foodAllowance: employee.foodAllowance || 0,
      otherAllowances: employee.otherAllowances || 0,
      socialInsuranceDeduction: employee.socialInsuranceDeduction || 0,
      hireDate: employee.hireDate || "",
      healthCertificate: employee.healthCertificate || "none",
      healthCertificateExpiry: employee.healthCertificateExpiry || "",
      iqamaNumber: employee.iqamaNumber || "",
      iqamaExpiry: employee.iqamaExpiry || "",
      passportNumber: employee.passportNumber || "",
      passportExpiry: employee.passportExpiry || "",
      phoneNumber: employee.phoneNumber || "",
      emergencyContact: employee.emergencyContact || "",
      bankName: employee.bankName || "",
      bankAccountNumber: employee.bankAccountNumber || "",
      status: employee.status,
      contractType: employee.contractType || "",
      workPermitNumber: employee.workPermitNumber || "",
      notes: employee.notes || "",
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: EmployeeFormData) => {
    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredEmployees = (employees || []).filter((emp: BranchEmployee) => {
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      const nameMatch = emp.employeeName?.toLowerCase().includes(query);
      const nameEnMatch = emp.employeeNameEn?.toLowerCase().includes(query);
      const empNumMatch = emp.employeeNumber?.toLowerCase().includes(query);
      const jobTitleMatch = emp.jobTitle?.toLowerCase().includes(query);
      if (!nameMatch && !nameEnMatch && !empNumMatch && !jobTitleMatch) {
        return false;
      }
    }
    if (selectedNationality !== "all" && emp.nationality !== selectedNationality) {
      return false;
    }
    if (selectedJobTitle !== "all" && emp.jobTitle !== selectedJobTitle) {
      return false;
    }
    // Status filter applied server-side via queryKey; no client re-filter needed
    if (salaryMin !== undefined && emp.salary < salaryMin) {
      return false;
    }
    if (salaryMax !== undefined && emp.salary > salaryMax) {
      return false;
    }
    if (hireDateFrom && emp.hireDate && emp.hireDate < hireDateFrom) {
      return false;
    }
    if (hireDateTo && emp.hireDate && emp.hireDate > hireDateTo) {
      return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredEmployees.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedEmployees = filteredEmployees.slice(startIndex, startIndex + pageSize);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBranch, selectedNationality, selectedJobTitle, selectedStatus, salaryMin, salaryMax, hireDateFrom, hireDateTo]);

  const hasActiveFilters = 
    selectedBranch !== "all" ||
    selectedNationality !== "all" ||
    selectedJobTitle !== "all" ||
    selectedStatus !== "all" ||
    searchQuery !== "" ||
    salaryMin !== undefined ||
    salaryMax !== undefined ||
    hireDateFrom !== "" ||
    hireDateTo !== "";

  const resetFilters = () => {
    setSelectedBranch("all");
    setSelectedNationality("all");
    setSelectedJobTitle("all");
    setSelectedStatus("all");
    setSearchQuery("");
    setSalaryMin(undefined);
    setSalaryMax(undefined);
    setHireDateFrom("");
    setHireDateTo("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const XLSX = await import("xlsx");
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        setImportPreview(jsonData);
        setIsImportDialogOpen(true);
      } catch (error) {
        alert("خطأ في قراءة الملف");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!importFile) return;
    
    // التأكد من اختيار فرع
    if (!importBranchId) {
      alert("يرجى اختيار فرع محدد قبل الاستيراد");
      return;
    }
    
    setIsImporting(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const XLSX = await import("xlsx");
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        const failedRows: { row: number; name: string; reason: string }[] = [];
        
        for (let i = 0; i < (jsonData as any[]).length; i++) {
          const row = (jsonData as any[])[i];
          const rowNumber = i + 2; // +2 because Excel row 1 is header, data starts at row 2
          const employeeName = row["الاسم"] || row["اسم الموظف"] || "";
          
          try {
            const resolvedBranchId = importBranchId;
            
            const employeeData = {
              branchId: resolvedBranchId,
              employeeName,
              jobTitle: row["الوظيفة"] || "عامل",
              nationality: row["الجنسية"] || "أخرى",
              salary: Number(row["الراتب"] || row["الراتب الأساسي"] || 0),
              housingAllowance: Number(row["بدل السكن"] || 0),
              transportAllowance: Number(row["بدل المواصلات"] || row["بدل انتقال"] || 0),
              otherAllowances: Number(row["بدلات أخرى"] || row["البدلات الأخرى"] || 0),
              phoneNumber: row["الجوال"] || row["رقم الجوال"] || row["الهاتف"] || "",
              idNumber: row["رقم الهوية"] || row["الهوية"] || "",
              department: row["القسم"] || "",
              status: "active",
            };
            
            if (!employeeData.employeeName) {
              skippedCount++;
              continue;
            }
            
            const res = await fetch("/api/branch-employees", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(employeeData),
            });
            
            if (res.ok) {
              successCount++;
            } else {
              const errorText = await res.text();
              console.error(`Import error row ${rowNumber}:`, errorText);
              let reason = errorText;
              try {
                const parsed = JSON.parse(errorText);
                reason = parsed.message || parsed.error || errorText;
              } catch { /* keep raw text */ }
              failedRows.push({ row: rowNumber, name: employeeName || "(بدون اسم)", reason: String(reason).slice(0, 200) });
              errorCount++;
            }
          } catch (err: any) {
            console.error(`Import row ${rowNumber} error:`, err);
            failedRows.push({ row: rowNumber, name: employeeName || "(بدون اسم)", reason: err?.message || "خطأ غير معروف" });
            errorCount++;
          }
        }
        
        if (successCount > 0) {
          queryClient.invalidateQueries({ queryKey: ["/api/branch-employees/bundle"] });
          toast({
            title: `تم استيراد ${successCount} موظف بنجاح`,
            description: errorCount > 0
              ? `فشل ${errorCount} صف${skippedCount > 0 ? ` • تم تجاهل ${skippedCount} صف فارغ` : ""}`
              : (skippedCount > 0 ? `تم تجاهل ${skippedCount} صف فارغ` : undefined),
          });
        }
        
        if (errorCount > 0) {
          const detailLines = failedRows.slice(0, 10).map(f => `• الصف ${f.row} (${f.name}): ${f.reason}`).join("\n");
          const more = failedRows.length > 10 ? `\n... و${failedRows.length - 10} صف آخر` : "";
          toast({
            title: `فشل استيراد ${errorCount} موظف`,
            description: detailLines + more,
            variant: "destructive",
          });
          console.error("All import failures:", failedRows);
        }
        
        if (successCount === 0 && errorCount === 0 && skippedCount > 0) {
          toast({
            title: "الملف فارغ",
            description: `جميع الصفوف (${skippedCount}) تفتقر لاسم الموظف`,
            variant: "destructive",
          });
        }
        
        setIsImportDialogOpen(false);
        setImportFile(null);
        setImportPreview([]);
        setIsImporting(false);
      };
      reader.readAsArrayBuffer(importFile);
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "تعذر قراءة الملف",
        description: error?.message || "تأكد أن الملف بصيغة Excel صحيحة",
        variant: "destructive",
      });
      setIsImporting(false);
    }
  };

  const getBranchName = (branchId: string) => {
    const branch = branches?.find((b: { id: string; name: string }) => b.id === branchId);
    return branch?.name || branchId;
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "موظفي الفروع - BUTTER BAKERY",
  });

  const exportToExcel = async () => {
    const XLSX = await import("xlsx");
    const data = filteredEmployees.map((emp: BranchEmployee, index: number) => ({
      "م": index + 1,
      "الاسم": emp.employeeName,
      "الفرع": getBranchName(emp.branchId),
      "الوظيفة": emp.jobTitle,
      "القسم": emp.department || "--",
      "الجنسية": emp.nationality,
      "الراتب الأساسي": emp.salary,
      "بدل السكن": emp.housingAllowance || 0,
      "بدل المواصلات": emp.transportAllowance || 0,
      "بدل الطعام": emp.foodAllowance || 0,
      "التأمينات الاجتماعية": emp.nationality === "سعودي" ? (emp.socialInsuranceDeduction || 0) : 0,
      "صافي الراتب": emp.totalSalary || emp.salary,
      "الشهادة الصحية": getHealthLabel(emp.healthCertificate || "none"),
      "الحالة": getStatusLabel(emp.status),
      "تاريخ التعيين": emp.hireDate || "--",
      "رقم الجوال": emp.phoneNumber || "--",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "موظفي الفروع");
    XLSX.writeFile(wb, `موظفي_الفروع_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: "خطأ",
        description: "يرجى السماح بفتح النوافذ المنبثقة لتحميل التقرير",
        variant: "destructive",
      });
      return;
    }

    const currentDate = new Date().toLocaleDateString('en-US');
    const logoUrl = '/attached_assets/logo_-5_1765206843638.png';

    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تقرير موظفي الفروع - ${currentDate}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Cairo', sans-serif;
      direction: rtl;
      padding: 20px;
      background: white;
      color: #333;
      font-size: 11px;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #d4a853;
      padding-bottom: 15px;
    }
    .header .logo { max-height: 60px; margin-bottom: 10px; }
    .header h1 { font-size: 20px; color: #333; margin-bottom: 5px; }
    .header .date { color: #666; font-size: 12px; }
    .summary {
      display: flex;
      justify-content: space-around;
      background: #f9f9f9;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .summary-item { text-align: center; }
    .summary-item .label { color: #666; font-size: 11px; }
    .summary-item .value { font-size: 16px; font-weight: bold; color: #d4a853; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px 6px; text-align: right; }
    th { background: #f5f5f5; font-weight: 600; color: #333; font-size: 10px; }
    tr:nth-child(even) { background: #fafafa; }
    .amount { font-weight: bold; color: #2e7d32; }
    .deduction { color: #ef4444; }
    .status-active { color: #22c55e; }
    .status-inactive { color: #ef4444; }
    .status-terminated { color: #6b7280; }
    .status-on_leave { color: #f59e0b; }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      color: #888;
      font-size: 10px;
    }
    .print-btn {
      position: fixed;
      top: 20px;
      left: 20px;
      background: #d4a853;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-family: 'Cairo', sans-serif;
      font-size: 14px;
      font-weight: bold;
    }
    .print-btn:hover { background: #c49843; }
    @media print {
      body { padding: 10px; }
      .no-print { display: none; }
      table { font-size: 9px; }
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">طباعة / حفظ PDF</button>
  
  <div class="header">
    <img src="${logoUrl}" alt="Butter Bakery" class="logo" onerror="this.style.display='none'" />
    <h1>تقرير موظفي الفروع</h1>
    <div class="date">التاريخ: ${currentDate}</div>
  </div>

  <div class="summary">
    <div class="summary-item">
      <div class="label">إجمالي الموظفين</div>
      <div class="value">${formatNumber(filteredEmployees.length)}</div>
    </div>
    <div class="summary-item">
      <div class="label">إجمالي الرواتب</div>
      <div class="value">${formatCurrency(stats?.totalSalaries)}</div>
    </div>
    <div class="summary-item">
      <div class="label">عدد الجنسيات</div>
      <div class="value">${formatNumber(stats?.byNationality?.length || 0)}</div>
    </div>
    <div class="summary-item">
      <div class="label">عدد الوظائف</div>
      <div class="value">${formatNumber(stats?.byJobTitle?.length || 0)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>م</th>
        <th>الرقم الوظيفي</th>
        <th>الاسم</th>
        <th>الفرع</th>
        <th>الوظيفة</th>
        <th>الجنسية</th>
        <th>الراتب الأساسي</th>
        <th>بدل السكن</th>
        <th>بدل المواصلات</th>
        <th>التأمينات</th>
        <th>صافي الراتب</th>
        <th>الحالة</th>
      </tr>
    </thead>
    <tbody>
      ${filteredEmployees.map((emp: BranchEmployee, index: number) => `
        <tr>
          <td>${formatNumber(index + 1)}</td>
          <td>${emp.employeeNumber || "--"}</td>
          <td>${emp.employeeName}</td>
          <td>${getBranchName(emp.branchId)}</td>
          <td>${emp.jobTitle}</td>
          <td>${emp.nationality}</td>
          <td class="amount">${formatNumber(emp.salary)}</td>
          <td>${formatNumber(emp.housingAllowance || 0)}</td>
          <td>${formatNumber(emp.transportAllowance || 0)}</td>
          <td class="deduction">${emp.nationality === "سعودي" ? formatNumber(emp.socialInsuranceDeduction || 0) : "-"}</td>
          <td class="amount">${formatNumber(emp.totalSalary || emp.salary)}</td>
          <td class="status-${emp.status}">${getStatusLabel(emp.status)}</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr style="background: #f5f5f5; font-weight: bold;">
        <td colspan="6">الإجمالي</td>
        <td class="amount">${formatCurrency(filteredEmployees.reduce((sum: number, emp: BranchEmployee) => sum + (emp.salary || 0), 0))}</td>
        <td>${formatCurrency(filteredEmployees.reduce((sum: number, emp: BranchEmployee) => sum + (emp.housingAllowance || 0), 0))}</td>
        <td>${formatCurrency(filteredEmployees.reduce((sum: number, emp: BranchEmployee) => sum + (emp.transportAllowance || 0), 0))}</td>
        <td class="deduction">${formatCurrency(filteredEmployees.reduce((sum: number, emp: BranchEmployee) => sum + (emp.socialInsuranceDeduction || 0), 0))}</td>
        <td class="amount">${formatCurrency(stats?.totalSalaries)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <p>BUTTER BAKERY SYSTEM - CEO COMMAND</p>
    <p>${new Date().toLocaleString('en-GB')}</p>
  </div>
</body>
</html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <Layout>
      <div className="page-container space-y-4 sm:space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <PageHeader
          icon={Users}
          tone="people"
          title={t("branchEmployees.pageTitle")}
          description={t("branchEmployees.pageDescription")}
          backHref="/attendance-dashboard"
          actions={
            <>
              <Button variant="outline" size="sm" className="h-9" onClick={exportToExcel} data-testid="button-export-excel">
                <FileSpreadsheet className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                Excel
              </Button>
              <Button variant="outline" size="sm" className="h-9" onClick={exportToPDF} data-testid="button-export-pdf">
                <Download className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                PDF
              </Button>
              <Button variant="outline" size="sm" className="h-9" onClick={() => handlePrint()} data-testid="button-print">
                <Printer className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t("branchEmployees.print")}
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-import-file"
              />
              <Button variant="outline" size="sm" className="h-9" onClick={() => fileInputRef.current?.click()} data-testid="button-import">
                <Upload className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {isRTL ? "استيراد" : "Import"}
              </Button>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white h-9" onClick={() => navigate("/organizational-structure")} data-testid="button-org-structure">
                <Network className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t("branchEmployees.orgStructure")}
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingEmployee(null);
                form.reset();
              }
            }}>
              <DialogTrigger asChild>
                <Button className="bg-amber-600 hover:bg-amber-700 h-11 sm:h-9" data-testid="button-add-employee">
                  <Plus className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {t("branchEmployees.addEmployee")}
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle>{editingEmployee ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}</DialogTitle>
                <DialogDescription>أدخل بيانات الموظف الأساسية والرواتب والمستندات</DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
                const errorMessages = Object.values(errors).map(e => e?.message).filter(Boolean);
                if (errorMessages.length > 0) {
                  toast({
                    title: "يرجى تعبئة الحقول المطلوبة",
                    description: errorMessages.join("، "),
                    variant: "destructive",
                  });
                }
              })} className="space-y-6">
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="basic">البيانات الأساسية</TabsTrigger>
                    <TabsTrigger value="salary">الراتب والبدلات</TabsTrigger>
                    <TabsTrigger value="documents">المستندات</TabsTrigger>
                    <TabsTrigger value="contact">التواصل والبنك</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>الفرع *</Label>
                        <Select value={watchedBranchId} onValueChange={(v) => form.setValue("branchId", v, { shouldValidate: true })}>
                          <SelectTrigger data-testid="select-branch" className={form.formState.errors.branchId ? "border-red-500" : ""}>
                            <SelectValue placeholder="اختر الفرع" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            {!branches ? (
                              <SelectItem value="" disabled>جاري التحميل...</SelectItem>
                            ) : branches.length > 0 ? (
                              branches.map((b: { id: string; name: string }) => (
                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                              ))
                            ) : (
                              <SelectItem value="" disabled>لا توجد فروع</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.branchId && (
                          <p className="text-sm text-red-500">{form.formState.errors.branchId.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>الحالة</Label>
                        <Select value={watchedStatus} onValueChange={(v) => form.setValue("status", v)}>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue placeholder="اختر الحالة" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            {(isRTL ? STATUS_OPTIONS_AR : STATUS_OPTIONS_EN).map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>اسم الموظف بالعربي *</Label>
                        <Input {...form.register("employeeName")} placeholder="أدخل الاسم بالعربي" data-testid="input-name-ar" />
                        {form.formState.errors.employeeName && (
                          <p className="text-sm text-red-500">{form.formState.errors.employeeName.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>اسم الموظف بالإنجليزي</Label>
                        <Input {...form.register("employeeNameEn")} placeholder="Enter name in English" dir="ltr" data-testid="input-name-en" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>الوظيفة *</Label>
                        <Select value={watchedJobTitle} onValueChange={(v) => form.setValue("jobTitle", v, { shouldValidate: true })}>
                          <SelectTrigger data-testid="select-job" className={form.formState.errors.jobTitle ? "border-red-500" : ""}>
                            <SelectValue placeholder="اختر الوظيفة" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            {isLoadingSettings ? (
                              <SelectItem value="" disabled>جاري التحميل...</SelectItem>
                            ) : (settingsByCategory.job_title?.filter(s => s.isActive) || []).length > 0 ? (
                              settingsByCategory.job_title?.filter(s => s.isActive).map((job) => (
                                <SelectItem key={job.id} value={job.labelAr}>{job.labelAr}</SelectItem>
                              ))
                            ) : (
                              <SelectItem value="" disabled>لا توجد وظائف - أضف من الإعدادات</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.jobTitle && (
                          <p className="text-sm text-red-500">{form.formState.errors.jobTitle.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>الجنسية *</Label>
                        <Select 
                          value={watchedNationality} 
                          onValueChange={(v) => {
                            form.setValue("nationality", v, { shouldValidate: true });
                            if (v !== "سعودي") {
                              form.setValue("socialInsuranceDeduction", 0);
                            }
                          }}
                        >
                          <SelectTrigger data-testid="select-nationality" className={form.formState.errors.nationality ? "border-red-500" : ""}>
                            <SelectValue placeholder="اختر الجنسية" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            {isLoadingSettings ? (
                              <SelectItem value="" disabled>جاري التحميل...</SelectItem>
                            ) : (settingsByCategory.nationality?.filter(s => s.isActive) || []).length > 0 ? (
                              settingsByCategory.nationality?.filter(s => s.isActive).map((nat) => (
                                <SelectItem key={nat.id} value={nat.labelAr}>{nat.labelAr}</SelectItem>
                              ))
                            ) : (
                              <SelectItem value="" disabled>لا توجد جنسيات - أضف من الإعدادات</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.nationality && (
                          <p className="text-sm text-red-500">{form.formState.errors.nationality.message}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>القسم</Label>
                        <Select value={watchedDepartment || ""} onValueChange={(v) => form.setValue("department", v)}>
                          <SelectTrigger data-testid="select-department">
                            <SelectValue placeholder="اختر القسم" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            {isLoadingSettings ? (
                              <SelectItem value="" disabled>جاري التحميل...</SelectItem>
                            ) : (settingsByCategory.department?.filter(s => s.isActive) || []).length > 0 ? (
                              settingsByCategory.department?.filter(s => s.isActive).map((dept) => (
                                <SelectItem key={dept.id} value={dept.labelAr}>{dept.labelAr}</SelectItem>
                              ))
                            ) : (
                              <SelectItem value="" disabled>لا توجد أقسام - أضف من الإعدادات</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>تاريخ التعيين</Label>
                        <Input type="date" {...form.register("hireDate")} data-testid="input-hire-date" />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="salary" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>الراتب الأساسي (ريال) *</Label>
                        <Input type="number" {...form.register("salary")} placeholder="0" data-testid="input-salary" />
                      </div>
                      <div className="space-y-2">
                        <Label>بدل السكن (ريال)</Label>
                        <Input type="number" {...form.register("housingAllowance")} placeholder="0" data-testid="input-housing" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>بدل المواصلات (ريال)</Label>
                        <Input type="number" {...form.register("transportAllowance")} placeholder="0" data-testid="input-transport" />
                      </div>
                      <div className="space-y-2">
                        <Label>بدل الطعام (ريال)</Label>
                        <Input type="number" {...form.register("foodAllowance")} placeholder="0" data-testid="input-food" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>بدلات أخرى (ريال)</Label>
                      <Input type="number" {...form.register("otherAllowances")} placeholder="0" data-testid="input-other" />
                    </div>
                    
                    {watchedNationality === "سعودي" && (
                      <div className="space-y-2">
                        <Label className="text-red-600">خصم التأمينات الاجتماعية (ريال) - للسعوديين</Label>
                        <Input 
                          type="number" 
                          {...form.register("socialInsuranceDeduction")} 
                          placeholder="0" 
                          className="border-red-200 focus:border-red-400"
                          data-testid="input-social-insurance" 
                        />
                        <p className="text-xs text-gray-500">يتم خصم هذا المبلغ من إجمالي الراتب</p>
                      </div>
                    )}
                    
                    <Card className="bg-amber-50">
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex justify-between items-center text-sm text-gray-600">
                          <span>مجموع الراتب والبدلات:</span>
                          <span>
                            {formatCurrency(
                              Number(watchedSalary || 0) +
                              Number(watchedHousingAllowance || 0) +
                              Number(watchedTransportAllowance || 0) +
                              Number(watchedFoodAllowance || 0) +
                              Number(watchedOtherAllowances || 0)
                            )}
                          </span>
                        </div>
                        {watchedNationality === "سعودي" && Number(watchedSocialInsurance || 0) > 0 && (
                          <div className="flex justify-between items-center text-sm text-red-600">
                            <span>خصم التأمينات الاجتماعية:</span>
                            <span>- {formatCurrency(Number(watchedSocialInsurance || 0))}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center border-t pt-2">
                          <span className="font-bold">صافي الراتب:</span>
                          <span className="text-xl font-bold text-amber-700">
                            {formatCurrency(
                              Number(watchedSalary || 0) +
                              Number(watchedHousingAllowance || 0) +
                              Number(watchedTransportAllowance || 0) +
                              Number(watchedFoodAllowance || 0) +
                              Number(watchedOtherAllowances || 0) -
                              (watchedNationality === "سعودي" ? Number(watchedSocialInsurance || 0) : 0)
                            )}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="documents" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>حالة الشهادة الصحية</Label>
                        <Select value={watchedHealthCertificate} onValueChange={(v) => form.setValue("healthCertificate", v)}>
                          <SelectTrigger data-testid="select-health-cert">
                            <SelectValue placeholder="اختر الحالة" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            {(isRTL ? HEALTH_CERT_OPTIONS_AR : HEALTH_CERT_OPTIONS_EN).map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>تاريخ انتهاء الشهادة الصحية</Label>
                        <Input type="date" {...form.register("healthCertificateExpiry")} data-testid="input-health-expiry" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>رقم الإقامة</Label>
                        <Input {...form.register("iqamaNumber")} placeholder="أدخل رقم الإقامة" dir="ltr" data-testid="input-iqama" />
                      </div>
                      <div className="space-y-2">
                        <Label>تاريخ انتهاء الإقامة</Label>
                        <Input type="date" {...form.register("iqamaExpiry")} data-testid="input-iqama-expiry" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>رقم الجواز</Label>
                        <Input {...form.register("passportNumber")} placeholder="أدخل رقم الجواز" dir="ltr" data-testid="input-passport" />
                      </div>
                      <div className="space-y-2">
                        <Label>تاريخ انتهاء الجواز</Label>
                        <Input type="date" {...form.register("passportExpiry")} data-testid="input-passport-expiry" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>رقم رخصة العمل</Label>
                      <Input {...form.register("workPermitNumber")} placeholder="أدخل رقم رخصة العمل" dir="ltr" data-testid="input-work-permit" />
                    </div>
                  </TabsContent>

                  <TabsContent value="contact" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>رقم الجوال</Label>
                        <Input {...form.register("phoneNumber")} placeholder="05xxxxxxxx" dir="ltr" data-testid="input-phone" />
                      </div>
                      <div className="space-y-2">
                        <Label>رقم الطوارئ</Label>
                        <Input {...form.register("emergencyContact")} placeholder="رقم للتواصل في الطوارئ" dir="ltr" data-testid="input-emergency" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>اسم البنك</Label>
                        <Select value={watchedBankName || ""} onValueChange={(v) => form.setValue("bankName", v)}>
                          <SelectTrigger data-testid="select-bank">
                            <SelectValue placeholder="اختر البنك" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            {isLoadingSettings ? (
                              <SelectItem value="" disabled>جاري التحميل...</SelectItem>
                            ) : (settingsByCategory.bank?.filter(s => s.isActive) || []).length > 0 ? (
                              settingsByCategory.bank?.filter(s => s.isActive).map((bank) => (
                                <SelectItem key={bank.id} value={bank.labelAr}>{bank.labelAr}</SelectItem>
                              ))
                            ) : (
                              <SelectItem value="" disabled>لا توجد بنوك - أضف من الإعدادات</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>رقم الحساب البنكي (IBAN)</Label>
                        <Input {...form.register("bankAccountNumber")} placeholder="SAxxxxxxxxxxxxxxxxxx" dir="ltr" data-testid="input-iban" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>نوع العقد</Label>
                        <Select value={watchedContractType || ""} onValueChange={(v) => form.setValue("contractType", v)}>
                          <SelectTrigger data-testid="select-contract-type">
                            <SelectValue placeholder="اختر نوع العقد" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            {isLoadingSettings ? (
                              <SelectItem value="" disabled>جاري التحميل...</SelectItem>
                            ) : (settingsByCategory.contract_type?.filter(s => s.isActive) || []).length > 0 ? (
                              settingsByCategory.contract_type?.filter(s => s.isActive).map((ct) => (
                                <SelectItem key={ct.id} value={ct.labelAr}>{ct.labelAr}</SelectItem>
                              ))
                            ) : (
                              <SelectItem value="" disabled>لا توجد أنواع عقود - أضف من الإعدادات</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>ملاحظات</Label>
                        <Input {...form.register("notes")} placeholder="ملاحظات إضافية" data-testid="input-notes" />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                  <Button type="submit" className="bg-amber-600 hover:bg-amber-700" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit">
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                    {editingEmployee ? "تحديث" : "إضافة"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
            </>
          }
        />

        {/* Main Tabs */}
        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full max-w-[450px]">
            <TabsTrigger value="employees" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t("branchEmployees.tabs.employees")}
            </TabsTrigger>
            <TabsTrigger value="transfers" className="flex items-center gap-2" data-testid="tab-transfers">
              <Network className="w-4 h-4" />
              {t("branchEmployees.tabs.transfers")}
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {t("branchEmployees.tabs.settings")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="employees" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
        <div className="kpi-grid">
          {[
            { label: isRTL ? "إجمالي الموظفين" : "Total Employees", value: formatNumber(stats?.totalEmployees || 0), Icon: Users, iconBg: "bg-violet-100", iconColor: "text-violet-700", border: "border-violet-200", testid: "text-total-employees" },
            { label: isRTL ? "إجمالي الرواتب" : "Total Salaries", value: stats ? formatCurrency(stats?.totalSalaries, isRTL) : "—", Icon: DollarSign, iconBg: "bg-emerald-100", iconColor: "text-emerald-700", border: "border-emerald-200", testid: "text-total-salaries" },
            { label: isRTL ? "عدد الجنسيات" : "Nationalities", value: formatNumber(stats?.byNationality?.length || 0), Icon: Globe, iconBg: "bg-fuchsia-100", iconColor: "text-fuchsia-700", border: "border-fuchsia-200", testid: "text-nationalities-count" },
            { label: isRTL ? "عدد الوظائف" : "Job Titles", value: formatNumber(stats?.byJobTitle?.length || 0), Icon: Briefcase, iconBg: "bg-indigo-100", iconColor: "text-indigo-700", border: "border-indigo-200", testid: "text-jobs-count" },
          ].map((kpi, i) => (
            <Card key={i} className={`border ${kpi.border} hover:shadow-md transition-shadow`}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-3 ${kpi.iconBg} rounded-xl`}>
                    <kpi.Icon className={`w-6 h-6 ${kpi.iconColor}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground truncate">{kpi.label}</p>
                    {isLoading ? (
                      <div className="h-7 w-20 skeleton-pro rounded mt-1" />
                    ) : (
                      <p className="text-2xl font-bold" data-testid={kpi.testid}>{kpi.value}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Status Tabs - فلتر الحالة (server-side) */}
        {(() => {
          const statusCounts: Record<string, number> = {};
          (stats?.byStatus || []).forEach((s: any) => { statusCounts[s.status] = s.count; });
          const totalAll = Object.values(statusCounts).reduce((a, b) => a + b, 0);
          const tabs: { value: string; labelAr: string; labelEn: string; count: number; cls: string }[] = [
            { value: "all", labelAr: "الكل", labelEn: "All", count: totalAll, cls: "bg-violet-100 text-violet-800 border-violet-300" },
            { value: "active", labelAr: "النشطون", labelEn: "Active", count: statusCounts["active"] || 0, cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
            { value: "on_leave", labelAr: "في إجازة", labelEn: "On Leave", count: statusCounts["on_leave"] || 0, cls: "bg-amber-100 text-amber-800 border-amber-300" },
            { value: "inactive", labelAr: "غير نشط", labelEn: "Inactive", count: statusCounts["inactive"] || 0, cls: "bg-slate-100 text-slate-800 border-slate-300" },
            { value: "terminated", labelAr: "منتهية خدمتهم", labelEn: "Terminated", count: statusCounts["terminated"] || 0, cls: "bg-red-100 text-red-800 border-red-300" },
          ];
          return (
            <div className="flex items-center gap-2 flex-wrap" data-testid="tabs-employee-status">
              {tabs.map((tab) => {
                const isActive = selectedStatus === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setSelectedStatus(tab.value)}
                    className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all inline-flex items-center gap-2 ${
                      isActive
                        ? `${tab.cls} shadow-sm`
                        : "bg-white text-muted-foreground border-border hover:bg-muted/50"
                    }`}
                    data-testid={`tab-status-${tab.value}`}
                  >
                    <span>{isRTL ? tab.labelAr : tab.labelEn}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      isActive ? "bg-white/70" : "bg-muted"
                    }`}>
                      {formatNumber(tab.count)}
                    </span>
                  </button>
                );
              })}
              {selectedStatus === "terminated" && (
                <div className="flex-1 text-end">
                  <a
                    href="/terminated-employees"
                    className="text-sm text-amber-700 underline hover:text-amber-900"
                    data-testid="link-terminated-page"
                  >
                    {isRTL ? "فتح صفحة الموظفين المنتهية خدمتهم ←" : "Open Terminated Employees page →"}
                  </a>
                </div>
              )}
            </div>
          );
        })()}

        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-gray-500 hidden sm:block" />
            <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={!canSelectBranch}>
              <SelectTrigger className="w-40 sm:w-48 h-11 sm:h-10" data-testid="filter-branch">
                <SelectValue placeholder={t("branchEmployees.allBranches")} />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {canSelectBranch && <SelectItem value="all">{t("branchEmployees.allBranches")}</SelectItem>}
                {branches?.map((b: { id: string; name: string }) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-gray-500 hidden sm:block" />
            <Select value={selectedNationality} onValueChange={setSelectedNationality}>
              <SelectTrigger className="w-36 sm:w-40 h-11 sm:h-10" data-testid="filter-nationality">
                <SelectValue placeholder={isRTL ? "جميع الجنسيات" : "All Nationalities"} />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <SelectItem value="all">{isRTL ? "جميع الجنسيات" : "All Nationalities"}</SelectItem>
                {settingsByCategory.nationality?.filter(s => s.isActive).map((nat) => (
                  <SelectItem key={nat.id} value={nat.labelAr}>{nat.labelAr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-gray-500 hidden sm:block" />
            <Select value={selectedJobTitle} onValueChange={setSelectedJobTitle}>
              <SelectTrigger className="w-36 sm:w-40 h-11 sm:h-10" data-testid="filter-job">
                <SelectValue placeholder="جميع الوظائف" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <SelectItem value="all">جميع الوظائف</SelectItem>
                {settingsByCategory.job_title?.filter(s => s.isActive).map((job) => (
                  <SelectItem key={job.id} value={job.labelAr}>{job.labelAr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none`} />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRTL ? "بحث بالاسم أو الرقم الوظيفي..." : "Search by name or employee ID..."}
              className={`${isRTL ? 'pr-10' : 'pl-10'} h-11 sm:h-10`}
              data-testid="input-search"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 h-11 sm:h-9" data-testid="btn-advanced-filters">
                <Filter className="w-4 h-4" />
                فلترة متقدمة
                {(salaryMin !== undefined || salaryMax !== undefined || hireDateFrom || hireDateTo) && (
                  <Badge variant="secondary" className="mr-1">{[salaryMin !== undefined, salaryMax !== undefined, hireDateFrom, hireDateTo].filter(Boolean).length}</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-4">
                <h4 className="font-medium">فلترة متقدمة</h4>
                <div className="space-y-2">
                  <Label>نطاق الراتب</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="من"
                      value={salaryMin ?? ""}
                      onChange={(e) => setSalaryMin(e.target.value ? Number(e.target.value) : undefined)}
                      data-testid="input-salary-min"
                    />
                    <Input
                      type="number"
                      placeholder="إلى"
                      value={salaryMax ?? ""}
                      onChange={(e) => setSalaryMax(e.target.value ? Number(e.target.value) : undefined)}
                      data-testid="input-salary-max"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>تاريخ التوظيف</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      placeholder="من"
                      value={hireDateFrom}
                      onChange={(e) => setHireDateFrom(e.target.value)}
                      data-testid="input-hire-from"
                    />
                    <Input
                      type="date"
                      placeholder="إلى"
                      value={hireDateTo}
                      onChange={(e) => setHireDateTo(e.target.value)}
                      data-testid="input-hire-to"
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setSalaryMin(undefined);
                    setSalaryMax(undefined);
                    setHireDateFrom("");
                    setHireDateTo("");
                  }}
                  data-testid="btn-clear-advanced"
                >
                  {isRTL ? "مسح الفلاتر المتقدمة" : "Clear Advanced Filters"}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          {hasActiveFilters && (
            <Button variant="ghost" onClick={resetFilters} className="text-red-600 h-11 sm:h-9" data-testid="btn-reset-all-filters">
              <X className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
              {isRTL ? "مسح جميع الفلاتر" : "Clear All Filters"}
            </Button>
          )}
        </div>

        <div ref={printRef}>
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? "قائمة الموظفين" : "Employee List"}</CardTitle>
            <CardDescription data-testid="text-employees-count">
              {isRTL
                ? `عرض ${formatNumber(filteredEmployees.length)}${(employees && filteredEmployees.length !== employees.length) ? ` من أصل ${formatNumber(employees.length)}` : ''} موظف`
                : `Showing ${formatNumber(filteredEmployees.length)}${(employees && filteredEmployees.length !== employees.length) ? ` of ${formatNumber(employees.length)}` : ''} employees`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bundleError ? (
              <div className="text-center py-10 text-red-600">
                <AlertCircle className="w-12 h-12 mx-auto mb-3" />
                <p className="font-medium">{isRTL ? "تعذّر تحميل بيانات الموظفين" : "Failed to load employees"}</p>
                <p className="text-sm text-muted-foreground mt-1">{(bundleError as Error)?.message}</p>
              </div>
            ) : isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 skeleton-pro rounded" />
                ))}
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="font-medium">{t("branchEmployees.noEmployees")}</p>
                {hasActiveFilters && (
                  <Button variant="link" onClick={resetFilters} className="mt-2 text-violet-600" data-testid="btn-clear-from-empty">
                    {isRTL ? "مسح الفلاتر وعرض الكل" : "Clear filters and show all"}
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className={`${isRTL ? "text-right" : "text-left"} hidden md:table-cell whitespace-nowrap`}>{isRTL ? "الرقم الوظيفي" : "Employee ID"}</TableHead>
                    <TableHead className={`${isRTL ? "text-right" : "text-left"} whitespace-nowrap`}>{isRTL ? "الاسم" : "Name"}</TableHead>
                    <TableHead className={`${isRTL ? "text-right" : "text-left"} whitespace-nowrap`}>{isRTL ? "الفرع" : "Branch"}</TableHead>
                    <TableHead className={`${isRTL ? "text-right" : "text-left"} hidden md:table-cell whitespace-nowrap`}>{t("branchEmployees.jobTitle")}</TableHead>
                    <TableHead className={`${isRTL ? "text-right" : "text-left"} hidden md:table-cell whitespace-nowrap`}>{t("branchEmployees.nationality")}</TableHead>
                    <TableHead className={`${isRTL ? "text-right" : "text-left"} hidden lg:table-cell whitespace-nowrap`}>{t("branchEmployees.totalPackage")}</TableHead>
                    <TableHead className={`${isRTL ? "text-right" : "text-left"} hidden lg:table-cell whitespace-nowrap`}>{isRTL ? "الشهادة الصحية" : "Health Cert."}</TableHead>
                    <TableHead className={`${isRTL ? "text-right" : "text-left"} whitespace-nowrap`}>{t("branchEmployees.status")}</TableHead>
                    <TableHead className={`${isRTL ? "text-right" : "text-left"} whitespace-nowrap`}>{t("branchEmployees.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEmployees.map((emp: BranchEmployee) => (
                    <TableRow key={emp.id} data-testid={`row-employee-${emp.id}`}>
                      <TableCell className={`font-mono text-xs sm:text-sm text-amber-700 hidden md:table-cell ${isRTL ? "text-right" : "text-left"}`}>{emp.employeeNumber || "--"}</TableCell>
                      <TableCell className={isRTL ? "text-right" : "text-left"}>
                        <div>
                          <p className="font-medium text-xs sm:text-sm">{emp.employeeName}</p>
                          {emp.employeeNameEn && <p className="text-xs text-gray-500 hidden sm:block" dir="ltr">{emp.employeeNameEn}</p>}
                        </div>
                      </TableCell>
                      <TableCell className={`text-xs sm:text-sm ${isRTL ? "text-right" : "text-left"}`}>{getBranchName(emp.branchId)}</TableCell>
                      <TableCell className={`text-xs sm:text-sm hidden md:table-cell ${isRTL ? "text-right" : "text-left"}`}>{emp.jobTitle}</TableCell>
                      <TableCell className={`text-xs sm:text-sm hidden md:table-cell ${isRTL ? "text-right" : "text-left"}`}>{emp.nationality}</TableCell>
                      <TableCell className={`font-medium text-xs sm:text-sm hidden lg:table-cell ${isRTL ? "text-right" : "text-left"}`}>{formatCurrency(emp.totalSalary || emp.salary, isRTL)}</TableCell>
                      <TableCell className={`hidden lg:table-cell ${isRTL ? "text-right" : "text-left"}`}>{getHealthBadge(emp.healthCertificate || "none", isRTL)}</TableCell>
                      <TableCell className={isRTL ? "text-right" : "text-left"}>{getStatusBadge(emp.status, isRTL)}</TableCell>
                      <TableCell className={isRTL ? "text-right" : "text-left"}>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" onClick={() => handleViewDetails(emp)} data-testid={`button-view-${emp.id}`} title={t("branchEmployees.view")}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" onClick={() => handleEdit(emp)} data-testid={`button-edit-${emp.id}`} title={t("branchEmployees.edit")}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          {user?.role === "admin" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:text-red-700 h-11 w-11 sm:h-8 sm:w-8"
                              onClick={() => handleDeleteClick(emp)}
                              data-testid={`button-delete-${emp.id}`}
                              title={t("branchEmployees.delete")}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-500">
                  {isRTL 
                    ? `عرض ${formatNumber(startIndex + 1)} - ${formatNumber(Math.min(startIndex + pageSize, filteredEmployees.length))} من ${formatNumber(filteredEmployees.length)}`
                    : `Showing ${formatNumber(startIndex + 1)} - ${formatNumber(Math.min(startIndex + pageSize, filteredEmployees.length))} of ${formatNumber(filteredEmployees.length)}`
                  }
                </div>
                <div className="flex items-center gap-2">
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                    <SelectTrigger className="w-24 h-11 sm:h-10" data-testid="select-page-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 sm:h-8 sm:w-8"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    data-testid="btn-prev-page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <span className="text-sm">{isRTL ? `صفحة ${formatNumber(currentPage)} من ${formatNumber(totalPages)}` : `Page ${formatNumber(currentPage)} of ${formatNumber(totalPages)}`}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 sm:h-8 sm:w-8"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    data-testid="btn-next-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        {stats && (stats.byNationality?.length > 0 || stats.byJobTitle?.length > 0) && (() => {
          const totalEmp = stats.totalEmployees || 0;
          const sortedNat = [...(stats.byNationality || [])].sort((a: any, b: any) => b.count - a.count);
          const sortedJob = [...(stats.byJobTitle || [])].sort((a: any, b: any) => b.count - a.count);
          const maxNat = sortedNat[0]?.count || 1;
          const maxJob = sortedJob[0]?.count || 1;
          const renderRow = (label: string, count: number, max: number, gradient: string, idx: number) => {
            const pct = totalEmp ? Math.round((count / totalEmp) * 100) : 0;
            const barPct = max ? (count / max) * 100 : 0;
            return (
              <div key={`${label}-${idx}`} className="group relative px-3 py-2.5 rounded-xl hover:bg-violet-50/50 transition-colors">
                <div className={`absolute inset-y-0 ${isRTL ? 'right-0' : 'left-0'} rounded-xl opacity-[0.08] ${gradient}`} style={{ width: `${barPct}%` }} />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{label}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold tabular-nums min-w-[2rem] text-center">{formatNumber(count)}</span>
                  </div>
                </div>
              </div>
            );
          };
          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Card className="border-violet-200/60 overflow-hidden">
                <CardHeader className="pb-3 bg-gradient-to-l from-violet-50/80 to-transparent">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <div className="p-1.5 bg-violet-100 rounded-lg">
                        <Globe className="w-4 h-4 text-violet-700" />
                      </div>
                      {isRTL ? "توزيع الجنسيات" : "Nationality Distribution"}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {formatNumber(sortedNat.length)} {isRTL ? "جنسية" : "items"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="space-y-0.5 max-h-[360px] overflow-y-auto pr-1">
                    {sortedNat.map((item: { nationality: string; count: number }, i: number) =>
                      renderRow(item.nationality, item.count, maxNat, "bg-gradient-to-l from-violet-500 to-fuchsia-500", i)
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-fuchsia-200/60 overflow-hidden">
                <CardHeader className="pb-3 bg-gradient-to-l from-fuchsia-50/80 to-transparent">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <div className="p-1.5 bg-fuchsia-100 rounded-lg">
                        <Briefcase className="w-4 h-4 text-fuchsia-700" />
                      </div>
                      {isRTL ? "توزيع الوظائف" : "Job Title Distribution"}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {formatNumber(sortedJob.length)} {isRTL ? "وظيفة" : "items"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="space-y-0.5 max-h-[360px] overflow-y-auto pr-1">
                    {sortedJob.map((item: { jobTitle: string; count: number }, i: number) =>
                      renderRow(item.jobTitle, item.count, maxJob, "bg-gradient-to-l from-fuchsia-500 to-violet-500", i)
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })()}
          </TabsContent>

          {/* Transfers Tab */}
          <TabsContent value="transfers" className="space-y-6 mt-6">
            <EmployeeTransfersTab 
              employees={employees || []} 
              branches={branches || []} 
            />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  {isRTL ? "إعدادات بيانات الموظفين" : "Employee Data Settings"}
                </CardTitle>
                <CardDescription>{isRTL ? "إدارة القوائم المنسدلة وخيارات البيانات التي تظهر في نماذج الموظفين" : "Manage dropdown lists and data options displayed in employee forms"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* Categories sidebar */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-gray-500 mb-3">{isRTL ? "الفئات" : "Categories"}</h4>
                    {SETTING_CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <Button
                          key={cat.value}
                          variant={settingsCategory === cat.value ? "default" : "ghost"}
                          className={`w-full justify-start gap-2 ${settingsCategory === cat.value ? "bg-amber-600 hover:bg-amber-700" : ""}`}
                          onClick={() => setSettingsCategory(cat.value)}
                          data-testid={`btn-category-${cat.value}`}
                        >
                          <Icon className="w-4 h-4" />
                          {isRTL ? cat.labelAr : cat.labelEn}
                          <Badge variant="outline" className={isRTL ? "mr-auto" : "ml-auto"}>{settingsByCategory[cat.value]?.length || 0}</Badge>
                        </Button>
                      );
                    })}
                  </div>

                  {/* Settings list */}
                  <div className="md:col-span-3 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">
                        {isRTL ? SETTING_CATEGORIES.find(c => c.value === settingsCategory)?.labelAr : SETTING_CATEGORIES.find(c => c.value === settingsCategory)?.labelEn || settingsCategory}
                      </h4>
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={handleAddSetting} data-testid="btn-add-setting">
                        <Plus className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                        {isRTL ? "إضافة جديد" : "Add New"}
                      </Button>
                    </div>

                    {isLoadingSettings ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
                      </div>
                    ) : (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className={isRTL ? "text-right" : "text-left"}>#</TableHead>
                              <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "القيمة" : "Value"}</TableHead>
                              <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الاسم بالعربي" : "Arabic Name"}</TableHead>
                              <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الاسم بالإنجليزي" : "English Name"}</TableHead>
                              <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الحالة" : "Status"}</TableHead>
                              <TableHead className="text-center w-32">{isRTL ? "إجراءات" : "Actions"}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(settingsByCategory[settingsCategory] || []).map((setting, idx) => (
                              <TableRow key={setting.id} data-testid={`row-setting-${setting.id}`}>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell>{setting.value}</TableCell>
                                <TableCell>{setting.labelAr}</TableCell>
                                <TableCell>{setting.labelEn || "-"}</TableCell>
                                <TableCell>
                                  <Badge className={setting.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                                    {setting.isActive ? (isRTL ? "نشط" : "Active") : (isRTL ? "غير نشط" : "Inactive")}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-center gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleEditSetting(setting)} data-testid={`btn-edit-${setting.id}`}>
                                      <Edit className="w-4 h-4 text-blue-600" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => {
                                        if (confirm(isRTL ? `هل أنت متأكد من حذف "${setting.labelAr}"؟` : `Are you sure you want to delete "${setting.labelEn || setting.labelAr}"?`)) {
                                          deleteSettingMutation.mutate(setting.id);
                                        }
                                      }}
                                      data-testid={`btn-delete-${setting.id}`}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                            {(!settingsByCategory[settingsCategory] || settingsByCategory[settingsCategory].length === 0) && (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                                  {isRTL ? "لا توجد بيانات في هذه الفئة" : "No data in this category"}
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Add/Edit Setting Dialog */}
            <Dialog open={isSettingDialogOpen} onOpenChange={(open) => {
              setIsSettingDialogOpen(open);
              if (!open) {
                setEditingSetting(null);
                setNewSettingValue("");
                setNewSettingLabelAr("");
                setNewSettingLabelEn("");
              }
            }}>
              <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
                <DialogHeader>
                  <DialogTitle>{editingSetting ? (isRTL ? "تعديل الإعداد" : "Edit Setting") : (isRTL ? "إضافة إعداد جديد" : "Add New Setting")}</DialogTitle>
                  <DialogDescription>
                    {editingSetting 
                      ? (isRTL ? "تعديل القيمة الموجودة" : "Edit existing value") 
                      : (isRTL 
                          ? `إضافة قيمة جديدة إلى ${SETTING_CATEGORIES.find(c => c.value === settingsCategory)?.labelAr}` 
                          : `Add new value to ${SETTING_CATEGORIES.find(c => c.value === settingsCategory)?.labelEn}`)}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{isRTL ? "القيمة *" : "Value *"}</Label>
                    <Input 
                      value={newSettingValue}
                      onChange={(e) => setNewSettingValue(e.target.value)}
                      placeholder={isRTL ? "مثال: سعودي" : "Example: Saudi"}
                      data-testid="input-setting-value"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "الاسم بالعربي *" : "Arabic Name *"}</Label>
                    <Input 
                      value={newSettingLabelAr}
                      onChange={(e) => setNewSettingLabelAr(e.target.value)}
                      placeholder={isRTL ? "مثال: سعودي" : "Example: سعودي"}
                      data-testid="input-setting-label-ar"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "الاسم بالإنجليزي (اختياري)" : "English Name (optional)"}</Label>
                    <Input 
                      value={newSettingLabelEn}
                      onChange={(e) => setNewSettingLabelEn(e.target.value)}
                      placeholder={isRTL ? "مثال: Saudi" : "Example: Saudi"}
                      dir="ltr"
                      data-testid="input-setting-label-en"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsSettingDialogOpen(false)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
                  <Button 
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={handleSaveSetting}
                    disabled={!newSettingValue || !newSettingLabelAr || createSettingMutation.isPending || updateSettingMutation.isPending}
                    data-testid="btn-save-setting"
                  >
                    {(createSettingMutation.isPending || updateSettingMutation.isPending) && <Loader2 className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"} animate-spin`} />}
                    {editingSetting ? (isRTL ? "تحديث" : "Update") : (isRTL ? "إضافة" : "Add")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>

        {/* Employee Details Dialog */}
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {isRTL ? `تفاصيل الموظف: ${viewingEmployee?.employeeName}` : `Employee Details: ${viewingEmployee?.employeeName}`}
              </DialogTitle>
              <DialogDescription>
                {isRTL ? "عرض سجلات الحضور والجداول والدوام المرتبطة بالموظف" : "View attendance records, schedules, and timesheets for this employee"}
              </DialogDescription>
            </DialogHeader>
            
            {viewingEmployee && (
              <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="info">{isRTL ? "معلومات الموظف" : "Employee Info"}</TabsTrigger>
                  <TabsTrigger value="attendance">{isRTL ? "سجلات الحضور" : "Attendance"}</TabsTrigger>
                  <TabsTrigger value="schedules">{isRTL ? "جداول الدوام" : "Schedules"}</TabsTrigger>
                  <TabsTrigger value="timesheets">{isRTL ? "تقارير كشوف الدوام" : "Timesheets"}</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                  <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/30">
                    {(viewingEmployee as any).photoUrl ? (
                      <img
                        src={(viewingEmployee as any).photoUrl}
                        alt={viewingEmployee.employeeName}
                        className="h-20 w-20 rounded-full object-cover border-2 border-primary/20"
                        data-testid="img-employee-photo-admin"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
                        {(viewingEmployee.employeeName || "?").slice(0, 1)}
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="font-semibold">{viewingEmployee.employeeName}</div>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoSelected}
                        data-testid="input-employee-photo"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={uploadPhotoMutation.isPending}
                        data-testid="button-upload-photo"
                      >
                        {uploadPhotoMutation.isPending
                          ? (isRTL ? "جارٍ الرفع..." : "Uploading...")
                          : (viewingEmployee as any).photoUrl
                            ? (isRTL ? "تغيير الصورة" : "Change Photo")
                            : (isRTL ? "رفع صورة" : "Upload Photo")}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <UserCheck className="w-4 h-4" />
                          {isRTL ? "البيانات الأساسية" : "Basic Information"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">{isRTL ? "الاسم:" : "Name:"}</span><span>{viewingEmployee.employeeName}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">{isRTL ? "الفرع:" : "Branch:"}</span><span>{getBranchName(viewingEmployee.branchId)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">{isRTL ? "الوظيفة:" : "Job Title:"}</span><span>{viewingEmployee.jobTitle}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">{isRTL ? "الجنسية:" : "Nationality:"}</span><span>{viewingEmployee.nationality}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">{isRTL ? "الحالة:" : "Status:"}</span>{getStatusBadge(viewingEmployee.status, isRTL)}</div>
                        {(viewingEmployee as any).statusChangedAt && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">{isRTL ? "آخر تغيير للحالة:" : "Status Changed:"}</span>
                            <span>{new Date((viewingEmployee as any).statusChangedAt).toLocaleDateString(isRTL ? "ar-SA-u-nu-latn" : "en-US")}</span>
                          </div>
                        )}
                        {viewingEmployee.status === "terminated" && (viewingEmployee as any).terminatedAt && (
                          <>
                            <div className="flex justify-between text-red-700 border-t pt-2">
                              <span className="text-gray-500">{isRTL ? "تاريخ انتهاء الخدمة:" : "Termination Date:"}</span>
                              <span className="font-medium">{new Date((viewingEmployee as any).terminatedAt).toLocaleDateString(isRTL ? "ar-SA-u-nu-latn" : "en-US")}</span>
                            </div>
                            {(viewingEmployee as any).terminationReason && (
                              <div className="text-xs bg-red-50 border border-red-200 rounded p-2 text-red-700">
                                <span className="font-medium">{isRTL ? "السبب: " : "Reason: "}</span>
                                {(viewingEmployee as any).terminationReason}
                              </div>
                            )}
                          </>
                        )}
                        {viewingEmployee.linkedUserId && (
                          <div className="flex justify-between"><span className="text-gray-500">{isRTL ? "مرتبط بالنظام:" : "Linked to System:"}</span><Badge className="bg-blue-100 text-blue-800">{isRTL ? "نعم" : "Yes"}</Badge></div>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          {isRTL ? "بيانات الراتب" : "Salary Details"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">{isRTL ? "الراتب الأساسي:" : "Base Salary:"}</span><span>{formatCurrency(viewingEmployee.salary, isRTL)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">{isRTL ? "بدل السكن:" : "Housing:"}</span><span>{formatCurrency(viewingEmployee.housingAllowance, isRTL)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">{isRTL ? "بدل المواصلات:" : "Transport:"}</span><span>{formatCurrency(viewingEmployee.transportAllowance, isRTL)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">{isRTL ? "بدل الطعام:" : "Food:"}</span><span>{formatCurrency(viewingEmployee.foodAllowance, isRTL)}</span></div>
                        {viewingEmployee.nationality === "سعودي" && (viewingEmployee.socialInsuranceDeduction || 0) > 0 && (
                          <div className="flex justify-between text-red-600">
                            <span>{isRTL ? "خصم التأمينات الاجتماعية:" : "Social Insurance:"}</span>
                            <span>- {formatCurrency(viewingEmployee.socialInsuranceDeduction, isRTL)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold border-t pt-2"><span>{isRTL ? "صافي الراتب:" : "Net Salary:"}</span><span>{formatCurrency(viewingEmployee.totalSalary, isRTL)}</span></div>
                      </CardContent>
                    </Card>
                  </div>
                  {!viewingEmployee.linkedUserId && (user?.role === "admin" || user?.role === "hr_manager") && (
                    <Card className="bg-amber-50 border-amber-200">
                      <CardContent className="py-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-amber-800">
                            <Link className="w-4 h-4" />
                            <span className="text-sm">هذا الموظف غير مرتبط بحساب مستخدم. أنشئ له حساب دخول ليتابع بياناته من بوابة الموظف، أو اربطه بحساب موجود.</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={accountMode === "create" ? "default" : "outline"}
                              onClick={() => setAccountMode("create")}
                              data-testid="button-mode-create"
                            >
                              إنشاء حساب جديد
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={accountMode === "link" ? "default" : "outline"}
                              onClick={() => setAccountMode("link")}
                              data-testid="button-mode-link"
                            >
                              ربط بحساب موجود
                            </Button>
                          </div>

                          {accountMode === "create" ? (
                            <div className="space-y-2 bg-white rounded-md p-3 border">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">اسم المستخدم</Label>
                                  <Input
                                    value={newAccountUsername}
                                    onChange={(e) => setNewAccountUsername(e.target.value)}
                                    placeholder="مثال: amro.ali"
                                    autoComplete="off"
                                    data-testid="input-account-username"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">كلمة المرور</Label>
                                  <Input
                                    type="text"
                                    value={newAccountPassword}
                                    onChange={(e) => setNewAccountPassword(e.target.value)}
                                    placeholder="8 أحرف: كبيرة وصغيرة وأرقام"
                                    autoComplete="off"
                                    data-testid="input-account-password"
                                  />
                                </div>
                              </div>
                              <p className="text-[11px] text-gray-500">كلمة المرور: 8 أحرف على الأقل وتحتوي على حرف كبير وصغير ورقم.</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={generateAccountCredentials}
                                  data-testid="button-generate-account"
                                >
                                  <RefreshCw className="w-4 h-4 ms-1" />
                                  توليد تلقائي
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={!newAccountUsername || !newAccountPassword}
                                  onClick={copyAccountCredentials}
                                  data-testid="button-copy-account"
                                >
                                  <Copy className="w-4 h-4 ms-1" />
                                  نسخ البيانات
                                </Button>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  disabled={!newAccountUsername || !newAccountPassword || createAccountMutation.isPending}
                                  onClick={() => {
                                    if (viewingEmployee) {
                                      createAccountMutation.mutate({
                                        employeeId: viewingEmployee.id,
                                        username: newAccountUsername.trim(),
                                        password: newAccountPassword,
                                      });
                                    }
                                  }}
                                  data-testid="button-create-account"
                                >
                                  {createAccountMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "إنشاء الحساب وربطه"}
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  disabled={!newAccountUsername || !newAccountPassword || createAccountMutation.isPending || !viewingEmployee?.phoneNumber}
                                  onClick={() => {
                                    if (viewingEmployee) {
                                      createAccountMutation.mutate({
                                        employeeId: viewingEmployee.id,
                                        username: newAccountUsername.trim(),
                                        password: newAccountPassword,
                                        sendWhatsapp: true,
                                      });
                                    }
                                  }}
                                  data-testid="button-create-account-whatsapp"
                                >
                                  <MessageCircle className="w-4 h-4 ms-1" />
                                  {createAccountMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "إنشاء وإرسال على الواتساب"}
                                </Button>
                              </div>
                              {!viewingEmployee?.phoneNumber && (
                                <p className="text-[11px] text-amber-600">لإرسال البيانات على الواتساب، أضِف رقم جوال للموظف في بياناته الأساسية.</p>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <Select value={selectedUserToLink} onValueChange={setSelectedUserToLink}>
                                <SelectTrigger className="w-64 bg-white">
                                  <SelectValue placeholder="اختر مستخدم للربط" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60 overflow-y-auto">
                                  {systemUsers?.map((user: any) => (
                                    <SelectItem key={user.id} value={user.id}>
                                      {user.displayName || user.username || user.id}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                disabled={!selectedUserToLink || linkUserMutation.isPending}
                                onClick={() => {
                                  if (viewingEmployee && selectedUserToLink) {
                                    linkUserMutation.mutate({ employeeId: viewingEmployee.id, userId: selectedUserToLink });
                                  }
                                }}
                                data-testid="button-link-user"
                              >
                                {linkUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "ربط المستخدم"}
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {viewingEmployee.linkedUserId && (
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="py-4 space-y-3">
                        <div className="flex items-center gap-2 text-green-800">
                          <UserCheck className="w-4 h-4" />
                          <span className="text-sm">هذا الموظف مرتبط بحساب مستخدم في النظام. يمكنه الدخول إلى بوابة الموظف ومتابعة بياناته.</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setShowResetPassword((v) => !v)}
                            data-testid="button-toggle-reset-password"
                          >
                            إعادة تعيين كلمة المرور
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            disabled={unlinkUserMutation.isPending}
                            onClick={() => {
                              if (viewingEmployee && window.confirm("سيتم فك ارتباط الموظف بحسابه (لن يُحذف الحساب). متابعة؟")) {
                                unlinkUserMutation.mutate(viewingEmployee.id);
                              }
                            }}
                            data-testid="button-unlink-user"
                          >
                            {unlinkUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "فك الارتباط"}
                          </Button>
                        </div>
                        {showResetPassword && (
                          <div className="flex items-end gap-2 bg-white rounded-md p-3 border">
                            <div className="flex-1">
                              <Label className="text-xs">كلمة المرور الجديدة</Label>
                              <Input
                                type="text"
                                value={resetPasswordValue}
                                onChange={(e) => setResetPasswordValue(e.target.value)}
                                placeholder="8 أحرف: كبيرة وصغيرة وأرقام"
                                autoComplete="off"
                                data-testid="input-reset-password"
                              />
                            </div>
                            <Button
                              size="sm"
                              disabled={!resetPasswordValue || resetPasswordMutation.isPending}
                              onClick={() => {
                                if (viewingEmployee) {
                                  resetPasswordMutation.mutate({ employeeId: viewingEmployee.id, password: resetPasswordValue });
                                }
                              }}
                              data-testid="button-save-reset-password"
                            >
                              {resetPasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}
                            </Button>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              disabled={!resetPasswordValue || resetPasswordMutation.isPending || !viewingEmployee?.phoneNumber}
                              onClick={() => {
                                if (viewingEmployee) {
                                  resetPasswordMutation.mutate({ employeeId: viewingEmployee.id, password: resetPasswordValue, sendWhatsapp: true });
                                }
                              }}
                              data-testid="button-save-reset-password-whatsapp"
                            >
                              <MessageCircle className="w-4 h-4 ms-1" />
                              {resetPasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ وإرسال واتساب"}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Status history timeline */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {isRTL ? "سجل تغييرات الحالة" : "Status Change History"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingStatusHistory ? (
                        <div className="text-center py-4 text-gray-400 text-sm"><Loader2 className="w-4 h-4 inline animate-spin" /></div>
                      ) : !employeeStatusHistory || employeeStatusHistory.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-2">{isRTL ? "لا يوجد سجل تغييرات" : "No status changes recorded"}</p>
                      ) : (
                        <ol className="relative border-r-2 border-amber-200 pr-4 space-y-3">
                          {employeeStatusHistory.map((h: any) => (
                            <li key={h.id} className="relative" data-testid={`history-row-${h.id}`}>
                              <span className="absolute -right-[1.4rem] top-1 w-3 h-3 rounded-full bg-amber-500 border-2 border-white"></span>
                              <div className="flex items-center gap-2 flex-wrap text-sm">
                                {h.oldStatus ? getStatusBadge(h.oldStatus, isRTL) : <Badge variant="outline">{isRTL ? "إنشاء" : "Created"}</Badge>}
                                <span className="text-gray-400">←</span>
                                {getStatusBadge(h.newStatus, isRTL)}
                                <span className="text-xs text-gray-500 ms-auto">
                                  {new Date(h.changedAt).toLocaleString(isRTL ? "ar-SA-u-nu-latn" : "en-US")}
                                </span>
                              </div>
                              {h.reason && (
                                <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded px-2 py-1">{h.reason}</p>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="attendance" className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" />
                        سجلات الحضور ({formatNumber(employeeAttendance?.length || 0)})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingAttendance ? (
                        <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin" /></div>
                      ) : employeeAttendance?.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right">التاريخ</TableHead>
                              <TableHead className="text-right">الحضور</TableHead>
                              <TableHead className="text-right">الانصراف</TableHead>
                              <TableHead className="text-right">الحالة</TableHead>
                              <TableHead className="text-right">ساعات العمل</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {employeeAttendance.slice(0, 10).map((att: any) => (
                              <TableRow key={att.id}>
                                <TableCell>{att.attendanceDate}</TableCell>
                                <TableCell>{att.actualCheckIn || "--"}</TableCell>
                                <TableCell>{att.actualCheckOut || "--"}</TableCell>
                                <TableCell>{getStatusBadge(att.status)}</TableCell>
                                <TableCell>{att.workingHours ? `${att.workingHours} ساعة` : "--"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-center text-gray-500 py-4">لا توجد سجلات حضور مرتبطة بهذا الموظف</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="schedules" className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        جداول الدوام ({formatNumber(employeeSchedules?.length || 0)})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingSchedules ? (
                        <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin" /></div>
                      ) : employeeSchedules?.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right">التاريخ</TableHead>
                              <TableHead className="text-right">اليوم</TableHead>
                              <TableHead className="text-right">الفترة</TableHead>
                              <TableHead className="text-right">من</TableHead>
                              <TableHead className="text-right">إلى</TableHead>
                              <TableHead className="text-right">الحالة</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {employeeSchedules.slice(0, 10).map((sch: any) => (
                              <TableRow key={sch.id}>
                                <TableCell>{sch.scheduleDate}</TableCell>
                                <TableCell>{sch.dayOfWeek}</TableCell>
                                <TableCell>{sch.shiftType || "--"}</TableCell>
                                <TableCell>{sch.startTime || "--"}</TableCell>
                                <TableCell>{sch.endTime || "--"}</TableCell>
                                <TableCell>{sch.isOff ? <Badge className="bg-gray-100 text-gray-800">إجازة</Badge> : getStatusBadge(sch.status)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-center text-gray-500 py-4">لا توجد جداول دوام مرتبطة بهذا الموظف</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="timesheets" className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        تقارير كشوف الدوام ({formatNumber(employeeTimesheets?.length || 0)})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingTimesheets ? (
                        <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin" /></div>
                      ) : employeeTimesheets?.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right">الفترة</TableHead>
                              <TableHead className="text-right">أيام الحضور</TableHead>
                              <TableHead className="text-right">أيام الغياب</TableHead>
                              <TableHead className="text-right">الساعات</TableHead>
                              <TableHead className="text-right">الحالة</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {employeeTimesheets.map((ts: any) => (
                              <TableRow key={ts.id}>
                                <TableCell>{ts.startDate} - {ts.endDate}</TableCell>
                                <TableCell>{formatNumber(ts.totalPresentDays)}</TableCell>
                                <TableCell>{formatNumber(ts.totalAbsentDays)}</TableCell>
                                <TableCell>{ts.totalActualHours ? `${ts.totalActualHours} ساعة` : "--"}</TableCell>
                                <TableCell>
                                  <Badge className={
                                    ts.status === 'finalized' ? 'bg-green-100 text-green-800' :
                                    ts.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-blue-100 text-blue-800'
                                  }>
                                    {ts.status === 'finalized' ? 'مكتمل' : 
                                     ts.status === 'pending' ? 'قيد الإنشاء' : 
                                     ts.status === 'pending_employee_signature' ? 'بانتظار توقيع الموظف' :
                                     ts.status === 'pending_manager_signature' ? 'بانتظار توقيع المدير' : ts.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-center text-gray-500 py-4">لا توجد تقارير دوام مرتبطة بهذا الموظف</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={isImportDialogOpen} onOpenChange={(open) => {
          setIsImportDialogOpen(open);
          if (!open) {
            setImportFile(null);
            setImportPreview([]);
            setImportBranchId("");
          }
        }}>
          <DialogContent className="max-w-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                استيراد موظفين من Excel
              </DialogTitle>
              <DialogDescription>
                قم برفع ملف Excel يحتوي على بيانات الموظفين. يجب أن تكون الأعمدة: الاسم، الوظيفة، الجنسية، الراتب، بدل السكن، بدل المواصلات
              </DialogDescription>
            </DialogHeader>
            
            {importPreview.length > 0 && (
              <div className="space-y-4">
                {/* اختيار الفرع */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">اختر الفرع لإضافة الموظفين إليه *</Label>
                  <Select value={importBranchId} onValueChange={setImportBranchId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="اختر الفرع..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      {branches?.map((branch: { id: string; name: string }) => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-sm font-medium">معاينة البيانات ({importPreview.length} موظف):</div>
                <div className="max-h-80 overflow-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Object.keys(importPreview[0] || {}).slice(0, 5).map((key) => (
                          <TableHead key={key} className="text-right text-xs">{key}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreview.map((row, idx) => (
                        <TableRow key={idx}>
                          {Object.values(row).slice(0, 5).map((val, vIdx) => (
                            <TableCell key={vIdx} className="text-xs">{String(val)}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {importBranchId && (
                  <div className="text-sm text-green-700 bg-green-50 p-3 rounded">
                    <strong>الفرع المحدد:</strong> {getBranchName(importBranchId)} - سيتم إضافة {importPreview.length} موظف لهذا الفرع
                  </div>
                )}
                {!importBranchId && (
                  <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded">
                    <strong>تنبيه:</strong> يرجى اختيار الفرع أولاً قبل الاستيراد
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button 
                    onClick={handleImport} 
                    disabled={isImporting || !importBranchId}
                    className="bg-amber-600 hover:bg-amber-700"
                    data-testid="button-confirm-import"
                  >
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                    {isImporting ? "جاري الاستيراد..." : "استيراد الموظفين"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              تأكيد حذف الموظف
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              {employeeToDelete && (
                <>
                  هل أنت متأكد من حذف الموظف <strong>{employeeToDelete.employeeName}</strong>؟
                  <br />
                  <span className="text-red-500">هذا الإجراء لا يمكن التراجع عنه وسيتم حذف جميع بيانات الموظف نهائياً.</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel data-testid="btn-cancel-delete">إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="btn-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              حذف نهائياً
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </Layout>
  );
}
