import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { useBranches } from "@/hooks/useBranches";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { Calendar, FileText, Pen, Printer, Download, Loader2, CheckCircle, Clock, AlertCircle, User, Check, XCircle, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import SignatureCanvas from "react-signature-canvas";

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

interface BranchEmployee {
  id: number;
  employeeName: string;
  branchId: string;
  jobTitle?: string;
  linkedUserId?: string | null;
  status?: string;
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

export default function TimesheetPage() {
  const { t, i18n } = useTranslation("hr");
  const isRTL = i18n.language === "ar";
  const dateLocale = isRTL ? ar : enUS;

  const DAY_LABELS: Record<string, string> = {
    sat: t("timesheet.days.sat"),
    sun: t("timesheet.days.sun"),
    mon: t("timesheet.days.mon"),
    tue: t("timesheet.days.tue"),
    wed: t("timesheet.days.wed"),
    thu: t("timesheet.days.thu"),
    fri: t("timesheet.days.fri"),
  };

  const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending: { label: t("timesheet.statusLabels.pending"), color: "bg-gray-100 text-gray-700", icon: <Clock className="w-3 h-3" /> },
    present: { label: t("timesheet.statusLabels.present"), color: "bg-green-100 text-green-700", icon: <CheckCircle className="w-3 h-3" /> },
    absent: { label: t("timesheet.statusLabels.absent"), color: "bg-red-100 text-red-700", icon: <XCircle className="w-3 h-3" /> },
    late: { label: t("timesheet.statusLabels.late"), color: "bg-amber-100 text-amber-700", icon: <AlertCircle className="w-3 h-3" /> },
    day_off: { label: t("timesheet.statusLabels.dayOff"), color: "bg-blue-100 text-blue-700", icon: <Calendar className="w-3 h-3" /> },
  };

  const TIMESHEET_STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending: { label: t("timesheet.reportStatusLabels.pending"), color: "bg-gray-100 text-gray-700" },
    pending_employee_signature: { label: t("timesheet.reportStatusLabels.pendingEmployee"), color: "bg-amber-100 text-amber-700" },
    pending_manager_signature: { label: t("timesheet.reportStatusLabels.pendingManager"), color: "bg-blue-100 text-blue-700" },
    finalized: { label: t("timesheet.reportStatusLabels.finalized"), color: "bg-green-100 text-green-700" },
  };
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { branches, userBranchId, canSelectBranch } = useBranches();
  
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const [activeTab, setActiveTab] = useState("generate");
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureType, setSignatureType] = useState<"employee" | "manager">("employee");
  const [selectedReport, setSelectedReport] = useState<TimesheetReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingBranchPdf, setIsDownloadingBranchPdf] = useState(false);
  
  const signatureRef = useRef<SignatureCanvas>(null);

  useEffect(() => {
    if (userBranchId && selectedBranch === "") {
      setSelectedBranch(userBranchId);
    } else if (!userBranchId && selectedBranch === "") {
      setSelectedBranch("all");
    }
  }, [userBranchId, selectedBranch]);

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: [`/api/branch-cashiers${selectedBranch && selectedBranch !== "all" ? `?branchId=${selectedBranch}` : ""}`],
  });

  // Fetch branch employees - always fetch to combine with users
  const { data: branchEmployees = [] } = useQuery<BranchEmployee[]>({
    queryKey: ["/api/branch-employees", selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch && selectedBranch !== "all") params.append("branchId", selectedBranch);
      const res = await fetch(`/api/branch-employees?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Combine users and branch employees (without linked user accounts)
  const combinedEmployees = [
    ...allUsers.filter(u => selectedBranch === "all" || u.branchId === selectedBranch).map(u => ({
      id: u.id,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username,
      branchId: u.branchId || '',
      type: 'user' as const,
    })),
    ...branchEmployees.filter(be => !be.linkedUserId && be.status === 'active').map(be => ({
      id: `branch_emp_${be.id}`,
      name: be.employeeName,
      branchId: be.branchId,
      type: 'branch_employee' as const,
    })),
  ];

  const filteredEmployees = combinedEmployees;

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
        throw new Error(error.error || t("timesheet.reportError"));
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: t("timesheet.reportSuccess"), description: t("timesheet.reportSuccessDesc", { count: data.entriesCount }) });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheet-reports"] });
      setSelectedReport(data.report);
      setActiveTab("view");
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
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
        throw new Error(error.error || t("timesheet.signError"));
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: t("timesheet.signSuccess") });
      setSelectedReport(data);
      setShowSignatureDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/timesheet-reports"] });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const handleGenerateReport = () => {
    if (!selectedEmployee) {
      toast({ title: t("common.alert"), description: t("timesheet.selectEmployeeAlert"), variant: "destructive" });
      return;
    }
    
    const employee = allUsers.find(u => u.id === selectedEmployee);
    if (!employee?.branchId && selectedBranch === "all") {
      toast({ title: t("common.alert"), description: t("timesheet.selectBranchAlert"), variant: "destructive" });
      return;
    }

    const [year, month] = selectedMonth.split("-").map(Number);
    const monthDate = new Date(year, month - 1, 1);
    const startDate = format(startOfMonth(monthDate), "yyyy-MM-dd");
    const endDate = format(endOfMonth(monthDate), "yyyy-MM-dd");
    
    const branchId = selectedBranch !== "all" ? selectedBranch : employee?.branchId || "";
    
    if (!branchId) {
      toast({ title: t("common.alert"), description: t("timesheet.selectBranchAlert"), variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    generateMutation.mutate(
      { employeeId: selectedEmployee, branchId, startDate, endDate },
      { onSettled: () => setIsGenerating(false) }
    );
  };

  const handleDownloadBranchPdf = async () => {
    if (!selectedBranch || selectedBranch === "all") {
      toast({ title: t("common.alert"), description: t("timesheet.branchPdf.selectBranchFirst"), variant: "destructive" });
      return;
    }

    const [year, month] = selectedMonth.split("-").map(Number);
    const monthDate = new Date(year, month - 1, 1);
    const startDate = format(startOfMonth(monthDate), "yyyy-MM-dd");
    const endDate = format(endOfMonth(monthDate), "yyyy-MM-dd");

    setIsDownloadingBranchPdf(true);
    try {
      const res = await fetch("/api/timesheet-reports/generate-branch-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: selectedBranch, startDate, endDate }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: t("timesheet.branchPdf.error") }));
        throw new Error(err.error || t("timesheet.branchPdf.error"));
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const branchName = branches.find(b => b.id === selectedBranch)?.name || selectedBranch;
      a.download = `timesheet_${branchName}_${selectedMonth}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: t("timesheet.branchPdf.success") });
    } catch (e: any) {
      toast({ title: t("common.alert"), description: e.message || t("timesheet.branchPdf.error"), variant: "destructive" });
    } finally {
      setIsDownloadingBranchPdf(false);
    }
  };

  const handleOpenSignature = (type: "employee" | "manager", report: TimesheetReport) => {
    setSignatureType(type);
    setSelectedReport(report);
    setShowSignatureDialog(true);
  };

  const handleSubmitSignature = () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast({ title: t("common.alert"), description: t("timesheet.pleaseSign"), variant: "destructive" });
      return;
    }
    
    if (!selectedReport) return;
    
    const signature = signatureRef.current.toDataURL();
    const acknowledgment = signatureType === "employee" 
      ? t("timesheet.employeeAcknowledgment")
      : t("timesheet.managerAcknowledgment");
    
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
    // Check if it's a branch employee
    if (employeeId.startsWith("branch_emp_")) {
      const branchEmployeeId = parseInt(employeeId.replace("branch_emp_", ""));
      const branchEmployee = branchEmployees.find(be => be.id === branchEmployeeId);
      if (branchEmployee) return branchEmployee.employeeName;
    }
    // Check regular users
    const employee = allUsers.find(u => u.id === employeeId);
    if (!employee) return t("timesheet.unknownEmployee");
    return `${employee.firstName || ""} ${employee.lastName || ""}`.trim() || employee.username || t("timesheet.unknownEmployee");
  }, [allUsers, branchEmployees, t]);

  const exportToExcel = async () => {
    const XLSX = await import("xlsx");
    if (!selectedReport || reportEntries.length === 0) {
      toast({ title: t("common.alert"), description: t("timesheet.noDataToExport"), variant: "destructive" });
      return;
    }

    const data = reportEntries.map(entry => ({
      [t("timesheet.date")]: entry.date,
      [t("timesheet.day")]: DAY_LABELS[entry.dayOfWeek] || entry.dayOfWeek,
      [t("timesheet.status")]: STATUS_LABELS[entry.status]?.label || entry.status,
      [t("timesheet.scheduledStart")]: entry.scheduledStartTime ?? "--",
      [t("timesheet.scheduledEnd")]: entry.scheduledEndTime ?? "--",
      [t("timesheet.actualStart")]: entry.actualStartTime ?? "--",
      [t("timesheet.actualEnd")]: entry.actualEndTime ?? "--",
      [t("timesheet.scheduledDays")]: entry.scheduledHours ?? "--",
      [t("timesheet.workHours")]: entry.actualHours ?? "--",
      [t("timesheet.lateMinutes")]: entry.lateMinutes ?? "--",
      [t("timesheet.overtimeMinutes")]: entry.overtimeMinutes ?? "--",
      [t("timesheet.signature")]: entry.checkInSignature ? t("timesheet.signed") : "--",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t("timesheet.pageTitle"));
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
        <td>${entry.scheduledStartTime ?? "--"}</td>
        <td>${entry.scheduledEndTime ?? "--"}</td>
        <td>${entry.actualStartTime ?? "--"}</td>
        <td>${entry.actualEndTime ?? "--"}</td>
        <td>${entry.actualHours != null ? entry.actualHours.toFixed(1) : "--"}</td>
        <td>${entry.lateMinutes ?? "--"}</td>
        <td>${entry.checkInSignature ? `<img src="${entry.checkInSignature}" alt="توقيع" style="max-height: 25px; max-width: 60px;" />` : "--"}</td>
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
          <h1>BUTTER BAKERY</h1>
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
              ? `<div class="signature-date">تاريخ التوقيع: ${new Date(selectedReport.employeeSignedAt).toLocaleDateString('en-GB')}</div>` 
              : ""}
          </div>
          <div class="signature-box">
            <div class="signature-title">توقيع المدير المباشر</div>
            ${selectedReport.managerSignature 
              ? `<img class="signature-img" src="${selectedReport.managerSignature}" alt="توقيع المدير" />`
              : '<div style="height: 60px; border-bottom: 1px dashed #ccc; margin: 20px 0;"></div>'}
            <div>${selectedReport.managerAcknowledgment || "أصادق على صحة بيانات حضور وانصراف الموظف"}</div>
            ${selectedReport.managerSignedAt 
              ? `<div class="signature-date">تاريخ التوقيع: ${new Date(selectedReport.managerSignedAt).toLocaleDateString('en-GB')}</div>` 
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
      <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto space-y-4" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 sm:h-8 sm:w-8"
              onClick={() => navigate("/attendance-dashboard")}
              data-testid="btn-back"
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold" data-testid="text-page-title">{t("timesheet.pageTitle")}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">{t("timesheet.pageDescription")}</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1">
            <TabsTrigger value="generate" className="gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm py-2" data-testid="tab-generate">
              <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t("timesheet.generateReport")}</span>
              <span className="sm:hidden">إنشاء</span>
            </TabsTrigger>
            <TabsTrigger value="view" className="gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm py-2" data-testid="tab-view" disabled={!selectedReport}>
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t("timesheet.viewReport")}</span>
              <span className="sm:hidden">عرض</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm py-2" data-testid="tab-history">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t("timesheet.previousRecords")}</span>
              <span className="sm:hidden">السجل</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {t("timesheet.createNewReport")}
                </CardTitle>
                <CardDescription>
                  {t("timesheet.createReportDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{t("timesheet.branch")}</Label>
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger className="h-11 sm:h-10" data-testid="select-branch" disabled={!canSelectBranch}>
                        <SelectValue placeholder={t("timesheet.selectBranch")} />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {canSelectBranch && <SelectItem value="all">{t("timesheet.allBranches")}</SelectItem>}
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("timesheet.employee")}</Label>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger className="h-11 sm:h-10" data-testid="select-employee">
                        <SelectValue placeholder={t("timesheet.selectEmployee")} />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {filteredEmployees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("timesheet.month")}</Label>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger className="h-11 sm:h-10" data-testid="select-month">
                        <SelectValue placeholder={t("timesheet.selectMonth")} />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        <SelectItem value={format(new Date(), "yyyy-MM")}>
                          {format(new Date(), "MMMM yyyy", { locale: dateLocale })}
                        </SelectItem>
                        <SelectItem value={format(subMonths(new Date(), 1), "yyyy-MM")}>
                          {format(subMonths(new Date(), 1), "MMMM yyyy", { locale: dateLocale })}
                        </SelectItem>
                        <SelectItem value={format(subMonths(new Date(), 2), "yyyy-MM")}>
                          {format(subMonths(new Date(), 2), "MMMM yyyy", { locale: dateLocale })}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  onClick={handleGenerateReport} 
                  disabled={isGenerating || !selectedEmployee}
                  className="w-full gap-2 h-11 sm:h-9"
                  data-testid="btn-generate-timesheet"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("timesheet.generating")}
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      {t("timesheet.generateBtn")}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-900">
                  <Download className="w-5 h-5" />
                  {t("timesheet.branchPdf.title")}
                </CardTitle>
                <CardDescription className="text-amber-800/80">
                  {t("timesheet.branchPdf.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleDownloadBranchPdf}
                  disabled={isDownloadingBranchPdf || !selectedBranch || selectedBranch === "all"}
                  className="w-full gap-2 h-11 sm:h-9 bg-amber-600 hover:bg-amber-700 text-white"
                  data-testid="btn-download-branch-pdf"
                >
                  {isDownloadingBranchPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("timesheet.branchPdf.generating")}
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      {t("timesheet.branchPdf.downloadBtn")}
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
                          {selectedReport.startDate} {t("common.to")} {selectedReport.endDate}
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
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div className="p-4 bg-muted rounded-lg text-center">
                        <div className="text-2xl font-bold">{selectedReport.totalScheduledDays}</div>
                        <div className="text-sm text-muted-foreground">{t("timesheet.scheduledDays")}</div>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-700">{selectedReport.totalPresentDays}</div>
                        <div className="text-sm text-green-600">{t("timesheet.presentDays")}</div>
                      </div>
                      <div className="p-4 bg-red-50 rounded-lg text-center">
                        <div className="text-2xl font-bold text-red-700">{selectedReport.totalAbsentDays}</div>
                        <div className="text-sm text-red-600">{t("timesheet.absentDays")}</div>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg text-center">
                        <div className="text-2xl font-bold text-blue-700">{selectedReport.totalActualHours?.toFixed(1) || 0}</div>
                        <div className="text-sm text-blue-600">{t("timesheet.totalWorkHours")}</div>
                      </div>
                    </div>

                    <div className="flex gap-2 mb-6">
                      <Button variant="outline" onClick={exportToExcel} className="gap-2 h-11 sm:h-9" data-testid="btn-export-excel">
                        <Download className="w-4 h-4" />
                        {t("timesheet.exportToExcel")}
                      </Button>
                      <Button variant="outline" onClick={printReport} className="gap-2 h-11 sm:h-9" data-testid="btn-print">
                        <Printer className="w-4 h-4" />
                        {t("timesheet.printReport")}
                      </Button>
                      {(selectedReport.status === "pending" || selectedReport.status === "pending_employee_signature") && (
                        <Button onClick={() => handleOpenSignature("employee", selectedReport)} className="gap-2 h-11 sm:h-9" data-testid="btn-sign-employee">
                          <Pen className="w-4 h-4" />
                          {t("timesheet.signEmployee")}
                        </Button>
                      )}
                      {selectedReport.status === "pending_manager_signature" && (
                        <Button onClick={() => handleOpenSignature("manager", selectedReport)} className="gap-2 h-11 sm:h-9" data-testid="btn-sign-manager">
                          <Pen className="w-4 h-4" />
                          {t("timesheet.signManager")}
                        </Button>
                      )}
                    </div>

                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className={isRTL ? "text-right" : "text-left"}>{t("timesheet.date")}</TableHead>
                            <TableHead className="text-center">{t("timesheet.day")}</TableHead>
                            <TableHead className="text-center">{t("timesheet.status")}</TableHead>
                            <TableHead className="text-center">{t("timesheet.scheduledStart")}</TableHead>
                            <TableHead className="text-center">{t("timesheet.scheduledEnd")}</TableHead>
                            <TableHead className="text-center">{t("timesheet.actualStart")}</TableHead>
                            <TableHead className="text-center">{t("timesheet.actualEnd")}</TableHead>
                            <TableHead className="text-center">{t("timesheet.workHours")}</TableHead>
                            <TableHead className="text-center">{t("timesheet.lateMinutes")}</TableHead>
                            <TableHead className="text-center">{t("timesheet.signature")}</TableHead>
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
                              <TableCell className="text-center">{entry.scheduledStartTime ?? "--"}</TableCell>
                              <TableCell className="text-center">{entry.scheduledEndTime ?? "--"}</TableCell>
                              <TableCell className="text-center">{entry.actualStartTime ?? "--"}</TableCell>
                              <TableCell className="text-center">{entry.actualEndTime ?? "--"}</TableCell>
                              <TableCell className="text-center">{entry.actualHours != null ? entry.actualHours.toFixed(1) : "--"}</TableCell>
                              <TableCell className="text-center">
                                {entry.lateMinutes != null && entry.lateMinutes > 0 ? (
                                  <span className="text-amber-600 font-medium">{entry.lateMinutes}</span>
                                ) : entry.lateMinutes === 0 ? "0" : "--"}
                              </TableCell>
                              <TableCell className="text-center">
                                {entry.checkInSignature ? (
                                  <img src={entry.checkInSignature} alt={t("timesheet.signature")} className="h-8 max-w-16 mx-auto object-contain" />
                                ) : "--"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Signatures Section */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">{t("timesheet.employeeSignature")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {selectedReport.employeeSignature ? (
                            <div className="space-y-2">
                              <img 
                                src={selectedReport.employeeSignature} 
                                alt={t("timesheet.employeeSignature")} 
                                className="max-h-20 border rounded p-2"
                              />
                              <p className="text-sm text-muted-foreground">{selectedReport.employeeAcknowledgment}</p>
                              {selectedReport.employeeSignedAt && (
                                <p className="text-xs text-muted-foreground">
                                  {t("timesheet.signedAt")}: {new Date(selectedReport.employeeSignedAt).toLocaleDateString(isRTL ? 'en-GB' : 'en-US')}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-muted-foreground">
                              <Pen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p>{t("timesheet.notSigned")}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">{t("timesheet.managerSignature")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {selectedReport.managerSignature ? (
                            <div className="space-y-2">
                              <img 
                                src={selectedReport.managerSignature} 
                                alt={t("timesheet.managerSignature")} 
                                className="max-h-20 border rounded p-2"
                              />
                              <p className="text-sm text-muted-foreground">{selectedReport.managerAcknowledgment}</p>
                              {selectedReport.managerSignedAt && (
                                <p className="text-xs text-muted-foreground">
                                  {t("timesheet.signedAt")}: {new Date(selectedReport.managerSignedAt).toLocaleDateString(isRTL ? 'en-GB' : 'en-US')}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-muted-foreground">
                              <Pen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p>{t("timesheet.notSigned")}</p>
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
                <CardTitle>{t("timesheet.previousRecords")}</CardTitle>
                <CardDescription>{t("timesheet.previousRecordsDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="w-[200px]" data-testid="select-history-branch" disabled={!canSelectBranch}>
                      <SelectValue placeholder={t("timesheet.selectBranch")} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      {canSelectBranch && <SelectItem value="all">{t("timesheet.allBranches")}</SelectItem>}
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
                        <TableHead className={isRTL ? "text-right" : "text-left"}>{t("timesheet.employee")}</TableHead>
                        <TableHead className="text-center">{t("timesheet.period")}</TableHead>
                        <TableHead className="text-center">{t("timesheet.status")}</TableHead>
                        <TableHead className="text-center">{t("timesheet.presentDays")}</TableHead>
                        <TableHead className="text-center">{t("common.date")}</TableHead>
                        <TableHead className="text-center">{t("common.actions")}</TableHead>
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
                            {t("timesheet.noReportsFound")}
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
                            {new Date(report.createdAt).toLocaleDateString(isRTL ? 'en-GB' : 'en-US')}
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
                              {t("timesheet.viewReport")}
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
                {signatureType === "employee" ? t("timesheet.employeeSignature") : t("timesheet.managerSignature")}
              </DialogTitle>
              <DialogDescription>
                {signatureType === "employee" 
                  ? t("timesheet.employeeAcknowledgment")
                  : t("timesheet.managerAcknowledgment")}
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
                {t("timesheet.clearSignature")}
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
                {t("timesheet.submitSignature")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
