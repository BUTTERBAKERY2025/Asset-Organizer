import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, MapPin, Camera, CheckCircle2, AlertTriangle, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GPSPhotoCapture, PhotoThumb, type CapturedPhoto } from "@/components/gps-photo-capture";
import { SignaturePad } from "@/components/signature-pad";

export default function OnboardingPublicPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ withinRadius: boolean | null; distanceM: number | null } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/public/onboarding/${token}`);
        const j = await r.json();
        if (!r.ok) {
          setError(j.error || "تعذّر تحميل الإشعار");
        } else {
          setData(j);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const submit = async () => {
    if (!photo) return toast({ title: "صورة الإثبات في الفرع مطلوبة", variant: "destructive" });
    if (!signature) return toast({ title: "التوقيع مطلوب", variant: "destructive" });

    setSubmitting(true);
    try {
      const r = await fetch(`/api/public/onboarding/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature,
          selfiePhotoUrl: photo.url,
          selfieLat: photo.lat,
          selfieLng: photo.lng,
          selfieAccuracy: photo.accuracy,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "فشل التوقيع");
      setDone({ withinRadius: j.withinRadius, distanceM: j.distanceM });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
        <Card className="max-w-md w-full border-red-200">
          <CardContent className="p-6 text-center space-y-3">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-lg font-bold text-red-700">تعذّر فتح الرابط</h2>
            <p className="text-sm text-slate-600">{error}</p>
            <p className="text-xs text-slate-500">يرجى التواصل مع إدارة الموارد البشرية</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-green-50" dir="rtl">
        <Card className="max-w-md w-full border-green-300">
          <CardContent className="p-6 text-center space-y-3">
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto" />
            <h2 className="text-xl font-bold text-green-800">تم تأكيد مباشرتك بنجاح! 🎉</h2>
            <p className="text-sm text-slate-700">مرحباً بك في عائلة <strong>Butter Bakery</strong></p>
            {done.distanceM != null && (
              <p className={`text-xs ${done.withinRadius ? "text-green-700" : "text-amber-700"}`}>
                {done.withinRadius ? "✓ موقعك مؤكّد داخل نطاق الفرع" : `⚠ موقعك على بُعد ${done.distanceM} متر من الفرع — سيتم مراجعته`}
              </p>
            )}
            <p className="text-xs text-slate-500 pt-3">سيتم إكمال إجراءاتك من قبل إدارة الموارد البشرية قريباً.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const n = data.notification;
  const b = data.branch;
  const alreadySigned = n.status === "signed" || n.status === "confirmed" || n.status === "converted";

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white p-4" dir="rtl">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <Card className="border-2 border-amber-300 overflow-hidden">
          <div className="bg-gradient-to-l from-amber-600 to-amber-700 text-white p-4 text-center">
            <div className="text-3xl mb-1">🥐</div>
            <h1 className="text-xl font-bold">BUTTER BAKERY</h1>
            <p className="text-xs opacity-90">إشعار مباشرة العمل | Work Commencement</p>
          </div>
          <CardContent className="p-4 space-y-2 text-sm">
            <div className="text-center text-base font-bold text-amber-800">
              أهلاً وسهلاً بك، {n.candidateName} 🎉
            </div>
            <div className="text-center text-xs text-slate-600">Welcome to the team!</div>
            <div className="border-t pt-2 grid grid-cols-1 gap-1.5 text-xs">
              <Row label="رقم الإشعار" value={n.notificationNumber} mono />
              <Row label="الوظيفة" value={n.position} />
              <Row label="الفرع" value={n.branchName || "-"} />
              <Row label="تاريخ المباشرة" value={n.actualStartDate} />
              {n.workingHours && <Row label="ساعات الدوام" value={n.workingHours} />}
              {n.reportingTo && <Row label="المسؤول المباشر" value={n.reportingTo} />}
            </div>
          </CardContent>
        </Card>

        {alreadySigned ? (
          <Card className="border-green-300 bg-green-50">
            <CardContent className="p-4 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
              <p className="font-semibold text-green-800">تم توقيع مباشرتك مسبقاً</p>
              <p className="text-xs text-slate-600">سيتم التواصل معك من قبل إدارة الموارد البشرية.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Branch location info */}
            {b && (
              <Card>
                <CardContent className="p-3 text-xs space-y-1">
                  <p className="font-semibold flex items-center gap-1"><MapPin className="w-3 h-3 text-blue-600" /> موقع الفرع</p>
                  {b.address && <p className="text-slate-600">{b.address}</p>}
                  {b.latitude != null && b.longitude != null && (
                    <a
                      href={`https://www.google.com/maps?q=${b.latitude},${b.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline"
                    >
                      فتح الموقع على الخريطة
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Photo capture */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Camera className="w-4 h-4 text-indigo-600" /> ١. التقط صورة لنفسك داخل الفرع
                </div>
                <p className="text-xs text-slate-500">
                  يجب التقاط الصورة من جوالك وأنت داخل الفرع، مع تفعيل الموقع الجغرافي (GPS).
                </p>
                {photo ? (
                  <PhotoThumb photo={photo} onRemove={() => setPhoto(null)} />
                ) : (
                  <GPSPhotoCapture
                    folder="onboarding"
                    buttonLabel="📸 التقط صورة في الفرع"
                    required
                    onUpload={setPhoto}
                    uploadUrl={`/api/public/onboarding/${token}/upload`}
                  />
                )}
              </CardContent>
            </Card>

            {/* Signature */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Briefcase className="w-4 h-4 text-amber-600" /> ٢. التوقيع الإلكتروني
                </div>
                <p className="text-xs text-slate-500">وقّع بإصبعك في المربع أدناه:</p>
                <SignaturePad onSignatureChange={(s) => setSignature(s)} label="" />
              </CardContent>
            </Card>

            {/* Submit */}
            <Button
              className="w-full h-14 text-lg bg-green-600 hover:bg-green-700 gap-2"
              onClick={submit}
              disabled={submitting || !photo || !signature}
              data-testid="btn-submit-sign"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              تأكيد المباشرة
            </Button>

            <p className="text-[10px] text-center text-slate-400 pt-2">
              بضغطك على زر التأكيد فإنك تُقرّ بمباشرتك للعمل في فرع <strong>{n.branchName}</strong> بتاريخ <strong>{n.actualStartDate}</strong>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}:</span>
      <span className={`font-medium ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
