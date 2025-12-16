import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import logo from "@assets/logo_-5_1765206843638.png";
import { LayoutDashboard, FileText, LogOut, ClipboardEdit, Building2, AlertTriangle, CalendarCheck, LogIn, Users, Loader2, HardHat, Hammer, ChevronDown, ChevronLeft, Package, FileBarChart, FileSignature, Wallet, Calculator, Menu, X, ArrowLeftRight, FileSearch, HardDrive, Link2 } from "lucide-react";
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
  const { user, isLoading, isAuthenticated, isAdmin, logout, isLoggingOut } = useAuth();
  const { canView } = usePermissions();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    assets: true,
    construction: true,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
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

  const allStandaloneItems: NavItem[] = [
    { href: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard, module: "dashboard" },
  ];

  const allNavGroups: { key: string; group: NavGroup }[] = [
    {
      key: "assets",
      group: {
        label: "الأصول",
        icon: Package,
        items: [
          { href: "/inventory", label: "جرد الأصول", icon: FileText, module: "inventory" },
          { href: "/manage", label: "إدارة الأصول", icon: ClipboardEdit, requiresAuth: true, module: "inventory" },
          { href: "/asset-transfers", label: "تحويلات الأصول", icon: ArrowLeftRight, module: "asset_transfers" },
          { href: "/branches", label: "إدارة الفروع", icon: Building2, requiresAuth: true, module: "inventory" },
          { href: "/inspections", label: "الفحص الدوري", icon: CalendarCheck, module: "inventory" },
          { href: "/maintenance", label: "تقرير الصيانة", icon: AlertTriangle, module: "inventory" },
        ],
      },
    },
    {
      key: "construction",
      group: {
        label: "المشاريع الإنشائية",
        icon: Hammer,
        items: [
          { href: "/construction-dashboard", label: "لوحة التحكم", icon: LayoutDashboard, module: "construction_projects" },
          { href: "/construction-projects", label: "المشاريع", icon: Hammer, module: "construction_projects" },
          { href: "/contractors", label: "المقاولون", icon: HardHat, module: "contractors" },
          { href: "/contracts", label: "العقود", icon: FileSignature, module: "contracts" },
          { href: "/payment-requests", label: "طلبات الدفع", icon: Wallet, module: "payment_requests" },
          { href: "/budget-planning", label: "تخطيط الميزانية", icon: Calculator, module: "budget_planning" },
          { href: "/construction-reports", label: "التقارير", icon: FileBarChart, module: "reports" },
        ],
      },
    },
  ];

  const allBottomItems: NavItem[] = [
    { href: "/reports", label: "التقارير الشاملة", icon: FileBarChart, module: "reports" },
    { href: "/integrations", label: "التكاملات", icon: Link2, module: "users" },
    { href: "/audit-logs", label: "سجل التدقيق", icon: FileSearch, module: "users" },
    { href: "/backups", label: "النسخ الاحتياطية", icon: HardDrive, module: "users" },
    { href: "/users", label: "إدارة المستخدمين", icon: Users, module: "users" },
  ];

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
            <p className="text-[10px] text-muted-foreground text-center leading-tight">نظام إدارة المشروعات والأصول والصيانة</p>
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

          <div className="pt-2 border-t border-border/30 mt-3">
            {bottomItems.map(item => renderNavItem(item))}
          </div>
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
                <p className="text-[10px] text-muted-foreground text-center mt-2">نظام إدارة المشروعات والأصول والصيانة</p>
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

                <div className="pt-2 border-t border-border/30 mt-3">
                  {bottomItems.map(item => renderNavItem(item))}
                </div>
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
