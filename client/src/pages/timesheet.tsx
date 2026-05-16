import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PageHeader, KpiCard } from "@/components/dashboard";
import { useBranches } from "@/hooks/useBranches";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import {
  Calendar, FileText, Pen, Download, Loader2, CheckCircle, Clock,
  AlertCircle, User, Check, XCircle, LayoutDashboard, Users,
  Sparkles, Eye, FilePlus2, AlertTriangle, FileDown, Wand2, Lock, History, RefreshCw,
} from "lucide-react";
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
  // Phase 3: lock + versioning
  isLocked?: boolean;
  lockedAt?: string | null;
  lockedBy?: string | null;
  version?: number;
  supersededBy?: number | null;
  supersededAt?: string | null;
  reissueReason?: string | null;
  createdAt: string;
}

interface TimesheetAuditEntry {
  id: number;
  reportId: number;
  action: string;
  performedBy?: string | null;
  performedByName?: string | null;
  ipAddress?: string | null;
  notes?: string | null;
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

  const NOT_GENERATED_BADGE = { label: t("timesheet.dashboard.notGenerated"), color: "bg-rose-50 text-rose-700 border border-rose-200" };

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { branches, userBranchId, canSelectBranch } = useBranches();
  const { isAdmin: isCurrentUserAdmin } = useAuth();

  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureType, setSignatureType] = useState<"employee" | "manager">("employee");
  const [selectedReport, setSelectedReport] = useState<TimesheetReport | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [isDownloadingBranchPdf, setIsDownloadingBranchPdf] = useState(false);
  const [downloadingPdfFor, setDownloadingPdfFor] = useState<number | null>(null);
  const [acknowledgmentText, setAcknowledgmentText] = useState("");
  const [showAllExceptions, setShowAllExceptions] = useState(false);
  // Phase 3
  const [showReissueDialog, setShowReissueDialog] = useState(false);
  const [reissueReason, setReissueReason] = useState("");
  const [reissuingFor, setReissuingFor] = useState<TimesheetReport | null>(null);

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

  const { data: branchEmployees = [] } = useQuery<BranchEmployee[]>({
    queryKey: ["/api/branch-employees", selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch && selectedBranch !== "all") params.append("branchId", selectedBranch);
      const res = await fetch(`/api/branch-employees?${params}`);
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
  });

  const combinedEmployees = useMemo(() => [
    ...allUsers.filter(u => selectedBranch === "all" || u.branchId === selectedBranch).map(u => ({
      id: u.id,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username,
      jobTitle: u.jobTitle || '',
      branchId: u.branchId || '',
      type: 'user' as const,
    })),
    ...branchEmployees.filter(be => !be.linkedUserId && be.status === 'active').map(be => ({
      id: `branch_emp_${be.id}`,
      name: be.employeeName,
      jobTitle: be.jobTitle || '',
      branchId: be.branchId,
      type: 'branch_employee' as const,
    })),
  ], [allUsers, branchEmployees, selectedBranch]);

  const filteredEmployees = combinedEmployees;

  const { data: reports = [], isLoading: reportsLoading } = useQuery<TimesheetReport[]>({
    queryKey: ["/api/timesheet-reports", selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      const res = await fetch(`/api/timesheet-reports?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: activeTab === "history" || activeTab === "dashboard",
  });

  const { data: reportEntries = [], isLoading: entriesLoading } = useQuery<TimesheetEntry[]>({
    queryKey: ["/api/timesheet-reports", selectedReport?.id, "entries"],
    queryFn: async () => {
      if (!selectedReport) return [];
      const res = await fetch(`/api/timesheet-reports/${selectedReport.id}/entries`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedReport,
  });

  // ====== Month boundaries (for dashboard filter & bulk generation) ======
  const monthBounds = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const monthDate = new Date(y, m - 1, 1);
    return {
      startDate: format(startOfMonth(monthDate), "yyyy-MM-dd"),
      endDate: format(endOfMonth(monthDate), "yyyy-MM-dd"),
      label: format(monthDate, "MMMM yyyy", { locale: dateLocale }),
    };
  }, [selectedMonth, dateLocale]);

  // ====== Dashboard rows: combine each employee with their (optional) report for the selected month ======
  const dashboardRows = useMemo(() => {
    if (!selectedBranch || selectedBranch === "all") return [];
    const monthReports = reports.filter(r =>
      r.branchId === selectedBranch &&
      r.startDate === monthBounds.startDate &&
      r.endDate === monthBounds.endDate
    );
    // When duplicates exist for the same employee+period, keep the newest one (by createdAt)
    const reportsByEmp = new Map<string, TimesheetReport>();
    for (const r of monthReports) {
      const prev = reportsByEmp.get(r.employeeId);
      if (!prev || new Date(r.createdAt).getTime() > new Date(prev.createdAt).getTime()) {
        reportsByEmp.set(r.employeeId, r);
      }
    }

    const statusPriority = (r?: TimesheetReport) => {
      if (!r) return 0;
      if (r.status === "pending") return 1;
      if (r.status === "pending_employee_signature") return 2;
      if (r.status === "pending_manager_signature") return 3;
      return 4; // finalized
    };

    return filteredEmployees
      .map(emp => ({ ...emp, report: reportsByEmp.get(emp.id) }))
      .sort((a, b) => {
        const diff = statusPriority(a.report) - statusPriority(b.report);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name, isRTL ? 'ar' : 'en');
      });
  }, [filteredEmployees, reports, selectedBranch, monthBounds, isRTL]);

  // ====== Exceptions computed from reportEntries (Phase 2) ======
  const exceptions = useMemo(() => {
    if (!selectedReport) return { items: [], lateCount: 0, absentCount: 0, totalLate: 0, totalOvertime: 0 };
    const items: Array<{ date: string; dayOfWeek: string; type: "late" | "absent" | "overtime"; detail: string; minutes: number }> = [];
    let lateCount = 0, absentCount = 0, totalLate = 0, totalOvertime = 0;
    for (const e of reportEntries) {
      if (e.status === "absent" && !e.isOff) {
        absentCount++;
        items.push({ date: e.date, dayOfWeek: e.dayOfWeek, type: "absent", detail: t("timesheet.exceptions.absentDetail"), minutes: 0 });
      }
      if ((e.lateMinutes || 0) > 0) {
        lateCount++;
        totalLate += e.lateMinutes!;
        items.push({ date: e.date, dayOfWeek: e.dayOfWeek, type: "late", detail: t("timesheet.exceptions.lateDetail", { minutes: e.lateMinutes }), minutes: e.lateMinutes! });
      }
      if ((e.overtimeMinutes || 0) > 0) {
        totalOvertime += e.overtimeMinutes!;
        items.push({ date: e.date, dayOfWeek: e.dayOfWeek, type: "overtime", detail: t("timesheet.exceptions.overtimeDetail", { minutes: e.overtimeMinutes }), minutes: e.overtimeMinutes! });
      }
    }
    items.sort((a, b) => a.date.localeCompare(b.date));
    return { items, lateCount, absentCount, totalLate, totalOvertime };
  }, [reportEntries, selectedReport, t]);

  // ====== KPIs ======
  const kpis = useMemo(() => {
    const total = dashboardRows.length;
    let signed = 0, pendingMgr = 0, pendingEmp = 0, draft = 0, notGen = 0;
    for (const row of dashboardRows) {
      if (!row.report) { notGen++; continue; }
      switch (row.report.status) {
        case "finalized": signed++; break;
        case "pending_manager_signature": pendingMgr++; break;
        case "pending_employee_signature": pendingEmp++; break;
        case "pending":
        default: draft++; break;
      }
    }
    return { total, signed, pendingMgr, pendingEmp, draft, notGen };
  }, [dashboardRows]);

  // ====== Mutations ======
  const generateMutation = useMutation({
    mutationFn: async (data: { employeeId: string; branchId: string; startDate: string; endDate: string }) => {
      const res = await fetch("/api/timesheet-reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
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

  const bulkGenerateMutation = useMutation({
    mutationFn: async (data: { branchId: string; startDate: string; endDate: string; employeeIds: string[] }) => {
      const res = await fetch("/api/timesheet-reports/generate-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || t("timesheet.dashboard.bulkError"));
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: t("timesheet.dashboard.bulkSuccess"),
        description: t("timesheet.dashboard.bulkSuccessDesc", {
          created: data.summary?.created ?? 0,
          skipped: data.summary?.skipped ?? 0,
          failed: data.summary?.failed ?? 0,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheet-reports"] });
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
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || t("timesheet.signError"));
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: t("timesheet.signSuccess") });
      setSelectedReport(data);
      setShowSignatureDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/timesheet-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheet-reports", data.id, "audit-log"] });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  // ====== Phase 3: audit log query + reissue mutation ======
  const { data: auditLog = [] } = useQuery<TimesheetAuditEntry[]>({
    queryKey: ["/api/timesheet-reports", selectedReport?.id, "audit-log"],
    queryFn: async () => {
      if (!selectedReport) return [];
      const res = await fetch(`/api/timesheet-reports/${selectedReport.id}/audit-log`);
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: !!selectedReport,
  });

  const reissueMutation = useMutation({
    mutationFn: async (data: { id: number; reason: string }) => {
      const res = await fetch(`/api/timesheet-reports/${data.id}/reissue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: data.reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("timesheet.reissue.error"));
      }
      return res.json();
    },
    onSuccess: (data: { oldReport: TimesheetReport; newReport: TimesheetReport }) => {
      toast({ title: t("timesheet.reissue.success") });
      setShowReissueDialog(false);
      setReissueReason("");
      setReissuingFor(null);
      setSelectedReport(data.newReport);
      setActiveTab("view");
      queryClient.invalidateQueries({ queryKey: ["/api/timesheet-reports"] });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const handleOpenReissue = (report: TimesheetReport) => {
    setReissuingFor(report);
    setReissueReason("");
    setShowReissueDialog(true);
  };

  const handleConfirmReissue = () => {
    if (!reissuingFor) return;
    if (reissueReason.trim().length < 5) {
      toast({ title: t("common.alert"), description: t("timesheet.reissue.tooShortReason"), variant: "destructive" });
      return;
    }
    reissueMutation.mutate({ id: reissuingFor.id, reason: reissueReason.trim() });
  };

  // ====== Action handlers ======
  const handleGenerateForEmployee = (employeeId: string) => {
    if (!selectedBranch || selectedBranch === "all") {
      toast({ title: t("common.alert"), description: t("timesheet.selectBranchAlert"), variant: "destructive" });
      return;
    }
    setGeneratingFor(employeeId);
    generateMutation.mutate(
      { employeeId, branchId: selectedBranch, startDate: monthBounds.startDate, endDate: monthBounds.endDate },
      { onSettled: () => setGeneratingFor(null) }
    );
  };

  const handleBulkGenerate = () => {
    if (!selectedBranch || selectedBranch === "all") {
      toast({ title: t("common.alert"), description: t("timesheet.dashboard.selectBranchPrompt"), variant: "destructive" });
      return;
    }
    const missingIds = dashboardRows.filter(r => !r.report).map(r => r.id);
    if (missingIds.length === 0) {
      toast({ title: t("common.alert"), description: t("timesheet.dashboard.bulkGenerateNone") });
      return;
    }
    setIsBulkGenerating(true);
    bulkGenerateMutation.mutate(
      { branchId: selectedBranch, startDate: monthBounds.startDate, endDate: monthBounds.endDate, employeeIds: missingIds },
      { onSettled: () => setIsBulkGenerating(false) }
    );
  };

  const handleDownloadBranchPdf = async () => {
    if (!selectedBranch || selectedBranch === "all") {
      toast({ title: t("common.alert"), description: t("timesheet.branchPdf.selectBranchFirst"), variant: "destructive" });
      return;
    }

    setIsDownloadingBranchPdf(true);
    try {
      const res = await fetch("/api/timesheet-reports/generate-branch-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: selectedBranch, startDate: monthBounds.startDate, endDate: monthBounds.endDate }),
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

  // ====== Acknowledgment template generator (Phase 2) ======
  const buildAcknowledgmentTemplate = useCallback((type: "employee" | "manager", report: TimesheetReport) => {
    const lateDays = report.totalLateDays || 0;
    const absentDays = report.totalAbsentDays || 0;
    const hasIssues = lateDays > 0 || absentDays > 0;
    if (type === "employee") {
      return hasIssues
        ? t("timesheet.ackTemplates.employeeWithIssues", { lateDays, absentDays })
        : t("timesheet.ackTemplates.employeeClean");
    }
    return hasIssues
      ? t("timesheet.ackTemplates.managerWithIssues", { lateDays, absentDays })
      : t("timesheet.ackTemplates.managerClean");
  }, [t]);

  const handleOpenSignature = (type: "employee" | "manager", report: TimesheetReport) => {
    setSignatureType(type);
    setSelectedReport(report);
    setAcknowledgmentText(buildAcknowledgmentTemplate(type, report));
    setShowSignatureDialog(true);
  };

  const handleApplyAckTemplate = () => {
    if (!selectedReport) return;
    setAcknowledgmentText(buildAcknowledgmentTemplate(signatureType, selectedReport));
    toast({ title: t("timesheet.ackTemplates.templateApplied") });
  };

  const handleSubmitSignature = () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast({ title: t("common.alert"), description: t("timesheet.pleaseSign"), variant: "destructive" });
      return;
    }
    if (!selectedReport) return;
    const signature = signatureRef.current.toDataURL();
    const acknowledgment = acknowledgmentText.trim() || (signatureType === "employee"
      ? t("timesheet.employeeAcknowledgment")
      : t("timesheet.managerAcknowledgment"));
    signMutation.mutate({ id: selectedReport.id, signatureType, signature, acknowledgment });
  };

  const handleClearSignature = () => {
    signatureRef.current?.clear();
  };

  const getEmployeeName = useCallback((employeeId: string) => {
    if (employeeId.startsWith("branch_emp_")) {
      const branchEmployeeId = parseInt(employeeId.replace("branch_emp_", ""));
      const branchEmployee = branchEmployees.find(be => be.id === branchEmployeeId);
      if (branchEmployee) return branchEmployee.employeeName;
    }
    const employee = allUsers.find(u => u.id === employeeId);
    if (!employee) return t("timesheet.unknownEmployee");
    return `${employee.firstName || ""} ${employee.lastName || ""}`.trim() || employee.username || t("timesheet.unknownEmployee");
  }, [allUsers, branchEmployees, t]);

  // ====== Single Report PDF download (Phase 2) ======
  const handleDownloadSinglePdf = useCallback(async (report: TimesheetReport) => {
    setDownloadingPdfFor(report.id);
    try {
      const res = await fetch(`/api/timesheet-reports/${report.id}/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: t("timesheet.pdfError") }));
        throw new Error(err.error || t("timesheet.pdfError"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const empName = getEmployeeName(report.employeeId).replace(/\s+/g, "_");
      a.download = `timesheet_${empName}_${report.startDate}_${report.endDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: t("timesheet.pdfSuccess") });
    } catch (e: any) {
      toast({ title: t("common.alert"), description: e.message || t("timesheet.pdfError"), variant: "destructive" });
    } finally {
      setDownloadingPdfFor(null);
    }
  }, [t, toast, getEmployeeName]);

  const exportToExcel = async () => {
    const XLSX = await import("xlsx");
    if (!selectedReport || reportEntries.length === 0) {
      toast({ title: t("common.alert"), description: t("timesheet.noDataToExport"), variant: "destructive" });
      return;
    }
    const employeeName = getEmployeeName(selectedReport.employeeId);
    const branchName = branches.find(b => b.id === selectedReport.branchId)?.name || "-";

    // Sheet 1: Summary
    const summaryRows = [
      [t("timesheet.employeeName"), employeeName],
      [t("timesheet.branch"), branchName],
      [t("timesheet.period"), `${selectedReport.startDate} → ${selectedReport.endDate}`],
      [t("timesheet.reportStatus"), TIMESHEET_STATUS_LABELS[selectedReport.status]?.label || selectedReport.status],
      [],
      [t("timesheet.scheduledDays"), selectedReport.totalScheduledDays],
      [t("timesheet.presentDays"), selectedReport.totalPresentDays],
      [t("timesheet.absentDays"), selectedReport.totalAbsentDays],
      [t("timesheet.lateDays"), selectedReport.totalLateDays],
      [t("timesheet.totalWorkHours"), selectedReport.totalActualHours?.toFixed(2) || 0],
      [t("timesheet.lateMinutes"), selectedReport.totalLateMinutes],
      [t("timesheet.overtimeMinutes"), selectedReport.totalOvertimeMinutes],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);

    // Sheet 2: Daily entries
    const dailyData = reportEntries.map(entry => ({
      [t("timesheet.date")]: entry.date,
      [t("timesheet.day")]: DAY_LABELS[entry.dayOfWeek] || entry.dayOfWeek,
      [t("timesheet.status")]: STATUS_LABELS[entry.status]?.label || entry.status,
      [t("timesheet.scheduledStart")]: entry.scheduledStartTime ?? "--",
      [t("timesheet.scheduledEnd")]: entry.scheduledEndTime ?? "--",
      [t("timesheet.actualStart")]: entry.actualStartTime ?? "--",
      [t("timesheet.actualEnd")]: entry.actualEndTime ?? "--",
      [t("timesheet.workHours")]: entry.actualHours ?? "--",
      [t("timesheet.lateMinutes")]: entry.lateMinutes ?? "--",
      [t("timesheet.overtimeMinutes")]: entry.overtimeMinutes ?? "--",
      [t("timesheet.signature")]: entry.checkInSignature ? t("timesheet.signed") : "--",
    }));
    const wsDaily = XLSX.utils.json_to_sheet(dailyData);

    // Sheet 3: Exceptions
    const excTypeMap: Record<string, string> = {
      late: t("timesheet.exceptions.typeLate"),
      absent: t("timesheet.exceptions.typeAbsent"),
      overtime: t("timesheet.exceptions.typeOvertime"),
    };
    const excData = exceptions.items.length === 0
      ? [{ [t("common.message")]: t("timesheet.exceptions.empty") }]
      : exceptions.items.map(ex => ({
          [t("timesheet.date")]: ex.date,
          [t("timesheet.day")]: DAY_LABELS[ex.dayOfWeek] || ex.dayOfWeek,
          [t("common.type")]: excTypeMap[ex.type] || ex.type,
          [t("timesheet.lateMinutes")]: ex.minutes,
          [t("common.notes")]: ex.detail,
        }));
    const wsExc = XLSX.utils.json_to_sheet(excData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, t("timesheet.reportDetails"));
    XLSX.utils.book_append_sheet(wb, wsDaily, t("timesheet.dailyDetails"));
    XLSX.utils.book_append_sheet(wb, wsExc, t("timesheet.exceptions.title"));
    XLSX.writeFile(wb, `timesheet_${employeeName}_${selectedReport.startDate}_${selectedReport.endDate}.xlsx`);
  };

  // Legacy printReport kept as fallback (replaced by handleDownloadSinglePdf in Phase 2 — server-rendered Puppeteer PDF)
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
          @media print { body { padding: 0; } .no-print { display: none; } }
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
            <div class="summary-item"><div class="summary-value">${selectedReport.totalScheduledDays}</div><div>أيام العمل المقررة</div></div>
            <div class="summary-item"><div class="summary-value">${selectedReport.totalPresentDays}</div><div>أيام الحضور</div></div>
            <div class="summary-item"><div class="summary-value">${selectedReport.totalAbsentDays}</div><div>أيام الغياب</div></div>
            <div class="summary-item"><div class="summary-value">${selectedReport.totalActualHours?.toFixed(1) || 0}</div><div>إجمالي ساعات العمل</div></div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>التاريخ</th><th>اليوم</th><th>الحالة</th>
              <th>بداية الدوام</th><th>نهاية الدوام</th>
              <th>وقت الحضور</th><th>وقت الانصراف</th>
              <th>ساعات العمل</th><th>دقائق التأخير</th><th>التوقيع</th>
            </tr>
          </thead>
          <tbody>${entriesHtml}</tbody>
        </table>
        <div class="signatures">
          <div class="signature-box">
            <div class="signature-title">توقيع الموظف</div>
            ${selectedReport.employeeSignature
              ? `<img class="signature-img" src="${selectedReport.employeeSignature}" alt="توقيع الموظف" />`
              : '<div style="height: 60px; border-bottom: 1px dashed #ccc; margin: 20px 0;"></div>'}
            <div>${selectedReport.employeeAcknowledgment || "أقر بصحة بيانات الحضور والانصراف المذكورة أعلاه"}</div>
            ${selectedReport.employeeSignedAt ? `<div class="signature-date">تاريخ التوقيع: ${new Date(selectedReport.employeeSignedAt).toLocaleDateString('en-GB')}</div>` : ""}
          </div>
          <div class="signature-box">
            <div class="signature-title">توقيع المدير المباشر</div>
            ${selectedReport.managerSignature
              ? `<img class="signature-img" src="${selectedReport.managerSignature}" alt="توقيع المدير" />`
              : '<div style="height: 60px; border-bottom: 1px dashed #ccc; margin: 20px 0;"></div>'}
            <div>${selectedReport.managerAcknowledgment || "أصادق على صحة بيانات حضور وانصراف الموظف"}</div>
            ${selectedReport.managerSignedAt ? `<div class="signature-date">تاريخ التوقيع: ${new Date(selectedReport.managerSignedAt).toLocaleDateString('en-GB')}</div>` : ""}
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
      <div className="p-3 sm:p-4 md:p-6 max-w-[1400px] mx-auto space-y-4" dir={isRTL ? "rtl" : "ltr"}>
        <PageHeader
          icon={FileText}
          tone="executive"
          title={t("timesheet.pageTitle")}
          description={t("timesheet.pageDescription")}
          backHref="/attendance-dashboard"
        />

        {/* Shared Filter Bar */}
        <Card className="border-amber-100 bg-amber-50/30">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-amber-900">{t("timesheet.branch")}</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="h-11 sm:h-10 bg-white" data-testid="select-branch" disabled={!canSelectBranch}>
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
                <Label className="text-xs font-semibold text-amber-900">{t("timesheet.month")}</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="h-11 sm:h-10 bg-white" data-testid="select-month">
                    <SelectValue placeholder={t("timesheet.selectMonth")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {[0, 1, 2, 3, 4, 5].map(offset => {
                      const d = subMonths(new Date(), offset);
                      return (
                        <SelectItem key={offset} value={format(d, "yyyy-MM")}>
                          {format(d, "MMMM yyyy", { locale: dateLocale })}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-auto p-1">
            <TabsTrigger value="dashboard" className="gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm py-2" data-testid="tab-dashboard">
              <LayoutDashboard className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t("timesheet.dashboard.tabLabel")}</span>
              <span className="sm:hidden">لوحة</span>
            </TabsTrigger>
            <TabsTrigger value="view" className="gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm py-2" data-testid="tab-view" disabled={!selectedReport}>
              <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t("timesheet.viewReport")}</span>
              <span className="sm:hidden">عرض</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm py-2" data-testid="tab-history">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t("timesheet.previousRecords")}</span>
              <span className="sm:hidden">السجل</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm py-2" data-testid="tab-audit-log" disabled={!selectedReport}>
              <History className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t("timesheet.auditLog.tab")}</span>
              <span className="sm:hidden">سجل</span>
            </TabsTrigger>
          </TabsList>

          {/* ====== DASHBOARD TAB ====== */}
          <TabsContent value="dashboard" className="space-y-4">
            {(!selectedBranch || selectedBranch === "all") ? (
              <Card className="border-dashed border-2">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <LayoutDashboard className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <h3 className="font-semibold text-base mb-1" data-testid="text-select-branch-prompt">{t("timesheet.dashboard.selectBranchPrompt")}</h3>
                  <p className="text-sm">{t("timesheet.dashboard.selectBranchHint")}</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* KPIs Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <KpiCard label={t("timesheet.dashboard.kpiTotal")} value={kpis.total} icon={Users} tone="neutral" data-testid="kpi-total" />
                  <KpiCard label={t("timesheet.dashboard.kpiSigned")} value={kpis.signed} icon={CheckCircle} tone="money" data-testid="kpi-signed" />
                  <KpiCard label={t("timesheet.dashboard.kpiPendingMgr")} value={kpis.pendingMgr} icon={Clock} tone="production" data-testid="kpi-pending-mgr" />
                  <KpiCard label={t("timesheet.dashboard.kpiPendingEmp")} value={kpis.pendingEmp} icon={Pen} tone="inventory" data-testid="kpi-pending-emp" />
                  <KpiCard label={t("timesheet.dashboard.kpiDraft")} value={kpis.draft} icon={FileText} tone="neutral" data-testid="kpi-draft" />
                  <KpiCard label={t("timesheet.dashboard.kpiNotGenerated")} value={kpis.notGen} icon={AlertCircle} tone="alert" data-testid="kpi-not-generated" />
                </div>

                {/* Quick Actions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      {t("timesheet.dashboard.actionsTitle")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Button
                      onClick={handleBulkGenerate}
                      disabled={isBulkGenerating || kpis.notGen === 0}
                      className="gap-2 h-11 sm:h-10 bg-amber-600 hover:bg-amber-700 text-white"
                      data-testid="btn-bulk-generate"
                    >
                      {isBulkGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus2 className="w-4 h-4" />}
                      {isBulkGenerating ? t("timesheet.dashboard.bulkGenerating") : `${t("timesheet.dashboard.bulkGenerate")} (${kpis.notGen})`}
                    </Button>
                    <Button
                      onClick={handleDownloadBranchPdf}
                      disabled={isDownloadingBranchPdf}
                      variant="outline"
                      className="gap-2 h-11 sm:h-10 border-amber-300 text-amber-800 hover:bg-amber-50"
                      data-testid="btn-download-branch-pdf"
                    >
                      {isDownloadingBranchPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {isDownloadingBranchPdf ? t("timesheet.branchPdf.generating") : t("timesheet.branchPdf.downloadBtn")}
                    </Button>
                  </CardContent>
                </Card>

                {/* Employee Status Table */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{t("timesheet.dashboard.headline")} — {monthBounds.label}</CardTitle>
                        <CardDescription className="text-xs mt-1">{t("timesheet.dashboard.subhead")}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 sm:p-6 sm:pt-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12 text-center">#</TableHead>
                            <TableHead className={isRTL ? "text-right" : "text-left"}>{t("timesheet.dashboard.tableEmployee")}</TableHead>
                            <TableHead className="text-center">{t("timesheet.dashboard.tableStatus")}</TableHead>
                            <TableHead className="text-center">{t("timesheet.dashboard.tableDays")}</TableHead>
                            <TableHead className="text-center">{t("timesheet.dashboard.tableSignatures")}</TableHead>
                            <TableHead className="text-center">{t("timesheet.dashboard.tableActions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportsLoading ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                              </TableCell>
                            </TableRow>
                          ) : dashboardRows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                {t("timesheet.dashboard.noEmployees")}
                              </TableCell>
                            </TableRow>
                          ) : dashboardRows.map((row, idx) => {
                            const r = row.report;
                            const isMissing = !r;
                            const badge = isMissing ? NOT_GENERATED_BADGE : TIMESHEET_STATUS_LABELS[r!.status];
                            return (
                              <TableRow
                                key={row.id}
                                className={isMissing ? "bg-rose-50/30" : ""}
                                data-testid={`row-employee-${row.id}`}
                              >
                                <TableCell className="text-center text-xs text-muted-foreground">{idx + 1}</TableCell>
                                <TableCell className="font-medium">
                                  <div className="flex flex-col">
                                    <span data-testid={`text-employee-name-${row.id}`}>{row.name}</span>
                                    {row.jobTitle && <span className="text-xs text-muted-foreground">{row.jobTitle}</span>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <Badge className={badge?.color}>{badge?.label}</Badge>
                                    {r?.isLocked && (
                                      <span
                                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300"
                                        title={t("timesheet.lockedReportTooltip")}
                                        data-testid={`badge-locked-${row.id}`}
                                      >
                                        <Lock className="w-3 h-3" />
                                        {t("timesheet.locked")}
                                        {(r.version ?? 1) > 1 && <span>v{r.version}</span>}
                                      </span>
                                    )}
                                    {r?.supersededBy && (
                                      <span className="text-[10px] text-amber-700" data-testid={`badge-superseded-${row.id}`}>
                                        {t("timesheet.supersededBy")} #{r.supersededBy}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center text-sm">
                                  {r ? (
                                    <span className="font-medium">
                                      <span className="text-green-700">{r.totalPresentDays}</span>
                                      {' / '}
                                      <span className="text-muted-foreground">{r.totalScheduledDays}</span>
                                    </span>
                                  ) : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell className="text-center">
                                  {r ? (
                                    <div className="flex items-center justify-center gap-2">
                                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${r.employeeSignature ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {r.employeeSignature ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                        {t("timesheet.dashboard.sigEmployee")}
                                      </span>
                                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${r.managerSignature ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {r.managerSignature ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                        {t("timesheet.dashboard.sigManager")}
                                      </span>
                                    </div>
                                  ) : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-1 flex-wrap">
                                    {isMissing ? (
                                      <Button
                                        size="sm"
                                        variant="default"
                                        onClick={() => handleGenerateForEmployee(row.id)}
                                        disabled={generatingFor === row.id || isBulkGenerating}
                                        className="h-8 gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                                        data-testid={`btn-generate-${row.id}`}
                                      >
                                        {generatingFor === row.id
                                          ? <Loader2 className="w-3 h-3 animate-spin" />
                                          : <FilePlus2 className="w-3 h-3" />}
                                        {t("timesheet.dashboard.actionGenerate")}
                                      </Button>
                                    ) : (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => { setSelectedReport(r!); setActiveTab("view"); }}
                                          className="h-8 gap-1"
                                          data-testid={`btn-view-${row.id}`}
                                        >
                                          <Eye className="w-3 h-3" />
                                          {t("timesheet.dashboard.actionView")}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleDownloadSinglePdf(r!)}
                                          disabled={downloadingPdfFor === r!.id}
                                          className="h-8 gap-1"
                                          data-testid={`btn-pdf-${row.id}`}
                                          title={t("timesheet.downloadPdf")}
                                        >
                                          {downloadingPdfFor === r!.id
                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                            : <FileDown className="w-3 h-3" />}
                                          {t("timesheet.dashboard.actionPdf")}
                                        </Button>
                                        {(r!.status === "pending" || r!.status === "pending_employee_signature") && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleOpenSignature("employee", r!)}
                                            className="h-8 gap-1 border-amber-300 text-amber-800"
                                            data-testid={`btn-sign-employee-${row.id}`}
                                          >
                                            <Pen className="w-3 h-3" />
                                            {t("timesheet.dashboard.actionSign")}
                                          </Button>
                                        )}
                                        {r!.status === "pending_manager_signature" && !r!.isLocked && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleOpenSignature("manager", r!)}
                                            className="h-8 gap-1 border-blue-300 text-blue-800"
                                            data-testid={`btn-sign-manager-${row.id}`}
                                          >
                                            <Pen className="w-3 h-3" />
                                            {t("timesheet.dashboard.actionSign")}
                                          </Button>
                                        )}
                                        {isCurrentUserAdmin && r!.isLocked && !r!.supersededBy && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleOpenReissue(r!)}
                                            className="h-8 gap-1 border-purple-300 text-purple-800"
                                            data-testid={`btn-reissue-${row.id}`}
                                            title={t("timesheet.reissue.button")}
                                          >
                                            <RefreshCw className="w-3 h-3" />
                                            {t("timesheet.reissue.button")}
                                          </Button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ====== VIEW TAB ====== */}
          <TabsContent value="view" className="space-y-6">
            {selectedReport && (
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={TIMESHEET_STATUS_LABELS[selectedReport.status]?.color}>
                        {TIMESHEET_STATUS_LABELS[selectedReport.status]?.label}
                      </Badge>
                      {(selectedReport.version ?? 1) > 1 && (
                        <Badge variant="outline" className="border-purple-300 text-purple-700" data-testid="badge-version">
                          {t("timesheet.version")} {selectedReport.version}
                        </Badge>
                      )}
                      {selectedReport.isLocked && (
                        <Badge variant="outline" className="border-slate-400 text-slate-700 gap-1" data-testid="badge-locked">
                          <Lock className="w-3 h-3" />
                          {t("timesheet.locked")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedReport.supersededBy && (
                    <div className="mb-4 p-3 rounded border border-amber-300 bg-amber-50 text-amber-800 text-sm flex items-center gap-2" data-testid="alert-superseded">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{t("timesheet.supersededWarning")} (#{selectedReport.supersededBy})</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                    <KpiCard label={t("timesheet.scheduledDays")} value={selectedReport.totalScheduledDays} icon={Calendar} tone="neutral" data-testid="kpi-scheduled-days" />
                    <KpiCard label={t("timesheet.presentDays")} value={selectedReport.totalPresentDays} icon={CheckCircle} tone="money" data-testid="kpi-present-days" />
                    <KpiCard label={t("timesheet.absentDays")} value={selectedReport.totalAbsentDays} icon={XCircle} tone="alert" data-testid="kpi-absent-days" />
                    <KpiCard label={t("timesheet.totalWorkHours")} value={Number(selectedReport.totalActualHours?.toFixed(1) ?? 0)} icon={Clock} tone="production" data-testid="kpi-actual-hours" />
                  </div>

                  {/* ====== Exceptions Panel (Phase 2) ====== */}
                  <Card className={`mb-6 ${exceptions.items.length === 0 ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          {exceptions.items.length === 0
                            ? <CheckCircle className="w-5 h-5 text-emerald-600" />
                            : <AlertTriangle className="w-5 h-5 text-amber-600" />}
                          <CardTitle className="text-base">{t("timesheet.exceptions.title")}</CardTitle>
                          <Badge variant="outline" className={exceptions.items.length === 0 ? 'border-emerald-300 text-emerald-700' : 'border-amber-300 text-amber-700'}>
                            {exceptions.items.length}
                          </Badge>
                        </div>
                        {exceptions.items.length > 0 && (
                          <Button variant="ghost" size="sm" className="h-8" onClick={() => setShowAllExceptions(v => !v)} data-testid="btn-toggle-exceptions">
                            {showAllExceptions ? t("timesheet.exceptions.hideAll") : t("timesheet.exceptions.showAll")}
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {exceptions.items.length === 0 ? (
                        <p className="text-sm text-emerald-700" data-testid="text-no-exceptions">{t("timesheet.exceptions.empty")}</p>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                            <div className="bg-white rounded border border-amber-200 p-2 text-center">
                              <div className="text-xl font-bold text-amber-700">{exceptions.lateCount}</div>
                              <div className="text-xs text-muted-foreground">{t("timesheet.exceptions.lateCount")}</div>
                            </div>
                            <div className="bg-white rounded border border-rose-200 p-2 text-center">
                              <div className="text-xl font-bold text-rose-700">{exceptions.absentCount}</div>
                              <div className="text-xs text-muted-foreground">{t("timesheet.exceptions.absentCount")}</div>
                            </div>
                            <div className="bg-white rounded border border-amber-200 p-2 text-center">
                              <div className="text-xl font-bold text-amber-700">{exceptions.totalLate}</div>
                              <div className="text-xs text-muted-foreground">{t("timesheet.exceptions.totalLate")}</div>
                            </div>
                            <div className="bg-white rounded border border-violet-200 p-2 text-center">
                              <div className="text-xl font-bold text-violet-700">{exceptions.totalOvertime}</div>
                              <div className="text-xs text-muted-foreground">{t("timesheet.exceptions.overtimeMinutes")}</div>
                            </div>
                          </div>
                          {showAllExceptions && (
                            <div className="rounded border bg-white overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className={isRTL ? "text-right" : "text-left"}>{t("timesheet.date")}</TableHead>
                                    <TableHead className="text-center">{t("timesheet.day")}</TableHead>
                                    <TableHead className="text-center">{t("common.type")}</TableHead>
                                    <TableHead className="text-center">{t("common.notes")}</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {exceptions.items.map((ex, idx) => {
                                    const typeColor = ex.type === 'absent' ? 'bg-rose-100 text-rose-700'
                                      : ex.type === 'late' ? 'bg-amber-100 text-amber-700'
                                      : 'bg-violet-100 text-violet-700';
                                    const typeLabel = ex.type === 'absent' ? t("timesheet.exceptions.typeAbsent")
                                      : ex.type === 'late' ? t("timesheet.exceptions.typeLate")
                                      : t("timesheet.exceptions.typeOvertime");
                                    return (
                                      <TableRow key={`${ex.date}-${ex.type}-${idx}`} data-testid={`row-exception-${idx}`}>
                                        <TableCell className="font-medium">{ex.date}</TableCell>
                                        <TableCell className="text-center">{DAY_LABELS[ex.dayOfWeek] || ex.dayOfWeek}</TableCell>
                                        <TableCell className="text-center">
                                          <Badge className={typeColor}>{typeLabel}</Badge>
                                        </TableCell>
                                        <TableCell className="text-center text-sm">{ex.detail}</TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <div className="flex gap-2 mb-6 flex-wrap">
                    <Button variant="outline" onClick={exportToExcel} className="gap-2 h-11 sm:h-9" data-testid="btn-export-excel">
                      <Download className="w-4 h-4" />
                      {t("timesheet.exportToExcel")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDownloadSinglePdf(selectedReport)}
                      disabled={downloadingPdfFor === selectedReport.id}
                      className="gap-2 h-11 sm:h-9"
                      data-testid="btn-download-pdf"
                    >
                      {downloadingPdfFor === selectedReport.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                      {downloadingPdfFor === selectedReport.id ? t("timesheet.downloadingPdf") : t("timesheet.downloadPdf")}
                    </Button>
                    {(selectedReport.status === "pending" || selectedReport.status === "pending_employee_signature") && !selectedReport.isLocked && (
                      <Button onClick={() => handleOpenSignature("employee", selectedReport)} className="gap-2 h-11 sm:h-9" data-testid="btn-sign-employee">
                        <Pen className="w-4 h-4" />
                        {t("timesheet.signEmployee")}
                      </Button>
                    )}
                    {selectedReport.status === "pending_manager_signature" && !selectedReport.isLocked && (
                      <Button onClick={() => handleOpenSignature("manager", selectedReport)} className="gap-2 h-11 sm:h-9" data-testid="btn-sign-manager">
                        <Pen className="w-4 h-4" />
                        {t("timesheet.signManager")}
                      </Button>
                    )}
                    {isCurrentUserAdmin && selectedReport.isLocked && !selectedReport.supersededBy && (
                      <Button
                        variant="outline"
                        onClick={() => handleOpenReissue(selectedReport)}
                        className="gap-2 h-11 sm:h-9 border-purple-300 text-purple-800"
                        data-testid="btn-reissue"
                      >
                        <RefreshCw className="w-4 h-4" />
                        {t("timesheet.reissue.button")}
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{t("timesheet.employeeSignature")}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedReport.employeeSignature ? (
                          <div className="space-y-2">
                            <img src={selectedReport.employeeSignature} alt={t("timesheet.employeeSignature")} className="max-h-20 border rounded p-2" />
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
                            <img src={selectedReport.managerSignature} alt={t("timesheet.managerSignature")} className="max-h-20 border rounded p-2" />
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
            )}
          </TabsContent>

          {/* ====== HISTORY TAB ====== */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("timesheet.previousRecords")}</CardTitle>
                <CardDescription>{t("timesheet.previousRecordsDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
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
                              onClick={() => { setSelectedReport(report); setActiveTab("view"); }}
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

          {/* ====== Phase 3: AUDIT LOG TAB ====== */}
          <TabsContent value="audit" className="space-y-4">
            {selectedReport && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    {t("timesheet.auditLog.title")}
                  </CardTitle>
                  <CardDescription>
                    {getEmployeeName(selectedReport.employeeId)} · {selectedReport.startDate} → {selectedReport.endDate}
                    {(selectedReport.version ?? 1) > 1 && <> · {t("timesheet.version")} {selectedReport.version}</>}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {auditLog.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-audit-empty">
                      {t("timesheet.auditLog.empty")}
                    </p>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className={isRTL ? "text-right" : "text-left"}>{t("timesheet.auditLog.action")}</TableHead>
                            <TableHead>{t("timesheet.auditLog.performedBy")}</TableHead>
                            <TableHead>{t("timesheet.auditLog.date")}</TableHead>
                            <TableHead>{t("timesheet.auditLog.notes")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditLog.map((entry) => (
                            <TableRow key={entry.id} data-testid={`row-audit-${entry.id}`}>
                              <TableCell className="font-medium">
                                <Badge variant="outline" className="text-xs">
                                  {t(`timesheet.auditLog.actions.${entry.action}`, { defaultValue: entry.action })}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{entry.performedByName || entry.performedBy || "—"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {entry.createdAt ? format(new Date(entry.createdAt), "yyyy-MM-dd HH:mm") : "—"}
                              </TableCell>
                              <TableCell className="text-sm">{entry.notes || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Signature Dialog (Phase 2 - with editable acknowledgment + smart template) */}
        <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {signatureType === "employee" ? t("timesheet.employeeSignature") : t("timesheet.managerSignature")}
              </DialogTitle>
              <DialogDescription>
                {t("timesheet.signatureDialogDesc")}
              </DialogDescription>
            </DialogHeader>

            {/* Acknowledgment text - editable with template helper */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-semibold">{t("timesheet.ackTemplates.acknowledgmentText")}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApplyAckTemplate}
                  className="h-8 gap-1 border-amber-300 text-amber-800 hover:bg-amber-50"
                  data-testid="btn-use-ack-template"
                >
                  <Wand2 className="w-3 h-3" />
                  {t("timesheet.ackTemplates.useTemplate")}
                </Button>
              </div>
              <Textarea
                value={acknowledgmentText}
                onChange={(e) => setAcknowledgmentText(e.target.value)}
                placeholder={t("timesheet.ackTemplates.acknowledgmentPlaceholder")}
                rows={4}
                className="text-sm resize-none"
                data-testid="textarea-acknowledgment"
              />
              {selectedReport && (selectedReport.totalLateDays > 0 || selectedReport.totalAbsentDays > 0) && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  <span>
                    {t("timesheet.exceptions.lateCount")}: <strong>{selectedReport.totalLateDays}</strong> · {t("timesheet.exceptions.absentCount")}: <strong>{selectedReport.totalAbsentDays}</strong>
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-semibold">{t("timesheet.signature")}</Label>
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

        {/* ====== Phase 3: Reissue Dialog ====== */}
        <Dialog open={showReissueDialog} onOpenChange={(open) => { if (!reissueMutation.isPending) setShowReissueDialog(open); }}>
          <DialogContent className="max-w-lg" data-testid="dialog-reissue">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-purple-600" />
                {t("timesheet.reissue.title")}
              </DialogTitle>
              <DialogDescription>{t("timesheet.reissue.description")}</DialogDescription>
            </DialogHeader>
            {reissuingFor && (
              <div className="text-sm text-muted-foreground border rounded p-2 bg-muted/40">
                <div>{getEmployeeName(reissuingFor.employeeId)}</div>
                <div className="text-xs">{reissuingFor.startDate} → {reissuingFor.endDate} · {t("timesheet.version")} {reissuingFor.version ?? 1}</div>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t("timesheet.reissue.reasonLabel")}</Label>
              <Textarea
                value={reissueReason}
                onChange={(e) => setReissueReason(e.target.value)}
                placeholder={t("timesheet.reissue.reasonPlaceholder")}
                rows={4}
                className="text-sm resize-none"
                data-testid="textarea-reissue-reason"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowReissueDialog(false)} disabled={reissueMutation.isPending} data-testid="btn-cancel-reissue">
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleConfirmReissue}
                disabled={reissueMutation.isPending || reissueReason.trim().length < 5}
                className="gap-2"
                data-testid="btn-confirm-reissue"
              >
                {reissueMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {t("timesheet.reissue.confirmButton")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
