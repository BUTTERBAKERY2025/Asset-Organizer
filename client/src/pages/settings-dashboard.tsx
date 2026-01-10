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
  UserCheck,
  CalendarDays,
  Receipt,
  PieChart,
  Upload,
  Briefcase,
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
    id: "security-governance",
    title: "الأمان والحوكمة",
    description: "إدارة الأمان والمستخدمين والصلاحيات",
    icon: Shield,
    color: "bg-red-500",
    items: [
      {
        id: "security-management",
        title: "إدارة الأمان",
        description: "المصادقة الثنائية وقيود IP والجلسات",
        icon: Shield,
        path: "/security-management",
        badge: "جديد",
        badgeVariant: "default",
        adminOnly: true,
        keywords: ["أمان", "حماية", "2FA", "جلسات", "security"],
      },
      {
        id: "users",
        title: "إدارة المستخدمين",
        description: "إضافة وتعديل وحذف المستخدمين",
        icon: Users,
        path: "/users",
        adminOnly: true,
        keywords: ["مستخدم", "موظف", "حساب", "user"],
      },
      {
        id: "rbac",
        title: "الصلاحيات والأدوار",
        description: "الأدوار والأقسام والصلاحيات التفصيلية",
        icon: KeyRound,
        path: "/rbac-management",
        badge: "RBAC",
        badgeVariant: "secondary",
        adminOnly: true,
        keywords: ["صلاحيات", "أدوار", "أقسام", "permissions", "roles"],
      },
      {
        id: "audit",
        title: "سجل التدقيق",
        description: "تتبع جميع العمليات والتغييرات",
        icon: History,
        path: "/audit-logs",
        adminOnly: true,
        keywords: ["تدقيق", "سجل", "تتبع", "audit", "logs"],
      },
    ],
  },
  {
    id: "hr",
    title: "الموارد البشرية",
    description: "إدارة الموظفين والهيكل التنظيمي والحضور",
    icon: UserCheck,
    color: "bg-teal-500",
    items: [
      {
        id: "branch-employees",
        title: "موظفو الفروع",
        description: "إدارة بيانات موظفي جميع الفروع",
        icon: UserCog,
        path: "/branch-employees",
        keywords: ["موظف", "فرع", "عامل", "employee"],
      },
      {
        id: "org-structure",
        title: "الهيكل التنظيمي",
        description: "عرض وإدارة الهيكل التنظيمي للشركة",
        icon: Briefcase,
        path: "/organizational-structure",
        keywords: ["هيكل", "تنظيم", "إدارة", "organization"],
      },
      {
        id: "attendance",
        title: "الحضور والانصراف",
        description: "متابعة سجلات حضور الموظفين",
        icon: Clock,
        path: "/attendance-dashboard",
        keywords: ["حضور", "انصراف", "دوام", "attendance"],
      },
      {
        id: "timesheet",
        title: "كشوف الدوام",
        description: "إدارة وتوقيع كشوف الدوام",
        icon: CalendarDays,
        path: "/timesheet",
        keywords: ["كشف", "دوام", "ساعات", "timesheet"],
      },
      {
        id: "employee-reports",
        title: "تقارير الموظفين",
        description: "تقارير الأداء والحضور والإحصائيات",
        icon: FileText,
        path: "/employee-reports",
        keywords: ["تقرير", "موظف", "أداء", "reports"],
      },
    ],
  },
  {
    id: "branches-operations",
    title: "الفروع والتشغيل",
    description: "إدارة الفروع والورديات والمنتجات",
    icon: Building2,
    color: "bg-amber-500",
    items: [
      {
        id: "branches",
        title: "إدارة الفروع",
        description: "إضافة وتعديل فروع الشركة",
        icon: Store,
        path: "/branches",
        keywords: ["فرع", "موقع", "branch", "location"],
      },
      {
        id: "shifts",
        title: "الورديات",
        description: "جدولة الورديات وتعيين المناوبات",
        icon: Clock,
        path: "/shifts",
        keywords: ["وردية", "شفت", "دوام", "shift"],
      },
      {
        id: "products",
        title: "المنتجات",
        description: "إدارة قائمة المنتجات والأصناف",
        icon: Boxes,
        path: "/products",
        keywords: ["منتج", "صنف", "بضاعة", "product"],
      },
    ],
  },
  {
    id: "finance",
    title: "المالية والمبيعات",
    description: "الأرباح والخسائر ويوميات الكاشير والتحليلات",
    icon: Wallet,
    color: "bg-emerald-500",
    items: [
      {
        id: "pnl-dashboard",
        title: "لوحة الأرباح والخسائر",
        description: "تتبع الإيرادات والمصروفات والهوامش",
        icon: TrendingUp,
        path: "/pnl-dashboard",
        badge: "P&L",
        badgeVariant: "default",
        keywords: ["أرباح", "خسائر", "مالية", "P&L", "profit"],
      },
      {
        id: "cashier-journal",
        title: "يومية الكاشير",
        description: "تسجيل المبيعات والمقبوضات اليومية",
        icon: Receipt,
        path: "/cashier-journal",
        keywords: ["كاشير", "يومية", "مبيعات", "cashier"],
      },
      {
        id: "cashier-performance",
        title: "أداء الكاشير",
        description: "تقييم ومتابعة أداء موظفي الكاشير",
        icon: BarChart3,
        path: "/cashier-shift-performance",
        keywords: ["كاشير", "أداء", "تقييم", "performance"],
      },
      {
        id: "sales-analytics",
        title: "تحليلات المبيعات",
        description: "تحليل وإحصائيات بيانات المبيعات",
        icon: PieChart,
        path: "/sales-analytics",
        keywords: ["مبيعات", "تحليل", "analytics", "sales"],
      },
      {
        id: "sales-uploads",
        title: "استيراد بيانات المبيعات",
        description: "رفع واستيراد بيانات المبيعات من ملفات",
        icon: Upload,
        path: "/sales-data-uploads",
        keywords: ["رفع", "استيراد", "upload", "import"],
      },
    ],
  },
  {
    id: "targets-incentives",
    title: "الأهداف والحوافز",
    description: "تخطيط الأهداف ومتابعة الإنجاز والمكافآت",
    icon: Target,
    color: "bg-green-500",
    items: [
      {
        id: "targets-planning",
        title: "تخطيط الأهداف",
        description: "وضع أهداف المبيعات والإنتاج للفروع",
        icon: Target,
        path: "/targets-planning",
        keywords: ["هدف", "خطة", "target", "plan"],
      },
      {
        id: "targets-dashboard",
        title: "لوحة متابعة الأهداف",
        description: "متابعة تحقيق الأهداف والإنجازات",
        icon: BarChart3,
        path: "/targets-dashboard",
        keywords: ["أداء", "متابعة", "إنجاز", "progress"],
      },
      {
        id: "incentives",
        title: "إدارة الحوافز",
        description: "نظام المكافآت والحوافز والعمولات",
        icon: TrendingUp,
        path: "/incentives-management",
        keywords: ["حافز", "مكافأة", "عمولة", "incentive", "bonus"],
      },
    ],
  },
  {
    id: "construction",
    title: "المشاريع والإنشاءات",
    description: "إدارة المشاريع والمقاولين والميزانيات",
    icon: Hammer,
    color: "bg-orange-500",
    items: [
      {
        id: "construction-dashboard",
        title: "لوحة المشاريع",
        description: "نظرة عامة على جميع المشاريع",
        icon: ClipboardList,
        path: "/construction-dashboard",
        keywords: ["إنشاءات", "مشاريع", "بناء", "construction"],
      },
      {
        id: "contractors",
        title: "المقاولين والموردين",
        description: "إدارة قائمة المقاولين والموردين",
        icon: Users,
        path: "/contractors",
        keywords: ["مقاول", "مورد", "contractor", "supplier"],
      },
      {
        id: "contracts",
        title: "العقود والاتفاقيات",
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
        keywords: ["ميزانية", "budget", "تكلفة", "cost"],
      },
      {
        id: "payments",
        title: "طلبات الصرف",
        description: "إدارة المدفوعات وطلبات الصرف",
        icon: ArrowRightLeft,
        path: "/payment-requests",
        keywords: ["صرف", "دفع", "payment", "disbursement"],
      },
    ],
  },
  {
    id: "marketing",
    title: "التسويق",
    description: "الحملات التسويقية والمؤثرين والفريق",
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
        title: "الحملات التسويقية",
        description: "إنشاء وإدارة الحملات الإعلانية",
        icon: Zap,
        path: "/marketing-campaigns",
        keywords: ["حملة", "campaign", "إعلان", "ads"],
      },
      {
        id: "influencers",
        title: "المؤثرين",
        description: "إدارة المؤثرين والشراكات",
        icon: Star,
        path: "/marketing-influencers",
        keywords: ["مؤثر", "influencer", "شراكة", "partnership"],
      },
      {
        id: "marketing-team",
        title: "فريق التسويق",
        description: "إدارة أعضاء فريق التسويق",
        icon: Users,
        path: "/marketing-team",
        keywords: ["فريق", "team", "أعضاء", "members"],
      },
    ],
  },
  {
    id: "reports",
    title: "التقارير",
    description: "التقارير العامة والإحصائيات",
    icon: FileText,
    color: "bg-purple-500",
    items: [
      {
        id: "reports",
        title: "التقارير العامة",
        description: "تقارير شاملة لجميع أقسام النظام",
        icon: FileText,
        path: "/reports",
        keywords: ["تقرير", "report", "إحصائيات", "statistics"],
      },
    ],
  },
  {
    id: "system",
    title: "إعدادات النظام",
    description: "النسخ الاحتياطي والتكاملات الخارجية",
    icon: Settings,
    color: "bg-slate-500",
    items: [
      {
        id: "backups",
        title: "النسخ الاحتياطي",
        description: "إنشاء وإدارة النسخ الاحتياطية",
        icon: HardDrive,
        path: "/backups",
        badge: "مهم",
        badgeVariant: "destructive",
        adminOnly: true,
        keywords: ["نسخة", "backup", "حفظ", "restore"],
      },
      {
        id: "integrations",
        title: "التكاملات الخارجية",
        description: "ربط الأنظمة والخدمات الخارجية",
        icon: LinkIcon,
        path: "/integrations",
        adminOnly: true,
        keywords: ["تكامل", "ربط", "API", "integration"],
      },
    ],
  },
];

