import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { format } from "date-fns";

interface ProductionContextType {
  selectedBranch: string;
  setSelectedBranch: (branch: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedShift: string;
  setSelectedShift: (shift: string) => void;
}

const ProductionContext = createContext<ProductionContextType | undefined>(undefined);

export function ProductionProvider({ children }: { children: ReactNode }) {
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedShift, setSelectedShift] = useState<string>("");

  // Auto-detect current shift
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) setSelectedShift("morning");
    else if (hour >= 14 && hour < 22) setSelectedShift("evening");
    else setSelectedShift("night");
  }, []);

  return (
    <ProductionContext.Provider
      value={{
        selectedBranch,
        setSelectedBranch,
        selectedDate,
        setSelectedDate,
        selectedShift,
        setSelectedShift,
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
