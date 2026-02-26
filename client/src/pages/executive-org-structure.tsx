import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowLeft, Printer, Building2 } from "lucide-react";
import React, { useRef } from "react";
import { useReactToPrint } from "react-to-print";

function OrgBox({
  title,
  subtitle,
  items,
  color,
  borderColor,
  width = "w-56",
  isRoot = false,
}: {
  title: string;
  subtitle?: string;
  items?: string[];
  color: string;
  borderColor: string;
  width?: string;
  isRoot?: boolean;
}) {
  return (
    <div className={`${width} inline-block`}>
      <div className={`rounded-lg border-2 ${borderColor} bg-white shadow-sm overflow-hidden`}>
        <div className={`${color} px-3 py-2 text-center`}>
          <h3 className={`font-bold text-white ${isRoot ? "text-sm" : "text-xs"} leading-tight`}>{title}</h3>
          {subtitle && <p className="text-[9px] text-white/80 mt-0.5">{subtitle}</p>}
        </div>
        {items && items.length > 0 && (
          <div className="px-2.5 py-2 space-y-1">
            {items.map((item, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[10px] text-slate-700 leading-tight">
                <span className="text-slate-400 mt-px shrink-0">•</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SubDeptBox({ name, tasks }: { name: string; tasks: string[] }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-md p-2 text-right min-w-[140px]">
      <h5 className="text-[10px] font-bold text-slate-800 mb-1 leading-tight">{name}</h5>
      {tasks.map((t, i) => (
        <div key={i} className="text-[9px] text-slate-600 leading-tight flex items-start gap-1">
          <span className="text-slate-300 mt-px shrink-0">•</span>
          <span>{t}</span>
        </div>
      ))}
    </div>
  );
}

function VLine({ height = "h-6" }: { height?: string }) {
  return (
    <div className="flex justify-center">
      <div className={`w-px ${height} bg-slate-400`} />
    </div>
  );
}

function HConnector({ count }: { count: number }) {
  return (
    <div className="relative flex justify-center">
      <div className="w-px h-4 bg-slate-400" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2" style={{ width: `${Math.max(80, (count - 1) * 20)}%` }}>
        <div className="h-px bg-slate-400" />
      </div>
    </div>
  );
}

export default function ExecutiveOrgStructure() {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "الهيكل التنظيمي - شركة الزبد الأفضل التجارية",
    pageStyle: `
      @page { size: A3 landscape; margin: 10mm; }
      @media print {
        body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        * { font-family: 'Cairo', 'Segoe UI', sans-serif !important; }
      }
    `,
  });

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6" dir="rtl">
        <div className="max-w-full mx-auto space-y-4">

          <div className="flex items-center justify-between bg-amber-700 rounded-lg px-4 py-3 print:hidden">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-white" />
              <div>
                <h1 className="text-lg font-bold text-white">الهيكل التنظيمي</h1>
                <p className="text-xs text-amber-200">شركة الزبد الأفضل التجارية</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => handlePrint()}
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                data-testid="btn-print-org"
              >
                <Printer className="h-4 w-4 ml-1" />
                تصدير PDF
              </Button>
              <Link href="/executive">
                <Button variant="ghost" size="sm" className="text-white hover:bg-amber-600" data-testid="btn-back-executive">
                  العودة <ArrowLeft className="h-4 w-4 mr-1" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto pb-4">
            <div ref={printRef} className="min-w-[1100px] p-6 bg-white rounded-xl border border-slate-200" dir="rtl">

              <div className="text-center mb-2 hidden print:block">
                <h1 className="text-xl font-bold text-slate-900">الهيكل التنظيمي</h1>
                <p className="text-sm text-slate-600">شركة الزبد الأفضل التجارية</p>
                <div className="w-24 h-0.5 bg-amber-500 mx-auto mt-2" />
              </div>

              {/* Level 1: Owner */}
              <div className="text-center">
                <OrgBox
                  title="المالك"
                  color="bg-gradient-to-b from-amber-600 to-amber-700"
                  borderColor="border-amber-500"
                  width="w-52"
                  isRoot
                  items={[
                    "اعتماد التوجه الاستراتيجي",
                    "اعتماد الخطط طويلة الأجل",
                    "اعتماد زيادة رأس المال",
                    "اعتماد الاستحواذات والتحول",
                  ]}
                />
              </div>

              <VLine />

              {/* Level 1: CEO */}
              <div className="text-center">
                <OrgBox
                  title="الرئيس التنفيذي (CEO)"
                  subtitle="المسؤول التنفيذي الأعلى"
                  color="bg-gradient-to-b from-indigo-700 to-indigo-800"
                  borderColor="border-indigo-500"
                  width="w-60"
                  isRoot
                  items={[
                    "الإشراف على جميع الإدارات",
                    "اعتماد الميزانيات والعقود الجوهرية",
                    "اعتماد المصروفات الرأسمالية",
                    "الإشراف على الالتزام والحوكمة",
                  ]}
                />
              </div>

              {/* Connector from CEO to departments */}
              <VLine height="h-4" />
              <div className="relative mx-auto" style={{ width: "90%" }}>
                <div className="h-px bg-slate-400" />
                {/* 5 vertical drops */}
                <div className="flex justify-between">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-px h-4 bg-slate-400" />
                  ))}
                </div>
              </div>

              {/* Level 2: Main Departments */}
              <div className="flex justify-between gap-2" style={{ width: "90%", margin: "0 auto" }}>

                {/* Finance */}
                <div className="flex-1 text-center">
                  <OrgBox
                    title="الإدارة المالية"
                    subtitle="Finance & Accounting"
                    color="bg-gradient-to-b from-emerald-600 to-emerald-700"
                    borderColor="border-emerald-400"
                    width="w-full"
                  />
                  <VLine height="h-3" />
                  <div className="grid grid-cols-1 gap-1.5 px-1">
                    <SubDeptBox name="المحاسبة العامة" tasks={["القيود اليومية", "ميزان المراجعة", "القوائم المالية"]} />
                    <SubDeptBox name="الموردين (AP)" tasks={["مراجعة الفواتير", "مطابقة PO/GRN", "جدول أعمار الديون"]} />
                    <SubDeptBox name="العملاء (AR)" tasks={["متابعة التحصيل", "مطابقة المبيعات", "أعمار الذمم"]} />
                    <SubDeptBox name="الخزينة" tasks={["التدفقات النقدية", "الحسابات البنكية", "تقارير السيولة"]} />
                    <SubDeptBox name="الرواتب" tasks={["مسير الرواتب", "الاستقطاعات", "سداد التأمينات"]} />
                  </div>
                </div>

                {/* Operations */}
                <div className="flex-1 text-center">
                  <OrgBox
                    title="إدارة التشغيل"
                    subtitle="Operations"
                    color="bg-gradient-to-b from-blue-600 to-blue-700"
                    borderColor="border-blue-400"
                    width="w-full"
                  />
                  <VLine height="h-3" />
                  <div className="grid grid-cols-1 gap-1.5 px-1">
                    <SubDeptBox name="إدارة الفروع" tasks={["الأداء اليومي", "أهداف المبيعات", "ضبط الهدر", "مراقبة الجودة"]} />
                    <SubDeptBox name="إدارة الإنتاج" tasks={["خطوط الإنتاج", "المواد الخام", "الالتزام بالوصفات"]} />
                    <SubDeptBox name="إدارة الجودة" tasks={["فحص المنتجات", "الالتزام الصحي", "تقارير الامتثال"]} />
                    <SubDeptBox name="التخطيط والتوريد" tasks={["تخطيط الاحتياجات", "طلبات الفروع", "مراقبة الاستهلاك"]} />
                  </div>
                </div>

                {/* Procurement */}
                <div className="flex-1 text-center">
                  <OrgBox
                    title="المشتريات وسلسلة الإمداد"
                    subtitle="Procurement & Supply Chain"
                    color="bg-gradient-to-b from-orange-600 to-orange-700"
                    borderColor="border-orange-400"
                    width="w-full"
                  />
                  <VLine height="h-3" />
                  <div className="grid grid-cols-1 gap-1.5 px-1">
                    <SubDeptBox name="قسم المشتريات" tasks={["إدارة الموردين", "التفاوض على الأسعار", "أوامر الشراء", "تقييم الموردين"]} />
                    <SubDeptBox name="المستودع المركزي" tasks={["استلام المواد", "التخزين", "الجرد الدوري", "التوزيع للفروع"]} />
                    <SubDeptBox name="مستودعات الفروع" tasks={["مخزون الفرع", "الجرد اليومي", "تقارير الفروقات"]} />
                  </div>
                </div>

                {/* HR */}
                <div className="flex-1 text-center">
                  <OrgBox
                    title="الموارد البشرية"
                    subtitle="Human Resources"
                    color="bg-gradient-to-b from-purple-600 to-purple-700"
                    borderColor="border-purple-400"
                    width="w-full"
                  />
                  <VLine height="h-3" />
                  <div className="grid grid-cols-1 gap-1.5 px-1">
                    <SubDeptBox name="التوظيف" tasks={["استقطاب الموظفين", "المقابلات", "إصدار العقود"]} />
                    <SubDeptBox name="شؤون الموظفين" tasks={["ملفات الموظفين", "الإجازات", "المخالصات"]} />
                    <SubDeptBox name="الحضور والانصراف" tasks={["متابعة الدوام", "تقارير التأخير", "إدارة الإضافي"]} />
                    <SubDeptBox name="الامتثال والتأمينات" tasks={["تسجيل GOSI", "التأمين الطبي", "نظام العمل"]} />
                  </div>
                </div>

                {/* IT */}
                <div className="flex-1 text-center">
                  <OrgBox
                    title="تقنية المعلومات"
                    subtitle="Information Technology"
                    color="bg-gradient-to-b from-cyan-600 to-cyan-700"
                    borderColor="border-cyan-400"
                    width="w-full"
                  />
                  <VLine height="h-3" />
                  <div className="grid grid-cols-1 gap-1.5 px-1">
                    <SubDeptBox name="الأنظمة والبنية التحتية" tasks={["أنظمة POS", "أنظمة المحاسبة", "السيرفرات", "حماية البيانات", "دعم الفروع"]} />
                  </div>
                </div>
              </div>

              {/* Level 3 & 4: Branch + Support */}
              <div className="mt-6 pt-4 border-t-2 border-dashed border-slate-300">
                <div className="flex gap-6 justify-center">

                  {/* Branch structure */}
                  <div className="flex-1 max-w-md">
                    <div className="text-center">
                      <div className="inline-block rounded-lg border-2 border-teal-400 bg-white shadow-sm overflow-hidden w-full">
                        <div className="bg-gradient-to-b from-teal-600 to-teal-700 px-4 py-2 text-center">
                          <h3 className="text-xs font-bold text-white">المستوى الثالث: هيكل كل فرع</h3>
                        </div>
                        <div className="p-3">
                          <div className="space-y-0">
                            {[
                              { role: "مدير فرع", level: 0 },
                              { role: "مساعد مدير فرع", level: 1 },
                              { role: "مشرف شيفت", level: 2 },
                              { role: "مسؤول مخزون", level: 3 },
                              { role: "كاشير", level: 3 },
                              { role: "موظفي إنتاج", level: 3 },
                              { role: "موظفي خدمة عملاء", level: 3 },
                              { role: "عمال نظافة", level: 4 },
                            ].map((item, i) => (
                              <React.Fragment key={i}>
                                <div
                                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                                    item.level === 0
                                      ? "bg-teal-700 text-white"
                                      : item.level === 1
                                      ? "bg-teal-100 text-teal-900"
                                      : item.level === 2
                                      ? "bg-teal-50 text-teal-800"
                                      : "bg-white text-slate-700 border border-slate-100"
                                  }`}
                                  style={{ marginRight: `${item.level * 16}px` }}
                                >
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                                    item.level === 0
                                      ? "bg-white text-teal-700"
                                      : "bg-teal-200 text-teal-700"
                                  }`}>
                                    {i + 1}
                                  </div>
                                  <span className="text-[10px] font-medium">{item.role}</span>
                                </div>
                                {i < 7 && (
                                  <div className="flex" style={{ marginRight: `${item.level * 16 + 10}px` }}>
                                    <div className="w-px h-1.5 bg-teal-300" />
                                  </div>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Operational Support */}
                  <div className="flex-1 max-w-sm">
                    <div className="inline-block rounded-lg border-2 border-slate-400 bg-white shadow-sm overflow-hidden w-full">
                      <div className="bg-gradient-to-b from-slate-600 to-slate-700 px-4 py-2 text-center">
                        <h3 className="text-xs font-bold text-white">المستوى الرابع: الدعم التشغيلي</h3>
                      </div>
                      <div className="p-3 grid grid-cols-2 gap-2">
                        {["سائقين", "عمال مستودعات", "فني صيانة", "دعم تقني ميداني"].map((role, i) => (
                          <div key={i} className="bg-slate-50 border border-slate-200 rounded-md px-2 py-2 text-center">
                            <span className="text-[10px] font-medium text-slate-700">{role}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Segregation & Reporting */}
              <div className="mt-6 pt-4 border-t-2 border-dashed border-slate-300">
                <div className="flex gap-6 justify-center">

                  {/* Segregation of Duties */}
                  <div className="flex-1 max-w-md">
                    <div className="rounded-lg border-2 border-red-300 bg-white shadow-sm overflow-hidden">
                      <div className="bg-gradient-to-b from-red-600 to-red-700 px-4 py-2 text-center">
                        <h3 className="text-xs font-bold text-white">فصل الصلاحيات (Segregation of Duties)</h3>
                      </div>
                      <div className="p-3 space-y-1.5">
                        {[
                          "المشتريات منفصلة عن السداد",
                          "التسجيل المحاسبي منفصل عن اعتماد المدفوعات",
                          "الجرد منفصل عن مسؤول المخزون",
                          "الرواتب تعتمد من الإدارة التنفيذية بعد مراجعة المالية",
                        ].map((item, i) => (
                          <div key={i} className="flex items-start gap-2 bg-red-50 rounded-md px-2 py-1.5">
                            <span className="text-green-600 text-[10px] font-bold mt-px shrink-0">✓</span>
                            <span className="text-[10px] text-slate-700">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Reporting Path */}
                  <div className="flex-1 max-w-sm">
                    <div className="rounded-lg border-2 border-violet-300 bg-white shadow-sm overflow-hidden">
                      <div className="bg-gradient-to-b from-violet-600 to-violet-700 px-4 py-2 text-center">
                        <h3 className="text-xs font-bold text-white">مسار التقارير</h3>
                      </div>
                      <div className="p-3 space-y-0">
                        {["المستوى التنفيذي", "مدراء الإدارات", "رؤساء الأقسام", "المشرفين", "الموظفين التشغيليين"].map((level, i, arr) => (
                          <React.Fragment key={i}>
                            <div className={`rounded-md px-3 py-1.5 text-center ${
                              i === 0
                                ? "bg-violet-700 text-white"
                                : i === 1
                                ? "bg-violet-100 text-violet-900"
                                : "bg-white border border-violet-100 text-slate-700"
                            }`}>
                              <div className="flex items-center justify-center gap-2">
                                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${
                                  i === 0 ? "bg-white text-violet-700" : "bg-violet-200 text-violet-700"
                                }`}>
                                  {i + 1}
                                </div>
                                <span className="text-[10px] font-medium">{level}</span>
                              </div>
                            </div>
                            {i < arr.length - 1 && (
                              <div className="flex justify-center">
                                <div className="w-px h-2 bg-violet-300" />
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 pt-3 border-t border-slate-200 text-center">
                <p className="text-[9px] text-slate-400">شركة الزبد الأفضل التجارية — الهيكل التنظيمي المعتمد</p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
