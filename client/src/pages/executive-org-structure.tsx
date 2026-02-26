import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowLeft, Printer, Building2 } from "lucide-react";
import React, { useRef } from "react";
import { useReactToPrint } from "react-to-print";

const COLORS = {
  gold: { header: "#92600a", headerBg: "#f5e6c8", border: "#d4a843", accent: "#b8860b" },
  dark: { header: "#1e293b", headerBg: "#334155", border: "#475569", accent: "#64748b" },
  indigo: { header: "#312e81", headerBg: "#4338ca", border: "#6366f1", accent: "#818cf8" },
  emerald: { header: "#064e3b", headerBg: "#059669", border: "#34d399", accent: "#6ee7b7" },
  blue: { header: "#1e3a5f", headerBg: "#2563eb", border: "#60a5fa", accent: "#93c5fd" },
  orange: { header: "#7c2d12", headerBg: "#ea580c", border: "#fb923c", accent: "#fdba74" },
  purple: { header: "#4c1d95", headerBg: "#7c3aed", border: "#a78bfa", accent: "#c4b5fd" },
  cyan: { header: "#164e63", headerBg: "#0891b2", border: "#22d3ee", accent: "#67e8f9" },
  teal: { header: "#134e4a", headerBg: "#0d9488", border: "#2dd4bf", accent: "#5eead4" },
  red: { header: "#7f1d1d", headerBg: "#dc2626", border: "#f87171", accent: "#fca5a5" },
  violet: { header: "#4c1d95", headerBg: "#7c3aed", border: "#a78bfa", accent: "#c4b5fd" },
  slate: { header: "#334155", headerBg: "#64748b", border: "#94a3b8", accent: "#cbd5e1" },
};

