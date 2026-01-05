import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { OfflineIndicator } from "@/components/offline-indicator";
import { InactivityLogout } from "@/components/inactivity-logout";
import { ProductionProvider } from "@/contexts/ProductionContext";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/protected-route";
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
import OperationsEmployeesPage from "@/pages/operations-employees";
import TargetsPlanningPage from "@/pages/targets-planning";
import TargetsDashboardPage from "@/pages/targets-dashboard";
import IncentivesManagementPage from "@/pages/incentives-management";
import SalesAnalyticsPage from "@/pages/sales-analytics";
import DisplayBarWastePage from "@/pages/display-bar-waste";
import AdvancedProductionOrdersPage from "@/pages/advanced-production-orders";
import AdvancedProductionOrderFormPage from "@/pages/advanced-production-order-form";
import AdvancedProductionOrderDetailsPage from "@/pages/advanced-production-order-details";
import AdvancedProductionPlannerPage from "@/pages/ai-production-planner";
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
import SettingsDashboardPage from "@/pages/settings-dashboard";
import ShiftManagementPage from "@/pages/shift-management";
import AttendanceCheckPage from "@/pages/attendance-check";
import TimesheetPage from "@/pages/timesheet";
import AttendanceDashboardPage from "@/pages/attendance-dashboard";
import BranchEmployeesPage from "@/pages/branch-employees";

function ProtectedPage({ component: Component }: { component: React.ComponentType }) {
  return (
    <ProtectedRoute>
      <Component />
    </ProtectedRoute>
  );
}

