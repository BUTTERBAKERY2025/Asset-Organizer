import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import logo from "@assets/logo_-5_1765206843638.png";
import { LayoutDashboard, FileText, LogOut, ClipboardEdit, Building2, AlertTriangle, CalendarCheck, LogIn, Users, Loader2, HardHat, Hammer, ChevronDown, ChevronLeft, Package, FileBarChart, FileSignature, Wallet, Calculator, Menu, X, ArrowLeftRight, FileSearch, HardDrive, Link2, Home, Settings, Boxes, Factory, Clock, ClipboardCheck, ClipboardList, CheckCircle, BarChart3, Target, Gift, TrendingUp, Brain, Upload, Shield, MapPin } from "lucide-react";
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
    assets: true,
    operations: false,
    sales: false,
    construction: false,
    reports: false,
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

  // Fetch all branches for the selector
  const { data: allBranches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // Determine which branches to show (user's allowed branches or all for admin)
  const availableBranches = isAdmin ? allBranches : allBranches.filter(b => 
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
    { href: "/dashboard", label: "لوحة تحكم المعدات والأصول", icon: LayoutDashboard, module: "dashboard" },
  ];

  const allNavGroups: { key: string; group: NavGroup }[] = [
    {
      key: "assets",
      group: {
        label: "الأصول والجرد",
        icon: Package,
        items: [
          { href: "/inventory", label: "جرد الأصول", icon: Boxes, module: "inventory" },
          { href: "/manage", label: "إدارة الأصول", icon: ClipboardEdit, requiresAuth: true, module: "inventory" },
          { href: "/asset-transfers", label: "تحويلات الأصول", icon: ArrowLeftRight, module: "asset_transfers" },
          { href: "/branches", label: "إدارة الفروع", icon: Building2, requiresAuth: true, module: "inventory" },
          { href: "/inspections", label: "الفحص الدوري", icon: CalendarCheck, module: "inventory" },
          { href: "/maintenance", label: "تقرير الصيانة", icon: AlertTriangle, module: "inventory" },
        ],
      },
    },
    {
      key: "operations",
      group: {
        label: "التشغيل والإنتاج",
        icon: Factory,
        items: [
          { href: "/operations", label: "لوحة التشغيل", icon: Factory, module: "operations" },
          { href: "/production-dashboard", label: "لوحة الإنتاج", icon: ClipboardList, module: "production" },
          { href: "/products", label: "المنتجات", icon: Package, module: "operations" },
          { href: "/shifts", label: "الورديات", icon: Clock, module: "shifts" },
          { href: "/advanced-production-orders", label: "أوامر الإنتاج", icon: ClipboardCheck, module: "production" },
          { href: "/ai-production-planner", label: "مخطط الإنتاج الذكي", icon: Brain, module: "production" },
          { href: "/sales-data-uploads", label: "رفع بيانات المبيعات", icon: Upload, module: "production" },
          { href: "/quality-control", label: "مراقبة الجودة", icon: CheckCircle, module: "quality_control" },
          { href: "/display-bar-waste", label: "بار العرض والهالك", icon: Package, module: "operations" },
          { href: "/daily-production", label: "الإنتاج الفعلي اليومي", icon: ClipboardCheck, module: "production" },
          { href: "/production-reports", label: "تقارير الإنتاج", icon: FileBarChart, module: "production" },
          { href: "/operations-employees", label: "موظفي التشغيل", icon: Users, module: "operations" },
        ],
      },
    },
    {
      key: "sales",
      group: {
        label: "المبيعات والأهداف",
        icon: Target,
        items: [
          { href: "/cashier-journals", label: "يومية الكاشير", icon: Wallet, module: "cashier_journal" },
          { href: "/sales-analytics", label: "تحليلات المبيعات", icon: BarChart3, module: "operations" },
          { href: "/targets-planning", label: "تخطيط الأهداف", icon: Target, module: "operations" },
          { href: "/targets-dashboard", label: "لوحة الأهداف", icon: TrendingUp, module: "operations" },
          { href: "/cashier-shift-performance", label: "أداء الشفتات والكاشير", icon: Clock, module: "operations" },
          { href: "/incentives-management", label: "إدارة الحوافز", icon: Gift, module: "operations" },
          { href: "/operations-reports", label: "تقارير التشغيل", icon: BarChart3, module: "operations" },
        ],
      },
    },
    {
      key: "construction",
      group: {
        label: "المشاريع الإنشائية",
        icon: Hammer,
        items: [
          { href: "/construction-projects", label: "المشاريع", icon: Hammer, module: "construction_projects" },
          { href: "/contractors", label: "المقاولون", icon: HardHat, module: "contractors" },
          { href: "/contracts", label: "العقود", icon: FileSignature, module: "contracts" },
          { href: "/payment-requests", label: "طلبات الدفع", icon: Wallet, module: "payment_requests" },
          { href: "/budget-planning", label: "تخطيط الميزانية", icon: Calculator, module: "budget_planning" },
        ],
      },
    },
    {
      key: "reports",
      group: {
        label: "التقارير",
        icon: FileBarChart,
        items: [
          { href: "/reports", label: "التقارير الشاملة", icon: FileText, module: "reports" },
          { href: "/construction-reports", label: "تقارير المشاريع", icon: FileBarChart, module: "reports" },
        ],
      },
    },
    {
      key: "settings",
      group: {
        label: "الإعدادات والنظام",
        icon: Settings,
        items: [
          { href: "/users", label: "إدارة المستخدمين", icon: Users, module: "users" },
          { href: "/rbac-management", label: "الأدوار والصلاحيات", icon: Shield, module: "users" },
          { href: "/integrations", label: "التكاملات", icon: Link2, module: "users" },
          { href: "/audit-logs", label: "سجل التدقيق", icon: FileSearch, module: "users" },
          { href: "/backups", label: "النسخ الاحتياطية", icon: HardDrive, module: "users" },
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

  const renderNavItem = (item: NavItem, indented = false) => (
    <Link key={item.href} href={item.href}>
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors cursor-pointer text-[13px]",
          indented && "mr-3",
          location === item.href
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
        data-testid={`nav-link-${item.href.replace('/', '')}`}
      >
        <item.icon className="w-4 h-4 flex-shrink-0" />
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
          {isAuthenticated && availableBranches.length > 0 && (
            <div className="mt-3 w-full">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <MapPin className="h-3 w-3" />
                <span>الفرع الحالي</span>
              </div>
              <Select
                value={activeBranch?.id || ""}
                onValueChange={handleBranchChange}
                disabled={isSwitchingBranch}
              >
                <SelectTrigger className="w-full text-xs h-8" data-testid="select-active-branch">
                  <SelectValue placeholder="اختر الفرع">
                    {isSwitchingBranch ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>جاري التبديل...</span>
                      </div>
                    ) : (
                      activeBranch?.name || "اختر الفرع"
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableBranches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id} data-testid={`branch-option-${branch.id}`}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        <header className="md:hidden h-14 border-b border-border bg-card flex items-center px-3 justify-between sticky top-0 z-50">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
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
                              "flex items-center gap-2 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm mr-3",
                              location === item.href
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            )}
                          >
                            <item.icon className="w-4 h-4 flex-shrink-0" />
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

          <div className="flex items-center">
            <img src={logo} alt="Butter Bakery" className="h-10 w-auto object-contain" />
          </div>

          <div className="flex items-center gap-1">
            {isAuthenticated && <NotificationsDropdown />}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-3 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
