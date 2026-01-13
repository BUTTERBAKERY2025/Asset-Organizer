import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import logo from "@assets/logo_-5_1765206843638.png";
import { 
  LayoutDashboard, FileText, LogOut, ClipboardEdit, Building2, AlertTriangle, 
  CalendarCheck, LogIn, Users, Loader2, HardHat, Hammer, ChevronDown, ChevronLeft, 
  Package, FileBarChart, FileSignature, Wallet, Calculator, Menu, ArrowLeftRight, 
  FileSearch, HardDrive, Link2, Home, Settings, Boxes, Factory, Clock, ClipboardCheck, 
  ClipboardList, CheckCircle, BarChart3, Target, Gift, TrendingUp, Brain, Upload, 
  Shield, MapPin, Megaphone, UserCheck, Calendar, UsersRound, Building, Briefcase,
  Receipt, PieChart, Lock, Layers, PieChartIcon
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import type { Branch } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { GlobalSearch } from "@/components/global-search";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { SystemModule } from "@shared/schema";

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير",
  employee: "موظف",
  viewer: "مشاهد",
};

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
  module?: SystemModule;
  isHeader?: boolean;
  indent?: boolean;
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, isLoading, isAuthenticated, isAdmin, logout, isLoggingOut, activeBranch, allowedBranches, switchBranch, isSwitchingBranch } = useAuth();
  const { canView } = usePermissions();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    hr: true,
    production: false,
    operations: false,
    sales: false,
    assets: false,
    construction: false,
    marketing: false,
    settings: false,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const { data: fetchedBranches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const availableBranches = isAdmin ? fetchedBranches : fetchedBranches.filter(b => 
    allowedBranches.some(ub => ub.branchId === b.id)
  );

  const handleBranchChange = async (branchId: string) => {
    try {
      await switchBranch(branchId);
    } catch (error) {
      console.error("Failed to switch branch:", error);
    }
  };

  const allStandaloneItems: NavItem[] = [
    { href: "/", label: "الصفحة الرئيسية", icon: Home, module: "dashboard" },
  ];

  const allNavGroups: { key: string; group: NavGroup }[] = [
    {
      key: "hr",
      group: {
        label: "الموارد البشرية",
        icon: UsersRound,
        items: [
          { href: "/branch-employees", label: "موظفو الفروع", icon: Users, module: "branch_employees", isHeader: true },
          { href: "/organizational-structure", label: "الهيكل التنظيمي", icon: Building, module: "organizational_structure", indent: true },
          { href: "/attendance-dashboard", label: "الحضور والانصراف", icon: UserCheck, module: "shifts", indent: true },
          { href: "/shift-management", label: "إدارة الورديات", icon: Calendar, module: "shifts", indent: true },
          { href: "/attendance-check", label: "تسجيل الحضور", icon: Clock, module: "shifts", indent: true },
          { href: "/timesheet", label: "تقارير التايم شيت", icon: FileText, module: "shifts", indent: true },
          { href: "/employee-reports", label: "تقارير الموظفين", icon: FileBarChart, module: "employee_reports", indent: true },
        ],
      },
    },
    {
      key: "production",
      group: {
        label: "الإنتاج",
        icon: ClipboardList,
        items: [
          { href: "/production-dashboard", label: "لوحة الإنتاج", icon: LayoutDashboard, module: "production", isHeader: true },
          { href: "/advanced-production-orders", label: "أوامر الإنتاج", icon: ClipboardCheck, module: "production", indent: true },
          { href: "/daily-production", label: "الإنتاج الفعلي اليومي", icon: ClipboardEdit, module: "daily_production", indent: true },
                    { href: "/sales-data-uploads", label: "رفع بيانات المبيعات", icon: Upload, module: "production", indent: true },
          { href: "/production-reports", label: "تقارير الإنتاج", icon: FileBarChart, module: "production", indent: true },
          { href: "/production-comparisons", label: "مقارنة الإنتاج بالمبيعات", icon: Layers, module: "production", indent: true },
          { href: "/production-comparison-reports", label: "تقارير تحليل الهدر", icon: PieChartIcon, module: "production", indent: true },
        ],
      },
    },
    {
      key: "operations",
      group: {
        label: "التشغيل",
        icon: Factory,
        items: [
          { href: "/operations", label: "لوحة التشغيل", icon: LayoutDashboard, module: "operations", isHeader: true },
          { href: "/products", label: "المنتجات", icon: Package, module: "products", indent: true },
          { href: "/quality-control", label: "مراقبة الجودة", icon: CheckCircle, module: "quality_control", indent: true },
          { href: "/display-bar-waste", label: "بار العرض والهالك", icon: Boxes, module: "waste_tracking", indent: true },
          { href: "/operations-employees", label: "موظفي التشغيل", icon: Users, module: "operations", indent: true },
          { href: "/operations-reports", label: "تقارير التشغيل", icon: FileBarChart, module: "operations", indent: true },
        ],
      },
    },
    {
      key: "sales",
      group: {
        label: "المبيعات والكاشير",
        icon: Receipt,
        items: [
          { href: "/cashier-journals", label: "يومية الكاشير", icon: Wallet, module: "cashier_journal", isHeader: true },
          { href: "/branch-daily-closures", label: "الإغلاقات اليومية", icon: Lock, module: "cashier_journal", indent: true },
          { href: "/sales-analytics", label: "تحليلات المبيعات", icon: PieChart, module: "sales_analytics", indent: true },
          { href: "/targets-planning", label: "تخطيط الأهداف", icon: Target, module: "targets_planning", indent: true },
          { href: "/targets-dashboard", label: "لوحة الأهداف", icon: TrendingUp, module: "targets", indent: true },
          { href: "/cashier-shift-performance", label: "أداء الشفتات والكاشير", icon: BarChart3, module: "cashier_performance", indent: true },
          { href: "/incentives-management", label: "إدارة الحوافز", icon: Gift, module: "incentives", indent: true },
          { href: "/pnl-dashboard", label: "الأرباح والخسائر", icon: TrendingUp, module: "pnl_dashboard", indent: true },
        ],
      },
    },
    {
      key: "assets",
      group: {
        label: "الأصول والجرد",
        icon: Package,
        items: [
          { href: "/dashboard", label: "لوحة الأصول", icon: LayoutDashboard, module: "inventory", isHeader: true },
          { href: "/inventory", label: "جرد الأصول", icon: Boxes, module: "inventory", indent: true },
          { href: "/manage", label: "إدارة الأصول", icon: ClipboardEdit, requiresAuth: true, module: "inventory", indent: true },
          { href: "/asset-transfers", label: "تحويلات الأصول", icon: ArrowLeftRight, module: "asset_transfers", indent: true },
          { href: "/branches", label: "إدارة الفروع", icon: Building2, requiresAuth: true, module: "branches", indent: true },
          { href: "/inspections", label: "الفحص الدوري", icon: CalendarCheck, module: "inspections", indent: true },
          { href: "/maintenance", label: "تقرير الصيانة", icon: AlertTriangle, module: "maintenance", indent: true },
          { href: "/reports", label: "تقارير الأصول", icon: FileText, module: "reports", indent: true },
        ],
      },
    },
    {
      key: "construction",
      group: {
        label: "المشاريع والإنشاءات",
        icon: Hammer,
        items: [
          { href: "/construction-projects", label: "المشاريع", icon: Briefcase, module: "construction_projects", isHeader: true },
          { href: "/contractors", label: "المقاولون", icon: HardHat, module: "contractors", indent: true },
          { href: "/contracts", label: "العقود", icon: FileSignature, module: "contracts", indent: true },
          { href: "/payment-requests", label: "طلبات الدفع", icon: Wallet, module: "payment_requests", indent: true },
          { href: "/budget-planning", label: "تخطيط الميزانية", icon: Calculator, module: "budget_planning", indent: true },
          { href: "/construction-reports", label: "تقارير المشاريع", icon: FileBarChart, module: "reports", indent: true },
        ],
      },
    },
    {
      key: "marketing",
      group: {
        label: "التسويق",
        icon: Megaphone,
        items: [
          { href: "/marketing", label: "لوحة التسويق", icon: LayoutDashboard, module: "marketing", isHeader: true },
          { href: "/marketing-campaigns", label: "الحملات التسويقية", icon: Target, module: "marketing_campaigns", indent: true },
          { href: "/marketing-influencers", label: "المؤثرين والبلوجرز", icon: UserCheck, module: "marketing_influencers", indent: true },
          { href: "/marketing-calendar", label: "تقويم التسويق", icon: Calendar, module: "marketing", indent: true },
          { href: "/marketing-tasks", label: "مهام التسويق", icon: ClipboardCheck, module: "marketing_tasks", indent: true },
          { href: "/marketing-reports", label: "تقارير الأداء", icon: BarChart3, module: "marketing", indent: true },
          { href: "/marketing-team", label: "فريق التسويق", icon: Users, module: "marketing", indent: true },
        ],
      },
    },
    {
      key: "settings",
      group: {
        label: "الإعدادات والنظام",
        icon: Settings,
        items: [
          { href: "/settings", label: "لوحة الإعدادات", icon: Settings, module: "settings", isHeader: true },
          { href: "/security-management", label: "إدارة الأمان", icon: Shield, module: "rbac_management", indent: true },
          { href: "/users", label: "إدارة المستخدمين", icon: Users, module: "users", indent: true },
          { href: "/rbac-management", label: "الأدوار والصلاحيات", icon: Shield, module: "rbac_management", indent: true },
          { href: "/integrations", label: "التكاملات", icon: Link2, module: "integrations", indent: true },
          { href: "/audit-logs", label: "سجل التدقيق", icon: FileSearch, module: "audit_logs", indent: true },
          { href: "/backups", label: "النسخ الاحتياطية", icon: HardDrive, module: "backups", indent: true },
        ],
      },
    },
  ];

  const allBottomItems: NavItem[] = [];

  const filterItemsByPermission = (items: NavItem[]): NavItem[] => {
    return items.filter(item => {
      if (!item.module) return true;
      return canView(item.module);
    });
  };

  const standaloneItems = filterItemsByPermission(allStandaloneItems);
  
  const navGroups = allNavGroups
    .map(({ key, group }) => ({
      key,
      group: {
        ...group,
        items: filterItemsByPermission(group.items),
      },
    }))
    .filter(({ group }) => group.items.length > 0);

  const bottomItems = filterItemsByPermission(allBottomItems);

  const isGroupActive = (items: NavItem[]) => items.some(item => location === item.href);

  const renderNavItem = (item: NavItem, inGroup = false) => (
    <Link key={item.href} href={item.href}>
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors cursor-pointer text-[13px]",
          inGroup && !item.isHeader && "mr-6 text-[12px]",
          inGroup && item.isHeader && "mr-3 font-semibold",
          item.indent && "mr-8 text-[12px] border-r-2 border-muted pr-2",
          location === item.href
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
        data-testid={`nav-link-${item.href.replace(/\//g, '') || 'home'}`}
      >
        <item.icon className={cn("flex-shrink-0", item.indent ? "w-3.5 h-3.5" : "w-4 h-4")} />
        <span>{item.label}</span>
      </div>
    </Link>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 bg-card border-l border-border hidden md:flex flex-col sticky top-0 h-screen">
        <div className="p-4 flex flex-col items-center border-b border-border/50">
          <div className="w-full px-2 mb-2 flex items-center justify-between">
            <img src={logo} alt="Butter Bakery" className="w-full h-auto object-contain max-h-20" />
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated && <NotificationsDropdown />}
            <p className="text-[10px] text-muted-foreground text-center leading-tight">منصة بتر بيكري الشاملة</p>
          </div>
          {isAuthenticated && (
            <div className="mt-2 w-full">
              <GlobalSearch />
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {standaloneItems.map(item => renderNavItem(item))}

          {navGroups.map(({ key, group }) => (
            <Collapsible
              key={key}
              open={openGroups[key]}
              onOpenChange={() => toggleGroup(key)}
            >
              <CollapsibleTrigger asChild>
                <div
                  className={cn(
                    "flex items-center justify-between gap-2 px-3 py-1.5 rounded-md transition-colors cursor-pointer mt-1.5 text-[13px]",
                    isGroupActive(group.items)
                      ? "bg-primary/5 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                  data-testid={`nav-group-${key}`}
                >
                  <div className="flex items-center gap-2">
                    <group.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium">{group.label}</span>
                  </div>
                  {openGroups[key] ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronLeft className="w-3.5 h-3.5" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5 mt-0.5">
                {group.items.map(item => renderNavItem(item, true))}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </nav>

        <div className="p-3 border-t border-border/50">
          {isLoading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : isAuthenticated && user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.profileImageUrl || undefined} style={{ objectFit: 'cover' }} />
                  <AvatarFallback className="text-xs">{user.firstName?.[0] || user.phone?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium truncate">{user.firstName || user.phone}</p>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{ROLE_LABELS[user.role] || user.role}</Badge>
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-muted-foreground hover:text-destructive cursor-pointer transition-colors rounded-md hover:bg-destructive/10"
                data-testid="button-logout"
              >
                {isLoggingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                <span>تسجيل الخروج</span>
              </button>
            </div>
          ) : (
            <Link href="/login">
              <div
                className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-primary hover:text-primary/80 cursor-pointer transition-colors rounded-md hover:bg-primary/10"
                data-testid="button-login"
              >
                <LogIn className="w-4 h-4" />
                <span>تسجيل الدخول</span>
              </div>
            </Link>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden h-14 border-b border-border bg-card flex items-center px-2 sm:px-3 justify-between sticky top-0 z-50 safe-area-inset-top">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-9 sm:w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0 overflow-y-auto">
              <div className="p-4 border-b border-border/50">
                <img src={logo} alt="Butter Bakery" className="w-full h-auto object-contain max-h-16" />
                <p className="text-[10px] text-muted-foreground text-center mt-2">منصة بتر بيكري الشاملة</p>
              </div>
              
              <nav className="p-3 space-y-1">
                {standaloneItems.map(item => renderNavItem(item))}

                {navGroups.map(({ key, group }) => (
                  <Collapsible
                    key={key}
                    open={openGroups[key]}
                    onOpenChange={() => toggleGroup(key)}
                  >
                    <CollapsibleTrigger asChild>
                      <div
                        className={cn(
                          "flex items-center justify-between gap-2 px-3 py-2 rounded-md transition-colors cursor-pointer mt-1 text-sm",
                          isGroupActive(group.items)
                            ? "bg-primary/5 text-primary"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <group.icon className="w-4 h-4 flex-shrink-0" />
                          <span className="font-medium">{group.label}</span>
                        </div>
                        {openGroups[key] ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronLeft className="w-4 h-4" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-0.5 mt-0.5">
                      {group.items.map(item => (
                        <Link key={item.href} href={item.href}>
                          <div
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm",
                              !item.isHeader && "mr-6 text-[13px]",
                              item.isHeader && "mr-3 font-semibold",
                              item.indent && "mr-8 text-[12px] border-r-2 border-muted pr-2",
                              location === item.href
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            )}
                          >
                            <item.icon className={cn("flex-shrink-0", item.indent ? "w-3.5 h-3.5" : "w-4 h-4")} />
                            <span>{item.label}</span>
                          </div>
                        </Link>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </nav>

              <div className="p-3 border-t border-border/50 mt-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : isAuthenticated && user ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user.profileImageUrl || undefined} style={{ objectFit: 'cover' }} />
                        <AvatarFallback className="text-sm">{user.firstName?.[0] || user.phone?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.firstName || user.phone}</p>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{ROLE_LABELS[user.role] || user.role}</Badge>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-destructive cursor-pointer transition-colors rounded-md hover:bg-destructive/10"
                    >
                      {isLoggingOut ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <LogOut className="w-4 h-4" />
                      )}
                      <span>تسجيل الخروج</span>
                    </button>
                  </div>
                ) : (
                  <Link href="/login">
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:text-primary/80 cursor-pointer transition-colors rounded-md hover:bg-primary/10">
                      <LogIn className="w-4 h-4" />
                      <span>تسجيل الدخول</span>
                    </div>
                  </Link>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <img src={logo} alt="Butter Bakery" className="h-8 object-contain" />
          
          <div className="flex items-center gap-2">
            {isAuthenticated && <NotificationsDropdown />}
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
