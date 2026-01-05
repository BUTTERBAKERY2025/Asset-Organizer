import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ar } from "date-fns/locale";
import { Calendar, FileText, Pen, Printer, Download, Loader2, CheckCircle, Clock, AlertCircle, User, Check, XCircle, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import SignatureCanvas from "react-signature-canvas";
import * as XLSX from "xlsx";

interface Branch {
  id: string;
  name: string;
}

interface User {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  branchId?: string;
  jobTitle?: string;
}

interface TimesheetReport {
  id: number;
  employeeId: string;
  branchId: string;
  startDate: string;
  endDate: string;
  status: string;
  totalScheduledDays: number;
  totalPresentDays: number;
  totalAbsentDays: number;
  totalLateDays: number;
  totalScheduledHours: number;
  totalActualHours: number;
  totalOvertimeMinutes: number;
  totalLateMinutes: number;
  employeeSignature?: string;
  employeeSignedAt?: string;
  employeeAcknowledgment?: string;
  managerSignature?: string;
  managerId?: string;
  managerSignedAt?: string;
  managerAcknowledgment?: string;
  createdAt: string;
}

interface TimesheetEntry {
  id: number;
  reportId: number;
  date: string;
  dayOfWeek: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  isOff: boolean;
  status: string;
  scheduledHours: number;
  actualHours: number;
  overtimeMinutes: number;
  lateMinutes: number;
  notes?: string;
  checkInSignature?: string;
  checkOutSignature?: string;
}

const DAY_LABELS: Record<string, string> = {
  sat: "السبت",
  sun: "الأحد",
  mon: "الاثنين",
  tue: "الثلاثاء",
  wed: "الأربعاء",
  thu: "الخميس",
  fri: "الجمعة",
};

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "معلق", color: "bg-gray-100 text-gray-700", icon: <Clock className="w-3 h-3" /> },
  present: { label: "حاضر", color: "bg-green-100 text-green-700", icon: <CheckCircle className="w-3 h-3" /> },
  absent: { label: "غائب", color: "bg-red-100 text-red-700", icon: <XCircle className="w-3 h-3" /> },
  late: { label: "متأخر", color: "bg-amber-100 text-amber-700", icon: <AlertCircle className="w-3 h-3" /> },
  day_off: { label: "إجازة", color: "bg-blue-100 text-blue-700", icon: <Calendar className="w-3 h-3" /> },
};

const TIMESHEET_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد الإنشاء", color: "bg-gray-100 text-gray-700" },
  pending_employee_signature: { label: "بانتظار توقيع الموظف", color: "bg-amber-100 text-amber-700" },
  pending_manager_signature: { label: "بانتظار توقيع المدير", color: "bg-blue-100 text-blue-700" },
  finalized: { label: "مكتمل", color: "bg-green-100 text-green-700" },
};

