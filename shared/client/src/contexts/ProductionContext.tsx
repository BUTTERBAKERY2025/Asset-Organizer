import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

interface CommandCenterData {
  production: {
    totalBatches: number;
    totalQuantity: number;
    targetQuantity: number;
    completionRate: number;
    gap: number;
    byDestination: Record<string, number>;
    activeOrders: number;
    completedOrders: number;
  };
  inventory: {
    totalItems: number;
    totalValue: number;
    lowStockCount: number;
    maintenanceNeeded: number;
    goodCondition: number;
    damaged: number;
  };
  cashier: {
    totalSales: number;
    totalJournals: number;
    shortages: number;
    surpluses: number;
    shortageAmount: number;
    surplusAmount: number;
    averageTicket: number;
  };
  waste: {
    totalReports: number;
    totalWastedQuantity: number;
    totalWastedValue: number;
    wasteByReason: Record<string, number>;
  };
  comparison: {
    productionVsYesterday: number;
    salesVsYesterday: number;
  };
  branchId: string;
  date: string;
  timestamp: string;
}

interface ProductionContextType {
  selectedBranch: string;
  setSelectedBranch: (branch: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedShift: string;
  setSelectedShift: (shift: string) => void;
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  lastUpdated: Date | null;
  commandCenterData: CommandCenterData | null;
  isLoading: boolean;
  refetch: () => void;
}

const ProductionContext = createContext<ProductionContextType | undefined>(undefined);

export function ProductionProvider({ children }: { children: ReactNode }) {
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedShift, setSelectedShift] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) setSelectedShift("morning");
    else if (hour >= 14 && hour < 22) setSelectedShift("evening");
    else setSelectedShift("night");
  }, []);

  const { data: commandCenterData, isLoading, refetch } = useQuery<CommandCenterData>({
    queryKey: ["/api/command-center", selectedBranch, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams({ branchId: selectedBranch, date: selectedDate });
      const res = await fetch(`/api/command-center?${params}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to fetch command center data");
      }
      setLastUpdated(new Date());
      return res.json();
    },
    refetchInterval: autoRefresh ? 60000 : false,
    staleTime: 30000,
  });

  const handleRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <ProductionContext.Provider
      value={{
        selectedBranch,
        setSelectedBranch,
        selectedDate,
        setSelectedDate,
        selectedShift,
        setSelectedShift,
        autoRefresh,
        setAutoRefresh,
        lastUpdated,
        commandCenterData: commandCenterData || null,
        isLoading,
        refetch: handleRefetch,
      }}
    >
      {children}
    </ProductionContext.Provider>
  );
}

export function useProductionContext() {
  const context = useContext(ProductionContext);
  if (context === undefined) {
    throw new Error("useProductionContext must be used within a ProductionProvider");
  }
  return context;
}
