import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { PageHeader, KpiCard } from "@/components/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  UsersRound,
  Users,
  Clock,
  Wallet,
  Briefcase,
  FileBarChart,
  FolderOpen,
  ChevronLeft,
  AlertTriangle,
  Building,
  Calendar,
  UserCheck,
  ClipboardCheck,
  Gift,
  FileText,
  TrendingUp,
  Bell,
  LayoutGrid,
  Loader2,
  CalendarDays,
  ShieldAlert,
  GraduationCap,
} from "lucide-react";

type EmployeeStats = {
  totalEmployees: number;
  totalSalaries: number;
  byStatus?: { status: string; count: number }[];
  byNationality?: { nationality: string; count: number }[];
  byJobTitle?: { jobTitle: string; count: number }[];
};

type EmploymentApplication = { id: number; status?: string };
type JobOffer = { id: number; status?: string };

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-SA-u-nu-latn").format(Math.round(n || 0));

interface HubCardLink {
  href: string;
  label: string;
  badge?: string | number;
}

interface HubCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  iconBg: string;
  iconColor: string;
  primaryHref: string;
  primaryLabel: string;
  links: HubCardLink[];
  testId: string;
}

function HubCard({
  title,
  description,
  icon: Icon,
  accent,
  iconBg,
  iconColor,
  primaryHref,
  primaryLabel,
  links,
  testId,
}: HubCardProps) {
  const [, navigate] = useLocation();
  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-2 transition-all hover:shadow-lg",
        accent,
      )}
      data-testid={testId}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-40" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                iconBg,
                iconColor,
              )}
            >
              <Icon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-bold leading-tight truncate">
                {title}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {description}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="space-y-1">
          {links.map((link) => {
            const isComingSoon = link.badge === "قريباً";
            const linkTestId = `link-${testId}-${link.href.replace(/[\/:]/g, "-")}`;
            if (isComingSoon) {
              return (
                <div
                  key={link.href}
                  aria-disabled="true"
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground/80 bg-muted/30 dark:bg-muted/20 cursor-not-allowed select-none"
                  data-testid={linkTestId}
                >
                  <span className="truncate">{link.label}</span>
                  <Badge
                    variant="outline"
                    className="h-5 px-1.5 text-[10px] border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40 shrink-0"
                  >
                    قريباً
                  </Badge>
                </div>
              );
            }
            return (
              <Link key={link.href} href={link.href}>
                <a
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-foreground/90 hover:bg-gray-50 dark:hover:bg-muted transition-colors"
                  data-testid={linkTestId}
                >
                  <span className="truncate">{link.label}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    {link.badge !== undefined && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                        {link.badge}
                      </Badge>
                    )}
                    <ChevronLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </a>
              </Link>
            );
          })}
        </div>
        <Button
          className="w-full justify-center"
          variant="default"
          onClick={() => navigate(primaryHref)}
          data-testid={`button-${testId}-primary`}
        >
          {primaryLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

interface ActionItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  count: number;
  href: string;
  tone: "warning" | "info" | "success";
}