export default function TimesheetPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const [activeTab, setActiveTab] = useState("generate");
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureType, setSignatureType] = useState<"employee" | "manager">("employee");
  const [selectedReport, setSelectedReport] = useState<TimesheetReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const signatureRef = useRef<SignatureCanvas>(null);

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const filteredEmployees = selectedBranch === "all" 
    ? allUsers 
    : allUsers.filter(u => u.branchId === selectedBranch);

  const { data: reports = [], isLoading: reportsLoading } = useQuery<TimesheetReport[]>({
    queryKey: ["/api/timesheet-reports", selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      const res = await fetch(`/api/timesheet-reports?${params}`);
      return res.json();
    },
    enabled: activeTab === "history",
  });

  const { data: reportEntries = [], isLoading: entriesLoading } = useQuery<TimesheetEntry[]>({
    queryKey: ["/api/timesheet-reports", selectedReport?.id, "entries"],
    queryFn: async () => {
      if (!selectedReport) return [];
      const res = await fetch(`/api/timesheet-reports/${selectedReport.id}/entries`);
      return res.json();
    },
    enabled: !!selectedReport,
  });

  const generateMutation = useMutation({
    mutationFn: async (data: { employeeId: string; branchId: string; startDate: string; endDate: string }) => {
      const res = await fetch("/api/timesheet-reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "فشل في إنشاء التقرير");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "تم إنشاء التقرير بنجاح", description: `تم إنشاء ${data.entriesCount} سجل يومي` });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheet-reports"] });
      setSelectedReport(data.report);
      setActiveTab("view");
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const signMutation = useMutation({
    mutationFn: async (data: { id: number; signatureType: string; signature: string; acknowledgment?: string }) => {
      const res = await fetch(`/api/timesheet-reports/${data.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "فشل في التوقيع");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "تم التوقيع بنجاح" });
      setSelectedReport(data);
      setShowSignatureDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/timesheet-reports"] });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const handleGenerateReport = () => {
    if (!selectedEmployee) {
      toast({ title: "تنبيه", description: "يرجى اختيار موظف", variant: "destructive" });
      return;
    }
    
    const employee = allUsers.find(u => u.id === selectedEmployee);
    if (!employee?.branchId && selectedBranch === "all") {
      toast({ title: "تنبيه", description: "يرجى اختيار فرع", variant: "destructive" });
      return;
    }

    const [year, month] = selectedMonth.split("-").map(Number);
    const monthDate = new Date(year, month - 1, 1);
    const startDate = format(startOfMonth(monthDate), "yyyy-MM-dd");
    const endDate = format(endOfMonth(monthDate), "yyyy-MM-dd");
    
    const branchId = selectedBranch !== "all" ? selectedBranch : employee?.branchId || "";
    
    if (!branchId) {
      toast({ title: "تنبيه", description: "يرجى اختيار فرع", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    generateMutation.mutate(
      { employeeId: selectedEmployee, branchId, startDate, endDate },
      { onSettled: () => setIsGenerating(false) }
    );
  };

  const handleOpenSignature = (type: "employee" | "manager", report: TimesheetReport) => {
    setSignatureType(type);
    setSelectedReport(report);
    setShowSignatureDialog(true);
  };

  const handleSubmitSignature = () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast({ title: "تنبيه", description: "يرجى التوقيع أولاً", variant: "destructive" });
      return;
    }
    
    if (!selectedReport) return;
    
    const signature = signatureRef.current.toDataURL();
    const acknowledgment = signatureType === "employee" 
      ? "أقر بصحة بيانات الحضور والانصراف المذكورة أعلاه"
      : "أصادق على صحة بيانات حضور وانصراف الموظف";
    
    signMutation.mutate({
      id: selectedReport.id,
      signatureType,
      signature,
      acknowledgment,
    });
  };

  const handleClearSignature = () => {
    signatureRef.current?.clear();
  };

  const getEmployeeName = useCallback((employeeId: string) => {
    const employee = allUsers.find(u => u.id === employeeId);
    if (!employee) return "غير معروف";
    return `${employee.firstName || ""} ${employee.lastName || ""}`.trim() || employee.username || "غير معروف";
  }, [allUsers]);

  const exportToExcel = () => {
    if (!selectedReport || reportEntries.length === 0) {
      toast({ title: "تنبيه", description: "لا توجد بيانات للتصدير", variant: "destructive" });
      return;
    }

    const data = reportEntries.map(entry => ({
      "التاريخ": entry.date,
      "اليوم": DAY_LABELS[entry.dayOfWeek] || entry.dayOfWeek,
      "الحالة": STATUS_LABELS[entry.status]?.label || entry.status,
      "وقت البداية المقرر": entry.scheduledStartTime || "-",
      "وقت النهاية المقرر": entry.scheduledEndTime || "-",
      "وقت الحضور الفعلي": entry.actualStartTime || "-",
      "وقت الانصراف الفعلي": entry.actualEndTime || "-",
      "ساعات العمل المقررة": entry.scheduledHours || 0,
      "ساعات العمل الفعلية": entry.actualHours || 0,
      "دقائق التأخير": entry.lateMinutes || 0,
      "دقائق العمل الإضافي": entry.overtimeMinutes || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تقرير التايم شيت");
    const employeeName = getEmployeeName(selectedReport.employeeId);
    XLSX.writeFile(wb, `timesheet_${employeeName}_${selectedReport.startDate}_${selectedReport.endDate}.xlsx`);
  };

  const printReport = () => {
    if (!selectedReport) return;
    
    const employeeName = getEmployeeName(selectedReport.employeeId);
    const branch = branches.find(b => b.id === selectedReport.branchId);
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    const entriesHtml = reportEntries.map(entry => `
      <tr>
        <td>${entry.date}</td>
        <td>${DAY_LABELS[entry.dayOfWeek] || entry.dayOfWeek}</td>
        <td>${STATUS_LABELS[entry.status]?.label || entry.status}</td>
        <td>${entry.scheduledStartTime || "-"}</td>
        <td>${entry.scheduledEndTime || "-"}</td>
        <td>${entry.actualStartTime || "-"}</td>
        <td>${entry.actualEndTime || "-"}</td>
        <td>${entry.actualHours?.toFixed(1) || "0"}</td>
        <td>${entry.lateMinutes || 0}</td>
        <td>${entry.checkInSignature ? `<img src="${entry.checkInSignature}" alt="توقيع" style="max-height: 25px; max-width: 60px;" />` : "-"}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تقرير التايم شيت - ${employeeName}</title>
        <style>
          body { font-family: 'Cairo', Arial, sans-serif; padding: 20px; direction: rtl; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #D4AF37; padding-bottom: 20px; }
          .header h1 { color: #1a1a1a; margin: 0; }
          .header h2 { color: #D4AF37; margin: 10px 0; }
          .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
          .info-item { padding: 8px; background: #f5f5f5; border-radius: 4px; }
          .info-label { font-weight: bold; color: #666; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 12px; }
          th { background: #D4AF37; color: white; }
          tr:nth-child(even) { background: #f9f9f9; }
          .summary { margin: 20px 0; padding: 15px; background: #f0f0f0; border-radius: 8px; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
          .summary-item { text-align: center; }
          .summary-value { font-size: 24px; font-weight: bold; color: #D4AF37; }
          .signatures { display: grid; grid-template-columns: repeat(2, 1fr); gap: 40px; margin-top: 40px; }
          .signature-box { border: 1px solid #ddd; padding: 20px; min-height: 150px; }
          .signature-title { font-weight: bold; margin-bottom: 10px; }
          .signature-img { max-width: 200px; max-height: 80px; }
          .signature-date { font-size: 12px; color: #666; margin-top: 10px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>مخبز باتر</h1>
          <h2>تقرير التايم شيت الشهري</h2>
        </div>
        
        <div class="info-grid">
          <div class="info-item"><span class="info-label">اسم الموظف:</span> ${employeeName}</div>
          <div class="info-item"><span class="info-label">الفرع:</span> ${branch?.name || "-"}</div>
          <div class="info-item"><span class="info-label">من تاريخ:</span> ${selectedReport.startDate}</div>
          <div class="info-item"><span class="info-label">إلى تاريخ:</span> ${selectedReport.endDate}</div>
        </div>

        <div class="summary">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-value">${selectedReport.totalScheduledDays}</div>
              <div>أيام العمل المقررة</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${selectedReport.totalPresentDays}</div>
              <div>أيام الحضور</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${selectedReport.totalAbsentDays}</div>
              <div>أيام الغياب</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${selectedReport.totalActualHours?.toFixed(1) || 0}</div>
              <div>إجمالي ساعات العمل</div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>اليوم</th>
              <th>الحالة</th>
              <th>بداية الدوام</th>
              <th>نهاية الدوام</th>
              <th>وقت الحضور</th>
              <th>وقت الانصراف</th>
              <th>ساعات العمل</th>
              <th>دقائق التأخير</th>
              <th>التوقيع</th>
            </tr>
          </thead>
          <tbody>
            ${entriesHtml}
          </tbody>
        </table>

        <div class="signatures">
          <div class="signature-box">
            <div class="signature-title">توقيع الموظف</div>
            ${selectedReport.employeeSignature 
              ? `<img class="signature-img" src="${selectedReport.employeeSignature}" alt="توقيع الموظف" />`
              : '<div style="height: 60px; border-bottom: 1px dashed #ccc; margin: 20px 0;"></div>'}
            <div>${selectedReport.employeeAcknowledgment || "أقر بصحة بيانات الحضور والانصراف المذكورة أعلاه"}</div>
            ${selectedReport.employeeSignedAt 
              ? `<div class="signature-date">تاريخ التوقيع: ${new Date(selectedReport.employeeSignedAt).toLocaleDateString('ar-SA')}</div>` 
              : ""}
          </div>
          <div class="signature-box">
            <div class="signature-title">توقيع المدير المباشر</div>
            ${selectedReport.managerSignature 
              ? `<img class="signature-img" src="${selectedReport.managerSignature}" alt="توقيع المدير" />`
              : '<div style="height: 60px; border-bottom: 1px dashed #ccc; margin: 20px 0;"></div>'}
            <div>${selectedReport.managerAcknowledgment || "أصادق على صحة بيانات حضور وانصراف الموظف"}</div>
            ${selectedReport.managerSignedAt 
              ? `<div class="signature-date">تاريخ التوقيع: ${new Date(selectedReport.managerSignedAt).toLocaleDateString('ar-SA')}</div>` 
              : ""}
          </div>
        </div>
        
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const [, navigate] = useLocation();

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/attendance-dashboard")}
              data-testid="btn-back"
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">تقارير التايم شيت</h1>
              <p className="text-muted-foreground">إنشاء وإدارة تقارير الدوام مع التوقيعات الإلكترونية</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="generate" className="gap-2" data-testid="tab-generate">
              <FileText className="w-4 h-4" />
              إنشاء تقرير
            </TabsTrigger>
            <TabsTrigger value="view" className="gap-2" data-testid="tab-view" disabled={!selectedReport}>
              <Calendar className="w-4 h-4" />
              عرض التقرير
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2" data-testid="tab-history">
              <Clock className="w-4 h-4" />
              السجلات السابقة
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  إنشاء تقرير تايم شيت جديد
                </CardTitle>
                <CardDescription>
                  اختر الموظف والفترة الزمنية لإنشاء تقرير دوام شامل
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>الفرع</Label>
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger data-testid="select-branch">
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الفروع</SelectItem>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>الموظف</Label>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger data-testid="select-employee">
                        <SelectValue placeholder="اختر الموظف" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredEmployees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {`${employee.firstName || ""} ${employee.lastName || ""}`.trim() || employee.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>الشهر</Label>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger data-testid="select-month">
                        <SelectValue placeholder="اختر الشهر" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={format(new Date(), "yyyy-MM")}>
                          {format(new Date(), "MMMM yyyy", { locale: ar })}
                        </SelectItem>
                        <SelectItem value={format(subMonths(new Date(), 1), "yyyy-MM")}>
                          {format(subMonths(new Date(), 1), "MMMM yyyy", { locale: ar })}
                        </SelectItem>
                        <SelectItem value={format(subMonths(new Date(), 2), "yyyy-MM")}>
                          {format(subMonths(new Date(), 2), "MMMM yyyy", { locale: ar })}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  onClick={handleGenerateReport} 
                  disabled={isGenerating || !selectedEmployee}
                  className="w-full gap-2"
                  data-testid="btn-generate-timesheet"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جاري الإنشاء...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      إنشاء التقرير
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="view" className="space-y-6">
            {selectedReport && (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <User className="w-5 h-5" />
                          {getEmployeeName(selectedReport.employeeId)}
                        </CardTitle>
                        <CardDescription>
                          {selectedReport.startDate} إلى {selectedReport.endDate}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={TIMESHEET_STATUS_LABELS[selectedReport.status]?.color}>
                          {TIMESHEET_STATUS_LABELS[selectedReport.status]?.label}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="p-4 bg-muted rounded-lg text-center">
                        <div className="text-2xl font-bold">{selectedReport.totalScheduledDays}</div>
                        <div className="text-sm text-muted-foreground">أيام العمل</div>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-700">{selectedReport.totalPresentDays}</div>
                        <div className="text-sm text-green-600">أيام الحضور</div>
                      </div>
                      <div className="p-4 bg-red-50 rounded-lg text-center">
                        <div className="text-2xl font-bold text-red-700">{selectedReport.totalAbsentDays}</div>
                        <div className="text-sm text-red-600">أيام الغياب</div>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg text-center">
                        <div className="text-2xl font-bold text-blue-700">{selectedReport.totalActualHours?.toFixed(1) || 0}</div>
                        <div className="text-sm text-blue-600">ساعات العمل</div>
                      </div>
                    </div>

                    <div className="flex gap-2 mb-6">
                      <Button variant="outline" onClick={exportToExcel} className="gap-2" data-testid="btn-export-excel">
                        <Download className="w-4 h-4" />
                        تصدير Excel
                      </Button>
                      <Button variant="outline" onClick={printReport} className="gap-2" data-testid="btn-print">
                        <Printer className="w-4 h-4" />
                        طباعة
                      </Button>
                      {(selectedReport.status === "pending" || selectedReport.status === "pending_employee_signature") && (
                        <Button onClick={() => handleOpenSignature("employee", selectedReport)} className="gap-2" data-testid="btn-sign-employee">
                          <Pen className="w-4 h-4" />
                          توقيع الموظف
                        </Button>
                      )}
                      {selectedReport.status === "pending_manager_signature" && (
                        <Button onClick={() => handleOpenSignature("manager", selectedReport)} className="gap-2" data-testid="btn-sign-manager">
                          <Pen className="w-4 h-4" />
                          توقيع المدير
                        </Button>
                      )}
                    </div>

                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">التاريخ</TableHead>
                            <TableHead className="text-center">اليوم</TableHead>
                            <TableHead className="text-center">الحالة</TableHead>
                            <TableHead className="text-center">بداية الدوام</TableHead>
                            <TableHead className="text-center">نهاية الدوام</TableHead>
                            <TableHead className="text-center">وقت الحضور</TableHead>
                            <TableHead className="text-center">وقت الانصراف</TableHead>
                            <TableHead className="text-center">ساعات العمل</TableHead>
                            <TableHead className="text-center">تأخير (دقائق)</TableHead>
                            <TableHead className="text-center">توقيع الحضور</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entriesLoading ? (
                            <TableRow>
                              <TableCell colSpan={10} className="text-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                              </TableCell>
                            </TableRow>
                          ) : reportEntries.map(entry => (
                            <TableRow key={entry.id} className={entry.isOff ? "bg-gray-50" : ""}>
                              <TableCell className="font-medium">{entry.date}</TableCell>
                              <TableCell className="text-center">{DAY_LABELS[entry.dayOfWeek] || entry.dayOfWeek}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={`${STATUS_LABELS[entry.status]?.color || "bg-gray-100"} gap-1`}>
                                  {STATUS_LABELS[entry.status]?.icon}
                                  {STATUS_LABELS[entry.status]?.label || entry.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">{entry.scheduledStartTime || "-"}</TableCell>
                              <TableCell className="text-center">{entry.scheduledEndTime || "-"}</TableCell>
                              <TableCell className="text-center">{entry.actualStartTime || "-"}</TableCell>
                              <TableCell className="text-center">{entry.actualEndTime || "-"}</TableCell>
                              <TableCell className="text-center">{entry.actualHours?.toFixed(1) || "-"}</TableCell>
                              <TableCell className="text-center">
                                {entry.lateMinutes > 0 ? (
                                  <span className="text-amber-600 font-medium">{entry.lateMinutes}</span>
                                ) : "-"}
                              </TableCell>
                              <TableCell className="text-center">
                                {entry.checkInSignature ? (
                                  <img src={entry.checkInSignature} alt="توقيع" className="h-8 max-w-16 mx-auto object-contain" />
                                ) : "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Signatures Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">توقيع الموظف</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {selectedReport.employeeSignature ? (
                            <div className="space-y-2">
                              <img 
                                src={selectedReport.employeeSignature} 
                                alt="توقيع الموظف" 
                                className="max-h-20 border rounded p-2"
                              />
                              <p className="text-sm text-muted-foreground">{selectedReport.employeeAcknowledgment}</p>
                              {selectedReport.employeeSignedAt && (
                                <p className="text-xs text-muted-foreground">
                                  تاريخ التوقيع: {new Date(selectedReport.employeeSignedAt).toLocaleDateString('ar-SA')}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-muted-foreground">
                              <Pen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p>لم يتم التوقيع بعد</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">توقيع المدير المباشر</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {selectedReport.managerSignature ? (
                            <div className="space-y-2">
                              <img 
                                src={selectedReport.managerSignature} 
                                alt="توقيع المدير" 
                                className="max-h-20 border rounded p-2"
                              />
                              <p className="text-sm text-muted-foreground">{selectedReport.managerAcknowledgment}</p>
                              {selectedReport.managerSignedAt && (
                                <p className="text-xs text-muted-foreground">
                                  تاريخ التوقيع: {new Date(selectedReport.managerSignedAt).toLocaleDateString('ar-SA')}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-muted-foreground">
                              <Pen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p>لم يتم التوقيع بعد</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>السجلات السابقة</CardTitle>
                <CardDescription>جميع تقارير التايم شيت المحفوظة</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="w-[200px]" data-testid="select-history-branch">
                      <SelectValue placeholder="فلترة حسب الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الفروع</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الموظف</TableHead>
                        <TableHead className="text-center">الفترة</TableHead>
                        <TableHead className="text-center">الحالة</TableHead>
                        <TableHead className="text-center">أيام الحضور</TableHead>
                        <TableHead className="text-center">تاريخ الإنشاء</TableHead>
                        <TableHead className="text-center">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportsLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : reports.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            لا توجد تقارير سابقة
                          </TableCell>
                        </TableRow>
                      ) : reports.map(report => (
                        <TableRow key={report.id}>
                          <TableCell className="font-medium">{getEmployeeName(report.employeeId)}</TableCell>
                          <TableCell className="text-center text-sm">
                            {report.startDate} - {report.endDate}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={TIMESHEET_STATUS_LABELS[report.status]?.color}>
                              {TIMESHEET_STATUS_LABELS[report.status]?.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {report.totalPresentDays} / {report.totalScheduledDays}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {new Date(report.createdAt).toLocaleDateString('ar-SA')}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedReport(report);
                                setActiveTab("view");
                              }}
                              data-testid={`btn-view-report-${report.id}`}
                            >
                              عرض
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Signature Dialog */}
        <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {signatureType === "employee" ? "توقيع الموظف" : "توقيع المدير المباشر"}
              </DialogTitle>
              <DialogDescription>
                {signatureType === "employee" 
                  ? "أقر بصحة بيانات الحضور والانصراف المذكورة أعلاه"
                  : "أصادق على صحة بيانات حضور وانصراف الموظف"}
              </DialogDescription>
            </DialogHeader>
            
            <div className="border rounded-lg p-2 bg-white">
              <SignatureCanvas
                ref={signatureRef}
                penColor="black"
                canvasProps={{
                  width: 400,
                  height: 200,
                  className: "signature-canvas",
                  style: { width: "100%", height: "200px" }
                }}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClearSignature} data-testid="btn-clear-signature">
                مسح
              </Button>
              <Button 
                onClick={handleSubmitSignature} 
                disabled={signMutation.isPending}
                data-testid="btn-submit-signature"
              >
                {signMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                تأكيد التوقيع
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
