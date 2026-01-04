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
import { lazy, Suspense, type LazyExoticComponent, type ComponentType } from "react";
import { Loader2 } from "lucide-react";

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    </div>
  );
}

const NotFound = lazy(() => import("@/pages/not-found"));
const PlatformHomePage = lazy(() => import("@/pages/platform-home"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const InventoryPage = lazy(() => import("@/pages/inventory"));
const ManagePage = lazy(() => import("@/pages/manage"));
const BranchesPage = lazy(() => import("@/pages/branches"));
const MaintenancePage = lazy(() => import("@/pages/maintenance"));
const InspectionsPage = lazy(() => import("@/pages/inspections"));
const UsersPage = lazy(() => import("@/pages/users"));
const LoginPage = lazy(() => import("@/pages/login"));
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
const ShiftsPage = lazy(() => import("@/pages/shifts"));
const ProductionPage = lazy(() => import("@/pages/production"));
const QualityControlPage = lazy(() => import("@/pages/quality-control"));
const CashierJournalsPage = lazy(() => import("@/pages/cashier-journals"));
const CashierJournalFormPage = lazy(() => import("@/pages/cashier-journal-form"));
const OperationsEmployeesPage = lazy(() => import("@/pages/operations-employees"));
const TargetsPlanningPage = lazy(() => import("@/pages/targets-planning"));
const TargetsDashboardPage = lazy(() => import("@/pages/targets-dashboard"));
const IncentivesManagementPage = lazy(() => import("@/pages/incentives-management"));
const SalesAnalyticsPage = lazy(() => import("@/pages/sales-analytics"));
const DisplayBarWastePage = lazy(() => import("@/pages/display-bar-waste"));
const AdvancedProductionOrdersPage = lazy(() => import("@/pages/advanced-production-orders"));
const AdvancedProductionOrderFormPage = lazy(() => import("@/pages/advanced-production-order-form"));
const AdvancedProductionOrderDetailsPage = lazy(() => import("@/pages/advanced-production-order-details"));
const AdvancedProductionPlannerPage = lazy(() => import("@/pages/ai-production-planner"));
const SalesDataUploadsPage = lazy(() => import("@/pages/sales-data-uploads"));
const ProductionDashboardPage = lazy(() => import("@/pages/production-dashboard"));
const DailyProductionPage = lazy(() => import("@/pages/daily-production"));
const ProductionReportsPage = lazy(() => import("@/pages/production-reports"));
const RBACManagementPage = lazy(() => import("@/pages/rbac-management"));
const CashierShiftPerformancePage = lazy(() => import("@/pages/cashier-shift-performance"));
const MarketingCampaignsPage = lazy(() => import("@/pages/marketing-campaigns"));
const MarketingInfluencersPage = lazy(() => import("@/pages/marketing-influencers"));
const MarketingDashboardPage = lazy(() => import("@/pages/marketing-dashboard"));
const MarketingCalendarPage = lazy(() => import("@/pages/marketing-calendar"));
const MarketingTasksPage = lazy(() => import("@/pages/marketing-tasks"));
const MarketingReportsPage = lazy(() => import("@/pages/marketing-reports"));
const MarketingTeamPage = lazy(() => import("@/pages/marketing-team"));
const MarketingGoalsPage = lazy(() => import("@/pages/marketing-goals"));
const MarketingAssetsPage = lazy(() => import("@/pages/marketing-assets"));
const MarketingAlertsPage = lazy(() => import("@/pages/marketing-alerts"));
const MarketingExpensesPage = lazy(() => import("@/pages/marketing-expenses"));

type LazyComponent = LazyExoticComponent<ComponentType<unknown>>;

function ProtectedPage({ component: Component }: { component: LazyComponent }) {
  return (
    <ProtectedRoute>
      <Suspense fallback={<PageLoader />}>
        <Component />
      </Suspense>
    </ProtectedRoute>
  );
}

function AdminPage({ component: Component }: { component: LazyComponent }) {
  return (
    <ProtectedRoute requiredRole="admin">
      <Suspense fallback={<PageLoader />}>
        <Component />
      </Suspense>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
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
        <Route path="/shifts">{() => <ProtectedPage component={ShiftsPage} />}</Route>
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
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
