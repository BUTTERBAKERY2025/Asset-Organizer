import { createElement, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/queryClient";
import UsersPage from "@/pages/users";
import TransferRequestsPage from "@/pages/transfer-requests";
import WarehouseDashboardPage from "@/pages/warehouse-dashboard";
import DriverDeliveriesPage, { DeliveryWorkspace } from "@/pages/driver-deliveries";
import CentralKitchenOrdersPage from "@/pages/central-kitchen-orders";
import ReverseLogisticsPage from "@/pages/reverse-logistics";
import BranchOperationsPage from "@/pages/branch-operations";
import ProductionDashboardPage from "@/pages/production-dashboard";
import "@/lib/i18n";
import "@/index.css";

async function mount() {
  const response = await fetch("/api/auth/init");
  if (!response.ok) throw new Error(`Synthetic fixture initialization failed: ${response.status}`);
  const { user, permissions, branches } = await response.json();
  queryClient.setQueryData(["/api/auth/me"], user);
  queryClient.setQueryData(["/api/my-permissions"], permissions);
  queryClient.setQueryData(["/api/branches"], branches);
  const page = location.pathname;
  const Page = page === "/users" ? UsersPage
    : page === "/transfer-requests" ? TransferRequestsPage
    : page === "/warehouse" ? WarehouseDashboardPage
    : page === "/driver-deliveries" ? DriverDeliveriesPage
    : page === "/central-kitchen-orders" ? CentralKitchenOrdersPage
    : page === "/reverse-logistics" ? ReverseLogisticsPage
    : page === "/branch-operations" ? BranchOperationsPage
    : page === "/production-dashboard" ? ProductionDashboardPage
    : null;
  if (!Page) throw new Error(`No real fixture page for ${page}`);
  createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Page />
        {page === "/transfer-requests" && user.role === "branch_manager" && new URLSearchParams(location.search).get("embedded") === "1"
          && <section dir="rtl" className="mx-auto max-w-5xl p-6">
            <h2 className="mb-4 text-lg font-bold">استلام المهمة ضمن صفحة مصدر الفرع (بيانات اصطناعية)</h2>
            {createElement(DeliveryWorkspace as ComponentType<any>, {
              embedded: true, sourceType: "material_transfer",
               sourceId: new URLSearchParams(location.search).get("carrier") === "1" ? 4103 : 4102,
               deliveryId: new URLSearchParams(location.search).get("carrier") === "1" ? 9301 : 9201,
            })}
          </section>}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}
void mount();