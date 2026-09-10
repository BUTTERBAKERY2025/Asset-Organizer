import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Database } from "lucide-react";
import type { CentralKitchenAvailabilityContract } from "@shared/central-kitchen-live";

export function AvailabilitySnapshot({ kitchenId, productId, warehouseItemId, requested }: { kitchenId: string; productId?: number; warehouseItemId?: number; requested: string }) {
  const enabled = Boolean(kitchenId && (productId || warehouseItemId));
  const query = useQuery<CentralKitchenAvailabilityContract>({
    queryKey: ["/api/central-kitchen-orders/availability", kitchenId, productId, warehouseItemId],
    queryFn: async () => {
      const params = new URLSearchParams({ kitchenId });
      if (productId) params.set("productId", String(productId));
      if (warehouseItemId) params.set("warehouseItemId", String(warehouseItemId));
      const response = await fetch(`/api/central-kitchen-orders/availability?${params}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("غير متاح");
      return response.json();
    },
    enabled,
    staleTime: 10_000,
  });
  if (!enabled) return <p className="mt-2 text-[11px] text-muted-foreground">اختر المطبخ والصنف لإظهار رصيد فرع المطبخ.</p>;
  if (query.isLoading) return <div className="mt-2 h-4 w-40 animate-pulse rounded bg-muted" />;
  if (query.isError) return <p className="mt-2 flex items-center gap-1 text-[11px] text-rose-700"><AlertTriangle className="h-3.5 w-3.5" />تعذر التحقق من رصيد المطبخ.</p>;
  const requestedNumber = Number(requested) || 0;
  const free = Math.max(0, (query.data?.availableQuantity || 0) - (query.data?.reservedQuantity || 0));
  return <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><Database className="h-3.5 w-3.5" />متاح {query.data?.availableQuantity || 0} · محجوز {query.data?.reservedQuantity || 0} · المتبقي الحر {free}{requestedNumber > free ? " — الكمية المطلوبة تتجاوز الحر المتاح" : ""}</p>;
}