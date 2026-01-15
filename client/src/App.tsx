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
import NotFound from "@/pages/not-found";
import PlatformHomePage from "@/pages/platform-home";
import DashboardPage from "@/pages/dashboard";
import InventoryPage from "@/pages/inventory";
import ManagePage from "@/pages/manage";
import BranchesPage from "@/pages/branches";
import MaintenancePage from "@/pages/maintenance";
import InspectionsPage from "@/pages/inspections";
import UsersPage from "@/pages/users";
import LoginPage from "@/pages/login";
import ConstructionProjectsPage from "@/pages/construction-projects";
import ConstructionProjectDetailPage from "@/pages/construction-project-detail";
import ContractorsPage from "@/pages/contractors";
import ReportsPage from "@/pages/reports";
import ConstructionDashboardPage from "@/pages/construction-dashboard";
import ConstructionReportsPage from "@/pages/construction-reports";
import ContractsPage from "@/pages/contracts";
import PaymentRequestsPage from "@/pages/payment-requests";
import BudgetPlanningPage from "@/pages/budget-planning";
import AssetTransfersPage from "@/pages/asset-transfers";
import AuditLogsPage from "@/pages/audit-logs";
import BackupsPage from "@/pages/backups";
import IntegrationsPage from "@/pages/integrations";
import OperationsDashboardPage from "@/pages/operations-dashboard";
import OperationsReportsDashboardPage from "@/pages/operations-reports-dashboard";
import ProductsPage from "@/pages/products";
import ProductionPage from "@/pages/production";
import QualityControlPage from "@/pages/quality-control";
import CashierJournalsPage from "@/pages/cashier-journals";
import CashierJournalFormPage from "@/pages/cashier-journal-form";
import BranchDailyClosingPage from "@/pages/branch-daily-closing";
import BranchDailyClosuresPage from "@/pages/branch-daily-closures";
import OperationsEmployeesPage from "@/pages/operations-employees";
import TargetsPlanningPage from "@/pages/targets-planning";
import TargetsDashboardPage from "@/pages/targets-dashboard";
import IncentivesManagementPage from "@/pages/incentives-management";
import SalesAnalyticsPage from "@/pages/sales-analytics";
import DisplayBarWastePage from "@/pages/display-bar-waste";
import AdvancedProductionOrdersPage from "@/pages/advanced-production-orders";
import AdvancedProductionOrderFormPage from "@/pages/advanced-production-order-form";
import AdvancedProductionOrderDetailsPage from "@/pages/advanced-production-order-details";
import SalesDataUploadsPage from "@/pages/sales-data-uploads";
import ProductionDashboardPage from "@/pages/production-dashboard";
import DailyProductionPage from "@/pages/daily-production";
import ProductionReportsPage from "@/pages/production-reports";
import RBACManagementPage from "@/pages/rbac-management";
import CashierShiftPerformancePage from "@/pages/cashier-shift-performance";
import MarketingCampaignsPage from "@/pages/marketing-campaigns";
import MarketingInfluencersPage from "@/pages/marketing-influencers";
import MarketingDashboardPage from "@/pages/marketing-dashboard";
import MarketingCalendarPage from "@/pages/marketing-calendar";
import MarketingTasksPage from "@/pages/marketing-tasks";
import MarketingReportsPage from "@/pages/marketing-reports";
import MarketingTeamPage from "@/pages/marketing-team";
import MarketingGoalsPage from "@/pages/marketing-goals";
import MarketingAssetsPage from "@/pages/marketing-assets";
import MarketingAlertsPage from "@/pages/marketing-alerts";
import MarketingExpensesPage from "@/pages/marketing-expenses";
import MarketingSocialPage from "@/pages/marketing-social";
import SettingsDashboardPage from "@/pages/settings-dashboard";
import ShiftManagementPage from "@/pages/shift-management";
import AttendanceCheckPage from "@/pages/attendance-check";
import TimesheetPage from "@/pages/timesheet";
import AttendanceDashboardPage from "@/pages/attendance-dashboard";
import BranchEmployeesPage from "@/pages/branch-employees";
import OrganizationalStructurePage from "@/pages/organizational-structure";
import EmployeeReportsDashboardPage from "@/pages/employee-reports-dashboard";
import PnLDashboardPage from "@/pages/pnl-dashboard";
import SecurityManagementPage from "@/pages/security-management";
import ProductionComparisonsPage from "@/pages/production-comparisons";
import ProductionComparisonReportsPage from "@/pages/production-comparison-reports";
import ProductCategoryManagementPage from "@/pages/product-category-management";
import type { SystemModule } from "@shared/schema";

function ModulePage({ component: Component, module }: { component: React.ComponentType; module: SystemModule }) {
  return (
    <ModuleProtectedRoute module={module}>
      <Component />
    </ModuleProtectedRoute>
  );
}

function AdminPage({ component: Component, module }: { component: React.ComponentType; module?: SystemModule }) {
  if (module) {
    return (
      <ModuleProtectedRoute module={module} requiredRole="admin">
        <Component />
      </ModuleProtectedRoute>
    );
  }
  return (
    <ProtectedRoute requiredRole="admin">
      <Component />
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/">{() => <ProtectedRoute><PlatformHomePage /></ProtectedRoute>}</Route>
      <Route path="/login">
        {() => (
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        )}
      </Route>
      
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
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProductionProvider>
        <TooltipProvider>
          <Toaster />
          <InactivityLogout />
          <Router />
          <PWAInstallPrompt />
          <OfflineIndicator />
        </TooltipProvider>
      </ProductionProvider>
    </QueryClientProvider>
  );
}

export default App;
