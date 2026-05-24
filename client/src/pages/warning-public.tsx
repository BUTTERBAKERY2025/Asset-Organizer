import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { useReactToPrint } from "react-to-print";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignaturePad } from "@/components/signature-pad";
import { WarningDocument, COMPANY_NAME_AR, COMPANY_CR_NUMBER, COMPANY_LOGO_URL } from "@/components/warning-document";
import { useToast } from "@/hooks/use-toast";
import { AlertOctagon, Loader2, CheckCircle2, FileDown, Paperclip, ShieldAlert } from "lucide-react";

type PublicWarning = {
  warning: {
    id: number; level: string; reason: string; description?: string | null;
    issuedDate: string; deductionAmount?: number | null;
    templateId?: string | null; reasonCategory?: string | null;
    attachments?: Array<{ url: string; name: string; mimeType?: string; size?: number }>;
    signedAt?: string | null; signatureData?: string | null; status: string;
  };
  employee: { id: number; employeeName?: string | null; jobTitle?: string | null; nationalId?: string | null } | null;
  branch: { id: string; name?: string | null; nameAr?: string | null } | null;
  template: { id: string; label: string; body: string } | null;
  reasonCategoryLabel: string | null;
  legalNotice: string;
};

export default function WarningPublicPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [data, setData] = useState<PublicWarning | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmRead, setConfirmRead] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Warning_${data?.warning.id ?? ""}_${data?.employee?.employeeName ?? ""}`,
  });

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/public/warning/${encodeURIComponent(token)}`, { credentials: "omit" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "تعذّر تحميل الإنذار");
      }
      const j = (await r.json()) as PublicWarning;
      setData(j);
    } catch (e: any) {
      setError(e?.message || "تعذّر تحميل الإنذار");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) load(); }, [token]);

  const submitSign = async () => {
    if (!signature) {
      toast({ title: "التوقيع مطلوب", description: "يرجى التوقيع في المربع المخصص قبل التأكيد.", variant: "destructive" });
      return;
    }
    if (!confirmRead) {
      toast({ title: "الإقرار مطلوب", description: "يرجى تأكيد قراءة الإنذار قبل التوقيع.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/public/warning/${encodeURIComponent(token)}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({ signatureData: signature }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "تعذّر حفظ التوقيع");
      toast({ title: "تم التوقيع بنجاح", description: "تم تسجيل توقيعك إلكترونيًا. يمكنك تحميل نسخة من الإنذار الآن." });
      await load();
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "تعذّر حفظ التوقيع", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <ShieldAlert className="h-12 w-12 text-rose-600 mx-auto mb-2" />
            <CardTitle>تعذّر فتح الإنذار</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            {error || "الرابط غير صحيح أو منتهي الصلاحية."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const w = data.warning;
  const isSigned = !!w.signedAt;
  const companyName = COMPANY_NAME_AR;
  const branchName = data.branch?.nameAr || data.branch?.name || null;
  const templateBody = data.template?.body || null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/50 to-slate-50 py-6 px-3" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header banner */}
        <Card className="border-amber-200">
          <CardContent className="p-4 flex items-center gap-3">
            <img
              src={COMPANY_LOGO_URL}
              alt={companyName}
              className="h-12 w-12 object-contain rounded-md bg-white border border-amber-100 p-1"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              data-testid="img-company-logo"
            />
            <div className="flex-1">
              <div className="text-lg font-bold">{companyName}</div>
              <div className="text-[11px] text-muted-foreground">
                سجل تجاري: <span dir="ltr" className="inline-block">{COMPANY_CR_NUMBER}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <AlertOctagon className="h-3.5 w-3.5 text-amber-700" /> إشعار رسمي بالإجراء التأديبي
              </div>
            </div>
            {isSigned ? (
              <Badge className="bg-emerald-100 text-emerald-700 gap-1" data-testid="badge-signed">
                <CheckCircle2 className="h-3.5 w-3.5" /> تم التوقيع
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-400 text-amber-700">بانتظار التوقيع</Badge>
            )}
          </CardContent>
        </Card>

        {/* Document preview */}
        <Card className="overflow-hidden">
          <CardContent className="p-0 overflow-auto bg-slate-100">
            <div style={{ transform: "scale(0.92)", transformOrigin: "top center" }} className="origin-top">
              <WarningDocument
                ref={printRef}
                companyName={companyName}
                branchName={branchName}
                warning={w}
                employee={data.employee}
                templateBody={templateBody}
                reasonCategoryLabel={data.reasonCategoryLabel}
                legalNotice={data.legalNotice}
              />
            </div>
          </CardContent>
        </Card>

        {/* Attachments */}
        {w.attachments && w.attachments.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Paperclip className="h-4 w-4" /> المرفقات ({w.attachments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {w.attachments.map((att, i) => (
                <a
                  key={i}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-amber-700 hover:underline truncate"
                  data-testid={`link-attachment-${i}`}
                >
                  • {att.name}
                </a>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Sign or download */}
        {isSigned ? (
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="p-5 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
              <div>
                <div className="font-bold text-emerald-800">تم استلام توقيعك بنجاح</div>
                <div className="text-xs text-emerald-700 mt-1">
                  بتاريخ:{" "}
                  {new Date(w.signedAt!).toLocaleString("ar-SA-u-nu-latn", {
                    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </div>
              </div>
              <Button onClick={() => handlePrint()} className="gap-2" data-testid="button-download-pdf">
                <FileDown className="h-4 w-4" /> حفظ / طباعة نسخة PDF
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">إقرار وتوقيع</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmRead}
                  onChange={(e) => setConfirmRead(e.target.checked)}
                  className="mt-1"
                  data-testid="checkbox-confirm-read"
                />
                <span>
                  أُقرّ أنا الموظف <strong>{data.employee?.employeeName || ""}</strong> بأنني قرأت الإنذار الموضّح أعلاه واطّلعت
                  على مضمونه وعلى النص النظامي الوارد فيه. علمًا بأن التوقيع لا يعني الموافقة على المخالفة وأنه يحقّ لي الاعتراض
                  وفقًا للأنظمة المعمول بها.
                </span>
              </label>

              <div>
                <div className="text-sm font-medium mb-2">التوقيع</div>
                <SignaturePad
                  onSignatureChange={setSignature}
                  width={520}
                  height={160}
                  label="ارسم توقيعك بإصبعك أو بمؤشّر الفأرة"
                />
              </div>

              <Button
                onClick={submitSign}
                disabled={submitting || !signature || !confirmRead}
                className="w-full gap-2"
                data-testid="button-submit-signature"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {submitting ? "جاري الحفظ..." : "تأكيد التوقيع وإرسال"}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="text-center text-[11px] text-muted-foreground py-2">
          {companyName} (سجل تجاري <span dir="ltr" className="inline-block">{COMPANY_CR_NUMBER}</span>) — جميع الحقوق محفوظة. للاستفسار يُرجى التواصل مع إدارة الموارد البشرية.
        </div>
      </div>
    </div>
  );
}
