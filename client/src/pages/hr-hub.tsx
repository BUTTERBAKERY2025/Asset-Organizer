import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  UsersRound,
  Users,
  UserCheck,
  UserPlus,
  UserX,
  Clock,
  Wallet,
  Briefcase,
  FileBarChart,
  FolderOpen,
  ChevronLeft,
  ChevronDown,
  Building,
  Calendar,
  CalendarDays,
  ClipboardCheck,
  Gift,
  FileText,
  TrendingUp,
  TrendingDown,
  Bell,
  Send,
  MessageCircle,
  Sparkles,
  Brain,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  ArrowUpRight,
  PieChart as PieChartIcon,
  Lightbulb,
  RefreshCw,
  Filter,
  Lock,
  Unlock,
  CircleDot,
  CalendarClock,
  FileWarning,
  Award,
  Target,
} from "lucide-react";

// ============================================================================
// Helpers & Types
// ============================================================================

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-SA-u-nu-latn").format(Math.round(n || 0));

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("ar-SA-u-nu-latn", { maximumFractionDigits: 0 }).format(
    Math.round(n || 0),
  );

type SalaryInvoice = {
  activeEmployees: number;
  gross: number;
  manualDeductions: number;
  absenceDeduction: number;
  net: number;
};

type EmployeeStats = {
  totalEmployees: number;
  totalSalaries: number; // net payable invoice (active employees, after deductions)
  salaryInvoice?: SalaryInvoice;
  byStatus?: { status: string; count: number }[];
  byNationality?: { nationality: string; count: number }[];
  byJobTitle?: { jobTitle: string; count: number }[];
};

type BranchEmployee = {
  id: number;
  employeeName?: string;
  employeeNameEn?: string;
  fullName?: string;
  fullNameArabic?: string;
  phoneNumber?: string;
  mobile?: string;
  status?: string;
  branchId?: string;
  jobTitle?: string;
  nationality?: string;
};

type Branch = { id: string; name: string; nameAr?: string };
type EmploymentApplication = { id: number; status?: string };
type JobOffer = { id: number; status?: string };

// Donut chart palette (works well in RTL & accessible)
const PALETTE = [
  "#0d9488", "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444",
  "#06b6d4", "#ec4899", "#f97316", "#84cc16", "#6366f1", "#14b8a6",
];

// ============================================================================
// Compact KPI Tile (ExactFlow style)
// ============================================================================

type TileTone =
  | "teal" | "blue" | "violet" | "emerald" | "amber" | "rose"
  | "indigo" | "pink" | "orange" | "lime" | "cyan" | "slate";

