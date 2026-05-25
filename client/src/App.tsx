import React, { Suspense, useEffect, useTransition, useCallback, useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { OfflineIndicator } from "@/components/offline-indicator";
import { SlowConnectionBanner } from "@/components/slow-connection-banner";
import { DataErrorBanner } from "@/components/data-error-banner";
import { InactivityLogout } from "@/components/inactivity-logout";
import { ProductionProvider } from "@/contexts/ProductionContext";
import { ProtectedRoute, PublicOnlyRoute, ModuleProtectedRoute } from "@/components/protected-route";
import { AuthGate } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/error-boundary";
import { Loader2 } from "lucide-react";
import type { SystemModule } from "@shared/schema";

import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import { makeLazy, startAggressivePreload, prefetchAdjacentPages } from "@/lib/pagePreloader";

const PlatformHomePage = makeLazy("platform-home");
const DashboardPage = makeLazy("dashboard");
const InventoryPage = makeLazy("inventory");
const ManagePage = makeLazy("manage");
const BranchesPage = makeLazy("branches");
const MaintenancePage = makeLazy("maintenance");
const InspectionsPage = makeLazy("inspections");
const UsersPage = makeLazy("users");
const ConstructionProjectsPage = makeLazy("construction-projects");
const FieldHubPage = makeLazy("field-hub");
const FieldChecklistTemplatesPage = makeLazy("field-checklist-templates");
const FieldChecklistDetailPage = makeLazy("field-checklist-detail");
const ConstructionProjectDetailPage = makeLazy("construction-project-detail");
const ContractorsPage = makeLazy("contractors");
const ReportsPage = makeLazy("reports");
const ConstructionDashboardPage = makeLazy("construction-dashboard");
const ConstructionReportsPage = makeLazy("construction-reports");
const ContractsPage = makeLazy("contracts");
const ContractDetailPage = makeLazy("contract-detail");
const ContractTemplatesPage = makeLazy("contract-templates");
const PaymentRequestsPage = makeLazy("payment-requests");
const ContractorStatementsPage = makeLazy("contractor-statements");
const ContractorOversightPage = makeLazy("contractor-oversight");
const ContractorStatementDetailPage = makeLazy("contractor-statement-detail");
const DailyLogsListPage = makeLazy("daily-logs-list");
const DailyWorkLogPage = makeLazy("daily-work-log");
const DailyLogPrintPage = makeLazy("daily-log-print");
const BudgetPlanningPage = makeLazy("budget-planning");
const AssetTransfersPage = makeLazy("asset-transfers");
const AuditLogsPage = makeLazy("audit-logs");
const BackupsPage = makeLazy("backups");
const IntegrationsPage = makeLazy("integrations");
const OperationsDashboardPage = makeLazy("operations-dashboard");
const BranchShiftsPage = makeLazy("branch-shifts");
const ShiftReportsPage = makeLazy("shift-reports");
const OperationsReportsDashboardPage = makeLazy("operations-reports-dashboard");
const ProductsPage = makeLazy("products");
const ProductionPage = makeLazy("production");
const QualityControlPage = makeLazy("quality-control");
const CashierJournalsPage = makeLazy("cashier-journals");
const CashierJournalFormPage = makeLazy("cashier-journal-form");
const BranchDailyClosingPage = makeLazy("branch-daily-closing");
const BranchDailyClosuresPage = makeLazy("branch-daily-closures");
const BranchDailyClosureDetailPage = makeLazy("branch-daily-closure-detail");
const OperationsEmployeesPage = makeLazy("operations-employees");
const TargetsPlanningPage = makeLazy("targets-planning");
const TargetsDashboardPage = makeLazy("targets-dashboard");
const IncentivesManagementPage = makeLazy("incentives-management");
const SalesAnalyticsPage = makeLazy("sales-analytics");
const DisplayBarWastePage = makeLazy("display-bar-waste");
const AdvancedProductionOrdersPage = makeLazy("advanced-production-orders");
const AdvancedProductionOrderFormPage = makeLazy("advanced-production-order-form");
const AdvancedProductionOrderDetailsPage = makeLazy("advanced-production-order-details");
const SalesDataUploadsPage = makeLazy("sales-data-uploads");
const EventPosPage = makeLazy("event-pos");
const EventPosSettingsPage = makeLazy("event-pos-settings");
const ProductionDashboardPage = makeLazy("production-dashboard");
const DailyProductionPage = makeLazy("daily-production");
const ProductionReportsPage = makeLazy("production-reports");
const RBACManagementPage = makeLazy("rbac-management");
const CashierShiftPerformancePage = makeLazy("cashier-shift-performance");
const MarketingCampaignsPage = makeLazy("marketing-campaigns");
const MarketingInfluencersPage = makeLazy("marketing-influencers");
const InfluencerContractsPage = makeLazy("influencer-contracts");
const MarketingDashboardPage = makeLazy("marketing-dashboard");
const MarketingCalendarPage = makeLazy("marketing-calendar");
const MarketingTasksPage = makeLazy("marketing-tasks");
const MarketingReportsPage = makeLazy("marketing-reports");
const MarketingTeamPage = makeLazy("marketing-team");
const MarketingGoalsPage = makeLazy("marketing-goals");
const MarketingAssetsPage = makeLazy("marketing-assets");
const MarketingAlertsPage = makeLazy("marketing-alerts");
const MarketingExpensesPage = makeLazy("marketing-expenses");
const MarketingSocialPage = makeLazy("marketing-social");
const MarketingOpeningCampaignsPage = makeLazy("marketing-opening-campaigns");
const MarketingMediaTeamPage = makeLazy("marketing-media-team");
const OpeningPublicPage = makeLazy("opening-public");
const SocialResponsibilityPage = makeLazy("social-responsibility");
const SettingsDashboardPage = makeLazy("settings-dashboard");
const BiometricSettingsPage = makeLazy("biometric-settings");
const NotificationsManagementPage = makeLazy("notifications-management");
const NotificationsCenterPage = makeLazy("notifications-center");
const ShiftManagementPage = makeLazy("shift-management");
const AttendanceCheckPage = makeLazy("attendance-check");
const TimesheetPage = makeLazy("timesheet");
const AttendanceDashboardPage = makeLazy("attendance-dashboard");
const BranchEmployeesPage = makeLazy("branch-employees");
const TerminatedEmployeesPage = makeLazy("terminated-employees");
const OrganizationalStructurePage = makeLazy("organizational-structure");
const EmployeeReportsDashboardPage = makeLazy("employee-reports-dashboard");
const PnLDashboardPage = makeLazy("pnl-dashboard");
const PnLRentHistoryPage = makeLazy("pnl-rent-history");
const PnLRecurringExpensesPage = makeLazy("pnl-recurring-expenses");
const SecurityManagementPage = makeLazy("security-management");
const ProductionComparisonsPage = makeLazy("production-comparisons");
const ProductionComparisonReportsPage = makeLazy("production-comparison-reports");
const ProductCategoryManagementPage = makeLazy("product-category-management");
const FinishedGoodsInventoryPage = makeLazy("finished-goods-inventory");
const WarehouseDashboardPage = makeLazy("warehouse-dashboard");
const TransferRequestsPage = makeLazy("transfer-requests");
const WarehouseInventoryPage = makeLazy("warehouse-inventory");
const WarehouseMovementLogsPage = makeLazy("warehouse-movement-logs");
const BranchStockPage = makeLazy("branch-stock");
const WarehouseReportsPage = makeLazy("warehouse-reports");
const PurchasingRequestsPage = makeLazy("purchasing-requests");
const ExecutiveDashboardPage = makeLazy("executive-dashboard");
const ExecutiveMeetingsPage = makeLazy("executive-meetings");
const ExecutiveTasksPage = makeLazy("executive-tasks");
const ExecutiveCorrespondencePage = makeLazy("executive-correspondence");
const ExecutiveOrgStructurePage = makeLazy("executive-org-structure");
const DocumentsPage = makeLazy("documents");
const SharedDocumentPage = makeLazy("shared-document");
const DiscountCardPage = makeLazy("discount-card");
const RsvpPage = makeLazy("rsvp-page");
const GovernancePage = makeLazy("governance");
const BoardMembersPage = makeLazy("governance-board-members");
const ShareholdersPage = makeLazy("governance-shareholders");
const GovernanceMeetingsPage = makeLazy("governance-meetings");
const AssemblyMinutesPage = makeLazy("governance-assembly-minutes");
const ResolutionsPage = makeLazy("governance-resolutions");
const CompliancePage = makeLazy("governance-compliance");
const ShareTransfersPage = makeLazy("governance-share-transfers");
const DisclosuresPage = makeLazy("governance-disclosures");
const DividendsPage = makeLazy("governance-dividends");
const CapitalPage = makeLazy("governance-capital");
const VotingPage = makeLazy("governance-voting");
const GeneralAssemblyPage = makeLazy("governance-general-assembly");
const SecurityPage = makeLazy("security");
const VisitorsPage = makeLazy("visitors");
const TravelRequestsPage = makeLazy("travel-requests");
const ExecutiveReportsPage = makeLazy("executive-reports");
const ExecutiveCalendarPage = makeLazy("executive-calendar");
const CompanyTemplatesPage = makeLazy("company-templates");
const JobOffersPage = makeLazy("job-offers");
const JobOfferPublicPage = makeLazy("job-offer-public");
const OnboardingPage = makeLazy("onboarding");
const OnboardingPublicPage = makeLazy("onboarding-public");
const WarningPublicPage = makeLazy("warning-public");
const EmploymentApplicationsPage = makeLazy("employment-applications");
const EmploymentApplicationPublicPage = makeLazy("employment-application-public");
const VacancyPublicPage = makeLazy("vacancy-public");
const PublicGreetingPage = makeLazy("public-greeting");
const FloorPlanPage = makeLazy("floor-plan");
const HRHubPage = makeLazy("hr-hub");
const HREmployeeDocumentsPage = makeLazy("hr/employee-documents");
const HRLeavesPage = makeLazy("hr/leaves");
const HRWarningsPage = makeLazy("hr/warnings");
const HRAdvancesPage = makeLazy("hr/advances");
const HREosPage = makeLazy("hr/eos");

function AppLoadingFallback() {
  // Render nothing: the static #initial-loader in index.html stays visible
  // until AuthGate dispatches 'app-ready'. Avoids any flash of a second
  // spinner on top of the existing one.
  return null;
}

function DelayedFallback() {
  // Zero-flash navigation: render nothing during chunk-load. The aggressive
  // page preloader fetches chunks in the background, so by the time the user
  // clicks a link the chunk is usually already cached and Suspense resolves
  // synchronously. For the rare uncached chunk, a brief blank moment is
  // preferable to a visible skeleton block.
  const [showSlow, setShowSlow] = useState(false);
  useEffect(() => {
    // Only show a faint indicator if chunk takes >800ms (slow network).
    const t = setTimeout(() => setShowSlow(true), 800);
    return () => clearTimeout(t);
  }, []);
  if (!showSlow) return null;
  return (
    <div className="min-h-[60vh] p-6 space-y-5 skeleton-delayed" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 skeleton-shimmer w-44 rounded-lg" style={{ animationDelay: '0ms' }} />
          <div className="h-6 skeleton-shimmer w-20 opacity-40 rounded-md" style={{ animationDelay: '40ms' }} />
        </div>
        <div className="h-9 skeleton-shimmer w-32 rounded-lg opacity-35" style={{ animationDelay: '60ms' }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="h-[88px] skeleton-shimmer rounded-xl" style={{ animationDelay: '0ms' }} />
        <div className="h-[88px] skeleton-shimmer rounded-xl opacity-85" style={{ animationDelay: '40ms' }} />
        <div className="h-[88px] skeleton-shimmer rounded-xl opacity-75" style={{ animationDelay: '80ms' }} />
        <div className="h-[88px] skeleton-shimmer rounded-xl opacity-65 hidden lg:block" style={{ animationDelay: '120ms' }} />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-10 skeleton-shimmer w-full max-w-sm rounded-lg" style={{ animationDelay: '30ms' }} />
        <div className="h-10 skeleton-shimmer w-28 rounded-lg opacity-45" style={{ animationDelay: '70ms' }} />
      </div>
      <div className="h-64 skeleton-shimmer rounded-xl" style={{ animationDelay: '40ms' }} />
    </div>
  );
}
const PageLoadingFallback = React.memo(DelayedFallback);

const PageWrapper = React.memo(function PageWrapper({ children }: { children: React.ReactNode }) {
  return <div className="page-ready">{children}</div>;
});

const ProtectedPage = React.memo(function ProtectedPage({ component: Component }: { component: React.ComponentType }) {
  return (
    <ProtectedRoute>
      <Suspense fallback={<PageLoadingFallback />}>
        <PageWrapper><Component /></PageWrapper>
      </Suspense>
    </ProtectedRoute>
  );
});

const ModulePage = React.memo(function ModulePage({ component: Component, module }: { component: React.ComponentType; module: SystemModule }) {
  return (
    <ModuleProtectedRoute module={module}>
      <Suspense fallback={<PageLoadingFallback />}>
        <PageWrapper><Component /></PageWrapper>
      </Suspense>
    </ModuleProtectedRoute>
  );
});

const AdminPage = React.memo(function AdminPage({ component: Component, module }: { component: React.ComponentType; module?: SystemModule }) {
  if (module) {
    return (
      <ModuleProtectedRoute module={module} requiredRole="admin">
        <Suspense fallback={<PageLoadingFallback />}>
          <PageWrapper><Component /></PageWrapper>
        </Suspense>
      </ModuleProtectedRoute>
    );
  }
  return (
    <ProtectedRoute requiredRole="admin">
      <Suspense fallback={<PageLoadingFallback />}>
        <PageWrapper><Component /></PageWrapper>
      </Suspense>
    </ProtectedRoute>
  );
});

const Router = React.memo(function Router() {
  return (
    <Switch>
      <Route path="/">{() => <ProtectedPage component={PlatformHomePage} />}</Route>
      <Route path="/login">
        {() => (
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        )}
      </Route>
      
      {/* Public shared document page - no auth required */}
      <Route path="/share/:shareLink">{() => <Suspense fallback={<PageLoadingFallback />}><SharedDocumentPage /></Suspense>}</Route>
      
      {/* Public discount card page - no auth required */}
      <Route path="/discount/:code">{() => <Suspense fallback={<PageLoadingFallback />}><DiscountCardPage /></Suspense>}</Route>
      
      {/* Public RSVP confirmation page - no auth required */}
      <Route path="/rsvp/:token">{() => <Suspense fallback={<PageLoadingFallback />}><RsvpPage /></Suspense>}</Route>
      <Route path="/job-offer/:token">{() => <Suspense fallback={<PageLoadingFallback />}><JobOfferPublicPage /></Suspense>}</Route>
      <Route path="/onboarding/:token">{() => <Suspense fallback={<PageLoadingFallback />}><OnboardingPublicPage /></Suspense>}</Route>
      <Route path="/warning/:token">{() => <Suspense fallback={<PageLoadingFallback />}><WarningPublicPage /></Suspense>}</Route>
      <Route path="/apply/v/:slug">{() => <Suspense fallback={<PageLoadingFallback />}><VacancyPublicPage /></Suspense>}</Route>
      <Route path="/opening/:slug">{() => <Suspense fallback={<PageLoadingFallback />}><OpeningPublicPage /></Suspense>}</Route>
      <Route path="/apply/:token">{() => <Suspense fallback={<PageLoadingFallback />}><EmploymentApplicationPublicPage /></Suspense>}</Route>

      {/* Public animated greeting page (Phase 5) - no auth required */}
      <Route path="/g/:slug">{() => <Suspense fallback={<PageLoadingFallback />}><PublicGreetingPage /></Suspense>}</Route>
      <Route path="/hr/job-offers">{() => <ModulePage component={JobOffersPage} module="hr_job_offers" />}</Route>
      <Route path="/hr/onboarding">{() => <ModulePage component={OnboardingPage} module="hr_onboarding" />}</Route>
      <Route path="/hr/applications">{() => <ModulePage component={EmploymentApplicationsPage} module="hr_employment_applications" />}</Route>
      
      {/* HR - الموارد البشرية */}
      <Route path="/hr-hub">{() => <ModulePage component={HRHubPage} module="hr_management" />}</Route>
      <Route path="/hr/employee-documents">{() => <ModulePage component={HREmployeeDocumentsPage} module="hr_documents" />}</Route>
      <Route path="/hr/leaves">{() => <ModulePage component={HRLeavesPage} module="hr_leaves" />}</Route>
      <Route path="/hr/warnings">{() => <ModulePage component={HRWarningsPage} module="hr_warnings" />}</Route>
      <Route path="/hr/advances">{() => <ModulePage component={HRAdvancesPage} module="hr_advances" />}</Route>
      <Route path="/hr/eos">{() => <ModulePage component={HREosPage} module="hr_eos" />}</Route>
      <Route path="/branch-employees">{() => <ModulePage component={BranchEmployeesPage} module="branch_employees" />}</Route>
      <Route path="/terminated-employees">{() => <ModulePage component={TerminatedEmployeesPage} module="branch_employees" />}</Route>
      <Route path="/organizational-structure">{() => <ModulePage component={OrganizationalStructurePage} module="organizational_structure" />}</Route>
      <Route path="/attendance-dashboard">{() => <ModulePage component={AttendanceDashboardPage} module="shifts" />}</Route>
      <Route path="/shift-management">{() => <ModulePage component={ShiftManagementPage} module="shifts" />}</Route>
      <Route path="/attendance-check">{() => <ModulePage component={AttendanceCheckPage} module="attendance_check" />}</Route>
      <Route path="/timesheet">{() => <ModulePage component={TimesheetPage} module="shifts" />}</Route>
      <Route path="/employee-reports">{() => <ModulePage component={EmployeeReportsDashboardPage} module="employee_reports" />}</Route>
      <Route path="/floor-plan">{() => <ModulePage component={FloorPlanPage} module="floor_plan" />}</Route>
      
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
      <Route path="/branch-shifts">{() => <ModulePage component={BranchShiftsPage} module="branch_closure" />}</Route>
      <Route path="/shift-reports">{() => <ModulePage component={ShiftReportsPage} module="branch_closure" />}</Route>
      <Route path="/products">{() => <ModulePage component={ProductsPage} module="products" />}</Route>
      <Route path="/quality-control">{() => <ModulePage component={QualityControlPage} module="quality_control" />}</Route>
      <Route path="/display-bar-waste">{() => <ModulePage component={DisplayBarWastePage} module="waste_tracking" />}</Route>
      <Route path="/operations-employees">{() => <AdminPage component={OperationsEmployeesPage} module="operations" />}</Route>
      <Route path="/operations-reports">{() => <ModulePage component={OperationsReportsDashboardPage} module="operations" />}</Route>
      
      {/* Sales - المبيعات والكاشير */}
      <Route path="/cashier-journals">{() => <ModulePage component={CashierJournalsPage} module="cashier_journal" />}</Route>
      <Route path="/cashier-journals/new">{() => <ModulePage component={CashierJournalFormPage} module="cashier_journal" />}</Route>
      <Route path="/cashier-journals/:id">{() => <ModulePage component={CashierJournalFormPage} module="cashier_journal" />}</Route>
      <Route path="/branch-daily-closures/:id">{() => <ModulePage component={BranchDailyClosureDetailPage} module="daily_closures" />}</Route>
      <Route path="/branch-daily-closures">{() => <ModulePage component={BranchDailyClosuresPage} module="daily_closures" />}</Route>
      <Route path="/branch-daily-closing">{() => <ModulePage component={BranchDailyClosingPage} module="daily_closures" />}</Route>
      <Route path="/sales-analytics">{() => <ModulePage component={SalesAnalyticsPage} module="sales_analytics" />}</Route>
      <Route path="/event-pos-settings">{() => <ModulePage component={EventPosSettingsPage} module="event_pos" />}</Route>
      <Route path="/event-pos">{() => <ModulePage component={EventPosPage} module="event_pos" />}</Route>
      <Route path="/targets-planning">{() => <ModulePage component={TargetsPlanningPage} module="targets_planning" />}</Route>
      <Route path="/targets-dashboard">{() => <ModulePage component={TargetsDashboardPage} module="targets" />}</Route>
      <Route path="/cashier-shift-performance">{() => <ProtectedPage component={CashierShiftPerformancePage} />}</Route>
      <Route path="/incentives-management">{() => <ModulePage component={IncentivesManagementPage} module="incentives" />}</Route>
      <Route path="/pnl-dashboard">{() => <ModulePage component={PnLDashboardPage} module="pnl_dashboard" />}</Route>
      <Route path="/pnl-rent-history">{() => <ModulePage component={PnLRentHistoryPage} module="pnl_dashboard" />}</Route>
      <Route path="/pnl-recurring-expenses">{() => <ModulePage component={PnLRecurringExpensesPage} module="pnl_dashboard" />}</Route>
      
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
      <Route path="/contracts/templates">{() => <ModulePage component={ContractTemplatesPage} module="contracts" />}</Route>
      <Route path="/contracts/:id">{() => <ModulePage component={ContractDetailPage} module="contracts" />}</Route>
      <Route path="/payment-requests">{() => <ModulePage component={PaymentRequestsPage} module="payment_requests" />}</Route>
      <Route path="/budget-planning">{() => <ModulePage component={BudgetPlanningPage} module="budget_planning" />}</Route>
      <Route path="/construction-reports">{() => <ModulePage component={ConstructionReportsPage} module="reports" />}</Route>
      <Route path="/contractor-statements">{() => <ModulePage component={ContractorStatementsPage} module="contractor_statements" />}</Route>
      <Route path="/contractor-oversight">{() => <ModulePage component={ContractorOversightPage} module="contracts" />}</Route>
      <Route path="/contractors/:id/statement">{() => <ModulePage component={ContractorStatementDetailPage} module="contractor_statements" />}</Route>
      <Route path="/construction/daily-logs">{() => <ModulePage component={DailyLogsListPage} module="project_daily_logs" />}</Route>
      <Route path="/construction/daily-logs/new">{() => <ModulePage component={DailyWorkLogPage} module="project_daily_logs" />}</Route>
      <Route path="/construction/daily-logs/:id/print">{() => <ModulePage component={DailyLogPrintPage} module="project_daily_logs" />}</Route>
      <Route path="/construction/daily-logs/:id/edit">{() => <ModulePage component={DailyWorkLogPage} module="project_daily_logs" />}</Route>
      <Route path="/construction/daily-logs/:id">{() => <ModulePage component={DailyWorkLogPage} module="project_daily_logs" />}</Route>
      <Route path="/field-hub">{() => <ModulePage component={FieldHubPage} module="construction_projects" />}</Route>
      <Route path="/field-checklists/templates">{() => <ModulePage component={FieldChecklistTemplatesPage} module="construction_projects" />}</Route>
      <Route path="/field-checklists/:id">{() => <ModulePage component={FieldChecklistDetailPage} module="construction_projects" />}</Route>
      
      {/* Marketing - التسويق */}
      <Route path="/marketing">{() => <ModulePage component={MarketingDashboardPage} module="marketing" />}</Route>
      <Route path="/marketing-campaigns">{() => <ModulePage component={MarketingCampaignsPage} module="marketing_campaigns" />}</Route>
      <Route path="/marketing-social">{() => <ModulePage component={MarketingSocialPage} module="marketing" />}</Route>
      <Route path="/marketing-opening-campaigns">{() => <ModulePage component={MarketingOpeningCampaignsPage} module="marketing" />}</Route>
      <Route path="/marketing-media-team">{() => <ModulePage component={MarketingMediaTeamPage} module="marketing" />}</Route>
      <Route path="/social-responsibility">{() => <ModulePage component={SocialResponsibilityPage} module="social_responsibility" />}</Route>
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
      <Route path="/biometric-settings">{() => <AdminPage component={BiometricSettingsPage} module="settings" />}</Route>
      <Route path="/notifications-management">{() => <AdminPage component={NotificationsManagementPage} module="settings" />}</Route>
      <Route path="/notifications-center">{() => <AdminPage component={NotificationsCenterPage} module="settings" />}</Route>
      
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
      <Route path="/executive">{() => <ModulePage component={ExecutiveDashboardPage} module="executive_dashboard" />}</Route>
      <Route path="/executive/meetings">{() => <ModulePage component={ExecutiveMeetingsPage} module="executive_meetings" />}</Route>
      <Route path="/executive/tasks">{() => <ModulePage component={ExecutiveTasksPage} module="executive_tasks" />}</Route>
      <Route path="/executive/correspondence">{() => <ModulePage component={ExecutiveCorrespondencePage} module="executive_correspondence" />}</Route>
      <Route path="/visitors">{() => <ModulePage component={VisitorsPage} module="executive_visitors" />}</Route>
      <Route path="/travel-requests">{() => <ModulePage component={TravelRequestsPage} module="executive_travel" />}</Route>
      <Route path="/executive/reports">{() => <ModulePage component={ExecutiveReportsPage} module="executive_reports" />}</Route>
      <Route path="/executive/calendar">{() => <ModulePage component={ExecutiveCalendarPage} module="executive_calendar" />}</Route>
      <Route path="/executive/templates">{() => <ModulePage component={CompanyTemplatesPage} module="executive_dashboard" />}</Route>
      <Route path="/executive/org-structure">{() => <ModulePage component={ExecutiveOrgStructurePage} module="executive_dashboard" />}</Route>
      
      {/* Documents - إدارة الوثائق */}
      <Route path="/documents">{() => <ModulePage component={DocumentsPage} module="documents" />}</Route>
      
      {/* Governance - الحوكمة المؤسسية */}
      <Route path="/governance">{() => <ModulePage component={GovernancePage} module="governance" />}</Route>
      <Route path="/governance/board">{() => <ModulePage component={BoardMembersPage} module="governance_board" />}</Route>
      <Route path="/governance/shareholders">{() => <ModulePage component={ShareholdersPage} module="governance_shareholders" />}</Route>
      <Route path="/governance/meetings">{() => <ModulePage component={GovernanceMeetingsPage} module="governance_meetings" />}</Route>
      <Route path="/governance/assembly-minutes">{() => <ModulePage component={AssemblyMinutesPage} module="governance_meetings" />}</Route>
      <Route path="/governance/resolutions">{() => <ModulePage component={ResolutionsPage} module="governance_resolutions" />}</Route>
      <Route path="/governance/compliance">{() => <ModulePage component={CompliancePage} module="governance_compliance" />}</Route>
      <Route path="/governance/transfers">{() => <ModulePage component={ShareTransfersPage} module="governance_transfers" />}</Route>
      <Route path="/governance/disclosures">{() => <ModulePage component={DisclosuresPage} module="governance_disclosures" />}</Route>
      <Route path="/governance/dividends">{() => <ModulePage component={DividendsPage} module="governance_dividends" />}</Route>
      <Route path="/governance/capital">{() => <ModulePage component={CapitalPage} module="governance_capital" />}</Route>
      <Route path="/governance/voting">{() => <ModulePage component={VotingPage} module="governance_voting" />}</Route>
      <Route path="/governance/general-assembly">{() => <ModulePage component={GeneralAssemblyPage} module="governance_meetings" />}</Route>
      
      {/* Security - الأمان */}
      <Route path="/security">{() => <ModulePage component={SecurityPage} module="rbac_management" />}</Route>
      
      <Route component={NotFound} />
    </Switch>
  );
});

function App() {
  useEffect(() => {
    startAggressivePreload();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="butter-theme" disableTransitionOnChange>
          <AuthGate>
            <ProductionProvider>
              <TooltipProvider>
                <Toaster />
                <InactivityLogout />
                <Router />
                <PWAInstallPrompt />
                <OfflineIndicator />
                <SlowConnectionBanner />
                <DataErrorBanner />
              </TooltipProvider>
            </ProductionProvider>
          </AuthGate>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
