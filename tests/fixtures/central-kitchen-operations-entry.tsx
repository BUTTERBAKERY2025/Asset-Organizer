import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { OperationsBoard } from "@/components/central-kitchen/operations-board";
import { queryClient } from "@/lib/queryClient";
import "@/index.css";

async function mount() {
  const init = await (await fetch("/api/auth/init", { credentials: "include" })).json();
  queryClient.setQueryData(["/api/auth/me"], init.user);
  queryClient.setQueryData(["/api/my-permissions"], init.permissions);
  createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><TooltipProvider>
    <main className="mx-auto max-w-[1580px] p-3 sm:p-7"><OperationsBoard kitchens={init.kitchens} kitchenId="fixture-kitchen" onKitchenChange={() => {}} /></main>
    <Toaster />
  </TooltipProvider></QueryClientProvider>);
}
void mount();