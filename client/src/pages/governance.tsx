import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
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
    id: "minutes",
    title: "محاضر الجمعيات",
    description: "توثيق وأرشفة محاضر الاجتماعات والقرارات",
    icon: FileText,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
    href: "/governance/meetings",
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
];

const upcomingItems = [
  { title: "اجتماع مجلس الإدارة الربعي", date: "2026-02-15", type: "meeting" },
  { title: "موعد تجديد السجل التجاري", date: "2026-03-01", type: "compliance" },
  { title: "الجمعية العمومية السنوية", date: "2026-04-20", type: "assembly" },
];

export default function GovernancePage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-8 lg:p-10 space-y-4" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/executive">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
              <Landmark className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-violet-800" data-testid="page-title">
                الحوكمة ومجلس الإدارة
              </h1>
              <p className="text-gray-600">إدارة شؤون مجلس الإدارة والجمعية العمومية والامتثال</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" data-testid="btn-notifications">
              <Bell className="h-4 w-4" />
              التنبيهات
            </Button>
            <Button className="gap-2 bg-violet-600 hover:bg-violet-700" data-testid="btn-new-meeting">
              <Plus className="h-4 w-4" />
              اجتماع جديد
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="upcoming">المواعيد القادمة</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-violet-600 font-medium">أعضاء المجلس</p>
                  <p className="text-3xl font-bold text-violet-800">5</p>
                </div>
                <div className="p-3 bg-violet-100 rounded-lg">
                  <Users className="h-6 w-6 text-violet-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">اجتماعات هذا العام</p>
                  <p className="text-3xl font-bold text-blue-800">12</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-600 font-medium">نسبة الامتثال</p>
                  <p className="text-3xl font-bold text-emerald-800">98%</p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <Shield className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
