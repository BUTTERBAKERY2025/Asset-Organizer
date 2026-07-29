import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, Loader2, FileText, ExternalLink } from "lucide-react";
import { CompanyHeader } from "@/components/company-header";
import type { JobOffer, OnboardingNotification, EmploymentApplication, BranchEmployee } from "@shared/schema";

interface FullFile {
  application: EmploymentApplication | null;
  offer: JobOffer | null;
  notification: OnboardingNotification;
  employee: BranchEmployee | null;
}

const fmtDate = (d: any): string => {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleString("ar-SA-u-nu-latn");
  } catch {
    return String(d);
  }
};

function Field({ label, value }: { label: string; value: any }) {
  const v = value === null || value === undefined || value === "" ? "-" : String(value);
  return (
    <div className="text-xs py-0.5">
      <span className="font-semibold">{label}:</span> {v}
    </div>
  );
}

function Section({ title, titleEn, children }: { title: string; titleEn?: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-300 rounded p-3 mb-3">
      <h3 className="font-bold text-[#1a3a2f] mb-2 border-b border-[#1a3a2f] pb-1 text-sm">
        {title} {titleEn && <span className="text-slate-500 font-normal">/ {titleEn}</span>}
      </h3>
      {children}
    </div>
  );
}

function StagePage({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div style={first ? undefined : { breakBefore: "page", pageBreakBefore: "always" }} className="pt-2">
      {children}
    </div>
  );
}

function StageTitle({ n, label, labelEn }: { n: number; label: string; labelEn: string }) {
  return (
    <div className="bg-[#1a3a2f] text-white rounded px-3 py-2 mb-3 mt-2">
      <span className="font-bold text-sm">المرحلة {n}: {label}</span>
      <span className="text-xs opacity-80"> / {labelEn}</span>
    </div>
  );
}

function ImageBlock({ label, url }: { label: string; url?: string | null }) {
  if (!url) return null;
  return (
    <div className="border border-slate-300 rounded p-2 text-center">
      <p className="text-xs font-semibold mb-1">{label}</p>
      <img src={url} alt={label} className="max-h-48 mx-auto object-contain" crossOrigin="anonymous" />
    </div>
  );
}

// عرض مصفوفات JSON (التعليم/الخبرات/اللغات...) بشكل مقروء
function JsonList({ label, data, render }: { label: string; data: any; render: (item: any, i: number) => React.ReactNode }) {
  if (!Array.isArray(data) || data.length === 0) return null;
  return (
    <div className="mb-2">
      <p className="text-xs font-bold text-[#2d5a47] mb-1">{label}</p>
      <div className="space-y-1">{data.map(render)}</div>
    </div>
  );
}

