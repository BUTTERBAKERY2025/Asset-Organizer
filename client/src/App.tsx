import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
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
      <Route path="/reports" component={ReportsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