function OrgNode({
  title,
  subtitle,
  items,
  color,
  width,
  prominent = false,
}: {
  title: string;
  subtitle?: string;
  items?: string[];
  color: keyof typeof COLORS;
  width?: number;
  prominent?: boolean;
}) {
  const c = COLORS[color];
  const w = width || 220;
  return (
    <div
      style={{
        width: w,
        borderRadius: 8,
        border: `2px solid ${c.border}`,
        overflow: "hidden",
        background: "#fff",
        boxShadow: prominent ? `0 4px 16px ${c.border}40` : "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      <div
        style={{
          background: c.headerBg,
          padding: prominent ? "10px 12px" : "7px 10px",
          textAlign: "center",
        }}
      >
        <div style={{ color: "#fff", fontWeight: 700, fontSize: prominent ? 13 : 11, lineHeight: 1.4 }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 8, marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      {items && items.length > 0 && (
        <div style={{ padding: "6px 10px" }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 5, fontSize: 9, color: "#475569", lineHeight: 1.5, alignItems: "flex-start" }}>
              <span style={{ color: c.border, flexShrink: 0, marginTop: 1 }}>●</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeptSection({ name, tasks }: { name: string; tasks: string[] }) {
  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 5, padding: "5px 8px" }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#334155", marginBottom: 2, borderBottom: "1px solid #e2e8f0", paddingBottom: 2 }}>
        {name}
      </div>
      {tasks.map((t, i) => (
        <div key={i} style={{ fontSize: 8, color: "#64748b", lineHeight: 1.5, display: "flex", gap: 4, alignItems: "flex-start" }}>
          <span style={{ color: "#cbd5e1", flexShrink: 0 }}>–</span>
          <span>{t}</span>
        </div>
      ))}
    </div>
  );
}

function Connector({ vertical = 20 }: { vertical?: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ width: 2, height: vertical, background: "#94a3b8", borderRadius: 1 }} />
    </div>
  );
}

function HorizontalBranch({ width, drops }: { width: string; drops: number }) {
  return (
    <div style={{ margin: "0 auto", width }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ width: 2, height: 14, background: "#94a3b8", borderRadius: 1 }} />
      </div>
      <div style={{ height: 2, background: "#94a3b8", borderRadius: 1 }} />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {Array.from({ length: drops }).map((_, i) => (
          <div key={i} style={{ width: 2, height: 14, background: "#94a3b8", borderRadius: 1 }} />
        ))}
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
      @page { 
        size: A3 landscape; 
        margin: 12mm; 
      }
      @media print {
        html, body { 
          -webkit-print-color-adjust: exact !important; 
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        * { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif !important; }
      }
    `,
  });

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6" dir="rtl">
        <div className="max-w-full mx-auto space-y-4">

          <div className="flex items-center justify-between rounded-lg px-4 py-3 print:hidden" style={{ background: "#1e293b" }}>
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6" style={{ color: "#d4a843" }} />
              <div>
                <h1 className="text-lg font-bold text-white">الهيكل التنظيمي</h1>
                <p className="text-xs" style={{ color: "#94a3b8" }}>شركة الزبد الأفضل التجارية</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => handlePrint()}
                size="sm"
                style={{ background: "#b8860b", color: "#fff" }}
                className="hover:opacity-90"
                data-testid="btn-print-org"
              >
                <Printer className="h-4 w-4 ml-1.5" />
                طباعة / تصدير PDF
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
              dir="rtl"
              style={{
                minWidth: 1250,
                background: "#ffffff",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                padding: "30px 36px",
                fontFamily: "'Cairo', 'Segoe UI', Tahoma, sans-serif",
              }}
            >

              {/* Header */}
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ display: "inline-block", borderBottom: "3px solid #b8860b", paddingBottom: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#1e293b", letterSpacing: 1 }}>الهيكل التنظيمي</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>شركة الزبد الأفضل التجارية</div>
                  <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>وفقاً لمعايير حوكمة الشركات المساهمة — نظام الشركات السعودي</div>
                </div>
              </div>

              {/* LEVEL 0: الجمعية العامة */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                <OrgNode
                  title="الجمعية العامة للمساهمين"
                  subtitle="General Assembly of Shareholders"
                  color="gold"
                  width={280}
                  prominent
                  items={[
                    "اعتماد القوائم المالية السنوية",
                    "تعيين وعزل أعضاء مجلس الإدارة",
                    "تعيين مراجع الحسابات الخارجي",
                    "اعتماد زيادة / تخفيض رأس المال",
                    "إقرار توزيع الأرباح",
                  ]}
                />
              </div>

              <Connector vertical={18} />

              {/* LEVEL 1: مجلس الإدارة */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                <OrgNode
                  title="مجلس الإدارة"
                  subtitle="Board of Directors"
                  color="dark"
                  width={280}
                  prominent
                  items={[
                    "رسم التوجهات الاستراتيجية",
                    "اعتماد الخطط والميزانيات السنوية",
                    "الرقابة على الأداء التنفيذي",
                    "تعيين وتقييم الرئيس التنفيذي",
                    "اعتماد السياسات والإجراءات الجوهرية",
                  ]}
                />
              </div>

              {/* Board sub-entities */}
              <HorizontalBranch width="58%" drops={3} />

              <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
                <OrgNode
                  title="رئيس مجلس الإدارة"
                  subtitle="Chairman of the Board"
                  color="gold"
                  width={210}
                  items={[
                    "رئاسة اجتماعات المجلس",
                    "التوقيع على القرارات الاستراتيجية",
                    "تمثيل الشركة أمام الجهات الرسمية",
                  ]}
                />
                <OrgNode
                  title="لجنة المراجعة"
                  subtitle="Audit Committee"
                  color="red"
                  width={210}
                  items={[
                    "مراجعة القوائم المالية",
                    "تقييم نظام الرقابة الداخلية",
                    "التوصية بتعيين المراجع الخارجي",
                  ]}
                />
                <OrgNode
                  title="لجنة المكافآت والترشيحات"
                  subtitle="Remuneration & Nomination Committee"
                  color="violet"
                  width={210}
                  items={[
                    "سياسات مكافآت الأعضاء والتنفيذيين",
                    "ترشيح أعضاء المجلس الجدد",
                    "تقييم أداء المجلس والإدارة",
                  ]}
                />
              </div>

              {/* LEVEL 2: CEO */}
              <Connector vertical={18} />
              <div style={{ display: "flex", justifyContent: "center" }}>
                <OrgNode
                  title="الرئيس التنفيذي"
                  subtitle="Chief Executive Officer (CEO)"
                  color="indigo"
                  width={280}
                  prominent
                  items={[
                    "تنفيذ قرارات مجلس الإدارة",
                    "الإشراف على جميع الإدارات التنفيذية",
                    "اعتماد الميزانيات التشغيلية",
                    "اعتماد العقود والمصروفات الرأسمالية",
                    "ضمان الالتزام والحوكمة",
                  ]}
                />
              </div>

              {/* LEVEL 3: Departments */}
              <HorizontalBranch width="94%" drops={5} />

              <div style={{ display: "flex", gap: 10, width: "94%", margin: "0 auto" }}>

                {/* Finance */}
                <div style={{ flex: 1 }}>
                  <OrgNode title="الإدارة المالية" subtitle="Finance & Accounting" color="emerald" width={undefined as any} />
                  <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                    <DeptSection name="المحاسبة العامة" tasks={["القيود اليومية", "ميزان المراجعة", "القوائم المالية", "مطابقة الحسابات"]} />
                    <DeptSection name="قسم الموردين (AP)" tasks={["مراجعة الفواتير", "مطابقة PO/GRN", "جدول أعمار الديون", "إدارة السداد"]} />
                    <DeptSection name="قسم العملاء (AR)" tasks={["متابعة التحصيل", "مطابقة المبيعات", "أعمار الذمم"]} />
                    <DeptSection name="الخزينة (Treasury)" tasks={["التدفقات النقدية", "الحسابات البنكية", "تقارير السيولة"]} />
                    <DeptSection name="الرواتب (Payroll)" tasks={["مسير الرواتب", "الاستقطاعات", "سداد التأمينات"]} />
                  </div>
                </div>

                {/* Operations */}
                <div style={{ flex: 1 }}>
                  <OrgNode title="إدارة التشغيل" subtitle="Operations" color="blue" width={undefined as any} />
                  <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                    <DeptSection name="إدارة الفروع" tasks={["الأداء اليومي", "أهداف المبيعات", "ضبط الهدر", "مراقبة الجودة"]} />
                    <DeptSection name="إدارة الإنتاج" tasks={["خطوط الإنتاج", "المواد الخام", "الالتزام بالوصفات", "الكفاءة التشغيلية"]} />
                    <DeptSection name="إدارة الجودة" tasks={["فحص المنتجات", "الالتزام الصحي", "تقارير الامتثال"]} />
                    <DeptSection name="التخطيط والتوريد الداخلي" tasks={["تخطيط الاحتياجات", "طلبات الفروع", "مراقبة الاستهلاك"]} />
                  </div>
                </div>

                {/* Procurement */}
                <div style={{ flex: 1 }}>
                  <OrgNode title="المشتريات وسلسلة الإمداد" subtitle="Procurement & Supply Chain" color="orange" width={undefined as any} />
                  <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                    <DeptSection name="قسم المشتريات" tasks={["إدارة الموردين", "التفاوض على الأسعار", "أوامر الشراء", "تقييم الموردين"]} />
                    <DeptSection name="المستودع المركزي" tasks={["استلام المواد", "التخزين", "الجرد الدوري", "التوزيع للفروع"]} />
                    <DeptSection name="المستودعات التشغيلية" tasks={["مخزون الفرع", "الجرد اليومي", "تقارير الفروقات"]} />
                  </div>
                </div>

                {/* HR */}
                <div style={{ flex: 1 }}>
                  <OrgNode title="الموارد البشرية" subtitle="Human Resources" color="purple" width={undefined as any} />
                  <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                    <DeptSection name="التوظيف" tasks={["استقطاب الموظفين", "المقابلات", "إصدار العقود"]} />
                    <DeptSection name="شؤون الموظفين" tasks={["ملفات الموظفين", "الإجازات", "المخالصات"]} />
                    <DeptSection name="الحضور والانصراف" tasks={["متابعة الدوام", "تقارير التأخير", "إدارة الإضافي"]} />
                    <DeptSection name="الامتثال والتأمينات" tasks={["تسجيل GOSI", "التأمين الطبي", "الالتزام بنظام العمل"]} />
                  </div>
                </div>

                {/* IT */}
                <div style={{ flex: 1 }}>
                  <OrgNode title="تقنية المعلومات" subtitle="Information Technology" color="cyan" width={undefined as any} />
                  <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                    <DeptSection name="الأنظمة والبنية التحتية" tasks={["أنظمة نقاط البيع POS", "أنظمة المحاسبة", "إدارة السيرفرات", "حماية البيانات", "الدعم الفني للفروع"]} />
                  </div>
                </div>
              </div>

              {/* Bottom section */}
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "2px solid #e2e8f0", display: "flex", gap: 14, justifyContent: "center" }}>

                {/* Branch */}
                <div style={{ width: 280, border: "2px solid #2dd4bf", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                  <div style={{ background: "#0d9488", padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>هيكل كل فرع</div>
                    <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 8 }}>Branch Structure</div>
                  </div>
                  <div style={{ padding: 10 }}>
                    {[
                      { role: "مدير الفرع", bg: "#0d9488", color: "#fff", mr: 0 },
                      { role: "مساعد مدير الفرع", bg: "#ccfbf1", color: "#134e4a", mr: 12 },
                      { role: "مشرف الشيفت", bg: "#f0fdfa", color: "#115e59", mr: 24 },
                      { role: "مسؤول المخزون", bg: "#f8fafc", color: "#475569", mr: 36 },
                      { role: "الكاشير", bg: "#f8fafc", color: "#475569", mr: 36 },
                      { role: "موظفو الإنتاج", bg: "#f8fafc", color: "#475569", mr: 36 },
                      { role: "موظفو خدمة العملاء", bg: "#f8fafc", color: "#475569", mr: 36 },
                      { role: "عمال النظافة", bg: "#f8fafc", color: "#475569", mr: 36 },
                    ].map((item, i, arr) => (
                      <React.Fragment key={i}>
                        <div style={{
                          background: item.bg, color: item.color, borderRadius: 4, padding: "3px 8px",
                          fontSize: 9, fontWeight: i < 3 ? 700 : 500, marginRight: item.mr,
                          border: i >= 3 ? "1px solid #e2e8f0" : "none",
                        }}>
                          {item.role}
                        </div>
                        {i < arr.length - 1 && (
                          <div style={{ marginRight: item.mr + 8, height: 6, display: "flex" }}>
                            <div style={{ width: 2, height: "100%", background: "#99f6e4", borderRadius: 1 }} />
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Support */}
                <div style={{ width: 220, border: "2px solid #94a3b8", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                  <div style={{ background: "#64748b", padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>الدعم التشغيلي</div>
                    <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 8 }}>Operational Support</div>
                  </div>
                  <div style={{ padding: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                    {["سائقين", "عمال مستودعات", "فني صيانة", "دعم تقني ميداني"].map((r, i) => (
                      <div key={i} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 4, padding: "5px 6px", textAlign: "center", fontSize: 9, color: "#475569", fontWeight: 600 }}>
                        {r}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Segregation */}
                <div style={{ width: 250, border: "2px solid #f87171", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                  <div style={{ background: "#dc2626", padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>فصل الصلاحيات</div>
                    <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 8 }}>Segregation of Duties</div>
                  </div>
                  <div style={{ padding: 8 }}>
                    {[
                      "المشتريات منفصلة عن السداد",
                      "التسجيل المحاسبي منفصل عن اعتماد المدفوعات",
                      "الجرد منفصل عن مسؤول المخزون",
                      "الرواتب تُعتمد من التنفيذي بعد مراجعة المالية",
                    ].map((s, i) => (
                      <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", background: "#fef2f2", borderRadius: 4, padding: "4px 8px", marginBottom: 3, fontSize: 9, color: "#475569" }}>
                        <span style={{ color: "#16a34a", fontWeight: 700, flexShrink: 0, fontSize: 10 }}>✓</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reporting */}
                <div style={{ width: 180, border: "2px solid #a78bfa", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                  <div style={{ background: "#7c3aed", padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>مسار التقارير</div>
                    <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 8 }}>Reporting Path</div>
                  </div>
                  <div style={{ padding: 8 }}>
                    {["مجلس الإدارة", "الرئيس التنفيذي", "مدراء الإدارات", "رؤساء الأقسام", "المشرفين", "الموظفين التشغيليين"].map((l, i, a) => (
                      <React.Fragment key={i}>
                        <div style={{
                          borderRadius: 4, padding: "3px 8px", textAlign: "center", fontSize: 9, fontWeight: 600,
                          background: i === 0 ? "#7c3aed" : i === 1 ? "#ede9fe" : "#fff",
                          color: i === 0 ? "#fff" : i === 1 ? "#5b21b6" : "#64748b",
                          border: i > 1 ? "1px solid #e9e5ff" : "none",
                        }}>
                          {l}
                        </div>
                        {i < a.length - 1 && (
                          <div style={{ display: "flex", justifyContent: "center", height: 5 }}>
                            <div style={{ width: 2, height: "100%", background: "#c4b5fd", borderRadius: 1 }} />
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ marginTop: 20, paddingTop: 10, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 8, color: "#94a3b8" }}>شركة الزبد الأفضل التجارية — الهيكل التنظيمي المعتمد وفقاً لمعايير حوكمة الشركات المساهمة</span>
                <span style={{ fontSize: 8, color: "#94a3b8" }}>سري وخاص — للاستخدام الداخلي فقط</span>
              </div>

            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
