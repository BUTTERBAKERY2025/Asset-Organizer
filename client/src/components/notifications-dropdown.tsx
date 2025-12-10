import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, AlertTriangle, Package, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { InventoryItem } from "@shared/schema";

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);

  const { data: lowQuantityItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/low-quantity"],
    queryFn: async () => {
      const res = await fetch("/api/inventory/low-quantity");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: maintenanceItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/maintenance-needed"],
    queryFn: async () => {
      const res = await fetch("/api/inventory/maintenance-needed");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 60000,
  });

  const totalAlerts = lowQuantityItems.length + maintenanceItems.length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
          <Bell className="w-5 h-5" />
          {totalAlerts > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {totalAlerts > 9 ? "9+" : totalAlerts}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="p-3 border-b">
          <h3 className="font-semibold">التنبيهات</h3>
          <p className="text-xs text-muted-foreground">{totalAlerts} تنبيه</p>
        </div>
        <ScrollArea className="max-h-80">
          {totalAlerts === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              لا توجد تنبيهات
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {lowQuantityItems.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-orange-600 px-2">
                    <Package className="w-4 h-4" />
                    كمية منخفضة ({lowQuantityItems.length})
                  </div>
                  {lowQuantityItems.slice(0, 5).map((item) => (
                    <div 
                      key={item.id} 
                      className="px-3 py-2 rounded-md bg-orange-50 text-sm"
                      data-testid={`alert-low-quantity-${item.id}`}
                    >
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        الكمية: {item.quantity} {item.unit}
                      </div>
                    </div>
                  ))}
                  {lowQuantityItems.length > 5 && (
                    <div className="text-xs text-muted-foreground text-center py-1">
                      + {lowQuantityItems.length - 5} أخرى
                    </div>
                  )}
                </div>
              )}
              {maintenanceItems.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-red-600 px-2">
                    <Wrench className="w-4 h-4" />
                    تحتاج صيانة ({maintenanceItems.length})
                  </div>
                  {maintenanceItems.slice(0, 5).map((item) => (
                    <div 
                      key={item.id} 
                      className="px-3 py-2 rounded-md bg-red-50 text-sm"
                      data-testid={`alert-maintenance-${item.id}`}
                    >
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        الحالة: {item.status === 'maintenance' ? 'صيانة' : 'تالف'}
                      </div>
                    </div>
                  ))}
                  {maintenanceItems.length > 5 && (
                    <div className="text-xs text-muted-foreground text-center py-1">
                      + {maintenanceItems.length - 5} أخرى
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
