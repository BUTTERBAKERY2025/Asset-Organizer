import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Warehouse, Send, Boxes, History, Store,
  ArrowRight, Clock, CheckCircle, AlertTriangle, Truck,
  Bell, BellRing, Building2, ShoppingCart, FileText,
  Package, ArrowLeftRight, ClipboardList, BarChart3, X
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

type DashboardStats = {
  pendingRequests: number;
  approvedRequests: number;
  inTransitTransfers: number;
  lowStockItems: number;
};

type Branch = {
  id: string;
  name: string;
};

type Notification = {
  id: number;
  type: string;
  title: string;
  titleEn?: string;
  body: string;
  bodyEn?: string;
  branchId?: string;
  targetBranchId?: string;
  entityType?: string;
  entityId?: number;
  priority?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
};

export default function WarehouseDashboardPage() {
  const { t, i18n } = useTranslation("platform-home");
  const isRTL = i18n.language === "ar";
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [notificationOpen, setNotificationOpen] = useState(false);

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/warehouse/dashboard-stats", selectedBranch],
    queryFn: async () => {
      const params = selectedBranch !== "all" ? `?branchId=${selectedBranch}` : "";
      const res = await fetch(`/api/warehouse/dashboard-stats${params}`);
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/warehouse/notifications", selectedBranch],
    queryFn: async () => {
      const params = selectedBranch !== "all" ? `?branchId=${selectedBranch}&limit=20` : "?limit=20";
      const res = await fetch(`/api/warehouse/notifications${params}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: unreadCount = { count: 0 } } = useQuery<{ count: number }>({
    queryKey: ["/api/warehouse/notifications/unread-count", selectedBranch],
    queryFn: async () => {
      const params = selectedBranch !== "all" ? `?branchId=${selectedBranch}` : "";
      const res = await fetch(`/api/warehouse/notifications/unread-count${params}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("PUT", `/api/warehouse/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const params = selectedBranch !== "all" ? `?branchId=${selectedBranch}` : "";
      return apiRequest("PUT", `/api/warehouse/notifications/mark-all-read${params}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/notifications/unread-count"] });
    },
  });

  const quickLinks = [
    {
      title: isRTL ? "طلبات التحويل" : "Transfer Requests",
      description: isRTL ? "طلبات التحويل بين الفروع والمستودع الرئيسي" : "Transfer requests between branches and warehouse",
      icon: ArrowLeftRight,
      href: `/transfer-requests${selectedBranch !== "all" ? `?branchId=${selectedBranch}` : ""}`,
      color: "bg-green-500",
      stats: stats?.inTransitTransfers,
      statLabel: isRTL ? "في الطريق" : "in transit",
    },
    {
      title: isRTL ? "مخزون المستودع" : "Warehouse Inventory",
      description: isRTL ? "عرض ومتابعة مخزون المستودع الرئيسي" : "View and track main warehouse inventory",
      icon: Boxes,
      href: "/warehouse-inventory",
      color: "bg-amber-500",
      stats: stats?.lowStockItems,
      statLabel: isRTL ? "مواد منخفضة" : "low stock",
    },
    {
      title: isRTL ? "سجل الحركات" : "Movement Logs",
      description: isRTL ? "تتبع جميع حركات المخزون الواردة والصادرة" : "Track all inventory movements",
      icon: History,
      href: `/warehouse-movement-logs${selectedBranch !== "all" ? `?branchId=${selectedBranch}` : ""}`,
      color: "bg-indigo-500",
    },
    {
      title: isRTL ? "مخزون الفروع" : "Branch Stock",
      description: isRTL ? "متابعة مستويات المخزون في الفروع" : "Monitor stock levels in branches",
      icon: Store,
      href: `/branch-stock${selectedBranch !== "all" ? `/${selectedBranch}` : ""}`,
      color: "bg-purple-500",
    },
    {
      title: isRTL ? "التقارير" : "Reports",
      description: isRTL ? "تقارير شاملة عن المخزون والطلبات والتحويلات" : "Comprehensive inventory and transfer reports",
      icon: BarChart3,
      href: "/warehouse-reports",
      color: "bg-rose-500",
    },
    {
      title: isRTL ? "طلبات المشتريات" : "Purchasing Requests",
      description: isRTL ? "إدارة طلبات الشراء من الموردين" : "Manage purchase orders from vendors",
      icon: ShoppingCart,
      href: "/purchasing-requests",
      color: "bg-pink-500",
    },
  ];

  const statCards = [
    {
      title: isRTL ? "طلبات قيد الانتظار" : "Pending Requests",
      value: stats?.pendingRequests ?? 0,
      icon: Clock,
      color: "text-yellow-500",
      bgColor: "bg-yellow-100 dark:bg-yellow-900/20",
    },
    {
      title: isRTL ? "طلبات موافق عليها" : "Approved Requests",
      value: stats?.approvedRequests ?? 0,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-100 dark:bg-green-900/20",
    },
    {
      title: isRTL ? "تحويلات في الطريق" : "In Transit",
      value: stats?.inTransitTransfers ?? 0,
      icon: Truck,
      color: "text-blue-500",
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
    },
    {
      title: isRTL ? "مواد منخفضة المخزون" : "Low Stock Items",
      value: stats?.lowStockItems ?? 0,
      icon: AlertTriangle,
      color: "text-red-500",
      bgColor: "bg-red-100 dark:bg-red-900/20",
    },
  ];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "request_created":
        return <ClipboardList className="w-4 h-4 text-blue-500" />;
      case "request_approved":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "request_rejected":
        return <X className="w-4 h-4 text-red-500" />;
      case "transfer_started":
        return <Truck className="w-4 h-4 text-orange-500" />;
      case "transfer_delivered":
        return <Package className="w-4 h-4 text-green-500" />;
      case "transfer_cancelled":
        return <X className="w-4 h-4 text-red-500" />;
      case "low_stock":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { 
        addSuffix: true,
        locale: isRTL ? ar : undefined 
      });
    } catch {
      return dateStr;
    }
  };

  const selectedBranchName = branches.find(b => b.id === selectedBranch)?.name || (isRTL ? "جميع الفروع" : "All Branches");

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Warehouse className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {isRTL ? "لوحة تحكم المخازن" : "Warehouse Dashboard"}
              </h1>
              <p className="text-muted-foreground text-sm">
                {selectedBranch !== "all" ? selectedBranchName : (isRTL ? "إدارة شاملة لجميع الفروع" : "Comprehensive management for all branches")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-[200px]" data-testid="select-branch">
                <Building2 className="w-4 h-4 opacity-60" />
                <SelectValue placeholder={isRTL ? "اختر الفرع" : "Select Branch"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="branch-all">
                  {isRTL ? "جميع الفروع" : "All Branches"}
                </SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id} data-testid={`branch-${branch.id}`}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Sheet open={notificationOpen} onOpenChange={setNotificationOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="relative" data-testid="btn-notifications">
                  {unreadCount.count > 0 ? (
                    <BellRing className="w-5 h-5 text-primary" />
                  ) : (
                    <Bell className="w-5 h-5" />
                  )}
                  {unreadCount.count > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center text-xs p-0"
                    >
                      {unreadCount.count > 99 ? "99+" : unreadCount.count}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side={isRTL ? "left" : "right"} className="w-[400px] sm:w-[450px]">
                <SheetHeader>
                  <div className="flex items-center justify-between">
                    <SheetTitle className="flex items-center gap-2">
                      <Bell className="w-5 h-5" />
                      {isRTL ? "الإشعارات" : "Notifications"}
                    </SheetTitle>
                    {unreadCount.count > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => markAllReadMutation.mutate()}
                        data-testid="btn-mark-all-read"
                      >
                        {isRTL ? "تحديد الكل كمقروء" : "Mark all as read"}
                      </Button>
                    )}
                  </div>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-100px)] mt-4">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Bell className="w-12 h-12 text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground">
                        {isRTL ? "لا توجد إشعارات" : "No notifications"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((notif) => (
                        <div 
                          key={notif.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            notif.isRead 
                              ? "bg-background hover:bg-muted/50" 
                              : "bg-primary/5 border-primary/20 hover:bg-primary/10"
                          }`}
                          onClick={() => {
                            if (!notif.isRead) {
                              markAsReadMutation.mutate(notif.id);
                            }
                          }}
                          data-testid={`notification-${notif.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-1">
                              {getNotificationIcon(notif.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${!notif.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                                {isRTL ? notif.title : (notif.titleEn || notif.title)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {isRTL ? notif.body : (notif.bodyEn || notif.body)}
                              </p>
                              <p className="text-xs text-muted-foreground/60 mt-2">
                                {formatTime(notif.createdAt)}
                              </p>
                            </div>
                            {!notif.isRead && (
                              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <Card key={index} className="overflow-hidden" data-testid={`stat-card-${index}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.title}</p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-12 mt-1" />
                    ) : (
                      <p className="text-2xl font-bold">{stat.value}</p>
                    )}
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {quickLinks.map((link, index) => (
            <Link key={index} href={link.href}>
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/40 h-full group"
                data-testid={`quick-link-${link.href.split("?")[0].replace("/", "")}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl ${link.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                      <link.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{link.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {link.description}
                      </p>
                      {link.stats !== undefined && link.stats > 0 && (
                        <Badge variant="secondary" className="mt-2">
                          {link.stats} {link.statLabel}
                        </Badge>
                      )}
                    </div>
                    <ArrowRight className={`w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors ${isRTL ? "rotate-180" : ""}`} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5 text-primary" />
                {isRTL ? "سير العمل" : "Workflow Overview"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-600">1</div>
                  <div>
                    <p className="font-medium text-sm">{isRTL ? "إنشاء طلب مواد" : "Create Material Request"}</p>
                    <p className="text-xs text-muted-foreground">{isRTL ? "الفرع يقوم بطلب المواد المطلوبة" : "Branch requests needed materials"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-sm font-bold text-yellow-600">2</div>
                  <div>
                    <p className="font-medium text-sm">{isRTL ? "مراجعة وموافقة" : "Review & Approve"}</p>
                    <p className="text-xs text-muted-foreground">{isRTL ? "المستودع يراجع ويوافق على الطلب" : "Warehouse reviews and approves"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-sm font-bold text-orange-600">3</div>
                  <div>
                    <p className="font-medium text-sm">{isRTL ? "تنفيذ التحويل" : "Execute Transfer"}</p>
                    <p className="text-xs text-muted-foreground">{isRTL ? "شحن المواد للفرع" : "Ship materials to branch"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-sm font-bold text-green-600">4</div>
                  <div>
                    <p className="font-medium text-sm">{isRTL ? "استلام وتأكيد" : "Receive & Confirm"}</p>
                    <p className="text-xs text-muted-foreground">{isRTL ? "الفرع يستلم ويوقع إلكترونياً" : "Branch receives and signs electronically"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="w-5 h-5 text-primary" />
                {isRTL ? "أنواع المواد" : "Material Categories"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/50">
                  <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center mb-3">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-medium text-sm">{isRTL ? "مواد خام" : "Raw Materials"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{isRTL ? "دقيق، سكر، زبدة..." : "Flour, sugar, butter..."}</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200/50">
                  <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center mb-3">
                    <Boxes className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-medium text-sm">{isRTL ? "مواد تغليف" : "Packaging"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{isRTL ? "علب، أكياس، ملصقات..." : "Boxes, bags, labels..."}</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200/50">
                  <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center mb-3">
                    <ClipboardList className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-medium text-sm">{isRTL ? "مستهلكات" : "Consumables"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{isRTL ? "قفازات، مناديل..." : "Gloves, tissues..."}</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200/50">
                  <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center mb-3">
                    <Store className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-medium text-sm">{isRTL ? "إنتاج أولي" : "Primary Production"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{isRTL ? "عجائن جاهزة..." : "Ready doughs..."}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
