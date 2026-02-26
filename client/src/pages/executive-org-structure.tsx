import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  ArrowLeft,
  Crown,
  Building2,
  Users,
  Landmark,
  Factory,
  ShoppingCart,
  UserCog,
  Monitor,
  Store,
  Truck,
  ShieldCheck,
  GitBranch,
  ChevronDown,
  Briefcase,
  CircleDot,
} from "lucide-react";
import React from "react";

interface OrgUnit {
  title: string;
  titleEn?: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  responsibilities?: string[];
  departments?: {
    name: string;
    nameEn?: string;
    tasks: string[];
  }[];
}

const level1: OrgUnit[] = [
  {
    title: "المالك",
    icon: <Crown className="h-5 w-5" />,
    color: "text-amber-800",
    bgColor: "bg-gradient-to-br from-amber-50 to-amber-100",
    borderColor: "border-amber-300",
    responsibilities: [
      "اعتماد التوجه الاستراتيجي",
      "اعتماد الخطط طويلة الأجل",
      "اعتماد زيادة رأس المال",
      "اعتماد الاستحواذات والتحول",
    ],
  },
  {
    title: "الرئيس التنفيذي (CEO)",
    icon: <Briefcase className="h-5 w-5" />,
    color: "text-indigo-800",
    bgColor: "bg-gradient-to-br from-indigo-50 to-indigo-100",
    borderColor: "border-indigo-300",
    responsibilities: [
      "المسؤول التنفيذي الأعلى",
      "الإشراف على جميع الإدارات",
      "اعتماد الميزانيات",
      "اعتماد العقود الجوهرية",
      "اعتماد المصروفات الرأسمالية",
      "الإشراف على الالتزام والحوكمة",
    ],
  },
];

const level2: OrgUnit[] = [
  {
    title: "الإدارة المالية",
    titleEn: "Finance & Accounting",
    icon: <Landmark className="h-5 w-5" />,
    color: "text-emerald-800",
    bgColor: "bg-gradient-to-br from-emerald-50 to-emerald-100",
    borderColor: "border-emerald-300",
    departments: [
      {
        name: "قسم المحاسبة العامة",
        tasks: ["تسجيل القيود اليومية", "إعداد ميزان المراجعة", "إعداد القوائم المالية", "مطابقة الحسابات"],
      },
      {
        name: "قسم الموردين (Accounts Payable)",
        tasks: ["مراجعة الفواتير", "مطابقة PO و GRN", "إعداد جدول أعمار الديون", "إدارة السداد"],
      },
      {
        name: "قسم العملاء (Accounts Receivable)",
        tasks: ["متابعة التحصيل", "مطابقة المبيعات", "إدارة أعمار الذمم"],
      },
      {
        name: "قسم الخزينة (Treasury)",
        tasks: ["إدارة التدفقات النقدية", "إدارة الحسابات البنكية", "إعداد تقارير السيولة"],
      },
      {
        name: "قسم الرواتب (Payroll)",
        tasks: ["إعداد مسير الرواتب", "احتساب الاستقطاعات", "سداد التأمينات"],
      },
    ],
  },
  {
    title: "إدارة التشغيل",
    titleEn: "Operations",
    icon: <Factory className="h-5 w-5" />,
    color: "text-blue-800",
    bgColor: "bg-gradient-to-br from-blue-50 to-blue-100",
    borderColor: "border-blue-300",
    departments: [
      {
        name: "إدارة الفروع",
        tasks: ["الإشراف على الأداء اليومي", "تحقيق أهداف المبيعات", "ضبط الهدر", "مراقبة الجودة"],
      },
      {
        name: "إدارة الإنتاج",
        tasks: ["إدارة خطوط الإنتاج", "مراقبة المواد الخام", "الالتزام بالوصفات", "متابعة الكفاءة التشغيلية"],
      },
      {
        name: "إدارة الجودة",
        tasks: ["فحص المنتجات", "متابعة الالتزام الصحي", "تقارير الامتثال"],
      },
      {
        name: "إدارة التخطيط والتوريد الداخلي",
        tasks: ["تخطيط الاحتياجات", "إدارة طلبات الفروع", "مراقبة الاستهلاك"],
      },
    ],
  },
  {
    title: "إدارة المشتريات وسلسلة الإمداد",
    titleEn: "Procurement & Supply Chain",
    icon: <ShoppingCart className="h-5 w-5" />,
    color: "text-orange-800",
    bgColor: "bg-gradient-to-br from-orange-50 to-orange-100",
    borderColor: "border-orange-300",
    departments: [
      {
        name: "قسم المشتريات",
        tasks: ["إدارة الموردين", "التفاوض على الأسعار", "إصدار أوامر الشراء", "تقييم الموردين"],
      },
      {
        name: "المستودع المركزي",
        tasks: ["استلام المواد", "التخزين", "الجرد الدوري", "التوزيع للفروع"],
      },
      {
        name: "المستودعات التشغيلية بالفروع",
        tasks: ["إدارة مخزون الفرع", "الجرد اليومي", "تقارير الفروقات"],
      },
    ],
  },
  {
    title: "إدارة الموارد البشرية",
    titleEn: "HR",
    icon: <UserCog className="h-5 w-5" />,
    color: "text-purple-800",
    bgColor: "bg-gradient-to-br from-purple-50 to-purple-100",
    borderColor: "border-purple-300",
    departments: [
      {
        name: "التوظيف",
        tasks: ["استقطاب الموظفين", "المقابلات", "إصدار العقود"],
      },
      {
        name: "شؤون الموظفين",
        tasks: ["إدارة ملفات الموظفين", "الإجازات", "المخالصات"],
      },
      {
        name: "الحضور والانصراف",
        tasks: ["متابعة الدوام", "تقارير التأخير", "إدارة الإضافي"],
      },
      {
        name: "الامتثال والتأمينات",
        tasks: ["تسجيل GOSI", "التأمين الطبي", "الالتزام بنظام العمل"],
      },
    ],
  },
  {
    title: "إدارة تقنية المعلومات",
    titleEn: "IT",
    icon: <Monitor className="h-5 w-5" />,
    color: "text-cyan-800",
    bgColor: "bg-gradient-to-br from-cyan-50 to-cyan-100",
    borderColor: "border-cyan-300",
    responsibilities: [
      "إدارة أنظمة نقاط البيع (POS)",
      "إدارة أنظمة المحاسبة",
      "إدارة السيرفرات",
      "حماية البيانات",
      "دعم الفروع",
    ],
  },
];

