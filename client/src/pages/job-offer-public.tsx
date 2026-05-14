import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SignaturePad } from "@/components/signature-pad";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Clock, Briefcase, AlertCircle, Loader2 } from "lucide-react";

interface PublicOffer {
  offer: any;
  expiresAt: string;
  company: { name: string; nameEn: string; cr: string };
}

export default function JobOfferPublicPage() {
  const [, params] = useRoute("/job-offer/:token");
  const token = params?.token || "";
  const { toast } = useToast();

  const [data, setData] = useState<PublicOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/public/job-offers/${token}`, { credentials: "omit" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "خطأ");
        return j;
      })
      .then((j) => {
        setData(j);
        setConfirmName(j.offer.candidateName || "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!data?.expiresAt) return;
    const update = () => {
      const ms = new Date(data.expiresAt).getTime() - Date.now();
      if (ms <= 0) { setCountdown("انتهت الصلاحية"); return; }
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setCountdown(`${d} يوم و ${h} ساعة و ${m} دقيقة`);
    };
    update();
    const t = setInterval(update, 30000);
    return () => clearInterval(t);
  }, [data?.expiresAt]);

  const submitAccept = async () => {
    if (!signature) { toast({ title: "التوقيع مطلوب", variant: "destructive" }); return; }
    if (!confirmName.trim() || confirmName.trim().length < 2) { toast({ title: "الاسم مطلوب", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/public/job-offers/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({ signature, fullName: confirmName }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "فشل الإرسال");
      setDone("accepted");
      setAcceptOpen(false);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const submitDecline = async () => {
    if (!confirmName.trim() || confirmName.trim().length < 2) { toast({ title: "الاسم مطلوب", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/public/job-offers/${token}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({ reason: declineReason, fullName: confirmName }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "فشل الإرسال");
      setDone("declined");
      setDeclineOpen(false);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E6]" dir="rtl">
        <Loader2 className="w-10 h-10 animate-spin text-amber-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E6] p-4" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-3">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold">تعذّر فتح العرض</h2>
            <p className="text-slate-600">{error}</p>
            <p className="text-xs text-slate-400">يرجى التواصل مع الموارد البشرية للحصول على رابط جديد</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E6] p-4" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            {done === "accepted" ? (
              <>
                <CheckCircle2 className="w-20 h-20 text-green-600 mx-auto" />
                <h2 className="text-2xl font-bold text-green-700">شكراً لقبولك العرض</h2>
                <p className="text-slate-600">تم استلام موافقتك بنجاح.<br />سيتواصل معك فريق الموارد البشرية قريباً لإتمام إجراءات التعيين.</p>
              </>
            ) : (
              <>
                <XCircle className="w-20 h-20 text-slate-500 mx-auto" />
                <h2 className="text-2xl font-bold text-slate-700">تم استلام ردك</h2>
                <p className="text-slate-600">شكراً لإعلامنا بقرارك. نتمنى لك التوفيق.</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;
  const o = data.offer;
  const total = o.basicSalary + o.housingAllowance + o.transportAllowance + o.otherAllowances;
  const responded = ["accepted", "declined", "cancelled", "expired"].includes(o.status);

  return (
    <div className="min-h-screen bg-[#F5F0E6] p-4 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <Card className="bg-gradient-to-l from-amber-600 to-amber-700 text-white">
          <CardContent className="p-6 text-center">
            <Briefcase className="w-12 h-12 mx-auto mb-2" />
            <h1 className="text-2xl md:text-3xl font-bold">{data.company.name}</h1>
            <p className="text-amber-100 text-sm" dir="ltr">{data.company.nameEn}</p>
            <p className="text-xs text-amber-200 mt-1">سجل تجاري: {data.company.cr}</p>
          </CardContent>
        </Card>

        {/* Title + countdown */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold">عرض عمل / Job Offer</h2>
              <p className="text-sm text-slate-500 font-mono" dir="ltr">{o.offerNumber}</p>
            </div>
            <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-center">
              <Clock className="w-4 h-4 inline ml-1 text-amber-600" />
              <span className="text-xs text-amber-700">ينتهي خلال:</span>
              <p className="font-bold text-amber-800">{countdown}</p>
            </div>
          </CardContent>
        </Card>

        {/* Bilingual greeting */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm leading-loose text-slate-700">
                  السلام عليكم ورحمة الله وبركاته،<br /><br />
                  الأخ/الأخت <strong>{o.candidateName}</strong> المحترم/ة،<br /><br />
                  يسعدنا أن نقدم لكم عرض عمل للانضمام إلى فريق <strong>{data.company.name}</strong> في وظيفة <strong>{o.position}</strong>.
                  يرجى مراجعة تفاصيل العرض أدناه بعناية، ومن ثم اختيار <strong>القبول</strong> أو <strong>الرفض</strong> قبل انتهاء الصلاحية.
                </p>
              </div>
              <div dir="ltr">
                <p className="text-sm leading-loose text-slate-700">
                  Dear <strong>{o.candidateNameEn || o.candidateName}</strong>,<br /><br />
                  We are pleased to extend to you a job offer to join <strong>{data.company.nameEn}</strong> as a <strong>{o.positionEn || o.position}</strong>.
                  Please review the offer details below carefully, then choose to <strong>Accept</strong> or <strong>Decline</strong> before the expiry date.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal & Job */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-bold text-amber-700 border-b pb-2">البيانات الشخصية / Personal Info</h3>
              <Row labelAr="الاسم" labelEn="Name" value={o.candidateName} valueEn={o.candidateNameEn} />
              <Row labelAr="الجنسية" labelEn="Nationality" value={o.nationality} />
              <Row labelAr="رقم الهوية/الإقامة" labelEn="ID/Iqama No." value={o.idNumber} />
              <Row labelAr="مكان الإصدار" labelEn="Issue Place" value={o.idPlace} />
              <Row labelAr="تاريخ الانتهاء" labelEn="Expiry" value={o.idExpiry} />
              <Row labelAr="المؤهل" labelEn="Qualification" value={o.qualification} />
              <Row labelAr="الهاتف" labelEn="Phone" value={o.phone} />
              <Row labelAr="البريد" labelEn="Email" value={o.email} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-bold text-amber-700 border-b pb-2">تفاصيل الوظيفة / Job Details</h3>
              <Row labelAr="المسمى" labelEn="Position" value={o.position} valueEn={o.positionEn} />
              <Row labelAr="الإدارة" labelEn="Department" value={o.department} />
              <Row labelAr="الفرع" labelEn="Branch" value={o.branchName} />
              <Row labelAr="تاريخ المباشرة" labelEn="Start Date" value={o.startDate} />
              <Row labelAr="مدة العقد" labelEn="Duration" value={`${o.contractDurationMonths} شهر / months`} />
              <Row labelAr="فترة التجربة" labelEn="Probation" value={`${o.probationDays} يوم / days`} />
              <Row labelAr="ساعات العمل" labelEn="Working Hours" value={o.workingHours} />
            </CardContent>
          </Card>
        </div>

        {/* Salary */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-bold text-amber-700 border-b pb-2 mb-3">الراتب والبدلات / Salary & Allowances</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-amber-50">
                  <th className="border p-2 text-right">البند / Item</th>
                  <th className="border p-2 text-center">المبلغ الشهري / Monthly</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border p-2">الراتب الأساسي / Basic Salary</td><td className="border p-2 text-center font-mono">{o.basicSalary.toLocaleString("en-US")} SAR</td></tr>
                <tr><td className="border p-2">بدل السكن / Housing</td><td className="border p-2 text-center font-mono">{o.housingAllowance.toLocaleString("en-US")} SAR</td></tr>
                <tr><td className="border p-2">بدل المواصلات / Transport</td><td className="border p-2 text-center font-mono">{o.transportAllowance.toLocaleString("en-US")} SAR</td></tr>
                <tr><td className="border p-2">بدلات أخرى / Other</td><td className="border p-2 text-center font-mono">{o.otherAllowances.toLocaleString("en-US")} SAR</td></tr>
                <tr className="bg-amber-100">
                  <td className="border p-2 font-bold">الإجمالي / Total</td>
                  <td className="border p-2 text-center font-bold text-lg">{total.toLocaleString("en-US")} SAR</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Benefits */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-bold text-amber-700 border-b pb-2 mb-3">المزايا والشروط / Benefits & Conditions</h3>
            <ul className="text-sm space-y-1.5">
              <li>• الإجازة السنوية: <strong>{o.annualLeaveDays}</strong> يوم مدفوعة الأجر / Annual leave: <strong>{o.annualLeaveDays}</strong> paid days per year.</li>
              {o.hasMedicalInsurance && <li>• التأمين الطبي مشمول / Medical insurance included.</li>}
              {o.hasTravelTickets && <li>• تذاكر سفر للموظف الأجنبي / Travel tickets for foreign employees.</li>}
              <li>• فترة التجربة: <strong>{o.probationDays}</strong> يوم وفقاً لنظام العمل السعودي / Probation: <strong>{o.probationDays}</strong> days per Saudi Labor Law.</li>
              <li>• يحق للشركة نقل الموظف لأي فرع حسب حاجة العمل / Company may transfer employee as needed.</li>
              <li>• يعتبر هذا العرض لاغياً في حال عدم المباشرة في التاريخ المحدد / Offer void if not joined on specified date.</li>
              {o.benefitsNotes && <li className="whitespace-pre-line">• {o.benefitsNotes}</li>}
              {o.termsNotes && <li className="whitespace-pre-line">• {o.termsNotes}</li>}
            </ul>
          </CardContent>
        </Card>

        {/* Actions */}
        {!responded ? (
          <Card className="border-2 border-amber-400">
            <CardContent className="p-6 text-center space-y-4">
              <p className="text-sm text-slate-600">يرجى اختيار قرارك / Please make your decision:</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button
                  onClick={() => setAcceptOpen(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 text-lg gap-2"
                  data-testid="btn-accept-offer"
                >
                  <CheckCircle2 className="w-5 h-5" /> قبول العرض / Accept
                </Button>
                <Button
                  onClick={() => setDeclineOpen(true)}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50 px-8 py-6 text-lg gap-2"
                  data-testid="btn-decline-offer"
                >
                  <XCircle className="w-5 h-5" /> رفض العرض / Decline
                </Button>
              </div>
              <p className="text-xs text-slate-400">
                بضغطك على "قبول" فإنك توافق على جميع الشروط أعلاه وتقدم توقيعك الإلكتروني.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-slate-600">
              تم الرد على هذا العرض مسبقاً ({o.status})
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-center text-slate-400 mt-4">
          {data.company.name} — جميع الحقوق محفوظة
        </p>
      </div>

      {/* Accept Dialog */}
      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>تأكيد قبول العرض</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الاسم الكامل للتأكيد / Full Name *</Label>
              <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} data-testid="input-confirm-name" />
            </div>
            <div>
              <Label>التوقيع الإلكتروني / Electronic Signature *</Label>
              <SignaturePad onSignatureChange={setSignature} width={400} height={150} />
              <p className="text-xs text-slate-500 mt-1">ارسم توقيعك بإصبعك أو الفأرة ثم اضغط "تأكيد التوقيع"</p>
            </div>
            <div className="bg-amber-50 border border-amber-300 rounded p-2 text-xs">
              بضغطك على "تأكيد القبول" أنت توافق على جميع شروط العرض وتقر بصحة بياناتك.
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAcceptOpen(false)}>إلغاء</Button>
            <Button
              onClick={submitAccept}
              disabled={submitting || !signature}
              className="bg-green-600 hover:bg-green-700"
              data-testid="btn-confirm-accept"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "تأكيد القبول"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline Dialog */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>رفض العرض</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الاسم الكامل / Full Name *</Label>
              <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
            </div>
            <div>
              <Label>سبب الرفض (اختياري) / Reason (optional)</Label>
              <Textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>إلغاء</Button>
            <Button onClick={submitDecline} disabled={submitting} variant="destructive" data-testid="btn-confirm-decline">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "تأكيد الرفض"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ labelAr, labelEn, value, valueEn }: { labelAr: string; labelEn: string; value?: string; valueEn?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-sm py-1 border-b border-slate-100 last:border-0">
      <span className="text-slate-500">{labelAr} / <span className="text-xs">{labelEn}</span></span>
      <span className="font-medium text-slate-800">{value || "-"}{valueEn && value !== valueEn ? <span className="text-xs text-slate-500 block" dir="ltr">{valueEn}</span> : null}</span>
    </div>
  );
}
