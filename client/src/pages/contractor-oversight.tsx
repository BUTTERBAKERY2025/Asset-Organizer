import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  ShieldAlert,
  Info,
  TrendingUp,
  Users,
  FileSignature,
  Wallet,
  Award,
  Clock,
  Search,
  ChevronLeft,
  ExternalLink,
  Star,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";

type Alert = {
  id: string;
  severity: "critical" | "warning" | "info";
  type: string;
  contractorId: number;
  contractorName: string;
  contractId: number;
  contractNumber: string | null;
  title: string;
  description: string;
  amount?: number | null;
  dueDate?: string | null;
};

type ContractorRow = {
  id: number;
  name: string;
  phone: string;
  email: string;
  score: number;
  grade: string;
  gradeColor: string;
  scoreReasons: string[];
  activeContracts: number;
  completedContracts: number;
  totalContractsValue: number;
  totalPaid: number;
  paymentProgress: number;
  overdueMilestones: number;
  dueSoonMilestones: number;
  activeGuarantees: number;
  expiringGuarantees: number;
  totalLD: number;
  ldAppliedCount: number;
  pendingVariations: number;
  approvedVariations: number;
  contractsCount: number;
};

type Kpis = {
  totalContractors: number;
  activeContractors: number;
  totalActiveContracts: number;
  totalActiveValue: number;
  totalPaid: number;
  totalAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  topPerformer: string | null;
  topPerformerScore: number | null;
};

type OversightResponse = {
  contractors: ContractorRow[];
  alerts: Alert[];
  kpis: Kpis;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(n || 0);

const sevConfig = {
  critical: {
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-red-300 dark:border-red-800",
    text: "text-red-800 dark:text-red-300",
    badge: "bg-red-600 text-white",
    icon: ShieldAlert,
    label: "حرج",
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-300 dark:border-amber-800",
    text: "text-amber-800 dark:text-amber-300",
    badge: "bg-amber-500 text-white",
    icon: AlertTriangle,
    label: "تحذير",
  },
  info: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-300 dark:border-blue-800",
    text: "text-blue-800 dark:text-blue-300",
    badge: "bg-blue-500 text-white",
    icon: Info,
    label: "للعلم",
  },
};

