import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
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
  Warehouse,
  Package,
  Factory,
  Wrench,
  FolderOpen,
  Crown,
  Scale,
  UserPlus,
  Plane,
  Mail,
  Video,
  CheckSquare,
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Fingerprint,
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
  requiredModule?: string;
  keywords?: string[];
}

interface SettingSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  items: SettingItem[];
}

const criticalSettings: SettingItem[] = [
  {
    id: "security-management",
    title: "إدارة الأمان",
    description: "المصادقة الثنائية وقيود IP وإدارة الجلسات",
    icon: Shield,
    path: "/security-management",
    badge: "مهم",
    badgeVariant: "destructive",
    adminOnly: true,
  },
  {
    id: "users",
    title: "المستخدمين والأدوار",
    description: "إدارة حسابات المستخدمين والصلاحيات",
    icon: Users,
    path: "/users",
    adminOnly: true,
  },
  {
    id: "backups",
    title: "النسخ الاحتياطي",
    description: "حماية البيانات والاستعادة",
    icon: HardDrive,
    path: "/backups",
    badge: "مهم",
    badgeVariant: "destructive",
    adminOnly: true,
  },
  {
    id: "integrations",
    title: "التكاملات الخارجية",
    description: "ربط الأنظمة والخدمات",
    icon: LinkIcon,
    path: "/integrations",
    adminOnly: true,
  },
];

