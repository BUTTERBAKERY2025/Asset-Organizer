import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import {
  Settings,
  Users,
  Shield,
  Building2,
  FileText,
  Database,
  Link as LinkIcon,
  Target,
  Clock,
  TrendingUp,
  Megaphone,
  Wallet,
  ClipboardList,
  BarChart3,
  HardDrive,
  History,
  UserCog,
  KeyRound,
  Store,
  Boxes,
  ArrowRightLeft,
  Hammer,
  FileCheck,
  Search,
  ChevronLeft,
  Star,
  Zap,
} from "lucide-react";

interface SettingItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  adminOnly?: boolean;
  keywords?: string[];
}

interface SettingSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  items: SettingItem[];
}

const settingsSections: SettingSection[] = [
  {
    id: "identity",
    title: "الحوكمة والهوية",
    description: "إدارة المستخدمين والصلاحيات والأدوار",
    icon: Shield,
    color: "bg-blue-500",
    items: [
      {
        id: "users",
        title: "إدارة المستخدمين",
        description: "إضافة وتعديل وحذف المستخدمين",
        icon: Users,
        path: "/users",
        adminOnly: true,
        keywords: ["مستخدم", "موظف", "حساب"],
      },
      {
        id: "rbac",
        title: "إدارة الصلاحيات المتقدمة",
        description: "الأدوار والأقسام والصلاحيات التفصيلية",
        icon: KeyRound,
        path: "/rbac-management",
        badge: "RBAC",
        badgeVariant: "default",
        adminOnly: true,
        keywords: ["صلاحيات", "أدوار", "أقسام", "permissions"],
      },
      {
        id: "audit",
        title: "سجل التدقيق",
        description: "تتبع جميع العمليات والتغييرات",
        icon: History,
        path: "/audit-logs",
        adminOnly: true,
        keywords: ["تدقيق", "سجل", "تتبع", "audit"],
      },
    ],
  },
  {
    id: "branches",
    title: "الفروع والتشغيل",
    description: "إدارة الفروع والورديات والموظفين",
    icon: Building2,
    color: "bg-amber-500",
    items: [
      {
        id: "branches",
        title: "إدارة الفروع",
        description: "إضافة وتعديل فروع الشركة",
        icon: Store,
        path: "/branches",
        keywords: ["فرع", "موقع", "branch"],
      },
      {
        id: "shifts",
        title: "الورديات",
        description: "جدولة الورديات وتعيين الموظفين",
        icon: Clock,
        path: "/shifts",
        keywords: ["وردية", "شفت", "دوام"],
      },
      {
        id: "employees",
        title: "موظفو التشغيل",
        description: "إدارة موظفي العمليات والإنتاج",
        icon: UserCog,
        path: "/operations-employees",
        keywords: ["موظف", "عامل", "تشغيل"],
      },
      {
        id: "products",
        title: "المنتجات",
        description: "إدارة قائمة المنتجات والأصناف",
        icon: Boxes,
        path: "/products",
        keywords: ["منتج", "صنف", "بضاعة"],
      },
    ],
  },
  {
    id: "targets",
    title: "الأهداف والحوافز",
    description: "تخطيط الأهداف وإدارة الحوافز",
    icon: Target,
    color: "bg-green-500",
    items: [
      {
        id: "targets-planning",
        title: "تخطيط الأهداف",
        description: "وضع أهداف المبيعات والإنتاج",
        icon: Target,
        path: "/targets-planning",
        keywords: ["هدف", "خطة", "target"],
      },
      {
        id: "targets-dashboard",
        title: "لوحة الأهداف",
        description: "متابعة تحقيق الأهداف",
        icon: BarChart3,
        path: "/targets-dashboard",
        keywords: ["أداء", "متابعة", "إنجاز"],
      },
      {
        id: "incentives",
        title: "إدارة الحوافز",
        description: "نظام المكافآت والحوافز",
        icon: TrendingUp,
        path: "/incentives-management",
        keywords: ["حافز", "مكافأة", "عمولة"],
      },
      {
        id: "cashier-performance",
        title: "أداء الكاشير",
        description: "تتبع أداء موظفي الكاشير",
        icon: Wallet,
        path: "/cashier-shift-performance",
        keywords: ["كاشير", "أداء", "مبيعات"],
      },
    ],
  },
  {
    id: "reports",
    title: "التقارير والبيانات",
    description: "التقارير والتحليلات وإدارة البيانات",
    icon: FileText,
    color: "bg-purple-500",
    items: [
      {
        id: "reports",
        title: "التقارير العامة",
        description: "تقارير شاملة للنظام",
        icon: FileText,
        path: "/reports",
        keywords: ["تقرير", "report", "إحصائيات"],
      },
      {
        id: "sales-analytics",
        title: "تحليلات المبيعات",
        description: "تحليل بيانات المبيعات",
        icon: BarChart3,
        path: "/sales-analytics",
        keywords: ["مبيعات", "تحليل", "analytics"],
      },
      {
        id: "sales-uploads",
        title: "رفع بيانات المبيعات",
        description: "استيراد بيانات المبيعات من ملفات",
        icon: Database,
        path: "/sales-data-uploads",
        keywords: ["رفع", "استيراد", "upload"],
      },
    ],
  },
  {
    id: "system",
    title: "النظام والتكاملات",
    description: "النسخ الاحتياطي والتكاملات الخارجية",
    icon: Settings,
    color: "bg-slate-500",
    items: [
      {
        id: "backups",
        title: "النسخ الاحتياطي",
        description: "إدارة النسخ الاحتياطية",
        icon: HardDrive,
        path: "/backups",
        badge: "مهم",
        badgeVariant: "destructive",
        adminOnly: true,
        keywords: ["نسخة", "backup", "حفظ"],
      },
      {
        id: "integrations",
        title: "التكاملات",
        description: "ربط الأنظمة الخارجية",
        icon: LinkIcon,
        path: "/integrations",
        adminOnly: true,
        keywords: ["تكامل", "ربط", "API"],
      },
    ],
  },
  {
    id: "construction",
    title: "إدارة الإنشاءات",
    description: "المشاريع والمقاولين والعقود",
    icon: Hammer,
    color: "bg-orange-500",
    items: [
      {
        id: "construction-dashboard",
        title: "لوحة الإنشاءات",
        description: "نظرة عامة على المشاريع",
        icon: ClipboardList,
        path: "/construction-dashboard",
        keywords: ["إنشاءات", "مشاريع", "بناء"],
      },
      {
        id: "contractors",
        title: "المقاولين",
        description: "إدارة المقاولين والموردين",
        icon: Users,
        path: "/contractors",
        keywords: ["مقاول", "مورد", "contractor"],
      },
      {
        id: "contracts",
        title: "العقود",
        description: "إدارة العقود والاتفاقيات",
        icon: FileCheck,
        path: "/contracts",
        keywords: ["عقد", "اتفاقية", "contract"],
      },
      {
        id: "budget",
        title: "تخطيط الميزانية",
        description: "إدارة ميزانيات المشاريع",
        icon: Wallet,
        path: "/budget-planning",
        keywords: ["ميزانية", "budget", "تكلفة"],
      },
      {
        id: "payments",
        title: "طلبات الصرف",
        description: "إدارة المدفوعات والصرف",
        icon: ArrowRightLeft,
        path: "/payment-requests",
        keywords: ["صرف", "دفع", "payment"],
      },
    ],
  },
  {
    id: "marketing",
    title: "التسويق",
    description: "الحملات والمؤثرين والمحتوى",
    icon: Megaphone,
    color: "bg-pink-500",
    items: [
      {
        id: "marketing-dashboard",
        title: "لوحة التسويق",
        description: "نظرة عامة على الأنشطة التسويقية",
        icon: Megaphone,
        path: "/marketing",
        keywords: ["تسويق", "marketing", "حملات"],
      },
      {
        id: "campaigns",
        title: "الحملات",
        description: "إدارة الحملات التسويقية",
        icon: Zap,
        path: "/marketing-campaigns",
        keywords: ["حملة", "campaign", "إعلان"],
      },
      {
        id: "influencers",
        title: "المؤثرين",
        description: "إدارة المؤثرين والشراكات",
        icon: Star,
        path: "/marketing-influencers",
        keywords: ["مؤثر", "influencer", "شراكة"],
      },
      {
        id: "marketing-team",
        title: "فريق التسويق",
        description: "إدارة أعضاء فريق التسويق",
        icon: Users,
        path: "/marketing-team",
        keywords: ["فريق", "team", "أعضاء"],
      },
    ],
  },
];