const branchStructure = [
  "مدير فرع",
  "مساعد مدير فرع",
  "مشرف شيفت",
  "مسؤول مخزون",
  "كاشير",
  "موظفي إنتاج",
  "موظفي خدمة عملاء",
  "عمال نظافة",
];

const operationalSupport = ["سائقين", "عمال مستودعات", "فني صيانة", "دعم تقني ميداني"];

const segregationOfDuties = [
  "المشتريات منفصلة عن السداد",
  "التسجيل المحاسبي منفصل عن اعتماد المدفوعات",
  "الجرد منفصل عن مسؤول المخزون",
  "الرواتب تعتمد من الإدارة التنفيذية بعد مراجعة المالية",
];

const reportingPath = [
  "المستوى التنفيذي",
  "مدراء الإدارات",
  "رؤساء الأقسام",
  "المشرفين",
  "الموظفين التشغيليين",
];

function ConnectorArrow() {
  return (
    <div className="flex justify-center py-1">
      <ChevronDown className="h-5 w-5 text-slate-400" />
    </div>
  );
}

function DepartmentCard({ dept }: { dept: { name: string; tasks: string[] } }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 hover:shadow-sm transition-shadow" data-testid={`dept-card-${dept.name}`}>
      <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5">
        <CircleDot className="h-3 w-3 text-slate-400 shrink-0" />
        {dept.name}
      </h4>
      <ul className="space-y-1">
        {dept.tasks.map((task, i) => (
          <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5 pr-4">
            <span className="text-slate-300 mt-0.5 shrink-0">•</span>
            {task}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ExecutiveOrgStructure() {
  const [expandedUnits, setExpandedUnits] = React.useState<Set<string>>(new Set());

  const toggleUnit = (title: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6" dir="rtl">
        <div className="max-w-5xl mx-auto space-y-5">

          <div className="flex items-center justify-between bg-amber-700 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-white" />
              <div>
                <h1 className="text-lg font-bold text-white">الهيكل التنظيمي</h1>
                <p className="text-xs text-amber-200">شركة الزبد الأفضل التجارية</p>
              </div>
            </div>
            <Link href="/executive">
              <Button variant="ghost" size="sm" className="text-white hover:bg-amber-600" data-testid="btn-back-executive">
                العودة <ArrowLeft className="h-4 w-4 mr-1" />
              </Button>
            </Link>
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-600" />
              المستوى الأول: الحوكمة والقيادة العليا
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              {level1.map((unit) => (
                <Card key={unit.title} className={`${unit.borderColor} border-2 ${unit.bgColor}`} data-testid={`org-unit-${unit.title}`}>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className={`text-sm font-bold ${unit.color} flex items-center gap-2`}>
                      {unit.icon}
                      {unit.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <ul className="space-y-1">
                      {unit.responsibilities?.map((r, i) => (
                        <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
                          <span className="text-slate-400 mt-0.5 shrink-0">•</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <ConnectorArrow />

          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              المستوى الثاني: الإدارات الرئيسية
            </h2>

            <div className="space-y-3 mt-3">
              {level2.map((unit, idx) => {
                const isExpanded = expandedUnits.has(unit.title);
                return (
                  <Card key={unit.title} className={`${unit.borderColor} border ${unit.bgColor} overflow-hidden`} data-testid={`org-dept-${idx}`}>
                    <button
                      onClick={() => toggleUnit(unit.title)}
                      className="w-full p-3 flex items-center justify-between hover:opacity-90 transition-opacity"
                      data-testid={`btn-toggle-dept-${idx}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg bg-white/60 ${unit.color}`}>
                          {unit.icon}
                        </div>
                        <div className="text-right">
                          <h3 className={`text-sm font-bold ${unit.color}`}>{unit.title}</h3>
                          {unit.titleEn && <p className="text-[10px] text-slate-500">{unit.titleEn}</p>}
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-xs ${unit.color} border-current`}>
                        {unit.departments ? `${unit.departments.length} أقسام` : `${unit.responsibilities?.length} مهام`}
                      </Badge>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3">
                        {unit.departments ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {unit.departments.map((dept, di) => (
                              <DepartmentCard key={di} dept={dept} />
                            ))}
                          </div>
                        ) : (
                          <div className="bg-white rounded-lg border border-slate-200 p-3">
                            <ul className="space-y-1.5">
                              {unit.responsibilities?.map((r, i) => (
                                <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
                                  <span className="text-slate-400 mt-0.5 shrink-0">•</span>
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>

          <ConnectorArrow />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-2 border-teal-300 bg-gradient-to-br from-teal-50 to-teal-100" data-testid="org-branches">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm font-bold text-teal-800 flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  المستوى الثالث: هيكل الفروع
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="space-y-1.5">
                  {branchStructure.map((role, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        i === 0 ? "bg-teal-600 text-white" : i < 3 ? "bg-teal-400 text-white" : "bg-teal-200 text-teal-800"
                      }`}>
                        {i + 1}
                      </div>
                      <span className="text-xs text-slate-700">{role}</span>
                      {i < branchStructure.length - 1 && (
                        <ChevronDown className="h-3 w-3 text-teal-300 absolute -bottom-1 left-1/2 hidden" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-slate-300 bg-gradient-to-br from-slate-50 to-slate-100" data-testid="org-support">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  المستوى الرابع: الدعم التشغيلي
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="grid grid-cols-2 gap-2">
                  {operationalSupport.map((role, i) => (
                    <div key={i} className="bg-white rounded-lg border border-slate-200 p-2.5 text-center">
                      <span className="text-xs font-medium text-slate-700">{role}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-orange-50" data-testid="org-segregation">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm font-bold text-red-800 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  فصل الصلاحيات (Segregation of Duties)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="space-y-2">
                  {segregationOfDuties.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 bg-white rounded-lg border border-red-100 p-2">
                      <span className="text-green-600 text-sm mt-0 shrink-0">✓</span>
                      <span className="text-xs text-slate-700">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50" data-testid="org-reporting">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm font-bold text-violet-800 flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  مسار التقارير
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="space-y-0">
                  {reportingPath.map((level, i) => (
                    <React.Fragment key={i}>
                      <div className={`flex items-center gap-2 p-2 rounded-lg ${
                        i === 0 ? "bg-violet-600 text-white" : "bg-white border border-violet-100"
                      }`}>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          i === 0 ? "bg-white text-violet-600" : "bg-violet-100 text-violet-600"
                        }`}>
                          {i + 1}
                        </div>
                        <span className={`text-xs font-medium ${i === 0 ? "text-white" : "text-slate-700"}`}>{level}</span>
                      </div>
                      {i < reportingPath.length - 1 && (
                        <div className="flex justify-center">
                          <ChevronDown className="h-3.5 w-3.5 text-violet-300" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </Layout>
  );
}
