import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Bell, AlertTriangle, Package, Wrench, Calendar, CheckSquare, UserCheck, 
  Plane, Check, Warehouse, Factory, Receipt, Settings, ExternalLink,
  ArrowLeftRight, ClipboardList, Sparkles, Megaphone, PartyPopper
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import type { InventoryItem } from "@shared/schema";

// Shape returned by /api/active-notifications (raw system_notifications rows,
// already filtered per-user by branch + role on the server).
interface ActiveNotification {
  id: number;
  title: string;
  content: string;
  messageType: string;
  priority: number;
  emoji?: string | null;
  imageUrl?: string | null;
  buttonText?: string | null;
  buttonAction?: string | null;
  createdAt: string;
}

interface NotificationRead {
  notificationId: number;
  dismissed: boolean;
}

// Map the numeric priority (1..) onto a visual band.
function priorityBand(priority: number): "urgent" | "high" | "normal" | "low" {
  if (priority >= 4) return "urgent";
  if (priority === 3) return "high";
  if (priority === 2) return "normal";
  return "low";
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-100 border-red-300 text-red-800",
  high: "bg-orange-50 border-orange-200 text-orange-800",
  normal: "bg-blue-50 border-blue-200 text-blue-800",
  low: "bg-gray-50 border-gray-200 text-gray-600",
};

const priorityBadges: Record<string, { color: string; label: string }> = {
  urgent: { color: "bg-red-500", label: "عاجل" },
  high: { color: "bg-orange-500", label: "مهم" },
  normal: { color: "bg-blue-500", label: "عادي" },
  low: { color: "bg-gray-400", label: "منخفض" },
};

const typeIcons: Record<string, React.ReactNode> = {
  announcement: <Megaphone className="w-4 h-4 text-blue-500" />,
  alert: <AlertTriangle className="w-4 h-4 text-red-500" />,
  warning: <AlertTriangle className="w-4 h-4 text-orange-500" />,
  celebration: <PartyPopper className="w-4 h-4 text-pink-500" />,
  meeting: <Calendar className="w-4 h-4 text-blue-500" />,
  task: <CheckSquare className="w-4 h-4 text-amber-500" />,
  visitor: <UserCheck className="w-4 h-4 text-green-500" />,
  travel: <Plane className="w-4 h-4 text-cyan-500" />,
  system: <Settings className="w-4 h-4 text-purple-500" />,
  material_request: <ClipboardList className="w-4 h-4 text-emerald-500" />,
  transfer: <ArrowLeftRight className="w-4 h-4 text-indigo-500" />,
  production: <Factory className="w-4 h-4 text-amber-600" />,
  maintenance: <Wrench className="w-4 h-4 text-red-500" />,
  inventory: <Warehouse className="w-4 h-4 text-teal-500" />,
  cashier: <Receipt className="w-4 h-4 text-green-600" />,
};

