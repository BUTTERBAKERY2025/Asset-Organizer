import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { 
  Warehouse, PackageCheck, Send, Boxes, History, Store,
  ArrowRight, Clock, CheckCircle, AlertTriangle, Truck
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type DashboardStats = {
  pendingRequests: number;
  approvedRequests: number;
  inTransitTransfers: number;
  lowStockItems: number;
};

export default function WarehouseDashboardPage() {
  const { t, i18n } = useTranslation("platform-home");
  const isRTL = i18n.language === "ar";

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/warehouse/dashboard-stats"],
    refetchInterval: 60000,
  });

  const quickLinks = [
    {
      title: isRTL ? "طلبات المواد" : "Material Requests",
      description: isRTL ? "إنشاء ومتابعة طلبات المواد الخام والمستلزمات" : "Create and track raw material requests",
      icon: PackageCheck,
      href: "/material-requests",
      color: "bg-blue-500",
    },
    {
      title: isRTL ? "طلبات التحويل" : "Transfer Requests",
      description: isRTL ? "طلبات التحويل بين الفروع والمستودع الرئيسي" : "Transfer requests between branches and warehouse",
      icon: Send,
      href: "/transfer-requests",
      color: "bg-green-500",
    },
    {
      title: isRTL ? "مخزون المستودع" : "Warehouse Inventory",
      description: isRTL ? "عرض ومتابعة مخزون المستودع الرئيسي" : "View and track main warehouse inventory",
      icon: Boxes,
      href: "/warehouse-inventory",
      color: "bg-amber-500",
    },
    {
      title: isRTL ? "سجل الحركات" : "Movement Logs",
      description: isRTL ? "تتبع جميع حركات المخزون الواردة والصادرة" : "Track all inventory movements",
      icon: History,
      href: "/warehouse-movement-logs",
      color: "bg-indigo-500",
    },
    {
      title: isRTL ? "مخزون الفروع" : "Branch Stock",
      description: isRTL ? "متابعة مستويات المخزون في الفروع" : "Monitor stock levels in branches",
      icon: Store,
      href: "/branch-stock",
      color: "bg-purple-500",
    },
    {
      title: isRTL ? "التقارير" : "Reports",
      description: isRTL ? "تقارير شاملة عن المخزون والطلبات والتحويلات" : "Comprehensive inventory and transfer reports",
      icon: History,
      href: "/warehouse-reports",
      color: "bg-rose-500",
    },
    {
      title: isRTL ? "طلبات المشتريات" : "Purchasing Requests",
      description: isRTL ? "إدارة طلبات الشراء من الموردين" : "Manage purchase orders from vendors",
      icon: Warehouse,
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

  return (
    <Layout>
      <div className="p-4 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500 flex items-center justify-center">
            <Warehouse className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isRTL ? "المخازن والتحويلات" : "Warehouse & Transfers"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isRTL ? "إدارة طلبات المواد والتحويلات بين الفروع والمستودع الرئيسي" : "Manage material requests and transfers between branches and main warehouse"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <Card key={index} data-testid={`stat-card-${index}`}>
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
                  <div className={`w-10 h-10 rounded-full ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickLinks.map((link, index) => (
            <Link key={index} href={link.href}>
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/40 h-full"
                data-testid={`quick-link-${link.href.replace('/', '')}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${link.color} flex items-center justify-center`}>
                      <link.icon className="w-5 h-5 text-white" />
                    </div>
                    <CardTitle className="text-lg">{link.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {link.description}
                  </CardDescription>
                  <div className="mt-4 flex items-center text-primary text-sm font-medium">
                    {isRTL ? "الذهاب للصفحة" : "Go to page"}
                    <ArrowRight className={`w-4 h-4 ${isRTL ? "mr-1 rotate-180" : "ml-1"}`} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="w-5 h-5" />
              {isRTL ? "نظرة عامة" : "Overview"}
            </CardTitle>
            <CardDescription>
              {isRTL 
                ? "نظام إدارة المستودعات والتحويلات يتضمن الميزات التالية"
                : "The warehouse management system includes the following features"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-medium">{isRTL ? "طلبات المواد" : "Material Requests"}</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>{isRTL ? "طلبات المواد الخام" : "Raw material requests"}</li>
                  <li>{isRTL ? "طلبات المستلزمات" : "Consumable requests"}</li>
                  <li>{isRTL ? "طلبات مواد التغليف" : "Packaging material requests"}</li>
                  <li>{isRTL ? "سير عمل الموافقات" : "Approval workflow"}</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">{isRTL ? "التحويلات" : "Transfers"}</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>{isRTL ? "تتبع التحويلات بين الفروع" : "Track transfers between branches"}</li>
                  <li>{isRTL ? "بيانات السائق والمركبة" : "Driver and vehicle info"}</li>
                  <li>{isRTL ? "تتبع حالة التسليم" : "Delivery status tracking"}</li>
                  <li>{isRTL ? "التوقيع الإلكتروني للاستلام" : "Electronic signature receipt"}</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