const quickActions: SettingItem[] = [
  {
    id: "quick-users",
    title: "إضافة مستخدم",
    description: "إنشاء حساب مستخدم جديد",
    icon: Users,
    path: "/users",
    adminOnly: true,
  },
  {
    id: "quick-backup",
    title: "نسخة احتياطية",
    description: "إنشاء نسخة احتياطية فورية",
    icon: HardDrive,
    path: "/backups",
    adminOnly: true,
  },
  {
    id: "quick-rbac",
    title: "مراجعة الصلاحيات",
    description: "التحقق من صلاحيات المستخدمين",
    icon: Shield,
    path: "/rbac-management",
    adminOnly: true,
  },
  {
    id: "quick-branches",
    title: "الفروع",
    description: "إدارة فروع الشركة",
    icon: Building2,
    path: "/branches",
  },
];

export default function SettingsDashboardPage() {
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return settingsSections;

    const query = searchQuery.toLowerCase();
    return settingsSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (item.adminOnly && !isAdmin) return false;
          return (
            item.title.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            item.keywords?.some((k) => k.toLowerCase().includes(query))
          );
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [searchQuery, isAdmin]);

  const visibleQuickActions = quickActions.filter(
    (action) => !action.adminOnly || isAdmin
  );

  return (
    <Layout>
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Settings className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">
                إعدادات النظام
              </h1>
              <p className="text-muted-foreground">
                إدارة جميع إعدادات ومحتويات النظام من مكان واحد
              </p>
            </div>
          </div>
        </div>

        <div className="relative mb-8">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="ابحث في الإعدادات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10 h-12 text-lg"
            data-testid="input-search-settings"
          />
        </div>

        {visibleQuickActions.length > 0 && !searchQuery && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              إجراءات سريعة
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {visibleQuickActions.map((action) => (
                <Link key={action.id} href={action.path}>
                  <Card
                    className="cursor-pointer hover:border-primary hover:shadow-md transition-all group"
                    data-testid={`card-quick-${action.id}`}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                        <action.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{action.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {action.description}
                        </p>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {filteredSections.map((section) => {
            const visibleItems = section.items.filter(
              (item) => !item.adminOnly || isAdmin
            );
            if (visibleItems.length === 0) return null;

            return (
              <Card key={section.id} data-testid={`section-${section.id}`}>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 ${section.color} rounded-lg`}>
                      <section.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{section.title}</CardTitle>
                      <CardDescription>{section.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleItems.map((item) => (
                      <Link key={item.id} href={item.path}>
                        <div
                          className="p-4 rounded-lg border bg-card hover:bg-accent hover:border-primary cursor-pointer transition-all group"
                          data-testid={`link-${item.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-muted rounded-lg group-hover:bg-primary/10 transition-colors">
                              <item.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{item.title}</span>
                                {item.badge && (
                                  <Badge variant={item.badgeVariant || "secondary"} className="text-xs">
                                    {item.badge}
                                  </Badge>
                                )}
                                {item.adminOnly && (
                                  <Badge variant="outline" className="text-xs">
                                    مدير
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {item.description}
                              </p>
                            </div>
                            <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredSections.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">
              لا توجد نتائج لـ "{searchQuery}"
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              جرب كلمات بحث مختلفة
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
