import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useTranslation } from 'react-i18next';
import { 
  Factory, Users, Clock, CheckCircle, AlertTriangle, TrendingUp, Calendar, 
  ClipboardCheck, Plus, Wallet, Package, BarChart3, Target, Gift, 
  ChevronLeft, Activity, Boxes, RefreshCw, FileText, DoorOpen
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";

interface OperationsStats {
  productsCount: number;
  todayShifts: number;
  todayOrders: number;
  completedOrders: number;
  totalProduced: number;
  totalWasted: number;
  wastePercentage: string;
  qualityChecks: number;
  qualityPassRate: string;
}

export default function OperationsDashboardPage() {
  const { t } = useTranslation('operations');
  const { data: stats, isLoading, refetch } = useQuery<OperationsStats>({
    queryKey: ["/api/operations/stats"],
  });

  const completionRate = stats?.todayOrders 
    ? Math.round((stats.completedOrders / stats.todayOrders) * 100) 
    : 0;

  const operationsLinks = [
    { title: t('dashboard.opLinks.branchShifts'), description: t('dashboard.opLinks.branchShiftsDesc'), href: "/branch-shifts", icon: DoorOpen, highlight: true },
    { title: t('dashboard.opLinks.products'), description: t('dashboard.opLinks.productsDesc'), href: "/products", icon: Package, count: stats?.productsCount || 0, countLabel: t('dashboard.opLinks.productLabel') },
    { title: t('dashboard.opLinks.branchEmployees'), description: t('dashboard.opLinks.branchEmployeesDesc'), href: "/attendance-dashboard", icon: Clock, count: stats?.todayShifts || 0, countLabel: t('dashboard.opLinks.shiftLabel') },
    { title: t('dashboard.opLinks.productionOrders'), description: t('dashboard.opLinks.productionOrdersDesc'), href: "/production-dashboard", icon: ClipboardCheck, count: stats?.todayOrders || 0, countLabel: t('dashboard.opLinks.orderLabel') },
    { title: t('dashboard.opLinks.qualityControl'), description: t('dashboard.opLinks.qualityControlDesc'), href: "/quality-control", icon: CheckCircle, count: stats?.qualityChecks || 0, countLabel: t('dashboard.opLinks.checkLabel') },
    { title: t('dashboard.opLinks.displayBarWaste'), description: t('dashboard.opLinks.displayBarWasteDesc'), href: "/display-bar-waste", icon: AlertTriangle },
    { title: t('dashboard.opLinks.opsEmployees'), description: t('dashboard.opLinks.opsEmployeesDesc'), href: "/operations-employees", icon: Users },
  ];

  const salesLinks = [
    { title: t('dashboard.salesLinks.cashierJournal'), description: t('dashboard.salesLinks.cashierJournalDesc'), href: "/cashier-journals", icon: Wallet },
    { title: t('dashboard.salesLinks.salesAnalytics'), description: t('dashboard.salesLinks.salesAnalyticsDesc'), href: "/sales-analytics", icon: BarChart3 },
    { title: t('dashboard.salesLinks.pnl'), description: t('dashboard.salesLinks.pnlDesc'), href: "/pnl-dashboard", icon: TrendingUp },
    { title: t('dashboard.salesLinks.targetPlanning'), description: t('dashboard.salesLinks.targetPlanningDesc'), href: "/targets-planning", icon: Target },
    { title: t('dashboard.salesLinks.targetDashboard'), description: t('dashboard.salesLinks.targetDashboardDesc'), href: "/targets-dashboard", icon: Activity },
    { title: t('dashboard.salesLinks.incentives'), description: t('dashboard.salesLinks.incentivesDesc'), href: "/incentives-management", icon: Gift },
    { title: t('dashboard.salesLinks.opsReports'), description: t('dashboard.salesLinks.opsReportsDesc'), href: "/operations-reports", icon: FileText },
  ];

  const quickActions = [
    { label: t('dashboard.quickActions.branchShift'), href: "/branch-shifts", icon: DoorOpen },
    { label: t('dashboard.quickActions.newJournal'), href: "/cashier-journals", icon: Wallet },
    { label: t('dashboard.quickActions.branchEmployees'), href: "/attendance-dashboard", icon: Clock },
    { label: t('dashboard.quickActions.productionOrder'), href: "/production-dashboard", icon: ClipboardCheck },
    { label: t('dashboard.quickActions.qualityCheck'), href: "/quality-control", icon: CheckCircle },
  ];

  const wastePct = parseFloat(stats?.wastePercentage || "0");

  return (
    <Layout>
      <div className="page-container space-y-3 sm:space-y-4" dir="rtl">
        <PageHeader
          icon={Factory}
          tone="primary"
          title={t('dashboard.title')}
          description={t('dashboard.subtitle')}
          actions={
            <>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => refetch()} data-testid="button-refresh">
                <RefreshCw className="w-4 h-4" />
              </Button>
              {quickActions.map((action, i) => (
                <Link key={i} href={action.href}>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" data-testid={`quick-${i}`}>
                    <Plus className="w-3 h-3" />
                    <span className="hidden sm:inline">{action.label}</span>
                    <span className="sm:hidden">{action.label.split(' ')[0]}</span>
                  </Button>
                </Link>
              ))}
            </>
          }
        />

        <div className="kpi-grid">
          <KpiCard
            label={t('dashboard.todayProduction')}
            value={stats?.totalProduced || 0}
            icon={Boxes}
            tone="production"
            data-testid="kpi-today-production"
          />
          <KpiCard
            label={t('dashboard.completionRate')}
            value={completionRate}
            unit="%"
            icon={Activity}
            tone="money"
            data-testid="kpi-completion-rate"
          />
          <KpiCard
            label={t('dashboard.wasteRate')}
            value={stats?.wastePercentage || 0}
            unit="%"
            icon={AlertTriangle}
            tone={wastePct > 5 ? "alert" : "money"}
            onClick={() => { window.location.href = "/display-bar-waste"; }}
            data-testid="kpi-waste-percentage"
          />
          <KpiCard
            label={t('dashboard.todayShifts')}
            value={stats?.todayShifts || 0}
            icon={Clock}
            tone="inventory"
            data-testid="kpi-today-shifts"
          />
          <KpiCard
            label={t('dashboard.qualityRate')}
            value={stats?.qualityPassRate || 100}
            unit="%"
            icon={CheckCircle}
            tone="violet"
            data-testid="kpi-quality-rate"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="pb-2 pt-2 sm:pt-3 px-3 sm:px-4">
              <div className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-primary" />
                <CardTitle className="text-xs sm:text-sm font-semibold">{t('dashboard.operationsAndProduction')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-2">
              <div className="divide-y">
                {operationsLinks.map((link, i) => (
                  <Link key={i} href={link.href}>
                    <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 hover:bg-muted/50 rounded-md transition-colors cursor-pointer group" data-testid={`op-link-${i}`}>
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <link.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs sm:text-sm font-medium">{link.title}</div>
                        <div className="text-[10px] sm:text-[11px] text-muted-foreground truncate hidden sm:block">{link.description}</div>
                      </div>
                      {link.count !== undefined && (
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {link.count} <span className="hidden sm:inline">{link.countLabel}</span>
                        </Badge>
                      )}
                      <ChevronLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-2 sm:pt-3 px-3 sm:px-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <CardTitle className="text-xs sm:text-sm font-semibold">{t('dashboard.salesAndTargets')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-2">
              <div className="divide-y">
                {salesLinks.map((link, i) => (
                  <Link key={i} href={link.href}>
                    <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 hover:bg-muted/50 rounded-md transition-colors cursor-pointer group" data-testid={`sales-link-${i}`}>
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <link.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs sm:text-sm font-medium">{link.title}</div>
                        <div className="text-[10px] sm:text-[11px] text-muted-foreground truncate hidden sm:block">{link.description}</div>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-muted/20">
          <CardContent className="p-2 sm:p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-muted-foreground">{t('dashboard.completedOrders')} <span className="font-medium text-foreground">{stats?.completedOrders || 0}/{stats?.todayOrders || 0}</span></span>
                <span className="text-muted-foreground">{t('dashboard.qualityChecks')} <span className="font-medium text-foreground">{stats?.qualityChecks || 0}</span></span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
