import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Landmark,
  Users,
  FileText,
  BarChart3,
  Scale,
  Vote,
  ClipboardList,
  Briefcase,
  FileCheck,
  Shield,
  Calendar,
  UserCheck,
  Building2,
  TrendingUp,
  Bell,
  Plus,
  ChevronLeft,
  Clock,
  AlertTriangle,
  Ban,
  ShieldCheck,
} from "lucide-react";

interface GovernanceModule {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  href: string;
  comingSoon?: boolean;
}

const governanceModules: GovernanceModule[] = [
  {
    id: "board",
    title: "مجلس الإدارة",
    description: "إدارة أعضاء المجلس والاجتماعات والقرارات",
    icon: Users,
    color: "text-violet-600",
    bgColor: "bg-violet-100",
    href: "/governance/board",
  },
  {
    id: "assembly",
    title: "الجمعية العمومية",
    description: "إدارة اجتماعات الجمعية العادية وغير العادية",
    icon: Building2,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    href: "/governance/general-assembly",
  },
  {
    id: "board-meetings",
    title: "اجتماعات المجلس",
    description: "جدولة اجتماعات مجلس الإدارة وإدارة جداول الأعمال",
    icon: Calendar,
    color: "text-sky-600",
    bgColor: "bg-sky-100",
    href: "/governance/meetings",
  },
  {
    id: "minutes",
    title: "محاضر الجمعيات",
    description: "توثيق وأرشفة محاضر الاجتماعات والقرارات",
    icon: FileText,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
    href: "/governance/assembly-minutes",
  },
  {
    id: "shareholders",
    title: "بيانات المساهمين",
    description: "إدارة بيانات الملكية وسجل التحويلات",
    icon: BarChart3,
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    href: "/governance/shareholders",
  },
  {
    id: "investor-portal",
    title: "لوحة التحكم والتواصل مع المساهمين",
    description: "لوحة مؤشرات، إشعارات وواتساب، أخبار وإعلانات، وحسابات بوابة المساهمين",
    icon: Users,
    color: "text-rose-600",
    bgColor: "bg-rose-100",
    href: "/governance/investor-portal",
  },
  {
    id: "resolutions",
    title: "قرارات مجلس الإدارة",
    description: "توثيق ومتابعة قرارات المجلس",
    icon: Scale,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
    href: "/governance/resolutions",
  },
  {
    id: "voting",
    title: "التصويت الإلكتروني",
    description: "إدارة عمليات التصويت وحساب النتائج",
    icon: Vote,
    color: "text-pink-600",
    bgColor: "bg-pink-100",
    href: "/governance/voting",
  },
  {
    id: "transfers",
    title: "تحويلات الأسهم",
    description: "إدارة عمليات نقل ملكية الأسهم",
    icon: ClipboardList,
    color: "text-cyan-600",
    bgColor: "bg-cyan-100",
    href: "/governance/transfers",
  },
  {
    id: "capital",
    title: "إدارة رأس المال",
    description: "زيادة وتخفيض رأس المال وإدارة الأسهم",
    icon: Briefcase,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    href: "/governance/capital",
  },
  {
    id: "dividends",
    title: "توزيعات الأرباح",
    description: "إدارة توزيعات أرباح المساهمين",
    icon: TrendingUp,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    href: "/governance/dividends",
  },
  {
    id: "disclosures",
    title: "الإفصاحات والتقارير",
    description: "رفع القوائم المالية والتقارير النظامية",
    icon: FileCheck,
    color: "text-teal-600",
    bgColor: "bg-teal-100",
    href: "/governance/disclosures",
  },
  {
    id: "compliance",
    title: "الامتثال النظامي",
    description: "متابعة التراخيص والتجديدات والمتطلبات",
    icon: Shield,
    color: "text-red-600",
    bgColor: "bg-red-100",
    href: "/governance/compliance",
  },
  {
    id: "assembly-resolutions",
    title: "قرارات الجمعية العمومية",
    description: "قرارات الجمعية العادية وغير العادية مع أغلبيات نظامية",
    icon: Building2,
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    href: "/governance/assembly-resolutions",
  },
  {
    id: "insiders",
    title: "سجل المطلعين",
    description: "إدارة المطلعين على المعلومات الجوهرية (CMA)",
    icon: UserCheck,
    color: "text-fuchsia-600",
    bgColor: "bg-fuchsia-100",
    href: "/governance/insiders",
  },
  {
    id: "blackout-periods",
    title: "فترات حظر التداول",
    description: "منع تداول المطلعين قبل الإعلانات الجوهرية",
    icon: Ban,
    color: "text-rose-600",
    bgColor: "bg-rose-100",
    href: "/governance/blackout-periods",
  },
  {
    id: "audit-committee",
    title: "لجنة المراجعة",
    description: "إدارة لجنة المراجعة وأعضائها وتقاريرها الربعية والسنوية",
    icon: ShieldCheck,
    color: "text-indigo-700",
    bgColor: "bg-indigo-100",
    href: "/governance/audit-committee",
  },
  {
    id: "prospectus",
    title: "نشرة الإصدار",
    description: "مولّد نشرة إصدار أولية بصيغة هيئة السوق المالية (نمو)",
    icon: FileText,
    color: "text-cyan-700",
    bgColor: "bg-cyan-100",
    href: "/governance/prospectus",
  },
  {
    id: "investor-relations",
    title: "العلاقات مع المساهمين",
    description: "تقويم أحداث المستثمرين وقاعدة بيانات جهات الاتصال",
    icon: TrendingUp,
    color: "text-teal-700",
    bgColor: "bg-teal-100",
    href: "/governance/investor-relations",
  },
  {
    id: "material-disclosures",
    title: "الإفصاحات الجوهرية",
    description: "تسجيل وتصنيف ونشر الإفصاحات الجوهرية إلى تداول",
    icon: Bell,
    color: "text-purple-700",
    bgColor: "bg-purple-100",
    href: "/governance/material-disclosures",
  },
  {
    id: "internal-audit",
    title: "التدقيق الداخلي",
    description: "إدارة الخطط السنوية، عمليات التدقيق، ومتابعة الملاحظات",
    icon: ClipboardList,
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    href: "/governance/internal-audit",
  },
];

