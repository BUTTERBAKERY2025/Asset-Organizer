import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { 
  Package, Hammer, Settings, Users, ArrowLeftRight, Building2, 
  FileSignature, Wallet, Calculator, Boxes, AlertTriangle, CalendarCheck, 
  ClipboardEdit, HardHat, FileSearch, HardDrive, Link2, LayoutDashboard, 
  ChevronLeft, Factory, Clock, CheckCircle, Megaphone, UserCheck, Calendar, 
  Target, UsersRound, ClipboardList, Receipt, TrendingUp, Brain, Upload,
  FileBarChart, Gift, PieChart, Shield, Building, Briefcase, BarChart3,
  Zap, Sun, Moon, CloudSun, Loader2, RefreshCw
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
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {trend && (
              <div className={`flex items-center gap-1 text-xs ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                <TrendingUp className={`w-3 h-3 ${!trend.isPositive && 'rotate-180'}`} />
                <span>{trend.value}%</span>
              </div>
            )}
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6 text-white" />
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
      className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/30 overflow-hidden h-full"
      onClick={() => navigate(href)}
      data-testid={`module-card-${href.replace('/', '')}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color} transition-transform group-hover:scale-110`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          {badge && (
            <Badge variant="secondary" className="text-xs">{badge}</Badge>
          )}
        </div>
        <CardTitle className="text-lg mt-3">{title}</CardTitle>
        <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
      </CardHeader>
      {items && items.length > 0 && (
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {items.slice(0, 4).map((item, index) => (
              <Link key={index} href={item.href} onClick={(e) => e.stopPropagation()}>
                <Badge 
                  variant="outline" 
                  className="flex items-center gap-1 hover:bg-secondary cursor-pointer transition-colors text-xs"
                >
                  <item.icon className="w-3 h-3" />
                  {item.label}
                </Badge>
              </Link>
            ))}
            {items.length > 4 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                +{items.length - 4} أخرى
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
      <Button variant="outline" className="h-auto py-3 px-4 flex flex-col items-center gap-2 hover:border-primary/50 transition-all">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className="text-xs font-medium">{label}</span>
      </Button>
    </Link>
  );
}

export default function PlatformHomePage() {
  const { user, isAuthenticated, activeBranch } = useAuth();
  const { canView } = usePermissions();
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
    refetchInterval: 60000,
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
  });

  const modules: (ModuleCardProps & { module?: SystemModule })[] = [
    {
      title: "الموارد البشرية",
      description: "إدارة الموظفين والهيكل التنظيمي والحضور والورديات",
      icon: UsersRound,
      href: "/branch-employees",
      color: "bg-teal-500",
      module: "branch_employees",
      items: [
        { label: "موظفو الفروع", href: "/branch-employees", icon: Users },
        { label: "الهيكل التنظيمي", href: "/organizational-structure", icon: Building },
        { label: "الحضور", href: "/attendance-dashboard", icon: UserCheck },
        { label: "الورديات", href: "/shift-management", icon: Calendar },
        { label: "التايم شيت", href: "/timesheet", icon: Clock },
      ],
    },
    {
      title: "الإنتاج",
      description: "إدارة أوامر الإنتاج والتخطيط الذكي والتقارير",
      icon: ClipboardList,
      href: "/production-dashboard",
      color: "bg-blue-500",
      module: "production",
      items: [
        { label: "لوحة الإنتاج", href: "/production-dashboard", icon: LayoutDashboard },
        { label: "أوامر الإنتاج", href: "/advanced-production-orders", icon: ClipboardEdit },
        { label: "الإنتاج اليومي", href: "/daily-production", icon: CheckCircle },
        { label: "المخطط الذكي", href: "/ai-production-planner", icon: Brain },
        { label: "تقارير الإنتاج", href: "/production-reports", icon: FileBarChart },
      ],
    },
    {
      title: "التشغيل",
      description: "إدارة العمليات اليومية والمنتجات ومراقبة الجودة",
      icon: Factory,
      href: "/operations",
      color: "bg-indigo-500",
      module: "operations",
      items: [
        { label: "لوحة التشغيل", href: "/operations", icon: LayoutDashboard },
        { label: "المنتجات", href: "/products", icon: Package },
        { label: "مراقبة الجودة", href: "/quality-control", icon: CheckCircle },
        { label: "بار العرض", href: "/display-bar-waste", icon: Boxes },
      ],
    },
    {
      title: "المبيعات والكاشير",
      description: "يومية الكاشير والأهداف والحوافز وتحليلات المبيعات",
      icon: Receipt,
      href: "/cashier-journals",
      color: "bg-emerald-500",
      module: "cashier_journal",
      items: [
        { label: "يومية الكاشير", href: "/cashier-journals", icon: Wallet },
        { label: "تحليلات المبيعات", href: "/sales-analytics", icon: PieChart },
        { label: "الأهداف", href: "/targets-dashboard", icon: Target },
        { label: "الحوافز", href: "/incentives-management", icon: Gift },
        { label: "P&L", href: "/pnl-dashboard", icon: TrendingUp },
      ],
    },
    {
      title: "الأصول والجرد",
      description: "إدارة ومتابعة جميع أصول الشركة والمعدات والمخزون",
      icon: Package,
      href: "/inventory",
      color: "bg-amber-500",
      module: "inventory",
      items: [
        { label: "جرد الأصول", href: "/inventory", icon: Boxes },
        { label: "إدارة الأصول", href: "/manage", icon: ClipboardEdit },
        { label: "التحويلات", href: "/asset-transfers", icon: ArrowLeftRight },
        { label: "الفروع", href: "/branches", icon: Building2 },
        { label: "الصيانة", href: "/maintenance", icon: AlertTriangle },
      ],
    },
    {
      title: "المشاريع والإنشاءات",
      description: "تتبع مشاريع البناء والتجديد والمقاولين والميزانيات",
      icon: Hammer,
      href: "/construction-projects",
      color: "bg-orange-500",
      module: "construction_projects",
      items: [
        { label: "المشاريع", href: "/construction-projects", icon: Briefcase },
        { label: "المقاولون", href: "/contractors", icon: HardHat },
        { label: "العقود", href: "/contracts", icon: FileSignature },
        { label: "طلبات الدفع", href: "/payment-requests", icon: Wallet },
        { label: "الميزانية", href: "/budget-planning", icon: Calculator },
      ],
    },
    {
      title: "التسويق",
      description: "إدارة الحملات التسويقية والمؤثرين وتحليل الأداء",
      icon: Megaphone,
      href: "/marketing",
      color: "bg-pink-500",
      module: "marketing",
      items: [
        { label: "لوحة التسويق", href: "/marketing", icon: LayoutDashboard },
        { label: "الحملات", href: "/marketing-campaigns", icon: Target },
        { label: "المؤثرين", href: "/marketing-influencers", icon: UserCheck },
        { label: "فريق التسويق", href: "/marketing-team", icon: Users },
      ],
    },
    {
      title: "الإعدادات والنظام",
      description: "إدارة الأمان والمستخدمين والصلاحيات والنسخ الاحتياطية",
      icon: Settings,
      href: "/settings",
      color: "bg-slate-500",
      module: "settings",
      items: [
        { label: "لوحة الإعدادات", href: "/settings", icon: Settings },
        { label: "الأمان", href: "/security-management", icon: Shield },
        { label: "المستخدمين", href: "/users", icon: Users },
        { label: "الصلاحيات", href: "/rbac-management", icon: Shield },
        { label: "النسخ الاحتياطي", href: "/backups", icon: HardDrive },
      ],
    },
  ];

  const allQuickActions: { icon: React.ComponentType<{ className?: string }>; label: string; href: string; color: string; module: SystemModule }[] = [
    { icon: Users, label: "إضافة موظف", href: "/branch-employees", color: "bg-teal-500", module: "branch_employees" },
    { icon: ClipboardEdit, label: "أمر إنتاج", href: "/advanced-production-orders", color: "bg-blue-500", module: "production" },
    { icon: Wallet, label: "يومية كاشير", href: "/cashier-journals", color: "bg-emerald-500", module: "cashier_journal" },
    { icon: UserCheck, label: "تسجيل حضور", href: "/attendance-check", color: "bg-purple-500", module: "shifts" },
    { icon: Boxes, label: "جرد الأصول", href: "/inventory", color: "bg-amber-500", module: "inventory" },
    { icon: FileBarChart, label: "التقارير", href: "/reports", color: "bg-indigo-500", module: "reports" },
  ];

  // Filter quick actions by permissions
  const quickActions = allQuickActions.filter(action => canView(action.module));

  const accessibleModules = modules.filter(module => {
    if (!module.module) return true;
    return canView(module.module);
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: "صباح الخير", icon: Sun, color: "text-amber-500" };
    if (hour >= 12 && hour < 17) return { text: "مساء الخير", icon: CloudSun, color: "text-orange-500" };
    return { text: "مساء الخير", icon: Moon, color: "text-indigo-500" };
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
    return new Date().toLocaleDateString('ar-SA', options);
  };

  const formatTime = () => {
    return new Date().toLocaleTimeString('ar-SA', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <Layout>
      <div className="space-y-6 p-6" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-l from-primary/5 to-primary/10 rounded-2xl p-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <GreetingIcon className={`w-8 h-8 ${greeting.color}`} />
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {greeting.text}{user?.firstName ? `, ${user.firstName}` : ""}
              </h1>
            </div>
            <p className="text-muted-foreground">
              مرحباً بك في منصة بتر بيكري الشاملة
            </p>
            {activeBranch && (
              <Badge variant="outline" className="text-xs">
                <Building2 className="w-3 h-3 ml-1" />
                {activeBranch.name}
              </Badge>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 text-muted-foreground">
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
                title="الفروع"
                value={branchesCount || 0}
                icon={Building2}
                color="bg-amber-500"
                href="/branches"
              />
            )}
            {canView("branch_employees") && (
              <QuickStat
                title="الموظفين"
                value={employeesCount || 0}
                icon={Users}
                color="bg-teal-500"
                href="/branch-employees"
              />
            )}
            {canView("production") && (
              <QuickStat
                title="أوامر الإنتاج اليوم"
                value={stats?.productionOrders || 0}
                icon={ClipboardList}
                color="bg-blue-500"
                href="/advanced-production-orders"
              />
            )}
            {canView("cashier_journal") && (
              <QuickStat
                title="مبيعات اليوم"
                value={stats?.todaySales ? `${stats.todaySales.toLocaleString()} ر.س` : "0 ر.س"}
                icon={Receipt}
                color="bg-emerald-500"
                href="/cashier-journals"
              />
            )}
          </div>
        )}

        {isAuthenticated && quickActions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <CardTitle className="text-lg">إجراءات سريعة</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {quickActions.map((action, index) => (
                  <QuickActionButton key={index} {...action} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-primary" />
            أقسام النظام
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
                <CardTitle className="text-lg">تسجيل الدخول مطلوب</CardTitle>
                <CardDescription>
                  للوصول إلى جميع ميزات المنصة، يرجى تسجيل الدخول أولاً
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/login">
                  <Button className="w-full" data-testid="button-login-home">
                    <ChevronLeft className="w-4 h-4 ml-2" />
                    تسجيل الدخول
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
