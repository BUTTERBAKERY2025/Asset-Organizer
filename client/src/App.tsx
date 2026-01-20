import React, { Suspense, lazy, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { OfflineIndicator } from "@/components/offline-indicator";
import { InactivityLogout } from "@/components/inactivity-logout";
import { ProductionProvider } from "@/contexts/ProductionContext";
import { ProtectedRoute, PublicOnlyRoute, ModuleProtectedRoute } from "@/components/protected-route";
import { AuthGate } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/error-boundary";
import { Loader2 } from "lucide-react";
import type { SystemModule } from "@shared/schema";

// Essential pages loaded eagerly (small, frequently used)
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";

// Preload critical pages after initial render for faster navigation
const preloadCriticalPages = () => {
  setTimeout(() => {
    import("@/pages/warehouse-dashboard");
    import("@/pages/production-dashboard");
    import("@/pages/inventory");
    import("@/pages/transfer-requests");
    import("@/pages/marketing-campaigns");
  }, 1000); // Delay to not block initial render
};

// All other pages loaded lazily for better performance
const PlatformHomePage = lazy(() => import("@/pages/platform-home"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const InventoryPage = lazy(() => import("@/pages/inventory"));
const ManagePage = lazy(() => import("@/pages/manage"));
const BranchesPage = lazy(() => import("@/pages/branches"));
const MaintenancePage = lazy(() => import("@/pages/maintenance"));
const InspectionsPage = lazy(() => import("@/pages/inspections"));
const UsersPage = lazy(() => import("@/pages/users"));
const ConstructionProjectsPage = lazy(() => import("@/pages/construction-projects"));
const ConstructionProjectDetailPage = lazy(() => import("@/pages/construction-project-detail"));
const ContractorsPage = lazy(() => import("@/pages/contractors"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const ConstructionDashboardPage = lazy(() => import("@/pages/construction-dashboard"));
const ConstructionReportsPage = lazy(() => import("@/pages/construction-reports"));
const ContractsPage = lazy(() => import("@/pages/contracts"));
const PaymentRequestsPage = lazy(() => import("@/pages/payment-requests"));
const BudgetPlanningPage = lazy(() => import("@/pages/budget-planning"));
const AssetTransfersPage = lazy(() => import("@/pages/asset-transfers"));
const AuditLogsPage = lazy(() => import("@/pages/audit-logs"));
const BackupsPage = lazy(() => import("@/pages/backups"));
const IntegrationsPage = lazy(() => import("@/pages/integrations"));
const OperationsDashboardPage = lazy(() => import("@/pages/operations-dashboard"));
const OperationsReportsDashboardPage = lazy(() => import("@/pages/operations-reports-dashboard"));
const ProductsPage = lazy(() => import("@/pages/products"));
const ProductionPage = lazy(() => import("@/pages/production"));
const QualityControlPage = lazy(() => import("@/pages/quality-control"));
const CashierJournalsPage = lazy(() => import("@/pages/cashier-journals"));
const CashierJournalFormPage = lazy(() => import("@/pages/cashier-journal-form"));
const BranchDailyClosingPage = lazy(() => import("@/pages/branch-daily-closing"));
const BranchDailyClosuresPage = lazy(() => import("@/pages/branch-daily-closures"));
const OperationsEmployeesPage = lazy(() => import("@/pages/operations-employees"));
const TargetsPlanningPage = lazy(() => import("@/pages/targets-planning"));
const TargetsDashboardPage = lazy(() => import("@/pages/targets-dashboard"));
const IncentivesManagementPage = lazy(() => import("@/pages/incentives-management"));
const SalesAnalyticsPage = lazy(() => import("@/pages/sales-analytics"));
const DisplayBarWastePage = lazy(() => import("@/pages/display-bar-waste"));
const AdvancedProductionOrdersPage = lazy(() => import("@/pages/advanced-production-orders"));
const AdvancedProductionOrderFormPage = lazy(() => import("@/pages/advanced-production-order-form"));
const AdvancedProductionOrderDetailsPage = lazy(() => import("@/pages/advanced-production-order-details"));
const SalesDataUploadsPage = lazy(() => import("@/pages/sales-data-uploads"));
const ProductionDashboardPage = lazy(() => import("@/pages/production-dashboard"));
const DailyProductionPage = lazy(() => import("@/pages/daily-production"));
const ProductionReportsPage = lazy(() => import("@/pages/production-reports"));
const RBACManagementPage = lazy(() => import("@/pages/rbac-management"));
const CashierShiftPerformancePage = lazy(() => import("@/pages/cashier-shift-performance"));
const MarketingCampaignsPage = lazy(() => import("@/pages/marketing-campaigns"));
const MarketingInfluencersPage = lazy(() => import("@/pages/marketing-influencers"));
const InfluencerContractsPage = lazy(() => import("@/pages/influencer-contracts"));
const MarketingDashboardPage = lazy(() => import("@/pages/marketing-dashboard"));
const MarketingCalendarPage = lazy(() => import("@/pages/marketing-calendar"));
const MarketingTasksPage = lazy(() => import("@/pages/marketing-tasks"));
const MarketingReportsPage = lazy(() => import("@/pages/marketing-reports"));
const MarketingTeamPage = lazy(() => import("@/pages/marketing-team"));
const MarketingGoalsPage = lazy(() => import("@/pages/marketing-goals"));
const MarketingAssetsPage = lazy(() => import("@/pages/marketing-assets"));
const MarketingAlertsPage = lazy(() => import("@/pages/marketing-alerts"));
const MarketingExpensesPage = lazy(() => import("@/pages/marketing-expenses"));
const MarketingSocialPage = lazy(() => import("@/pages/marketing-social"));
const SettingsDashboardPage = lazy(() => import("@/pages/settings-dashboard"));
const ShiftManagementPage = lazy(() => import("@/pages/shift-management"));
const AttendanceCheckPage = lazy(() => import("@/pages/attendance-check"));
const TimesheetPage = lazy(() => import("@/pages/timesheet"));
const AttendanceDashboardPage = lazy(() => import("@/pages/attendance-dashboard"));
const BranchEmployeesPage = lazy(() => import("@/pages/branch-employees"));
const OrganizationalStructurePage = lazy(() => import("@/pages/organizational-structure"));
const EmployeeReportsDashboardPage = lazy(() => import("@/pages/employee-reports-dashboard"));
const PnLDashboardPage = lazy(() => import("@/pages/pnl-dashboard"));
const SecurityManagementPage = lazy(() => import("@/pages/security-management"));
const ProductionComparisonsPage = lazy(() => import("@/pages/production-comparisons"));
const ProductionComparisonReportsPage = lazy(() => import("@/pages/production-comparison-reports"));
const ProductCategoryManagementPage = lazy(() => import("@/pages/product-category-management"));
const FinishedGoodsInventoryPage = lazy(() => import("@/pages/finished-goods-inventory"));
const WarehouseDashboardPage = lazy(() => import("@/pages/warehouse-dashboard"));
const TransferRequestsPage = lazy(() => import("@/pages/transfer-requests"));
const WarehouseInventoryPage = lazy(() => import("@/pages/warehouse-inventory"));
const WarehouseMovementLogsPage = lazy(() => import("@/pages/warehouse-movement-logs"));
const BranchStockPage = lazy(() => import("@/pages/branch-stock"));
const WarehouseReportsPage = lazy(() => import("@/pages/warehouse-reports"));
const PurchasingRequestsPage = lazy(() => import("@/pages/purchasing-requests"));
const ExecutiveDashboardPage = lazy(() => import("@/pages/executive-dashboard"));
const ExecutiveMeetingsPage = lazy(() => import("@/pages/executive-meetings"));
const ExecutiveTasksPage = lazy(() => import("@/pages/executive-tasks"));
const ExecutiveCorrespondencePage = lazy(() => import("@/pages/executive-correspondence"));
const DocumentsPage = lazy(() => import("@/pages/documents"));
const SharedDocumentPage = lazy(() => import("@/pages/shared-document"));
const GovernancePage = lazy(() => import("@/pages/governance"));
const BoardMembersPage = lazy(() => import("@/pages/governance/board-members"));
const ShareholdersPage = lazy(() => import("@/pages/governance/shareholders"));
const GovernanceMeetingsPage = lazy(() => import("@/pages/governance/meetings"));
const ResolutionsPage = lazy(() => import("@/pages/governance/resolutions"));
const CompliancePage = lazy(() => import("@/pages/governance/compliance"));
const VisitorsPage = lazy(() => import("@/pages/visitors"));
const TravelRequestsPage = lazy(() => import("@/pages/travel-requests"));
const ExecutiveReportsPage = lazy(() => import("@/pages/executive-reports"));
const ExecutiveCalendarPage = lazy(() => import("@/pages/executive-calendar"));

function AppLoadingFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F0E6]" dir="rtl">
      <Loader2 className="w-10 h-10 text-[#e67e22] animate-spin" />
      <p className="mt-4 text-[#1a3a2f] text-sm">جاري تحميل النظام...</p>
    </div>
  );
}

function PageLoadingFallback() {
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center" dir="rtl">
      <Loader2 className="w-8 h-8 text-[#e67e22] animate-spin" />
      <p className="mt-3 text-[#1a3a2f] text-sm">جاري التحميل...</p>
    </div>
  );
}

function ModulePage({ component: Component, module }: { component: React.ComponentType; module: SystemModule }) {
  return (
    <ModuleProtectedRoute module={module}>
      <Suspense fallback={<PageLoadingFallback />}>
        <Component />
      </Suspense>
    </ModuleProtectedRoute>
  );
}

function AdminPage({ component: Component, module }: { component: React.ComponentType; module?: SystemModule }) {
  if (module) {
    return (
      <ModuleProtectedRoute module={module} requiredRole="admin">
        <Suspense fallback={<PageLoadingFallback />}>
          <Component />
        </Suspense>
      </ModuleProtectedRoute>
    );
  }
  return (
    <ProtectedRoute requiredRole="admin">
      <Suspense fallback={<PageLoadingFallback />}>
        <Component />
      </Suspense>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/">{() => <ProtectedRoute><Suspense fallback={<PageLoadingFallback />}><PlatformHomePage /></Suspense></ProtectedRoute>}</Route>
      <Route path="/login">
        {() => (
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        )}
      </Route>
      
      {/* Public shared document page - no auth required */}
      <Route path="/share/:shareLink">{() => <Suspense fallback={<PageLoadingFallback />}><SharedDocumentPage /></Suspense>}</Route>
      
      {/* HR - الموارد البشرية */}
      <Route path="/branch-employees">{() => <ModulePage component={BranchEmployeesPage} module="branch_employees" />}</Route>
      <Route path="/organizational-structure">{() => <ModulePage component={OrganizationalStructurePage} module="organizational_structure" />}</Route>
      <Route path="/attendance-dashboard">{() => <ModulePage component={AttendanceDashboardPage} module="shifts" />}</Route>
      <Route path="/shift-management">{() => <ModulePage component={ShiftManagementPage} module="shifts" />}</Route>
      <Route path="/attendance-check">{() => <ModulePage component={AttendanceCheckPage} module="shifts" />}</Route>
      <Route path="/timesheet">{() => <ModulePage component={TimesheetPage} module="shifts" />}</Route>
      <Route path="/employee-reports">{() => <ModulePage component={EmployeeReportsDashboardPage} module="employee_reports" />}</Route>
      
      {/* Production - الإنتاج */}
      <Route path="/production-dashboard">{() => <ModulePage component={ProductionDashboardPage} module="production" />}</Route>
      <Route path="/advanced-production-orders">{() => <ModulePage component={AdvancedProductionOrdersPage} module="production" />}</Route>
      <Route path="/advanced-production-orders/new">{() => <ModulePage component={AdvancedProductionOrderFormPage} module="production" />}</Route>
      <Route path="/advanced-production-orders/:id">{() => <ModulePage component={AdvancedProductionOrderDetailsPage} module="production" />}</Route>
      <Route path="/advanced-production-orders/:id/edit">{() => <ModulePage component={AdvancedProductionOrderFormPage} module="production" />}</Route>
      <Route path="/daily-production">{() => <ModulePage component={DailyProductionPage} module="daily_production" />}</Route>
      <Route path="/sales-data-uploads">{() => <ModulePage component={SalesDataUploadsPage} module="production" />}</Route>
      <Route path="/production-reports">{() => <ModulePage component={ProductionReportsPage} module="production" />}</Route>
      <Route path="/production-comparisons">{() => <ModulePage component={ProductionComparisonsPage} module="production" />}</Route>
      <Route path="/production-comparison-reports">{() => <ModulePage component={ProductionComparisonReportsPage} module="production" />}</Route>
      <Route path="/product-category-management">{() => <ModulePage component={ProductCategoryManagementPage} module="production" />}</Route>
      <Route path="/production">{() => <ModulePage component={ProductionPage} module="production" />}</Route>
      <Route path="/finished-goods-inventory">{() => <ModulePage component={FinishedGoodsInventoryPage} module="production" />}</Route>
      
      {/* Operations - التشغيل */}
      <Route path="/operations">{() => <ModulePage component={OperationsDashboardPage} module="operations" />}</Route>
      <Route path="/products">{() => <ModulePage component={ProductsPage} module="products" />}</Route>
      <Route path="/quality-control">{() => <ModulePage component={QualityControlPage} module="quality_control" />}</Route>
      <Route path="/display-bar-waste">{() => <ModulePage component={DisplayBarWastePage} module="waste_tracking" />}</Route>
      <Route path="/operations-employees">{() => <ModulePage component={OperationsEmployeesPage} module="operations" />}</Route>
      <Route path="/operations-reports">{() => <ModulePage component={OperationsReportsDashboardPage} module="operations" />}</Route>
      
      {/* Sales - المبيعات والكاشير */}
      <Route path="/cashier-journals">{() => <ModulePage component={CashierJournalsPage} module="cashier_journal" />}</Route>
      <Route path="/cashier-journals/new">{() => <ModulePage component={CashierJournalFormPage} module="cashier_journal" />}</Route>
      <Route path="/cashier-journals/:id">{() => <ModulePage component={CashierJournalFormPage} module="cashier_journal" />}</Route>
      <Route path="/branch-daily-closures">{() => <ModulePage component={BranchDailyClosuresPage} module="cashier_journal" />}</Route>
      <Route path="/branch-daily-closing">{() => <ModulePage component={BranchDailyClosingPage} module="cashier_journal" />}</Route>
      <Route path="/sales-analytics">{() => <ModulePage component={SalesAnalyticsPage} module="sales_analytics" />}</Route>
      <Route path="/targets-planning">{() => <ModulePage component={TargetsPlanningPage} module="targets_planning" />}</Route>
      <Route path="/targets-dashboard">{() => <ModulePage component={TargetsDashboardPage} module="targets" />}</Route>
      <Route path="/cashier-shift-performance">{() => <ModulePage component={CashierShiftPerformancePage} module="cashier_performance" />}</Route>
      <Route path="/incentives-management">{() => <ModulePage component={IncentivesManagementPage} module="incentives" />}</Route>
      <Route path="/pnl-dashboard">{() => <ModulePage component={PnLDashboardPage} module="pnl_dashboard" />}</Route>
      
      {/* Assets - الأصول والجرد */}
      <Route path="/dashboard">{() => <ModulePage component={DashboardPage} module="inventory" />}</Route>
      <Route path="/inventory">{() => <ModulePage component={InventoryPage} module="inventory" />}</Route>
      <Route path="/manage">{() => <ModulePage component={ManagePage} module="inventory" />}</Route>
      <Route path="/asset-transfers">{() => <ModulePage component={AssetTransfersPage} module="asset_transfers" />}</Route>
      <Route path="/branches">{() => <ModulePage component={BranchesPage} module="branches" />}</Route>
      <Route path="/inspections">{() => <ModulePage component={InspectionsPage} module="inspections" />}</Route>
      <Route path="/maintenance">{() => <ModulePage component={MaintenancePage} module="maintenance" />}</Route>
      <Route path="/reports">{() => <ModulePage component={ReportsPage} module="reports" />}</Route>
      
      {/* Construction - المشاريع والإنشاءات */}
      <Route path="/construction-projects">{() => <ModulePage component={ConstructionProjectsPage} module="construction_projects" />}</Route>
      <Route path="/construction-projects/:id">{() => <ModulePage component={ConstructionProjectDetailPage} module="construction_projects" />}</Route>
      <Route path="/construction-dashboard">{() => <ModulePage component={ConstructionDashboardPage} module="construction_projects" />}</Route>
      <Route path="/contractors">{() => <ModulePage component={ContractorsPage} module="contractors" />}</Route>
      <Route path="/contracts">{() => <ModulePage component={ContractsPage} module="contracts" />}</Route>
      <Route path="/payment-requests">{() => <ModulePage component={PaymentRequestsPage} module="payment_requests" />}</Route>
      <Route path="/budget-planning">{() => <ModulePage component={BudgetPlanningPage} module="budget_planning" />}</Route>
      <Route path="/construction-reports">{() => <ModulePage component={ConstructionReportsPage} module="reports" />}</Route>
      
      {/* Marketing - التسويق */}
      <Route path="/marketing">{() => <ModulePage component={MarketingDashboardPage} module="marketing" />}</Route>
      <Route path="/marketing-campaigns">{() => <ModulePage component={MarketingCampaignsPage} module="marketing_campaigns" />}</Route>
      <Route path="/marketing-social">{() => <ModulePage component={MarketingSocialPage} module="marketing" />}</Route>
      <Route path="/marketing-influencers">{() => <ModulePage component={MarketingInfluencersPage} module="marketing_influencers" />}</Route>
      <Route path="/influencer-contracts">{() => <ModulePage component={InfluencerContractsPage} module="marketing_influencers" />}</Route>
      <Route path="/marketing-calendar">{() => <ModulePage component={MarketingCalendarPage} module="marketing" />}</Route>
      <Route path="/marketing-tasks">{() => <ModulePage component={MarketingTasksPage} module="marketing_tasks" />}</Route>
      <Route path="/marketing-reports">{() => <ModulePage component={MarketingReportsPage} module="marketing" />}</Route>
      <Route path="/marketing-team">{() => <ModulePage component={MarketingTeamPage} module="marketing" />}</Route>
      <Route path="/marketing-goals">{() => <ModulePage component={MarketingGoalsPage} module="marketing_goals" />}</Route>
      <Route path="/marketing-assets">{() => <ModulePage component={MarketingAssetsPage} module="marketing" />}</Route>
      <Route path="/marketing-alerts">{() => <ModulePage component={MarketingAlertsPage} module="marketing" />}</Route>
      <Route path="/marketing-expenses">{() => <ModulePage component={MarketingExpensesPage} module="marketing" />}</Route>
      
      {/* Settings & System - الإعدادات والنظام */}
      <Route path="/settings">{() => <ModulePage component={SettingsDashboardPage} module="settings" />}</Route>
      <Route path="/security-management">{() => <AdminPage component={SecurityManagementPage} module="rbac_management" />}</Route>
      <Route path="/users">{() => <AdminPage component={UsersPage} module="users" />}</Route>
      <Route path="/rbac-management">{() => <AdminPage component={RBACManagementPage} module="rbac_management" />}</Route>
      <Route path="/integrations">{() => <AdminPage component={IntegrationsPage} module="integrations" />}</Route>
      <Route path="/audit-logs">{() => <AdminPage component={AuditLogsPage} module="audit_logs" />}</Route>
      <Route path="/backups">{() => <AdminPage component={BackupsPage} module="backups" />}</Route>
      
      {/* Warehouse - المخازن والتحويلات */}
      <Route path="/warehouse">{() => <ModulePage component={WarehouseDashboardPage} module="warehouse" />}</Route>
      <Route path="/warehouse-dashboard">{() => <ModulePage component={WarehouseDashboardPage} module="warehouse" />}</Route>
      <Route path="/transfer-requests">{() => <ModulePage component={TransferRequestsPage} module="transfer_requests" />}</Route>
      <Route path="/warehouse-inventory">{() => <ModulePage component={WarehouseInventoryPage} module="warehouse_inventory" />}</Route>
      <Route path="/warehouse-movement-logs">{() => <ModulePage component={WarehouseMovementLogsPage} module="warehouse" />}</Route>
      <Route path="/branch-stock">{() => <ModulePage component={BranchStockPage} module="warehouse" />}</Route>
      <Route path="/warehouse-reports">{() => <ModulePage component={WarehouseReportsPage} module="warehouse" />}</Route>
      <Route path="/purchasing-requests">{() => <ModulePage component={PurchasingRequestsPage} module="warehouse" />}</Route>
      
      {/* Executive Secretariat - السكرتارية التنفيذية */}
      <Route path="/executive">{() => <ProtectedRoute><Suspense fallback={<PageLoadingFallback />}><ExecutiveDashboardPage /></Suspense></ProtectedRoute>}</Route>
      <Route path="/executive/meetings">{() => <ProtectedRoute><Suspense fallback={<PageLoadingFallback />}><ExecutiveMeetingsPage /></Suspense></ProtectedRoute>}</Route>
      <Route path="/executive/tasks">{() => <ProtectedRoute><Suspense fallback={<PageLoadingFallback />}><ExecutiveTasksPage /></Suspense></ProtectedRoute>}</Route>
      <Route path="/executive/correspondence">{() => <ProtectedRoute><Suspense fallback={<PageLoadingFallback />}><ExecutiveCorrespondencePage /></Suspense></ProtectedRoute>}</Route>
      <Route path="/documents">{() => <ProtectedRoute><Suspense fallback={<PageLoadingFallback />}><DocumentsPage /></Suspense></ProtectedRoute>}</Route>
      <Route path="/governance">{() => <ProtectedRoute><Suspense fallback={<PageLoadingFallback />}><GovernancePage /></Suspense></ProtectedRoute>}</Route>
      <Route path="/governance/board">{() => <ProtectedRoute><Suspense fallback={<PageLoadingFallback />}><BoardMembersPage /></Suspense></ProtectedRoute>}</Route>
      <Route path="/governance/shareholders">{() => <ProtectedRoute><Suspense fallback={<PageLoadingFallback />}><ShareholdersPage /></Suspense></ProtectedRoute>}</Route>
      <Route path="/governance/meetings">{() => <ProtectedRoute><Suspense fallback={<PageLoadingFallback />}><GovernanceMeetingsPage /></Suspense></ProtectedRoute>}</Route>
      <Route path="/governance/resolutions">{() => <ProtectedRoute><Suspense fallback={<PageLoadingFallback />}><ResolutionsPage /></Suspense></ProtectedRoute>}</Route>
      <Route path="/governance/compliance">{() => <ProtectedRoute><Suspense fallback={<PageLoadingFallback />}><CompliancePage /></Suspense></ProtectedRoute>}</Route>
      <Route path="/visitors">{() => <ProtectedRoute><Suspense fallback={<PageLoadingFallback />}><VisitorsPage /></Suspense></ProtectedRoute>}</Route>
      <Route path="/travel-requests">{() => <ProtectedRoute><Suspense fallback={<PageLoadingFallback />}><TravelRequestsPage /></Suspense></ProtectedRoute>}</Route>
      <Route path="/executive/reports">{() => <ProtectedRoute><Suspense fallback={<PageLoadingFallback />}><ExecutiveReportsPage /></Suspense></ProtectedRoute>}</Route>
      <Route path="/executive/calendar">{() => <ProtectedRoute><Suspense fallback={<PageLoadingFallback />}><ExecutiveCalendarPage /></Suspense></ProtectedRoute>}</Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Preload critical pages after app mounts
  useEffect(() => {
    preloadCriticalPages();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthGate>
          <ProductionProvider>
            <TooltipProvider>
              <Toaster />
              <InactivityLogout />
              <Router />
              <PWAInstallPrompt />
              <OfflineIndicator />
            </TooltipProvider>
          </ProductionProvider>
        </AuthGate>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
