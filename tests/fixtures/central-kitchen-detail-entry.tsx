// Isolated browser entry: mounts the real kitchen page without App's
// authenticated Suspense tree. The fixture server supplies ONLY synthetic APIs.
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import CentralKitchenOrdersPage from "@/pages/central-kitchen-orders";
import { queryClient } from "@/lib/queryClient";
import "@/lib/i18n";
import "@/index.css";

async function mount() {
  const response = await fetch("/api/auth/init", { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`Synthetic auth fixture unavailable: ${response.status}`);
  const init = await response.json();
  if (!init.user || !Array.isArray(init.branches) || !Array.isArray(init.permissions)) {
    throw new Error("Invalid synthetic auth fixture");
  }
  queryClient.setQueryData(["/api/auth/me"], init.user);
  queryClient.setQueryData(["/api/branches"], init.branches);
  queryClient.setQueryData(["/api/my-permissions"], init.permissions);
  createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light">
        <TooltipProvider>
          <CentralKitchenOrdersPage />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

void mount().catch(error => {
  console.error(error);
  document.getElementById("root")!.textContent = `Synthetic kitchen fixture failed: ${error instanceof Error ? error.message : String(error)}`;
});