function AdminPage({ component: Component }: { component: React.ComponentType }) {
  return (
    <ProtectedRoute requiredRole="admin">
      <Component />
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={PlatformHomePage} />
      <Route path="/login">
        {() => (
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        )}
      </Route>
      <Route path="/dashboard">{() => <ProtectedPage component={DashboardPage} />}</Route>
      <Route path="/inventory">{() => <ProtectedPage component={InventoryPage} />}</Route>
      <Route path="/manage">{() => <ProtectedPage component={ManagePage} />}</Route>
      <Route path="/branches">{() => <ProtectedPage component={BranchesPage} />}</Route>
      <Route path="/maintenance">{() => <ProtectedPage component={MaintenancePage} />}</Route>
      <Route path="/inspections">{() => <ProtectedPage component={InspectionsPage} />}</Route>
      <Route path="/users">{() => <AdminPage component={UsersPage} />}</Route>
      <Route path="/construction-projects">{() => <ProtectedPage component={ConstructionProjectsPage} />}</Route>
      <Route path="/construction-projects/:id">{() => <ProtectedPage component={ConstructionProjectDetailPage} />}</Route>
      <Route path="/contractors">{() => <ProtectedPage component={ContractorsPage} />}</Route>
      <Route path="/construction-dashboard">{() => <ProtectedPage component={ConstructionDashboardPage} />}</Route>
      <Route path="/construction-reports">{() => <ProtectedPage component={ConstructionReportsPage} />}</Route>
      <Route path="/contracts">{() => <ProtectedPage component={ContractsPage} />}</Route>
      <Route path="/payment-requests">{() => <ProtectedPage component={PaymentRequestsPage} />}</Route>
      <Route path="/budget-planning">{() => <ProtectedPage component={BudgetPlanningPage} />}</Route>
      <Route path="/asset-transfers">{() => <ProtectedPage component={AssetTransfersPage} />}</Route>
      <Route path="/reports">{() => <ProtectedPage component={ReportsPage} />}</Route>
      <Route path="/audit-logs">{() => <AdminPage component={AuditLogsPage} />}</Route>
      <Route path="/backups">{() => <AdminPage component={BackupsPage} />}</Route>
      <Route path="/integrations">{() => <AdminPage component={IntegrationsPage} />}</Route>
      <Route path="/operations">{() => <ProtectedPage component={OperationsDashboardPage} />}</Route>
      <Route path="/operations-reports">{() => <ProtectedPage component={OperationsReportsDashboardPage} />}</Route>
      <Route path="/products">{() => <ProtectedPage component={ProductsPage} />}</Route>
      <Route path="/production">{() => <ProtectedPage component={ProductionPage} />}</Route>
      <Route path="/quality-control">{() => <ProtectedPage component={QualityControlPage} />}</Route>
      <Route path="/cashier-journals">{() => <ProtectedPage component={CashierJournalsPage} />}</Route>
      <Route path="/cashier-journals/new">{() => <ProtectedPage component={CashierJournalFormPage} />}</Route>
      <Route path="/cashier-journals/:id">{() => <ProtectedPage component={CashierJournalFormPage} />}</Route>
      <Route path="/operations-employees">{() => <ProtectedPage component={OperationsEmployeesPage} />}</Route>
      <Route path="/targets-planning">{() => <ProtectedPage component={TargetsPlanningPage} />}</Route>
      <Route path="/targets-dashboard">{() => <ProtectedPage component={TargetsDashboardPage} />}</Route>
      <Route path="/incentives-management">{() => <ProtectedPage component={IncentivesManagementPage} />}</Route>
      <Route path="/sales-analytics">{() => <ProtectedPage component={SalesAnalyticsPage} />}</Route>
      <Route path="/display-bar-waste">{() => <ProtectedPage component={DisplayBarWastePage} />}</Route>
      <Route path="/production-dashboard">{() => <ProtectedPage component={ProductionDashboardPage} />}</Route>
      <Route path="/advanced-production-orders">{() => <ProtectedPage component={AdvancedProductionOrdersPage} />}</Route>
      <Route path="/advanced-production-orders/new">{() => <ProtectedPage component={AdvancedProductionOrderFormPage} />}</Route>
      <Route path="/advanced-production-orders/:id">{() => <ProtectedPage component={AdvancedProductionOrderDetailsPage} />}</Route>
      <Route path="/advanced-production-orders/:id/edit">{() => <ProtectedPage component={AdvancedProductionOrderFormPage} />}</Route>
      <Route path="/ai-production-planner">{() => <ProtectedPage component={AdvancedProductionPlannerPage} />}</Route>
      <Route path="/sales-data-uploads">{() => <ProtectedPage component={SalesDataUploadsPage} />}</Route>
      <Route path="/daily-production">{() => <ProtectedPage component={DailyProductionPage} />}</Route>
      <Route path="/production-reports">{() => <ProtectedPage component={ProductionReportsPage} />}</Route>
      <Route path="/rbac-management">{() => <AdminPage component={RBACManagementPage} />}</Route>
      <Route path="/cashier-shift-performance">{() => <ProtectedPage component={CashierShiftPerformancePage} />}</Route>
      <Route path="/marketing">{() => <ProtectedPage component={MarketingDashboardPage} />}</Route>
      <Route path="/marketing-campaigns">{() => <ProtectedPage component={MarketingCampaignsPage} />}</Route>
      <Route path="/marketing-influencers">{() => <ProtectedPage component={MarketingInfluencersPage} />}</Route>
      <Route path="/marketing-calendar">{() => <ProtectedPage component={MarketingCalendarPage} />}</Route>
      <Route path="/marketing-tasks">{() => <ProtectedPage component={MarketingTasksPage} />}</Route>
      <Route path="/marketing-reports">{() => <ProtectedPage component={MarketingReportsPage} />}</Route>
      <Route path="/marketing-team">{() => <ProtectedPage component={MarketingTeamPage} />}</Route>
      <Route path="/marketing-goals">{() => <ProtectedPage component={MarketingGoalsPage} />}</Route>
      <Route path="/marketing-assets">{() => <ProtectedPage component={MarketingAssetsPage} />}</Route>
      <Route path="/marketing-alerts">{() => <ProtectedPage component={MarketingAlertsPage} />}</Route>
      <Route path="/marketing-expenses">{() => <ProtectedPage component={MarketingExpensesPage} />}</Route>
      <Route path="/settings">{() => <ProtectedPage component={SettingsDashboardPage} />}</Route>
      <Route path="/attendance-dashboard">{() => <ProtectedPage component={AttendanceDashboardPage} />}</Route>
      <Route path="/shift-management">{() => <ProtectedPage component={ShiftManagementPage} />}</Route>
      <Route path="/attendance-check">{() => <ProtectedPage component={AttendanceCheckPage} />}</Route>
      <Route path="/branch-employees">{() => <ProtectedPage component={BranchEmployeesPage} />}</Route>
      <Route path="/timesheet">{() => <ProtectedPage component={TimesheetPage} />}</Route>
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
