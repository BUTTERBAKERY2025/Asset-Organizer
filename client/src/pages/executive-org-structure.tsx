import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowLeft, Printer, Building2 } from "lucide-react";
import React, { useRef } from "react";

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
  width?: number | string;
  prominent?: boolean;
}) {
  return (
    <div style={{ width: width || 200, borderRadius: 6, border: `1.5px solid ${borderColor}`, overflow: "hidden", background: "#fff", boxShadow: prominent ? `0 2px 8px ${borderColor}40` : "0 1px 2px rgba(0,0,0,0.05)" }}>
      <div style={{ background: headerBg, padding: prominent ? "6px 10px" : "4px 8px", textAlign: "center" }}>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: prominent ? 11 : 9, lineHeight: 1.4 }}>{titleAr}</div>
        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: prominent ? 7.5 : 6.5, fontStyle: "italic" }}>{titleEn}</div>
      </div>
      {items && items.length > 0 && (
        <div style={{ padding: "4px 7px" }}>
          {items.map((item, i) => (
            <div key={i} style={{ marginBottom: 1 }}>
              <div style={{ fontSize: 7.5, color: "#1e293b", fontWeight: 600, lineHeight: 1.3 }}>{item.ar}</div>
              <div style={{ fontSize: 6.5, color: "#94a3b8", lineHeight: 1.2, fontStyle: "italic" }}>{item.en}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeptSection({ nameAr, nameEn, tasks }: { nameAr: string; nameEn: string; tasks: { ar: string; en: string }[] }) {
  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4, padding: "3px 6px" }}>
      <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 2, marginBottom: 2 }}>
        <div style={{ fontSize: 7.5, fontWeight: 700, color: "#1e293b" }}>{nameAr}</div>
        <div style={{ fontSize: 6, color: "#94a3b8", fontStyle: "italic" }}>{nameEn}</div>
      </div>
      {tasks.map((t, i) => (
        <div key={i} style={{ marginBottom: 1 }}>
          <div style={{ fontSize: 7, color: "#334155", lineHeight: 1.3 }}>• {t.ar} <span style={{ fontSize: 6, color: "#a1a1aa", fontStyle: "italic" }}>({t.en})</span></div>
        </div>
      ))}
    </div>
  );
}

function VLine({ h = 10 }: { h?: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ width: 1.5, height: h, background: "#94a3b8", borderRadius: 1 }} />
    </div>
  );
}

function HBranch({ width, drops }: { width: string; drops: number }) {
  return (
    <div style={{ margin: "0 auto", width }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ width: 1.5, height: 8, background: "#94a3b8", borderRadius: 1 }} />
      </div>
      <div style={{ height: 1.5, background: "#94a3b8", borderRadius: 1 }} />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {Array.from({ length: drops }).map((_, i) => (
          <div key={i} style={{ width: 1.5, height: 8, background: "#94a3b8", borderRadius: 1 }} />
        ))}
      </div>
    </div>
  );
}

