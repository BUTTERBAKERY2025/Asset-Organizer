import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import ProductionDashboardPage from "@/pages/production-dashboard";
import { ProductionProvider } from "@/contexts/ProductionContext";
import { queryClient } from "@/lib/queryClient";
import "@/lib/i18n";
import "@/index.css";

async function mount() {
  const response = await fetch("/api/auth/init", { credentials: "include" });
  if (!response.ok) throw new Error(`Fixture auth init: ${response.status}`);
  const init = await response.json();
  queryClient.setQueryData(["/api/auth/me"], init.user);
  queryClient.setQueryData(["/api/my-permissions"], init.permissions);
  queryClient.setQueryData(["/api/branches"], init.branches);
  createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={queryClient}><TooltipProvider><ProductionProvider>
      <ProductionDashboardPage />
    </ProductionProvider>
      <Toaster />
    </TooltipProvider></QueryClientProvider>,
  );
}
void mount();