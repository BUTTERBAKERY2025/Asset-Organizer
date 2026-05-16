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
import { Skeleton } from "@/components/ui/skeleton";

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

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 max-w-none space-y-3 sm:space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 sm:gap-3 mb-1">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">{t('dashboard.title')}</h1>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-11 w-11 sm:h-8 sm:w-8 p-0">
                <RefreshCw className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </Button>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {quickActions.map((action, i) => (
              <Link key={i} href={action.href}>
                <Button variant="outline" size="sm" className="h-11 sm:h-9 gap-1.5 text-[10px] sm:text-xs" data-testid={`quick-${i}`}>
                  <Plus className="w-3 h-3" />
                  <span className="hidden sm:inline">{action.label}</span>
                  <span className="sm:hidden">{action.label.split(' ')[0]}</span>
                </Button>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
          <Card className="bg-blue-50/50 border-blue-100">
            <CardContent className="p-2 sm:p-3">
              {isLoading ? <Skeleton className="h-10 sm:h-12" /> : (
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Boxes className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-bold text-blue-700">{stats?.totalProduced || 0}</div>
                    <div className="text-[10px] sm:text-[11px] text-blue-600/70">{t('dashboard.todayProduction')}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-green-50/50 border-green-100">
            <CardContent className="p-2 sm:p-3">
              {isLoading ? <Skeleton className="h-10 sm:h-12" /> : (
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-green-100 flex items-center justify-center">
                    <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-bold text-green-700">{completionRate}%</div>
                    <div className="text-[10px] sm:text-[11px] text-green-600/70">{t('dashboard.completionRate')}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Link href="/display-bar-waste">
            <Card className={`cursor-pointer hover:shadow-md transition-shadow ${parseFloat(stats?.wastePercentage || "0") > 5 ? 'bg-red-50/50 border-red-100' : 'bg-emerald-50/50 border-emerald-100'}`} data-testid="kpi-waste-percentage">
              <CardContent className="p-2 sm:p-3">
                {isLoading ? <Skeleton className="h-10 sm:h-12" /> : (
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center ${parseFloat(stats?.wastePercentage || "0") > 5 ? 'bg-red-100' : 'bg-emerald-100'}`}>
                      <AlertTriangle className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${parseFloat(stats?.wastePercentage || "0") > 5 ? 'text-red-600' : 'text-emerald-600'}`} />
                    </div>
                    <div>
                      <div className={`text-lg sm:text-xl font-bold ${parseFloat(stats?.wastePercentage || "0") > 5 ? 'text-red-700' : 'text-emerald-700'}`}>{stats?.wastePercentage || 0}%</div>
                      <div className={`text-[10px] sm:text-[11px] ${parseFloat(stats?.wastePercentage || "0") > 5 ? 'text-red-600/70' : 'text-emerald-600/70'}`}>{t('dashboard.wasteRate')}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>

          <Card className="bg-amber-50/50 border-amber-100">
            <CardContent className="p-2 sm:p-3">
              {isLoading ? <Skeleton className="h-10 sm:h-12" /> : (
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-bold text-amber-700">{stats?.todayShifts || 0}</div>
                    <div className="text-[10px] sm:text-[11px] text-amber-600/70">{t('dashboard.todayShifts')}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-purple-50/50 border-purple-100">
            <CardContent className="p-2 sm:p-3">
              {isLoading ? <Skeleton className="h-10 sm:h-12" /> : (
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-purple-100 flex items-center justify-center">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-bold text-purple-700">{stats?.qualityPassRate || 100}%</div>
                    <div className="text-[10px] sm:text-[11px] text-purple-600/70">{t('dashboard.qualityRate')}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
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