interface IndependenceData {
  totalActive: number;
  independent: number;
  ratio: number;
  meetsThreshold: boolean;
  thresholdPct: number;
  message?: string;
}

const upcomingItems = [
  { title: "اجتماع مجلس الإدارة الربعي", date: "2026-02-15", type: "meeting" },
  { title: "موعد تجديد السجل التجاري", date: "2026-03-01", type: "compliance" },
  { title: "الجمعية العمومية السنوية", date: "2026-04-20", type: "assembly" },
];

export default function GovernancePage() {
  const [activeTab, setActiveTab] = useState("overview");
  const { data: independence } = useQuery<IndependenceData>({
    queryKey: ["/api/governance/board-members/_compliance/independence"],
  });

  return (
    <Layout>
      <div className="page-container space-y-4" dir="rtl">
        <PageHeader
          icon={Landmark}
          tone="executive"
          title="الحوكمة ومجلس الإدارة"
          description="إدارة شؤون مجلس الإدارة والجمعية العمومية والامتثال"
          backHref="/executive"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" data-testid="btn-notifications">
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">التنبيهات</span>
              </Button>
              <Button size="sm" className="gap-2" data-testid="btn-new-meeting">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">اجتماع جديد</span>
                <span className="sm:hidden">جديد</span>
              </Button>
            </div>
          }
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="upcoming">المواعيد القادمة</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            {/* KPI: نسبة استقلالية مجلس الإدارة */}
            {independence && (
              <Card
                className={
                  independence.meetsThreshold
                    ? "border-green-300 bg-green-50/30"
                    : "border-amber-300 bg-amber-50/30"
                }
                data-testid="card-independence-ratio"
              >
                <CardContent className="p-5 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-full ${
                        independence.meetsThreshold ? "bg-green-100" : "bg-amber-100"
                      }`}
                    >
                      {independence.meetsThreshold ? (
                        <ShieldCheck className="h-7 w-7 text-green-700" />
                      ) : (
                        <AlertTriangle className="h-7 w-7 text-amber-700" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">نسبة استقلالية مجلس الإدارة</p>
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`text-3xl font-bold ${
                            independence.meetsThreshold ? "text-green-700" : "text-amber-700"
                          }`}
                          data-testid="text-independence-ratio"
                        >
                          {independence.ratio.toFixed(1)}%
                        </span>
                        <span className="text-sm text-gray-500">
                          ({independence.independent} مستقل من {independence.totalActive} عضو)
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        الحد الأدنى نظاماً: {independence.thresholdPct}%
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={
                      independence.meetsThreshold
                        ? "bg-green-600 text-white"
                        : "bg-amber-600 text-white"
                    }
                    data-testid="badge-independence-status"
                  >
                    {independence.meetsThreshold ? "مطابق للنظام" : "غير مطابق — مطلوب تعديل"}
                  </Badge>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {governanceModules.map((module) => (
                <Link href={module.href} key={module.id}>
                  <Card 
                    className="hover:shadow-lg transition-shadow cursor-pointer group relative h-full"
                    data-testid={`module-${module.id}`}
                  >
                    {module.comingSoon && (
                      <Badge 
                        variant="secondary" 
                        className="absolute top-2 left-2 text-xs"
                      >
                        قريباً
                      </Badge>
                    )}
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-lg ${module.bgColor}`}>
                          <module.icon className={`h-6 w-6 ${module.color}`} />
                        </div>
                        <CardTitle className="text-lg group-hover:text-violet-600 transition-colors">
                          {module.title}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm">
                        {module.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="upcoming" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-violet-600" />
                  المواعيد والتنبيهات القادمة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {upcomingItems.map((item, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border"
                      data-testid={`upcoming-${index}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          item.type === 'meeting' ? 'bg-blue-100' :
                          item.type === 'compliance' ? 'bg-red-100' :
                          'bg-amber-100'
                        }`}>
                          {item.type === 'meeting' ? (
                            <Users className="h-5 w-5 text-blue-600" />
                          ) : item.type === 'compliance' ? (
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                          ) : (
                            <Building2 className="h-5 w-5 text-amber-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(item.date).toLocaleDateString('en-GB', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {item.type === 'meeting' ? 'اجتماع' :
                         item.type === 'compliance' ? 'امتثال' :
                         'جمعية'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card className="bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-violet-600 font-medium">أعضاء المجلس</p>
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold text-violet-800">5</p>
                </div>
                <div className="p-2 sm:p-3 bg-violet-100 rounded-lg">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-violet-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-blue-600 font-medium">اجتماعات هذا العام</p>
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-800">12</p>
                </div>
                <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 col-span-2 lg:col-span-1">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-emerald-600 font-medium">نسبة الامتثال</p>
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold text-emerald-800">98%</p>
                </div>
                <div className="p-2 sm:p-3 bg-emerald-100 rounded-lg">
                  <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