export function EmployeeFileDialog({
  notificationId,
  candidateName,
  onClose,
}: {
  notificationId: number | null;
  candidateName: string;
  onClose: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `ملف-موظف-${candidateName || ""}`,
  });

  const { data, isLoading, isError } = useQuery<FullFile>({
    queryKey: ["/api/hr/onboarding", notificationId, "full-file"],
    queryFn: async () => {
      const res = await fetch(`/api/hr/onboarding/${notificationId}/full-file`, { credentials: "include" });
      if (!res.ok) throw new Error("فشل جلب ملف الموظف");
      return res.json();
    },
    enabled: !!notificationId,
  });

  const app = data?.application || null;
  const offer = data?.offer || null;
  const n = data?.notification || null;
  const emp = data?.employee || null;
  const add: Record<string, any> = (app?.additionalData as any) || {};

  return (
    <Dialog open={!!notificationId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>الملف الكامل للموظف</span>
            {data && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handlePrint()} className="gap-1 bg-amber-600 hover:bg-amber-700 text-white" data-testid="btn-print-employee-file">
                  <Printer className="w-4 h-4" /> طباعة
                </Button>
                <Button size="sm" onClick={() => handlePrint()} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" data-testid="btn-pdf-employee-file" title="من نافذة الطباعة اختر: حفظ كـ PDF">
                  <Download className="w-4 h-4" /> حفظ PDF
                </Button>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> جارٍ تجهيز الملف...
          </div>
        )}
        {isError && <div className="py-8 text-center text-red-600">تعذّر جلب ملف الموظف</div>}

        {data && (
          <>
            {/* ملخص سريع للعرض داخل الشاشة */}
            <div className="text-sm space-y-2">
              <div className="bg-amber-50 border border-amber-200 rounded p-3">
                <p className="font-bold text-base">{emp?.employeeName || n?.candidateName}</p>
                <p className="text-xs text-slate-600">
                  {n?.position} — {n?.branchName || "-"} {emp?.employeeNumber ? `• رقم وظيفي: ${emp.employeeNumber}` : ""}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`rounded border p-2 ${app ? "bg-green-50 border-green-200" : "bg-slate-50"}`}>
                  ١. طلب التوظيف {app ? "✓ متوفر" : "— غير مرتبط"}
                </div>
                <div className={`rounded border p-2 ${offer ? "bg-green-50 border-green-200" : "bg-slate-50"}`}>
                  ٢. عرض العمل {offer ? "✓ متوفر" : "—"}
                </div>
                <div className="rounded border p-2 bg-green-50 border-green-200">٣. مباشرة العمل ✓ متوفر</div>
                <div className={`rounded border p-2 ${emp ? "bg-green-50 border-green-200" : "bg-slate-50"}`}>
                  ٤. سجل الموظف {emp ? "✓ متوفر" : "— غير محوّل"}
                </div>
              </div>
              <p className="text-xs text-slate-500">
                اضغط «حفظ PDF» لتحميل الملف الكامل المجمّع لكل المراحل بالترتيب.
              </p>
            </div>

            {/* قالب الطباعة — مخفي عن الشاشة لكنه مرسوم فعلياً ليطبع بشكل صحيح */}
            <div style={{ position: "absolute", left: "-9999px", top: 0, width: "794px" }} aria-hidden>
              <div ref={printRef} className="p-5 bg-white" dir="rtl">
                <CompanyHeader templateTitle="الملف الكامل للموظف" templateTitleEn="Complete Employee File" />
                <p className="text-center text-xs text-slate-500 mb-2">
                  ملف مجمّع لكل مراحل التوظيف — {emp?.employeeName || n?.candidateName} — تاريخ الإصدار: {fmtDate(new Date())}
                </p>

                {/* ===== المرحلة 1: طلب التوظيف ===== */}
                <StagePage first>
                  <StageTitle n={1} label="طلب التوظيف" labelEn="Job Application" />
                  {app ? (
                    <>
                      <Section title="بيانات الطلب" titleEn="Application Info">
                        <div className="grid grid-cols-2 gap-x-3">
                          <Field label="رقم الطلب" value={app.applicationNumber} />
                          <Field label="الوظيفة المستهدفة" value={app.targetPosition} />
                          <Field label="الفرع" value={app.targetBranchName} />
                          <Field label="الحالة" value={app.status} />
                          <Field label="تاريخ التقديم" value={fmtDate(app.submittedAt)} />
                        </div>
                      </Section>
                      <Section title="البيانات الشخصية" titleEn="Personal Data">
                        <div className="grid grid-cols-2 gap-x-3">
                          <Field label="الاسم (عربي)" value={app.fullNameAr} />
                          <Field label="الاسم (إنجليزي)" value={app.fullNameEn} />
                          <Field label="الجنسية" value={app.nationality} />
                          <Field label="نوع الهوية" value={app.idType} />
                          <Field label="رقم الهوية/الإقامة" value={app.idNumber} />
                          <Field label="انتهاء الهوية" value={app.idExpiry} />
                          <Field label="تاريخ الميلاد" value={app.dob} />
                          <Field label="الجنس" value={app.gender} />
                          <Field label="الحالة الاجتماعية" value={app.maritalStatus} />
                          <Field label="المدينة" value={app.city} />
                          <Field label="العنوان" value={app.address} />
                          <Field label="الهاتف" value={app.phone} />
                          <Field label="واتساب" value={app.whatsapp} />
                          <Field label="البريد" value={app.email} />
                          <Field label="الراتب المتوقع" value={app.expectedSalary} />
                          <Field label="تاريخ الإتاحة" value={app.availabilityDate} />
                        </div>
                      </Section>

                      <JsonList
                        label="المؤهلات العلمية"
                        data={app.education}
                        render={(e, i) => (
                          <div key={i} className="text-xs border rounded p-1">
                            {[e.degree, e.field, e.institution, [e.yearFrom, e.yearTo].filter(Boolean).join("-"), e.gpa && `معدل: ${e.gpa}`]
                              .filter(Boolean)
                              .join(" — ")}
                          </div>
                        )}
                      />
                      <JsonList
                        label="الخبرات العملية"
                        data={app.experience}
                        render={(e, i) => (
                          <div key={i} className="text-xs border rounded p-1">
                            {[e.position, e.company, [e.from, e.current ? "حتى الآن" : e.to].filter(Boolean).join("-"), e.summary]
                              .filter(Boolean)
                              .join(" — ")}
                          </div>
                        )}
                      />
                      {Array.isArray(app.skills) && app.skills.length > 0 && (
                        <Field label="المهارات" value={(app.skills as any[]).join("، ")} />
                      )}
                      <JsonList
                        label="اللغات"
                        data={app.languages}
                        render={(l, i) => (
                          <div key={i} className="text-xs">• {[l.name, l.level].filter(Boolean).join(" - ")}</div>
                        )}
                      />
                      <JsonList
                        label="المعرّفون"
                        data={app.references}
                        render={(r, i) => (
                          <div key={i} className="text-xs border rounded p-1">
                            {[r.name, r.position, r.company, r.phone].filter(Boolean).join(" — ")}
                          </div>
                        )}
                      />

                      {Object.keys(add).length > 0 && (
                        <Section title="بيانات إضافية" titleEn="Additional Data">
                          <div className="grid grid-cols-2 gap-x-3">
                            {Object.entries(add)
                              .filter(([, v]) => v !== null && v !== undefined && v !== "" && (typeof v === "string" || typeof v === "number" || typeof v === "boolean"))
                              .map(([k, v]) => (
                                <Field key={k} label={k} value={typeof v === "boolean" ? (v ? "نعم" : "لا") : v} />
                              ))}
                          </div>
                        </Section>
                      )}

                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <ImageBlock label="الصورة الشخصية" url={app.photoUrl} />
                        <ImageBlock label="صورة الهوية/الإقامة" url={app.idCopyUrl} />
                      </div>
                      {app.cvUrl && (
                        <div className="text-xs mt-2 flex items-center gap-1 text-blue-700">
                          <FileText className="w-3 h-3" /> السيرة الذاتية مرفقة (ملف منفصل):{" "}
                          <a href={app.cvUrl} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5">
                            فتح السيرة الذاتية <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                      {app.signature && (
                        <div className="border border-slate-300 rounded p-3 mt-3 max-w-xs">
                          <p className="text-xs font-semibold mb-1 text-center">توقيع المتقدّم وإقراره</p>
                          <img src={app.signature} alt="signature" className="max-h-20 mx-auto" crossOrigin="anonymous" />
                          <p className="text-[10px] text-center text-slate-500 mt-1">
                            {app.agreedToTerms ? "✓ موافق على الشروط" : ""}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 italic">لا يوجد طلب توظيف مرتبط بهذا الموظف في النظام.</p>
                  )}
                </StagePage>

                {/* ===== المرحلة 2: عرض العمل ===== */}
                <StagePage>
                  <StageTitle n={2} label="عرض العمل وقبوله" labelEn="Job Offer & Acceptance" />
                  {offer ? (
                    <>
                      <Section title="بيانات العرض" titleEn="Offer Details">
                        <div className="grid grid-cols-2 gap-x-3">
                          <Field label="رقم العرض" value={offer.offerNumber} />
                          <Field label="المنصب" value={offer.position} />
                          <Field label="القسم" value={offer.department} />
                          <Field label="الفرع" value={offer.branchName} />
                          <Field label="تاريخ المباشرة" value={offer.startDate} />
                          <Field label="مدة العقد (شهور)" value={offer.contractDurationMonths} />
                          <Field label="فترة التجربة (يوم)" value={offer.probationDays} />
                          <Field label="ساعات الدوام" value={offer.workingHours} />
                          <Field label="الجنسية" value={offer.nationality} />
                          <Field label="رقم الهوية" value={offer.idNumber} />
                          <Field label="المؤهل" value={offer.qualification} />
                        </div>
                      </Section>
                      <Section title="الراتب والبدلات" titleEn="Salary & Allowances">
                        <div className="grid grid-cols-2 gap-x-3">
                          <Field label="الراتب الأساسي" value={`${offer.basicSalary} ر.س`} />
                          <Field label="بدل السكن" value={`${offer.housingAllowance} ر.س`} />
                          <Field label="بدل النقل" value={`${offer.transportAllowance} ر.س`} />
                          <Field label="بدلات أخرى" value={`${offer.otherAllowances} ر.س`} />
                          <Field label="الإجازة السنوية (يوم)" value={offer.annualLeaveDays} />
                          <Field label="تأمين طبي" value={offer.hasMedicalInsurance ? "نعم" : "لا"} />
                          <Field label="تذاكر سفر" value={offer.hasTravelTickets ? "نعم" : "لا"} />
                        </div>
                        {offer.benefitsNotes && <Field label="ملاحظات المزايا" value={offer.benefitsNotes} />}
                        {offer.termsNotes && <Field label="الشروط" value={offer.termsNotes} />}
                      </Section>
                      <Section title="القبول" titleEn="Acceptance">
                        <div className="grid grid-cols-2 gap-x-3">
                          <Field label="الحالة" value={offer.status} />
                          <Field label="تاريخ القبول" value={fmtDate(offer.acceptedAtSignature)} />
                        </div>
                        {offer.candidateSignature && (
                          <div className="border border-slate-300 rounded p-3 mt-2 max-w-xs">
                            <p className="text-xs font-semibold mb-1 text-center">توقيع الموظف على قبول العرض</p>
                            <img src={offer.candidateSignature} alt="signature" className="max-h-20 mx-auto" crossOrigin="anonymous" />
                          </div>
                        )}
                      </Section>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 italic">لا يوجد عرض عمل مرتبط.</p>
                  )}
                </StagePage>

                {/* ===== المرحلة 3: مباشرة العمل ===== */}
                <StagePage>
                  <StageTitle n={3} label="مباشرة العمل" labelEn="Work Commencement" />
                  {n && (
                    <>
                      <Section title="تفاصيل المباشرة" titleEn="Commencement Details">
                        <div className="grid grid-cols-2 gap-x-3">
                          <Field label="رقم الإشعار" value={n.notificationNumber} />
                          <Field label="تاريخ المباشرة الفعلي" value={n.actualStartDate} />
                          <Field label="ساعات الدوام" value={n.workingHours} />
                          <Field label="المسؤول المباشر" value={n.reportingTo} />
                          <Field label="الحالة" value={n.status} />
                          <Field label="تاريخ التوقيع" value={fmtDate(n.signedAt)} />
                        </div>
                        {n.notes && <Field label="ملاحظات" value={n.notes} />}
                      </Section>
                      {n.selfiePhotoUrl && (
                        <Section title="إثبات الحضور في الفرع" titleEn="Branch Attendance Proof">
                          <div className="flex gap-3 items-start">
                            <img src={n.selfiePhotoUrl} alt="selfie" className="w-40 h-40 object-cover border rounded" crossOrigin="anonymous" />
                            <div className="flex-1">
                              {n.selfieLat != null && n.selfieLng != null && (
                                <Field label="الإحداثيات" value={`${n.selfieLat.toFixed(5)}, ${n.selfieLng.toFixed(5)}`} />
                              )}
                              {n.distanceFromBranchM != null && (
                                <Field
                                  label="المسافة من الفرع"
                                  value={`${n.distanceFromBranchM} م ${n.withinBranchRadius ? "✓ ضمن النطاق" : "⚠ خارج النطاق"}`}
                                />
                              )}
                              <Field label="وقت الالتقاط" value={fmtDate(n.selfieCapturedAt)} />
                            </div>
                          </div>
                        </Section>
                      )}
                      {n.employeeSignature && (
                        <div className="border border-slate-300 rounded p-3 mt-2 max-w-xs">
                          <p className="text-xs font-semibold mb-1 text-center">توقيع الموظف على المباشرة</p>
                          <img src={n.employeeSignature} alt="signature" className="max-h-20 mx-auto" crossOrigin="anonymous" />
                          <p className="text-[10px] text-center text-slate-500 mt-1">{fmtDate(n.signedAt)}</p>
                        </div>
                      )}
                    </>
                  )}
                </StagePage>

                {/* ===== المرحلة 4: سجل الموظف ===== */}
                <StagePage>
                  <StageTitle n={4} label="سجل الموظف النهائي" labelEn="Employee Record" />
                  {emp ? (
                    <>
                      <Section title="بيانات الموظف" titleEn="Employee Data">
                        <div className="grid grid-cols-2 gap-x-3">
                          <Field label="الرقم الوظيفي" value={emp.employeeNumber} />
                          <Field label="الاسم" value={emp.employeeName} />
                          <Field label="الاسم (إنجليزي)" value={emp.employeeNameEn} />
                          <Field label="المسمى الوظيفي" value={emp.jobTitle} />
                          <Field label="القسم" value={emp.department} />
                          <Field label="الجنسية" value={emp.nationality} />
                          <Field label="تاريخ التعيين" value={emp.hireDate} />
                          <Field label="الحالة" value={emp.status} />
                        </div>
                      </Section>
                      <Section title="الهوية والوثائق" titleEn="Identity & Documents">
                        <div className="grid grid-cols-2 gap-x-3">
                          <Field label="رقم الإقامة / رقم الهوية" value={emp.iqamaNumber} />
                          <Field label="انتهاء الإقامة" value={emp.iqamaExpiry} />
                          <Field label="رقم الجواز" value={emp.passportNumber} />
                          <Field label="انتهاء الجواز" value={emp.passportExpiry} />
                          <Field label="الشهادة الصحية" value={emp.healthCertificate} />
                          <Field label="انتهاء الشهادة الصحية" value={emp.healthCertificateExpiry} />
                        </div>
                      </Section>
                      <Section title="الراتب والبنك" titleEn="Salary & Bank">
                        <div className="grid grid-cols-2 gap-x-3">
                          <Field label="الراتب الأساسي" value={emp.salary} />
                          <Field label="إجمالي الراتب" value={emp.totalSalary} />
                          <Field label="الهاتف" value={emp.phoneNumber} />
                          <Field label="جهة الطوارئ" value={emp.emergencyContact} />
                          <Field label="البنك" value={emp.bankName} />
                          <Field label="رقم الحساب/الآيبان" value={emp.bankAccountNumber} />
                        </div>
                      </Section>
                      {emp.photoUrl && (
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <ImageBlock label="صورة الموظف" url={emp.photoUrl} />
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 italic">لم يتم تحويل هذا الإشعار إلى سجل موظف بعد.</p>
                  )}
                </StagePage>

                <div className="mt-6 text-center text-[10px] text-slate-500 border-t pt-2">
                  وثيقة مجمّعة مولّدة إلكترونياً من نظام باتر لإدارة الموارد البشرية — {fmtDate(new Date())}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
