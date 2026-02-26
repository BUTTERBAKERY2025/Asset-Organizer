import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowLeft, Printer, Building2 } from "lucide-react";
import React, { useRef } from "react";
import { useReactToPrint } from "react-to-print";

function OrgNode({
  titleAr,
  titleEn,
  items,
  headerBg,
  borderColor,
  width,
  prominent = false,
}: {
  titleAr: string;
  titleEn: string;
  items?: { ar: string; en: string }[];
  headerBg: string;
  borderColor: string;
  width?: number;
  prominent?: boolean;
}) {
  const w = width || 220;
  return (
    <div style={{ width: w, borderRadius: 8, border: `2px solid ${borderColor}`, overflow: "hidden", background: "#fff", boxShadow: prominent ? `0 4px 14px ${borderColor}50` : "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ background: headerBg, padding: prominent ? "10px 14px" : "8px 10px", textAlign: "center" }}>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: prominent ? 13 : 11, lineHeight: 1.5 }}>{titleAr}</div>
        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: prominent ? 9 : 8, marginTop: 1, fontStyle: "italic" }}>{titleEn}</div>
      </div>
      {items && items.length > 0 && (
        <div style={{ padding: "7px 10px" }}>
          {items.map((item, i) => (
            <div key={i} style={{ marginBottom: 3 }}>
              <div style={{ fontSize: 9, color: "#1e293b", fontWeight: 600, lineHeight: 1.5 }}>{item.ar}</div>
              <div style={{ fontSize: 8, color: "#94a3b8", lineHeight: 1.4, fontStyle: "italic" }}>{item.en}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeptSection({ nameAr, nameEn, tasks }: { nameAr: string; nameEn: string; tasks: { ar: string; en: string }[] }) {
  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 5, padding: "5px 8px" }}>
      <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 3, marginBottom: 3 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#1e293b" }}>{nameAr}</div>
        <div style={{ fontSize: 7, color: "#94a3b8", fontStyle: "italic" }}>{nameEn}</div>
      </div>
      {tasks.map((t, i) => (
        <div key={i} style={{ marginBottom: 2 }}>
          <div style={{ fontSize: 8, color: "#334155", lineHeight: 1.4 }}>• {t.ar}</div>
          <div style={{ fontSize: 7, color: "#a1a1aa", lineHeight: 1.3, paddingRight: 10, fontStyle: "italic" }}>{t.en}</div>
        </div>
      ))}
    </div>
  );
}

function VLine({ h = 18 }: { h?: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ width: 2, height: h, background: "#94a3b8", borderRadius: 1 }} />
    </div>
  );
}

function HBranch({ width, drops }: { width: string; drops: number }) {
  return (
    <div style={{ margin: "0 auto", width }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ width: 2, height: 12, background: "#94a3b8", borderRadius: 1 }} />
      </div>
      <div style={{ height: 2, background: "#94a3b8", borderRadius: 1 }} />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {Array.from({ length: drops }).map((_, i) => (
          <div key={i} style={{ width: 2, height: 12, background: "#94a3b8", borderRadius: 1 }} />
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
      @page { size: A3 landscape; margin: 10mm; }
      @media print {
        html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
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
                <p className="text-xs" style={{ color: "#94a3b8" }}>Organizational Structure — شركة الزبد الأفضل التجارية</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => handlePrint()} size="sm" style={{ background: "#b8860b", color: "#fff" }} className="hover:opacity-90" data-testid="btn-print-org">
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
            <div ref={printRef} dir="rtl" style={{ minWidth: 1300, background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "28px 34px", fontFamily: "'Cairo', 'Segoe UI', Tahoma, sans-serif" }}>

              <div style={{ textAlign: "center", marginBottom: 22 }}>
                <div style={{ display: "inline-block", borderBottom: "3px solid #b8860b", paddingBottom: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#1e293b" }}>الهيكل التنظيمي</div>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 2, fontStyle: "italic" }}>Organizational Structure</div>
                  <div style={{ fontSize: 11, color: "#1e293b", marginTop: 4, fontWeight: 600 }}>شركة الزبد الأفضل التجارية</div>
                  <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2, fontStyle: "italic" }}>Best Butter Trading Company — Saudi Corporate Governance Standards</div>
                </div>
              </div>

              {/* الجمعية العامة */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                <OrgNode
                  titleAr="الجمعية العامة للمساهمين"
                  titleEn="General Assembly of Shareholders"
                  headerBg="#92600a"
                  borderColor="#d4a843"
                  width={300}
                  prominent
                  items={[
                    { ar: "اعتماد القوائم المالية السنوية", en: "Approve annual financial statements" },
                    { ar: "تعيين وعزل أعضاء مجلس الإدارة", en: "Appoint and dismiss board members" },
                    { ar: "تعيين مراجع الحسابات الخارجي", en: "Appoint external auditor" },
                    { ar: "اعتماد زيادة / تخفيض رأس المال", en: "Approve capital increase / decrease" },
                    { ar: "إقرار توزيع الأرباح", en: "Approve dividend distribution" },
                  ]}
                />
              </div>

              <VLine />

              {/* مجلس الإدارة */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                <OrgNode
                  titleAr="مجلس الإدارة"
                  titleEn="Board of Directors"
                  headerBg="#1e293b"
                  borderColor="#475569"
                  width={300}
                  prominent
                  items={[
                    { ar: "رسم التوجهات الاستراتيجية", en: "Set strategic direction" },
                    { ar: "اعتماد الخطط والميزانيات السنوية", en: "Approve annual plans and budgets" },
                    { ar: "الرقابة على الأداء التنفيذي", en: "Oversee executive performance" },
                    { ar: "تعيين وتقييم الرئيس التنفيذي", en: "Appoint and evaluate CEO" },
                    { ar: "اعتماد السياسات الجوهرية", en: "Approve key policies and procedures" },
                  ]}
                />
              </div>

              <HBranch width="56%" drops={3} />

              <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
                <OrgNode
                  titleAr="رئيس مجلس الإدارة"
                  titleEn="Chairman of the Board"
                  headerBg="#92600a"
                  borderColor="#d4a843"
                  width={220}
                  items={[
                    { ar: "رئاسة اجتماعات المجلس", en: "Chair board meetings" },
                    { ar: "التوقيع على القرارات الاستراتيجية", en: "Sign strategic resolutions" },
                    { ar: "تمثيل الشركة أمام الجهات الرسمية", en: "Represent company officially" },
                  ]}
                />
                <OrgNode
                  titleAr="لجنة المراجعة"
                  titleEn="Audit Committee"
                  headerBg="#b91c1c"
                  borderColor="#ef4444"
                  width={220}
                  items={[
                    { ar: "مراجعة القوائم المالية", en: "Review financial statements" },
                    { ar: "تقييم نظام الرقابة الداخلية", en: "Assess internal controls" },
                    { ar: "التوصية بتعيين المراجع الخارجي", en: "Recommend external auditor" },
                  ]}
                />
                <OrgNode
                  titleAr="لجنة المكافآت والترشيحات"
                  titleEn="Remuneration & Nomination Committee"
                  headerBg="#6d28d9"
                  borderColor="#8b5cf6"
                  width={220}
                  items={[
                    { ar: "سياسات مكافآت الأعضاء والتنفيذيين", en: "Executive compensation policies" },
                    { ar: "ترشيح أعضاء المجلس الجدد", en: "Nominate new board members" },
                    { ar: "تقييم أداء المجلس والإدارة", en: "Evaluate board & management" },
                  ]}
                />
              </div>

              <VLine />

              {/* CEO */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                <OrgNode
                  titleAr="الرئيس التنفيذي"
                  titleEn="Chief Executive Officer (CEO)"
                  headerBg="#3730a3"
                  borderColor="#6366f1"
                  width={300}
                  prominent
                  items={[
                    { ar: "تنفيذ قرارات مجلس الإدارة", en: "Execute board resolutions" },
                    { ar: "الإشراف على جميع الإدارات", en: "Oversee all departments" },
                    { ar: "اعتماد الميزانيات التشغيلية", en: "Approve operational budgets" },
                    { ar: "اعتماد العقود والمصروفات الرأسمالية", en: "Approve contracts and CAPEX" },
                    { ar: "ضمان الالتزام والحوكمة", en: "Ensure compliance and governance" },
                  ]}
                />
              </div>

              <HBranch width="94%" drops={5} />

              {/* Departments */}
              <div style={{ display: "flex", gap: 10, width: "94%", margin: "0 auto" }}>

                {/* Finance */}
                <div style={{ flex: 1 }}>
                  <OrgNode titleAr="الإدارة المالية" titleEn="Finance & Accounting" headerBg="#047857" borderColor="#34d399" width={undefined as any} />
                  <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                    <DeptSection nameAr="المحاسبة العامة" nameEn="General Accounting" tasks={[
                      { ar: "القيود اليومية", en: "Daily journal entries" },
                      { ar: "ميزان المراجعة", en: "Trial balance" },
                      { ar: "القوائم المالية", en: "Financial statements" },
                      { ar: "مطابقة الحسابات", en: "Account reconciliation" },
                    ]} />
                    <DeptSection nameAr="قسم الموردين" nameEn="Accounts Payable (AP)" tasks={[
                      { ar: "مراجعة الفواتير", en: "Invoice review" },
                      { ar: "مطابقة PO / GRN", en: "PO / GRN matching" },
                      { ar: "جدول أعمار الديون", en: "Aging schedule" },
                      { ar: "إدارة السداد", en: "Payment management" },
                    ]} />
                    <DeptSection nameAr="قسم العملاء" nameEn="Accounts Receivable (AR)" tasks={[
                      { ar: "متابعة التحصيل", en: "Collection follow-up" },
                      { ar: "مطابقة المبيعات", en: "Sales reconciliation" },
                      { ar: "أعمار الذمم", en: "Receivable aging" },
                    ]} />
                    <DeptSection nameAr="الخزينة" nameEn="Treasury" tasks={[
                      { ar: "التدفقات النقدية", en: "Cash flow management" },
                      { ar: "الحسابات البنكية", en: "Bank accounts" },
                      { ar: "تقارير السيولة", en: "Liquidity reports" },
                    ]} />
                    <DeptSection nameAr="الرواتب" nameEn="Payroll" tasks={[
                      { ar: "مسير الرواتب", en: "Payroll processing" },
                      { ar: "الاستقطاعات", en: "Deductions" },
                      { ar: "سداد التأمينات", en: "Insurance payments" },
                    ]} />
                  </div>
                </div>

                {/* Operations */}
                <div style={{ flex: 1 }}>
                  <OrgNode titleAr="إدارة التشغيل" titleEn="Operations" headerBg="#1d4ed8" borderColor="#60a5fa" width={undefined as any} />
                  <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                    <DeptSection nameAr="إدارة الفروع" nameEn="Branch Management" tasks={[
                      { ar: "الأداء اليومي", en: "Daily performance" },
                      { ar: "أهداف المبيعات", en: "Sales targets" },
                      { ar: "ضبط الهدر", en: "Waste control" },
                      { ar: "مراقبة الجودة", en: "Quality control" },
                    ]} />
                    <DeptSection nameAr="إدارة الإنتاج" nameEn="Production Management" tasks={[
                      { ar: "خطوط الإنتاج", en: "Production lines" },
                      { ar: "مراقبة المواد الخام", en: "Raw material monitoring" },
                      { ar: "الالتزام بالوصفات", en: "Recipe compliance" },
                      { ar: "الكفاءة التشغيلية", en: "Operational efficiency" },
                    ]} />
                    <DeptSection nameAr="إدارة الجودة" nameEn="Quality Assurance" tasks={[
                      { ar: "فحص المنتجات", en: "Product inspection" },
                      { ar: "الالتزام الصحي", en: "Health compliance" },
                      { ar: "تقارير الامتثال", en: "Compliance reports" },
                    ]} />
                    <DeptSection nameAr="التخطيط والتوريد الداخلي" nameEn="Planning & Internal Supply" tasks={[
                      { ar: "تخطيط الاحتياجات", en: "Requirements planning" },
                      { ar: "طلبات الفروع", en: "Branch orders" },
                      { ar: "مراقبة الاستهلاك", en: "Consumption monitoring" },
                    ]} />
                  </div>
                </div>

                {/* Procurement */}
                <div style={{ flex: 1 }}>
                  <OrgNode titleAr="المشتريات وسلسلة الإمداد" titleEn="Procurement & Supply Chain" headerBg="#c2410c" borderColor="#fb923c" width={undefined as any} />
                  <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                    <DeptSection nameAr="قسم المشتريات" nameEn="Purchasing" tasks={[
                      { ar: "إدارة الموردين", en: "Supplier management" },
                      { ar: "التفاوض على الأسعار", en: "Price negotiation" },
                      { ar: "أوامر الشراء", en: "Purchase orders" },
                      { ar: "تقييم الموردين", en: "Supplier evaluation" },
                    ]} />
                    <DeptSection nameAr="المستودع المركزي" nameEn="Central Warehouse" tasks={[
                      { ar: "استلام المواد", en: "Material receiving" },
                      { ar: "التخزين", en: "Storage" },
                      { ar: "الجرد الدوري", en: "Periodic inventory" },
                      { ar: "التوزيع للفروع", en: "Branch distribution" },
                    ]} />
                    <DeptSection nameAr="المستودعات التشغيلية" nameEn="Branch Warehouses" tasks={[
                      { ar: "مخزون الفرع", en: "Branch inventory" },
                      { ar: "الجرد اليومي", en: "Daily count" },
                      { ar: "تقارير الفروقات", en: "Variance reports" },
                    ]} />
                  </div>
                </div>

                {/* HR */}
                <div style={{ flex: 1 }}>
                  <OrgNode titleAr="الموارد البشرية" titleEn="Human Resources" headerBg="#7c3aed" borderColor="#a78bfa" width={undefined as any} />
                  <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                    <DeptSection nameAr="التوظيف" nameEn="Recruitment" tasks={[
                      { ar: "استقطاب الموظفين", en: "Talent acquisition" },
                      { ar: "المقابلات", en: "Interviews" },
                      { ar: "إصدار العقود", en: "Contract issuance" },
                    ]} />
                    <DeptSection nameAr="شؤون الموظفين" nameEn="Personnel Affairs" tasks={[
                      { ar: "ملفات الموظفين", en: "Employee files" },
                      { ar: "الإجازات", en: "Leave management" },
                      { ar: "المخالصات", en: "Final settlements" },
                    ]} />
                    <DeptSection nameAr="الحضور والانصراف" nameEn="Attendance & Time" tasks={[
                      { ar: "متابعة الدوام", en: "Attendance tracking" },
                      { ar: "تقارير التأخير", en: "Tardiness reports" },
                      { ar: "إدارة الإضافي", en: "Overtime management" },
                    ]} />
                    <DeptSection nameAr="الامتثال والتأمينات" nameEn="Compliance & Insurance" tasks={[
                      { ar: "تسجيل GOSI", en: "GOSI registration" },
                      { ar: "التأمين الطبي", en: "Medical insurance" },
                      { ar: "الالتزام بنظام العمل", en: "Labor law compliance" },
                    ]} />
                  </div>
                </div>

                {/* IT */}
                <div style={{ flex: 1 }}>
                  <OrgNode titleAr="تقنية المعلومات" titleEn="Information Technology" headerBg="#0e7490" borderColor="#22d3ee" width={undefined as any} />
                  <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                    <DeptSection nameAr="الأنظمة والبنية التحتية" nameEn="Systems & Infrastructure" tasks={[
                      { ar: "أنظمة نقاط البيع POS", en: "POS systems" },
                      { ar: "أنظمة المحاسبة", en: "Accounting systems" },
                      { ar: "إدارة السيرفرات", en: "Server management" },
                      { ar: "حماية البيانات", en: "Data protection" },
                      { ar: "الدعم الفني للفروع", en: "Branch IT support" },
                    ]} />
                  </div>
                </div>
              </div>

              {/* Bottom row */}
              <div style={{ marginTop: 22, paddingTop: 16, borderTop: "2px solid #e2e8f0", display: "flex", gap: 12, justifyContent: "center" }}>

                {/* Branch Structure */}
                <div style={{ width: 260, border: "2px solid #2dd4bf", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                  <div style={{ background: "#0d9488", padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>هيكل كل فرع</div>
                    <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 8, fontStyle: "italic" }}>Branch Structure</div>
                  </div>
                  <div style={{ padding: 10 }}>
                    {[
                      { ar: "مدير الفرع", en: "Branch Manager", bg: "#0d9488", color: "#fff", mr: 0, bold: true },
                      { ar: "مساعد مدير الفرع", en: "Asst. Branch Manager", bg: "#ccfbf1", color: "#134e4a", mr: 10, bold: true },
                      { ar: "مشرف الشيفت", en: "Shift Supervisor", bg: "#f0fdfa", color: "#115e59", mr: 20, bold: false },
                      { ar: "مسؤول المخزون", en: "Inventory Officer", bg: "#f8fafc", color: "#475569", mr: 30, bold: false },
                      { ar: "الكاشير", en: "Cashier", bg: "#f8fafc", color: "#475569", mr: 30, bold: false },
                      { ar: "موظفو الإنتاج", en: "Production Staff", bg: "#f8fafc", color: "#475569", mr: 30, bold: false },
                      { ar: "موظفو خدمة العملاء", en: "Customer Service", bg: "#f8fafc", color: "#475569", mr: 30, bold: false },
                      { ar: "عمال النظافة", en: "Cleaning Staff", bg: "#f8fafc", color: "#475569", mr: 30, bold: false },
                    ].map((item, i, arr) => (
                      <React.Fragment key={i}>
                        <div style={{ background: item.bg, color: item.color, borderRadius: 4, padding: "3px 8px", marginRight: item.mr, border: i >= 3 ? "1px solid #e2e8f0" : "none" }}>
                          <div style={{ fontSize: 9, fontWeight: item.bold ? 700 : 500 }}>{item.ar}</div>
                          <div style={{ fontSize: 7, opacity: i === 0 ? 0.8 : 0.6, fontStyle: "italic" }}>{item.en}</div>
                        </div>
                        {i < arr.length - 1 && <div style={{ marginRight: item.mr + 8, height: 4 }}><div style={{ width: 2, height: "100%", background: "#99f6e4", borderRadius: 1 }} /></div>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Operational Support */}
                <div style={{ width: 210, border: "2px solid #94a3b8", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                  <div style={{ background: "#475569", padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>الدعم التشغيلي</div>
                    <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 8, fontStyle: "italic" }}>Operational Support</div>
                  </div>
                  <div style={{ padding: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                    {[
                      { ar: "سائقين", en: "Drivers" },
                      { ar: "عمال مستودعات", en: "Warehouse Workers" },
                      { ar: "فني صيانة", en: "Maintenance Tech." },
                      { ar: "دعم تقني ميداني", en: "Field IT Support" },
                    ].map((r, i) => (
                      <div key={i} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 4, padding: "5px 6px", textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: "#334155", fontWeight: 600 }}>{r.ar}</div>
                        <div style={{ fontSize: 7, color: "#94a3b8", fontStyle: "italic" }}>{r.en}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Segregation of Duties */}
                <div style={{ width: 260, border: "2px solid #f87171", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                  <div style={{ background: "#b91c1c", padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>فصل الصلاحيات</div>
                    <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 8, fontStyle: "italic" }}>Segregation of Duties</div>
                  </div>
                  <div style={{ padding: 8 }}>
                    {[
                      { ar: "المشتريات منفصلة عن السداد", en: "Purchasing is separated from payments" },
                      { ar: "التسجيل المحاسبي منفصل عن اعتماد المدفوعات", en: "Accounting is separated from payment approval" },
                      { ar: "الجرد منفصل عن مسؤول المخزون", en: "Inventory count is separated from stock keeper" },
                      { ar: "الرواتب تُعتمد من التنفيذي بعد مراجعة المالية", en: "Payroll approved by CEO after finance review" },
                    ].map((s, i) => (
                      <div key={i} style={{ background: "#fef2f2", borderRadius: 4, padding: "4px 8px", marginBottom: 3 }}>
                        <div style={{ fontSize: 9, color: "#1e293b", fontWeight: 600, display: "flex", gap: 5, alignItems: "flex-start" }}>
                          <span style={{ color: "#16a34a", fontWeight: 700, flexShrink: 0 }}>✓</span>
                          <span>{s.ar}</span>
                        </div>
                        <div style={{ fontSize: 7, color: "#94a3b8", paddingRight: 16, fontStyle: "italic" }}>{s.en}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reporting Path */}
                <div style={{ width: 190, border: "2px solid #a78bfa", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                  <div style={{ background: "#6d28d9", padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>مسار التقارير</div>
                    <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 8, fontStyle: "italic" }}>Reporting Path</div>
                  </div>
                  <div style={{ padding: 8 }}>
                    {[
                      { ar: "مجلس الإدارة", en: "Board of Directors", bg: "#6d28d9", color: "#fff" },
                      { ar: "الرئيس التنفيذي", en: "CEO", bg: "#ede9fe", color: "#4c1d95" },
                      { ar: "مدراء الإدارات", en: "Department Heads", bg: "#fff", color: "#475569" },
                      { ar: "رؤساء الأقسام", en: "Section Managers", bg: "#fff", color: "#475569" },
                      { ar: "المشرفين", en: "Supervisors", bg: "#fff", color: "#475569" },
                      { ar: "الموظفين التشغيليين", en: "Operational Staff", bg: "#fff", color: "#475569" },
                    ].map((l, i, a) => (
                      <React.Fragment key={i}>
                        <div style={{ borderRadius: 4, padding: "3px 8px", textAlign: "center", background: l.bg, color: l.color, border: i > 1 ? "1px solid #ede9fe" : "none" }}>
                          <div style={{ fontSize: 9, fontWeight: 600 }}>{l.ar}</div>
                          <div style={{ fontSize: 7, opacity: 0.7, fontStyle: "italic" }}>{l.en}</div>
                        </div>
                        {i < a.length - 1 && <div style={{ display: "flex", justifyContent: "center", height: 4 }}><div style={{ width: 2, height: "100%", background: "#c4b5fd", borderRadius: 1 }} /></div>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 18, paddingTop: 8, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: 8, color: "#94a3b8" }}>شركة الزبد الأفضل التجارية — الهيكل التنظيمي المعتمد وفقاً لمعايير حوكمة الشركات المساهمة</span>
                  <br />
                  <span style={{ fontSize: 7, color: "#cbd5e1", fontStyle: "italic" }}>Best Butter Trading Co. — Approved Organizational Structure per Saudi Corporate Governance Standards</span>
                </div>
                <div style={{ textAlign: "left" }}>
                  <span style={{ fontSize: 8, color: "#94a3b8" }}>سري وخاص — للاستخدام الداخلي فقط</span>
                  <br />
                  <span style={{ fontSize: 7, color: "#cbd5e1", fontStyle: "italic" }}>Confidential — Internal Use Only</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
