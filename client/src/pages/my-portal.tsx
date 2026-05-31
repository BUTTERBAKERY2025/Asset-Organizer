import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  ClipboardCheck, ShieldAlert, FileText, Award, ChevronLeft, ChevronRight,
  MapPin, LogIn, LogOut, Loader2, Fingerprint, Eraser,
} from "lucide-react";
import {
  LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS, ADVANCE_REQUEST_STATUS_LABELS,
} from "@shared/schema";

const WARNING_LEVEL_LABELS: Record<string, string> = {
  verbal: "إنذار شفهي", written_1: "إنذار كتابي أول", written_2: "إنذار كتابي ثانٍ",
  written_3: "إنذار كتابي ثالث", final: "إنذار نهائي", termination: "إنهاء خدمة",
};
const DOC_TYPE_LABELS: Record<string, string> = {
  id_card: "بطاقة هوية", residence: "إقامة", passport: "جواز سفر",
  driving_license: "رخصة قيادة", health_certificate: "شهادة صحية",
  work_permit: "رخصة عمل", contract: "عقد", other: "أخرى",
};
const ATT_STATUS_LABELS: Record<string, string> = {
  present: "حاضر", late: "متأخر", absent: "غائب", early_leave: "خروج مبكر",
  on_leave: "إجازة", pending: "بانتظار",
};
const SHIFT_LABELS: Record<string, string> = { morning: "صباحي", evening: "مسائي", night: "ليلي" };
const DAY_LABELS: Record<string, string> = {
  sat: "السبت", sun: "الأحد", mon: "الإثنين", tue: "الثلاثاء", wed: "الأربعاء", thu: "الخميس", fri: "الجمعة",
};

