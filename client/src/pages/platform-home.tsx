import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { changeLanguage, getCurrentLanguage } from "@/lib/i18n";
import { 
  Package, Hammer, Settings, Users, ArrowLeftRight, Building2, 
  FileSignature, Wallet, Calculator, Boxes, AlertTriangle, CalendarCheck, 
  ClipboardEdit, HardHat, FileSearch, HardDrive, Link2, LayoutDashboard, 
  ChevronLeft, Factory, Clock, CheckCircle, Megaphone, UserCheck, Calendar, 
  Target, UsersRound, ClipboardList, Receipt, TrendingUp, Brain, Upload,
  FileBarChart, Gift, PieChart, Shield, Building, Briefcase, BarChart3,
  Zap, Sun, Moon, CloudSun, Loader2, RefreshCw, Languages, Warehouse,
  PackageCheck, Send, ClipboardCheck
} from "lucide-react";
import type { SystemModule } from "@shared/schema";

interface ModuleCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
  badge?: string;
  items?: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[];
}

interface QuickStatProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trend?: { value: number; isPositive: boolean };
  href?: string;
}

function QuickStat({ title, value, icon: Icon, color, trend, href }: QuickStatProps) {
  const content = (
    <Card className={`${href ? 'hover:shadow-md cursor-pointer transition-all hover:border-primary/30' : ''}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <p className="text-[10px] text-muted-foreground truncate">{title}</p>
            <p className="text-lg font-bold truncate">{value}</p>
            {trend && (
              <div className={`flex items-center gap-1 text-[10px] ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                <TrendingUp className={`w-2.5 h-2.5 ${!trend.isPositive && 'rotate-180'}`} />
                <span>{trend.value}%</span>
              </div>
            )}
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function ModuleCard({ title, description, icon: Icon, href, color, badge, items }: ModuleCardProps) {
  const [, navigate] = useLocation();
  
  return (
    <Card 
      className="group relative hover:shadow-2xl hover:shadow-primary/20 transition-all duration-500 cursor-pointer border hover:border-primary/40 overflow-hidden h-full hover:scale-[1.02] hover:-translate-y-1 before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/80 before:to-primary/5 before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500 before:backdrop-blur-sm before:z-0"
      onClick={() => navigate(href)}
      data-testid={`module-card-${href.replace('/', '')}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
      <CardHeader className="p-2.5 pb-1.5 relative z-10">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-md flex items-center justify-center ${color} transition-all duration-300 group-hover:scale-125 group-hover:rotate-3 group-hover:shadow-lg shrink-0`}>
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-bold truncate group-hover:text-primary transition-colors duration-300">{title}</CardTitle>
          </div>
          {badge && (
            <Badge variant="secondary" className="text-[9px] shrink-0">{badge}</Badge>
          )}
        </div>
        <CardDescription className="text-[10px] leading-snug line-clamp-2 mt-1 text-muted-foreground/80">{description}</CardDescription>
      </CardHeader>
      {items && items.length > 0 && (
        <CardContent className="p-2.5 pt-0 relative z-10">
          <div className="flex flex-wrap gap-1">
            {items.slice(0, 3).map((item, index) => (
              <Link key={index} href={item.href} onClick={(e) => e.stopPropagation()}>
                <Badge 
                  variant="outline" 
                  className="flex items-center gap-0.5 hover:bg-secondary cursor-pointer transition-colors text-[9px] px-1 py-0"
                >
                  <item.icon className="w-2 h-2" />
                  {item.label}
                </Badge>
              </Link>
            ))}
            {items.length > 3 && (
              <Badge variant="outline" className="text-[9px] text-muted-foreground px-1 py-0">
                +{items.length - 3}
              </Badge>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function QuickActionButton({ 
  icon: Icon, 
  label, 
  href, 
  color 
}: { 
  icon: React.ComponentType<{ className?: string }>; 
  label: string; 
  href: string; 
  color: string;
}) {
  return (
    <Link href={href}>
      <Button variant="outline" className="h-auto py-2 px-3 flex flex-col items-center gap-1.5 hover:border-primary/50 transition-all min-h-[40px]">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${color}`}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-[10px] font-medium">{label}</span>
      </Button>
    </Link>
  );
}

export default function PlatformHomePage() {
  const { user, isAuthenticated, activeBranch } = useAuth();
  const { canView } = usePermissions();
  const { t, i18n } = useTranslation('platformHome');
  const currentLang = i18n.language as 'ar' | 'en';

  const toggleLanguage = () => {
    const newLang = currentLang === 'ar' ? 'en' : 'ar';
    changeLanguage(newLang);
  };
  const [, navigate] = useLocation();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats", activeBranch?.id],
    queryFn: async () => {
      const branchParam = activeBranch?.id ? `?branchId=${activeBranch.id}` : '';
      const res = await fetch(`/api/dashboard/stats${branchParam}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: branchesCount } = useQuery({
    queryKey: ["/api/branches/count"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) return 0;
      const branches = await res.json();
      return branches.length;
    },
    enabled: isAuthenticated,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: employeesCount } = useQuery({
    queryKey: ["/api/branch-employees/count"],
    queryFn: async () => {
      const res = await fetch("/api/branch-employees");
      if (!res.ok) return 0;
      const employees = await res.json();
      return employees.length;
    },
    enabled: isAuthenticated,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const modules: (ModuleCardProps & { module?: SystemModule })[] = [
    {
      title: t('modules.hr.title'),
      description: t('modules.hr.description'),
      icon: UsersRound,
      href: "/attendance-dashboard",
      color: "bg-teal-500",
      module: "branch_employees",
      items: [
        { label: t('subItems.branchEmployees'), href: "/branch-employees", icon: Users },
        { label: t('subItems.orgStructure'), href: "/organizational-structure", icon: Building },
        { label: t('subItems.attendance'), href: "/attendance-dashboard", icon: UserCheck },
        { label: t('subItems.shifts'), href: "/shift-management", icon: Calendar },
        { label: t('subItems.timesheet'), href: "/timesheet", icon: Clock },
      ],
    },
    {
      title: t('modules.production.title'),
      description: t('modules.production.description'),
      icon: ClipboardList,
      href: "/production-dashboard",
      color: "bg-blue-500",
      module: "production",
      items: [
        { label: t('subItems.productionDashboard'), href: "/production-dashboard", icon: LayoutDashboard },
        { label: t('subItems.productionOrders'), href: "/advanced-production-orders", icon: ClipboardEdit },
        { label: t('subItems.dailyProduction'), href: "/daily-production", icon: CheckCircle },
        { label: t('subItems.productionReports'), href: "/production-reports", icon: FileBarChart },
      ],
    },
    {
      title: t('modules.operations.title'),
      description: t('modules.operations.description'),
      icon: Factory,
      href: "/operations",
      color: "bg-indigo-500",
      module: "operations",
      items: [
        { label: t('subItems.operationsDashboard'), href: "/operations", icon: LayoutDashboard },
        { label: t('subItems.products'), href: "/products", icon: Package },
        { label: t('subItems.qualityControl'), href: "/quality-control", icon: CheckCircle },
        { label: t('subItems.displayBar'), href: "/display-bar-waste", icon: Boxes },
      ],
    },
    {
      title: t('modules.sales.title'),
      description: t('modules.sales.description'),
      icon: Receipt,
      href: "/cashier-journals",
      color: "bg-emerald-500",
      module: "cashier_journal",
      items: [
        { label: t('subItems.cashierJournal'), href: "/cashier-journals", icon: Wallet },
        { label: t('subItems.salesAnalytics'), href: "/sales-analytics", icon: PieChart },
        { label: t('subItems.targets'), href: "/targets-dashboard", icon: Target },
        { label: t('subItems.incentives'), href: "/incentives-management", icon: Gift },
        { label: t('subItems.pnl'), href: "/pnl-dashboard", icon: TrendingUp },
      ],
    },
    {
      title: t('modules.assets.title'),
      description: t('modules.assets.description'),
      icon: Package,
      href: "/inventory",
      color: "bg-amber-500",
      module: "inventory",
      items: [
        { label: t('subItems.inventory'), href: "/inventory", icon: Boxes },
        { label: t('subItems.assetManagement'), href: "/manage", icon: ClipboardEdit },
        { label: t('subItems.transfers'), href: "/asset-transfers", icon: ArrowLeftRight },
        { label: t('subItems.branches'), href: "/branches", icon: Building2 },
        { label: t('subItems.maintenance'), href: "/maintenance", icon: AlertTriangle },
      ],
    },
    {
      title: t('modules.projects.title'),
      description: t('modules.projects.description'),
      icon: Hammer,
      href: "/construction-projects",
      color: "bg-orange-500",
      module: "construction_projects",
      items: [
        { label: t('subItems.constructionProjects'), href: "/construction-projects", icon: Briefcase },
        { label: t('subItems.contractors'), href: "/contractors", icon: HardHat },
        { label: t('subItems.contracts'), href: "/contracts", icon: FileSignature },
        { label: t('subItems.paymentRequests'), href: "/payment-requests", icon: Wallet },
        { label: t('subItems.budgetPlanning'), href: "/budget-planning", icon: Calculator },
      ],
    },
    {
      title: t('modules.marketing.title'),
      description: t('modules.marketing.description'),
      icon: Megaphone,
      href: "/marketing",
      color: "bg-pink-500",
      module: "marketing",
      items: [
        { label: t('subItems.marketingDashboard'), href: "/marketing", icon: LayoutDashboard },
        { label: t('subItems.campaigns'), href: "/marketing-campaigns", icon: Target },
        { label: t('subItems.influencers'), href: "/marketing-influencers", icon: UserCheck },
        { label: t('subItems.marketingTeam'), href: "/marketing-team", icon: Users },
      ],
    },
    {
      title: t('modules.settings.title'),
      description: t('modules.settings.description'),
      icon: Settings,
      href: "/settings",
      color: "bg-slate-500",
      module: "settings",
      items: [
        { label: t('subItems.settingsDashboard'), href: "/settings", icon: Settings },
        { label: t('subItems.security'), href: "/security-management", icon: Shield },
        { label: t('subItems.users'), href: "/users", icon: Users },
        { label: t('subItems.permissions'), href: "/rbac-management", icon: Shield },
        { label: t('subItems.backups'), href: "/backups", icon: HardDrive },
      ],
    },
    {
      title: t('modules.warehouse.title'),
      description: t('modules.warehouse.description'),
      icon: Warehouse,
      href: "/warehouse-dashboard",
      color: "bg-cyan-500",
      module: "warehouse",
      items: [
        { label: t('subItems.warehouseDashboard'), href: "/warehouse-dashboard", icon: LayoutDashboard },
        { label: t('subItems.transferRequests'), href: "/transfer-requests", icon: Send },
        { label: t('subItems.warehouseInventory'), href: "/warehouse-inventory", icon: Boxes },
      ],
    },
  ];

  const allQuickActions: { icon: React.ComponentType<{ className?: string }>; label: string; href: string; color: string; module: SystemModule }[] = [
    { icon: Users, label: t('quickActions.addEmployee'), href: "/branch-employees", color: "bg-teal-500", module: "branch_employees" },
    { icon: ClipboardEdit, label: t('quickActions.productionOrder'), href: "/advanced-production-orders", color: "bg-blue-500", module: "production" },
    { icon: Wallet, label: t('quickActions.cashierJournal'), href: "/cashier-journals", color: "bg-emerald-500", module: "cashier_journal" },
    { icon: UserCheck, label: t('quickActions.recordAttendance'), href: "/attendance-check", color: "bg-purple-500", module: "shifts" },
    { icon: Boxes, label: t('quickActions.inventoryCheck'), href: "/inventory", color: "bg-amber-500", module: "inventory" },
    { icon: FileBarChart, label: t('quickActions.reports'), href: "/reports", color: "bg-indigo-500", module: "reports" },
  ];

  // Filter quick actions by permissions
  const quickActions = allQuickActions.filter(action => canView(action.module));

  const accessibleModules = modules.filter(module => {
    if (!module.module) return true;
    return canView(module.module);
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: t('greeting.morning'), icon: Sun, color: "text-amber-500" };
    if (hour >= 12 && hour < 17) return { text: t('greeting.afternoon'), icon: CloudSun, color: "text-orange-500" };
    return { text: t('greeting.evening'), icon: Moon, color: "text-indigo-500" };
  };

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  const formatDate = () => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date().toLocaleDateString(currentLang === 'ar' ? 'ar-SA' : 'en-US', options);
  };

  const formatTime = () => {
    return new Date().toLocaleTimeString(currentLang === 'ar' ? 'ar-SA' : 'en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <Layout>
      <div className={`p-4 md:p-8 lg:p-10 max-w-6xl mx-auto space-y-4`} dir={currentLang === 'ar' ? 'rtl' : 'ltr'}>
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-l from-primary/5 to-primary/10 rounded-2xl p-4 sm:p-6`}>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <GreetingIcon className={`w-6 h-6 sm:w-8 sm:h-8 ${greeting.color}`} />
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                {greeting.text}{user?.firstName ? `, ${user.firstName}` : ""}
              </h1>
            </div>
            <p className="text-muted-foreground">
              {t('welcome')}
            </p>
            {activeBranch && (
              <Badge variant="outline" className="text-xs">
                <Building2 className={`w-3 h-3 ${currentLang === 'ar' ? 'ml-1' : 'mr-1'}`} />
                {activeBranch.name}
              </Badge>
            )}
          </div>
          <div className={`flex flex-col ${currentLang === 'ar' ? 'items-end' : 'items-start'} gap-1 text-muted-foreground`}>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLanguage}
              className="mb-2 gap-2"
              data-testid="button-toggle-language"
            >
              <Languages className="w-4 h-4" />
              {t('switchLanguage')}
            </Button>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4" />
              <span>{formatDate()}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4" />
              <span>{formatTime()}</span>
            </div>
          </div>
        </div>

        {isAuthenticated && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {canView("branches") && (
              <QuickStat
                title={t('stats.branches')}
                value={branchesCount || 0}
                icon={Building2}
                color="bg-amber-500"
                href="/branches"
              />
            )}
            {canView("branch_employees") && (
              <QuickStat
                title={t('stats.employees')}
                value={employeesCount || 0}
                icon={Users}
                color="bg-teal-500"
                href="/branch-employees"
              />
            )}
            {canView("production") && (
              <QuickStat
                title={t('stats.todayOrders')}
                value={stats?.productionOrders || 0}
                icon={ClipboardList}
                color="bg-blue-500"
                href="/advanced-production-orders"
              />
            )}
            {canView("cashier_journal") && (
              <QuickStat
                title={t('todaySales')}
                value={stats?.todaySales ? `${stats.todaySales.toLocaleString()} ${t('currency')}` : `0 ${t('currency')}`}
                icon={Receipt}
                color="bg-emerald-500"
                href="/cashier-journals"
              />
            )}
          </div>
        )}

        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-primary" />
            {t('systemModules')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {accessibleModules.map((module, index) => (
              <ModuleCard key={index} {...module} />
            ))}
          </div>
        </div>

        {!isAuthenticated && (
          <div className="text-center py-8">
            <Card className="max-w-md mx-auto">
              <CardHeader>
                <CardTitle className="text-lg">{t('loginRequired')}</CardTitle>
                <CardDescription>
                  {t('loginRequiredDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/login">
                  <Button className="w-full h-11 sm:h-9" data-testid="button-login-home">
                    <ChevronLeft className={`w-4 h-4 ${currentLang === 'ar' ? 'ml-2' : 'mr-2'}`} />
                    {t('login')}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