const gradeStyles: Record<string, { bar: string; text: string; bg: string }> = {
  green: { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
  blue: { bar: "bg-blue-500", text: "text-blue-700 dark:text-blue-300", bg: "bg-blue-50 dark:bg-blue-950/40" },
  yellow: { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/40" },
  red: { bar: "bg-red-500", text: "text-red-700 dark:text-red-300", bg: "bg-red-50 dark:bg-red-950/40" },
};

function StarRating({ score }: { score: number }) {
  const stars = Math.round((score / 100) * 5);
  return (
    <div className="flex items-center gap-0.5" data-testid={`stars-${score}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= stars ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
        />
      ))}
    </div>
  );
}

export default function ContractorOversightPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("overview");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const { data, isLoading, error } = useQuery<OversightResponse>({
    queryKey: ["/api/construction/oversight"],
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const filteredContractors = useMemo(() => {
    if (!data) return [];
    const q = search.trim();
    return data.contractors.filter((c) => !q || c.name.includes(q));
  }, [data, search]);

  const filteredAlerts = useMemo(() => {
    if (!data) return [];
    return data.alerts.filter((a) => severityFilter === "all" || a.severity === severityFilter);
  }, [data, severityFilter]);

  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 md:p-6 space-y-4" dir="rtl">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="p-6" dir="rtl">
          <Card className="border-red-300">
            <CardContent className="pt-6 text-center text-red-600">
              تعذّر تحميل بيانات الرقابة. حاول التحديث.
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const { kpis, contractors, alerts } = data;

  return (
    <Layout>
    <div className="page-container space-y-5" dir="rtl" data-testid="page-contractor-oversight">
      <PageHeader
        icon={Award}
        tone="construction"
        title="لوحة رقابة المقاولين"
        description="تقييم أداء آلي وتنبيهات استباقية لجميع العقود الإنشائية"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/contracts">
              <Button variant="outline" size="sm" data-testid="link-contracts">
                العقود <ChevronLeft className="h-4 w-4 mr-1" />
              </Button>
            </Link>
            <Link href="/contractors">
              <Button variant="outline" size="sm" data-testid="link-contractors">
                المقاولون <ChevronLeft className="h-4 w-4 mr-1" />
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <KpiCard
          icon={Users}
          label="المقاولون النشطون"
          value={`${kpis.activeContractors} / ${kpis.totalContractors}`}
          color="from-indigo-500 to-indigo-600"
          testId="kpi-contractors"
        />
        <KpiCard
          icon={FileSignature}
          label="عقود نشطة"
          value={String(kpis.totalActiveContracts)}
          color="from-emerald-500 to-emerald-600"
          testId="kpi-active-contracts"
        />
        <KpiCard
          icon={Wallet}
          label="القيمة النشطة (ر.س)"
          value={fmt(kpis.totalActiveValue)}
          color="from-amber-500 to-orange-600"
          testId="kpi-active-value"
        />
        <KpiCard
          icon={ShieldAlert}
          label="تنبيهات حرجة"
          value={String(kpis.criticalAlerts)}
          color={kpis.criticalAlerts > 0 ? "from-red-500 to-red-600" : "from-gray-400 to-gray-500"}
          subtitle={`${kpis.warningAlerts} تحذير`}
          testId="kpi-critical-alerts"
        />
        <KpiCard
          icon={Award}
          label="أعلى مقاول"
          value={kpis.topPerformer || "—"}
          color="from-violet-500 to-violet-600"
          subtitle={kpis.topPerformerScore != null ? `${kpis.topPerformerScore} نقطة` : ""}
          testId="kpi-top-performer"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full md:w-auto grid-cols-2">
          <TabsTrigger value="overview" data-testid="tab-overview">المقاولون والأداء</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            التنبيهات
            {alerts.length > 0 && (
              <Badge className="mr-2 bg-red-500 text-white">{alerts.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Contractors */}
        <TabsContent value="overview" className="space-y-3 mt-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث باسم المقاول..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
                data-testid="input-search-contractor"
              />
            </div>
            <Badge variant="outline">{filteredContractors.length} مقاول</Badge>
          </div>

          {filteredContractors.length === 0 ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">لا توجد بيانات لعرضها</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filteredContractors.map((c, idx) => (
                <ContractorCard key={c.id} contractor={c} rank={idx + 1} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Alerts */}
        <TabsContent value="alerts" className="space-y-3 mt-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "critical", "warning", "info"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={severityFilter === s ? "default" : "outline"}
                onClick={() => setSeverityFilter(s)}
                data-testid={`filter-severity-${s}`}
              >
                {s === "all" ? `الكل (${alerts.length})` :
                 s === "critical" ? `حرج (${kpis.criticalAlerts})` :
                 s === "warning" ? `تحذير (${kpis.warningAlerts})` :
                 `للعلم (${alerts.length - kpis.criticalAlerts - kpis.warningAlerts})`}
              </Button>
            ))}
          </div>

          {filteredAlerts.length === 0 ? (
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <Award className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold">لا توجد تنبيهات بهذا التصنيف</p>
                <p className="text-sm text-muted-foreground">العمل سليم</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredAlerts.map((a) => <AlertCard key={a.id} alert={a} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
    </Layout>
  );
}

function KpiCard({
  icon: Icon, label, value, color, subtitle, testId,
}: {
  icon: any; label: string; value: string; color: string; subtitle?: string; testId: string;
}) {
  return (
    <Card className="overflow-hidden border-0 shadow-md" data-testid={testId}>
      <div className={`h-1.5 bg-gradient-to-r ${color}`} />
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-xl font-bold truncate" title={value}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-gradient-to-br ${color} text-white shadow-sm`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ContractorCard({ contractor: c, rank }: { contractor: ContractorRow; rank: number }) {
  const gs = gradeStyles[c.gradeColor] || gradeStyles.red;
  const issues = c.overdueMilestones + c.expiringGuarantees + c.ldAppliedCount;

  return (
    <Card className="hover:shadow-lg transition-shadow border-0 shadow-md" data-testid={`card-contractor-${c.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl ${gs.bg} shrink-0`}>
              <span className={`text-lg font-bold ${gs.text}`}>{c.score}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base truncate" data-testid={`text-name-${c.id}`}>{c.name}</h3>
                {rank <= 3 && (
                  <Badge className="bg-gradient-to-r from-amber-400 to-amber-600 text-white text-xs">
                    #{rank}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <StarRating score={c.score} />
                <Badge className={`${gs.bg} ${gs.text} border-0 text-xs`} data-testid={`badge-grade-${c.id}`}>
                  {c.grade}
                </Badge>
              </div>
            </div>
          </div>
          {issues > 0 && (
            <Badge className="bg-red-100 text-red-700 border-red-200 shrink-0">
              <AlertTriangle className="h-3 w-3 ml-1" />
              {issues} مشكلة
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Score bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">الأداء</span>
            <span className="font-semibold">{c.score} / 100</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${gs.bar} transition-all`}
              style={{ width: `${c.score}%` }}
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="عقود نشطة" value={c.activeContracts} testId={`stat-active-${c.id}`} />
          <Stat label="مكتملة" value={c.completedContracts} testId={`stat-completed-${c.id}`} />
          <Stat label="ضمانات" value={c.activeGuarantees} testId={`stat-guarantees-${c.id}`} />
        </div>

        {/* Money */}
        <div className="bg-gradient-to-l from-amber-50 to-transparent dark:from-amber-950/20 rounded-lg p-3 border border-amber-100 dark:border-amber-900">
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-muted-foreground">قيمة العقود</span>
            <span className="font-semibold">{fmt(c.totalContractsValue)} ر.س</span>
          </div>
          <Progress value={c.paymentProgress} className="h-1.5" />
          <div className="flex justify-between items-center text-xs mt-1">
            <span className="text-muted-foreground">مدفوع: {fmt(c.totalPaid)}</span>
            <span className="font-semibold text-emerald-700">{c.paymentProgress}%</span>
          </div>
        </div>

        {/* Issues */}
        {(c.overdueMilestones > 0 || c.expiringGuarantees > 0 || c.ldAppliedCount > 0 || c.pendingVariations > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {c.overdueMilestones > 0 && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                <Clock className="h-3 w-3 ml-1" />
                {c.overdueMilestones} متأخر
              </Badge>
            )}
            {c.expiringGuarantees > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                ضمان ينتهي: {c.expiringGuarantees}
              </Badge>
            )}
            {c.ldAppliedCount > 0 && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                غرامات: {c.ldAppliedCount}
              </Badge>
            )}
            {c.pendingVariations > 0 && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                تغيير معلّق: {c.pendingVariations}
              </Badge>
            )}
          </div>
        )}

        {c.scoreReasons.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              تفاصيل خصم النقاط ({c.scoreReasons.length})
            </summary>
            <ul className="mt-2 space-y-1 pr-4">
              {c.scoreReasons.map((r, i) => (
                <li key={i} className="text-muted-foreground list-disc">{r}</li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2" data-testid={testId}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  const cfg = sevConfig[alert.severity];
  const Icon = cfg.icon;
  return (
    <Card className={`${cfg.border} border-r-4 shadow-sm hover:shadow-md transition-shadow`} data-testid={`alert-${alert.id}`}>
      <CardContent className={`pt-4 pb-3 ${cfg.bg}`}>
        <div className="flex items-start gap-3">
          <Icon className={`h-5 w-5 ${cfg.text} shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={cfg.badge}>{cfg.label}</Badge>
                  <h4 className={`font-bold ${cfg.text}`} data-testid={`alert-title-${alert.id}`}>
                    {alert.title}
                  </h4>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                  <span>المقاول: <strong>{alert.contractorName}</strong></span>
                  {alert.contractNumber && <span>· العقد: {alert.contractNumber}</span>}
                  {alert.amount != null && <span>· {fmt(Number(alert.amount))} ر.س</span>}
                </div>
              </div>
              <Link href={`/contracts/${alert.contractId}`}>
                <Button size="sm" variant="outline" data-testid={`btn-open-${alert.id}`}>
                  فتح <ExternalLink className="h-3 w-3 mr-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
