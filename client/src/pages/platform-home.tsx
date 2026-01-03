import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Link, useLocation } from "wouter";
import { Package, Hammer, FileBarChart, Settings, Users, ArrowLeftRight, Building2, FileSignature, Wallet, Calculator, Boxes, AlertTriangle, CalendarCheck, ClipboardEdit, HardHat, FileSearch, HardDrive, Link2, LayoutDashboard, ChevronLeft, Factory, Clock, CheckCircle } from "lucide-react";
import type { SystemModule } from "@shared/schema";

interface ModuleCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
  badge?: string;
  items?: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[];
}

function ModuleCard({ title, description, icon: Icon, href, color, badge, items }: ModuleCardProps) {
  const [, navigate] = useLocation();
  
  return (
    <Card 
      className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/30 overflow-hidden"
      onClick={() => navigate(href)}
      data-testid={`module-card-${href.replace('/', '')}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color} transition-transform group-hover:scale-110`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          {badge && (
            <Badge variant="secondary" className="text-xs">{badge}</Badge>
          )}
        </div>
        <CardTitle className="text-lg mt-3">{title}</CardTitle>
        <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
      </CardHeader>
      {items && items.length > 0 && (
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {items.slice(0, 4).map((item, index) => (
              <Link key={index} href={item.href} onClick={(e) => e.stopPropagation()}>
                <Badge 
                  variant="outline" 
                  className="flex items-center gap-1 hover:bg-secondary cursor-pointer transition-colors text-xs"
                >
                  <item.icon className="w-3 h-3" />
                  {item.label}
                </Badge>
              </Link>
            ))}
            {items.length > 4 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                +{items.length - 4} أخرى
              </Badge>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function PlatformHomePage() {
  const { user, isAuthenticated } = useAuth();
  const { canView } = usePermissions();
  const [, navigate] = useLocation();

  const modules: (ModuleCardProps & { module?: SystemModule })[] = [
    {
      title: "الأصول والجرد",
      description: "إدارة ومتابعة جميع أصول الشركة والمعدات والمخزون",
      icon: Package,
      href: "/inventory",
      color: "bg-amber-500",
      module: "inventory",
      items: [
        { label: "جرد الأصول", href: "/inventory", icon: Boxes },
        { label: "إدارة الأصول", href: "/manage", icon: ClipboardEdit },
        { label: "تحويلات الأصول", href: "/asset-transfers", icon: ArrowLeftRight },
        { label: "إدارة الفروع", href: "/branches", icon: Building2 },
        { label: "الفحص الدوري", href: "/inspections", icon: CalendarCheck },
        { label: "تقرير الصيانة", href: "/maintenance", icon: AlertTriangle },
      ],
    },
    {
      title: "التشغيل والإنتاج",
      description: "إدارة الإنتاج اليومي والورديات ومراقبة الجودة",
      icon: Factory,
      href: "/operations",
      color: "bg-indigo-500",
      module: "operations",
      items: [
        { label: "لوحة التشغيل", href: "/operations", icon: Factory },
        { label: "المنتجات", href: "/products", icon: Package },
        { label: "الورديات", href: "/shifts", icon: Clock },
        { label: "أوامر الإنتاج", href: "/production", icon: ClipboardEdit },
        { label: "مراقبة الجودة", href: "/quality-control", icon: CheckCircle },
        { label: "يومية الكاشير", href: "/cashier-journals", icon: Wallet },
      ],
    },
    {
      title: "المشاريع الإنشائية",
      description: "تتبع مشاريع البناء والتجديد والمقاولين والميزانيات",
      icon: Hammer,
      href: "/construction-projects",
      color: "bg-orange-500",
      module: "construction_projects",
      items: [
        { label: "المشاريع", href: "/construction-projects", icon: Hammer },
        { label: "المقاولون", href: "/contractors", icon: HardHat },
        { label: "العقود", href: "/contracts", icon: FileSignature },
        { label: "طلبات الدفع", href: "/payment-requests", icon: Wallet },
        { label: "تخطيط الميزانية", href: "/budget-planning", icon: Calculator },
      ],
    },
    {
      title: "الإعدادات والنظام",
      description: "إدارة المستخدمين والصلاحيات والتكاملات والنسخ الاحتياطية",
      icon: Settings,
      href: "/users",
      color: "bg-slate-500",
      module: "users",
      items: [
        { label: "إدارة المستخدمين", href: "/users", icon: Users },
        { label: "التكاملات", href: "/integrations", icon: Link2 },
        { label: "سجل التدقيق", href: "/audit-logs", icon: FileSearch },
        { label: "النسخ الاحتياطية", href: "/backups", icon: HardDrive },
      ],
    },
  ];

  const accessibleModules = modules.filter(module => {
    if (!module.module) return true;
    return canView(module.module);
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "صباح الخير";
    if (hour < 17) return "مساء الخير";
    return "مساء الخير";
  };

  return (
    <Layout>
      <div className="space-y-8" dir="rtl">
        <div className="text-center space-y-3 py-6">
          <h1 className="text-3xl font-bold text-foreground">
            {getGreeting()}{user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            مرحباً بك في منصة بتر بيكري الشاملة - اختر القسم الذي تريد الوصول إليه
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accessibleModules.map((module, index) => (
            <ModuleCard key={index} {...module} />
          ))}
        </div>

        {!isAuthenticated && (
          <div className="text-center py-8">
            <Card className="max-w-md mx-auto">
              <CardHeader>
                <CardTitle className="text-lg">تسجيل الدخول مطلوب</CardTitle>
                <CardDescription>
                  للوصول إلى جميع ميزات المنصة، يرجى تسجيل الدخول أولاً
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/login">
                  <button
                    className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                    data-testid="button-login-home"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    تسجيل الدخول
                  </button>
                </Link>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