const settingsSections: SettingSection[] = [
  {
    id: "security-governance",
    title: "الأمان والحوكمة",
    description: "إدارة الأمان والمستخدمين والصلاحيات وسجلات التدقيق",
    icon: Shield,
    color: "text-red-600",
    bgColor: "bg-red-50",
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
    description: "إدارة الموظفين والهيكل التنظيمي والحضور والدوام",
    icon: UserCheck,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
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
      {
        id: "biometric-settings",
        title: "إعدادات بصمة الموظفين",
        description: "إدارة تسجيل البصمة والأجهزة والتحكم الكامل بالبصمات",
        icon: Fingerprint,
        path: "/biometric-settings",
        badge: "جديد",
        badgeVariant: "default",
        requiredModule: "biometric_settings",
        keywords: ["بصمة", "وجه", "حضور", "جهاز", "موبايل", "biometric", "fingerprint"],
      },
    ],
  },
  {
    id: "branches-operations",
    title: "الفروع والتشغيل",
    description: "إدارة الفروع والورديات والمنتجات",
    icon: Building2,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
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
        path: "/shift-management",
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
    description: "الأرباح والخسائر ويوميات الكاشير والتحليلات المالية",
    icon: Wallet,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
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
        path: "/cashier-journals",
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
    description: "تخطيط الأهداف ومتابعة الإنجاز ونظام المكافآت",
    icon: Target,
    color: "text-green-600",
    bgColor: "bg-green-50",
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
    description: "إدارة المشاريع والمقاولين والميزانيات والعقود",
    icon: Hammer,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
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
    description: "الحملات التسويقية والمؤثرين وإدارة فريق التسويق",
    icon: Megaphone,
    color: "text-pink-600",
    bgColor: "bg-pink-50",
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
    id: "warehouse-inventory",
    title: "المستودعات والمخزون",
    description: "إدارة المخازن والمواد والتحويلات بين الفروع",
    icon: Warehouse,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    items: [
      {
        id: "warehouse-dashboard",
        title: "لوحة المستودعات",
        description: "نظرة عامة على المخازن والمواد",
        icon: Warehouse,
        path: "/warehouse-dashboard",
        keywords: ["مستودع", "مخزن", "warehouse", "storage"],
      },
      {
        id: "inventory",
        title: "المخزون",
        description: "إدارة ومتابعة المخزون",
        icon: Package,
        path: "/inventory",
        keywords: ["مخزون", "بضاعة", "inventory", "stock"],
      },
      {
        id: "transfer-requests",
        title: "طلبات التحويل",
        description: "طلبات نقل المواد بين الفروع",
        icon: ArrowRightLeft,
        path: "/transfer-requests",
        keywords: ["تحويل", "نقل", "transfer", "request"],
      },
      {
        id: "warehouse-reports",
        title: "تقارير المستودعات",
        description: "تقارير المخزون والحركة",
        icon: BarChart3,
        path: "/warehouse-reports",
        keywords: ["تقرير", "مستودع", "report", "warehouse"],
      },
    ],
  },
  {
    id: "production-operations",
    title: "الإنتاج والتشغيل",
    description: "إدارة الإنتاج والعمليات ومراقبة الجودة",
    icon: Factory,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    items: [
      {
        id: "production-dashboard",
        title: "لوحة الإنتاج",
        description: "نظرة عامة على عمليات الإنتاج",
        icon: Factory,
        path: "/production-dashboard",
        keywords: ["إنتاج", "تصنيع", "production", "manufacturing"],
      },
      {
        id: "operations",
        title: "التشغيل",
        description: "إدارة العمليات اليومية",
        icon: CheckSquare,
        path: "/operations",
        keywords: ["تشغيل", "عمليات", "operations", "daily"],
      },
      {
        id: "quality-control",
        title: "مراقبة الجودة",
        description: "فحص ومتابعة جودة المنتجات",
        icon: CheckSquare,
        path: "/quality-control",
        keywords: ["جودة", "فحص", "quality", "inspection"],
      },
      {
        id: "operations-reports",
        title: "تقارير التشغيل",
        description: "تقارير شاملة للتشغيل والإنتاج",
        icon: BarChart3,
        path: "/operations-reports",
        badge: "شامل",
        badgeVariant: "default",
        keywords: ["تقرير", "تشغيل", "operations", "report"],
      },
      {
        id: "maintenance",
        title: "الصيانة",
        description: "إدارة صيانة المعدات والأصول",
        icon: Wrench,
        path: "/maintenance",
        keywords: ["صيانة", "إصلاح", "maintenance", "repair"],
      },
    ],
  },
  {
    id: "executive-secretariat",
    title: "السكرتارية التنفيذية",
    description: "إدارة الاجتماعات والمهام والمراسلات والزوار",
    icon: Crown,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    items: [
      {
        id: "executive",
        title: "لوحة التحكم التنفيذية",
        description: "مركز قيادة الرئيس التنفيذي",
        icon: Crown,
        path: "/executive",
        badge: "CEO",
        badgeVariant: "default",
        keywords: ["تنفيذي", "رئيس", "executive", "CEO"],
      },
      {
        id: "executive-meetings",
        title: "الاجتماعات",
        description: "جدولة وإدارة الاجتماعات",
        icon: Video,
        path: "/executive/meetings",
        keywords: ["اجتماع", "meeting", "جلسة", "session"],
      },
      {
        id: "executive-tasks",
        title: "المهام التنفيذية",
        description: "متابعة المهام والتكليفات",
        icon: CheckSquare,
        path: "/executive/tasks",
        keywords: ["مهمة", "task", "تكليف", "assignment"],
      },
      {
        id: "executive-correspondence",
        title: "المراسلات",
        description: "إدارة المراسلات الواردة والصادرة",
        icon: Mail,
        path: "/executive/correspondence",
        keywords: ["مراسلة", "correspondence", "بريد", "mail"],
      },
      {
        id: "visitors",
        title: "الزوار",
        description: "تسجيل ومتابعة الزوار",
        icon: UserPlus,
        path: "/visitors",
        keywords: ["زائر", "visitor", "ضيف", "guest"],
      },
      {
        id: "travel-requests",
        title: "طلبات السفر",
        description: "إدارة طلبات السفر والانتداب",
        icon: Plane,
        path: "/travel-requests",
        keywords: ["سفر", "travel", "انتداب", "trip"],
      },
    ],
  },
  {
    id: "governance",
    title: "الحوكمة المؤسسية",
    description: "مجلس الإدارة والمساهمين والامتثال التنظيمي",
    icon: Scale,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    items: [
      {
        id: "governance-dashboard",
        title: "لوحة الحوكمة",
        description: "نظرة عامة على الحوكمة المؤسسية",
        icon: Scale,
        path: "/governance",
        badge: "حوكمة",
        badgeVariant: "secondary",
        keywords: ["حوكمة", "governance", "إدارة", "corporate"],
      },
      {
        id: "board-members",
        title: "مجلس الإدارة",
        description: "أعضاء مجلس الإدارة",
        icon: Users,
        path: "/governance/board",
        keywords: ["مجلس", "إدارة", "board", "directors"],
      },
      {
        id: "shareholders",
        title: "المساهمين",
        description: "سجل المساهمين وحصصهم",
        icon: UserCheck,
        path: "/governance/shareholders",
        keywords: ["مساهم", "shareholder", "حصة", "share"],
      },
      {
        id: "governance-meetings",
        title: "اجتماعات المجلس",
        description: "محاضر اجتماعات مجلس الإدارة",
        icon: Video,
        path: "/governance/meetings",
        keywords: ["اجتماع", "مجلس", "meeting", "minutes"],
      },
      {
        id: "compliance",
        title: "الامتثال",
        description: "متابعة الالتزام والامتثال",
        icon: FileCheck,
        path: "/governance/compliance",
        keywords: ["امتثال", "التزام", "compliance", "regulation"],
      },
    ],
  },
  {
    id: "documents",
    title: "الوثائق والأرشفة",
    description: "إدارة الوثائق والملفات والأرشيف الإلكتروني",
    icon: FolderOpen,
    color: "text-sky-600",
    bgColor: "bg-sky-50",
    items: [
      {
        id: "documents",
        title: "إدارة الوثائق",
        description: "تخزين وتنظيم الوثائق والملفات",
        icon: FolderOpen,
        path: "/documents",
        keywords: ["وثيقة", "ملف", "document", "file", "أرشيف"],
      },
    ],
  },
  {
    id: "system",
    title: "إعدادات النظام",
    description: "النسخ الاحتياطي والتكاملات الخارجية والتقارير",
    icon: Settings,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
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
];