function fmtMoney(n: any): string {
  return Number(n || 0).toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const qc = useQueryClient();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);

  const todayMonth = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);

  const [leaveForm, setLeaveForm] = useState({ leaveType: "annual", startDate: today, endDate: today, reason: "" });
  const [advForm, setAdvForm] = useState({ amount: "", requestedMonth: todayMonth, installments: "1", reason: "" });

  const { data: profile, isLoading: profileLoading } = useQuery<Profile>({
    queryKey: ["/api/my/profile"],
    queryFn: async () => (await apiRequest("GET", "/api/my/profile")).json(),
  });

  const hasEmployee = profile?.hasEmployee;

  const { data: leaves = [] } = useQuery<any[]>({
    queryKey: ["/api/my/leaves"],
    queryFn: async () => (await apiRequest("GET", "/api/my/leaves")).json(),
    enabled: !!hasEmployee,
  });

  const { data: advances = [] } = useQuery<any[]>({
    queryKey: ["/api/my/advance-requests"],
    queryFn: async () => (await apiRequest("GET", "/api/my/advance-requests")).json(),
    enabled: !!hasEmployee,
  });

  const [schedMonth, setSchedMonth] = useState(todayMonth);
  const [attMonth, setAttMonth] = useState(todayMonth);

  const { data: portalConfig } = useQuery<{ showSalary: boolean; allowSelfCheckin: boolean }>({
    queryKey: ["/api/my/portal-config"],
    queryFn: async () => (await apiRequest("GET", "/api/my/portal-config")).json(),
    enabled: !!hasEmployee,
  });
  const showSalary = !!portalConfig?.showSalary;

  const { data: overview } = useQuery<any>({
    queryKey: ["/api/my/overview"],
    queryFn: async () => (await apiRequest("GET", "/api/my/overview")).json(),
    enabled: !!hasEmployee,
  });

  const { data: schedule = [] } = useQuery<any[]>({
    queryKey: ["/api/my/schedule", schedMonth],
    queryFn: async () => (await apiRequest("GET", `/api/my/schedule?month=${schedMonth}`)).json(),
    enabled: !!hasEmployee,
  });

  const { data: attendance = [] } = useQuery<any[]>({
    queryKey: ["/api/my/attendance", attMonth],
    queryFn: async () => (await apiRequest("GET", `/api/my/attendance?month=${attMonth}`)).json(),
    enabled: !!hasEmployee,
  });

  const { data: warnings = [] } = useQuery<any[]>({
    queryKey: ["/api/my/warnings"],
    queryFn: async () => (await apiRequest("GET", "/api/my/warnings")).json(),
    enabled: !!hasEmployee,
  });

  const { data: docsData } = useQuery<{ documents: any[]; expiry: any }>({
    queryKey: ["/api/my/documents"],
    queryFn: async () => (await apiRequest("GET", "/api/my/documents")).json(),
    enabled: !!hasEmployee,
  });

  const { data: incentives = [] } = useQuery<any[]>({
    queryKey: ["/api/my/incentives"],
    queryFn: async () => (await apiRequest("GET", "/api/my/incentives")).json(),
    enabled: !!hasEmployee,
  });

  const { data: salary } = useQuery<any>({
    queryKey: ["/api/my/salary"],
    queryFn: async () => (await apiRequest("GET", "/api/my/salary")).json(),
    enabled: !!hasEmployee && showSalary,
  });

  // ---- تسجيل الحضور الذاتي ----
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
    if (!navigator.geolocation) { setGeoError("المتصفح لا يدعم تحديد الموقع"); return; }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoLoading(false); },
      (err) => { setGeoError(err.code === 1 ? "تم رفض إذن الموقع. فعّله من إعدادات المتصفح." : "تعذّر تحديد الموقع"); setGeoLoading(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const resetCheckin = () => { initCanvas(); setCoords(null); setGeoError(null); };

  const checkInMut = useMutation({
    mutationFn: async () => {
      const signature = getSignatureData();
      if (!signature) throw new Error("التوقيع مطلوب");
      if (!coords) throw new Error("حدد موقعك أولاً");
      return (await apiRequest("POST", "/api/my/attendance/check-in", {
        signature, userLatitude: coords.lat, userLongitude: coords.lng,
      })).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/my/attendance/today"] });
      qc.invalidateQueries({ queryKey: ["/api/my/overview"] });
      qc.invalidateQueries({ queryKey: ["/api/my/attendance"] });
      toast({ title: "تم تسجيل حضورك بنجاح" });
      resetCheckin();
    },
    onError: (e: any) => toast({ title: "تعذّر تسجيل الحضور", description: e?.message, variant: "destructive" }),
  });

  const checkOutMut = useMutation({
    mutationFn: async () => {
      const signature = getSignatureData();
      if (!signature) throw new Error("التوقيع مطلوب");
      if (!coords) throw new Error("حدد موقعك أولاً");
      return (await apiRequest("POST", "/api/my/attendance/check-out", {
        signature, userLatitude: coords.lat, userLongitude: coords.lng,
      })).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/my/attendance/today"] });
      qc.invalidateQueries({ queryKey: ["/api/my/overview"] });
      qc.invalidateQueries({ queryKey: ["/api/my/attendance"] });
      toast({ title: "تم تسجيل انصرافك بنجاح" });
      resetCheckin();
    },
    onError: (e: any) => toast({ title: "تعذّر تسجيل الانصراف", description: e?.message, variant: "destructive" }),
  });

  useEffect(() => { initCanvas(); }, [todayStatus?.attendance?.actualCheckIn, todayStatus?.attendance?.actualCheckOut]);

  const submitLeave = useMutation({
    mutationFn: async () => {
      const totalDays = daysBetween(leaveForm.startDate, leaveForm.endDate);
      if (totalDays <= 0) throw new Error("تواريخ غير صحيحة");
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
      toast({ title: "تم إرسال طلب الإجازة" });
      setLeaveOpen(false);
      setLeaveForm({ leaveType: "annual", startDate: today, endDate: today, reason: "" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الإرسال", variant: "destructive" }),
  });

  const cancelLeave = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/my/leaves/${id}/cancel`)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/my/leaves"] });
      toast({ title: "تم إلغاء الطلب" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الإلغاء", variant: "destructive" }),
  });

  const submitAdvance = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(advForm.amount);
      if (!amount || amount <= 0) throw new Error("أدخل مبلغاً صحيحاً");
      return (await apiRequest("POST", "/api/my/advance-requests", {
        amount,
        requestedMonth: advForm.requestedMonth,
        installments: parseInt(advForm.installments, 10) || 1,
        reason: advForm.reason || undefined,
      })).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/my/advance-requests"] });
      toast({ title: "تم إرسال طلب السلفة" });
      setAdvOpen(false);
      setAdvForm({ amount: "", requestedMonth: todayMonth, installments: "1", reason: "" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الإرسال", variant: "destructive" }),
  });

  const cancelAdvance = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/my/advance-requests/${id}/cancel`)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/my/advance-requests"] });
      toast({ title: "تم إلغاء الطلب" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الإلغاء", variant: "destructive" }),
  });

  const pendingLeaves = leaves.filter((l) => l.status === "pending").length;
  const pendingAdvances = advances.filter((a) => a.status === "pending").length;

  return (
    <Layout>
      <div className="container mx-auto p-4 space-y-4" dir="rtl" data-testid="page-my-portal">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <UserCircle className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">بوابتي</h1>
            <p className="text-sm text-muted-foreground">قدّم طلباتك وتابع حالتها</p>
          </div>
        </div>

        {profileLoading && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">جاري التحميل...</CardContent></Card>
        )}

        {!profileLoading && !hasEmployee && (
          <Card>
            <CardContent className="p-8 text-center space-y-3" data-testid="state-no-employee">
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
              <h2 className="text-lg font-semibold">حسابك غير مرتبط بملف موظف</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                لاستخدام بوابة الموظف، يجب ربط حسابك بملفك الوظيفي. الرجاء التواصل مع إدارة الموارد البشرية.
              </p>
            </CardContent>
          </Card>
        )}

        {!profileLoading && hasEmployee && (
          <>
            {/* بطاقة الموظف */}
            <Card>
              <CardContent className="p-4 flex flex-wrap items-center gap-x-8 gap-y-3" data-testid="card-employee">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {(profile?.employee?.employeeName || "؟").slice(0, 1)}
                  </div>
                  <div>
                    <div className="font-bold text-lg" data-testid="text-employee-name">{profile?.employee?.employeeName}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" />{profile?.employee?.jobTitle}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {profile?.branch?.name && (
                    <span className="flex items-center gap-1 text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{profile.branch.name}</span>
                  )}
                  {profile?.employee?.employeeNumber && (
                    <span className="flex items-center gap-1 text-muted-foreground"><Hash className="h-3.5 w-3.5" />{profile.employee.employeeNumber}</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="overview" dir="rtl">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="overview" data-testid="tab-overview">
                  <LayoutDashboard className="h-4 w-4 ms-1" />نظرة عامة
                </TabsTrigger>
                {allowSelfCheckin && (
                  <TabsTrigger value="checkin" data-testid="tab-checkin">
                    <Fingerprint className="h-4 w-4 ms-1" />تسجيل حضوري
                  </TabsTrigger>
                )}
                <TabsTrigger value="schedule" data-testid="tab-schedule">
                  <CalendarRange className="h-4 w-4 ms-1" />جدولي
                </TabsTrigger>
                <TabsTrigger value="attendance" data-testid="tab-attendance">
                  <ClipboardCheck className="h-4 w-4 ms-1" />حضوري
                </TabsTrigger>
                <TabsTrigger value="leaves" data-testid="tab-leaves">
                  <CalendarDays className="h-4 w-4 ms-1" />إجازاتي
                  {pendingLeaves > 0 && <Badge variant="secondary" className="ms-1">{pendingLeaves}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="advances" data-testid="tab-advances">
                  <Wallet className="h-4 w-4 ms-1" />سلفي
                  {pendingAdvances > 0 && <Badge variant="secondary" className="ms-1">{pendingAdvances}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="warnings" data-testid="tab-warnings">
                  <ShieldAlert className="h-4 w-4 ms-1" />إنذاراتي
                  {warnings.filter((w) => w.status === "active").length > 0 && (
                    <Badge variant="secondary" className="ms-1">{warnings.filter((w) => w.status === "active").length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="documents" data-testid="tab-documents">
                  <FileText className="h-4 w-4 ms-1" />وثائقي
                </TabsTrigger>
                <TabsTrigger value="incentives" data-testid="tab-incentives">
                  <Award className="h-4 w-4 ms-1" />حوافزي
                </TabsTrigger>
                {showSalary && (
                  <TabsTrigger value="salary" data-testid="tab-salary">
                    <Wallet className="h-4 w-4 ms-1" />راتبي
                  </TabsTrigger>
                )}
              </TabsList>

              {/* نظرة عامة */}
              <TabsContent value="overview" className="space-y-3">
                {overview?.alerts?.length > 0 && (
                  <div className="space-y-2">
                    {overview.alerts.map((a: any, i: number) => (
                      <Card key={i} className="border-amber-200 bg-amber-50 dark:bg-amber-950/30" data-testid={`alert-${a.type}`}>
                        <CardContent className="p-3 flex items-center gap-2 text-amber-800 dark:text-amber-400 text-sm">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>{a.label}: <span className="font-semibold">{a.date}</span></span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card data-testid="stat-present"><CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{overview?.attendanceSummary?.present ?? 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">أيام الحضور</div>
                  </CardContent></Card>
                  <Card data-testid="stat-late"><CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-amber-600">{overview?.attendanceSummary?.late ?? 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">أيام التأخير</div>
                  </CardContent></Card>
                  <Card data-testid="stat-absent"><CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-destructive">{overview?.attendanceSummary?.absent ?? 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">أيام الغياب</div>
                  </CardContent></Card>
                  <Card data-testid="stat-onleave"><CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">{overview?.attendanceSummary?.onLeave ?? 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">أيام الإجازات</div>
                  </CardContent></Card>
                </div>
                <Card data-testid="card-today-shift">
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">دوام اليوم</div>
                    {overview?.todayShift ? (
                      overview.todayShift.isOff ? (
                        <div className="font-semibold text-muted-foreground">يوم راحة</div>
                      ) : (
                        <div className="font-semibold flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          {overview.todayShift.startTime} - {overview.todayShift.endTime}
                          {overview.todayShift.shiftType && (
                            <Badge variant="outline">{SHIFT_LABELS[overview.todayShift.shiftType] || overview.todayShift.shiftType}</Badge>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="text-muted-foreground">لا يوجد دوام مجدول لليوم</div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* تسجيل حضوري */}
              {allowSelfCheckin && (
                <TabsContent value="checkin" className="space-y-3">
                  {todayStatus?.schedule && (
                    <Card data-testid="card-checkin-shift">
                      <CardContent className="p-4 text-sm">
                        {todayStatus.schedule.isOff ? (
                          <span className="text-muted-foreground">اليوم يوم راحة حسب الجدول</span>
                        ) : (
                          <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />دوام اليوم: {todayStatus.schedule.startTime} - {todayStatus.schedule.endTime}</span>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* حالة التسجيل اليوم */}
                  <Card data-testid="card-checkin-status">
                    <CardContent className="p-4 grid grid-cols-2 gap-3 text-center">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">الحضور</div>
                        {todayStatus?.attendance?.actualCheckIn ? (
                          <div className="font-bold text-green-600 flex items-center justify-center gap-1" data-testid="text-checkin-time"><CheckCircle2 className="h-4 w-4" />{todayStatus.attendance.actualCheckIn}</div>
                        ) : (
                          <div className="text-muted-foreground">—</div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">الانصراف</div>
                        {todayStatus?.attendance?.actualCheckOut ? (
                          <div className="font-bold text-primary flex items-center justify-center gap-1" data-testid="text-checkout-time"><CheckCircle2 className="h-4 w-4" />{todayStatus.attendance.actualCheckOut}</div>
                        ) : (
                          <div className="text-muted-foreground">—</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {todayStatus?.branch && !todayStatus.branch.hasLocation && (
                    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
                      <CardContent className="p-3 text-sm text-amber-800 dark:text-amber-400 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />لم يتم تحديد موقع الفرع. تواصل مع الإدارة لتفعيل التسجيل الذاتي.
                      </CardContent>
                    </Card>
                  )}

                  {todayStatus?.attendance?.actualCheckOut ? (
                    <Card><CardContent className="p-8 text-center text-muted-foreground" data-testid="state-checkin-complete">
                      <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                      اكتمل تسجيل حضورك وانصرافك لهذا اليوم
                    </CardContent></Card>
                  ) : (
                    <Card>
                      <CardContent className="p-4 space-y-4">
                        {/* الموقع */}
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1"><MapPin className="h-4 w-4" />موقعك الحالي</Label>
                          {coords ? (
                            <div className="text-sm text-green-600 flex items-center gap-1" data-testid="text-location-ok">
                              <CheckCircle2 className="h-4 w-4" />تم تحديد الموقع
                            </div>
                          ) : (
                            <Button type="button" variant="outline" onClick={requestLocation} disabled={geoLoading} data-testid="button-get-location">
                              {geoLoading ? <Loader2 className="h-4 w-4 ms-1 animate-spin" /> : <MapPin className="h-4 w-4 ms-1" />}
                              تحديد موقعي
                            </Button>
                          )}
                          {geoError && <div className="text-sm text-destructive" data-testid="text-geo-error">{geoError}</div>}
                        </div>

                        {/* التوقيع */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>التوقيع</Label>
                            <Button type="button" variant="ghost" size="sm" onClick={initCanvas} data-testid="button-clear-signature">
                              <Eraser className="h-4 w-4 ms-1" />مسح
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
                          <p className="text-xs text-muted-foreground">وقّع بإصبعك داخل المربع أعلاه</p>
                        </div>

                        {/* الأزرار */}
                        <div className="flex gap-2">
                          {!todayStatus?.attendance?.actualCheckIn ? (
                            <Button
                              className="flex-1"
                              disabled={!coords || !hasSignature || checkInMut.isPending}
                              onClick={() => checkInMut.mutate()}
                              data-testid="button-check-in"
                            >
                              {checkInMut.isPending ? <Loader2 className="h-4 w-4 ms-1 animate-spin" /> : <LogIn className="h-4 w-4 ms-1" />}
                              تسجيل الحضور
                            </Button>
                          ) : (
                            <Button
                              className="flex-1"
                              variant="secondary"
                              disabled={!coords || !hasSignature || checkOutMut.isPending}
                              onClick={() => checkOutMut.mutate()}
                              data-testid="button-check-out"
                            >
                              {checkOutMut.isPending ? <Loader2 className="h-4 w-4 ms-1 animate-spin" /> : <LogOut className="h-4 w-4 ms-1" />}
                              تسجيل الانصراف
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              )}

              {/* جدولي */}
              <TabsContent value="schedule" className="space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" size="icon" onClick={() => setSchedMonth(addMonth(schedMonth, -1))} data-testid="button-sched-prev"><ChevronRight className="h-4 w-4" /></Button>
                  <span className="font-semibold tabular-nums" data-testid="text-sched-month">{schedMonth}</span>
                  <Button variant="outline" size="icon" onClick={() => setSchedMonth(addMonth(schedMonth, 1))} data-testid="button-sched-next"><ChevronLeft className="h-4 w-4" /></Button>
                </div>
                {schedule.length === 0 && (
                  <Card><CardContent className="p-8 text-center text-muted-foreground">لا يوجد جدول لهذا الشهر</CardContent></Card>
                )}
                {schedule.map((s) => (
                  <Card key={s.id} data-testid={`row-schedule-${s.id}`}>
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{s.scheduleDate} · {DAY_LABELS[s.dayOfWeek] || s.dayOfWeek}</div>
                        {!s.isOff && <div className="text-sm text-muted-foreground">{s.startTime} - {s.endTime}</div>}
                      </div>
                      {s.isOff ? (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">راحة</Badge>
                      ) : (
                        <Badge variant="outline">{SHIFT_LABELS[s.shiftType] || s.shiftType || "دوام"}</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* حضوري */}
              <TabsContent value="attendance" className="space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" size="icon" onClick={() => setAttMonth(addMonth(attMonth, -1))} data-testid="button-att-prev"><ChevronRight className="h-4 w-4" /></Button>
                  <span className="font-semibold tabular-nums" data-testid="text-att-month">{attMonth}</span>
                  <Button variant="outline" size="icon" onClick={() => setAttMonth(addMonth(attMonth, 1))} data-testid="button-att-next"><ChevronLeft className="h-4 w-4" /></Button>
                </div>
                {attendance.length === 0 && (
                  <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد سجلات حضور لهذا الشهر</CardContent></Card>
                )}
                {attendance.map((a) => (
                  <Card key={a.id} data-testid={`row-attendance-${a.id}`}>
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{a.attendanceDate}</div>
                        <div className="text-sm text-muted-foreground">
                          {a.actualCheckIn ? `حضور: ${a.actualCheckIn}` : "—"}
                          {a.actualCheckOut ? ` · انصراف: ${a.actualCheckOut}` : ""}
                          {a.lateMinutes > 0 ? ` · تأخير ${a.lateMinutes} د` : ""}
                        </div>
                      </div>
                      <Badge variant="outline" className={STATUS_STYLE[a.status === "present" ? "approved" : a.status === "absent" ? "rejected" : "pending"]?.cls}>
                        {ATT_STATUS_LABELS[a.status] || a.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* إنذاراتي */}
              <TabsContent value="warnings" className="space-y-3">
                {warnings.length === 0 && (
                  <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد إنذارات — أحسنت!</CardContent></Card>
                )}
                {warnings.map((w) => (
                  <Card key={w.id} data-testid={`row-warning-${w.id}`}>
                    <CardContent className="p-4 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold">{WARNING_LEVEL_LABELS[w.level] || w.level}</div>
                        <Badge variant="outline" className={w.status === "active" ? STATUS_STYLE.rejected.cls : STATUS_STYLE.cancelled.cls}>
                          {w.status === "active" ? "نشط" : w.status === "cancelled" ? "ملغي" : w.status === "appealed" ? "معترض عليه" : "منتهٍ"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{w.issuedDate} · {w.reason}</div>
                      {w.description && <div className="text-xs text-muted-foreground">{w.description}</div>}
                      {w.deductionAmount > 0 && <div className="text-xs text-destructive">خصم: {fmtMoney(w.deductionAmount)} ر.س</div>}
                      {w.signedAt ? (
                        <div className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />تم التوقيع</div>
                      ) : (
                        <div className="text-xs text-amber-600 flex items-center gap-1"><Clock className="h-3 w-3" />بانتظار التوقيع</div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* وثائقي */}
              <TabsContent value="documents" className="space-y-3">
                {docsData?.expiry && (docsData.expiry.iqamaExpiry || docsData.expiry.healthCertificateExpiry) && (
                  <Card data-testid="card-expiry">
                    <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {docsData.expiry.iqamaExpiry && (
                        <div><span className="text-muted-foreground">انتهاء الإقامة: </span><span className="font-semibold">{docsData.expiry.iqamaExpiry}</span></div>
                      )}
                      {docsData.expiry.healthCertificateExpiry && (
                        <div><span className="text-muted-foreground">انتهاء الشهادة الصحية: </span><span className="font-semibold">{docsData.expiry.healthCertificateExpiry}</span></div>
                      )}
                    </CardContent>
                  </Card>
                )}
                {(!docsData?.documents || docsData.documents.length === 0) && (
                  <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد وثائق مسجلة</CardContent></Card>
                )}
                {docsData?.documents?.map((d) => (
                  <Card key={d.id} data-testid={`row-document-${d.id}`}>
                    <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />{DOC_TYPE_LABELS[d.documentType] || d.documentType}</div>
                        <div className="text-sm text-muted-foreground">
                          {d.documentNumber ? `رقم: ${d.documentNumber}` : ""}
                          {d.expiryDate ? ` · ينتهي: ${d.expiryDate}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {d.fileUrl && (
                          <a href={d.fileUrl} target="_blank" rel="noreferrer" data-testid={`link-document-${d.id}`}>
                            <Button size="sm" variant="outline">عرض</Button>
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* حوافزي */}
              <TabsContent value="incentives" className="space-y-3">
                {incentives.length === 0 && (
                  <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد حوافز مسجلة</CardContent></Card>
                )}
                {incentives.map((inc) => (
                  <Card key={inc.id} data-testid={`row-incentive-${inc.id}`}>
                    <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-semibold flex items-center gap-2"><Award className="h-4 w-4 text-primary" />{fmtMoney(inc.finalReward)} ر.س</div>
                        <div className="text-sm text-muted-foreground">
                          {inc.periodStart} → {inc.periodEnd} · تحقيق {Math.round(inc.achievementPercent)}%
                        </div>
                      </div>
                      <StatusBadge status={inc.status === "paid" ? "approved" : inc.status} labels={{ pending: "بانتظار", approved: "معتمد", paid: "مدفوع", cancelled: "ملغي" }} />
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* راتبي */}
              {showSalary && (
                <TabsContent value="salary" className="space-y-3">
                  {salary?.components ? (
                    <Card data-testid="card-salary">
                      <CardContent className="p-4 space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">الراتب الأساسي</span><span className="font-semibold tabular-nums">{fmtMoney(salary.components.salary)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">بدل السكن</span><span className="tabular-nums">{fmtMoney(salary.components.housingAllowance)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">بدل المواصلات</span><span className="tabular-nums">{fmtMoney(salary.components.transportAllowance)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">بدل الطعام</span><span className="tabular-nums">{fmtMoney(salary.components.foodAllowance)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">بدلات أخرى</span><span className="tabular-nums">{fmtMoney(salary.components.otherAllowances)}</span></div>
                        {salary.components.socialInsuranceDeduction > 0 && (
                          <div className="flex justify-between text-destructive"><span>خصم التأمينات</span><span className="tabular-nums">-{fmtMoney(salary.components.socialInsuranceDeduction)}</span></div>
                        )}
                        {salary.totalDeductions > 0 && (
                          <div className="flex justify-between text-destructive"><span>خصومات الشهر ({salary.month})</span><span className="tabular-nums">-{fmtMoney(salary.totalDeductions)}</span></div>
                        )}
                        <div className="flex justify-between border-t pt-2 font-bold text-base"><span>إجمالي الراتب</span><span className="tabular-nums text-primary">{fmtMoney(salary.components.totalSalary)} ر.س</span></div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card><CardContent className="p-8 text-center text-muted-foreground">جاري التحميل...</CardContent></Card>
                  )}
                  {salary?.deductions?.length > 0 && (
                    <Card>
                      <CardContent className="p-4 space-y-2">
                        <div className="font-semibold text-sm mb-2">خصومات شهر {salary.month}</div>
                        {salary.deductions.map((d: any) => (
                          <div key={d.id} className="flex justify-between text-sm" data-testid={`row-deduction-${d.id}`}>
                            <span className="text-muted-foreground">{d.description || d.type}</span>
                            <span className="tabular-nums text-destructive">-{fmtMoney(d.amount)}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              )}

              {/* الإجازات */}
              <TabsContent value="leaves" className="space-y-3">
                <div className="flex justify-end">
                  <Button onClick={() => setLeaveOpen(true)} data-testid="button-new-leave">
                    <Plus className="h-4 w-4 ms-1" />طلب إجازة جديد
                  </Button>
                </div>
                {leaves.length === 0 && (
                  <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد طلبات إجازة بعد</CardContent></Card>
                )}
                {leaves.map((l) => (
                  <Card key={l.id} data-testid={`row-leave-${l.id}`}>
                    <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-semibold">{LEAVE_TYPE_LABELS[l.leaveType] || l.leaveType}</div>
                        <div className="text-sm text-muted-foreground">
                          من {l.startDate} إلى {l.endDate} · {l.totalDays} يوم
                        </div>
                        {l.reason && <div className="text-xs text-muted-foreground">{l.reason}</div>}
                        {l.reviewerNote && <div className="text-xs text-muted-foreground">ملاحظة المراجع: {l.reviewerNote}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={l.status} labels={LEAVE_STATUS_LABELS} />
                        {l.status === "pending" && (
                          <Button size="sm" variant="ghost" className="text-destructive"
                            onClick={() => { if (confirm("إلغاء هذا الطلب؟")) cancelLeave.mutate(l.id); }}
                            data-testid={`button-cancel-leave-${l.id}`}>
                            إلغاء
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* السلف */}
              <TabsContent value="advances" className="space-y-3">
                <div className="flex justify-end">
                  <Button onClick={() => setAdvOpen(true)} data-testid="button-new-advance">
                    <Plus className="h-4 w-4 ms-1" />طلب سلفة جديد
                  </Button>
                </div>
                {advances.length === 0 && (
                  <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد طلبات سلف بعد</CardContent></Card>
                )}
                {advances.map((a) => (
                  <Card key={a.id} data-testid={`row-advance-${a.id}`}>
                    <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-semibold tabular-nums">{Number(a.amount).toLocaleString("ar-SA-u-nu-latn")} ر.س</div>
                        <div className="text-sm text-muted-foreground">
                          شهر الخصم: {a.requestedMonth}{a.installments > 1 ? ` · ${a.installments} أقساط` : ""}
                        </div>
                        {a.reason && <div className="text-xs text-muted-foreground">{a.reason}</div>}
                        {a.reviewerNote && <div className="text-xs text-muted-foreground">ملاحظة المراجع: {a.reviewerNote}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={a.status} labels={ADVANCE_REQUEST_STATUS_LABELS} />
                        {a.status === "pending" && (
                          <Button size="sm" variant="ghost" className="text-destructive"
                            onClick={() => { if (confirm("إلغاء هذا الطلب؟")) cancelAdvance.mutate(a.id); }}
                            data-testid={`button-cancel-advance-${a.id}`}>
                            إلغاء
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* نموذج طلب إجازة */}
        <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader><DialogTitle>طلب إجازة جديد</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>نوع الإجازة</Label>
                <Select value={leaveForm.leaveType} onValueChange={(v) => setLeaveForm({ ...leaveForm, leaveType: v })}>
                  <SelectTrigger data-testid="select-leave-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>من تاريخ</Label>
                  <Input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} data-testid="input-leave-start" />
                </div>
                <div>
                  <Label>إلى تاريخ</Label>
                  <Input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} data-testid="input-leave-end" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                عدد الأيام: <span className="font-bold text-foreground">{daysBetween(leaveForm.startDate, leaveForm.endDate)}</span>
              </div>
              <div>
                <Label>السبب (اختياري)</Label>
                <Textarea value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} data-testid="textarea-leave-reason" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLeaveOpen(false)}>إلغاء</Button>
              <Button onClick={() => submitLeave.mutate()} disabled={submitLeave.isPending} data-testid="button-submit-leave">
                {submitLeave.isPending ? "جاري الإرسال..." : "إرسال الطلب"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* نموذج طلب سلفة */}
        <Dialog open={advOpen} onOpenChange={setAdvOpen}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader><DialogTitle>طلب سلفة جديد</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>المبلغ (ر.س)</Label>
                  <Input type="number" step="0.01" value={advForm.amount} onChange={(e) => setAdvForm({ ...advForm, amount: e.target.value })} data-testid="input-advance-amount" />
                </div>
                <div>
                  <Label>شهر الخصم</Label>
                  <Input type="month" value={advForm.requestedMonth} onChange={(e) => setAdvForm({ ...advForm, requestedMonth: e.target.value })} data-testid="input-advance-month" />
                </div>
              </div>
              <div>
                <Label>عدد الأقساط</Label>
                <Input type="number" min="1" value={advForm.installments} onChange={(e) => setAdvForm({ ...advForm, installments: e.target.value })} data-testid="input-advance-installments" />
              </div>
              <div>
                <Label>السبب (اختياري)</Label>
                <Textarea value={advForm.reason} onChange={(e) => setAdvForm({ ...advForm, reason: e.target.value })} data-testid="textarea-advance-reason" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdvOpen(false)}>إلغاء</Button>
              <Button onClick={() => submitAdvance.mutate()} disabled={submitAdvance.isPending} data-testid="button-submit-advance">
                {submitAdvance.isPending ? "جاري الإرسال..." : "إرسال الطلب"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
