import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { OfflineIndicator } from "@/components/offline-indicator";
import { ProductionProvider } from "@/contexts/ProductionContext";
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
import ShiftsPage from "@/pages/shifts";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={PlatformHomePage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/inventory" component={InventoryPage} />
      <Route path="/manage" component={ManagePage} />
      <Route path="/branches" component={BranchesPage} />
      <Route path="/maintenance" component={MaintenancePage} />
      <Route path="/inspections" component={InspectionsPage} />
      <Route path="/users" component={UsersPage} />
      <Route path="/construction-projects" component={ConstructionProjectsPage} />
      <Route path="/construction-projects/:id" component={ConstructionProjectDetailPage} />
      <Route path="/contractors" component={ContractorsPage} />
      <Route path="/construction-dashboard" component={ConstructionDashboardPage} />
      <Route path="/construction-reports" component={ConstructionReportsPage} />
      <Route path="/contracts" component={ContractsPage} />
      <Route path="/payment-requests" component={PaymentRequestsPage} />
      <Route path="/budget-planning" component={BudgetPlanningPage} />
      <Route path="/asset-transfers" component={AssetTransfersPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/audit-logs" component={AuditLogsPage} />
      <Route path="/backups" component={BackupsPage} />
      <Route path="/integrations" component={IntegrationsPage} />
      <Route path="/operations" component={OperationsDashboardPage} />
      <Route path="/operations-reports" component={OperationsReportsDashboardPage} />
      <Route path="/products" component={ProductsPage} />
      <Route path="/shifts" component={ShiftsPage} />
      <Route path="/production" component={ProductionPage} />
      <Route path="/quality-control" component={QualityControlPage} />
      <Route path="/cashier-journals" component={CashierJournalsPage} />
      <Route path="/cashier-journals/new" component={CashierJournalFormPage} />
      <Route path="/cashier-journals/:id" component={CashierJournalFormPage} />
      <Route path="/operations-employees" component={OperationsEmployeesPage} />
      <Route path="/targets-planning" component={TargetsPlanningPage} />
      <Route path="/targets-dashboard" component={TargetsDashboardPage} />
      <Route path="/incentives-management" component={IncentivesManagementPage} />
      <Route path="/sales-analytics" component={SalesAnalyticsPage} />
      <Route path="/display-bar-waste" component={DisplayBarWastePage} />
      <Route path="/production-dashboard" component={ProductionDashboardPage} />
      <Route path="/advanced-production-orders" component={AdvancedProductionOrdersPage} />
      <Route path="/advanced-production-orders/new" component={AdvancedProductionOrderFormPage} />
      <Route path="/advanced-production-orders/:id" component={AdvancedProductionOrderDetailsPage} />
      <Route path="/advanced-production-orders/:id/edit" component={AdvancedProductionOrderFormPage} />
      <Route path="/ai-production-planner" component={AdvancedProductionPlannerPage} />
      <Route path="/sales-data-uploads" component={SalesDataUploadsPage} />
      <Route path="/daily-production" component={DailyProductionPage} />
      <Route path="/production-reports" component={ProductionReportsPage} />
      <Route path="/rbac-management" component={RBACManagementPage} />
      <Route path="/cashier-shift-performance" component={CashierShiftPerformancePage} />
      <Route path="/marketing" component={MarketingDashboardPage} />
      <Route path="/marketing-campaigns" component={MarketingCampaignsPage} />
      <Route path="/marketing-influencers" component={MarketingInfluencersPage} />
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
          <Router />
          <PWAInstallPrompt />
          <OfflineIndicator />
        </TooltipProvider>
      </ProductionProvider>
    </QueryClientProvider>
  );
}

export default App;