const TONE_MAP: Record<TileTone, { iconBg: string; iconColor: string; ring: string; accentText: string }> = {
  teal:    { iconBg: "bg-teal-50 dark:bg-teal-950/40",       iconColor: "text-teal-600 dark:text-teal-400",       ring: "ring-teal-100 dark:ring-teal-900/40",       accentText: "text-teal-700" },
  blue:    { iconBg: "bg-blue-50 dark:bg-blue-950/40",       iconColor: "text-blue-600 dark:text-blue-400",       ring: "ring-blue-100 dark:ring-blue-900/40",       accentText: "text-blue-700" },
  violet:  { iconBg: "bg-violet-50 dark:bg-violet-950/40",   iconColor: "text-violet-600 dark:text-violet-400",   ring: "ring-violet-100 dark:ring-violet-900/40",   accentText: "text-violet-700" },
  emerald: { iconBg: "bg-emerald-50 dark:bg-emerald-950/40", iconColor: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-100 dark:ring-emerald-900/40", accentText: "text-emerald-700" },
  amber:   { iconBg: "bg-amber-50 dark:bg-amber-950/40",     iconColor: "text-amber-600 dark:text-amber-400",     ring: "ring-amber-100 dark:ring-amber-900/40",     accentText: "text-amber-700" },
  rose:    { iconBg: "bg-rose-50 dark:bg-rose-950/40",       iconColor: "text-rose-600 dark:text-rose-400",       ring: "ring-rose-100 dark:ring-rose-900/40",       accentText: "text-rose-700" },
  indigo:  { iconBg: "bg-indigo-50 dark:bg-indigo-950/40",   iconColor: "text-indigo-600 dark:text-indigo-400",   ring: "ring-indigo-100 dark:ring-indigo-900/40",   accentText: "text-indigo-700" },
  pink:    { iconBg: "bg-pink-50 dark:bg-pink-950/40",       iconColor: "text-pink-600 dark:text-pink-400",       ring: "ring-pink-100 dark:ring-pink-900/40",       accentText: "text-pink-700" },
  orange:  { iconBg: "bg-orange-50 dark:bg-orange-950/40",   iconColor: "text-orange-600 dark:text-orange-400",   ring: "ring-orange-100 dark:ring-orange-900/40",   accentText: "text-orange-700" },
  lime:    { iconBg: "bg-lime-50 dark:bg-lime-950/40",       iconColor: "text-lime-600 dark:text-lime-400",       ring: "ring-lime-100 dark:ring-lime-900/40",       accentText: "text-lime-700" },
  cyan:    { iconBg: "bg-cyan-50 dark:bg-cyan-950/40",       iconColor: "text-cyan-600 dark:text-cyan-400",       ring: "ring-cyan-100 dark:ring-cyan-900/40",       accentText: "text-cyan-700" },
  slate:   { iconBg: "bg-slate-50 dark:bg-slate-900/40",     iconColor: "text-slate-600 dark:text-slate-400",     ring: "ring-slate-100 dark:ring-slate-800",       accentText: "text-slate-700" },
};

interface StatTileProps {
  value: number | string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: TileTone;
  suffix?: string;
  href?: string;
  comingSoon?: boolean;
  testId?: string;
  // Optional comparison chip (delta vs previous period)
  delta?: number | null;            // numeric difference (positive = up, negative = down)
  deltaLabel?: string;              // small label, e.g. "مقارنة بالشهر السابق"
  deltaIsPercent?: boolean;         // render delta as percentage
  deltaInverted?: boolean;          // true = up is BAD (e.g., advances, absences); false = up is GOOD
  target?: number;                  // optional target line (e.g., 90 for attendance rate)
  tooltip?: string;                 // native HTML tooltip on hover (breakdown details)
}

const StatTile = React.memo(function StatTile({ value, label, icon: Icon, tone, suffix, href, comingSoon, testId, delta, deltaLabel, deltaIsPercent, deltaInverted, target, tooltip }: StatTileProps) {
  const [, navigate] = useLocation();
  const t = TONE_MAP[tone];
  const clickable = !!href && !comingSoon;

  return (
    <button
      type="button"
      onClick={() => clickable && navigate(href!)}
      disabled={!clickable}
      className={cn(
        "relative w-full bg-white dark:bg-card border border-gray-100 dark:border-border rounded-xl p-3 sm:p-4 transition-all text-start",
        clickable && "hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200 cursor-pointer",
        !clickable && "cursor-default opacity-95",
      )}
      data-testid={testId}
      title={tooltip}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-foreground tabular-nums" dir="ltr">
              {typeof value === "number" ? fmt(value) : value}
            </span>
            {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-tight line-clamp-2">
            {label}
          </p>
          {(delta !== undefined && delta !== null) || target !== undefined ? (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {delta !== undefined && delta !== null && (
                (() => {
                  const isUp = delta > 0;
                  const isFlat = delta === 0;
                  const isGood = isFlat ? true : (deltaInverted ? !isUp : isUp);
                  const TrendIcon = isFlat ? CircleDot : (isUp ? TrendingUp : TrendingDown);
                  const colorCls = isFlat
                    ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    : isGood
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400";
                  return (
                    <span
                      className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold tabular-nums", colorCls)}
                      dir="ltr"
                      data-testid={testId ? `${testId}-delta` : undefined}
                    >
                      <TrendIcon className="w-2.5 h-2.5" />
                      {isUp ? "+" : ""}{fmt(delta)}{deltaIsPercent ? "%" : ""}
                    </span>
                  );
                })()
              )}
              {target !== undefined && (
                <span className="text-[10px] text-muted-foreground" data-testid={testId ? `${testId}-target` : undefined}>
                  الهدف {fmt(target)}{deltaIsPercent ? "%" : ""}
                </span>
              )}
              {deltaLabel && (
                <span className="text-[10px] text-muted-foreground/80 truncate">{deltaLabel}</span>
              )}
            </div>
          ) : null}
        </div>
        <div className={cn("w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ring-1", t.iconBg, t.iconColor, t.ring)}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
      {comingSoon && (
        <span className="absolute top-1.5 start-1.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 font-medium">
          قريباً
        </span>
      )}
    </button>
  );
});

// ============================================================================
// Donut Chart Card
// ============================================================================

interface DonutCardProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  data: { name: string; value: number }[];
  testId?: string;
  emptyText?: string;
}

const DonutCard = React.memo(function DonutCard({ title, icon: Icon, data, testId, emptyText }: DonutCardProps) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  const topItems = useMemo(
    () => [...data].sort((a, b) => b.value - a.value).slice(0, 8),
    [data],
  );

  return (
    <Card className="border-gray-100" data-testid={testId}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-500" />
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <Badge variant="secondary" className="ms-auto h-5 text-[10px]">
            {fmt(total)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {total === 0 ? (
          <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">
            {emptyText ?? "لا توجد بيانات"}
          </div>
        ) : (
          <>
            <div className="h-[180px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topItems}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {topItems.map((_, idx) => (
                      <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => fmt(Number(v))}
                    contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1 max-h-[120px] overflow-y-auto">
              {topItems.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-2 text-xs">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}
                  />
                  <span className="truncate text-gray-700 dark:text-foreground/90 flex-1">{item.name || "—"}</span>
                  <span className="tabular-nums text-muted-foreground" dir="ltr">{fmt(item.value)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
});

// ============================================================================
// WhatsApp Quick-Send Card
// ============================================================================

const MESSAGE_TEMPLATES: { id: string; label: string; body: (name: string) => string }[] = [
  {
    id: "salary_ready",
    label: "إشعار إيداع الراتب",
    body: (name) =>
      `مرحباً ${name}،\nنود إعلامك بأنه تم إيداع راتبك لهذا الشهر.\nمع تحيات إدارة الموارد البشرية - باتر بيكري.`,
  },
  {
    id: "shift_reminder",
    label: "تذكير بالوردية",
    body: (name) =>
      `مرحباً ${name}،\nنذكّرك بأن وردية عملك القادمة تبدأ غداً. يرجى الحضور في الوقت المحدد.\nشكراً لتعاونك.`,
  },
  {
    id: "doc_expiry",
    label: "تنبيه انتهاء وثيقة",
    body: (name) =>
      `مرحباً ${name}،\nنود تنبيهك بأن إحدى وثائقك الرسمية على وشك الانتهاء. يرجى التواصل مع قسم الموارد البشرية للتجديد في أقرب وقت.`,
  },
  {
    id: "thank_you",
    label: "شكر وتقدير",
    body: (name) =>
      `مرحباً ${name}،\nشكراً جزيلاً على جهودك المميزة هذا الأسبوع. نحن نقدّر التزامك.\nإدارة باتر بيكري.`,
  },
  {
    id: "custom",
    label: "رسالة مخصصة",
    body: () => "",
  },
];

function WhatsAppQuickSend({ employees, branches }: { employees: BranchEmployee[]; branches: Branch[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("custom");
  const [message, setMessage] = useState<string>("");
  const [search, setSearch] = useState("");
  // bulk state
  const [bulkAudience, setBulkAudience] = useState<"all_active" | "by_branch" | "by_nationality">("all_active");
  const [bulkBranch, setBulkBranch] = useState<string>("");
  const [bulkNationality, setBulkNationality] = useState<string>("");
  const [bulkPersonalize, setBulkPersonalize] = useState(true);

  const employeesWithPhone = useMemo(
    () => employees.filter((e) => (e.phoneNumber || e.mobile) && (e.status === "active" || !e.status || e.status === "on_leave")),
    [employees],
  );

  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employeesWithPhone.slice(0, 50);
    const q = search.trim().toLowerCase();
    return employeesWithPhone
      .filter((e) =>
        (e.employeeName || e.fullNameArabic || e.fullName || "").toLowerCase().includes(q) ||
        (e.phoneNumber || e.mobile || "").includes(q),
      )
      .slice(0, 50);
  }, [employeesWithPhone, search]);

  const selectedEmployee = employees.find((e) => String(e.id) === employeeId);
  const recipientPhone = selectedEmployee?.phoneNumber || selectedEmployee?.mobile || "";
  const recipientName = selectedEmployee?.employeeName || selectedEmployee?.fullNameArabic || selectedEmployee?.fullName || "موظفنا الكريم";

  // Nationalities for bulk dropdown
  const nationalities = useMemo(() => {
    const set = new Set<string>();
    employeesWithPhone.forEach((e) => e.nationality && set.add(e.nationality));
    return Array.from(set).sort();
  }, [employeesWithPhone]);

  // Bulk recipients list (computed from current filter) — dedupe by normalized phone.
  // For bulk audiences we always exclude on-leave employees to avoid disturbing
  // them during their leave; single send still allows targeting an on-leave
  // employee explicitly if the user picks them from the dropdown.
  const bulkRecipients = useMemo(() => {
    let list = employeesWithPhone.filter((e) => !e.status || e.status === "active");
    if (bulkAudience === "by_branch" && bulkBranch) list = list.filter((e) => String(e.branchId) === bulkBranch);
    if (bulkAudience === "by_nationality" && bulkNationality) list = list.filter((e) => e.nationality === bulkNationality);
    const seen = new Set<string>();
    const out: { phone: string; name: string }[] = [];
    for (const e of list) {
      const phone = (e.phoneNumber || e.mobile || "").replace(/[\s\-()]/g, "").trim();
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      out.push({
        phone,
        name: e.employeeName || e.fullNameArabic || e.fullName || `#${e.id}`,
      });
    }
    return out;
  }, [employeesWithPhone, bulkAudience, bulkBranch, bulkNationality]);

  const BULK_MAX = 200;
  const bulkOverLimit = bulkRecipients.length > BULK_MAX;

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/notifications/send", {
        recipientPhone,
        recipientName,
        channel: "whatsapp",
        message,
        relatedModule: "hr_management",
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.status === "failed") {
        toast({
          title: "تعذّر الإرسال",
          description: data?.errorMessage || "فشل إرسال رسالة الواتساب",
          variant: "destructive",
        });
      } else {
        toast({
          title: "تم الإرسال",
          description: `تم إرسال الرسالة إلى ${recipientName} عبر الواتساب`,
        });
        setMessage("");
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      }
    },
    onError: (err: any) => {
      toast({
        title: "خطأ في الإرسال",
        description: err?.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    },
  });

  const bulkSendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/notifications/send-bulk", {
        recipients: bulkRecipients,
        channel: "whatsapp",
        message,
        personalize: bulkPersonalize,
        relatedModule: "hr_management",
      });
      return res.json();
    },
    onSuccess: (data) => {
      const sent = data?.sent || 0;
      const failed = data?.failed || 0;
      if (sent > 0 && failed === 0) {
        toast({ title: "تم الإرسال بنجاح", description: `أُرسلت ${fmt(sent)} رسالة عبر الواتساب` });
        setMessage("");
      } else if (sent > 0 && failed > 0) {
        toast({ title: "إرسال جزئي", description: `نجح: ${fmt(sent)} — فشل: ${fmt(failed)}`, variant: "destructive" });
      } else {
        toast({ title: "فشل الإرسال", description: data?.error || `فشل إرسال جميع الرسائل (${fmt(failed)})`, variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: (err: any) => {
      toast({ title: "خطأ في الإرسال الجماعي", description: err?.message || "حدث خطأ غير متوقع", variant: "destructive" });
    },
  });

  const applyTemplate = (tid: string) => {
    setTemplateId(tid);
    const tpl = MESSAGE_TEMPLATES.find((t) => t.id === tid);
    if (tpl && tid !== "custom") {
      // For bulk personalize, keep the placeholder {name} so server replaces per recipient
      setMessage(mode === "bulk" && bulkPersonalize ? tpl.body("{name}") : tpl.body(mode === "bulk" ? "" : recipientName));
    }
  };

  const canSend = mode === "single"
    ? (!!recipientPhone && message.trim().length > 0 && !sendMutation.isPending)
    : (bulkRecipients.length > 0 && !bulkOverLimit && message.trim().length > 0 && !bulkSendMutation.isPending);

  return (
    <Card className="border-emerald-100 dark:border-emerald-900/40" data-testid="card-whatsapp-quick-send">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold">واتساب مباشر للموظف</CardTitle>
            <p className="text-[11px] text-muted-foreground">إرسال إشعار سريع عبر WhatsApp</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Mode toggle: single vs bulk */}
        <div className="grid grid-cols-2 gap-1 p-0.5 bg-gray-100 dark:bg-muted rounded-lg" data-testid="toggle-whatsapp-mode">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={cn(
              "text-xs font-medium py-1.5 rounded-md transition-colors",
              mode === "single" ? "bg-white dark:bg-card shadow-sm text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
            )}
            data-testid="tab-whatsapp-single"
          >
            موظف واحد
          </button>
          <button
            type="button"
            onClick={() => setMode("bulk")}
            className={cn(
              "text-xs font-medium py-1.5 rounded-md transition-colors flex items-center justify-center gap-1",
              mode === "bulk" ? "bg-white dark:bg-card shadow-sm text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
            )}
            data-testid="tab-whatsapp-bulk"
          >
            <Users className="w-3 h-3" /> إرسال جماعي
          </button>
        </div>

        {mode === "single" ? (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700 dark:text-foreground/90">المستلم</label>
            <div className="relative">
              <Input
                placeholder="ابحث بالاسم أو رقم الجوال..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 text-sm pe-16"
                data-testid="input-whatsapp-search"
              />
              <span
                className="absolute inset-y-0 end-2 flex items-center text-[10px] text-muted-foreground tabular-nums pointer-events-none"
                data-testid="text-whatsapp-search-count"
              >
                {fmt(filteredEmployees.length)} نتيجة
              </span>
            </div>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="h-9 text-sm" data-testid="select-whatsapp-recipient">
                <SelectValue placeholder="اختر موظفاً" />
              </SelectTrigger>
              <SelectContent>
                {filteredEmployees.length === 0 && (
                  <div className="py-2 px-3 text-xs text-muted-foreground">لا توجد نتائج — جرّب كلمة بحث أخرى</div>
                )}
                {filteredEmployees.slice(0, 200).map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{e.employeeName || e.fullNameArabic || e.fullName || `#${e.id}`}</span>
                      <span className="text-[10px] text-muted-foreground" dir="ltr">
                        {e.phoneNumber || e.mobile}
                      </span>
                    </span>
                  </SelectItem>
                ))}
                {filteredEmployees.length > 200 && (
                  <div className="py-1.5 px-3 text-[10px] text-muted-foreground border-t mt-1">
                    يُعرض أول 200 — ابحث لتضييق النتائج ({fmt(filteredEmployees.length - 200)} مخفي)
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700 dark:text-foreground/90">الفئة المستهدفة</label>
              <Select value={bulkAudience} onValueChange={(v) => setBulkAudience(v as any)}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-bulk-audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_active">كل الموظفين النشطين</SelectItem>
                  <SelectItem value="by_branch">حسب الفرع</SelectItem>
                  <SelectItem value="by_nationality">حسب الجنسية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {bulkAudience === "by_branch" && (
              <Select value={bulkBranch} onValueChange={setBulkBranch}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-bulk-branch">
                  <SelectValue placeholder="اختر الفرع" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.nameAr || b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {bulkAudience === "by_nationality" && (
              <Select value={bulkNationality} onValueChange={setBulkNationality}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-bulk-nationality">
                  <SelectValue placeholder="اختر الجنسية" />
                </SelectTrigger>
                <SelectContent>
                  {nationalities.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className={cn(
              "flex items-center justify-between p-2 rounded-md border",
              bulkOverLimit
                ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40"
                : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40",
            )}>
              <span className={cn(
                "text-[11px] font-medium",
                bulkOverLimit ? "text-rose-800 dark:text-rose-300" : "text-emerald-800 dark:text-emerald-300",
              )} data-testid="text-bulk-count">
                {bulkOverLimit ? (
                  <>تجاوز الحد: <span className="font-bold tabular-nums" dir="ltr">{fmt(bulkRecipients.length)}</span> / {BULK_MAX}</>
                ) : (
                  <>سيُرسل إلى <span className="font-bold tabular-nums" dir="ltr">{fmt(bulkRecipients.length)}</span> مستلم</>
                )}
              </span>
              <label className="flex items-center gap-1 text-[11px] text-gray-700 dark:text-foreground/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkPersonalize}
                  onChange={(e) => setBulkPersonalize(e.target.checked)}
                  className="rounded"
                  data-testid="checkbox-bulk-personalize"
                />
                استبدال {"{name}"}
              </label>
            </div>
            {bulkOverLimit && (
              <p className="text-[10px] text-rose-700 dark:text-rose-400 px-1" data-testid="text-bulk-over-limit">
                الحد الأقصى {BULK_MAX} مستلم في عملية واحدة — قلّص النطاق أو قسّم على دفعات.
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700 dark:text-foreground/90">قالب جاهز</label>
          <Select value={templateId} onValueChange={applyTemplate}>
            <SelectTrigger className="h-9 text-sm" data-testid="select-whatsapp-template">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESSAGE_TEMPLATES.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700 dark:text-foreground/90">الرسالة</label>
          <Textarea
            placeholder={mode === "bulk" && bulkPersonalize ? "استخدم {name} لإدراج اسم كل مستلم..." : "اكتب نص الرسالة..."}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="text-sm resize-none"
            data-testid="textarea-whatsapp-message"
          />
          <p className="text-[10px] text-muted-foreground">{message.length}/1000 حرف</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            onClick={() => {
              const text = message.trim();
              if (!text) return;
              // wa.me requires E.164 digits-only with country code (no '+').
              // Saudi-aware normalization: handles +966xxxxxxxxx, 00966xxxxxxxxx,
              // 0xxxxxxxxx (local), and 5xxxxxxxx (mobile without leading 0).
              const normalize = (raw: string): string => {
                let d = (raw || "").replace(/[\s\-()]/g, "").replace(/^\+/, "");
                if (d.startsWith("00")) d = d.slice(2);
                if (d.startsWith("966")) return d;
                if (d.startsWith("0")) return "966" + d.slice(1);
                if (/^5\d{8}$/.test(d)) return "966" + d;
                return d; // already international (non-Saudi) or unknown — pass through
              };
              if (mode === "single") {
                const phone = normalize(recipientPhone);
                if (!phone) {
                  toast({ title: "لا يوجد رقم", description: "اختر موظفًا لديه رقم جوال أولاً", variant: "destructive" });
                  return;
                }
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
              } else {
                if (bulkRecipients.length === 0 || bulkOverLimit) return;
                if (bulkRecipients.length > 10 && !window.confirm(`سيُفتح ${bulkRecipients.length} تبويبات واتساب — قد يحجبها المتصفح. اسمح بالنوافذ المنبثقة لهذا الموقع. هل تريد المتابعة؟`)) return;
                let opened = 0;
                bulkRecipients.forEach((r, i) => {
                  setTimeout(() => {
                    const phone = normalize(r.phone);
                    if (!phone) return;
                    const body = bulkPersonalize ? text.replace(/\{name\}/g, r.name) : text;
                    const w = window.open(`https://wa.me/${phone}?text=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer");
                    if (w) opened++;
                    if (i === bulkRecipients.length - 1) {
                      toast({
                        title: opened > 0 ? "تم فتح المحادثات" : "تم حجب النوافذ",
                        description: opened > 0
                          ? `فُتح ${opened} من ${bulkRecipients.length} — اضغط زر الإرسال داخل كل محادثة`
                          : "سمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة",
                        variant: opened > 0 ? "default" : "destructive",
                      });
                    }
                  }, i * 350);
                });
              }
            }}
            disabled={!message.trim() || (mode === "single" ? !recipientPhone : (bulkRecipients.length === 0 || bulkOverLimit))}
            data-testid="button-send-whatsapp-direct"
            title="يفتح محادثة واتساب على جهازك (مجاني، من رقمك الشخصي)"
          >
            <MessageCircle className="w-4 h-4" />
            {mode === "single" ? "واتساب مباشر" : `فتح ${fmt(bulkRecipients.length)} محادثة`}
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => (mode === "single" ? sendMutation.mutate() : bulkSendMutation.mutate())}
            disabled={!canSend}
            data-testid="button-send-whatsapp"
            title="إرسال آلي عبر Twilio (مدفوع، من رقم الشركة)"
          >
            {(mode === "single" ? sendMutation.isPending : bulkSendMutation.isPending) ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ...</>
            ) : (
              <><Send className="w-4 h-4" /> إرسال آلي</>
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center px-2">
          <span className="font-medium text-emerald-700 dark:text-emerald-400">واتساب مباشر</span>: مجاني من رقمك الشخصي ·
          <span className="font-medium text-gray-700 dark:text-foreground/80"> إرسال آلي</span>: عبر Twilio من رقم الشركة
        </p>

        <Link href="/notifications-center">
          <a
            className="block text-center text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
            data-testid="link-notifications-center"
          >
            فتح مركز الإشعارات الكامل ←
          </a>
        </Link>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Monthly Salary Closing Card
// ============================================================================

type SalaryClosing = {
  month: number;
  year: number;
  totalBranches: number;
  openCount: number;
  closedCount: number;
  lockedCount: number;
  notStartedCount: number;
  lastUpdated: string | null;
  totalMonthlySalaries: number;
  employeesCount: number;
  progressPercent: number;
};

const AR_MONTHS = ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function SalaryClosingCard({ data }: { data?: SalaryClosing }) {
  if (!data) {
    return (
      <Card className="border-amber-100 dark:border-amber-900/40" data-testid="card-salary-closing">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold">إغلاق الراتب الشهري</CardTitle>
              <p className="text-[11px] text-muted-foreground">جارٍ التحميل...</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-20 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }
  const lastUpdatedTxt = data.lastUpdated
    ? new Intl.DateTimeFormat("ar-SA-u-nu-latn", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(data.lastUpdated))
    : "لم يبدأ بعد";
  return (
    <Card className="border-amber-100 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/40 to-orange-50/30 dark:from-amber-950/10 dark:to-orange-950/10" data-testid="card-salary-closing">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-sm font-bold">إغلاق الراتب الشهري</CardTitle>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <CalendarClock className="w-3 h-3" /> {AR_MONTHS[data.month]} {data.year}
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] tabular-nums" data-testid="badge-closing-progress">
            {data.progressPercent}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="h-2 bg-gray-100 dark:bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all"
              style={{ width: `${data.progressPercent}%` }}
              data-testid="bar-closing-progress"
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-left">
            {fmt(data.closedCount + data.lockedCount)} / {fmt(data.totalBranches)} فرع
          </p>
        </div>

        {/* Status grid */}
        <div className="grid grid-cols-4 gap-1.5">
          <div className="text-center p-1.5 rounded-md bg-white dark:bg-card border border-slate-100 dark:border-border" data-testid="stat-not-started">
            <CircleDot className="w-3 h-3 mx-auto text-slate-400" />
            <p className="text-[10px] text-muted-foreground mt-0.5">لم يبدأ</p>
            <p className="text-sm font-bold text-slate-700 dark:text-foreground tabular-nums" dir="ltr">{fmt(data.notStartedCount)}</p>
          </div>
          <div className="text-center p-1.5 rounded-md bg-white dark:bg-card border border-blue-100 dark:border-blue-900/40" data-testid="stat-open">
            <Unlock className="w-3 h-3 mx-auto text-blue-500" />
            <p className="text-[10px] text-muted-foreground mt-0.5">مفتوح</p>
            <p className="text-sm font-bold text-blue-700 dark:text-blue-400 tabular-nums" dir="ltr">{fmt(data.openCount)}</p>
          </div>
          <div className="text-center p-1.5 rounded-md bg-white dark:bg-card border border-emerald-100 dark:border-emerald-900/40" data-testid="stat-closed">
            <CheckCircle2 className="w-3 h-3 mx-auto text-emerald-500" />
            <p className="text-[10px] text-muted-foreground mt-0.5">مغلق</p>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums" dir="ltr">{fmt(data.closedCount)}</p>
          </div>
          <div className="text-center p-1.5 rounded-md bg-white dark:bg-card border border-violet-100 dark:border-violet-900/40" data-testid="stat-locked">
            <Lock className="w-3 h-3 mx-auto text-violet-500" />
            <p className="text-[10px] text-muted-foreground mt-0.5">مقفل</p>
            <p className="text-sm font-bold text-violet-700 dark:text-violet-400 tabular-nums" dir="ltr">{fmt(data.lockedCount)}</p>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100 dark:border-border">
          <div>
            <p className="text-[10px] text-muted-foreground">إجمالي الفاتورة</p>
            <p className="text-sm font-bold text-gray-900 dark:text-foreground tabular-nums" dir="ltr" data-testid="text-total-salaries">
              {fmtMoney(data.totalMonthlySalaries)} <span className="text-[10px] text-muted-foreground">ر.س</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">موظفون نشطون</p>
            <p className="text-sm font-bold text-gray-900 dark:text-foreground tabular-nums" dir="ltr" data-testid="text-active-count">
              {fmt(data.employeesCount)}
            </p>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground" data-testid="text-last-updated">
          آخر تحديث: <span dir="ltr">{lastUpdatedTxt}</span>
        </p>

        <Link href="/employee-reports">
          <a
            className="flex items-center justify-center gap-1 text-xs text-amber-700 dark:text-amber-400 hover:underline font-medium pt-1"
            data-testid="link-salary-closing"
          >
            فتح تقارير الرواتب وإغلاق الشهر <ArrowUpRight className="w-3 h-3" />
          </a>
        </Link>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// AI Insights Card (deterministic, derived from current data)
// ============================================================================

interface AIInsight {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "info" | "warning" | "success";
  title: string;
  detail: string;
  action?: { label: string; href: string };
}

function AIInsightsCard({
  insights,
  onRefresh,
  isAILoading,
  aiError,
  aiPoweredBy,
}: {
  insights: AIInsight[];
  onRefresh: () => void;
  isAILoading?: boolean;
  aiError?: string | null;
  aiPoweredBy?: "ai" | "fallback";
}) {
  return (
    <Card className="border-violet-100 dark:border-violet-900/40 bg-gradient-to-br from-violet-50/40 to-indigo-50/40 dark:from-violet-950/10 dark:to-indigo-950/10" data-testid="card-ai-insights">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center">
            <Brain className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              المساعد الذكي
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              {aiPoweredBy === "ai" && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300" data-testid="badge-ai-powered">
                  GPT-5
                </span>
              )}
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              {isAILoading
                ? "يحلّل ChatGPT بياناتك الآن..."
                : aiPoweredBy === "ai"
                ? "رؤى ذكية مولّدة بواسطة ChatGPT"
                : "اضغط زر التحديث لتحليل ذكي بواسطة ChatGPT"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onRefresh}
            disabled={isAILoading}
            data-testid="button-refresh-insights"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isAILoading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {aiError && (
          <div className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded px-2 py-1.5 border border-amber-200 dark:border-amber-900/40" data-testid="text-ai-error">
            {aiError} — يتم عرض رؤى محلية بدلاً منها.
          </div>
        )}
        {insights.length === 0 ? (
          <div className="py-6 text-center">
            <Lightbulb className="w-6 h-6 mx-auto text-muted-foreground/60 mb-2" />
            <p className="text-xs text-muted-foreground">
              كل شيء يعمل بشكل ممتاز — لا توجد رؤى عاجلة الآن
            </p>
          </div>
        ) : (
          insights.map((ins) => {
            const Icon = ins.icon;
            return (
              <div
                key={ins.id}
                className={cn(
                  "p-3 rounded-lg border bg-white/70 dark:bg-card/70 flex gap-3",
                  ins.tone === "warning" && "border-amber-200 dark:border-amber-900/40",
                  ins.tone === "info" && "border-blue-200 dark:border-blue-900/40",
                  ins.tone === "success" && "border-emerald-200 dark:border-emerald-900/40",
                )}
                data-testid={`insight-${ins.id}`}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                    ins.tone === "warning" && "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
                    ins.tone === "info" && "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
                    ins.tone === "success" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 dark:text-foreground">{ins.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{ins.detail}</p>
                  {ins.action && (
                    <Link href={ins.action.href}>
                      <a className="inline-flex items-center gap-1 text-[11px] text-violet-700 dark:text-violet-400 hover:underline mt-1 font-medium">
                        {ins.action.label}
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// New Analytical Charts (Weekly Attendance, Cost Breakdown, Hiring Funnel)
// ============================================================================

type WeeklyAttendanceItem = { date: string; present: number; late: number; absent: number; total: number };

const dayLabel = (iso: string) => {
  try {
    const d = new Date(iso + "T00:00:00");
    return new Intl.DateTimeFormat("ar-SA-u-nu-latn", { weekday: "short", day: "numeric", month: "numeric" }).format(d);
  } catch { return iso; }
};

const WeeklyAttendanceChart = React.memo(function WeeklyAttendanceChart({ data }: { data?: WeeklyAttendanceItem[] }) {
  const rows = data ?? [];
  const total = rows.reduce((s, r) => s + r.total, 0);
  const chartData = useMemo(
    () => rows.map((r) => ({ day: dayLabel(r.date), حاضر: r.present, متأخر: r.late, غائب: r.absent })),
    [rows],
  );
  return (
    <Card className="border-gray-100" data-testid="chart-weekly-attendance">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-gray-500" />
          <CardTitle className="text-sm font-semibold">الحضور الأسبوعي (آخر 7 أيام)</CardTitle>
          <Badge variant="secondary" className="ms-auto h-5 text-[10px]" data-testid="chart-weekly-attendance-total">{fmt(total)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {total === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">لا توجد سجلات حضور خلال 7 أيام</div>
        ) : (
          <div className="h-[220px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="حاضر" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="متأخر" stackId="a" fill="#f59e0b" />
                <Bar dataKey="غائب" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

type CostItem = { name: string; value: number };

const CostBreakdownChart = React.memo(function CostBreakdownChart({ data }: { data?: CostItem[] }) {
  const rows = data ?? [];
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <Card className="border-gray-100" data-testid="chart-cost-breakdown">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-gray-500" />
          <CardTitle className="text-sm font-semibold">توزيع التكاليف الشهرية</CardTitle>
          <Badge variant="secondary" className="ms-auto h-5 text-[10px]" data-testid="chart-cost-total">{fmtMoney(total)} ر.س</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {total === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">لا توجد بيانات تكاليف</div>
        ) : (
          <>
            <div className="h-[160px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={rows} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value" nameKey="name">
                    {rows.map((_, idx) => (<Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />))}
                  </Pie>
                  <Tooltip formatter={(v: any) => `${fmtMoney(Number(v))} ر.س`} contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1 max-h-[110px] overflow-y-auto">
              {rows.map((item, idx) => {
                const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                return (
                  <div key={item.name} className="flex items-center gap-2 text-xs" data-testid={`cost-row-${idx}`}>
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: PALETTE[idx % PALETTE.length] }} />
                    <span className="text-gray-700 dark:text-foreground/90 truncate flex-1">{item.name}</span>
                    <span className="tabular-nums text-muted-foreground" dir="ltr">{fmtMoney(item.value)}</span>
                    <span className="tabular-nums text-[10px] text-muted-foreground/80 w-8 text-end" dir="ltr">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
});

type FunnelData = {
  steps: { name: string; value: number }[];
  totals: { applicationsThisMonth: number; hiresThisMonth: number; hiresPrevMonth: number; conversionRate: number | null; forecastNextMonth: number };
};

const HiringFunnelChart = React.memo(function HiringFunnelChart({ data }: { data?: FunnelData }) {
  const steps = data?.steps ?? [];
  const totals = data?.totals;
  // Badge shows the *top* of the funnel (this month's applications) not the
  // sum of every stage — summing stages double-counts the same candidate as
  // they advance through invited → interviewed → offer → onboarding.
  const badgeTotal = totals?.applicationsThisMonth ?? steps.reduce((s, r) => s + r.value, 0);
  const hasData = steps.some((s) => s.value > 0);
  return (
    <Card className="border-gray-100" data-testid="chart-hiring-funnel">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-gray-500" />
          <CardTitle className="text-sm font-semibold">قمع التوظيف وتوقعات الشهر القادم</CardTitle>
          <Badge
            variant="secondary"
            className="ms-auto h-5 text-[10px]"
            title="طلبات التوظيف الجديدة لهذا الشهر"
          >
            {fmt(badgeTotal)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {!hasData ? (
          <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">لا توجد بيانات توظيف هذا الشهر</div>
        ) : (
          <div className="h-[180px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={steps} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {totals && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-center" data-testid="hiring-forecast">
            <div className="p-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30">
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums" dir="ltr">{fmt(totals.forecastNextMonth)}</div>
              <div className="text-[10px] text-muted-foreground">توقّع تعيينات الشهر القادم</div>
            </div>
            <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-950/30">
              <div className="text-base font-bold text-blue-700 dark:text-blue-400 tabular-nums" dir="ltr">{totals.conversionRate !== null ? `${totals.conversionRate}%` : "—"}</div>
              <div className="text-[10px] text-muted-foreground">معدّل التحويل (طلب→تعيين)</div>
            </div>
            <div className="p-2 rounded-md bg-violet-50 dark:bg-violet-950/30">
              <div className="text-base font-bold text-violet-700 dark:text-violet-400 tabular-nums" dir="ltr">{fmt(totals.hiresThisMonth)}</div>
              <div className="text-[10px] text-muted-foreground">تعيينات الشهر الحالي</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

// ============================================================================
// Main Page
// ============================================================================

export default function HRHubPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [refreshTick, setRefreshTick] = useState(0);

  // Pass branchId filter so all bundled KPIs respect the filter row
  const branchParam = branchFilter === "all" ? "" : `?branchId=${branchFilter}`;

  // Consolidated HR Hub bundle: replaces 11+ separate API calls with 1
  const { data: bundle, isLoading: statsLoading, isFetching: bundleFetching, refetch: refetchBundle } = useQuery<any>({
    queryKey: [`/api/hr/hub-bundle${branchParam}`],
    staleTime: 60_000,
  });

  // Derive everything from the bundle (fall back to empty defaults while loading)
  const employees: BranchEmployee[] = bundle?.employees ?? [];
  const branches: Branch[] = bundle?.branches ?? [];
  const applications: EmploymentApplication[] = bundle?.applications ?? [];
  const jobOffers: JobOffer[] = bundle?.jobOffers ?? [];
  const stats: EmployeeStats | undefined = bundle?.stats;
  const docStats = bundle?.docStats;
  const leaveStats = bundle?.leaveStats;
  const warningStats = bundle?.warningStats;
  const advanceStats = bundle?.advanceStats;
  const attendanceToday = bundle?.attendanceToday;
  const onboardingStats = bundle?.onboardingStats;
  const eosStats = bundle?.eosStats ?? { total: 0 };
  const salaryClosing: SalaryClosing | undefined = bundle?.salaryClosing;
  const comparisons = bundle?.comparisons;
  const charts = bundle?.charts;

  // Global refresh — invalidates the bundle + any peripheral HR caches
  const handleGlobalRefresh = () => {
    queryClient.invalidateQueries({ predicate: (q) => {
      const k = String(q.queryKey?.[0] || "");
      return k.startsWith("/api/hr/") || k.startsWith("/api/branch-employees") || k.startsWith("/api/attendance") || k.startsWith("/api/branches");
    }});
    refetchBundle();
    setRefreshTick((n) => n + 1);
  };

  // Bundle is already branch-scoped server-side; employees list IS the filtered list.
  const filteredEmployees = employees;
  const totalEmployees = stats?.totalEmployees ?? employees.length;
  const activeEmployees = stats?.activeEmployees ?? 0;
  const inactiveEmployees = stats?.inactiveEmployees ?? 0;
  const onLeaveCount = stats?.onLeaveCount ?? 0;
  const nationalitiesCount = stats?.nationalitiesCount ?? 0;

  const pendingApplications = useMemo(
    () =>
      applications.filter(
        (a) => !a.status || ["pending", "new", "submitted", "review"].includes(a.status),
      ).length,
    [applications],
  );

  const pendingOffers = useMemo(
    () =>
      jobOffers.filter(
        (o) => !o.status || ["pending", "sent", "draft"].includes(o.status),
      ).length,
    [jobOffers],
  );

  // Per-branch breakdown for donut — ACTIVE employees only so it matches
  // the "Active Employees" tile and the cost/salary calculations.
  const branchData = useMemo(() => {
    const map = new Map<string, number>();
    employees.forEach((e) => {
      if ((e.status || "active") !== "active") return;
      const b = branches.find((br) => br.id === e.branchId);
      const name = b?.nameAr || b?.name || `فرع #${e.branchId ?? "—"}`;
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [employees, branches]);

  const jobTitleData = useMemo(
    () =>
      (stats?.byJobTitle || []).map((j) => ({ name: j.jobTitle || "—", value: j.count })),
    [stats],
  );

  const nationalityData = useMemo(
    () =>
      (stats?.byNationality || []).map((n) => ({ name: n.nationality || "—", value: n.count })),
    [stats],
  );

  // ──────────────────────────────────────────────────────────────────────────
  // AI Insights (deterministic, refresh re-runs derivation)
  // ──────────────────────────────────────────────────────────────────────────
  const insights = useMemo<AIInsight[]>(() => {
    void refreshTick;
    const result: AIInsight[] = [];

    if (pendingApplications >= 5) {
      result.push({
        id: "apps-pile",
        icon: AlertTriangle,
        tone: "warning",
        title: `${fmt(pendingApplications)} طلب توظيف بانتظار المراجعة`,
        detail: "تراكم الطلبات قد يؤخر استكمال احتياجات التوظيف للفروع. يُنصح بمراجعتها أسبوعياً.",
        action: { label: "مراجعة الطلبات الآن", href: "/hr/applications" },
      });
    } else if (pendingApplications > 0) {
      result.push({
        id: "apps-light",
        icon: Briefcase,
        tone: "info",
        title: `${fmt(pendingApplications)} طلب توظيف جديد`,
        detail: "طلبات حديثة بانتظار التقييم الأولي.",
        action: { label: "فتح الطلبات", href: "/hr/applications" },
      });
    }

    if (pendingOffers > 0) {
      result.push({
        id: "offers",
        icon: UserCheck,
        tone: "info",
        title: `${fmt(pendingOffers)} عرض عمل بانتظار رد المرشحين`,
        detail: "تابع المرشحين قبل انتهاء صلاحية العروض لتفادي فقدانهم.",
        action: { label: "متابعة العروض", href: "/hr/job-offers" },
      });
    }

    if (totalEmployees > 0 && activeEmployees / totalEmployees < 0.85) {
      result.push({
        id: "inactive-high",
        icon: TrendingDown,
        tone: "warning",
        title: "نسبة الموظفين النشطين أقل من 85%",
        detail: `يوجد ${fmt(inactiveEmployees)} موظف غير نشط. راجع حالاتهم وحدّث ملفاتهم.`,
        action: { label: "فتح ملفات الموظفين", href: "/branch-employees" },
      });
    }

    if (attendanceToday && (((attendanceToday as any).expectedToday ?? attendanceToday.total) > 0)) {
      const rate = attendanceToday.attendanceRate || 0;
      if (rate < 90) {
        result.push({
          id: "attendance-low",
          icon: Clock,
          tone: rate < 80 ? "warning" : "info",
          title: `نسبة الحضور اليوم ${rate}%`,
          detail: `حاضر: ${fmt(attendanceToday.present)} | غائب: ${fmt(attendanceToday.absent)} | متأخر: ${fmt(attendanceToday.late)}`,
          action: { label: "لوحة الحضور", href: "/attendance-dashboard" },
        });
      }
    }

    // إقامات منتهية (أولوية امتثال السعودية)
    if ((docStats?.expiredIqama || 0) > 0) {
      result.push({
        id: "docs-iqama",
        icon: AlertTriangle,
        tone: "warning",
        title: `${fmt(docStats.expiredIqama)} إقامة منتهية الصلاحية`,
        detail: "تجديد الإقامات أولوية امتثال — التأخر قد يعرّض المنشأة لمخالفات.",
        action: { label: "تجديد الإقامات", href: "/hr/employee-documents?type=iqama&status=expired" },
      });
    }
    // شهادات صحية منتهية (لوزارة الصحة + بلدية)
    if ((docStats?.expiredHealth || 0) > 0) {
      result.push({
        id: "docs-health",
        icon: AlertTriangle,
        tone: "warning",
        title: `${fmt(docStats.expiredHealth)} شهادة صحية منتهية`,
        detail: "الشهادات الصحية إلزامية للعاملين في قطاع الأغذية — راجع تجديدها فوراً.",
        action: { label: "فتح الشهادات الصحية", href: "/hr/employee-documents?type=health_certificate&status=expired" },
      });
    }
    // باقي الوثائق المنتهية أو القاربة (عام)
    const otherExp = (docStats?.expired || 0) - (docStats?.expiredIqama || 0) - (docStats?.expiredHealth || 0);
    const soon = docStats?.expiringSoon || 0;
    if (otherExp + soon > 0) {
      result.push({
        id: "docs-expiry",
        icon: AlertTriangle,
        tone: otherExp > 0 ? "warning" : "info",
        title: otherExp > 0 ? `${fmt(otherExp)} وثيقة أخرى منتهية` : `${fmt(soon)} وثيقة قاربت على الانتهاء`,
        detail: `إجمالي ${fmt(otherExp + soon)} وثيقة (رخص، تأشيرات، شهادات تدريبية...) تحتاج متابعة خلال 30 يوماً.`,
        action: { label: "فتح وثائق الموظفين", href: "/hr/employee-documents" },
      });
    }

    if ((warningStats?.active || 0) >= 3) {
      result.push({
        id: "warnings-many",
        icon: ShieldAlert,
        tone: "warning",
        title: `${fmt(warningStats.active)} إنذار ساري`,
        detail: "تراكم الإنذارات يشير إلى مشكلة سلوكية أو إدارية تستدعي المراجعة.",
        action: { label: "مراجعة الإنذارات", href: "/hr/warnings" },
      });
    }

    if (stats?.totalSalaries && stats.totalSalaries > 0 && activeEmployees > 0) {
      const avg = stats.totalSalaries / activeEmployees;
      result.push({
        id: "avg-salary",
        icon: Wallet,
        tone: "info",
        title: `متوسط صافي الراتب: ${fmtMoney(avg)} ر.س`,
        detail: "صافي فاتورة الرواتب (بعد الغياب والخصومات) مقسومة على عدد الموظفين النشطين.",
        action: { label: "فتح تقرير الرواتب", href: "/employee-reports" },
      });
    }

    if (branchData.length > 1) {
      const sorted = [...branchData].sort((a, b) => b.value - a.value);
      const top = sorted[0];
      const bottom = sorted[sorted.length - 1];
      if (top && bottom && top.value > bottom.value * 2) {
        result.push({
          id: "branch-imbalance",
          icon: Building,
          tone: "warning",
          title: `توزيع غير متوازن بين الفروع`,
          detail: `"${top.name}" لديه ${fmt(top.value)} موظف بينما "${bottom.name}" لديه ${fmt(bottom.value)} فقط. أعد النظر في التوزيع.`,
          action: { label: "الهيكل التنظيمي", href: "/organizational-structure" },
        });
      }
    }

    return result.slice(0, 5);
  }, [pendingApplications, pendingOffers, totalEmployees, activeEmployees, inactiveEmployees, stats, branchData, attendanceToday, docStats, warningStats, refreshTick]);

  // ──────────────────────────────────────────────────────────────────────────
  // AI Insights (ChatGPT / OpenAI) — يستبدل الرؤى المحلية حين يتوفر مفتاح OpenAI
  // ──────────────────────────────────────────────────────────────────────────
  const aiIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    AlertTriangle, Briefcase, UserCheck, TrendingDown, TrendingUp,
    Clock, ShieldAlert, Wallet, Building, Lightbulb,
    Users, Calendar, FileWarning, Award, Target,
  };

  const aiSnapshot = useMemo(() => {
    if (!bundle) return null;
    return {
      totals: {
        totalEmployees,
        activeEmployees,
        inactiveEmployees,
        totalSalaries: stats?.totalSalaries || 0,
        avgSalary: activeEmployees > 0 ? Math.round((stats?.totalSalaries || 0) / activeEmployees) : 0,
      },
      recruitment: {
        pendingApplications,
        pendingOffers,
      },
      documents: {
        expired: docStats?.expired || 0,
        expiredIqama: docStats?.expiredIqama || 0,
        expiredHealth: docStats?.expiredHealth || 0,
        expiringSoon: docStats?.expiringSoon || 0,
      },
      warnings: { active: warningStats?.active || 0 },
      advances: { total: advanceStats?.total || 0 },
      leaves: { pending: leaveStats?.pending || 0 },
      attendanceToday: attendanceToday
        ? {
            attendanceRate: attendanceToday.attendanceRate || 0,
            present: attendanceToday.present || 0,
            absent: attendanceToday.absent || 0,
            late: attendanceToday.late || 0,
            // Prefer the realistic expected denominator (active workforce) for
            // AI prompting; fall back to `total` for older payloads.
            total: (attendanceToday as any).expectedToday ?? attendanceToday.total ?? 0,
          }
        : null,
      branches: branchData.slice(0, 10).map((b) => ({ name: b.name, employees: b.value })),
      comparisons: comparisons || null,
      branchFilter: branchFilter === "all" ? "كل الفروع" : branchFilter,
      generatedAt: new Date().toISOString(),
    };
  }, [bundle, totalEmployees, activeEmployees, inactiveEmployees, stats, pendingApplications, pendingOffers, docStats, warningStats, advanceStats, leaveStats, attendanceToday, branchData, comparisons, branchFilter]);

  const {
    data: aiData,
    isFetching: aiFetching,
    error: aiQueryError,
    refetch: refetchAI,
  } = useQuery<{ insights: Array<{ id: string; iconName: string; tone: AIInsight["tone"]; title: string; detail: string; action?: { label: string; href: string } }>; model?: string }>({
    queryKey: ["/api/hr/ai-insights", branchFilter],
    enabled: false, // Manual-only — triggered by button click to control OpenAI cost
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    // Inline error UI ("تعذّر الاتصال بالمساعد الذكي") already shown by the AI card —
    // suppress the global DataErrorBanner so the user isn't nagged twice.
    meta: { silentError: true },
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/hr/ai-insights", { snapshot: aiSnapshot });
      return res.json();
    },
  });

  const aiInsights: AIInsight[] | null = useMemo(() => {
    if (!aiData?.insights?.length) return null;
    return aiData.insights.map((x) => ({
      id: x.id,
      icon: aiIconMap[x.iconName] || Lightbulb,
      tone: x.tone,
      title: x.title,
      detail: x.detail,
      action: x.action,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiData]);

  const aiErrMessage = aiQueryError
    ? ((aiQueryError as any)?.message?.includes("AI_NOT_CONFIGURED")
        ? "المساعد الذكي غير مفعّل"
        : "تعذّر الاتصال بالمساعد الذكي")
    : null;

  const effectiveInsights = aiInsights ?? insights;
  const aiPoweredBy: "ai" | "fallback" = aiInsights ? "ai" : "fallback";

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="p-3 sm:p-4 lg:p-5 2xl:p-6 space-y-3 sm:space-y-4 max-w-[1920px] mx-auto" dir="rtl" data-testid="page-hr-hub">
        {/* Header */}
        <PageHeader
          icon={UsersRound}
          tone="people"
          title="مركز الموارد البشرية"
          description="HR HUB — لوحة موحّدة لإدارة الموظفين، الحضور، الرواتب، التوظيف، والمستندات"
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGlobalRefresh}
              disabled={bundleFetching}
              data-testid="button-refresh-hub"
              className="gap-1.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", bundleFetching && "animate-spin")} />
              {bundleFetching ? "جارٍ التحديث..." : "تحديث البيانات"}
            </Button>
          }
        />

        {/* Filter Row — responsive: stacks on mobile, inline on tablet+ */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 bg-white dark:bg-card border border-gray-100 dark:border-border rounded-xl p-2.5 sm:p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <Filter className="w-3.5 h-3.5" />
              تصفية:
            </div>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="h-8 w-full sm:w-[180px] min-w-[140px] text-sm" data-testid="select-branch-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.nameAr || b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:ms-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs border-t sm:border-t-0 border-gray-100 dark:border-border pt-2 sm:pt-0">
            <span className="inline-flex items-center gap-1">
              <span className="text-muted-foreground">إجمالي:</span>
              <span className="font-bold text-gray-900 dark:text-foreground tabular-nums" dir="ltr">{fmt(totalEmployees)}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <UserCheck className="w-3 h-3" aria-hidden="true" /> <span className="sr-only sm:not-sr-only">نشطون:</span><span className="font-bold tabular-nums" dir="ltr" aria-label={`عدد النشطين ${fmt(activeEmployees)}`}>{fmt(activeEmployees)}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
              <CalendarDays className="w-3 h-3" aria-hidden="true" /> <span className="sr-only sm:not-sr-only">في إجازة:</span><span className="font-bold tabular-nums" dir="ltr" aria-label={`في إجازة ${fmt(onLeaveCount)}`}>{fmt(onLeaveCount)}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-400">
              <UsersRound className="w-3 h-3" aria-hidden="true" /> <span className="sr-only sm:not-sr-only">جنسيات:</span><span className="font-bold tabular-nums" dir="ltr" aria-label={`عدد الجنسيات ${fmt(nationalitiesCount)}`}>{fmt(nationalitiesCount)}</span>
            </span>
          </div>
        </div>

        {statsLoading && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-1">
            <Loader2 className="w-4 h-4 animate-spin" />
            جاري تحميل البيانات...
          </div>
        )}

        {/* Dense KPI Grid — 2 cols mobile → 3 sm → 4 md → 5 lg → 6 xl → 7 2xl */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 sm:gap-2.5">
          <StatTile testId="tile-active"          value={activeEmployees}        label="الموظفون النشطون"        icon={UserCheck}      tone="teal"     href="/branch-employees?status=active"
            delta={comparisons?.hires?.delta} deltaLabel="تعيينات الشهر" />
          <StatTile testId="tile-inactive"        value={inactiveEmployees}      label="غير نشطين / موقوفون"     icon={UserX}          tone="slate"    href="/branch-employees?status=inactive" />
          <StatTile
            testId="tile-salaries"
            value={fmtMoney(stats?.salaryInvoice?.net ?? stats?.totalSalaries ?? 0)}
            suffix="ر.س"
            label="صافي فاتورة الرواتب (النشطون)"
            icon={Wallet}
            tone="emerald"
            href="/employee-reports"
            tooltip={stats?.salaryInvoice
              ? `الإجمالي: ${fmtMoney(stats.salaryInvoice.gross)} ر.س — خصومات: ${fmtMoney(stats.salaryInvoice.manualDeductions)} ر.س — غياب: ${fmtMoney(stats.salaryInvoice.absenceDeduction)} ر.س — موظفون نشطون: ${fmt(stats.salaryInvoice.activeEmployees)}`
              : undefined}
          />
          <StatTile testId="tile-applications"    value={pendingApplications}    label="طلبات توظيف معلّقة"     icon={Briefcase}      tone="violet"   href="/hr/applications"
            delta={comparisons?.applications?.deltaPct ?? null} deltaIsPercent deltaLabel="مقارنة بالشهر السابق" />
          <StatTile testId="tile-offers"          value={pendingOffers}          label="عروض عمل بانتظار رد"    icon={UserPlus}       tone="indigo"   href="/hr/job-offers" />
          <StatTile testId="tile-onboarding"      value={(onboardingStats?.pending || 0) + (onboardingStats?.sent || 0)} label="مباشرة عمل قيد التنفيذ" icon={ClipboardCheck} tone="cyan"     href="/hr/onboarding" />
          <StatTile
            testId="tile-attendance"
            value={attendanceToday?.present ?? 0}
            suffix={attendanceToday
              ? `/ ${fmt((attendanceToday as any).expectedToday ?? attendanceToday.total ?? 0)}`
              : undefined}
            label="حضور اليوم (من النشطين)"
            icon={Clock}
            tone="blue"
            href="/attendance-dashboard"
            tooltip={attendanceToday
              ? `حاضر: ${fmt(attendanceToday.present || 0)} — متأخر: ${fmt(attendanceToday.late || 0)} — غائب: ${fmt(attendanceToday.absent || 0)} — مسجّل اليوم: ${fmt(attendanceToday.total || 0)} — المتوقع (النشطون): ${fmt((attendanceToday as any).expectedToday ?? 0)}`
              : undefined}
          />
          <StatTile testId="tile-attendance-rate" value={`${attendanceToday?.attendanceRate ?? 0}%`} label="نسبة الحضور اليوم"      icon={TrendingUp}     tone="emerald"  href="/attendance-dashboard"
            delta={comparisons?.attendanceRate?.delta} deltaIsPercent target={comparisons?.attendanceRate?.target} />
          <StatTile testId="tile-doc-expired"     value={(docStats?.expired || 0) + (docStats?.expiringSoon || 0)} label="وثائق منتهية / قاربت" icon={AlertTriangle}  tone="rose"     href="/hr/employee-documents" />
          <StatTile testId="tile-leaves"          value={leaveStats?.pending || 0} label="طلبات إجازات معلّقة"    icon={CalendarDays}   tone="amber"    href="/hr/leaves" />
          <StatTile testId="tile-warnings"        value={warningStats?.active || 0} label="إنذارات سارية"          icon={ShieldAlert}    tone="rose"     href="/hr/warnings" />
          <StatTile testId="tile-advances"        value={advanceStats?.total || 0} label="سلف مسجّلة"             icon={TrendingDown}   tone="orange"   href="/hr/advances"
            delta={comparisons?.advances?.deltaPct ?? null} deltaIsPercent deltaInverted deltaLabel="مقارنة بالشهر السابق" />
          <StatTile testId="tile-eos"             value={eosStats.total}         label="حسابات نهاية الخدمة"    icon={FileText}       tone="lime"     href="/hr/eos" />
          <StatTile testId="tile-evaluations"     value="فتح"                    label="تقييم الأداء الدوري"    icon={ClipboardCheck} tone="violet"   href="/hr/evaluations" />
          <StatTile testId="tile-cashier-deficits" value="فتح"                   label="عجوزات الكاشير"         icon={TrendingDown}   tone="orange"   href="/hr-cashier-deficits" />
          <StatTile testId="tile-branches"        value={branches.length}        label="إجمالي الفروع"          icon={Building}       tone="teal"     href="/branches" />
        </div>

        {/* Row 1: 3 donut charts — 1 col mobile, 2 cols tablet, 3 cols laptop+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
          <DonutCard
            testId="chart-branches"
            title="التوزيع حسب الفرع"
            icon={Building}
            data={branchData}
            emptyText="لا توجد بيانات فروع"
          />
          <DonutCard
            testId="chart-jobs"
            title="التوزيع حسب المسمى الوظيفي"
            icon={Briefcase}
            data={jobTitleData}
            emptyText="لا توجد مسميات"
          />
          <DonutCard
            testId="chart-nationalities"
            title="التوزيع حسب الجنسية"
            icon={UsersRound}
            data={nationalityData}
            emptyText="لا توجد بيانات"
          />
        </div>

        {/* Row 1b: 3 NEW analytical charts — weekly attendance, cost breakdown, hiring funnel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
          <WeeklyAttendanceChart data={charts?.weeklyAttendance} />
          <CostBreakdownChart data={charts?.costBreakdown} />
          <HiringFunnelChart data={charts?.hiringFunnel} />
        </div>

        {/* Row 2: 3 action widgets — 1 col mobile, 2 cols tablet, 3 cols laptop+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
          <SalaryClosingCard data={salaryClosing} />
          <WhatsAppQuickSend employees={employees} branches={branches} />
          <AIInsightsCard
            insights={effectiveInsights}
            onRefresh={() => { setRefreshTick((t) => t + 1); refetchAI(); }}
            isAILoading={aiFetching}
            aiError={aiErrMessage}
            aiPoweredBy={aiPoweredBy}
          />
        </div>

        {/* Quick Access Grid (compact) */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-gray-500" />
              <CardTitle className="text-sm font-semibold">الوصول السريع للأقسام</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 xl:grid-cols-12 gap-2">
              {[
                { href: "/branch-employees",       label: "موظفو الفروع",         icon: Users,          tone: "teal" as TileTone },
                { href: "/attendance-dashboard",   label: "الحضور والورديات",     icon: Clock,          tone: "blue" as TileTone },
                { href: "/employee-reports",       label: "تقارير الرواتب",       icon: FileBarChart,   tone: "emerald" as TileTone },
                { href: "/hr/applications",        label: "طلبات التوظيف",        icon: Briefcase,      tone: "violet" as TileTone },
                { href: "/incentives-management",  label: "إدارة الحوافز",        icon: Gift,           tone: "pink" as TileTone },
                { href: "/organizational-structure", label: "الهيكل التنظيمي",   icon: Building,       tone: "indigo" as TileTone },
                { href: "/operations-employees",   label: "موظفو التشغيل",        icon: Users,          tone: "orange" as TileTone },
                { href: "/terminated-employees",   label: "المستقيلون",           icon: UserX,          tone: "slate" as TileTone },
                { href: "/biometric-settings",     label: "إعدادات البصمة",       icon: ShieldAlert,    tone: "rose" as TileTone },
                { href: "/hr/employee-documents",  label: "وثائق الموظفين",       icon: FolderOpen,     tone: "amber" as TileTone },
                { href: "/notifications-center",   label: "مركز الإشعارات",       icon: Bell,           tone: "cyan" as TileTone },
                { href: "/floor-plan",             label: "مخطط أرضية الفرع",     icon: PieChartIcon,   tone: "lime" as TileTone },
              ].map((item) => {
                const t = TONE_MAP[item.tone];
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => navigate(item.href)}
                    className="group flex flex-col items-center gap-1.5 p-2 sm:p-2.5 lg:p-3 rounded-xl border border-gray-100 dark:border-border hover:border-gray-200 hover:shadow-sm hover:-translate-y-0.5 transition-all bg-white dark:bg-card min-h-[80px] justify-center"
                    data-testid={`quick-${item.href.replace(/[\/:]/g, "-")}`}
                  >
                    <div className={cn("w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ring-1 shrink-0", t.iconBg, t.iconColor, t.ring)}>
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-[10px] sm:text-[11px] text-gray-700 dark:text-foreground/90 text-center leading-tight group-hover:text-primary transition-colors line-clamp-2">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
