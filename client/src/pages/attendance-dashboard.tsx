import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import {
  Clock,
  Users,
  ClipboardCheck,
  UserCheck,
  Timer,
  BarChart3,
  Fingerprint,
  FileSignature,
  CalendarClock,
  ListChecks,
  Loader2,
} from "lucide-react";
import { PageHeader, KpiCard, SectionCard } from "@/components/dashboard";
import { cn } from "@/lib/utils";

interface QuickAction {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  tone: "people" | "production" | "violet" | "primary";
  badge?: string;
}

interface ManagementCard {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  stats: number;
  statsLabel: string;
}

const TONE_BG: Record<QuickAction["tone"], string> = {
  people:     "bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/30 dark:hover:bg-teal-950/50",
  production: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50",
  violet:     "bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/30 dark:hover:bg-violet-950/50",
  primary:    "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50",
};
const TONE_ICON: Record<QuickAction["tone"], string> = {
  people:     "bg-teal-500 text-white",
  production: "bg-blue-500 text-white",
  violet:     "bg-violet-500 text-white",
  primary:    "bg-amber-500 text-white",
};

export default function AttendanceDashboardPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { t, i18n } = useTranslation("hr");
  const isRTL = i18n.language === "ar";

  const { data: stats, isLoading } = useQuery<{
    totalEmployees: number;
    presentToday: number;
    lateToday: number;
    absentToday: number;
    templatesCount: number;
    schedulesCount: number;
    reportsCount: number;
    attendanceRate: number;
  } | null>({
    queryKey: ["/api/attendance-dashboard-stats"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 15000,
    refetchOnMount: true,
    enabled: isAuthenticated,
  });

  const quickActions: QuickAction[] = [
    {
      key: "qa-check",
      title: t("actions.attendanceCheck.title"),
      description: t("actions.attendanceCheck.description"),
      icon: Fingerprint,
      href: "/attendance-check",
      tone: "people",
      badge: t("mostUsed"),
    },
    {
      key: "qa-shifts",
      title: t("actions.shiftManagement.title"),
      description: t("actions.shiftManagement.description"),
      icon: CalendarClock,
      href: "/shift-management",
      tone: "production",
    },
    {
      key: "qa-timesheet",
      title: t("actions.timesheet.title"),
      description: t("actions.timesheet.description"),
      icon: FileSignature,
      href: "/timesheet",
      tone: "violet",
    },
    {
      key: "qa-employee-report",
      title: "تقرير حضور الموظف عبر الفروع",
      description: "حضور الموظف المنقول بين الفروع مجمّعاً في تقرير واحد",
      icon: BarChart3,
      href: "/employee-attendance-report",
      tone: "primary",
    },
    {
      key: "qa-employees",
      title: t("actions.branchEmployees.title"),
      description: t("actions.branchEmployees.description"),
      icon: Users,
      href: "/branch-employees",
      tone: "primary",
    },
  ];

  const managementCards: ManagementCard[] = [
    {
      key: "mg-org",
      title: t("management.orgStructure.title"),
      description: t("management.orgStructure.description"),
      icon: ClipboardCheck,
      href: "/organizational-structure",
      stats: stats?.totalEmployees || 0,
      statsLabel: t("stats.employee"),
    },
    {
      key: "mg-reports",
      title: t("management.reports.title"),
      description: t("management.reports.description"),
      icon: BarChart3,
      href: "/employee-reports",
      stats: stats?.reportsCount || 0,
      statsLabel: t("stats.report"),
    },
  ];

  const totalEmployees = stats?.totalEmployees ?? 0;
  const presentToday = stats?.presentToday ?? 0;
  const attendanceRate = stats?.attendanceRate ?? (totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0);

  return (
    <Layout>
      <div className="page-container space-y-5" dir={isRTL ? "rtl" : "ltr"}>
        <PageHeader
          icon={UserCheck}
          tone="people"
          title={t("pageTitle")}
          description={t("pageDescription")}
          backHref="/branch-employees"
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* KPI strip */}
            <div className="kpi-grid">
              <KpiCard
                label={t("stats.totalEmployees")}
                value={totalEmployees}
                icon={Users}
                tone="primary"
                data-testid="kpi-total-employees"
              />
              <KpiCard
                label={t("stats.presentToday")}
                value={presentToday}
                icon={UserCheck}
                tone="money"
                subLabel={`${attendanceRate}% ${t("stats.attendanceRate")}`}
                data-testid="kpi-present-today"
              />
              <KpiCard
                label={t("stats.lateToday")}
                value={stats?.lateToday ?? 0}
                icon={Timer}
                tone="inventory"
                data-testid="kpi-late-today"
              />
              <KpiCard
                label={t("stats.absentToday")}
                value={stats?.absentToday ?? 0}
                icon={Clock}
                tone="alert"
                data-testid="kpi-absent-today"
              />
            </div>

            {/* Quick actions + management — 2 col on lg */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <SectionCard
                title={t("quickActions")}
                className="lg:col-span-2"
                data-testid="section-quick-actions"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {quickActions.map((a) => {
                    const Icon = a.icon;
                    return (
                      <button
                        key={a.key}
                        type="button"
                        onClick={() => navigate(a.href)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border border-transparent text-start transition-colors",
                          TONE_BG[a.tone],
                        )}
                        data-testid={`action-${a.key}`}
                      >
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", TONE_ICON[a.tone])}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-semibold text-sm text-gray-900 dark:text-foreground">{a.title}</h4>
                            {a.badge && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {a.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-muted-foreground mt-0.5 line-clamp-2">
                            {a.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard
                title={t("managementReports")}
                data-testid="section-management"
              >
                <div className="space-y-2">
                  {managementCards.map((c) => {
                    const Icon = c.icon;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => navigate(c.href)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-start"
                        data-testid={`mg-${c.key}`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-gray-900 dark:text-foreground truncate">{c.title}</h4>
                          <p className="text-xs text-gray-500 dark:text-muted-foreground truncate">{c.description}</p>
                        </div>
                        <div className="text-end shrink-0">
                          <p className="text-lg font-bold text-primary leading-none" dir="ltr">{new Intl.NumberFormat("en-US").format(c.stats)}</p>
                          <p className="text-[10px] text-gray-400 dark:text-muted-foreground mt-0.5">{c.statsLabel}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </SectionCard>
            </div>

            {/* Quick guide tip */}
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 px-4 py-3 flex items-center gap-2 text-sm" data-testid="quick-guide">
              <ListChecks className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-semibold text-amber-800 dark:text-amber-300">{t("quickGuide")}</span>
              <span className="text-amber-700 dark:text-amber-400/80">{t("quickGuideSteps")}</span>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
