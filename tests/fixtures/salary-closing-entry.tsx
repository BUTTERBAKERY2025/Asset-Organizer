// Isolated fixture entry: mounts the real payroll page with test-only hook
// aliases and a strictly synthetic API server. It is never part of the app.
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import SalaryClosingPage from "@/pages/salary-closing";
import { queryClient } from "@/lib/queryClient";
import "@/lib/i18n";
import "@/index.css";

queryClient.setDefaultOptions({ queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false } });

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SalaryClosingPage />
      <Toaster />
    </TooltipProvider>
  </QueryClientProvider>,
);