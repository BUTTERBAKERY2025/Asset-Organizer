import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import logo from "@assets/logo_-5_1765206843638.png";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "@/lib/i18n";
import { prefetchQuery } from "@/lib/queryClient";
import { 
  LayoutDashboard, FileText, LogOut, ClipboardEdit, Building2, AlertTriangle, 
  CalendarCheck, LogIn, Users, Loader2, HardHat, Hammer, ChevronDown, ChevronLeft, 
  Package, FileBarChart, FileSignature, Wallet, Calculator, Menu, ArrowLeftRight, 
  FileSearch, HardDrive, Link2, Home, Settings, Boxes, Factory, Clock, ClipboardCheck, 
  ClipboardList, CheckCircle, BarChart3, Target, Gift, TrendingUp, Brain, Upload, 
  Shield, MapPin, Megaphone, UserCheck, Calendar, UsersRound, Building, Briefcase,
  Receipt, PieChart, Lock, Layers, PieChartIcon, Share2, Languages, Warehouse,
  PackageCheck, Send, ShoppingCart, FolderOpen, Landmark, Scale, Vote, FileCheck,
  Sparkles, Crown
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

const ROLE_KEYS: Record<string, string> = {
  admin: "roles.admin",
  employee: "roles.employee",
  viewer: "roles.viewer",
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
  const { t, i18n } = useTranslation("platformHome");
  const currentLang = i18n.language;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    hr: false,
    production: false,
    operations: false,
    sales: false,
    assets: false,
    construction: false,
    marketing: false,
    warehouse: false,
    executive: false,
    settings: false,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  // Note: Removed prefetchStaticData() - queries handle their own caching
  // This reduces duplicate requests on initial load

  const handleLinkHover = useCallback((href: string) => {
    const apiMap: Record<string, string[]> = {
      "/marketing": ["/api/marketing/campaigns", "/api/marketing/influencers"],
      "/marketing-campaigns": ["/api/marketing/campaigns"],
      "/marketing-influencers": ["/api/marketing/influencers"],
      "/influencer-contracts": ["/api/marketing/influencer-contracts"],
      "/inventory": ["/api/inventory"],
      "/dashboard": ["/api/dashboard/stats"],
      "/construction-projects": ["/api/construction-projects"],
      "/operations": ["/api/operations/products"],
      "/warehouse": ["/api/warehouse/items", "/api/warehouse/dashboard-stats"],
      "/transfer-requests": ["/api/warehouse/material-requests"],
      "/warehouse-inventory": ["/api/warehouse/items"],
    };
    const queries = apiMap[href];
    if (queries) {
      queries.forEach(q => prefetchQuery([q]));
    }
  }, []);

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
    staleTime: 1000 * 60 * 60, // 1 hour - branches rarely change
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
    { href: "/", label: t("sidebar.home"), icon: Home, module: "dashboard" },
  ];

  const allNavGroups: { key: string; group: NavGroup }[] = [
    {
      key: "hr",
      group: {
        label: t("sidebar.hr"),
        icon: UsersRound,
        items: [
          { href: "/branch-employees", label: t("sidebar.branchEmployees"), icon: Users, module: "branch_employees", isHeader: true },
          { href: "/organizational-structure", label: t("sidebar.orgStructure"), icon: Building, module: "organizational_structure", indent: true },
          { href: "/attendance-dashboard", label: t("sidebar.attendanceDashboard"), icon: UserCheck, module: "shifts", indent: true },
          { href: "/shift-management", label: t("sidebar.shiftManagement"), icon: Calendar, module: "shifts", indent: true },
          { href: "/attendance-check", label: t("sidebar.attendanceCheck"), icon: Clock, module: "shifts", indent: true },
          { href: "/timesheet", label: t("sidebar.timesheet"), icon: FileText, module: "shifts", indent: true },
          { href: "/employee-reports", label: t("sidebar.employeeReports"), icon: FileBarChart, module: "employee_reports", indent: true },
        ],
      },
    },
    {
      key: "production",
      group: {
        label: t("sidebar.production"),
        icon: ClipboardList,
        items: [
          { href: "/production-dashboard", label: t("sidebar.productionDashboard"), icon: LayoutDashboard, module: "production", isHeader: true },
          { href: "/advanced-production-orders", label: t("sidebar.productionOrders"), icon: ClipboardCheck, module: "production", indent: true },
          { href: "/daily-production", label: t("sidebar.dailyProduction"), icon: ClipboardEdit, module: "daily_production", indent: true },
          { href: "/finished-goods-inventory", label: t("sidebar.finishedGoodsInventory"), icon: Boxes, module: "production", indent: true },
          { href: "/sales-data-uploads", label: t("sidebar.salesDataUploads"), icon: Upload, module: "production", indent: true },
          { href: "/production-reports", label: t("sidebar.productionReports"), icon: FileBarChart, module: "production", indent: true },
          { href: "/production-comparisons", label: t("sidebar.productionComparisons"), icon: Layers, module: "production", indent: true },
          { href: "/production-comparison-reports", label: t("sidebar.wasteAnalysis"), icon: PieChartIcon, module: "production", indent: true },
        ],
      },
    },
    {
      key: "operations",
      group: {
        label: t("sidebar.operations"),
        icon: Factory,
        items: [
          { href: "/operations", label: t("sidebar.operationsDashboard"), icon: LayoutDashboard, module: "operations", isHeader: true },
          { href: "/products", label: t("sidebar.products"), icon: Package, module: "products", indent: true },
          { href: "/quality-control", label: t("sidebar.qualityControl"), icon: CheckCircle, module: "quality_control", indent: true },
          { href: "/display-bar-waste", label: t("sidebar.displayBarWaste"), icon: Boxes, module: "waste_tracking", indent: true },
          { href: "/operations-employees", label: t("sidebar.operationsEmployees"), icon: Users, module: "operations", indent: true },
          { href: "/operations-reports", label: t("sidebar.operationsReports"), icon: FileBarChart, module: "operations", indent: true },
        ],
      },
    },
    {
      key: "sales",
      group: {
        label: t("sidebar.sales"),
        icon: Receipt,
        items: [
          { href: "/cashier-journals", label: t("sidebar.cashierJournal"), icon: Wallet, module: "cashier_journal", isHeader: true },
          { href: "/branch-daily-closures", label: t("sidebar.dailyClosures"), icon: Lock, module: "cashier_journal", indent: true },
          { href: "/sales-analytics", label: t("sidebar.salesAnalytics"), icon: PieChart, module: "sales_analytics", indent: true },
          { href: "/targets-planning", label: t("sidebar.targetsPlanning"), icon: Target, module: "targets_planning", indent: true },
          { href: "/targets-dashboard", label: t("sidebar.targetsDashboard"), icon: TrendingUp, module: "targets", indent: true },
          { href: "/cashier-shift-performance", label: t("sidebar.cashierPerformance"), icon: BarChart3, module: "cashier_performance", indent: true },
          { href: "/incentives-management", label: t("sidebar.incentivesManagement"), icon: Gift, module: "incentives", indent: true },
          { href: "/pnl-dashboard", label: t("sidebar.pnlDashboard"), icon: TrendingUp, module: "pnl_dashboard", indent: true },
        ],
      },
    },
    {
      key: "assets",
      group: {
        label: t("sidebar.assets"),
        icon: Package,
        items: [
          { href: "/dashboard", label: t("sidebar.assetsDashboard"), icon: LayoutDashboard, module: "inventory", isHeader: true },
          { href: "/inventory", label: t("sidebar.inventory"), icon: Boxes, module: "inventory", indent: true },
          { href: "/manage", label: t("sidebar.assetManagement"), icon: ClipboardEdit, requiresAuth: true, module: "inventory", indent: true },
          { href: "/asset-transfers", label: t("sidebar.assetTransfers"), icon: ArrowLeftRight, module: "asset_transfers", indent: true },
          { href: "/branches", label: t("sidebar.branchManagement"), icon: Building2, requiresAuth: true, module: "branches", indent: true },
          { href: "/inspections", label: t("sidebar.inspections"), icon: CalendarCheck, module: "inspections", indent: true },
          { href: "/maintenance", label: t("sidebar.maintenance"), icon: AlertTriangle, module: "maintenance", indent: true },
          { href: "/reports", label: t("sidebar.assetReports"), icon: FileText, module: "reports", indent: true },
        ],
      },
    },
    {
      key: "construction",
      group: {
        label: t("sidebar.construction"),
        icon: Hammer,
        items: [
          { href: "/construction-projects", label: t("sidebar.projects"), icon: Briefcase, module: "construction_projects", isHeader: true },
          { href: "/contractors", label: t("sidebar.contractors"), icon: HardHat, module: "contractors", indent: true },
          { href: "/contracts", label: t("sidebar.contracts"), icon: FileSignature, module: "contracts", indent: true },
          { href: "/payment-requests", label: t("sidebar.paymentRequests"), icon: Wallet, module: "payment_requests", indent: true },
          { href: "/budget-planning", label: t("sidebar.budgetPlanning"), icon: Calculator, module: "budget_planning", indent: true },
          { href: "/construction-reports", label: t("sidebar.constructionReports"), icon: FileBarChart, module: "reports", indent: true },
        ],
      },
    },
    {
      key: "marketing",
      group: {
        label: t("sidebar.marketing"),
        icon: Megaphone,
        items: [
          { href: "/marketing", label: t("sidebar.marketingDashboard"), icon: LayoutDashboard, module: "marketing", isHeader: true },
          { href: "/marketing-campaigns", label: t("sidebar.marketingCampaigns"), icon: Target, module: "marketing_campaigns", indent: true },
          { href: "/marketing-social", label: t("sidebar.socialMedia"), icon: Share2, module: "marketing", indent: true },
          { href: "/marketing-influencers", label: t("sidebar.influencers"), icon: UserCheck, module: "marketing_influencers", indent: true },
          { href: "/influencer-contracts", label: t("sidebar.influencerContracts"), icon: FileText, module: "marketing_influencers", indent: true },
          { href: "/marketing-calendar", label: t("sidebar.marketingCalendar"), icon: Calendar, module: "marketing", indent: true },
          { href: "/marketing-tasks", label: t("sidebar.marketingTasks"), icon: ClipboardCheck, module: "marketing_tasks", indent: true },
          { href: "/marketing-reports", label: t("sidebar.performanceReports"), icon: BarChart3, module: "marketing", indent: true },
          { href: "/marketing-team", label: t("sidebar.marketingTeam"), icon: Users, module: "marketing", indent: true },
        ],
      },
    },
    {
      key: "warehouse",
      group: {
        label: t("sidebar.warehouse"),
        icon: Warehouse,
        items: [
          { href: "/warehouse", label: t("sidebar.warehouseDashboard"), icon: LayoutDashboard, module: "warehouse", isHeader: true },
          { href: "/transfer-requests", label: t("sidebar.transferRequests"), icon: Send, module: "transfer_requests", indent: true },
          { href: "/warehouse-inventory", label: t("sidebar.warehouseInventory"), icon: Boxes, module: "warehouse_inventory", indent: true },
          { href: "/branch-stock", label: t("sidebar.branchStock"), icon: PackageCheck, module: "warehouse", indent: true },
          { href: "/warehouse-movement-logs", label: t("sidebar.warehouseMovementLogs"), icon: FileBarChart, module: "warehouse", indent: true },
          { href: "/purchasing-requests", label: t("sidebar.purchasingRequests"), icon: ShoppingCart, module: "warehouse", indent: true },
          { href: "/warehouse-reports", label: t("sidebar.warehouseReports"), icon: BarChart3, module: "warehouse", indent: true },
        ],
      },
    },
    {
      key: "executive",
      group: {
        label: t("sidebar.executive", "السكرتارية التنفيذية"),
        icon: Briefcase,
        items: [
          { href: "/executive", label: t("sidebar.executiveDashboard", "لوحة التحكم"), icon: LayoutDashboard, module: "executive_dashboard", isHeader: true },
          { href: "/executive/calendar", label: t("sidebar.executiveCalendar", "التقويم"), icon: Calendar, module: "executive_calendar", indent: true },
          { href: "/executive/meetings", label: t("sidebar.executiveMeetings", "الاجتماعات"), icon: Users, module: "executive_meetings", indent: true },
          { href: "/executive/tasks", label: t("sidebar.executiveTasks", "المهام"), icon: ClipboardCheck, module: "executive_tasks", indent: true },
          { href: "/executive/correspondence", label: t("sidebar.executiveCorrespondence", "المراسلات"), icon: FileText, module: "executive_correspondence", indent: true },
          { href: "/documents", label: t("sidebar.documents", "الوثائق والأرشفة"), icon: FolderOpen, module: "documents", indent: true },
          { href: "/governance", label: t("sidebar.governance", "الحوكمة ومجلس الإدارة"), icon: Landmark, module: "governance", indent: true },
          { href: "/visitors", label: t("sidebar.visitors", "الزوار"), icon: UserCheck, module: "executive_visitors", indent: true },
          { href: "/travel-requests", label: t("sidebar.travelRequests", "طلبات السفر"), icon: MapPin, module: "executive_travel", indent: true },
          { href: "/executive/reports", label: t("sidebar.executiveReports", "التقارير"), icon: BarChart3, module: "executive_reports", indent: true },
        ],
      },
    },
    {
      key: "settings",
      group: {
        label: t("sidebar.settings"),
        icon: Settings,
        items: [
          { href: "/settings", label: t("sidebar.settingsDashboard"), icon: Settings, module: "settings", isHeader: true },
          { href: "/security-management", label: t("sidebar.securityManagement"), icon: Shield, module: "rbac_management", indent: true },
          { href: "/users", label: t("sidebar.userManagement"), icon: Users, module: "users", indent: true },
          { href: "/rbac-management", label: t("sidebar.rolesPermissions"), icon: Shield, module: "rbac_management", indent: true },
          { href: "/integrations", label: t("sidebar.integrations"), icon: Link2, module: "integrations", indent: true },
          { href: "/audit-logs", label: t("sidebar.auditLogs"), icon: FileSearch, module: "audit_logs", indent: true },
          { href: "/backups", label: t("sidebar.backups"), icon: HardDrive, module: "backups", indent: true },
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
          "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 cursor-pointer text-[12px] group",
          inGroup && !item.isHeader && "mr-4 text-[12px]",
          inGroup && item.isHeader && "mr-2 font-semibold",
          item.indent && "mr-6 text-[12px] border-r-2 border-primary/20 pr-3",
          location === item.href
            ? "bg-gradient-to-l from-primary/15 via-primary/10 to-transparent text-primary font-medium shadow-sm border-l-2 border-primary"
            : "text-muted-foreground hover:bg-gradient-to-l hover:from-secondary/80 hover:to-transparent hover:text-foreground hover:translate-x-1"
        )}
        data-testid={`nav-link-${item.href.replace(/\//g, '') || 'home'}`}
        onMouseEnter={() => handleLinkHover(item.href)}
      >
        <div className={cn(
          "p-1.5 rounded-md transition-colors",
          location === item.href ? "bg-primary/20 text-primary" : "bg-muted/50 group-hover:bg-primary/10 group-hover:text-primary"
        )}>
          <item.icon className={cn("flex-shrink-0", item.indent ? "w-3 h-3" : "w-3.5 h-3.5")} />
        </div>
        <span className="flex-1">{item.label}</span>
        {location === item.href && (
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        )}
      </div>
    </Link>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-72 bg-gradient-to-b from-card via-card to-card/95 border-l border-border/50 hidden md:flex flex-col sticky top-0 h-screen shadow-lg">
        <div className="p-4 border-b border-border/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <h1 className="text-base font-bold text-amber-700 leading-tight">{t("platformName")}</h1>
              <p className="text-[10px] text-amber-600/70 font-medium">{t("systemSubtitle")}</p>
            </div>
            {isAuthenticated && <NotificationsDropdown />}
          </div>
          {isAuthenticated && <GlobalSearch />}
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          {standaloneItems.map(item => renderNavItem(item))}
          
          <div className="pt-1">
            <div className="h-px bg-gradient-to-l from-transparent via-border to-transparent mb-1.5" />
          </div>

          {navGroups.map(({ key, group }) => (
            <Collapsible
              key={key}
              open={openGroups[key]}
              onOpenChange={() => toggleGroup(key)}
            >
              <CollapsibleTrigger asChild>
                <div
                  className={cn(
                    "flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl transition-all duration-200 cursor-pointer text-[13px] group",
                    isGroupActive(group.items)
                      ? "bg-gradient-to-l from-primary/15 via-primary/8 to-primary/3 text-primary shadow-sm border border-primary/20"
                      : "text-muted-foreground hover:bg-gradient-to-l hover:from-muted/60 hover:to-transparent hover:text-foreground"
                  )}
                  data-testid={`nav-group-${key}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg transition-all duration-200",
                      isGroupActive(group.items) 
                        ? "bg-primary/20 text-primary shadow-inner" 
                        : "bg-muted/60 group-hover:bg-primary/15 group-hover:text-primary"
                    )}>
                      <group.icon className="w-4 h-4 flex-shrink-0" />
                    </div>
                    <span className="font-semibold">{group.label}</span>
                  </div>
                  <div className={cn(
                    "p-1 rounded-full transition-all duration-200",
                    openGroups[key] ? "bg-primary/20 rotate-0" : "bg-muted/50 -rotate-90"
                  )}>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0 mt-0.5 mr-2 pr-1 border-r-2 border-primary/10">
                {group.items.map(item => renderNavItem(item, true))}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </nav>

        <div className="p-3 border-t border-border/30 bg-gradient-to-t from-muted/30 to-transparent">
          {isLoading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : isAuthenticated && user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2 rounded-xl bg-gradient-to-l from-primary/10 to-transparent border border-primary/10">
                <Avatar className="h-10 w-10 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                  <AvatarImage src={user.profileImageUrl || undefined} style={{ objectFit: 'cover' }} />
                  <AvatarFallback className="text-sm bg-primary/20 text-primary font-semibold">
                    {user.firstName?.[0] || user.phone?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate text-foreground">{user.firstName || user.phone}</p>
                  <Badge className="text-[10px] px-2 py-0.5 bg-primary/15 text-primary hover:bg-primary/20 border-0">
                    {t(ROLE_KEYS[user.role]) || user.role}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-[12px] text-muted-foreground hover:text-destructive cursor-pointer transition-all duration-200 rounded-lg hover:bg-destructive/10 border border-transparent hover:border-destructive/20"
                  data-testid="button-logout"
                >
                  {isLoggingOut ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                  <span>{t("logout")}</span>
                </button>
                <button
                  onClick={() => changeLanguage(currentLang === "ar" ? "en" : "ar")}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-[12px] text-muted-foreground hover:text-primary cursor-pointer transition-all duration-200 rounded-lg hover:bg-primary/10 border border-transparent hover:border-primary/20"
                  data-testid="button-language-toggle"
                >
                  <Languages className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Link href="/login">
                <div
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] text-white bg-gradient-to-l from-primary to-primary/80 cursor-pointer transition-all duration-200 rounded-xl hover:shadow-lg hover:shadow-primary/25 font-medium"
                  data-testid="button-login"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{t("login")}</span>
                </div>
              </Link>
              <button
                onClick={() => changeLanguage(currentLang === "ar" ? "en" : "ar")}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors rounded-lg hover:bg-secondary"
                data-testid="button-language-toggle"
              >
                <Languages className="w-4 h-4" />
                <span>{t("switchLanguage")}</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden min-h-14 border-b border-border bg-card/95 backdrop-blur-sm flex items-center px-3 sm:px-4 justify-between sticky top-0 z-50 safe-area-inset-top shadow-sm">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-9 sm:w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0 overflow-y-auto">
              <div className="p-4 border-b border-border/50">
                <h1 className="text-base font-bold text-amber-700">{t("platformName")}</h1>
                <p className="text-[10px] text-amber-600/70 font-medium">{t("systemSubtitle")}</p>
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
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{t(ROLE_KEYS[user.role]) || user.role}</Badge>
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
                      <span>{t("logout")}</span>
                    </button>
                  </div>
                ) : (
                  <Link href="/login">
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:text-primary/80 cursor-pointer transition-colors rounded-md hover:bg-primary/10">
                      <LogIn className="w-4 h-4" />
                      <span>{t("login")}</span>
                    </div>
                  </Link>
                )}
                <button
                  onClick={() => changeLanguage(currentLang === "ar" ? "en" : "ar")}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors rounded-md hover:bg-secondary mt-2"
                  data-testid="button-language-toggle-mobile"
                >
                  <Languages className="w-4 h-4" />
                  <span>{t("switchLanguage")}</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>

          <img src={logo} alt="Butter Bakery" className="h-8 object-contain" />
          
          <div className="flex items-center gap-2">
            {isAuthenticated && <NotificationsDropdown />}
          </div>
        </header>

        <div className="flex-1 overflow-auto scroll-smooth safe-area-inset-bottom">
          {children}
        </div>
      </main>
    </div>
  );
}