const quickActions: SettingItem[] = [
  {
    id: "quick-security",
    title: "الأمان",
    description: "إعدادات الحماية",
    icon: Shield,
    path: "/security-management",
    adminOnly: true,
  },
  {
    id: "quick-branches",
    title: "الفروع",
    description: "إدارة الفروع",
    icon: Store,
    path: "/branches",
  },
  {
    id: "quick-employees",
    title: "الموظفين",
    description: "بيانات الموظفين",
    icon: UserCog,
    path: "/branch-employees",
  },
  {
    id: "quick-pnl",
    title: "P&L",
    description: "الأرباح والخسائر",
    icon: TrendingUp,
    path: "/pnl-dashboard",
  },
  {
    id: "quick-backup",
    title: "النسخ الاحتياطي",
    description: "حفظ البيانات",
    icon: HardDrive,
    path: "/backups",
    adminOnly: true,
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
      <div className="container mx-auto py-6 px-4 max-w-7xl" dir="rtl">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
            <div className="p-2 sm:p-3 bg-primary/10 rounded-xl w-fit">
              <Settings className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold" data-testid="text-page-title">
                إعدادات النظام
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                إدارة جميع إعدادات ومحتويات النظام من مكان واحد
              </p>
            </div>
          </div>
        </div>

        <div className="relative mb-6 sm:mb-8">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="ابحث في الإعدادات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10 h-11 min-h-[44px] sm:h-12 sm:min-h-0 text-base sm:text-lg"
            data-testid="input-search-settings"
          />
        </div>

        {visibleQuickActions.length > 0 && !searchQuery && (
          <div className="mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2" data-testid="text-quick-actions-title">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
              إجراءات سريعة
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
              {visibleQuickActions.map((action) => (
                <Link key={action.id} href={action.path}>
                  <Card
                    className="cursor-pointer hover:border-primary hover:shadow-md transition-all group h-full min-h-[80px]"
                    data-testid={`card-quick-${action.id}`}
                  >
                    <CardContent className="p-2 sm:p-3 flex flex-col items-center text-center gap-1 sm:gap-2">
                      <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                        <action.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-xs sm:text-sm">{action.title}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
                          {action.description}
                        </p>
                      </div>
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
                <CardHeader className="pb-3 sm:pb-4 p-3 sm:p-4 md:p-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`p-1.5 sm:p-2 ${section.color} rounded-lg`}>
                      <section.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base sm:text-lg">{section.title}</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">{section.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
                    {visibleItems.map((item) => (
                      <Link key={item.id} href={item.path}>
                        <div
                          className="p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent hover:border-primary cursor-pointer transition-all group min-h-[64px]"
                          data-testid={`link-${item.id}`}
                        >
                          <div className="flex items-start gap-2 sm:gap-3">
                            <div className="p-1.5 sm:p-2 bg-muted rounded-lg group-hover:bg-primary/10 transition-colors">
                              <item.icon className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1 flex-wrap">
                                <span className="font-medium text-sm sm:text-base">{item.title}</span>
                                {item.badge && (
                                  <Badge variant={item.badgeVariant || "secondary"} className="text-[10px] sm:text-xs">
                                    {item.badge}
                                  </Badge>
                                )}
                                {item.adminOnly && (
                                  <Badge variant="outline" className="text-[10px] sm:text-xs">
                                    مدير
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                                {item.description}
                              </p>
                            </div>
                            <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors mt-1 flex-shrink-0" />
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
          <div className="text-center py-12" data-testid="container-no-results">
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
