import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/signature-pad";
import { CheckCircle, XCircle, Loader2, ThumbsUp, ThumbsDown, MinusCircle, Vote } from "lucide-react";

interface RevoteData {
  shareholderName: string;
  resolution: {
    id: number;
    resolutionNumber?: string | null;
    title: string;
    description?: string | null;
  };
  item: { id: number; sequence: number; text: string } | null;
  status: string;
}

type VoteChoice = "for" | "against" | "abstain";

export default function RevotePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<RevoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [choice, setChoice] = useState<VoteChoice | null>(null);
  const [comments, setComments] = useState("");
  const [signature, setSignature] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/public/revote/${token}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body?.error || "هذا الرابط غير صالح أو منتهي الصلاحية");
          return;
        }
        setData(await res.json());
      } catch {
        setError("حدث خطأ في الاتصال");
      } finally {
        setLoading(false);
      }
    }
    if (token) load();
  }, [token]);

  const submit = async () => {
    if (!choice) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/revote/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vote: choice,
          comments: comments.trim() || undefined,
          signatureData: signature || undefined,
          signatureType: signature ? "draw" : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || "حدث خطأ أثناء إرسال التصويت");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("حدث خطأ أثناء إرسال التصويت");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4" dir="rtl">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">تعذّر فتح التصويت</h2>
            <p className="text-gray-600" data-testid="text-revote-error">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center p-4" dir="rtl">
        <Card className="max-w-md w-full text-center shadow-xl">
          <CardContent className="pt-8 pb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-800 mb-2">تم تسجيل تصويتك</h2>
            <p className="text-gray-600">شكراً لك {data.shareholderName}، تم تسجيل صوتك الجديد بنجاح.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const choices: { value: VoteChoice; label: string; icon: any; active: string; idle: string }[] = [
    { value: "for", label: "موافق", icon: ThumbsUp, active: "bg-green-600 text-white border-green-600", idle: "text-green-700 border-green-300 hover:bg-green-50" },
    { value: "against", label: "غير موافق", icon: ThumbsDown, active: "bg-red-600 text-white border-red-600", idle: "text-red-700 border-red-300 hover:bg-red-50" },
    { value: "abstain", label: "ممتنع", icon: MinusCircle, active: "bg-amber-500 text-white border-amber-500", idle: "text-amber-700 border-amber-300 hover:bg-amber-50" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center p-4" dir="rtl">
      <Card className="max-w-lg w-full shadow-xl">
        <CardHeader className="text-center border-b">
          <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Vote className="h-7 w-7 text-indigo-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">إعادة التصويت</h1>
          <p className="text-sm text-gray-500">{data.shareholderName}</p>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3">
            {data.resolution.resolutionNumber && (
              <div className="text-xs text-gray-500 mb-1">{data.resolution.resolutionNumber}</div>
            )}
            <div className="font-semibold text-gray-800" data-testid="text-resolution-title">{data.resolution.title}</div>
            {data.resolution.description && (
              <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{data.resolution.description}</p>
            )}
            {data.item && (
              <div className="mt-2 pt-2 border-t text-sm">
                <span className="text-indigo-700 font-medium">البند {data.item.sequence}: </span>
                <span className="text-gray-700" data-testid="text-clause">{data.item.text}</span>
              </div>
            )}
          </div>

          <div>
            <Label className="mb-2 block">اختر تصويتك</Label>
            <div className="grid grid-cols-3 gap-2">
              {choices.map(c => {
                const Icon = c.icon;
                const isActive = choice === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setChoice(c.value)}
                    className={`flex flex-col items-center gap-1 border rounded-lg py-3 transition ${isActive ? c.active : c.idle}`}
                    data-testid={`btn-vote-${c.value}`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="revote-comments">ملاحظات (اختياري)</Label>
            <Textarea
              id="revote-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="أضف ملاحظة…"
              data-testid="input-revote-comments"
            />
          </div>

          <div>
            <Label className="mb-1 block">التوقيع (اختياري)</Label>
            <SignaturePad onSignatureChange={setSignature} />
          </div>

          <Button
            onClick={submit}
            disabled={!choice || submitting}
            className="w-full gap-2"
            data-testid="btn-submit-revote"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            تأكيد التصويت
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
