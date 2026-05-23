import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Calendar, MapPin, Clock, Building2, Loader2 } from "lucide-react";

interface RsvpData {
  shareholderName: string;
  meetingTitle: string;
  meetingDate: string;
  meetingLocation: string;
  status: string;
  confirmedAt: string | null;
  declinedAt: string | null;
}

export default function RsvpPage() {
  const { token } = useParams<{ token: string }>();
  const [rsvpData, setRsvpData] = useState<RsvpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedAction, setSubmittedAction] = useState<string>("");

  useEffect(() => {
    async function fetchRsvp() {
      try {
        const response = await fetch(`/api/rsvp/${token}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("هذا الرابط غير صالح أو منتهي الصلاحية");
          } else {
            setError("حدث خطأ في تحميل البيانات");
          }
          return;
        }
        const data = await response.json();
        setRsvpData(data);
      } catch {
        setError("حدث خطأ في الاتصال");
      } finally {
        setLoading(false);
      }
    }
    if (token) fetchRsvp();
  }, [token]);

  const handleSubmit = async (action: 'confirm' | 'decline') => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/rsvp/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() || undefined }),
      });
      if (!response.ok) throw new Error();
      setSubmitted(true);
      setSubmittedAction(action);
    } catch {
      setError("حدث خطأ أثناء إرسال الرد");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4" dir="rtl">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">خطأ</h2>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!rsvpData) return null;

  const meetingDate = new Date(rsvpData.meetingDate);
  const formattedDate = meetingDate.toLocaleDateString('ar-SA-u-nu-latn', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = meetingDate.toLocaleTimeString('ar-SA-u-nu-latn', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const alreadyResponded = rsvpData.status === 'confirmed' || rsvpData.status === 'declined';

  if (submitted || alreadyResponded) {
    const isConfirmed = submitted ? submittedAction === 'confirm' : rsvpData.status === 'confirmed';
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center p-4" dir="rtl">
        <Card className="max-w-md w-full text-center shadow-xl">
          <CardContent className="pt-8 pb-8">
            {isConfirmed ? (
              <>
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-green-800 mb-2">تم تأكيد الحضور</h2>
                <p className="text-gray-600 mb-4">
                  شكراً لك {rsvpData.shareholderName}، تم تسجيل تأكيد حضورك بنجاح.
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="h-12 w-12 text-orange-600" />
                </div>
                <h2 className="text-2xl font-bold text-orange-800 mb-2">تم تسجيل الاعتذار</h2>
                <p className="text-gray-600 mb-4">
                  شكراً لك {rsvpData.shareholderName}، تم تسجيل اعتذارك.
                </p>
              </>
            )}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm">
              <p className="font-semibold text-gray-700 mb-2">{rsvpData.meetingTitle}</p>
              <div className="flex items-center gap-2 text-gray-600 justify-center mb-1">
                <Calendar className="h-4 w-4" />
                <span>{formattedDate}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 justify-center">
                <Clock className="h-4 w-4" />
                <span>{formattedTime}</span>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center gap-2 justify-center text-amber-700">
                <Building2 className="h-5 w-5" />
                <span className="font-semibold">شركة الزبد الأفضل التجارية</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center p-4" dir="rtl">
      <Card className="max-w-lg w-full shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center gap-2 justify-center mb-4">
            <Building2 className="h-8 w-8 text-amber-600" />
            <span className="text-xl font-bold text-amber-800">شركة الزبد الأفضل التجارية</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">تأكيد حضور اجتماع</h1>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-lg text-gray-700 mb-1">
              مرحباً <span className="font-bold text-amber-800">{rsvpData.shareholderName}</span>
            </p>
            <p className="text-gray-600">نود تأكيد حضوركم للاجتماع التالي:</p>
          </div>

          <div className="bg-amber-50 p-5 rounded-xl border border-amber-200">
            <h3 className="font-bold text-lg text-amber-900 mb-3 text-center">{rsvpData.meetingTitle}</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">التاريخ</p>
                  <p className="font-semibold text-gray-800">{formattedDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">الوقت</p>
                  <p className="font-semibold text-gray-800">{formattedTime}</p>
                </div>
              </div>
              {rsvpData.meetingLocation && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">المكان</p>
                    <p className="font-semibold text-gray-800">{rsvpData.meetingLocation}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">ملاحظات (اختياري)</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="أي ملاحظات تود إضافتها..."
              className="resize-none"
              rows={3}
              data-testid="input-rsvp-note"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => handleSubmit('confirm')}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700 text-white h-14 text-lg gap-2"
              data-testid="button-rsvp-confirm"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
              تأكيد الحضور
            </Button>
            <Button
              onClick={() => handleSubmit('decline')}
              disabled={submitting}
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-50 h-14 text-lg gap-2"
              data-testid="button-rsvp-decline"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5" />}
              اعتذار
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}