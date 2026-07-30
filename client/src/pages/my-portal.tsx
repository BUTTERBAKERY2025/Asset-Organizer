import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  UserCircle, CalendarDays, Wallet, Plus, Clock, CheckCircle2, XCircle, Ban,
  Briefcase, Building2, Hash, AlertTriangle, LayoutDashboard, CalendarRange,
  ClipboardCheck, ShieldAlert, FileText, ChevronLeft, ChevronRight,
  MapPin, LogIn, LogOut, Loader2, Fingerprint, Eraser, Languages, Globe, Phone,
  Bell, FileSignature, RefreshCw, Star, Gift, TrendingUp, MoreHorizontal,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  LEAVE_TYPE_LABELS,
} from "@shared/schema";
import { PortalTimesheet } from "@/components/portal-timesheet";
import { PortalWarningSigner } from "@/components/portal-warning-signer";
import { PortalAdvanceSigner } from "@/components/portal-advance-signer";
import { PortalSettlementSigner } from "@/components/portal-settlement-signer";

function fmtMoney(n: any): string {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseHmToToday(hm: any, ref: Date): Date | null {
  if (!hm || typeof hm !== "string") return null;
  const m = hm.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(ref);
  d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
  return d;
}
function addMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type Profile = {
  hasEmployee: boolean;
  employee: any | null;
  branch: { id: string; name: string } | null;
};

const STATUS_STYLE: Record<string, { cls: string; icon: any }> = {
  pending: { cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400", icon: Clock },
  approved: { cls: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400", icon: CheckCircle2 },
  rejected: { cls: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
  cancelled: { cls: "bg-muted text-muted-foreground border-border", icon: Ban },
  awaiting_signature: { cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400", icon: FileSignature },
  signed: { cls: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400", icon: CheckCircle2 },
  disbursed: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400", icon: Wallet },
};

function StatusBadge({ status, labels }: { status: string; labels: Record<string, string> }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending;
  const Icon = s.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${s.cls}`} data-testid={`badge-status-${status}`}>
      <Icon className="h-3 w-3" />
      {labels[status] || status}
    </Badge>
  );
}

function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

export default function MyPortalPage() {
  const { toast } = useToast();
  const { t, i18n } = useTranslation("portal");
  const isRTL = i18n.language !== "en";
  const dir = isRTL ? "rtl" : "ltr";
  const qc = useQueryClient();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [signAdvance, setSignAdvance] = useState<any | null>(null);
  const [signSettlement, setSignSettlement] = useState<any | null>(null);
  const [warningId, setWarningId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Refresh all portal data: refetch every /api/my/* query.
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await qc.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey?.[0];
          return typeof k === "string" && k.startsWith("/api/my");
        },
      });
    } finally {
      setRefreshing(false);
    }
  };

  // localized lookups (fall back to raw key if a translation is missing)
  const tl = (group: string, key?: string | null) =>
    key ? t(`${group}.${key}`, { defaultValue: key }) : "";
  const leaveTypeLabels: Record<string, string> = Object.keys(LEAVE_TYPE_LABELS).reduce((acc, k) => {
    acc[k] = t(`leaveTypes.${k}`, { defaultValue: k });
    return acc;
  }, {} as Record<string, string>);
  const leaveStatusLabels = (k: string) => t(`leaveStatus.${k}`, { defaultValue: k });
  const advanceStatusLabels = (k: string) => t(`advanceStatus.${k}`, { defaultValue: k });

  // بيانات مخزّنة بالعربية (الوظيفة/الجنسية) — نعرض المقابل الإنجليزي عند تفعيل الإنجليزية
  const JOB_TITLE_EN: Record<string, string> = {
    "كاشير": "Cashier", "خباز": "Baker", "مشرف": "Supervisor", "مدير فرع": "Branch Manager",
    "مدير إنتاج": "Production Manager", "مفتش جودة": "Quality Inspector", "توصيل": "Delivery",
    "نظافة": "Cleaner", "صيانة": "Maintenance", "سكرتير تنفيذي": "Executive Secretary", "أخرى": "Other",
  };
  const NATIONALITY_EN: Record<string, string> = {
    "سعودي": "Saudi", "سعودية": "Saudi", "مصري": "Egyptian", "يمني": "Yemeni", "سوري": "Syrian",
    "سوداني": "Sudanese", "باكستاني": "Pakistani", "هندي": "Indian", "بنغلاديشي": "Bangladeshi",
    "فلبيني": "Filipino", "أردني": "Jordanian", "لبناني": "Lebanese", "نيبالي": "Nepali",
    "إثيوبي": "Ethiopian", "فلسطيني": "Palestinian", "عراقي": "Iraqi", "مغربي": "Moroccan",
    "تونسي": "Tunisian", "جزائري": "Algerian", "تركي": "Turkish", "أفغاني": "Afghan",
    "إندونيسي": "Indonesian", "سريلانكي": "Sri Lankan",
  };
  const localizeData = (v?: string | null, map?: Record<string, string>) => {
    if (!v) return v;
    return (!isRTL && map && map[v.trim()]) ? map[v.trim()] : v;
  };

  const todayMonth = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);

  const [leaveForm, setLeaveForm] = useState({ leaveType: "annual", startDate: today, endDate: today, reason: "" });
  const [advForm, setAdvForm] = useState({ amount: "", requestedMonth: todayMonth, installments: "1", reason: "" });

  const { data: profile, isLoading: profileLoading } = useQuery<Profile>({
    queryKey: ["/api/my/profile"],
    queryFn: async () => (await apiRequest("GET", "/api/my/profile")).json(),
  });

  const hasEmployee = profile?.hasEmployee;
  const emp = profile?.employee;
  const displayName = (!isRTL && emp?.employeeNameEn) ? emp.employeeNameEn : emp?.employeeName;
  const photoUrl = emp?.photoUrl as string | undefined;

  const { data: leaves = [] } = useQuery<any[]>({
    queryKey: ["/api/my/leaves"],
    queryFn: async () => (await apiRequest("GET", "/api/my/leaves")).json(),
    enabled: !!hasEmployee,
  });
  const { data: leaveBalance } = useQuery<any>({
    queryKey: ["/api/my/leave-balance"],
    queryFn: async () => (await apiRequest("GET", "/api/my/leave-balance")).json(),
    enabled: !!hasEmployee,
  });

  // تصفيات الإجازات (للتوقيع والإقرار بالاستلام)
  const { data: mySettlements = [] } = useQuery<any[]>({
    queryKey: ["/api/my/leave-settlements"],
    queryFn: async () => (await apiRequest("GET", "/api/my/leave-settlements")).json(),
    enabled: !!hasEmployee,
  });

  const { data: advances = [] } = useQuery<any[]>({
    queryKey: ["/api/my/advance-requests"],
    queryFn: async () => (await apiRequest("GET", "/api/my/advance-requests")).json(),
    enabled: !!hasEmployee,
  });

  const { data: notifData } = useQuery<{ notifications: any[]; unreadCount: number }>({
    queryKey: ["/api/my/notifications"],
    queryFn: async () => (await apiRequest("GET", "/api/my/notifications")).json(),
    enabled: !!hasEmployee,
    refetchInterval: 60000,
  });
  const myNotifications = notifData?.notifications ?? [];
  const unreadNotifications = notifData?.unreadCount ?? 0;

  const markNotifRead = useMutation({
    mutationFn: async ({ id, source }: { id: number; source?: string }) =>
      (await apiRequest("POST", `/api/my/notifications/${id}/read`, { source: source || "personal" })).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/my/notifications"] }),
  });
  const markAllNotifRead = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/my/notifications/read-all")).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/my/notifications"] }),
  });

  const [notifOpen, setNotifOpen] = useState(false);
  const [schedMonth, setSchedMonth] = useState(todayMonth);
  const [attMonth, setAttMonth] = useState(todayMonth);
  const [activeTab, setActiveTab] = useState("overview");
  const tabsListRef = useRef<HTMLDivElement>(null);

  // على الجوال: التبويبات قائمة أفقية قابلة للتمرير. عند اختيار تبويب اجعله يظهر
  // في منتصف الشريط حتى لا يبقى مخفياً خارج الشاشة.
  useEffect(() => {
    const el = tabsListRef.current?.querySelector<HTMLElement>('[data-state="active"]');
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    // على الجوال: عند تبديل التبويب ارجع لأعلى الصفحة حتى لا يبدأ الموظف من منتصف محتوى قديم
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activeTab]);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: portalConfig } = useQuery<{
    showSalary: boolean; showSchedule: boolean; showAttendance: boolean;
    showLeaves: boolean; showAdvances: boolean; showWarnings: boolean;
    showDocuments: boolean; showIncentives: boolean; showEvaluations: boolean; allowSelfCheckin: boolean;
    allowLeaveRequests: boolean; allowAdvanceRequests: boolean; allowEvaluationAck: boolean;
    maxAdvanceAmount: number; defaultLanguage: string;
  }>({
    queryKey: ["/api/my/portal-config"],
    queryFn: async () => (await apiRequest("GET", "/api/my/portal-config")).json(),
    enabled: !!hasEmployee,
  });
  // Missing flags default to visible (true) so the portal stays usable before config loads.
  const cfgFlag = (v: boolean | undefined) => v !== false;
  const showSalary = !!portalConfig?.showSalary;
  const showSchedule = cfgFlag(portalConfig?.showSchedule);
  const showAttendance = cfgFlag(portalConfig?.showAttendance);
  const showLeaves = cfgFlag(portalConfig?.showLeaves);
  const showAdvances = cfgFlag(portalConfig?.showAdvances);
  const showWarnings = cfgFlag(portalConfig?.showWarnings);
  const showDocuments = cfgFlag(portalConfig?.showDocuments);
  const showEvaluations = cfgFlag(portalConfig?.showEvaluations);
  const showIncentives = cfgFlag(portalConfig?.showIncentives);
  const allowEvaluationAck = cfgFlag(portalConfig?.allowEvaluationAck);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const allowLeaveRequests = cfgFlag(portalConfig?.allowLeaveRequests);
  const allowAdvanceRequests = cfgFlag(portalConfig?.allowAdvanceRequests);
  const maxAdvanceAmount = portalConfig?.maxAdvanceAmount ?? 0;

  // Apply the admin-configured default portal language on first visit (until the
  // employee manually picks one via the toggle).
  useEffect(() => {
    const def = portalConfig?.defaultLanguage;
    if (!def || (def !== "ar" && def !== "en")) return;
    if (localStorage.getItem("portal_lang_chosen")) return;
    if (i18n.language !== def) changeLanguage(def);
  }, [portalConfig?.defaultLanguage]);

  const { data: overview } = useQuery<any>({
    queryKey: ["/api/my/overview"],
    queryFn: async () => (await apiRequest("GET", "/api/my/overview")).json(),
    enabled: !!hasEmployee,
  });

  const { data: schedule = [] } = useQuery<any[]>({
    queryKey: ["/api/my/schedule", schedMonth],
    queryFn: async () => (await apiRequest("GET", `/api/my/schedule?month=${schedMonth}`)).json(),
    enabled: !!hasEmployee && showSchedule,
  });

  const { data: attendance = [] } = useQuery<any[]>({
    queryKey: ["/api/my/attendance", attMonth],
    queryFn: async () => (await apiRequest("GET", `/api/my/attendance?month=${attMonth}`)).json(),
    enabled: !!hasEmployee && showAttendance,
  });

  const { data: warnings = [] } = useQuery<any[]>({
    queryKey: ["/api/my/warnings"],
    queryFn: async () => (await apiRequest("GET", "/api/my/warnings")).json(),
    enabled: !!hasEmployee && showWarnings,
  });

  const { data: docsData } = useQuery<{ documents: any[]; expiry: any }>({
    queryKey: ["/api/my/documents"],
    queryFn: async () => (await apiRequest("GET", "/api/my/documents")).json(),
    enabled: !!hasEmployee && showDocuments,
  });

  const { data: salary } = useQuery<any>({
    queryKey: ["/api/my/salary"],
    queryFn: async () => (await apiRequest("GET", "/api/my/salary")).json(),
    enabled: !!hasEmployee && showSalary,
  });

  // قسائم الرواتب المعتمدة (الأشهر المُقفلة)
  const { data: payslips = [] } = useQuery<any[]>({
    queryKey: ["/api/my/payslips"],
    queryFn: async () => (await apiRequest("GET", "/api/my/payslips")).json(),
    enabled: !!hasEmployee && showSalary,
  });
  const [openPayslip, setOpenPayslip] = useState<string | null>(null);

  // تقييمات الأداء المعتمدة
  const { data: myEvaluations = [] } = useQuery<any[]>({
    queryKey: ["/api/my/evaluations"],
    queryFn: async () => (await apiRequest("GET", "/api/my/evaluations")).json(),
    enabled: !!hasEmployee && showEvaluations,
  });
  // حوافزي — مكافآت الأداء الممنوحة
  const { data: myIncentives = [] } = useQuery<any[]>({
    queryKey: ["/api/my/incentives"],
    queryFn: async () => (await apiRequest("GET", "/api/my/incentives")).json(),
    enabled: !!hasEmployee && !!portalConfig && showIncentives,
  });

  const [viewEvaluation, setViewEvaluation] = useState<any | null>(null);
  const [evalAckComment, setEvalAckComment] = useState("");
  const ackEvaluationMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/my/evaluations/${id}/acknowledge`, { comment: evalAckComment || undefined });
      return res.json();
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["/api/my/evaluations"] });
      setViewEvaluation(row);
      setEvalAckComment("");
      toast({ title: "تم تسجيل اطلاعك على التقييم" });
    },
    onError: (e: any) => toast({ title: "تعذر تسجيل الإقرار", description: e.message, variant: "destructive" }),
  });

  // ---- تسجيل الحضور الذاتي / self check-in ----
  const allowSelfCheckin = !!portalConfig?.allowSelfCheckin;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const { data: todayStatus } = useQuery<any>({
    queryKey: ["/api/my/attendance/today"],
    queryFn: async () => (await apiRequest("GET", "/api/my/attendance/today")).json(),
    enabled: !!hasEmployee && allowSelfCheckin,
  });

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
    }
    setHasSignature(false);
  };

  const pointFromEvent = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const isTouch = "touches" in e;
    const cx = isTouch ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const cy = isTouch ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return { x: ((cx - rect.left) / rect.width) * canvas.width, y: ((cy - rect.top) / rect.height) * canvas.height };
  };
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    const p = pointFromEvent(e);
    ctx?.beginPath();
    ctx?.moveTo(p.x, p.y);
  };
  const moveDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    const p = pointFromEvent(e);
    ctx?.lineTo(p.x, p.y);
    ctx?.stroke();
    setHasSignature(true);
  };
  const endDraw = () => { drawing.current = false; };
  const getSignatureData = () => (hasSignature ? canvasRef.current?.toDataURL("image/png") || "" : "");

  const requestLocation = () => {
    if (!navigator.geolocation) { setGeoError(t("checkin.geoUnsupported")); return; }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoLoading(false); },
      (err) => { setGeoError(err.code === 1 ? t("checkin.geoDenied") : t("checkin.geoUnavailable")); setGeoLoading(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const resetCheckin = () => { initCanvas(); setCoords(null); setGeoError(null); };

  const checkInMut = useMutation({
    mutationFn: async () => {
      const signature = getSignatureData();
      if (!signature) throw new Error(t("checkin.signatureRequired"));
      if (!coords) throw new Error(t("checkin.locationRequired"));
      return (await apiRequest("POST", "/api/my/attendance/check-in", {
        signature, userLatitude: coords.lat, userLongitude: coords.lng,
      })).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/my/attendance/today"] });
      qc.invalidateQueries({ queryKey: ["/api/my/overview"] });
      qc.invalidateQueries({ queryKey: ["/api/my/attendance"] });
      toast({ title: t("checkin.checkInSuccess") });
      resetCheckin();
    },
    onError: (e: any) => toast({ title: t("checkin.checkInError"), description: e?.message, variant: "destructive" }),
  });

  const checkOutMut = useMutation({
    mutationFn: async () => {
      const signature = getSignatureData();
      if (!signature) throw new Error(t("checkin.signatureRequired"));
      if (!coords) throw new Error(t("checkin.locationRequired"));
      return (await apiRequest("POST", "/api/my/attendance/check-out", {
        signature, userLatitude: coords.lat, userLongitude: coords.lng,
      })).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/my/attendance/today"] });
      qc.invalidateQueries({ queryKey: ["/api/my/overview"] });
      qc.invalidateQueries({ queryKey: ["/api/my/attendance"] });
      toast({ title: t("checkin.checkOutSuccess") });
      resetCheckin();
    },
    onError: (e: any) => toast({ title: t("checkin.checkOutError"), description: e?.message, variant: "destructive" }),
  });

  useEffect(() => { initCanvas(); }, [todayStatus?.attendance?.actualCheckIn, todayStatus?.attendance?.actualCheckOut]);

  const submitLeave = useMutation({
    mutationFn: async () => {
      const totalDays = daysBetween(leaveForm.startDate, leaveForm.endDate);
      if (totalDays <= 0) throw new Error(t("leaves.invalidDates"));
      return (await apiRequest("POST", "/api/my/leaves", {
        leaveType: leaveForm.leaveType,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        totalDays,
        reason: leaveForm.reason || undefined,
      })).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/my/leaves"] });
      toast({ title: t("leaves.submitted") });
      setLeaveOpen(false);
      setLeaveForm({ leaveType: "annual", startDate: today, endDate: today, reason: "" });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e?.message || t("common.sendFailed"), variant: "destructive" }),
  });

  const cancelLeave = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/my/leaves/${id}/cancel`)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/my/leaves"] });
      toast({ title: t("leaves.cancelled") });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e?.message || t("common.cancelFailed"), variant: "destructive" }),
  });

  const submitAdvance = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(advForm.amount);
      if (!amount || amount <= 0) throw new Error(t("advances.invalidAmount"));
      if (maxAdvanceAmount > 0 && amount > maxAdvanceAmount) {
        throw new Error(t("advances.maxExceeded", { amount: maxAdvanceAmount, defaultValue: `الحد الأقصى المسموح للسلفة هو ${maxAdvanceAmount} ريال` }));
      }
      return (await apiRequest("POST", "/api/my/advance-requests", {
        amount,
        requestedMonth: advForm.requestedMonth,
        installments: parseInt(advForm.installments, 10) || 1,
        reason: advForm.reason || undefined,
      })).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/my/advance-requests"] });
      toast({ title: t("advances.submitted") });
      setAdvOpen(false);
      setAdvForm({ amount: "", requestedMonth: todayMonth, installments: "1", reason: "" });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e?.message || t("common.sendFailed"), variant: "destructive" }),
  });

  const cancelAdvance = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/my/advance-requests/${id}/cancel`)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/my/advance-requests"] });
      toast({ title: t("advances.cancelled") });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e?.message || t("common.cancelFailed"), variant: "destructive" }),
  });

  // تعريف موحد للتبويبات المفعّلة — يُستخدم في الشريط العلوي وشريط التنقل السفلي للجوال
  const enabledTabs = [
    { value: "overview", icon: LayoutDashboard, show: true },
    { value: "checkin", icon: Fingerprint, show: allowSelfCheckin },
    { value: "schedule", icon: CalendarRange, show: showSchedule },
    { value: "attendance", icon: ClipboardCheck, show: showAttendance },
    { value: "timesheet", icon: FileSignature, show: true },
    { value: "leaves", icon: CalendarDays, show: showLeaves },
    { value: "advances", icon: Wallet, show: showAdvances },
    { value: "warnings", icon: ShieldAlert, show: showWarnings },
    { value: "documents", icon: FileText, show: showDocuments },
    { value: "salary", icon: Wallet, show: showSalary },
    { value: "evaluations", icon: Star, show: showEvaluations },
    { value: "incentives", icon: Gift, show: showIncentives },
  ].filter((tb) => tb.show);
  const bottomNavMain = enabledTabs.slice(0, 4);
  const bottomNavMore = enabledTabs.slice(4);

  const pendingLeaves = leaves.filter((l) => l.status === "pending").length;
  const pendingAdvances = advances.filter((a) => a.status === "pending").length;
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;
  const currency = t("common.currency");

  return (
    <Layout>
      <div className="container mx-auto max-w-3xl p-3 sm:p-4 space-y-3 sm:space-y-4 pb-24 sm:pb-10" dir={dir} data-testid="page-my-portal">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <UserCircle className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{t("title")}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{t("subtitle")}</p>
          </div>
          {hasEmployee && (
            <Button
              variant="outline"
              size="sm"
              className="relative"
              onClick={() => setNotifOpen(true)}
              data-testid="button-notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadNotifications > 0 && (
                <span
                  className="absolute -top-1.5 -end-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center"
                  data-testid="badge-unread-count"
                >
                  {unreadNotifications}
                </span>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            data-testid="button-refresh"
            aria-label={t("refreshAria")}
          >
            <RefreshCw className={`h-4 w-4 sm:me-1 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{t("refresh")}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { localStorage.setItem("portal_lang_chosen", "1"); changeLanguage(isRTL ? "en" : "ar"); }}
            data-testid="button-toggle-language"
          >
            <Languages className="h-4 w-4 sm:me-1" />
            <span className="hidden sm:inline">{t("language")}</span>
          </Button>
        </div>

        <Dialog open={notifOpen} onOpenChange={setNotifOpen}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" dir={dir}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {t("notifications.title")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {myNotifications.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-notifications">
                  {t("notifications.empty")}
                </p>
              )}
              {myNotifications.map((n) => (
                <div
                  key={`${n.source || "personal"}-${n.id}`}
                  className={`p-3 rounded-lg border ${n.isRead ? "bg-muted/30" : "bg-primary/5 border-primary/20"}`}
                  data-testid={`notification-${n.source || "personal"}-${n.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-sm">{n.title}</div>
                    {!n.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => markNotifRead.mutate({ id: n.id, source: n.source })}
                        data-testid={`button-mark-read-${n.source || "personal"}-${n.id}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-line mt-1">{n.message}</p>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {new Date(n.createdAt).toLocaleString(isRTL ? "ar-SA" : "en-US")}
                  </div>
                </div>
              ))}
            </div>
            {unreadNotifications > 0 && (
              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllNotifRead.mutate()}
                  data-testid="button-mark-all-read"
                >
                  {t("notifications.markAllRead")}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        {profileLoading && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">{t("loading")}</CardContent></Card>
        )}

        {!profileLoading && !hasEmployee && (
          <Card>
            <CardContent className="p-8 text-center space-y-3" data-testid="state-no-employee">
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
              <h2 className="text-lg font-semibold">{t("noEmployee.title")}</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {t("noEmployee.desc")}
              </p>
            </CardContent>
          </Card>
        )}

        {!profileLoading && hasEmployee && (
          <>
            {/* بطاقة الموظف / employee card */}
            <Card>
              <CardContent className="p-4 flex flex-wrap items-center gap-x-8 gap-y-3" data-testid="card-employee">
                <div className="flex items-center gap-3">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={displayName}
                      className="h-14 w-14 rounded-full object-cover border-2 border-primary/20"
                      data-testid="img-employee-photo"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {(displayName || "?").slice(0, 1)}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-lg" data-testid="text-employee-name">{displayName}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" />{localizeData(emp?.jobTitle, JOB_TITLE_EN)}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {profile?.branch?.name && (
                    <span className="flex items-center gap-1 text-muted-foreground" data-testid="text-employee-branch"><Building2 className="h-3.5 w-3.5" />{profile.branch.name}</span>
                  )}
                  {emp?.employeeNumber && (
                    <span className="flex items-center gap-1 text-muted-foreground" data-testid="text-employee-number"><Hash className="h-3.5 w-3.5" />{emp.employeeNumber}</span>
                  )}
                  {emp?.nationality && (
                    <span className="flex items-center gap-1 text-muted-foreground" data-testid="text-employee-nationality"><Globe className="h-3.5 w-3.5" />{localizeData(emp.nationality, NATIONALITY_EN)}</span>
                  )}
                  {emp?.phoneNumber && (
                    <span className="flex items-center gap-1 text-muted-foreground" data-testid="text-employee-phone"><Phone className="h-3.5 w-3.5" />{emp.phoneNumber}</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} dir={dir}>
              <div
                ref={tabsListRef}
                className="sticky top-0 z-20 -mx-3 sm:-mx-4 px-3 sm:px-4 pt-1 pb-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/40"
              >
              <TabsList className="flex w-full h-auto justify-start gap-1.5 overflow-x-auto flex-nowrap rounded-xl bg-muted/60 p-1.5 text-[13px] sm:text-sm [&::-webkit-scrollbar]:hidden [&>button]:shrink-0 [&>button]:gap-1 [&>button]:rounded-lg [&>button]:px-3 [&>button]:py-2.5 sm:[&>button]:py-2 [&>button]:font-medium [&>button]:transition-colors [&>button]:data-[state=active]:bg-primary [&>button]:data-[state=active]:text-primary-foreground [&>button]:data-[state=active]:shadow-sm">
                <TabsTrigger value="overview" data-testid="tab-overview">
                  <LayoutDashboard className="h-4 w-4 ms-1" />{t("tabs.overview")}
                </TabsTrigger>
                {allowSelfCheckin && (
                  <TabsTrigger value="checkin" data-testid="tab-checkin">
                    <Fingerprint className="h-4 w-4 ms-1" />{t("tabs.checkin")}
                  </TabsTrigger>
                )}
                {showSchedule && (
                  <TabsTrigger value="schedule" data-testid="tab-schedule">
                    <CalendarRange className="h-4 w-4 ms-1" />{t("tabs.schedule")}
                  </TabsTrigger>
                )}
                {showAttendance && (
                  <TabsTrigger value="attendance" data-testid="tab-attendance">
                    <ClipboardCheck className="h-4 w-4 ms-1" />{t("tabs.attendance")}
                  </TabsTrigger>
                )}
                <TabsTrigger value="timesheet" data-testid="tab-timesheet">
                  <FileSignature className="h-4 w-4 ms-1" />{t("tabs.timesheet")}
                </TabsTrigger>
                {showLeaves && (
                  <TabsTrigger value="leaves" data-testid="tab-leaves">
                    <CalendarDays className="h-4 w-4 ms-1" />{t("tabs.leaves")}
                    {pendingLeaves > 0 && <Badge variant="secondary" className="ms-1">{pendingLeaves}</Badge>}
                  </TabsTrigger>
                )}
                {showAdvances && (
                  <TabsTrigger value="advances" data-testid="tab-advances">
                    <Wallet className="h-4 w-4 ms-1" />{t("tabs.advances")}
                    {pendingAdvances > 0 && <Badge variant="secondary" className="ms-1">{pendingAdvances}</Badge>}
                  </TabsTrigger>
                )}
                {showWarnings && (
                  <TabsTrigger value="warnings" data-testid="tab-warnings">
                    <ShieldAlert className="h-4 w-4 ms-1" />{t("tabs.warnings")}
                    {warnings.filter((w) => w.status === "active").length > 0 && (
                      <Badge variant="secondary" className="ms-1">{warnings.filter((w) => w.status === "active").length}</Badge>
                    )}
                  </TabsTrigger>
                )}
                {showDocuments && (
                  <TabsTrigger value="documents" data-testid="tab-documents">
                    <FileText className="h-4 w-4 ms-1" />{t("tabs.documents")}
                  </TabsTrigger>
                )}
                {showSalary && (
                  <TabsTrigger value="salary" data-testid="tab-salary">
                    <Wallet className="h-4 w-4 ms-1" />{t("tabs.salary")}
                  </TabsTrigger>
                )}
                {showEvaluations && (
                  <TabsTrigger value="evaluations" data-testid="tab-evaluations">
                    <Star className="h-4 w-4 ms-1" />{t("tabs.evaluations")}
                  </TabsTrigger>
                )}
                {showIncentives && (
                  <TabsTrigger value="incentives" data-testid="tab-incentives">
                    <Gift className="h-4 w-4 ms-1" />{t("tabs.incentives")}
                  </TabsTrigger>
                )}
              </TabsList>
              </div>

              {/* نظرة عامة / overview */}
              <TabsContent value="overview" className="space-y-3">
                {allowSelfCheckin && (() => {
                  const ci = todayStatus?.attendance?.actualCheckIn;
                  const co = todayStatus?.attendance?.actualCheckOut;
                  const done = !!co;
                  const checkedIn = !!ci && !co;
                  const sched = todayStatus?.schedule;
                  const isOff = !!sched?.isOff;
                  const branchName = todayStatus?.branch?.name || profile?.branch?.name || "";

                  const h = now.getHours();
                  const mm = now.getMinutes();
                  const period = h < 12 ? t("checkin.am") : t("checkin.pm");
                  const clockStr = `${h % 12 || 12}:${pad2(mm)}`;

                  let ciDate = parseHmToToday(ci, now);
                  if (ciDate && ciDate.getTime() > now.getTime() + 60000) {
                    // check-in time is in the future => it happened the previous day (overnight)
                    ciDate = new Date(ciDate.getTime() - 86400000);
                  }
                  const elapsedMs = ciDate ? Math.max(0, now.getTime() - ciDate.getTime()) : 0;
                  const elapsedStr = `${Math.floor(elapsedMs / 3600000)}:${pad2(Math.floor((elapsedMs % 3600000) / 60000))}:${pad2(Math.floor((elapsedMs % 60000) / 1000))}`;

                  // anchor the shift window to the check-in moment so overnight shifts compute correctly
                  const progRef = checkedIn && ciDate ? ciDate : now;
                  let startD = parseHmToToday(sched?.startTime, progRef);
                  let endD = parseHmToToday(sched?.endTime, progRef);
                  if (startD && endD) {
                    if (checkedIn && ciDate && startD.getTime() > ciDate.getTime() + 60000) {
                      // shift started before check-in (overnight) => roll start back a day
                      startD = new Date(startD.getTime() - 86400000);
                    }
                    if (endD.getTime() <= startD.getTime()) {
                      // overnight shift => end falls on the next day
                      endD = new Date(endD.getTime() + 86400000);
                    }
                  }
                  let pct = 0;
                  let remainStr = "0:00";
                  if (startD && endD && endD.getTime() > startD.getTime()) {
                    pct = Math.min(100, Math.max(0, ((now.getTime() - startD.getTime()) / (endD.getTime() - startD.getTime())) * 100));
                    const remMs = Math.max(0, endD.getTime() - now.getTime());
                    remainStr = `${Math.floor(remMs / 3600000)}:${pad2(Math.floor((remMs % 3600000) / 60000))}`;
                  }

                  const heroBg = done
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
                    : checkedIn
                    ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900"
                    : "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-900";

                  return (
                    <>
                      {checkedIn && (
                        <div className="flex items-center justify-center gap-2 rounded-xl bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-sm font-semibold px-3 py-2" data-testid="banner-checked-in">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          <span>{t("checkin.bannerCheckedIn")} {ci}</span>
                        </div>
                      )}
                      <Card className={`border ${heroBg} shadow-sm`} data-testid="card-checkin-hero">
                        <CardContent className="p-5 sm:p-6 flex flex-col items-center text-center">
                          {checkedIn ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-600/10 text-green-700 dark:text-green-400 text-xs font-bold px-3 py-1 mb-3">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />{t("checkin.onShiftNow")}
                            </span>
                          ) : (
                            <div className="text-sm text-muted-foreground mb-1">{done ? t("checkin.heroDone") : t("checkin.currentTime")}</div>
                          )}

                          {checkedIn ? (
                            <>
                              <div className="text-xs text-muted-foreground">{t("checkin.sinceCheckIn")}</div>
                              <div className="text-4xl font-extrabold tabular-nums tracking-tight text-foreground" data-testid="text-elapsed">{elapsedStr}</div>
                              <div className="text-[11px] text-muted-foreground mb-4">{t("checkin.hms")}</div>
                            </>
                          ) : !done ? (
                            <div className="mb-4">
                              <span className="text-4xl font-extrabold text-foreground" data-testid="text-clock">{clockStr}</span>
                              <span className="text-lg font-bold text-muted-foreground ms-2">{period}</span>
                            </div>
                          ) : (
                            <div className="mb-4" />
                          )}

                          {!done ? (
                            <button
                              type="button"
                              onClick={() => setActiveTab("checkin")}
                              data-testid={checkedIn ? "button-hero-check-out" : "button-hero-check-in"}
                              className={`relative h-40 w-40 rounded-full flex flex-col items-center justify-center text-white font-extrabold shadow-xl active:scale-95 transition-transform bg-gradient-to-br ${checkedIn ? "from-[#a85a3c] to-[#7c3d28]" : "from-emerald-500 to-green-600"}`}
                            >
                              {checkedIn ? <LogOut className="h-9 w-9 mb-1" /> : <Fingerprint className="h-9 w-9 mb-1" />}
                              <span className="text-base leading-tight px-2">{checkedIn ? t("checkin.doCheckOut") : t("checkin.doCheckIn")}</span>
                            </button>
                          ) : (
                            <div className="h-32 w-32 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                              <CheckCircle2 className="h-14 w-14 text-emerald-600" />
                            </div>
                          )}

                          {branchName && (
                            <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground" data-testid="text-hero-location">
                              <MapPin className="h-3.5 w-3.5" />
                              {checkedIn ? `${t("checkin.withinRange")} · ${branchName}` : `${t("checkin.locationVerified")} · ${branchName}`}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {sched && !isOff && startD && endD ? (
                        <Card data-testid="card-shift-progress">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold flex items-center gap-1.5"><CalendarRange className="h-4 w-4 text-primary" />{checkedIn ? t("checkin.shiftProgress") : t("checkin.shiftToday")}</span>
                              {checkedIn && <span className="text-sm font-bold text-primary" data-testid="text-progress-pct">{Math.round(pct)}%</span>}
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-green-500 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                              <div>
                                <div className="text-[11px] text-muted-foreground">{t("checkin.started")}</div>
                                <div className="text-sm font-bold" data-testid="text-shift-start">{sched.startTime}</div>
                              </div>
                              <div>
                                <div className="text-[11px] text-muted-foreground">{checkedIn ? t("checkin.nowLabel") : t("checkin.to")}</div>
                                <div className="text-sm font-bold">{checkedIn ? clockStr : sched.endTime}</div>
                              </div>
                              <div>
                                <div className="text-[11px] text-muted-foreground">{checkedIn ? t("checkin.remaining") : t("checkin.checkOutLabel")}</div>
                                <div className="text-sm font-bold text-amber-600" data-testid="text-shift-remaining">{checkedIn ? `${remainStr} ${t("checkin.hoursShort")}` : sched.endTime}</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ) : sched && isOff ? (
                        <Card data-testid="card-shift-progress"><CardContent className="p-4 text-center text-muted-foreground text-sm">{t("overview.dayOff")}</CardContent></Card>
                      ) : null}
                    </>
                  );
                })()}
                {overview?.alerts?.length > 0 && (
                  <div className="space-y-2">
                    {overview.alerts.map((a: any, i: number) => (
                      <Card key={i} className="border-amber-200 bg-amber-50 dark:bg-amber-950/30" data-testid={`alert-${a.type}`}>
                        <CardContent className="p-3 flex items-center gap-2 text-amber-800 dark:text-amber-400 text-sm">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>{a.type === "iqama" ? t("documents.iqamaExpiry") : a.type === "health" ? t("documents.healthExpiry") : a.label}: <span className="font-semibold">{a.date}</span></span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <Card data-testid="stat-present"><CardContent className="p-3 sm:p-4 text-center">
                    <div className="text-xl sm:text-2xl font-bold text-green-600">{overview?.attendanceSummary?.present ?? 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t("overview.present")}</div>
                  </CardContent></Card>
                  <Card data-testid="stat-late"><CardContent className="p-3 sm:p-4 text-center">
                    <div className="text-xl sm:text-2xl font-bold text-amber-600">{overview?.attendanceSummary?.late ?? 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t("overview.late")}</div>
                  </CardContent></Card>
                  <Card data-testid="stat-absent"><CardContent className="p-3 sm:p-4 text-center">
                    <div className="text-xl sm:text-2xl font-bold text-destructive">{overview?.attendanceSummary?.absent ?? 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t("overview.absent")}</div>
                  </CardContent></Card>
                  <Card data-testid="stat-onleave"><CardContent className="p-3 sm:p-4 text-center">
                    <div className="text-xl sm:text-2xl font-bold text-primary">{overview?.attendanceSummary?.onLeave ?? 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t("overview.onLeave")}</div>
                  </CardContent></Card>
                </div>
                {!allowSelfCheckin && (
                <Card data-testid="card-today-shift">
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">{t("overview.todayShift")}</div>
                    {overview?.todayShift ? (
                      overview.todayShift.isOff ? (
                        <div className="font-semibold text-muted-foreground">{t("overview.dayOff")}</div>
                      ) : (
                        <div className="font-semibold flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          {overview.todayShift.startTime} - {overview.todayShift.endTime}
                          {overview.todayShift.shiftType && (
                            <Badge variant="outline">{tl("shifts", overview.todayShift.shiftType)}</Badge>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="text-muted-foreground">{t("overview.noShift")}</div>
                    )}
                  </CardContent>
                </Card>
                )}
              </TabsContent>

              {/* تسجيل حضوري / self check-in */}
              {allowSelfCheckin && (
                <TabsContent value="checkin" className="space-y-3">
                  {todayStatus?.schedule && (
                    <Card data-testid="card-checkin-shift">
                      <CardContent className="p-4 text-sm">
                        {todayStatus.schedule.isOff ? (
                          <span className="text-muted-foreground">{t("checkin.dayOffBySchedule")}</span>
                        ) : (
                          <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />{t("checkin.todayShift")}: {todayStatus.schedule.startTime} - {todayStatus.schedule.endTime}</span>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {todayStatus?.attendance?.isOvernightFromYesterday && (
                    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30" data-testid="card-overnight-notice">
                      <CardContent className="p-3 text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0" />
                        {i18n.language === "ar"
                          ? `وردية ليلية مفتوحة منذ أمس (${todayStatus.attendance.overnightDate}) الساعة ${todayStatus.attendance.actualCheckIn} — سجّل انصرافك`
                          : `Overnight shift still open from yesterday (${todayStatus.attendance.overnightDate}) at ${todayStatus.attendance.actualCheckIn} — please check out`}
                      </CardContent>
                    </Card>
                  )}

                  {/* حالة التسجيل اليوم / today's status */}
                  <Card data-testid="card-checkin-status">
                    <CardContent className="p-4 grid grid-cols-2 gap-3 text-center">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">{t("checkin.checkInLabel")}</div>
                        {todayStatus?.attendance?.actualCheckIn ? (
                          <div className="font-bold text-green-600 flex items-center justify-center gap-1" data-testid="text-checkin-time"><CheckCircle2 className="h-4 w-4" />{todayStatus.attendance.actualCheckIn}</div>
                        ) : (
                          <div className="text-muted-foreground">—</div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">{t("checkin.checkOutLabel")}</div>
                        {todayStatus?.attendance?.actualCheckOut ? (
                          <div className="font-bold text-primary flex items-center justify-center gap-1" data-testid="text-checkout-time"><CheckCircle2 className="h-4 w-4" />{todayStatus.attendance.actualCheckOut}</div>
                        ) : (
                          <div className="text-muted-foreground">—</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {todayStatus?.attendance && todayStatus.attendance.recordedBySelf === false && (
                    <div className="text-center -mt-1">
                      <Badge variant="secondary" className="text-[11px] font-normal gap-1" data-testid="badge-recorded-by-manager">
                        <ShieldAlert className="h-3 w-3" />
                        {i18n.language === "ar" ? "سُجّل بواسطة الإدارة" : "Recorded by management"}
                      </Badge>
                    </div>
                  )}

                  {todayStatus?.branch && !todayStatus.branch.hasLocation && (
                    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
                      <CardContent className="p-3 text-sm text-amber-800 dark:text-amber-400 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />{t("checkin.noBranchLocation")}
                      </CardContent>
                    </Card>
                  )}

                  {todayStatus?.attendance?.actualCheckOut ? (
                    <Card><CardContent className="p-8 text-center text-muted-foreground" data-testid="state-checkin-complete">
                      <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                      {t("checkin.complete")}
                    </CardContent></Card>
                  ) : (
                    <Card>
                      <CardContent className="p-4 space-y-4">
                        {/* الموقع / location */}
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1"><MapPin className="h-4 w-4" />{t("checkin.yourLocation")}</Label>
                          {coords ? (
                            <div className="text-sm text-green-600 flex items-center gap-1" data-testid="text-location-ok">
                              <CheckCircle2 className="h-4 w-4" />{t("checkin.locationSet")}
                            </div>
                          ) : (
                            <Button type="button" variant="outline" onClick={requestLocation} disabled={geoLoading} data-testid="button-get-location">
                              {geoLoading ? <Loader2 className="h-4 w-4 ms-1 animate-spin" /> : <MapPin className="h-4 w-4 ms-1" />}
                              {t("checkin.getLocation")}
                            </Button>
                          )}
                          {geoError && <div className="text-sm text-destructive" data-testid="text-geo-error">{geoError}</div>}
                        </div>

                        {/* التوقيع / signature */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>{t("checkin.signature")}</Label>
                            <Button type="button" variant="ghost" size="sm" onClick={initCanvas} data-testid="button-clear-signature">
                              <Eraser className="h-4 w-4 ms-1" />{t("checkin.clear")}
                            </Button>
                          </div>
                          <canvas
                            ref={canvasRef}
                            width={600}
                            height={200}
                            className="w-full h-40 border rounded-md touch-none bg-white"
                            onMouseDown={startDraw}
                            onMouseMove={moveDraw}
                            onMouseUp={endDraw}
                            onMouseLeave={endDraw}
                            onTouchStart={startDraw}
                            onTouchMove={moveDraw}
                            onTouchEnd={endDraw}
                            data-testid="canvas-signature"
                          />
                          <p className="text-xs text-muted-foreground">{t("checkin.signHint")}</p>
                        </div>

                        {/* الأزرار / actions */}
                        <div className="flex gap-2">
                          {!todayStatus?.attendance?.actualCheckIn ? (
                            <Button
                              className="flex-1 h-16 rounded-2xl text-lg font-extrabold bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg active:scale-[0.98] transition-transform"
                              disabled={!coords || !hasSignature || checkInMut.isPending}
                              onClick={() => checkInMut.mutate()}
                              data-testid="button-check-in"
                            >
                              {checkInMut.isPending ? <Loader2 className="h-6 w-6 ms-2 animate-spin" /> : <LogIn className="h-6 w-6 ms-2" />}
                              {t("checkin.doCheckIn")}
                            </Button>
                          ) : (
                            <Button
                              className="flex-1 h-16 rounded-2xl text-lg font-extrabold bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg active:scale-[0.98] transition-transform"
                              disabled={!coords || !hasSignature || checkOutMut.isPending}
                              onClick={() => checkOutMut.mutate()}
                              data-testid="button-check-out"
                            >
                              {checkOutMut.isPending ? <Loader2 className="h-6 w-6 ms-2 animate-spin" /> : <LogOut className="h-6 w-6 ms-2" />}
                              {t("checkin.doCheckOut")}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              )}

              {/* جدولي / schedule */}
              <TabsContent value="schedule" className="space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" size="icon" onClick={() => setSchedMonth(addMonth(schedMonth, -1))} data-testid="button-sched-prev"><PrevIcon className="h-4 w-4" /></Button>
                  <span className="font-semibold tabular-nums" data-testid="text-sched-month">{schedMonth}</span>
                  <Button variant="outline" size="icon" onClick={() => setSchedMonth(addMonth(schedMonth, 1))} data-testid="button-sched-next"><NextIcon className="h-4 w-4" /></Button>
                </div>
                {schedule.length === 0 && (
                  <Card><CardContent className="p-8 text-center text-muted-foreground">{t("schedule.empty")}</CardContent></Card>
                )}
                {schedule.map((s) => (
                  <Card key={s.id} data-testid={`row-schedule-${s.id}`}>
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{s.scheduleDate}{s.dayOfWeek ? ` · ${tl("days", s.dayOfWeek)}` : ""}</div>
                        {!s.isOff && <div className="text-sm text-muted-foreground">{s.startTime} - {s.endTime}</div>}
                      </div>
                      {s.isOff ? (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">{t("schedule.off")}</Badge>
                      ) : (
                        <Badge variant="outline">{s.shiftType ? tl("shifts", s.shiftType) : t("schedule.shift")}</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* حضوري / attendance */}
              <TabsContent value="attendance" className="space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" size="icon" onClick={() => setAttMonth(addMonth(attMonth, -1))} data-testid="button-att-prev"><PrevIcon className="h-4 w-4" /></Button>
                  <span className="font-semibold tabular-nums" data-testid="text-att-month">{attMonth}</span>
                  <Button variant="outline" size="icon" onClick={() => setAttMonth(addMonth(attMonth, 1))} data-testid="button-att-next"><NextIcon className="h-4 w-4" /></Button>
                </div>
                {attendance.length === 0 && (
                  <Card><CardContent className="p-8 text-center text-muted-foreground">{t("attendance.empty")}</CardContent></Card>
                )}
                {attendance.map((a) => (
                  <Card key={a.id} data-testid={`row-attendance-${a.id}`}>
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{a.attendanceDate}</div>
                        <div className="text-sm text-muted-foreground">
                          {a.actualCheckIn ? `${t("attendance.checkIn")}: ${a.actualCheckIn}` : "—"}
                          {a.actualCheckOut ? ` · ${t("attendance.checkOut")}: ${a.actualCheckOut}` : ""}
                          {a.lateMinutes > 0 ? ` · ${t("attendance.lateMinutes", { n: a.lateMinutes })}` : ""}
                        </div>
                      </div>
                      <Badge variant="outline" className={STATUS_STYLE[a.status === "present" ? "approved" : a.status === "absent" ? "rejected" : "pending"]?.cls}>
                        {tl("attStatus", a.status)}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* تايم شيت الشهري / monthly timesheet */}
              <TabsContent value="timesheet" className="space-y-3">
                <PortalTimesheet />
              </TabsContent>

              {/* إنذاراتي / warnings */}
              <TabsContent value="warnings" className="space-y-3">
                {warnings.length === 0 && (
                  <Card><CardContent className="p-8 text-center text-muted-foreground">{t("warnings.empty")}</CardContent></Card>
                )}
                {warnings.map((w) => (
                  <Card
                    key={w.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setWarningId(w.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setWarningId(w.id); } }}
                    className="cursor-pointer transition-colors hover:border-amber-300 hover:bg-amber-50/40 dark:hover:bg-amber-950/20"
                    data-testid={`row-warning-${w.id}`}
                  >
                    <CardContent className="p-4 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold">{tl("warningLevels", w.level)}</div>
                        <Badge variant="outline" className={w.status === "active" ? STATUS_STYLE.rejected.cls : STATUS_STYLE.cancelled.cls}>
                          {w.status === "active" ? t("warnings.active") : w.status === "cancelled" ? t("warnings.cancelled") : w.status === "appealed" ? t("warnings.appealed") : t("warnings.expired")}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{w.issuedDate} · {w.reason}</div>
                      {w.description && <div className="text-xs text-muted-foreground">{w.description}</div>}
                      {w.deductionAmount > 0 && <div className="text-xs text-destructive">{t("warnings.deduction")}: {fmtMoney(w.deductionAmount)} {currency}</div>}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        {w.signedAt ? (
                          <div className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{t("warnings.signed")}</div>
                        ) : (
                          <div className="text-xs text-amber-600 flex items-center gap-1"><Clock className="h-3 w-3" />{t("warnings.awaitingSignature")}</div>
                        )}
                        <span className="text-xs font-medium text-amber-700 flex items-center gap-1">
                          <FileSignature className="h-3.5 w-3.5" />
                          {w.signedAt ? t("warnings.viewDocument", { defaultValue: "عرض المستند" }) : t("warnings.reviewAndSign", { defaultValue: "عرض وتوقيع" })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* وثائقي / documents */}
              <TabsContent value="documents" className="space-y-3">
                {docsData?.expiry && (docsData.expiry.iqamaExpiry || docsData.expiry.healthCertificateExpiry) && (
                  <Card data-testid="card-expiry">
                    <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {docsData.expiry.iqamaExpiry && (
                        <div><span className="text-muted-foreground">{t("documents.iqamaExpiry")}: </span><span className="font-semibold">{docsData.expiry.iqamaExpiry}</span></div>
                      )}
                      {docsData.expiry.healthCertificateExpiry && (
                        <div><span className="text-muted-foreground">{t("documents.healthExpiry")}: </span><span className="font-semibold">{docsData.expiry.healthCertificateExpiry}</span></div>
                      )}
                    </CardContent>
                  </Card>
                )}
                {(!docsData?.documents || docsData.documents.length === 0) && (
                  <Card><CardContent className="p-8 text-center text-muted-foreground">{t("documents.empty")}</CardContent></Card>
                )}
                {docsData?.documents?.map((d) => (
                  <Card key={d.id} data-testid={`row-document-${d.id}`}>
                    <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />{tl("docTypes", d.documentType)}</div>
                        <div className="text-sm text-muted-foreground">
                          {d.documentNumber ? `${t("documents.number")}: ${d.documentNumber}` : ""}
                          {d.expiryDate ? ` · ${t("documents.expires")}: ${d.expiryDate}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {d.fileUrl && (
                          <a href={d.fileUrl} target="_blank" rel="noreferrer" data-testid={`link-document-${d.id}`}>
                            <Button size="sm" variant="outline">{t("documents.view")}</Button>
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* راتبي / salary */}
              {showSalary && (
                <TabsContent value="salary" className="space-y-3">
                  {salary?.components ? (
                    <Card data-testid="card-salary">
                      <CardContent className="p-4 space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("salary.base")}</span><span className="font-semibold tabular-nums">{fmtMoney(salary.components.salary)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("salary.housing")}</span><span className="tabular-nums">{fmtMoney(salary.components.housingAllowance)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("salary.transport")}</span><span className="tabular-nums">{fmtMoney(salary.components.transportAllowance)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("salary.food")}</span><span className="tabular-nums">{fmtMoney(salary.components.foodAllowance)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("salary.other")}</span><span className="tabular-nums">{fmtMoney(salary.components.otherAllowances)}</span></div>
                        {salary.components.socialInsuranceDeduction > 0 && (
                          <div className="flex justify-between text-destructive"><span>{t("salary.insurance")}</span><span className="tabular-nums">-{fmtMoney(salary.components.socialInsuranceDeduction)}</span></div>
                        )}
                        {salary.totalDeductions > 0 && (
                          <div className="flex justify-between text-destructive"><span>{t("salary.monthDeductions")} ({salary.month})</span><span className="tabular-nums">-{fmtMoney(salary.totalDeductions)}</span></div>
                        )}
                        <div className="flex justify-between border-t pt-2 font-bold text-base"><span>{t("salary.total")}</span><span className="tabular-nums text-primary">{fmtMoney(salary.components.totalSalary)} {currency}</span></div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card><CardContent className="p-8 text-center text-muted-foreground">{t("loading")}</CardContent></Card>
                  )}
                  {salary?.deductions?.length > 0 && (
                    <Card>
                      <CardContent className="p-4 space-y-2">
                        <div className="font-semibold text-sm mb-2">{t("salary.deductionsTitle")} {salary.month}</div>
                        {salary.deductions.map((d: any) => (
                          <div key={d.id} className="flex justify-between text-sm" data-testid={`row-deduction-${d.id}`}>
                            <span className="text-muted-foreground">{d.description || d.type}</span>
                            <span className="tabular-nums text-destructive">-{fmtMoney(d.amount)}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* قسائم الرواتب المعتمدة — من لقطات الإقفال الشهري */}
                  {payslips.length > 0 && (
                    <Card data-testid="card-payslips">
                      <CardContent className="p-4 space-y-2">
                        <div className="font-semibold text-sm mb-2">قسائم الرواتب المعتمدة</div>
                        {payslips.map((p: any) => (
                          <div key={p.month} className="border rounded-lg" data-testid={`row-payslip-${p.month}`}>
                            <button
                              type="button"
                              className="w-full flex items-center justify-between p-3 text-sm"
                              onClick={() => setOpenPayslip(openPayslip === p.month ? null : p.month)}
                              data-testid={`button-payslip-${p.month}`}
                            >
                              <span className="font-medium">{p.month}</span>
                              <span className="tabular-nums font-bold text-primary">{fmtMoney(p.netSalary)} {currency}</span>
                            </button>
                            {openPayslip === p.month && (
                              <div className="px-3 pb-3 space-y-1.5 text-sm border-t pt-2">
                                <div className="flex justify-between"><span className="text-muted-foreground">أيام الحضور</span><span className="tabular-nums">{p.presentDays}</span></div>
                                {p.paidLeaveDays > 0 && <div className="flex justify-between"><span className="text-muted-foreground">إجازة مدفوعة</span><span className="tabular-nums">{p.paidLeaveDays}</span></div>}
                                {p.absentDays > 0 && <div className="flex justify-between"><span className="text-muted-foreground">أيام الغياب</span><span className="tabular-nums text-destructive">{p.absentDays}</span></div>}
                                <div className="flex justify-between"><span className="text-muted-foreground">الراتب الأساسي</span><span className="tabular-nums">{fmtMoney(p.baseSalary)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">البدلات</span><span className="tabular-nums">{fmtMoney(p.allowances)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">الإجمالي</span><span className="tabular-nums">{fmtMoney(p.grossSalary)}</span></div>
                                {p.absenceDeduction > 0 && <div className="flex justify-between text-destructive"><span>خصم الغياب</span><span className="tabular-nums">-{fmtMoney(p.absenceDeduction)}</span></div>}
                                {p.sickLeaveDeduction > 0 && <div className="flex justify-between text-destructive"><span>خصم إجازة مرضية</span><span className="tabular-nums">-{fmtMoney(p.sickLeaveDeduction)}</span></div>}
                                {p.socialInsurance > 0 && <div className="flex justify-between text-destructive"><span>التأمينات الاجتماعية</span><span className="tabular-nums">-{fmtMoney(p.socialInsurance)}</span></div>}
                                {p.manualDeductionsTotal > 0 && <div className="flex justify-between text-destructive"><span>خصومات أخرى</span><span className="tabular-nums">-{fmtMoney(p.manualDeductionsTotal)}</span></div>}
                                {Array.isArray(p.manualDeductions) && p.manualDeductions.map((d: any, i: number) => (
                                  <div key={i} className="flex justify-between text-xs text-muted-foreground ps-3"><span>{d.description || d.type}</span><span className="tabular-nums">-{fmtMoney(d.amount)}</span></div>
                                ))}
                                <div className="flex justify-between border-t pt-1.5 font-bold"><span>الصافي</span><span className="tabular-nums text-primary">{fmtMoney(p.netSalary)} {currency}</span></div>
                              </div>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              )}

              {/* تقييم الأداء / performance evaluations */}
              {showEvaluations && (
                <TabsContent value="evaluations" className="space-y-3">
                  {myEvaluations.length === 0 ? (
                    <Card><CardContent className="p-8 text-center text-muted-foreground text-sm" data-testid="text-no-evaluations">لا توجد تقييمات معتمدة بعد</CardContent></Card>
                  ) : myEvaluations.map((ev: any) => (
                    <Card key={ev.id} data-testid={`card-my-evaluation-${ev.id}`}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold text-sm flex items-center gap-1">
                              <Star className="h-4 w-4 text-amber-500" />
                              تقييم {ev.periodType === "quarterly" ? "ربع سنوي" : ev.periodType === "semi_annual" ? "نصف سنوي" : ev.periodType === "annual" ? "سنوي" : "فترة تجربة"}
                            </div>
                            <div className="text-xs text-muted-foreground tabular-nums">{ev.periodStart} ← {ev.periodEnd}</div>
                          </div>
                          <div className="text-end">
                            <div className={`text-xl font-bold tabular-nums ${ev.overallScore >= 4.5 ? "text-emerald-600" : ev.overallScore >= 3.5 ? "text-lime-600" : ev.overallScore >= 2.5 ? "text-amber-600" : "text-red-600"}`}>
                              {Number(ev.overallScore || 0).toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} / 5
                            </div>
                            <div className="text-[11px] text-muted-foreground">{ev.overallScore >= 4.5 ? "ممتاز" : ev.overallScore >= 3.5 ? "جيد جداً" : ev.overallScore >= 2.5 ? "جيد" : ev.overallScore >= 1.5 ? "مقبول" : "ضعيف"}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          {ev.employeeAckAt ? (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-3 w-3 ms-1" /> تم الاطلاع</Badge>
                          ) : allowEvaluationAck ? (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700">بانتظار اطلاعك</Badge>
                          ) : <span />}
                          <Button size="sm" variant="outline" onClick={() => { setViewEvaluation(ev); setEvalAckComment(""); }} data-testid={`button-view-evaluation-${ev.id}`}>
                            عرض التفاصيل
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              )}

              {/* حوافزي / incentives */}
              {showIncentives && (
                <TabsContent value="incentives" className="space-y-3">
                  {myIncentives.length === 0 ? (
                    <Card><CardContent className="p-8 text-center text-muted-foreground text-sm" data-testid="text-no-incentives">لا توجد حوافز ممنوحة بعد</CardContent></Card>
                  ) : (
                    <>
                      <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-2 font-semibold text-sm"><Gift className="h-5 w-5 text-emerald-600" /> إجمالي الحوافز المعتمدة</div>
                          <div className="text-xl font-bold tabular-nums text-emerald-600" data-testid="text-incentives-total">
                            {fmtMoney(myIncentives.filter((a: any) => a.status === "approved" || a.status === "paid").reduce((s: number, a: any) => s + (a.finalReward || 0), 0))} {currency}
                          </div>
                        </CardContent>
                      </Card>
                      {myIncentives.map((a: any) => (
                        <Card key={a.id} data-testid={`card-my-incentive-${a.id}`}>
                          <CardContent className="p-4 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="font-semibold text-sm flex items-center gap-1">
                                  <TrendingUp className="h-4 w-4 text-primary" />
                                  {a.awardType === "daily" ? "حافز يومي" : a.awardType === "monthly" ? "حافز شهري" : "حافز خاص"}
                                </div>
                                <div className="text-xs text-muted-foreground tabular-nums">{a.periodStart}{a.periodEnd && a.periodEnd !== a.periodStart ? ` ← ${a.periodEnd}` : ""}</div>
                              </div>
                              <div className="text-end">
                                <div className="text-lg font-bold tabular-nums text-primary">{fmtMoney(a.finalReward)} {currency}</div>
                                <Badge variant="secondary" className={
                                  a.status === "paid" ? "bg-emerald-100 text-emerald-700"
                                  : a.status === "approved" ? "bg-blue-100 text-blue-700"
                                  : a.status === "cancelled" ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                                }>
                                  {a.status === "paid" ? "مصروف" : a.status === "approved" ? "معتمد" : a.status === "cancelled" ? "ملغي" : "قيد المراجعة"}
                                </Badge>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground border-t pt-2">
                              <div>الهدف: <span className="tabular-nums font-medium text-foreground">{fmtMoney(a.targetAmount)}</span></div>
                              <div>المحقق: <span className="tabular-nums font-medium text-foreground">{fmtMoney(a.achievedAmount)}</span></div>
                              <div>الإنجاز: <span className="tabular-nums font-medium text-foreground">{Math.round(a.achievementPercent || 0)}%</span></div>
                            </div>
                            {a.notes && <div className="text-xs text-muted-foreground">{a.notes}</div>}
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  )}
                </TabsContent>
              )}

              {/* الإجازات / leaves */}
              <TabsContent value="leaves" className="space-y-3">
                {/* رصيد الإجازة السنوية */}
                {leaveBalance && (
                  <Card data-testid="card-leave-balance">
                    <CardContent className="p-4">
                      <div className="font-semibold text-sm flex items-center gap-1 mb-3">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        {t("leaves.balanceTitle")} <span className="text-muted-foreground font-normal">({t("leaves.balanceYear")} {leaveBalance.year})</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-muted/50 p-3">
                          <div className="text-lg font-bold tabular-nums" data-testid="text-balance-entitled">
                            {(leaveBalance.entitledDays ?? 0) + (leaveBalance.carriedOverDays ?? 0) + (leaveBalance.adjustmentDays ?? 0)}
                          </div>
                          <div className="text-xs text-muted-foreground">{t("leaves.balanceEntitled")}</div>
                        </div>
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3">
                          <div className="text-lg font-bold tabular-nums text-amber-700 dark:text-amber-400" data-testid="text-balance-used">
                            {(leaveBalance.usedDays ?? 0) + (leaveBalance.settledDays ?? 0)}
                          </div>
                          <div className="text-xs text-muted-foreground">{t("leaves.balanceUsed")}</div>
                        </div>
                        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3">
                          <div className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400" data-testid="text-balance-remaining">
                            {leaveBalance.remainingDays ?? 0}
                          </div>
                          <div className="text-xs text-muted-foreground">{t("leaves.balanceRemaining")}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {/* تصفيات الإجازات — توقيع وإقرار بالاستلام */}
                {mySettlements.length > 0 && (
                  <Card className="border-emerald-200" data-testid="card-my-settlements">
                    <CardContent className="p-4 space-y-3">
                      <div className="font-semibold text-sm flex items-center gap-1">
                        <FileSignature className="h-4 w-4 text-emerald-600" />
                        {t("settlements.title", { defaultValue: "تصفيات رصيد الإجازات" })}
                      </div>
                      {mySettlements.map((s: any) => (
                        <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-lg p-3" data-testid={`row-my-settlement-${s.id}`}>
                          <div className="space-y-0.5">
                            <div className="font-semibold tabular-nums">{fmtMoney(s.finalAmount)} {currency}</div>
                            <div className="text-xs text-muted-foreground">
                              {s.settledDays} {t("leaves.days")} × {fmtMoney(s.dailyRate)} {currency}
                              {s.leaveStart ? ` · ${s.leaveStart} → ${s.leaveEnd}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {s.workflowStatus === "awaiting_signature" && (
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => setSignSettlement(s)}
                                data-testid={`button-sign-settlement-${s.id}`}>
                                <FileSignature className="h-4 w-4 ms-1" />
                                {t("settlements.signNow", { defaultValue: "توقيع وإقرار بالاستلام" })}
                              </Button>
                            )}
                            {s.workflowStatus === "signed" && (
                              <span className="text-xs text-blue-700 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />{t("settlements.signed", { defaultValue: "وقّعت — بانتظار تحويل المبلغ" })}</span>
                            )}
                            {s.workflowStatus === "disbursed" && (
                              <span className="text-xs text-emerald-700 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />{t("settlements.disbursed", { defaultValue: "تم صرف المبلغ" })}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
                {allowLeaveRequests && (
                  <div className="flex justify-end">
                    <Button onClick={() => setLeaveOpen(true)} data-testid="button-new-leave">
                      <Plus className="h-4 w-4 ms-1" />{t("leaves.new")}
                    </Button>
                  </div>
                )}
                {leaves.length === 0 && (
                  <Card><CardContent className="p-8 text-center text-muted-foreground">{t("leaves.empty")}</CardContent></Card>
                )}
                {leaves.map((l) => (
                  <Card key={l.id} data-testid={`row-leave-${l.id}`}>
                    <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-semibold">{leaveTypeLabels[l.leaveType] || l.leaveType}</div>
                        <div className="text-sm text-muted-foreground">
                          {t("leaves.from")} {l.startDate} {t("leaves.to")} {l.endDate} · {l.totalDays} {t("leaves.days")}
                        </div>
                        {l.reason && <div className="text-xs text-muted-foreground">{l.reason}</div>}
                        {l.reviewerNote && <div className="text-xs text-muted-foreground">{t("leaves.reviewerNote")}: {l.reviewerNote}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={l.status} labels={{ pending: leaveStatusLabels("pending"), approved: leaveStatusLabels("approved"), rejected: leaveStatusLabels("rejected"), cancelled: leaveStatusLabels("cancelled") }} />
                        {l.status === "pending" && (
                          <Button size="sm" variant="ghost" className="text-destructive"
                            onClick={() => { if (confirm(t("leaves.confirmCancel"))) cancelLeave.mutate(l.id); }}
                            data-testid={`button-cancel-leave-${l.id}`}>
                            {t("leaves.cancel")}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* السلف / advances */}
              <TabsContent value="advances" className="space-y-3">
                {allowAdvanceRequests && (
                  <div className="flex items-center justify-between gap-2">
                    {maxAdvanceAmount > 0 ? (
                      <span className="text-xs text-muted-foreground" data-testid="text-max-advance">
                        {t("advances.maxHint", { amount: maxAdvanceAmount, defaultValue: `الحد الأقصى للسلفة: ${maxAdvanceAmount} ريال` })}
                      </span>
                    ) : <span />}
                    <Button onClick={() => setAdvOpen(true)} data-testid="button-new-advance">
                      <Plus className="h-4 w-4 ms-1" />{t("advances.new")}
                    </Button>
                  </div>
                )}
                {advances.length === 0 && (
                  <Card><CardContent className="p-8 text-center text-muted-foreground">{t("advances.empty")}</CardContent></Card>
                )}
                {advances.map((a) => (
                  <Card key={a.id} data-testid={`row-advance-${a.id}`}>
                    <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-semibold tabular-nums">{fmtMoney(a.approvedAmount ?? a.amount)} {currency}</div>
                        <div className="text-sm text-muted-foreground">
                          {a.installmentMonths
                            ? `${a.installmentMonths} ${t("advances.installments")} × ${fmtMoney(a.monthlyInstallment)} ${currency} · ${t("advances.deductionMonth")}: ${a.startMonth || a.requestedMonth}`
                            : `${t("advances.deductionMonth")}: ${a.requestedMonth}${a.installments > 1 ? ` · ${a.installments} ${t("advances.installments")}` : ""}`}
                        </div>
                        {a.reason && <div className="text-xs text-muted-foreground">{a.reason}</div>}
                        {a.reviewerNote && <div className="text-xs text-muted-foreground">{t("advances.reviewerNote")}: {a.reviewerNote}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={a.status} labels={{ pending: advanceStatusLabels("pending"), approved: advanceStatusLabels("approved"), rejected: advanceStatusLabels("rejected"), cancelled: advanceStatusLabels("cancelled"), paid: advanceStatusLabels("paid"), awaiting_signature: advanceStatusLabels("awaiting_signature"), signed: advanceStatusLabels("signed"), disbursed: advanceStatusLabels("disbursed") }} />
                        {a.status === "awaiting_signature" && (
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => setSignAdvance(a)}
                            data-testid={`button-sign-advance-${a.id}`}>
                            <FileSignature className="h-4 w-4 ms-1" />{t("advances.signNow", { defaultValue: "توقيع النموذج" })}
                          </Button>
                        )}
                        {(a.status === "pending" || a.status === "awaiting_signature") && (
                          <Button size="sm" variant="ghost" className="text-destructive"
                            onClick={() => { if (confirm(t("advances.confirmCancel"))) cancelAdvance.mutate(a.id); }}
                            data-testid={`button-cancel-advance-${a.id}`}>
                            {t("advances.cancel")}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>

            {/* شريط تنقل سفلي ثابت للجوال — أهم التبويبات + "المزيد" */}
            <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 pb-[env(safe-area-inset-bottom)]" data-testid="nav-mobile-bottom">
              <div className="grid grid-cols-5">
                {bottomNavMain.map((tb) => {
                  const Icon = tb.icon;
                  const active = activeTab === tb.value;
                  return (
                    <button
                      key={tb.value}
                      onClick={() => setActiveTab(tb.value)}
                      className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[11px] font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
                      data-testid={`bottomnav-${tb.value}`}
                    >
                      <Icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} />
                      <span className="truncate max-w-[64px]">{t(`tabs.${tb.value}`)}</span>
                    </button>
                  );
                })}
                {bottomNavMore.length > 0 && (
                  <button
                    onClick={() => setMoreSheetOpen(true)}
                    className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[11px] font-medium transition-colors ${bottomNavMore.some((tb) => tb.value === activeTab) ? "text-primary" : "text-muted-foreground"}`}
                    data-testid="bottomnav-more"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                    <span>{t("tabs.more", { defaultValue: "المزيد" })}</span>
                  </button>
                )}
              </div>
            </nav>

            {/* قائمة "المزيد" — بقية التبويبات */}
            <Sheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen}>
              <SheetContent side="bottom" className="rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)]" dir={dir}>
                <SheetHeader>
                  <SheetTitle className="text-start">{t("tabs.more", { defaultValue: "المزيد" })}</SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {bottomNavMore.map((tb) => {
                    const Icon = tb.icon;
                    const active = activeTab === tb.value;
                    return (
                      <button
                        key={tb.value}
                        onClick={() => { setActiveTab(tb.value); setMoreSheetOpen(false); }}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
                        data-testid={`moresheet-${tb.value}`}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="truncate w-full text-center">{t(`tabs.${tb.value}`)}</span>
                      </button>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}

        {/* توقيع نموذج السلفة الرسمي / advance signer */}
        <PortalAdvanceSigner
          advance={signAdvance}
          employeeName={displayName}
          open={signAdvance !== null}
          onOpenChange={(v) => { if (!v) setSignAdvance(null); }}
        />

        {/* توقيع تصفية الإجازة / settlement signer */}
        <PortalSettlementSigner
          settlement={signSettlement}
          employeeName={displayName}
          open={signSettlement !== null}
          onOpenChange={(v) => { if (!v) setSignSettlement(null); }}
        />

        {/* عرض وتوقيع الإنذار الرسمي / warning signer */}
        <PortalWarningSigner
          warningId={warningId}
          open={warningId !== null}
          onOpenChange={(v) => { if (!v) setWarningId(null); }}
        />

        {/* تفاصيل التقييم وإقرار الاطلاع / evaluation detail + acknowledgment */}
        <Dialog open={!!viewEvaluation} onOpenChange={(v) => { if (!v) setViewEvaluation(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir={dir}>
            {viewEvaluation && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-amber-500" /> تفاصيل تقييم الأداء</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{viewEvaluation.periodType === "quarterly" ? "ربع سنوي" : viewEvaluation.periodType === "semi_annual" ? "نصف سنوي" : viewEvaluation.periodType === "annual" ? "سنوي" : "فترة تجربة"}</span>
                    <span className="tabular-nums">{viewEvaluation.periodStart} ← {viewEvaluation.periodEnd}</span>
                  </div>
                  <div className={`text-center py-3 border rounded-lg font-bold text-2xl ${viewEvaluation.overallScore >= 4.5 ? "text-emerald-600" : viewEvaluation.overallScore >= 3.5 ? "text-lime-600" : viewEvaluation.overallScore >= 2.5 ? "text-amber-600" : "text-red-600"}`}>
                    {Number(viewEvaluation.overallScore || 0).toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} / 5
                  </div>
                  {Array.isArray(viewEvaluation.criteria) && viewEvaluation.criteria.map((c: any) => (
                    <div key={c.key} className="flex items-center justify-between border-b pb-1.5">
                      <div>
                        <div>{c.label} <span className="text-xs text-muted-foreground">({c.weight}%)</span></div>
                        {c.comment && <div className="text-xs text-muted-foreground">{c.comment}</div>}
                      </div>
                      <span className="font-bold tabular-nums">{c.score}/5</span>
                    </div>
                  ))}
                  {viewEvaluation.strengths && <div><span className="font-semibold">نقاط القوة: </span>{viewEvaluation.strengths}</div>}
                  {viewEvaluation.improvements && <div><span className="font-semibold">جوانب التحسين: </span>{viewEvaluation.improvements}</div>}
                  {viewEvaluation.goals && <div><span className="font-semibold">أهداف الفترة القادمة: </span>{viewEvaluation.goals}</div>}
                  {viewEvaluation.evaluatorName && <div className="text-xs text-muted-foreground border-t pt-2">المقيِّم: {viewEvaluation.evaluatorName}{viewEvaluation.approvedByName ? ` — اعتمده: ${viewEvaluation.approvedByName}` : ""}</div>}

                  {viewEvaluation.employeeAckAt ? (
                    <div className="border rounded-lg p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2" data-testid="text-evaluation-acked">
                      <CheckCircle2 className="h-4 w-4" /> أقررت بالاطلاع على هذا التقييم
                      {viewEvaluation.employeeAckComment && <span className="text-xs text-muted-foreground">— تعليقك: {viewEvaluation.employeeAckComment}</span>}
                    </div>
                  ) : allowEvaluationAck ? (
                    <div className="border rounded-lg p-3 space-y-2">
                      <Label className="text-sm">تعليقك على التقييم (اختياري)</Label>
                      <Textarea rows={2} value={evalAckComment} onChange={(e) => setEvalAckComment(e.target.value)} placeholder="أي ملاحظة تود إيصالها لإدارة الموارد البشرية" data-testid="textarea-evaluation-comment" />
                      <Button className="w-full" onClick={() => ackEvaluationMutation.mutate(viewEvaluation.id)} disabled={ackEvaluationMutation.isPending} data-testid="button-acknowledge-evaluation">
                        <CheckCircle2 className="h-4 w-4 ms-1" /> أقر بأنني اطلعت على هذا التقييم
                      </Button>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* نموذج طلب إجازة / leave dialog */}
        <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir={dir}>
            <DialogHeader><DialogTitle>{t("leaves.new")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("leaves.type")}</Label>
                <Select value={leaveForm.leaveType} onValueChange={(v) => setLeaveForm({ ...leaveForm, leaveType: v })}>
                  <SelectTrigger data-testid="select-leave-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(LEAVE_TYPE_LABELS).map((k) => (
                      <SelectItem key={k} value={k}>{leaveTypeLabels[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("leaves.startDate")}</Label>
                  <Input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} data-testid="input-leave-start" />
                </div>
                <div>
                  <Label>{t("leaves.endDate")}</Label>
                  <Input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} data-testid="input-leave-end" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {t("leaves.daysCount")}: <span className="font-bold text-foreground">{daysBetween(leaveForm.startDate, leaveForm.endDate)}</span>
              </div>
              <div>
                <Label>{t("leaves.reason")}</Label>
                <Textarea value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} data-testid="textarea-leave-reason" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLeaveOpen(false)}>{t("leaves.cancel")}</Button>
              <Button onClick={() => submitLeave.mutate()} disabled={submitLeave.isPending} data-testid="button-submit-leave">
                {submitLeave.isPending ? t("leaves.sending") : t("leaves.send")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* نموذج طلب سلفة / advance dialog */}
        <Dialog open={advOpen} onOpenChange={setAdvOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir={dir}>
            <DialogHeader><DialogTitle>{t("advances.new")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("advances.amount")}</Label>
                  <Input type="number" step="0.01" value={advForm.amount} onChange={(e) => setAdvForm({ ...advForm, amount: e.target.value })} data-testid="input-advance-amount" />
                </div>
                <div>
                  <Label>{t("advances.month")}</Label>
                  <Input type="month" value={advForm.requestedMonth} onChange={(e) => setAdvForm({ ...advForm, requestedMonth: e.target.value })} data-testid="input-advance-month" />
                </div>
              </div>
              <div>
                <Label>{t("advances.installmentsCount")}</Label>
                <Input type="number" min="1" value={advForm.installments} onChange={(e) => setAdvForm({ ...advForm, installments: e.target.value })} data-testid="input-advance-installments" />
              </div>
              <div>
                <Label>{t("advances.reason")}</Label>
                <Textarea value={advForm.reason} onChange={(e) => setAdvForm({ ...advForm, reason: e.target.value })} data-testid="textarea-advance-reason" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdvOpen(false)}>{t("advances.cancel")}</Button>
              <Button onClick={() => submitAdvance.mutate()} disabled={submitAdvance.isPending} data-testid="button-submit-advance">
                {submitAdvance.isPending ? t("advances.sending") : t("advances.send")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
