import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, AlertTriangle, Package, Wrench, Calendar, CheckSquare, UserCheck, Plane, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { InventoryItem } from "@shared/schema";

interface SystemNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  priority: string;
  isRead: boolean;
  relatedType?: string;
  relatedId?: number;
  createdAt: string;
}

const priorityIcons: Record<string, React.ReactNode> = {
  urgent: <AlertTriangle className="w-4 h-4 text-red-500" />,
  high: <AlertTriangle className="w-4 h-4 text-orange-500" />,
  normal: <Bell className="w-4 h-4 text-blue-500" />,
  low: <Bell className="w-4 h-4 text-gray-500" />,
};

const typeIcons: Record<string, React.ReactNode> = {
  meeting: <Calendar className="w-4 h-4 text-blue-500" />,
  task: <CheckSquare className="w-4 h-4 text-amber-500" />,
  visitor: <UserCheck className="w-4 h-4 text-green-500" />,
  travel: <Plane className="w-4 h-4 text-cyan-500" />,
  system: <Bell className="w-4 h-4 text-purple-500" />,
};

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const queryClient = useQueryClient();

  const { data: lowQuantityItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/low-quantity"],
    queryFn: async () => {
      const res = await fetch("/api/inventory/low-quantity");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: maintenanceItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/maintenance-needed"],
    queryFn: async () => {
      const res = await fetch("/api/inventory/maintenance-needed");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: systemNotifications = [] } = useQuery<SystemNotification[]>({
    queryKey: ["/api/system-notifications"],
    queryFn: async () => {
      const res = await fetch("/api/system-notifications");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("POST", `/api/system-notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/system-notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-notifications"] });
    },
  });

  const unreadSystemNotifications = systemNotifications.filter(n => !n.isRead);
  const inventoryAlerts = lowQuantityItems.length + maintenanceItems.length;
  const totalAlerts = inventoryAlerts + unreadSystemNotifications.length;

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
      <DropdownMenuContent align="end" className="w-96">
        <div className="p-3 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold">التنبيهات</h3>
            <p className="text-xs text-muted-foreground">{totalAlerts} تنبيه</p>
          </div>
          {unreadSystemNotifications.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => markAllAsReadMutation.mutate()}
              className="text-xs"
            >
              <Check className="w-3 h-3 ml-1" />
              قراءة الكل
            </Button>
          )}
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-9">
            <TabsTrigger value="all" className="text-xs">
              الكل ({totalAlerts})
            </TabsTrigger>
            <TabsTrigger value="system" className="text-xs">
              النظام ({unreadSystemNotifications.length})
            </TabsTrigger>
            <TabsTrigger value="inventory" className="text-xs">
              المخزون ({inventoryAlerts})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="max-h-80">
            <TabsContent value="all" className="m-0 p-2">
              {totalAlerts === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  لا توجد تنبيهات
                </div>
              ) : (
                <div className="space-y-2">
                  {unreadSystemNotifications.slice(0, 5).map((notification) => (
                    <div 
                      key={notification.id} 
                      className="px-3 py-2 rounded-md bg-blue-50 text-sm flex items-start justify-between gap-2"
                      data-testid={`notification-${notification.id}`}
                    >
                      <div className="flex items-start gap-2 flex-1">
                        {typeIcons[notification.type] || typeIcons.system}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{notification.title}</div>
                          <div className="text-xs text-muted-foreground truncate">{notification.message}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {format(new Date(notification.createdAt), 'HH:mm - d MMM', { locale: ar })}
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 shrink-0"
                        onClick={() => markAsReadMutation.mutate(notification.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  {lowQuantityItems.slice(0, 3).map((item) => (
                    <div 
                      key={item.id} 
                      className="px-3 py-2 rounded-md bg-orange-50 text-sm"
                      data-testid={`alert-low-quantity-${item.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-orange-500" />
                        <div className="font-medium">{item.name}</div>
                      </div>
                      <div className="text-xs text-muted-foreground mr-6">
                        الكمية: {item.quantity} {item.unit}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="system" className="m-0 p-2">
              {systemNotifications.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  لا توجد إشعارات
                </div>
              ) : (
                <div className="space-y-2">
                  {systemNotifications.slice(0, 10).map((notification) => (
                    <div 
                      key={notification.id} 
                      className={`px-3 py-2 rounded-md text-sm flex items-start justify-between gap-2 ${
                        notification.isRead ? 'bg-gray-50' : 'bg-blue-50'
                      }`}
                      data-testid={`notification-${notification.id}`}
                    >
                      <div className="flex items-start gap-2 flex-1">
                        {typeIcons[notification.type] || typeIcons.system}
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium truncate ${notification.isRead ? 'text-gray-600' : ''}`}>
                            {notification.title}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{notification.message}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {format(new Date(notification.createdAt), 'HH:mm - d MMM', { locale: ar })}
                          </div>
                        </div>
                      </div>
                      {!notification.isRead && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 shrink-0"
                          onClick={() => markAsReadMutation.mutate(notification.id)}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="inventory" className="m-0 p-2">
              {inventoryAlerts === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  لا توجد تنبيهات مخزون
                </div>
              ) : (
                <div className="space-y-2">
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
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