// A failure here means the user lacks access to that data (e.g. inventory
// permission) or a transient error — degrade to an empty list instead of
// throwing, so the bell still works for every account.
async function safeFetchList<T>(url: string): Promise<T[]> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [selected, setSelected] = useState<ActiveNotification | null>(null);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: lowQuantityItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/low-quantity"],
    queryFn: () => safeFetchList<InventoryItem>("/api/inventory/low-quantity"),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    meta: { silentError: true },
  });

  const { data: maintenanceItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/maintenance-needed"],
    queryFn: () => safeFetchList<InventoryItem>("/api/inventory/maintenance-needed"),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    meta: { silentError: true },
  });

  // Per-user notifications: server already filters by the viewer's branch + role.
  const { data: notifications = [] } = useQuery<ActiveNotification[]>({
    queryKey: ["/api/active-notifications"],
    queryFn: () => safeFetchList<ActiveNotification>("/api/active-notifications"),
    staleTime: 30 * 1000,
    refetchInterval: () => (typeof document !== "undefined" && document.hidden ? false : 60 * 1000),
    meta: { silentError: true },
  });

  // Per-user read state, used only to compute the unread badge and styling.
  const { data: reads = [] } = useQuery<NotificationRead[]>({
    queryKey: ["/api/system-notifications/my-reads"],
    queryFn: () => safeFetchList<NotificationRead>("/api/system-notifications/my-reads"),
    staleTime: 30 * 1000,
    refetchInterval: () => (typeof document !== "undefined" && document.hidden ? false : 60 * 1000),
    meta: { silentError: true },
  });

  const readIds = new Set(reads.map((r) => r.notificationId));

  // Optimistically add the id to the read set so the badge/highlight update
  // instantly; reconcile with the server on settle.
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("POST", `/api/system-notifications/${id}/read`);
    },
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: ["/api/system-notifications/my-reads"] });
      const previous = queryClient.getQueryData<NotificationRead[]>(["/api/system-notifications/my-reads"]);
      queryClient.setQueryData<NotificationRead[]>(
        ["/api/system-notifications/my-reads"],
        [...(previous || []).filter((r) => r.notificationId !== id), { notificationId: id, dismissed: false }]
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/system-notifications/my-reads"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-notifications/my-reads"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map((id) => apiRequest("POST", `/api/system-notifications/${id}/read`)));
    },
    onMutate: async (ids: number[]) => {
      await queryClient.cancelQueries({ queryKey: ["/api/system-notifications/my-reads"] });
      const previous = queryClient.getQueryData<NotificationRead[]>(["/api/system-notifications/my-reads"]);
      const merged = [...(previous || [])];
      for (const id of ids) {
        if (!merged.some((r) => r.notificationId === id)) merged.push({ notificationId: id, dismissed: false });
      }
      queryClient.setQueryData<NotificationRead[]>(["/api/system-notifications/my-reads"], merged);
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/system-notifications/my-reads"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-notifications/my-reads"] });
    },
  });

  // Clicking always opens the full content in a dialog and marks it read.
  const handleNotificationClick = (notification: ActiveNotification) => {
    if (!readIds.has(notification.id)) {
      markAsReadMutation.mutate(notification.id);
    }
    setSelected(notification);
  };

  const isInternalLink = (action?: string | null): action is string =>
    !!action && action.startsWith("/");

  const handleDialogAction = (notification: ActiveNotification) => {
    const action = notification.buttonAction;
    if (!action) return;
    setSelected(null);
    setOpen(false);
    if (isInternalLink(action)) {
      setLocation(action);
    } else if (/^https?:\/\//.test(action)) {
      window.open(action, "_blank", "noopener,noreferrer");
    }
  };

  const unreadNotifications = notifications.filter((n) => !readIds.has(n.id));
  const inventoryAlerts = lowQuantityItems.length + maintenanceItems.length;
  const unreadCount = unreadNotifications.length;
  const totalAlerts = unreadCount + inventoryAlerts;

  const getRelativeTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { locale: ar, addSuffix: true });
    } catch {
      return "";
    }
  };

  return (
    <>
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative h-9 w-9 rounded-full hover:bg-primary/10 transition-colors" 
          data-testid="button-notifications"
        >
          <div className="relative">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px] font-bold shadow-lg"
              data-testid="badge-notification-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[420px] p-0 shadow-xl border-0 rounded-xl overflow-hidden">
        <div className="p-4 bg-gradient-to-l from-primary/10 via-primary/5 to-transparent border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/15 rounded-lg">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">التنبيهات</h3>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0
                  ? `${unreadCount} تنبيه جديد`
                  : inventoryAlerts > 0
                    ? `${inventoryAlerts} تنبيه مخزون`
                    : "لا توجد تنبيهات"}
              </p>
            </div>
          </div>
          {unreadNotifications.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => markAllAsReadMutation.mutate(unreadNotifications.map((n) => n.id))}
              className="text-xs h-8 px-3 rounded-lg hover:bg-primary/10 hover:text-primary border-primary/20"
              data-testid="button-mark-all-read"
            >
              <Check className="w-3 h-3 ml-1" />
              قراءة الكل
            </Button>
          )}
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-10 bg-muted/50 rounded-none border-b">
            <TabsTrigger 
              value="all" 
              className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              الكل ({totalAlerts})
            </TabsTrigger>
            <TabsTrigger 
              value="system" 
              className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              النظام ({unreadCount})
            </TabsTrigger>
            <TabsTrigger 
              value="inventory" 
              className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              المخزون ({inventoryAlerts})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="max-h-[400px]">
            <TabsContent value="all" className="m-0 p-3">
              {totalAlerts === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-muted/50 flex items-center justify-center">
                    <Bell className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-muted-foreground text-sm">لا توجد تنبيهات جديدة</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {unreadNotifications.slice(0, 5).map((notification) => {
                    const band = priorityBand(notification.priority);
                    return (
                      <div 
                        key={notification.id} 
                        className={`px-3 py-3 rounded-xl text-sm flex items-start gap-3 cursor-pointer transition-all duration-200 border hover:shadow-md ${
                          priorityColors[band]
                        }`}
                        data-testid={`notification-${notification.id}`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="p-2 rounded-lg bg-white/60 shrink-0">
                          {notification.emoji ? <span className="text-base leading-none">{notification.emoji}</span> : (typeIcons[notification.messageType] || typeIcons.system)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold truncate">{notification.title}</span>
                            {band !== "normal" && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-white ${priorityBadges[band]?.color}`}>
                                {priorityBadges[band]?.label}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{notification.content}</p>
                          <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                            <span>{getRelativeTime(notification.createdAt)}</span>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    );
                  })}
                  {lowQuantityItems.slice(0, 3).map((item) => (
                    <div 
                      key={item.id} 
                      className="px-3 py-3 rounded-xl bg-gradient-to-l from-orange-50 to-amber-50/50 border border-orange-200 text-sm"
                      data-testid={`alert-low-quantity-${item.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-orange-100">
                          <Package className="w-4 h-4 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-orange-800">{item.name}</div>
                          <div className="text-xs text-orange-600">
                            الكمية المتبقية: {item.quantity} {item.unit}
                          </div>
                        </div>
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="system" className="m-0 p-3">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-muted/50 flex items-center justify-center">
                    <Settings className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-muted-foreground text-sm">لا توجد إشعارات نظام</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.slice(0, 10).map((notification) => {
                    const isRead = readIds.has(notification.id);
                    const band = priorityBand(notification.priority);
                    return (
                      <div 
                        key={notification.id} 
                        className={`px-3 py-3 rounded-xl text-sm flex items-start gap-3 cursor-pointer transition-all duration-200 border ${
                          isRead 
                            ? 'bg-gray-50/50 border-gray-100' 
                            : `${priorityColors[band]}`
                        }`}
                        data-testid={`notification-${notification.id}`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className={`p-2 rounded-lg shrink-0 ${isRead ? 'bg-gray-100' : 'bg-white/60'}`}>
                          {notification.emoji ? <span className="text-base leading-none">{notification.emoji}</span> : (typeIcons[notification.messageType] || typeIcons.system)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-semibold truncate ${isRead ? 'text-gray-500' : ''}`}>
                              {notification.title}
                            </span>
                            {!isRead && band !== "normal" && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-white ${priorityBadges[band]?.color}`}>
                                {priorityBadges[band]?.label}
                              </span>
                            )}
                            {isRead && (
                              <Check className="w-3 h-3 text-green-500" />
                            )}
                          </div>
                          <p className={`text-xs line-clamp-2 ${isRead ? 'text-gray-400' : 'text-muted-foreground'}`}>
                            {notification.content}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                            <span>{getRelativeTime(notification.createdAt)}</span>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="inventory" className="m-0 p-3">
              {inventoryAlerts === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-muted/50 flex items-center justify-center">
                    <Package className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-muted-foreground text-sm">المخزون في حالة جيدة</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lowQuantityItems.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-orange-700 px-1">
                        <div className="p-1.5 rounded-md bg-orange-100">
                          <Package className="w-3.5 h-3.5" />
                        </div>
                        كمية منخفضة ({lowQuantityItems.length})
                      </div>
                      {lowQuantityItems.slice(0, 5).map((item) => (
                        <div 
                          key={item.id} 
                          className="px-3 py-3 rounded-xl bg-gradient-to-l from-orange-50 to-amber-50/50 border border-orange-200 text-sm"
                          data-testid={`alert-low-quantity-${item.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-orange-800">{item.name}</div>
                              <div className="text-xs text-orange-600 mt-0.5">
                                الكمية: {item.quantity} {item.unit}
                              </div>
                            </div>
                            <div className="p-2 rounded-lg bg-orange-100">
                              <AlertTriangle className="w-4 h-4 text-orange-600" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {maintenanceItems.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-red-700 px-1">
                        <div className="p-1.5 rounded-md bg-red-100">
                          <Wrench className="w-3.5 h-3.5" />
                        </div>
                        تحتاج صيانة ({maintenanceItems.length})
                      </div>
                      {maintenanceItems.slice(0, 5).map((item) => (
                        <div 
                          key={item.id} 
                          className="px-3 py-3 rounded-xl bg-gradient-to-l from-red-50 to-rose-50/50 border border-red-200 text-sm"
                          data-testid={`alert-maintenance-${item.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-red-800">{item.name}</div>
                              <div className="text-xs text-red-600 mt-0.5">
                                الحالة: {item.status === 'maintenance' ? 'تحت الصيانة' : 'تالف'}
                              </div>
                            </div>
                            <div className="p-2 rounded-lg bg-red-100">
                              <Wrench className="w-4 h-4 text-red-600" />
                            </div>
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

    <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
      <DialogContent className="max-w-md" data-testid="dialog-notification-detail">
        {selected && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-right">
                {selected.emoji ? <span className="text-xl leading-none">{selected.emoji}</span> : (typeIcons[selected.messageType] || typeIcons.system)}
                <span data-testid="text-notification-title">{selected.title}</span>
              </DialogTitle>
              <DialogDescription className="text-[11px]">
                {getRelativeTime(selected.createdAt)}
              </DialogDescription>
            </DialogHeader>
            {selected.imageUrl && (
              <img src={selected.imageUrl} alt="" className="w-full rounded-lg max-h-60 object-cover" />
            )}
            <p
              className="text-sm leading-relaxed whitespace-pre-wrap text-foreground"
              data-testid="text-notification-content"
            >
              {selected.content}
            </p>
            <DialogFooter className="gap-2 sm:gap-2">
              {selected.buttonAction && (isInternalLink(selected.buttonAction) || /^https?:\/\//.test(selected.buttonAction)) && (
                <Button onClick={() => handleDialogAction(selected)} data-testid="button-notification-action">
                  {selected.buttonText || "فتح"}
                </Button>
              )}
              <Button variant="outline" onClick={() => setSelected(null)} data-testid="button-close-notification">
                إغلاق
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
