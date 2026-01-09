import { Layout } from "@/components/layout";
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
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useReactToPrint } from "react-to-print";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
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
  ChevronRight,
  X,
} from "lucide-react";
import type { BranchEmployee, EmployeeSetting, EmployeeTransferRequest, Branch } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, ArrowRight, History } from "lucide-react";

// تمت إزالة JOB_TITLES و NATIONALITIES - الآن يتم استخدام البيانات من قاعدة البيانات

const STATUS_OPTIONS = [
  { value: "active", label: "نشط" },
  { value: "inactive", label: "غير نشط" },
  { value: "terminated", label: "منتهي" },
  { value: "on_leave", label: "في إجازة" },
];

const HEALTH_CERT_OPTIONS = [
  { value: "none", label: "لا يوجد" },
  { value: "valid", label: "ساري" },
  { value: "expired", label: "منتهي" },
  { value: "pending", label: "قيد التجديد" },
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

function getStatusBadge(status: string) {
  const variants: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-800",
    terminated: "bg-red-100 text-red-800",
    on_leave: "bg-yellow-100 text-yellow-800",
  };
  const labels: Record<string, string> = {
    active: "نشط",
    inactive: "غير نشط",
    terminated: "منتهي",
    on_leave: "في إجازة",
  };
  return <Badge className={variants[status] || variants.active}>{labels[status] || status}</Badge>;
}

function getHealthBadge(status: string) {
  const variants: Record<string, string> = {
    valid: "bg-green-100 text-green-800",
    expired: "bg-red-100 text-red-800",
    pending: "bg-yellow-100 text-yellow-800",
    none: "bg-gray-100 text-gray-800",
  };
  const labels: Record<string, string> = {
    valid: "ساري",
    expired: "منتهي",
    pending: "قيد التجديد",
    none: "لا يوجد",
  };
  return <Badge className={variants[status] || variants.none}>{labels[status] || status}</Badge>;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "--";
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value) + " ريال";
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) return "--";
  return new Intl.NumberFormat('en-US').format(value);
}

const getHealthLabel = (status: string): string => {
  const labels: Record<string, string> = {
    valid: "ساري",
    expired: "منتهي",
    pending: "قيد التجديد",
    none: "لا يوجد",
  };
  return labels[status] || status;
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    active: "نشط",
    inactive: "غير نشط",
    terminated: "منتهي",
    on_leave: "في إجازة",
  };
  return labels[status] || status;
};

const TRANSFER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "في انتظار موافقة مدير الفرع المصدر", color: "bg-yellow-100 text-yellow-800" },
  source_approved: { label: "موافق عليه من الفرع المصدر", color: "bg-blue-100 text-blue-800" },
  dest_approved: { label: "موافق عليه من الفرع الوجهة", color: "bg-indigo-100 text-indigo-800" },
  hr_approved: { label: "معتمد من الموارد البشرية", color: "bg-green-100 text-green-800" },
  completed: { label: "مكتمل", color: "bg-green-100 text-green-800" },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-800" },
  cancelled: { label: "ملغي", color: "bg-gray-100 text-gray-800" },
};