export default function SettingsDashboardPage() {
  const { isAdmin } = useAuth();
  const { canView } = usePermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const isItemVisible = (item: SettingItem): boolean => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.requiredModule && !isAdmin && !canView(item.requiredModule as any)) return false;
    return true;
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) {
      return settingsSections
        .map((section) => ({
          ...section,
          items: section.items.filter(isItemVisible),
        }))
        .filter((section) => section.items.length > 0);
    }

    const query = searchQuery.toLowerCase();
    return settingsSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (!isItemVisible(item)) return false;
          return (
            item.title.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            item.keywords?.some((k) => k.toLowerCase().includes(query))
          );
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [searchQuery, isAdmin, canView]);

  const visibleCriticalSettings = criticalSettings.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6" dir="rtl">
      <PageHeader
        icon={Settings}
        tone="primary"
        title="مركز الإعدادات"
        description="إدارة جميع إعدادات ومحتويات النظام من مكان واحد"
      />

      <div className="relative mb-4 sm:mb-8">
        <Search className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
        <Input
          placeholder="ابحث في الإعدادات..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-10 sm:pr-12 h-10 sm:h-12 text-sm sm:text-base rounded-lg sm:rounded-xl border-2 focus:border-primary"
          data-testid="input-search-settings"
        />
      </div>

      {visibleCriticalSettings.length > 0 && !searchQuery && (
        <Card className="border bg-red-50" data-testid="section-critical">
          <CardHeader className="p-4 md:p-6 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white shadow-sm">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-bold">الإعدادات الحرجة</CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-0.5">
                  إعدادات أساسية للأمان وحماية النظام
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              {visibleCriticalSettings.map((item) => (
                <Link key={item.id} href={item.path}>
                  <div
                    className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-white/80 hover:bg-white hover:shadow-md cursor-pointer transition-all group border border-transparent hover:border-gray-200"
                    data-testid={`critical-link-${item.id}`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="p-1 sm:p-1.5 rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors shrink-0">
                        <item.icon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 group-hover:text-gray-800" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <span className="font-medium text-xs sm:text-sm truncate">{item.title}</span>
                          {item.badge && (
                            <Badge variant={item.badgeVariant || "secondary"} className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0">
                              {item.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block line-clamp-1">{item.description}</p>
                      </div>
                    </div>
                    <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
        {filteredSections.map((section) => {
          const visibleItems = section.items.filter(isItemVisible);
          if (visibleItems.length === 0) return null;

          const isExpanded = expandedSections.has(section.id);
          const displayItems = isExpanded ? visibleItems : visibleItems.slice(0, 4);
          const hasMore = visibleItems.length > 4;

          return (
            <Card 
              key={section.id} 
              className={`border-2 hover:shadow-lg transition-all ${section.bgColor} border-transparent hover:border-gray-200`}
              data-testid={`section-${section.id}`}
            >
              <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-white shadow-sm`}>
                      <section.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${section.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-sm sm:text-lg font-bold">{section.title}</CardTitle>
                      <CardDescription className="text-xs sm:text-sm mt-0.5 hidden sm:block">{section.description}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 p-3 sm:p-4 md:p-6 md:pt-0">
                <div className="space-y-1 sm:space-y-2">
                  {displayItems.map((item) => (
                    <Link key={item.id} href={item.path}>
                      <div
                        className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-white/80 hover:bg-white hover:shadow-md cursor-pointer transition-all group border border-transparent hover:border-gray-200"
                        data-testid={`link-${item.id}`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className={`p-1 sm:p-1.5 rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors`}>
                            <item.icon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 group-hover:text-gray-800" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1 sm:gap-2">
                              <span className="font-medium text-xs sm:text-sm">{item.title}</span>
                              {item.badge && (
                                <Badge variant={item.badgeVariant || "secondary"} className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0">
                                  {item.badge}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">{item.description}</p>
                          </div>
                        </div>
                        <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>

                {hasMore && (
                  <Button
                    variant="ghost"
                    className="w-full mt-2 sm:mt-3 text-xs sm:text-sm hover:bg-white/50 h-8 sm:h-9"
                    onClick={() => toggleSection(section.id)}
                    data-testid={`btn-toggle-${section.id}`}
                  >
                    {isExpanded ? (
                      <>عرض أقل</>
                    ) : (
                      <>
                        عرض الكل ({visibleItems.length})
                        <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredSections.length === 0 && searchQuery && (
        <div className="text-center py-16" data-testid="container-no-results">
          <div className="p-4 bg-muted rounded-full w-fit mx-auto mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-xl font-medium text-muted-foreground">
            لا توجد نتائج لـ "{searchQuery}"
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            جرب كلمات بحث مختلفة مثل: أمان، موظفين، فروع
          </p>
        </div>
      )}
      </div>
    </Layout>
  );
}