export default function ExecutiveOrgStructure() {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const content = el.innerHTML;
    printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>الهيكل التنظيمي - شركة الزبد الأفضل التجارية</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
@page { size: landscape; margin: 5mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 100%; height: 100%;
  font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  color-adjust: exact !important;
}
.print-root {
  width: 287mm;
  transform-origin: top right;
  padding: 4mm;
}
</style>
</head>
<body>
<div class="print-root">${content}</div>
<script>
  window.onload = function() {
    var root = document.querySelector('.print-root');
    var pageW = 287;
    var contentW = root.scrollWidth * 0.264583;
    if (contentW > pageW) {
      var scale = pageW / contentW;
      root.style.transform = 'scale(' + scale + ')';
      root.style.width = (100 / scale) + '%';
    }
    setTimeout(function(){ window.print(); window.close(); }, 500);
  };
</script>
</body></html>`);
    printWindow.document.close();
  };

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6" dir="rtl">
        <div className="max-w-full mx-auto space-y-4">

          <div className="flex items-center justify-between rounded-lg px-4 py-3 no-print" style={{ background: "#1e293b" }}>
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
            <div ref={printRef} dir="rtl" className="print-container" style={{ minWidth: 1100, background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "14px 18px", fontFamily: "'Cairo', 'Segoe UI', Tahoma, sans-serif" }}>

              <div style={{ textAlign: "center", marginBottom: 10 }}>
                <div style={{ display: "inline-block", borderBottom: "2px solid #b8860b", paddingBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>الهيكل التنظيمي</div>
                  <div style={{ fontSize: 10, color: "#64748b", fontStyle: "italic" }}>Organizational Structure</div>
                  <div style={{ fontSize: 9, color: "#1e293b", marginTop: 2, fontWeight: 600 }}>شركة الزبد الأفضل التجارية</div>
                  <div style={{ fontSize: 7, color: "#94a3b8", fontStyle: "italic" }}>Best Butter Trading Company — Saudi Corporate Governance Standards</div>
                </div>
              </div>

              {/* الجمعية العامة */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                <OrgNode
                  titleAr="الجمعية العامة للمساهمين"
                  titleEn="General Assembly of Shareholders"
                  headerBg="#92600a"
                  borderColor="#d4a843"
                  width={240}
                  prominent
                  items={[
                    { ar: "اعتماد القوائم المالية السنوية", en: "Approve annual financial statements" },
                    { ar: "تعيين وعزل أعضاء مجلس الإدارة", en: "Appoint and dismiss board members" },
                    { ar: "تعيين مراجع الحسابات الخارجي", en: "Appoint external auditor" },
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
                  width={240}
                  prominent
                  items={[
                    { ar: "رسم التوجهات الاستراتيجية", en: "Set strategic direction" },
                    { ar: "اعتماد الخطط والميزانيات السنوية", en: "Approve annual plans and budgets" },
                    { ar: "الرقابة على الأداء التنفيذي", en: "Oversee executive performance" },
                    { ar: "تعيين وتقييم الرئيس التنفيذي", en: "Appoint and evaluate CEO" },
                  ]}
                />
              </div>

              <HBranch width="50%" drops={3} />

              <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
                <OrgNode
                  titleAr="رئيس مجلس الإدارة"
                  titleEn="Chairman of the Board"
                  headerBg="#92600a"
                  borderColor="#d4a843"
                  width={185}
                  items={[
                    { ar: "رئاسة اجتماعات المجلس", en: "Chair board meetings" },
                    { ar: "التوقيع على القرارات الاستراتيجية", en: "Sign strategic resolutions" },
                    { ar: "تمثيل الشركة رسمياً", en: "Represent company officially" },
                  ]}
                />
                <OrgNode
                  titleAr="لجنة المراجعة"
                  titleEn="Audit Committee"
                  headerBg="#b91c1c"
                  borderColor="#ef4444"
                  width={185}
                  items={[
                    { ar: "مراجعة القوائم المالية", en: "Review financial statements" },
                    { ar: "تقييم الرقابة الداخلية", en: "Assess internal controls" },
                    { ar: "التوصية بتعيين المراجع", en: "Recommend external auditor" },
                  ]}
                />
                <OrgNode
                  titleAr="لجنة المكافآت والترشيحات"
                  titleEn="Remuneration & Nomination"
                  headerBg="#6d28d9"
                  borderColor="#8b5cf6"
                  width={185}
                  items={[
                    { ar: "سياسات مكافآت التنفيذيين", en: "Executive compensation" },
                    { ar: "ترشيح أعضاء المجلس", en: "Nominate board members" },
                    { ar: "تقييم أداء المجلس", en: "Evaluate board performance" },
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
                  width={240}
                  prominent
                  items={[
                    { ar: "تنفيذ قرارات مجلس الإدارة", en: "Execute board resolutions" },
                    { ar: "الإشراف على جميع الإدارات", en: "Oversee all departments" },
                    { ar: "اعتماد الميزانيات التشغيلية", en: "Approve operational budgets" },
                    { ar: "ضمان الالتزام والحوكمة", en: "Ensure compliance and governance" },
                  ]}
                />
              </div>

              <HBranch width="94%" drops={5} />

              {/* Departments */}
              <div style={{ display: "flex", gap: 6, width: "96%", margin: "0 auto" }}>

                {/* Finance */}
                <div style={{ flex: 1 }}>
                  <OrgNode titleAr="الإدارة المالية" titleEn="Finance & Accounting" headerBg="#047857" borderColor="#34d399" width="100%" />
                  <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 3 }}>
                    <DeptSection nameAr="المحاسبة العامة" nameEn="General Accounting" tasks={[
                      { ar: "القيود اليومية", en: "Journal entries" },
                      { ar: "ميزان المراجعة", en: "Trial balance" },
                      { ar: "القوائم المالية", en: "Financial statements" },
                      { ar: "مطابقة الحسابات", en: "Reconciliation" },
                    ]} />
                    <DeptSection nameAr="قسم الموردين" nameEn="Accounts Payable" tasks={[
                      { ar: "مراجعة الفواتير", en: "Invoice review" },
                      { ar: "مطابقة PO / GRN", en: "PO / GRN matching" },
                      { ar: "إدارة السداد", en: "Payments" },
                    ]} />
                    <DeptSection nameAr="قسم العملاء" nameEn="Accounts Receivable" tasks={[
                      { ar: "متابعة التحصيل", en: "Collection" },
                      { ar: "مطابقة المبيعات", en: "Sales reconciliation" },
                    ]} />
                    <DeptSection nameAr="الخزينة والرواتب" nameEn="Treasury & Payroll" tasks={[
                      { ar: "التدفقات النقدية", en: "Cash flow" },
                      { ar: "مسير الرواتب", en: "Payroll" },
                      { ar: "سداد التأمينات", en: "Insurance" },
                    ]} />
                  </div>
                </div>

                {/* Operations */}
                <div style={{ flex: 1 }}>
                  <OrgNode titleAr="إدارة التشغيل" titleEn="Operations" headerBg="#1d4ed8" borderColor="#60a5fa" width="100%" />
                  <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 3 }}>
                    <DeptSection nameAr="إدارة الفروع" nameEn="Branch Mgmt" tasks={[
                      { ar: "الأداء اليومي", en: "Daily performance" },
                      { ar: "أهداف المبيعات", en: "Sales targets" },
                      { ar: "ضبط الهدر", en: "Waste control" },
                      { ar: "مراقبة الجودة", en: "Quality control" },
                    ]} />
                    <DeptSection nameAr="إدارة الإنتاج" nameEn="Production" tasks={[
                      { ar: "خطوط الإنتاج", en: "Production lines" },
                      { ar: "مراقبة المواد الخام", en: "Raw materials" },
                      { ar: "الالتزام بالوصفات", en: "Recipe compliance" },
                    ]} />
                    <DeptSection nameAr="الجودة والتخطيط" nameEn="QA & Planning" tasks={[
                      { ar: "فحص المنتجات", en: "Inspection" },
                      { ar: "الالتزام الصحي", en: "Health compliance" },
                      { ar: "تخطيط الاحتياجات", en: "Demand planning" },
                    ]} />
                  </div>
                </div>

                {/* Procurement */}
                <div style={{ flex: 1 }}>
                  <OrgNode titleAr="المشتريات والإمداد" titleEn="Procurement & Supply" headerBg="#c2410c" borderColor="#fb923c" width="100%" />
                  <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 3 }}>
                    <DeptSection nameAr="قسم المشتريات" nameEn="Purchasing" tasks={[
                      { ar: "إدارة الموردين", en: "Suppliers" },
                      { ar: "التفاوض والأسعار", en: "Negotiation" },
                      { ar: "أوامر الشراء", en: "Purchase orders" },
                    ]} />
                    <DeptSection nameAr="المستودع المركزي" nameEn="Central Warehouse" tasks={[
                      { ar: "استلام المواد", en: "Receiving" },
                      { ar: "التخزين والجرد", en: "Storage & count" },
                      { ar: "التوزيع للفروع", en: "Distribution" },
                    ]} />
                    <DeptSection nameAr="مستودعات الفروع" nameEn="Branch Warehouses" tasks={[
                      { ar: "مخزون الفرع", en: "Branch stock" },
                      { ar: "الجرد اليومي", en: "Daily count" },
                    ]} />
                  </div>
                </div>

                {/* HR */}
                <div style={{ flex: 1 }}>
                  <OrgNode titleAr="الموارد البشرية" titleEn="Human Resources" headerBg="#7c3aed" borderColor="#a78bfa" width="100%" />
                  <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 3 }}>
                    <DeptSection nameAr="التوظيف" nameEn="Recruitment" tasks={[
                      { ar: "استقطاب الموظفين", en: "Talent acquisition" },
                      { ar: "المقابلات والعقود", en: "Interviews & contracts" },
                    ]} />
                    <DeptSection nameAr="شؤون الموظفين" nameEn="Personnel" tasks={[
                      { ar: "ملفات الموظفين", en: "Employee files" },
                      { ar: "الإجازات والمخالصات", en: "Leave & settlements" },
                    ]} />
                    <DeptSection nameAr="الحضور والامتثال" nameEn="Attendance & Compliance" tasks={[
                      { ar: "متابعة الدوام", en: "Tracking" },
                      { ar: "GOSI والتأمين", en: "GOSI & insurance" },
                      { ar: "نظام العمل", en: "Labor law" },
                    ]} />
                  </div>
                </div>

                {/* IT */}
                <div style={{ flex: 1 }}>
                  <OrgNode titleAr="تقنية المعلومات" titleEn="IT" headerBg="#0e7490" borderColor="#22d3ee" width="100%" />
                  <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 3 }}>
                    <DeptSection nameAr="الأنظمة والبنية التحتية" nameEn="Systems & Infra" tasks={[
                      { ar: "أنظمة نقاط البيع", en: "POS systems" },
                      { ar: "أنظمة المحاسبة", en: "Accounting sys" },
                      { ar: "إدارة السيرفرات", en: "Servers" },
                      { ar: "حماية البيانات", en: "Data protection" },
                      { ar: "الدعم الفني", en: "IT support" },
                    ]} />
                  </div>
                </div>
              </div>

              {/* Bottom row */}
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1.5px solid #e2e8f0", display: "flex", gap: 8, justifyContent: "center" }}>

                {/* Branch Structure */}
                <div style={{ width: 210, border: "1.5px solid #2dd4bf", borderRadius: 6, overflow: "hidden", background: "#fff" }}>
                  <div style={{ background: "#0d9488", padding: "4px 8px", textAlign: "center" }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 9 }}>هيكل كل فرع</div>
                    <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 6.5, fontStyle: "italic" }}>Branch Structure</div>
                  </div>
                  <div style={{ padding: 6 }}>
                    {[
                      { ar: "مدير الفرع", en: "Branch Manager", bg: "#0d9488", color: "#fff", mr: 0, bold: true },
                      { ar: "مساعد المدير", en: "Asst. Manager", bg: "#ccfbf1", color: "#134e4a", mr: 6, bold: true },
                      { ar: "مشرف الشيفت", en: "Shift Supervisor", bg: "#f0fdfa", color: "#115e59", mr: 12, bold: false },
                      { ar: "مسؤول المخزون", en: "Inventory", bg: "#f8fafc", color: "#475569", mr: 18, bold: false },
                      { ar: "الكاشير", en: "Cashier", bg: "#f8fafc", color: "#475569", mr: 18, bold: false },
                      { ar: "موظفو الإنتاج", en: "Production", bg: "#f8fafc", color: "#475569", mr: 18, bold: false },
                      { ar: "خدمة العملاء", en: "Customer Svc", bg: "#f8fafc", color: "#475569", mr: 18, bold: false },
                      { ar: "عمال النظافة", en: "Cleaning", bg: "#f8fafc", color: "#475569", mr: 18, bold: false },
                    ].map((item, i, arr) => (
                      <React.Fragment key={i}>
                        <div style={{ background: item.bg, color: item.color, borderRadius: 3, padding: "2px 5px", marginRight: item.mr, border: i >= 3 ? "1px solid #e2e8f0" : "none" }}>
                          <div style={{ fontSize: 7.5, fontWeight: item.bold ? 700 : 500 }}>{item.ar} <span style={{ fontSize: 6, opacity: 0.7, fontStyle: "italic" }}>({item.en})</span></div>
                        </div>
                        {i < arr.length - 1 && <div style={{ marginRight: item.mr + 5, height: 3 }}><div style={{ width: 1.5, height: "100%", background: "#99f6e4", borderRadius: 1 }} /></div>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Operational Support */}
                <div style={{ width: 170, border: "1.5px solid #94a3b8", borderRadius: 6, overflow: "hidden", background: "#fff" }}>
                  <div style={{ background: "#475569", padding: "4px 8px", textAlign: "center" }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 9 }}>الدعم التشغيلي</div>
                    <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 6.5, fontStyle: "italic" }}>Operational Support</div>
                  </div>
                  <div style={{ padding: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
                    {[
                      { ar: "سائقين", en: "Drivers" },
                      { ar: "عمال مستودعات", en: "Warehouse" },
                      { ar: "فني صيانة", en: "Maintenance" },
                      { ar: "دعم تقني", en: "IT Support" },
                    ].map((r, i) => (
                      <div key={i} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 3, padding: "3px 4px", textAlign: "center" }}>
                        <div style={{ fontSize: 7.5, color: "#334155", fontWeight: 600 }}>{r.ar}</div>
                        <div style={{ fontSize: 6, color: "#94a3b8", fontStyle: "italic" }}>{r.en}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Segregation of Duties */}
                <div style={{ width: 220, border: "1.5px solid #f87171", borderRadius: 6, overflow: "hidden", background: "#fff" }}>
                  <div style={{ background: "#b91c1c", padding: "4px 8px", textAlign: "center" }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 9 }}>فصل الصلاحيات</div>
                    <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 6.5, fontStyle: "italic" }}>Segregation of Duties</div>
                  </div>
                  <div style={{ padding: 5 }}>
                    {[
                      { ar: "المشتريات منفصلة عن السداد", en: "Purchasing separated from payments" },
                      { ar: "المحاسبة منفصلة عن اعتماد المدفوعات", en: "Accounting separated from approval" },
                      { ar: "الجرد منفصل عن مسؤول المخزون", en: "Count separated from stock keeper" },
                      { ar: "الرواتب تُعتمد بعد مراجعة المالية", en: "Payroll approved after finance review" },
                    ].map((s, i) => (
                      <div key={i} style={{ background: "#fef2f2", borderRadius: 3, padding: "2px 5px", marginBottom: 2 }}>
                        <div style={{ fontSize: 7.5, color: "#1e293b", fontWeight: 600, display: "flex", gap: 3, alignItems: "flex-start" }}>
                          <span style={{ color: "#16a34a", fontWeight: 700, flexShrink: 0 }}>✓</span>
                          <span>{s.ar} <span style={{ fontSize: 6, color: "#94a3b8", fontStyle: "italic" }}>({s.en})</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reporting Path */}
                <div style={{ width: 150, border: "1.5px solid #a78bfa", borderRadius: 6, overflow: "hidden", background: "#fff" }}>
                  <div style={{ background: "#6d28d9", padding: "4px 8px", textAlign: "center" }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 9 }}>مسار التقارير</div>
                    <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 6.5, fontStyle: "italic" }}>Reporting Path</div>
                  </div>
                  <div style={{ padding: 5 }}>
                    {[
                      { ar: "مجلس الإدارة", en: "Board", bg: "#6d28d9", color: "#fff" },
                      { ar: "الرئيس التنفيذي", en: "CEO", bg: "#ede9fe", color: "#4c1d95" },
                      { ar: "مدراء الإدارات", en: "Dept Heads", bg: "#fff", color: "#475569" },
                      { ar: "رؤساء الأقسام", en: "Sections", bg: "#fff", color: "#475569" },
                      { ar: "المشرفين", en: "Supervisors", bg: "#fff", color: "#475569" },
                      { ar: "الموظفين", en: "Staff", bg: "#fff", color: "#475569" },
                    ].map((l, i, a) => (
                      <React.Fragment key={i}>
                        <div style={{ borderRadius: 3, padding: "2px 5px", textAlign: "center", background: l.bg, color: l.color, border: i > 1 ? "1px solid #ede9fe" : "none" }}>
                          <div style={{ fontSize: 7.5, fontWeight: 600 }}>{l.ar} <span style={{ fontSize: 6, opacity: 0.7, fontStyle: "italic" }}>({l.en})</span></div>
                        </div>
                        {i < a.length - 1 && <div style={{ display: "flex", justifyContent: "center", height: 3 }}><div style={{ width: 1.5, height: "100%", background: "#c4b5fd", borderRadius: 1 }} /></div>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 8, paddingTop: 4, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: 7, color: "#94a3b8" }}>شركة الزبد الأفضل التجارية — الهيكل التنظيمي المعتمد وفقاً لمعايير حوكمة الشركات</span>
                  <span style={{ fontSize: 6, color: "#cbd5e1", fontStyle: "italic", marginRight: 6 }}>Best Butter Trading Co. — Saudi Corporate Governance</span>
                </div>
                <div>
                  <span style={{ fontSize: 7, color: "#94a3b8" }}>سري — للاستخدام الداخلي</span>
                  <span style={{ fontSize: 6, color: "#cbd5e1", fontStyle: "italic", marginRight: 6 }}>Confidential</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