function EmployeeTransfersTab({ employees, branches }: { employees: BranchEmployee[]; branches: Branch[] }) {
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
      if (!res.ok) return [];
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
        throw new Error(err.error || "فشل في إنشاء طلب النقل");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-transfers"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "تم إنشاء طلب النقل بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, approverRole, notes }: { id: number; approverRole: string; notes?: string }) => {
      const res = await fetch(`/api/employee-transfers/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverRole, notes }),
      });
      if (!res.ok) throw new Error("فشل في الموافقة");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-transfers"] });
      setIsDetailsDialogOpen(false);
      toast({ title: "تمت الموافقة بنجاح" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, approverRole, rejectionReason }: { id: number; approverRole: string; rejectionReason: string }) => {
      const res = await fetch(`/api/employee-transfers/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverRole, rejectionReason }),
      });
      if (!res.ok) throw new Error("فشل في الرفض");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-transfers"] });
      setIsDetailsDialogOpen(false);
      toast({ title: "تم رفض الطلب" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/employee-transfers/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("فشل في إتمام النقل");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch-employees"] });
      setIsDetailsDialogOpen(false);
      toast({ title: "تم تنفيذ النقل بنجاح" });
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
    return emp?.employeeName || "غير معروف";
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
      toast({ title: "خطأ", description: "جميع الحقول المطلوبة يجب أن تكون موجودة", variant: "destructive" });
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
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600">معلقة</p>
                <p className="text-2xl font-bold text-yellow-800">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">معتمدة</p>
                <p className="text-2xl font-bold text-green-800">{stats.approved}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">مكتملة</p>
                <p className="text-2xl font-bold text-blue-800">{stats.completed}</p>
              </div>
              <ArrowRight className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">مرفوضة</p>
                <p className="text-2xl font-bold text-red-800">{stats.rejected}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Network className="w-5 h-5" />
              طلبات نقل الموظفين
            </CardTitle>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-amber-600 hover:bg-amber-700" data-testid="btn-create-transfer">
                  <Plus className="w-4 h-4 ml-2" />
                  طلب نقل جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader>
                  <DialogTitle>إنشاء طلب نقل موظف</DialogTitle>
                  <DialogDescription>اختر الموظف والفرع الجديد ومعلومات النقل</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>الموظف * (ابحث بالاسم أو رقم الموظف)</Label>
                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          value={selectedEmployee ? `${getSelectedEmployee()?.employeeName} (${getSelectedEmployee()?.employeeNumber || ""})` : employeeSearchQuery}
                          onChange={(e) => {
                            setEmployeeSearchQuery(e.target.value);
                            setSelectedEmployee(null);
                            setIsEmployeeDropdownOpen(true);
                          }}
                          onFocus={() => setIsEmployeeDropdownOpen(true)}
                          placeholder="ابحث باسم الموظف أو رقمه..."
                          className="pr-10"
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
                              لا يوجد موظفين مطابقين
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
                              يوجد {filteredEmployees.length - 20} موظف آخر - حدد البحث للمزيد
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
                        <span className="font-medium text-amber-800">الموظف المختار</span>
                      </div>
                      <p><strong>الاسم:</strong> {getSelectedEmployee()?.employeeName}</p>
                      {getSelectedEmployee()?.employeeNumber && (
                        <p><strong>رقم الموظف:</strong> {getSelectedEmployee()?.employeeNumber}</p>
                      )}
                      <p><strong>الفرع الحالي:</strong> {getBranchName(getSelectedEmployee()?.branchId || "")}</p>
                      <p><strong>الوظيفة:</strong> {getSelectedEmployee()?.jobTitle}</p>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label>الفرع الجديد *</Label>
                    <Select value={destinationBranch} onValueChange={setDestinationBranch}>
                      <SelectTrigger data-testid="select-destination">
                        <SelectValue placeholder="اختر الفرع الجديد" />
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
                    <Label>تاريخ النقل المطلوب *</Label>
                    <Input 
                      type="date" 
                      value={effectiveDate} 
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      data-testid="input-effective-date"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>سبب النقل *</Label>
                    <Textarea 
                      value={reason} 
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="اشرح سبب طلب النقل"
                      data-testid="input-reason"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>ملاحظات إضافية</Label>
                    <Textarea 
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="أي ملاحظات إضافية (اختياري)"
                      data-testid="input-notes"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>إلغاء</Button>
                  <Button 
                    onClick={handleCreateTransfer}
                    className="bg-amber-600 hover:bg-amber-700"
                    disabled={createMutation.isPending}
                    data-testid="btn-submit-transfer"
                  >
                    {createMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                    إرسال الطلب
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-status-filter">
                <SelectValue placeholder="فلترة حسب الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="pending">معلق</SelectItem>
                <SelectItem value="source_approved">موافق من المصدر</SelectItem>
                <SelectItem value="dest_approved">موافق من الوجهة</SelectItem>
                <SelectItem value="hr_approved">معتمد</SelectItem>
                <SelectItem value="completed">مكتمل</SelectItem>
                <SelectItem value="rejected">مرفوض</SelectItem>
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
              <p>لا توجد طلبات نقل</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الموظف</TableHead>
                  <TableHead className="text-right">من</TableHead>
                  <TableHead className="text-right">إلى</TableHead>
                  <TableHead className="text-right">تاريخ النقل</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.map((transfer) => (
                  <TableRow key={transfer.id} data-testid={`row-transfer-${transfer.id}`}>
                    <TableCell>{getEmployeeName(transfer.employeeId)}</TableCell>
                    <TableCell>{getBranchName(transfer.sourceBranchId)}</TableCell>
                    <TableCell>{getBranchName(transfer.destinationBranchId)}</TableCell>
                    <TableCell>{transfer.effectiveDate}</TableCell>
                    <TableCell>
                      <Badge className={TRANSFER_STATUS_LABELS[transfer.status]?.color || "bg-gray-100"}>
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
          )}
        </CardContent>
      </Card>

      {/* Transfer Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل طلب النقل</DialogTitle>
          </DialogHeader>
          {viewingTransfer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">الموظف</p>
                  <p className="font-medium">{getEmployeeName(viewingTransfer.employeeId)}</p>
                </div>
                <div>
                  <p className="text-gray-500">الحالة</p>
                  <Badge className={TRANSFER_STATUS_LABELS[viewingTransfer.status]?.color}>
                    {TRANSFER_STATUS_LABELS[viewingTransfer.status]?.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-500">من فرع</p>
                  <p className="font-medium">{getBranchName(viewingTransfer.sourceBranchId)}</p>
                </div>
                <div>
                  <p className="text-gray-500">إلى فرع</p>
                  <p className="font-medium">{getBranchName(viewingTransfer.destinationBranchId)}</p>
                </div>
                <div>
                  <p className="text-gray-500">تاريخ النقل</p>
                  <p className="font-medium">{viewingTransfer.effectiveDate}</p>
                </div>
                <div>
                  <p className="text-gray-500">تاريخ الطلب</p>
                  <p className="font-medium">{new Date(viewingTransfer.requestedAt).toLocaleDateString("ar-SA")}</p>
                </div>
              </div>
              
              <div>
                <p className="text-gray-500 text-sm">سبب النقل</p>
                <p className="font-medium bg-gray-50 p-2 rounded">{viewingTransfer.reason}</p>
              </div>
              
              {viewingTransfer.notes && (
                <div>
                  <p className="text-gray-500 text-sm">ملاحظات</p>
                  <p className="bg-gray-50 p-2 rounded">{viewingTransfer.notes}</p>
                </div>
              )}
              
              {viewingTransfer.rejectionReason && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-red-600 text-sm font-medium">سبب الرفض</p>
                  <p className="text-red-800">{viewingTransfer.rejectionReason}</p>
                </div>
              )}

              {/* Approval Actions */}
              {["pending", "source_approved", "dest_approved"].includes(viewingTransfer.status) && (
                <div className="border-t pt-4 space-y-3">
                  <p className="font-medium">إجراءات الموافقة</p>
                  <div className="space-y-2">
                    <Label>ملاحظات الموافقة (اختياري)</Label>
                    <Input 
                      value={approvalNotes} 
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="أدخل ملاحظات الموافقة"
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
                      <CheckCircle className="w-4 h-4 ml-2" />
                      موافقة
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="destructive" data-testid="btn-reject">
                          <XCircle className="w-4 h-4 ml-2" />
                          رفض
                        </Button>
                      </DialogTrigger>
                      <DialogContent dir="rtl">
                        <DialogHeader>
                          <DialogTitle>رفض طلب النقل</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>سبب الرفض *</Label>
                            <Textarea 
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              placeholder="أدخل سبب رفض الطلب"
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
                            تأكيد الرفض
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
                    {completeMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                    <ArrowRight className="w-4 h-4 ml-2" />
                    تنفيذ النقل
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
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNationality, setSelectedNationality] = useState<string>("all");
  const [selectedJobTitle, setSelectedJobTitle] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<BranchEmployee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<BranchEmployee | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedUserToLink, setSelectedUserToLink] = useState<string>("");
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

  const { data: branches } = useQuery({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      return res.json();
    },
  });

  const { data: employees, isLoading } = useQuery({
    queryKey: ["/api/branch-employees", selectedBranch],
    queryFn: async () => {
      const url = selectedBranch === "all" ? "/api/branch-employees" : `/api/branch-employees?branchId=${selectedBranch}`;
      const res = await fetch(url);
      return res.json();
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/branch-employees/stats", selectedBranch],
    queryFn: async () => {
      const url = selectedBranch === "all" ? "/api/branch-employees/stats" : `/api/branch-employees/stats?branchId=${selectedBranch}`;
      const res = await fetch(url);
      return res.json();
    },
  });

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
    setIsDetailsDialogOpen(true);
  };

  const { data: systemUsers } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) return [];
      return res.json();
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ["/api/branch-employees"] });
      setViewingEmployee(updatedEmployee);
      setSelectedUserToLink("");
    },
  });

  // Employee Settings Queries and Mutations
  const { data: employeeSettingsData, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["/api/employee-settings"],
    queryFn: async () => {
      const res = await fetch("/api/employee-settings");
      return res.json() as Promise<EmployeeSetting[]>;
    },
  });

  const settingsByCategory = React.useMemo(() => {
    const grouped: Record<string, EmployeeSetting[]> = {};
    employeeSettingsData?.forEach((setting) => {
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
    { value: "nationality", labelAr: "الجنسيات", icon: Flag },
    { value: "job_title", labelAr: "الوظائف", icon: Briefcase },
    { value: "department", labelAr: "الأقسام", icon: Layers },
    { value: "contract_type", labelAr: "أنواع العقود", icon: FileCheck },
    { value: "bank", labelAr: "البنوك", icon: CreditCard },
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
      queryClient.invalidateQueries({ queryKey: ["/api/branch-employees"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/branch-employees"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/branch-employees"] });
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
    if (selectedStatus !== "all" && emp.status !== selectedStatus) {
      return false;
    }
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
    reader.onload = (event) => {
      try {
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
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const row of jsonData as any[]) {
          try {
            // استخدام الفرع المحدد في نافذة الاستيراد
            const resolvedBranchId = importBranchId;
            
            const employeeData = {
              branchId: resolvedBranchId,
              employeeName: row["الاسم"] || row["اسم الموظف"] || "",
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
            
            if (!employeeData.employeeName) continue;
            
            const res = await fetch("/api/branch-employees", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(employeeData),
            });
            
            if (res.ok) {
              successCount++;
            } else {
              const errorText = await res.text();
              console.error("Import error:", errorText);
              errorCount++;
            }
          } catch (err) {
            console.error("Import row error:", err);
            errorCount++;
          }
        }
        
        if (successCount > 0) {
          alert(`تم استيراد ${successCount} موظف بنجاح${errorCount > 0 ? ` (${errorCount} أخطاء)` : ""}`);
          queryClient.invalidateQueries({ queryKey: ["/api/branch-employees"] });
        } else if (errorCount > 0) {
          alert(`فشل استيراد الموظفين. تحقق من صحة البيانات في ملف Excel`);
        }
        
        setIsImportDialogOpen(false);
        setImportFile(null);
        setImportPreview([]);
        setIsImporting(false);
      };
      reader.readAsArrayBuffer(importFile);
    } catch (error) {
      console.error("Import error:", error);
      alert("حدث خطأ أثناء الاستيراد");
      setIsImporting(false);
    }
  };

  const getBranchName = (branchId: string) => {
    const branch = branches?.find((b: { id: string; name: string }) => b.id === branchId);
    return branch?.name || branchId;
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "موظفي الفروع - باتر بيكري",
  });

  const exportToExcel = () => {
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
    <img src="${logoUrl}" alt="باتر بيكري" class="logo" onerror="this.style.display='none'" />
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
    <p>تم إنشاء هذا التقرير بواسطة نظام إدارة المشروعات - باتر بيكري</p>
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
      <div className="p-6 space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/attendance-dashboard")} data-testid="button-back">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">موظفي الفروع</h1>
              <p className="text-gray-500">إدارة بيانات الموظفين والرواتب والمستندات</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportToExcel} data-testid="button-export-excel">
              <FileSpreadsheet className="w-4 h-4 ml-2" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportToPDF} data-testid="button-export-pdf">
              <Download className="w-4 h-4 ml-2" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePrint()} data-testid="button-print">
              <Printer className="w-4 h-4 ml-2" />
              طباعة
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
              data-testid="input-import-file"
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} data-testid="button-import">
              <Upload className="w-4 h-4 ml-2" />
              استيراد
            </Button>
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => navigate("/organizational-structure")} data-testid="button-org-structure">
              <Network className="w-4 h-4 ml-2" />
              الهيكل الوظيفي
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingEmployee(null);
                form.reset();
              }
            }}>
              <DialogTrigger asChild>
                <Button className="bg-amber-600 hover:bg-amber-700" data-testid="button-add-employee">
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة موظف
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle>{editingEmployee ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}</DialogTitle>
                <DialogDescription>أدخل بيانات الموظف الأساسية والرواتب والمستندات</DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                        <Select value={watchedBranchId} onValueChange={(v) => form.setValue("branchId", v)}>
                          <SelectTrigger data-testid="select-branch">
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
                      </div>
                      <div className="space-y-2">
                        <Label>الحالة</Label>
                        <Select value={watchedStatus} onValueChange={(v) => form.setValue("status", v)}>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue placeholder="اختر الحالة" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            {STATUS_OPTIONS.map((opt) => (
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
                      </div>
                      <div className="space-y-2">
                        <Label>اسم الموظف بالإنجليزي</Label>
                        <Input {...form.register("employeeNameEn")} placeholder="Enter name in English" dir="ltr" data-testid="input-name-en" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>الوظيفة *</Label>
                        <Select value={watchedJobTitle} onValueChange={(v) => form.setValue("jobTitle", v)}>
                          <SelectTrigger data-testid="select-job">
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
                      </div>
                      <div className="space-y-2">
                        <Label>الجنسية *</Label>
                        <Select 
                          value={watchedNationality} 
                          onValueChange={(v) => {
                            form.setValue("nationality", v);
                            // مسح خصم التأمينات إذا تم تغيير الجنسية من سعودي
                            if (v !== "سعودي") {
                              form.setValue("socialInsuranceDeduction", 0);
                            }
                          }}
                        >
                          <SelectTrigger data-testid="select-nationality">
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
                            {HEALTH_CERT_OPTIONS.map((opt) => (
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
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-[450px]">
            <TabsTrigger value="employees" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              الموظفين
            </TabsTrigger>
            <TabsTrigger value="transfers" className="flex items-center gap-2" data-testid="tab-transfers">
              <Network className="w-4 h-4" />
              نقل الموظفين
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              الإعدادات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="employees" className="space-y-6 mt-6">
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">إجمالي الموظفين</p>
                  <p className="text-2xl font-bold" data-testid="text-total-employees">{formatNumber(stats?.totalEmployees || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">إجمالي الرواتب</p>
                  <p className="text-2xl font-bold" data-testid="text-total-salaries">{formatCurrency(stats?.totalSalaries)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Globe className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">عدد الجنسيات</p>
                  <p className="text-2xl font-bold" data-testid="text-nationalities-count">{formatNumber(stats?.byNationality?.length || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Briefcase className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">عدد الوظائف</p>
                  <p className="text-2xl font-bold" data-testid="text-jobs-count">{formatNumber(stats?.byJobTitle?.length || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-gray-500" />
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-48" data-testid="filter-branch">
                <SelectValue placeholder="جميع الفروع" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches?.map((b: { id: string; name: string }) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-gray-500" />
            <Select value={selectedNationality} onValueChange={setSelectedNationality}>
              <SelectTrigger className="w-40" data-testid="filter-nationality">
                <SelectValue placeholder="جميع الجنسيات" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <SelectItem value="all">جميع الجنسيات</SelectItem>
                {settingsByCategory.nationality?.filter(s => s.isActive).map((nat) => (
                  <SelectItem key={nat.id} value={nat.labelAr}>{nat.labelAr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-gray-500" />
            <Select value={selectedJobTitle} onValueChange={setSelectedJobTitle}>
              <SelectTrigger className="w-40" data-testid="filter-job">
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
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-36" data-testid="filter-status">
                <SelectValue placeholder="جميع الحالات" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="inactive">غير نشط</SelectItem>
                <SelectItem value="terminated">منتهي</SelectItem>
                <SelectItem value="on_leave">في إجازة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو الرقم الوظيفي..."
              className="pr-10"
              data-testid="input-search"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="btn-advanced-filters">
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
                  مسح الفلاتر المتقدمة
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-red-600" data-testid="btn-reset-all-filters">
              <X className="w-4 h-4 ml-1" />
              مسح جميع الفلاتر
            </Button>
          )}
        </div>

        <div ref={printRef}>
        <Card>
          <CardHeader>
            <CardTitle>قائمة الموظفين</CardTitle>
            <CardDescription>عرض {formatNumber(filteredEmployees.length)} موظف</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>لا يوجد موظفين</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الرقم الوظيفي</TableHead>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">الفرع</TableHead>
                    <TableHead className="text-right">الوظيفة</TableHead>
                    <TableHead className="text-right">الجنسية</TableHead>
                    <TableHead className="text-right">الراتب الإجمالي</TableHead>
                    <TableHead className="text-right">الشهادة الصحية</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEmployees.map((emp: BranchEmployee) => (
                    <TableRow key={emp.id} data-testid={`row-employee-${emp.id}`}>
                      <TableCell className="font-mono text-sm text-amber-700">{emp.employeeNumber || "--"}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{emp.employeeName}</p>
                          {emp.employeeNameEn && <p className="text-sm text-gray-500" dir="ltr">{emp.employeeNameEn}</p>}
                        </div>
                      </TableCell>
                      <TableCell>{getBranchName(emp.branchId)}</TableCell>
                      <TableCell>{emp.jobTitle}</TableCell>
                      <TableCell>{emp.nationality}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(emp.totalSalary || emp.salary)}</TableCell>
                      <TableCell>{getHealthBadge(emp.healthCertificate || "none")}</TableCell>
                      <TableCell>{getStatusBadge(emp.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleViewDetails(emp)} data-testid={`button-view-${emp.id}`} title="عرض التفاصيل">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(emp)} data-testid={`button-edit-${emp.id}`} title="تعديل">
                            <Edit className="w-4 h-4" />
                          </Button>
                          {user?.role === "admin" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteClick(emp)}
                              data-testid={`button-delete-${emp.id}`}
                              title="حذف (مدير النظام فقط)"
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
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-500">
                  عرض {formatNumber(startIndex + 1)} - {formatNumber(Math.min(startIndex + pageSize, filteredEmployees.length))} من {formatNumber(filteredEmployees.length)}
                </div>
                <div className="flex items-center gap-2">
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                    <SelectTrigger className="w-24" data-testid="select-page-size">
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
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    data-testid="btn-prev-page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <span className="text-sm">صفحة {formatNumber(currentPage)} من {formatNumber(totalPages)}</span>
                  <Button
                    variant="outline"
                    size="sm"
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

        {stats && (stats.byNationality?.length > 0 || stats.byJobTitle?.length > 0) && (
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  توزيع الجنسيات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.byNationality?.map((item: { nationality: string; count: number }) => (
                    <div key={item.nationality} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span>{item.nationality}</span>
                      <Badge variant="outline">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  توزيع الوظائف
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.byJobTitle?.map((item: { jobTitle: string; count: number }) => (
                    <div key={item.jobTitle} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span>{item.jobTitle}</span>
                      <Badge variant="outline">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
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
                  إعدادات بيانات الموظفين
                </CardTitle>
                <CardDescription>إدارة القوائم المنسدلة وخيارات البيانات التي تظهر في نماذج الموظفين</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* Categories sidebar */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-gray-500 mb-3">الفئات</h4>
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
                          {cat.labelAr}
                          <Badge variant="outline" className="mr-auto">{settingsByCategory[cat.value]?.length || 0}</Badge>
                        </Button>
                      );
                    })}
                  </div>

                  {/* Settings list */}
                  <div className="md:col-span-3 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">
                        {SETTING_CATEGORIES.find(c => c.value === settingsCategory)?.labelAr || settingsCategory}
                      </h4>
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={handleAddSetting} data-testid="btn-add-setting">
                        <Plus className="w-4 h-4 ml-2" />
                        إضافة جديد
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
                              <TableHead className="text-right">#</TableHead>
                              <TableHead className="text-right">القيمة</TableHead>
                              <TableHead className="text-right">الاسم بالعربي</TableHead>
                              <TableHead className="text-right">الاسم بالإنجليزي</TableHead>
                              <TableHead className="text-right">الحالة</TableHead>
                              <TableHead className="text-center w-32">إجراءات</TableHead>
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
                                    {setting.isActive ? "نشط" : "غير نشط"}
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
                                        if (confirm(`هل أنت متأكد من حذف "${setting.labelAr}"؟`)) {
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
                                  لا توجد بيانات في هذه الفئة
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
              <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader>
                  <DialogTitle>{editingSetting ? "تعديل الإعداد" : "إضافة إعداد جديد"}</DialogTitle>
                  <DialogDescription>
                    {editingSetting ? "تعديل القيمة الموجودة" : `إضافة قيمة جديدة إلى ${SETTING_CATEGORIES.find(c => c.value === settingsCategory)?.labelAr}`}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>القيمة *</Label>
                    <Input 
                      value={newSettingValue}
                      onChange={(e) => setNewSettingValue(e.target.value)}
                      placeholder="مثال: سعودي"
                      data-testid="input-setting-value"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الاسم بالعربي *</Label>
                    <Input 
                      value={newSettingLabelAr}
                      onChange={(e) => setNewSettingLabelAr(e.target.value)}
                      placeholder="مثال: سعودي"
                      data-testid="input-setting-label-ar"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الاسم بالإنجليزي (اختياري)</Label>
                    <Input 
                      value={newSettingLabelEn}
                      onChange={(e) => setNewSettingLabelEn(e.target.value)}
                      placeholder="مثال: Saudi"
                      dir="ltr"
                      data-testid="input-setting-label-en"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsSettingDialogOpen(false)}>إلغاء</Button>
                  <Button 
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={handleSaveSetting}
                    disabled={!newSettingValue || !newSettingLabelAr || createSettingMutation.isPending || updateSettingMutation.isPending}
                    data-testid="btn-save-setting"
                  >
                    {(createSettingMutation.isPending || updateSettingMutation.isPending) && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                    {editingSetting ? "تحديث" : "إضافة"}
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
                تفاصيل الموظف: {viewingEmployee?.employeeName}
              </DialogTitle>
              <DialogDescription>
                عرض سجلات الحضور والجداول والدوام المرتبطة بالموظف
              </DialogDescription>
            </DialogHeader>
            
            {viewingEmployee && (
              <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="info">معلومات الموظف</TabsTrigger>
                  <TabsTrigger value="attendance">سجلات الحضور</TabsTrigger>
                  <TabsTrigger value="schedules">جداول الدوام</TabsTrigger>
                  <TabsTrigger value="timesheets">تقارير كشوف الدوام</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <UserCheck className="w-4 h-4" />
                          البيانات الأساسية
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">الاسم:</span><span>{viewingEmployee.employeeName}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">الفرع:</span><span>{getBranchName(viewingEmployee.branchId)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">الوظيفة:</span><span>{viewingEmployee.jobTitle}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">الجنسية:</span><span>{viewingEmployee.nationality}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">الحالة:</span>{getStatusBadge(viewingEmployee.status)}</div>
                        {viewingEmployee.linkedUserId && (
                          <div className="flex justify-between"><span className="text-gray-500">مرتبط بالنظام:</span><Badge className="bg-blue-100 text-blue-800">نعم</Badge></div>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          بيانات الراتب
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">الراتب الأساسي:</span><span>{formatCurrency(viewingEmployee.salary)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">بدل السكن:</span><span>{formatCurrency(viewingEmployee.housingAllowance)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">بدل المواصلات:</span><span>{formatCurrency(viewingEmployee.transportAllowance)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">بدل الطعام:</span><span>{formatCurrency(viewingEmployee.foodAllowance)}</span></div>
                        {viewingEmployee.nationality === "سعودي" && (viewingEmployee.socialInsuranceDeduction || 0) > 0 && (
                          <div className="flex justify-between text-red-600">
                            <span>خصم التأمينات الاجتماعية:</span>
                            <span>- {formatCurrency(viewingEmployee.socialInsuranceDeduction)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold border-t pt-2"><span>صافي الراتب:</span><span>{formatCurrency(viewingEmployee.totalSalary)}</span></div>
                      </CardContent>
                    </Card>
                  </div>
                  {!viewingEmployee.linkedUserId && (
                    <Card className="bg-amber-50 border-amber-200">
                      <CardContent className="py-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-amber-800">
                            <Link className="w-4 h-4" />
                            <span className="text-sm">هذا الموظف غير مرتبط بحساب مستخدم في النظام. لتفعيل سجلات الحضور التلقائية، يجب ربطه بحساب مستخدم.</span>
                          </div>
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
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {viewingEmployee.linkedUserId && (
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="py-4">
                        <div className="flex items-center gap-2 text-green-800">
                          <UserCheck className="w-4 h-4" />
                          <span className="text-sm">هذا الموظف مرتبط بحساب مستخدم في النظام. سجلات الحضور والدوام ستظهر تلقائياً.</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
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