function ActionCenter({ items }: { items: ActionItem[] }) {
  const [, navigate] = useLocation();
  const visible = items.filter((i) => i.count > 0);

  if (visible.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          لا توجد إجراءات معلّقة حالياً — كل شيء على ما يرام
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-600" />
          <CardTitle className="text-base">إجراءات تحتاج انتباهك</CardTitle>
          <Badge variant="secondary" className="mr-auto">
            {fmt(visible.length)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {visible.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.href)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl border text-start transition-colors hover:bg-gray-50 dark:hover:bg-muted",
                item.tone === "warning" &&
                  "border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 dark:border-amber-900/40",
                item.tone === "info" &&
                  "border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 dark:border-blue-900/40",
                item.tone === "success" &&
                  "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10 dark:border-emerald-900/40",
              )}
              data-testid={`action-${item.id}`}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  item.iconClass,
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-foreground truncate">
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fmt(item.count)} عنصر بانتظار المراجعة
                </p>
              </div>
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function HRHubPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<EmployeeStats>({
    queryKey: ["/api/branch-employees/stats"],
    staleTime: 60_000,
  });

  const { data: applications = [] } = useQuery<EmploymentApplication[]>({
    queryKey: ["/api/employment-applications"],
    staleTime: 60_000,
  });

  const { data: jobOffers = [] } = useQuery<JobOffer[]>({
    queryKey: ["/api/job-offers"],
    staleTime: 60_000,
  });

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

  const activeEmployees = useMemo(() => {
    if (!stats?.byStatus) return stats?.totalEmployees ?? 0;
    const active = stats.byStatus.find((s) =>
      ["active", "نشط", "working", "employed"].includes((s.status || "").toLowerCase()),
    );
    return active?.count ?? stats.totalEmployees ?? 0;
  }, [stats]);

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6" dir="rtl" data-testid="page-hr-hub">
        <PageHeader
          icon={UsersRound}
          tone="people"
          title="مركز الموارد البشرية"
          description="لوحة شاملة لإدارة شؤون الموظفين، الحضور، الرواتب، التوظيف، التقارير، والمستندات"
        />

        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            label="الموظفون النشطون"
            value={statsLoading ? "—" : activeEmployees}
            icon={Users}
            tone="people"
            subLabel={`الإجمالي: ${fmt(stats?.totalEmployees ?? 0)}`}
            data-testid="kpi-active-employees"
          />
          <KpiCard
            label="فاتورة الرواتب الشهرية"
            value={statsLoading ? "—" : stats?.totalSalaries ?? 0}
            unit="ر.س"
            icon={Wallet}
            tone="money"
            data-testid="kpi-monthly-salaries"
          />
          <KpiCard
            label="طلبات توظيف معلّقة"
            value={pendingApplications}
            icon={Briefcase}
            tone="primary"
            subLabel={pendingApplications > 0 ? "تحتاج مراجعة" : "لا يوجد"}
            data-testid="kpi-pending-applications"
          />
          <KpiCard
            label="عروض عمل قيد التوقيع"
            value={pendingOffers}
            icon={UserCheck}
            tone="violet"
            subLabel={pendingOffers > 0 ? "بانتظار رد المرشحين" : "لا يوجد"}
            data-testid="kpi-pending-offers"
          />
        </div>

        {statsLoading && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            جاري تحميل البيانات...
          </div>
        )}

        {/* 6 Main Hub Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <HubCard
            testId="card-employees"
            title="شؤون الموظفين"
            description="ملفات الموظفين، الهيكل التنظيمي، والترقيات"
            icon={Users}
            accent="border-teal-200 hover:border-teal-400 dark:border-teal-900/40"
            iconBg="bg-teal-100 dark:bg-teal-950/40"
            iconColor="text-teal-700 dark:text-teal-400"
            primaryHref="/branch-employees"
            primaryLabel="فتح ملفات الموظفين"
            links={[
              { href: "/branch-employees", label: "موظفو الفروع", badge: fmt(stats?.totalEmployees ?? 0) },
              { href: "/terminated-employees", label: "الموظفون المستقيلون" },
              { href: "/operations-employees", label: "موظفو التشغيل" },
              { href: "/organizational-structure", label: "الهيكل التنظيمي" },
              { href: "/floor-plan", label: "مخطط أرضية الفرع" },
            ]}
          />

          <HubCard
            testId="card-attendance"
            title="الحضور والورديات"
            description="تسجيل الحضور، الجداول الأسبوعية، والتايم شيت"
            icon={Clock}
            accent="border-blue-200 hover:border-blue-400 dark:border-blue-900/40"
            iconBg="bg-blue-100 dark:bg-blue-950/40"
            iconColor="text-blue-700 dark:text-blue-400"
            primaryHref="/attendance-dashboard"
            primaryLabel="لوحة الحضور"
            links={[
              { href: "/attendance-dashboard", label: "لوحة الحضور والانصراف" },
              { href: "/shift-management", label: "إدارة الورديات" },
              { href: "/attendance-check", label: "تسجيل الحضور اليدوي" },
              { href: "/timesheet", label: "تقارير التايم شيت" },
              { href: "/biometric-settings", label: "إعدادات البصمة" },
            ]}
          />

          <HubCard
            testId="card-payroll"
            title="الرواتب والحوافز"
            description="الإغلاق الشهري، السلف، الخصومات، والمكافآت"
            icon={Wallet}
            accent="border-emerald-200 hover:border-emerald-400 dark:border-emerald-900/40"
            iconBg="bg-emerald-100 dark:bg-emerald-950/40"
            iconColor="text-emerald-700 dark:text-emerald-400"
            primaryHref="/employee-reports"
            primaryLabel="فتح كشوف الرواتب"
            links={[
              { href: "/employee-reports", label: "كشف الرواتب الشهري" },
              { href: "/incentives-management", label: "إدارة الحوافز" },
              { href: "/cashier-shift-performance", label: "أداء كاشير الوردية" },
              { href: "/hr/advances", label: "السلف والخصومات", badge: "قريباً" },
              { href: "/hr/eos", label: "حاسبة نهاية الخدمة", badge: "قريباً" },
            ]}
          />

          <HubCard
            testId="card-recruitment"
            title="التوظيف والمباشرة"
            description="استقبال الطلبات، إصدار العروض، ومباشرة العمل"
            icon={Briefcase}
            accent="border-violet-200 hover:border-violet-400 dark:border-violet-900/40"
            iconBg="bg-violet-100 dark:bg-violet-950/40"
            iconColor="text-violet-700 dark:text-violet-400"
            primaryHref="/hr/applications"
            primaryLabel="استعراض الطلبات"
            links={[
              { href: "/hr/applications", label: "طلبات التوظيف", badge: fmt(pendingApplications) },
              { href: "/hr/job-offers", label: "عروض العمل", badge: fmt(pendingOffers) },
              { href: "/hr/onboarding", label: "مباشرة العمل (Onboarding)" },
            ]}
          />

          <HubCard
            testId="card-reports"
            title="التقارير والتحليلات"
            description="تقارير شاملة عن الأداء والحضور والرواتب"
            icon={FileBarChart}
            accent="border-amber-200 hover:border-amber-400 dark:border-amber-900/40"
            iconBg="bg-amber-100 dark:bg-amber-950/40"
            iconColor="text-amber-700 dark:text-amber-400"
            primaryHref="/employee-reports"
            primaryLabel="فتح مركز التقارير"
            links={[
              { href: "/employee-reports", label: "تقارير الموظفين الشاملة" },
              { href: "/timesheet", label: "تقارير التايم شيت" },
              { href: "/attendance-dashboard", label: "تقارير الحضور" },
            ]}
          />

          <HubCard
            testId="card-documents"
            title="المستندات والامتثال"
            description="عقود، هويات، إقامات، وتنبيهات انتهاء الصلاحية"
            icon={FolderOpen}
            accent="border-rose-200 hover:border-rose-400 dark:border-rose-900/40"
            iconBg="bg-rose-100 dark:bg-rose-950/40"
            iconColor="text-rose-700 dark:text-rose-400"
            primaryHref="/documents"
            primaryLabel="فتح المستندات"
            links={[
              { href: "/documents", label: "إدارة المستندات العامة" },
              { href: "/hr/employee-documents", label: "مستندات الموظفين (هوية/إقامة)", badge: "قريباً" },
              { href: "/hr/leaves", label: "طلبات الإجازات", badge: "قريباً" },
              { href: "/hr/warnings", label: "الإنذارات والمخالفات", badge: "قريباً" },
            ]}
          />
        </div>

        {/* Action Center */}
        <ActionCenter
          items={[
            {
              id: "pending-applications",
              icon: Briefcase,
              iconClass: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
              title: "طلبات توظيف بانتظار المراجعة",
              count: pendingApplications,
              href: "/hr/applications",
              tone: "info",
            },
            {
              id: "pending-offers",
              icon: UserCheck,
              iconClass: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
              title: "عروض عمل بانتظار رد المرشحين",
              count: pendingOffers,
              href: "/hr/job-offers",
              tone: "info",
            },
          ]}
        />

        {/* Quick Stats by Status */}
        {stats?.byStatus && stats.byStatus.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-teal-600" />
                <CardTitle className="text-base">توزيع الموظفين حسب الحالة</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {stats.byStatus.map((s) => (
                  <div
                    key={s.status}
                    className="p-3 rounded-xl border bg-gray-50 dark:bg-muted/30"
                    data-testid={`status-${s.status}`}
                  >
                    <p className="text-xs text-muted-foreground mb-1">{s.status || "—"}</p>
                    <p className="text-xl font-bold tabular-nums" dir="ltr">
                      {fmt(s.count)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
