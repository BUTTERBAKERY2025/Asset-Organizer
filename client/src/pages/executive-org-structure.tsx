import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowLeft, Printer, Building2 } from "lucide-react";
import React, { useRef } from "react";
import { useReactToPrint } from "react-to-print";

function NodeBox({
  title,
  subtitle,
  items,
  bg,
  textColor = "text-white",
  className = "",
}: {
  title: string;
  subtitle?: string;
  items?: string[];
  bg: string;
  textColor?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-lg shadow-md border overflow-hidden ${className}`}>
      <div className={`${bg} px-4 py-2.5 text-center`}>
        <h3 className={`text-[11px] font-bold ${textColor} leading-snug`}>{title}</h3>
        {subtitle && <p className={`text-[9px] ${textColor} opacity-75 mt-0.5`}>{subtitle}</p>}
      </div>
      {items && items.length > 0 && (
        <div className="bg-white px-3 py-2 space-y-0.5">
          {items.map((item, i) => (
            <div key={i} className="text-[9px] text-slate-600 leading-snug flex items-start gap-1">
              <span className="text-slate-300 shrink-0 mt-px">◆</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionBox({
  name,
  tasks,
}: {
  name: string;
  tasks: string[];
}) {
  return (
    <div className="bg-white rounded border border-slate-200 p-2">
      <h5 className="text-[9px] font-bold text-slate-800 mb-1 border-b border-slate-100 pb-1">{name}</h5>
      {tasks.map((t, i) => (
        <div key={i} className="text-[8px] text-slate-500 leading-snug flex items-start gap-1">
          <span className="text-slate-300 shrink-0">–</span>
          <span>{t}</span>
        </div>
      ))}
    </div>
  );
}

function VertLine({ h = 20 }: { h?: number }) {
  return (
    <div className="flex justify-center" style={{ height: h }}>
      <div className="w-[2px] h-full bg-slate-300 rounded-full" />
    </div>
  );
}

export default function ExecutiveOrgStructure() {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "الهيكل التنظيمي - شركة الزبد الأفضل التجارية",
    pageStyle: `
      @page { size: A3 landscape; margin: 8mm; }
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

          <div className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3 print:hidden">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-amber-400" />
              <div>
                <h1 className="text-lg font-bold text-white">الهيكل التنظيمي</h1>
                <p className="text-xs text-slate-400">شركة الزبد الأفضل التجارية</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => handlePrint()}
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                data-testid="btn-print-org"
              >
                <Printer className="h-4 w-4 ml-1.5" />
                تصدير PDF
              </Button>
              <Link href="/executive">
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700" data-testid="btn-back-executive">
                  العودة <ArrowLeft className="h-4 w-4 mr-1" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto pb-4">
            <div
              ref={printRef}
              className="min-w-[1200px] bg-gradient-to-b from-slate-50 to-white rounded-xl border border-slate-200 shadow-sm"
              dir="rtl"
              style={{ padding: "28px 32px" }}
            >

              {/* Print header */}
              <div className="text-center mb-5">
                <div className="inline-block">
                  <h1 className="text-lg font-bold text-slate-900 tracking-wide">الهيكل التنظيمي</h1>
                  <p className="text-[11px] text-slate-500 mt-0.5">شركة الزبد الأفضل التجارية — حوكمة الشركات المساهمة</p>
                  <div className="w-32 h-[2px] bg-amber-500 mx-auto mt-2 rounded-full" />
                </div>
              </div>

              {/* ═══ LEVEL 0: الجمعية العامة ═══ */}
              <div className="text-center">
                <NodeBox
                  title="الجمعية العامة للمساهمين"
                  subtitle="General Assembly"
                  bg="bg-gradient-to-b from-amber-700 to-amber-800 border-amber-600"
                  items={[
                    "اعتماد القوائم المالية السنوية",
                    "تعيين وعزل أعضاء مجلس الإدارة",
                    "تعيين مراجع الحسابات الخارجي",
                    "اعتماد زيادة / تخفيض رأس المال",
                    "اعتماد الأرباح الموزعة",
                  ]}
                  className="max-w-[280px] mx-auto"
                />
              </div>

              <VertLine h={16} />

              {/* ═══ LEVEL 1: مجلس الإدارة ═══ */}
              <div className="text-center">
                <NodeBox
                  title="مجلس الإدارة"
                  subtitle="Board of Directors"
                  bg="bg-gradient-to-b from-slate-800 to-slate-900 border-slate-700"
                  items={[
                    "رسم التوجهات الاستراتيجية",
                    "اعتماد الخطط والميزانيات السنوية",
                    "الرقابة على الأداء التنفيذي",
                    "تعيين وتقييم الرئيس التنفيذي",
                    "اعتماد السياسات والإجراءات الجوهرية",
                  ]}
                  className="max-w-[280px] mx-auto"
                />
              </div>

              {/* Board sub-entities row */}
              <VertLine h={10} />
              <div className="relative mx-auto" style={{ width: "52%" }}>
                <div className="h-[2px] bg-slate-300 rounded-full" />
                <div className="flex justify-between">
                  {[0, 1, 2].map(i => <div key={i} className="w-[2px] h-3 bg-slate-300 rounded-full" />)}
                </div>
              </div>
              <div className="flex justify-center gap-4">
                <NodeBox
                  title="رئيس مجلس الإدارة"
                  subtitle="Chairman"
                  bg="bg-gradient-to-b from-amber-600 to-amber-700 border-amber-500"
                  items={[
                    "رئاسة اجتماعات المجلس",
                    "التوقيع على القرارات الاستراتيجية",
                    "تمثيل الشركة أمام الجهات الرسمية",
                  ]}
                  className="w-[210px]"
                />
                <NodeBox
                  title="لجنة المراجعة"
                  subtitle="Audit Committee"
                  bg="bg-gradient-to-b from-red-700 to-red-800 border-red-600"
                  items={[
                    "مراجعة القوائم المالية",
                    "تقييم نظام الرقابة الداخلية",
                    "التوصية بتعيين المراجع الخارجي",
                  ]}
                  className="w-[210px]"
                />
                <NodeBox
                  title="لجنة المكافآت والترشيحات"
                  subtitle="Remuneration & Nomination"
                  bg="bg-gradient-to-b from-violet-700 to-violet-800 border-violet-600"
                  items={[
                    "سياسات مكافآت أعضاء المجلس والتنفيذيين",
                    "ترشيح أعضاء المجلس",
                    "تقييم أداء المجلس والإدارة التنفيذية",
                  ]}
                  className="w-[210px]"
                />
              </div>

              {/* ═══ LEVEL 2: الرئيس التنفيذي ═══ */}
              <VertLine h={16} />
              <div className="text-center">
                <NodeBox
                  title="الرئيس التنفيذي"
                  subtitle="Chief Executive Officer (CEO)"
                  bg="bg-gradient-to-b from-indigo-700 to-indigo-800 border-indigo-600"
                  items={[
                    "تنفيذ قرارات مجلس الإدارة",
                    "الإشراف على جميع الإدارات التنفيذية",
                    "اعتماد الميزانيات التشغيلية",
                    "اعتماد العقود والمصروفات الرأسمالية",
                    "ضمان الالتزام والحوكمة",
                  ]}
                  className="max-w-[280px] mx-auto"
                />
              </div>

              {/* ═══ LEVEL 3: الإدارات الرئيسية ═══ */}
              <VertLine h={12} />
              <div className="relative mx-auto" style={{ width: "92%" }}>
                <div className="h-[2px] bg-slate-300 rounded-full" />
                <div className="flex justify-between">
                  {[0, 1, 2, 3, 4].map(i => <div key={i} className="w-[2px] h-3 bg-slate-300 rounded-full" />)}
                </div>
              </div>

              <div className="flex gap-3 justify-center" style={{ width: "92%", margin: "0 auto" }}>

                {/* 1 - Finance */}
                <div className="flex-1 space-y-1.5">
                  <NodeBox
                    title="الإدارة المالية"
                    subtitle="Finance & Accounting"
                    bg="bg-gradient-to-b from-emerald-600 to-emerald-700 border-emerald-500"
                    className="w-full"
                  />
                  <div className="space-y-1">
                    <SectionBox name="المحاسبة العامة" tasks={["القيود اليومية", "ميزان المراجعة", "القوائم المالية", "مطابقة الحسابات"]} />
                    <SectionBox name="قسم الموردين (AP)" tasks={["مراجعة الفواتير", "مطابقة PO/GRN", "جدول أعمار الديون", "إدارة السداد"]} />
                    <SectionBox name="قسم العملاء (AR)" tasks={["متابعة التحصيل", "مطابقة المبيعات", "أعمار الذمم"]} />
                    <SectionBox name="الخزينة (Treasury)" tasks={["التدفقات النقدية", "الحسابات البنكية", "تقارير السيولة"]} />
                    <SectionBox name="الرواتب (Payroll)" tasks={["مسير الرواتب", "الاستقطاعات", "سداد التأمينات"]} />
                  </div>
                </div>

                {/* 2 - Operations */}
                <div className="flex-1 space-y-1.5">
                  <NodeBox
                    title="إدارة التشغيل"
                    subtitle="Operations"
                    bg="bg-gradient-to-b from-blue-600 to-blue-700 border-blue-500"
                    className="w-full"
                  />
                  <div className="space-y-1">
                    <SectionBox name="إدارة الفروع" tasks={["الأداء اليومي", "أهداف المبيعات", "ضبط الهدر", "مراقبة الجودة"]} />
                    <SectionBox name="إدارة الإنتاج" tasks={["خطوط الإنتاج", "مراقبة المواد الخام", "الالتزام بالوصفات", "الكفاءة التشغيلية"]} />
                    <SectionBox name="إدارة الجودة" tasks={["فحص المنتجات", "الالتزام الصحي", "تقارير الامتثال"]} />
                    <SectionBox name="التخطيط والتوريد الداخلي" tasks={["تخطيط الاحتياجات", "طلبات الفروع", "مراقبة الاستهلاك"]} />
                  </div>
                </div>

                {/* 3 - Procurement */}
                <div className="flex-1 space-y-1.5">
                  <NodeBox
                    title="المشتريات وسلسلة الإمداد"
                    subtitle="Procurement & Supply Chain"
                    bg="bg-gradient-to-b from-orange-600 to-orange-700 border-orange-500"
                    className="w-full"
                  />
                  <div className="space-y-1">
                    <SectionBox name="قسم المشتريات" tasks={["إدارة الموردين", "التفاوض على الأسعار", "أوامر الشراء", "تقييم الموردين"]} />
                    <SectionBox name="المستودع المركزي" tasks={["استلام المواد", "التخزين", "الجرد الدوري", "التوزيع للفروع"]} />
                    <SectionBox name="المستودعات التشغيلية" tasks={["مخزون الفرع", "الجرد اليومي", "تقارير الفروقات"]} />
                  </div>
                </div>

                {/* 4 - HR */}
                <div className="flex-1 space-y-1.5">
                  <NodeBox
                    title="الموارد البشرية"
                    subtitle="Human Resources"
                    bg="bg-gradient-to-b from-purple-600 to-purple-700 border-purple-500"
                    className="w-full"
                  />
                  <div className="space-y-1">
                    <SectionBox name="التوظيف" tasks={["استقطاب الموظفين", "المقابلات", "إصدار العقود"]} />
                    <SectionBox name="شؤون الموظفين" tasks={["ملفات الموظفين", "الإجازات", "المخالصات"]} />
                    <SectionBox name="الحضور والانصراف" tasks={["متابعة الدوام", "تقارير التأخير", "إدارة الإضافي"]} />
                    <SectionBox name="الامتثال والتأمينات" tasks={["تسجيل GOSI", "التأمين الطبي", "الالتزام بنظام العمل"]} />
                  </div>
                </div>

                {/* 5 - IT */}
                <div className="flex-1 space-y-1.5">
                  <NodeBox
                    title="تقنية المعلومات"
                    subtitle="Information Technology"
                    bg="bg-gradient-to-b from-cyan-600 to-cyan-700 border-cyan-500"
                    className="w-full"
                  />
                  <div className="space-y-1">
                    <SectionBox name="الأنظمة والبنية التحتية" tasks={["أنظمة نقاط البيع (POS)", "أنظمة المحاسبة", "إدارة السيرفرات", "حماية البيانات", "دعم الفروع"]} />
                  </div>
                </div>
              </div>

              {/* ═══ LEVEL 4 & 5: الفروع + الدعم ═══ */}
              <div className="mt-5 pt-4 border-t-2 border-slate-200">
                <div className="flex gap-5 justify-center">

                  <div className="w-[340px]">
                    <div className="rounded-lg border-2 border-teal-400 overflow-hidden shadow-sm">
                      <div className="bg-gradient-to-b from-teal-600 to-teal-700 px-4 py-2 text-center">
                        <h3 className="text-[11px] font-bold text-white">هيكل كل فرع</h3>
                        <p className="text-[8px] text-teal-200">Branch Structure</p>
                      </div>
                      <div className="bg-white p-3">
                        {[
                          { role: "مدير فرع", indent: 0, weight: "bold", bg: "bg-teal-700 text-white" },
                          { role: "مساعد مدير فرع", indent: 1, weight: "semibold", bg: "bg-teal-100 text-teal-900" },
                          { role: "مشرف شيفت", indent: 2, weight: "medium", bg: "bg-teal-50 text-teal-800" },
                          { role: "مسؤول مخزون", indent: 3, weight: "normal", bg: "bg-white text-slate-700 border border-slate-200" },
                          { role: "كاشير", indent: 3, weight: "normal", bg: "bg-white text-slate-700 border border-slate-200" },
                          { role: "موظفي إنتاج", indent: 3, weight: "normal", bg: "bg-white text-slate-700 border border-slate-200" },
                          { role: "موظفي خدمة عملاء", indent: 3, weight: "normal", bg: "bg-white text-slate-700 border border-slate-200" },
                          { role: "عمال نظافة", indent: 3, weight: "normal", bg: "bg-white text-slate-700 border border-slate-200" },
                        ].map((item, i, arr) => (
                          <React.Fragment key={i}>
                            <div
                              className={`rounded px-2.5 py-1 ${item.bg} text-[9px] font-${item.weight}`}
                              style={{ marginRight: item.indent * 14 }}
                            >
                              {item.role}
                            </div>
                            {i < arr.length - 1 && (
                              <div className="flex" style={{ marginRight: item.indent * 14 + 10 }}>
                                <div className="w-[2px] h-1.5 bg-teal-200 rounded-full" />
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="w-[260px]">
                    <div className="rounded-lg border-2 border-slate-400 overflow-hidden shadow-sm">
                      <div className="bg-gradient-to-b from-slate-600 to-slate-700 px-4 py-2 text-center">
                        <h3 className="text-[11px] font-bold text-white">الدعم التشغيلي</h3>
                        <p className="text-[8px] text-slate-300">Operational Support</p>
                      </div>
                      <div className="bg-white p-3 grid grid-cols-2 gap-1.5">
                        {["سائقين", "عمال مستودعات", "فني صيانة", "دعم تقني ميداني"].map((r, i) => (
                          <div key={i} className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-center text-[9px] text-slate-700 font-medium">
                            {r}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="w-[260px]">
                    <div className="rounded-lg border-2 border-red-300 overflow-hidden shadow-sm">
                      <div className="bg-gradient-to-b from-red-700 to-red-800 px-4 py-2 text-center">
                        <h3 className="text-[11px] font-bold text-white">فصل الصلاحيات</h3>
                        <p className="text-[8px] text-red-200">Segregation of Duties</p>
                      </div>
                      <div className="bg-white p-2.5 space-y-1">
                        {[
                          "المشتريات منفصلة عن السداد",
                          "التسجيل المحاسبي منفصل عن اعتماد المدفوعات",
                          "الجرد منفصل عن مسؤول المخزون",
                          "الرواتب تعتمد من التنفيذي بعد مراجعة المالية",
                        ].map((s, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-[9px] text-slate-700 bg-red-50 rounded px-2 py-1">
                            <span className="text-green-600 font-bold shrink-0">✓</span>
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="w-[200px]">
                    <div className="rounded-lg border-2 border-violet-300 overflow-hidden shadow-sm">
                      <div className="bg-gradient-to-b from-violet-700 to-violet-800 px-4 py-2 text-center">
                        <h3 className="text-[11px] font-bold text-white">مسار التقارير</h3>
                        <p className="text-[8px] text-violet-200">Reporting Path</p>
                      </div>
                      <div className="bg-white p-2.5">
                        {["مجلس الإدارة", "الرئيس التنفيذي", "مدراء الإدارات", "رؤساء الأقسام", "المشرفين", "الموظفين التشغيليين"].map((l, i, a) => (
                          <React.Fragment key={i}>
                            <div className={`rounded px-2 py-1 text-center text-[9px] font-medium ${
                              i === 0 ? "bg-violet-700 text-white" : i === 1 ? "bg-violet-100 text-violet-800" : "bg-white text-slate-600 border border-violet-100"
                            }`}>
                              {l}
                            </div>
                            {i < a.length - 1 && (
                              <div className="flex justify-center">
                                <div className="w-[2px] h-1.5 bg-violet-200 rounded-full" />
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-200 flex justify-between items-center px-2">
                <p className="text-[8px] text-slate-400">شركة الزبد الأفضل التجارية — الهيكل التنظيمي المعتمد وفقاً لحوكمة الشركات المساهمة</p>
                <p className="text-[8px] text-slate-400">سري وخاص — للاستخدام الداخلي فقط</p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
