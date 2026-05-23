import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
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
  User,
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

type EmployeeStats = {
  totalEmployees: number;
  totalSalaries: number;
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
  gender?: string | null;
  status?: string;
  branchId?: number | string;
  jobTitle?: string;
  nationality?: string;
};

type Branch = { id: number; name: string; nameAr?: string };
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
}

function StatTile({ value, label, icon: Icon, tone, suffix, href, comingSoon, testId }: StatTileProps) {
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
}

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

function DonutCard({ title, icon: Icon, data, testId, emptyText }: DonutCardProps) {
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
}

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

function WhatsAppQuickSend({ employees }: { employees: BranchEmployee[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("custom");
  const [message, setMessage] = useState<string>("");
  const [search, setSearch] = useState("");

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

  const applyTemplate = (tid: string) => {
    setTemplateId(tid);
    const tpl = MESSAGE_TEMPLATES.find((t) => t.id === tid);
    if (tpl && tid !== "custom") {
      setMessage(tpl.body(recipientName));
    }
  };

  const canSend = !!recipientPhone && message.trim().length > 0 && !sendMutation.isPending;

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
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700 dark:text-foreground/90">المستلم</label>
          <Input
            placeholder="ابحث بالاسم أو رقم الجوال..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 text-sm"
            data-testid="input-whatsapp-search"
          />
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="h-9 text-sm" data-testid="select-whatsapp-recipient">
              <SelectValue placeholder="اختر موظفاً" />
            </SelectTrigger>
            <SelectContent>
              {filteredEmployees.length === 0 && (
                <div className="py-2 px-3 text-xs text-muted-foreground">لا توجد نتائج</div>
              )}
              {filteredEmployees.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{e.employeeName || e.fullNameArabic || e.fullName || `#${e.id}`}</span>
                    <span className="text-[10px] text-muted-foreground" dir="ltr">
                      {e.phoneNumber || e.mobile}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
            placeholder="اكتب نص الرسالة..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="text-sm resize-none"
            data-testid="textarea-whatsapp-message"
          />
          <p className="text-[10px] text-muted-foreground">{message.length}/1000 حرف</p>
        </div>

        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => sendMutation.mutate()}
          disabled={!canSend}
          data-testid="button-send-whatsapp"
        >
          {sendMutation.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> جاري الإرسال...</>
          ) : (
            <><Send className="w-4 h-4" /> إرسال عبر واتساب</>
          )}
        </Button>

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

function AIInsightsCard({ insights, onRefresh }: { insights: AIInsight[]; onRefresh: () => void }) {
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
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">رؤى وتوصيات مبنية على بياناتك</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onRefresh}
            data-testid="button-refresh-insights"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
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
// Main Page
// ============================================================================

export default function HRHubPage() {
  const [, navigate] = useLocation();
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [refreshTick, setRefreshTick] = useState(0);

  const { data: stats, isLoading: statsLoading } = useQuery<EmployeeStats>({
    queryKey: ["/api/branch-employees/stats"],
    staleTime: 60_000,
  });

  const { data: employees = [] } = useQuery<BranchEmployee[]>({
    queryKey: ["/api/branch-employees"],
    staleTime: 60_000,
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    staleTime: 5 * 60_000,
  });

  const { data: applications = [] } = useQuery<EmploymentApplication[]>({
    queryKey: ["/api/hr/applications"],
    staleTime: 60_000,
  });

  const { data: jobOffers = [] } = useQuery<JobOffer[]>({
    queryKey: ["/api/hr/job-offers"],
    staleTime: 60_000,
  });

  // HR Phase 3: live counters for the new sub-modules
  const { data: docStats } = useQuery<any>({ queryKey: ["/api/hr/documents/stats"], staleTime: 60_000 });
  const { data: leaveStats } = useQuery<any>({ queryKey: ["/api/hr/leaves/stats"], staleTime: 60_000 });
  const { data: warningStats } = useQuery<any>({ queryKey: ["/api/hr/warnings/stats"], staleTime: 60_000 });
  const { data: advanceStats } = useQuery<any>({ queryKey: ["/api/hr/advances/stats"], staleTime: 60_000 });

  // Filter employees by selected branch
  const filteredEmployees = useMemo(() => {
    if (branchFilter === "all") return employees;
    return employees.filter((e) => String(e.branchId) === branchFilter);
  }, [employees, branchFilter]);

  // Derived counts — when a branch is selected, trust the filtered list (may be 0).
  // Only fall back to stats endpoint when employees list hasn't loaded yet AND no filter active.
  const totalEmployees =
    branchFilter !== "all"
      ? filteredEmployees.length
      : employees.length > 0
        ? employees.length
        : stats?.totalEmployees ?? 0;
  const activeEmployees = useMemo(
    () => filteredEmployees.filter((e) => (e.status || "active") === "active").length,
    [filteredEmployees],
  );
  const inactiveEmployees = totalEmployees - activeEmployees;

  const menCount = useMemo(
    () => filteredEmployees.filter((e) => ["male", "ذكر", "M", "m"].includes((e.gender || "").toString())).length,
    [filteredEmployees],
  );
  const womenCount = useMemo(
    () => filteredEmployees.filter((e) => ["female", "أنثى", "F", "f"].includes((e.gender || "").toString())).length,
    [filteredEmployees],
  );

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

  // Per-branch breakdown for donut
  const branchData = useMemo(() => {
    const map = new Map<string, number>();
    employees.forEach((e) => {
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

    if (totalEmployees > 0 && menCount > 0 && womenCount > 0) {
      const ratio = (womenCount / totalEmployees) * 100;
      result.push({
        id: "diversity",
        icon: Users,
        tone: "success",
        title: `التوزيع: ${fmt(menCount)} رجال / ${fmt(womenCount)} نساء`,
        detail: `نسبة الموظفات الحالية ${ratio.toFixed(0)}%. حافظ على التنوع كميزة تنافسية.`,
      });
    }

    if (stats?.totalSalaries && stats.totalSalaries > 0 && totalEmployees > 0) {
      const avg = stats.totalSalaries / totalEmployees;
      result.push({
        id: "avg-salary",
        icon: Wallet,
        tone: "info",
        title: `متوسط الراتب: ${fmtMoney(avg)} ر.س`,
        detail: "قيمة فاتورة الرواتب الإجمالية مقسومة على عدد الموظفين الحاليين.",
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
  }, [pendingApplications, pendingOffers, totalEmployees, activeEmployees, inactiveEmployees, menCount, womenCount, stats, branchData, refreshTick]);

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="p-3 sm:p-5 space-y-4" dir="rtl" data-testid="page-hr-hub">
        {/* Header */}
        <PageHeader
          icon={UsersRound}
          tone="people"
          title="مركز الموارد البشرية"
          description="HR HUB — لوحة موحّدة لإدارة الموظفين، الحضور، الرواتب، التوظيف، والمستندات"
        />

        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-card border border-gray-100 dark:border-border rounded-xl p-2.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="w-3.5 h-3.5" />
            تصفية:
          </div>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="h-8 w-[180px] text-sm" data-testid="select-branch-filter">
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
          <div className="ms-auto flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">إجمالي:</span>
            <span className="font-bold text-gray-900 dark:text-foreground tabular-nums" dir="ltr">{fmt(totalEmployees)}</span>
            <span className="text-gray-400">|</span>
            <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400">
              <User className="w-3 h-3" /> رجال: <span className="font-bold tabular-nums" dir="ltr">{fmt(menCount)}</span>
            </span>
            <span className="text-gray-400">|</span>
            <span className="inline-flex items-center gap-1 text-pink-700 dark:text-pink-400">
              <User className="w-3 h-3" /> نساء: <span className="font-bold tabular-nums" dir="ltr">{fmt(womenCount)}</span>
            </span>
          </div>
        </div>

        {statsLoading && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-1">
            <Loader2 className="w-4 h-4 animate-spin" />
            جاري تحميل البيانات...
          </div>
        )}

        {/* Dense KPI Grid (ExactFlow style) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
          <StatTile testId="tile-active"          value={activeEmployees}        label="الموظفون النشطون"        icon={UserCheck}      tone="teal"     href="/branch-employees" />
          <StatTile testId="tile-inactive"        value={inactiveEmployees}      label="غير نشطين / موقوفون"     icon={UserX}          tone="slate"    href="/terminated-employees" />
          <StatTile testId="tile-salaries"        value={fmtMoney(stats?.totalSalaries || 0)} suffix="ر.س" label="فاتورة الرواتب الشهرية" icon={Wallet}         tone="emerald"  href="/employee-reports" />
          <StatTile testId="tile-applications"    value={pendingApplications}    label="طلبات توظيف معلّقة"     icon={Briefcase}      tone="violet"   href="/hr/applications" />
          <StatTile testId="tile-offers"          value={pendingOffers}          label="عروض عمل بانتظار رد"    icon={UserPlus}       tone="indigo"   href="/hr/job-offers" />
          <StatTile testId="tile-onboarding"      value={0}                      label="مباشرة عمل قيد التنفيذ" icon={ClipboardCheck} tone="cyan"     href="/hr/onboarding" />
          <StatTile testId="tile-attendance"      value={activeEmployees}        label="حضور اليوم (نشطون)"     icon={Clock}          tone="blue"     href="/attendance-dashboard" />
          <StatTile testId="tile-timesheet"       value="—"                      label="تايم شيت الفترة"        icon={Calendar}       tone="indigo"   href="/timesheet" />
          <StatTile testId="tile-incentives"      value="—"                      label="حوافز قيد الاعتماد"     icon={Gift}           tone="pink"     href="/incentives-management" />
          <StatTile testId="tile-doc-expired"     value={(docStats?.expired || 0) + (docStats?.expiringSoon || 0)} label="وثائق منتهية / قاربت" icon={AlertTriangle}  tone="rose"     href="/hr/employee-documents" />
          <StatTile testId="tile-leaves"          value={leaveStats?.pending || 0} label="طلبات إجازات معلّقة"    icon={CalendarDays}   tone="amber"    href="/hr/leaves" />
          <StatTile testId="tile-warnings"        value={warningStats?.active || 0} label="إنذارات سارية"          icon={ShieldAlert}    tone="rose"     href="/hr/warnings" />
          <StatTile testId="tile-advances"        value={advanceStats?.total || 0} label="سلف مسجّلة"             icon={TrendingDown}   tone="orange"   href="/hr/advances" />
          <StatTile testId="tile-eos"             value={0}                      label="حسابات نهاية الخدمة"    icon={FileText}       tone="lime"     href="/hr/eos" />
          <StatTile testId="tile-branches"        value={branches.length}        label="عدد الفروع النشطة"      icon={Building}       tone="teal"     href="/branches" />
        </div>

        {/* Two-column area: charts + side widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: 3 donut charts (2/3 width) */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
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

          {/* Right: WhatsApp + AI widgets */}
          <div className="space-y-3">
            <WhatsAppQuickSend employees={employees} />
            <AIInsightsCard insights={insights} onRefresh={() => setRefreshTick((t) => t + 1)} />
          </div>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
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
                { href: "/documents",              label: "المستندات",            icon: FolderOpen,     tone: "amber" as TileTone },
                { href: "/notifications-center",   label: "مركز الإشعارات",       icon: Bell,           tone: "cyan" as TileTone },
                { href: "/floor-plan",             label: "مخطط أرضية الفرع",     icon: PieChartIcon,   tone: "lime" as TileTone },
              ].map((item) => {
                const t = TONE_MAP[item.tone];
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => navigate(item.href)}
                    className="group flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-100 dark:border-border hover:border-gray-200 hover:shadow-sm hover:-translate-y-0.5 transition-all bg-white dark:bg-card"
                    data-testid={`quick-${item.href.replace(/[\/:]/g, "-")}`}
                  >
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center ring-1", t.iconBg, t.iconColor, t.ring)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] text-gray-700 dark:text-foreground/90 text-center leading-tight group-hover:text-primary transition-colors">
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
