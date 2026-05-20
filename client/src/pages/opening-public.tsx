import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { PartyPopper, Gift, Sparkles, Loader2, CheckCircle2, MapPin, Calendar, Ticket } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import butterLogo from "@/assets/butter-logo.png";

interface Campaign {
  id: number; slug: string; title: string; branchName: string; branchCity: string;
  branchAddress: string | null; openingDate: string | null; headline: string | null;
  description: string | null; prizesJson: string | null;
}

const COMMON_NATIONALITIES = ["سعودي", "مصري", "يمني", "سوري", "أردني", "سوداني", "باكستاني", "هندي", "بنغلاديشي", "فلبيني", "أخرى"];
const SAUDI_CITIES = ["الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الطائف", "الخبر", "تبوك", "بريدة", "حائل", "الأحساء", "نجران", "أبها", "خميس مشيط", "الجبيل", "ينبع", "أخرى"];

type Step = "form" | "spinning" | "result";

export default function OpeningPublicPage() {
  const params = useParams();
  const slug = String((params as any).slug || "");
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({ name: "", phone: "", nationality: "", city: "", district: "" });
  const [result, setResult] = useState<{ ticketNumber: string; prizeWon: string; prizes: string[]; guestName: string } | null>(null);
  const [confetti, setConfetti] = useState(false);

  const { data: campaign, isLoading, error } = useQuery<Campaign>({
    queryKey: [`/api/public/opening/${slug}`],
    queryFn: async () => {
      const r = await fetch(`/api/public/opening/${slug}`);
      if (!r.ok) throw new Error((await r.json()).error || "الحملة غير موجودة");
      return r.json();
    },
    retry: false,
  });

  const submitM = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/public/opening/${slug}/register`, form);
      return r.json();
    },
    onSuccess: (data: any) => {
      setResult({
        ticketNumber: data.ticketNumber,
        prizeWon: data.prizeWon,
        prizes: data.prizes || [data.prizeWon],
        guestName: data.guestName || form.name,
      });
      setStep("spinning");
    },
    onError: (e: any) => alert(e.message || "حدث خطأ"),
  });

  // الانتقال إلى شاشة النتيجة بعد دوران العجلة
  useEffect(() => {
    if (step === "spinning") {
      const t = setTimeout(() => {
        setStep("result");
        setConfetti(true);
      }, 4200);
      return () => clearTimeout(t);
    }
  }, [step]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-pink-50 flex items-center justify-center" dir="rtl">
        <Loader2 className="w-10 h-10 animate-spin text-amber-600" />
      </div>
    );
  }
  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-pink-50 flex items-center justify-center p-6" dir="rtl">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8 space-y-3">
            <div className="text-5xl">😔</div>
            <h2 className="text-xl font-bold">عذراً، الحملة غير متاحة</h2>
            <p className="text-sm text-slate-600">قد تكون انتهت أو لم تعد نشطة. تواصل معنا للمزيد.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const validate = () => {
    if (form.name.trim().length < 2) return "الاسم مطلوب";
    if (form.phone.replace(/\D/g, "").length < 8) return "رقم الجوال غير صحيح";
    if (!form.nationality) return "اختر الجنسية";
    if (!form.city) return "اختر المدينة";
    if (form.district.trim().length < 2) return "الحي مطلوب";
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-pink-50 relative overflow-hidden" dir="rtl">
      {/* خلفية متحركة */}
      <FloatingShapes />
      {confetti && <Confetti />}

      <div className="relative z-10 max-w-md mx-auto p-4 py-6 min-h-screen flex flex-col">
        {/* الهيدر */}
        <div className="text-center mb-6">
          <div className="bg-white rounded-2xl shadow-lg p-4 inline-block mb-3">
            <img src={butterLogo} alt="باتر بيكري" className="h-20 w-auto mx-auto" data-testid="img-logo" />
          </div>
          <div className="inline-block animate-bounce-slow">
            <PartyPopper className="w-12 h-12 text-amber-600 mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-amber-900 mt-2">
            {campaign.headline || `احتفل معنا بافتتاح ${campaign.branchName}!`}
          </h1>
          <div className="flex items-center justify-center gap-3 text-sm text-slate-700 mt-2 flex-wrap">
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-pink-600" />{campaign.branchCity}</span>
            {campaign.openingDate && (
              <span className="flex items-center gap-1"><Calendar className="w-4 h-4 text-orange-600" />{campaign.openingDate}</span>
            )}
          </div>
          {campaign.description && (
            <p className="text-sm text-slate-600 mt-3 leading-relaxed">{campaign.description}</p>
          )}
        </div>

        {/* المحتوى حسب المرحلة */}
        <div className="flex-1">
          {step === "form" && (
            <Card className="shadow-xl border-2 border-amber-200">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2 text-amber-700 font-bold">
                  <Gift className="w-5 h-5" /> سجّل بياناتك واربح جائزة!
                </div>
                <div className="space-y-3">
                  <Field label="الاسم الكامل" required>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="اكتب اسمك الكريم" data-testid="input-name" className="h-12 text-base" />
                  </Field>
                  <Field label="رقم الجوال" required>
                    <Input type="tel" inputMode="numeric" value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="05xxxxxxxx" dir="ltr" data-testid="input-phone" className="h-12 text-base" />
                  </Field>
                  <Field label="الجنسية" required>
                    <Select value={form.nationality} onValueChange={(v) => setForm({ ...form, nationality: v })}>
                      <SelectTrigger data-testid="select-nationality" className="h-12 text-base">
                        <SelectValue placeholder="اختر الجنسية" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_NATIONALITIES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="المدينة" required>
                    <Select value={form.city} onValueChange={(v) => setForm({ ...form, city: v })}>
                      <SelectTrigger data-testid="select-city" className="h-12 text-base">
                        <SelectValue placeholder="اختر المدينة" />
                      </SelectTrigger>
                      <SelectContent>
                        {SAUDI_CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="الحي" required>
                    <Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}
                      placeholder="مثل: الياسمين، النخيل..." data-testid="input-district" className="h-12 text-base" />
                  </Field>
                </div>
                <Button
                  onClick={() => {
                    const err = validate();
                    if (err) { alert(err); return; }
                    submitM.mutate();
                  }}
                  disabled={submitM.isPending}
                  className="w-full h-14 text-base bg-gradient-to-r from-amber-500 to-pink-500 hover:from-amber-600 hover:to-pink-600 shadow-lg"
                  data-testid="btn-submit"
                >
                  {submitM.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> :
                    <><Sparkles className="w-5 h-5 ml-2" /> أكّد التسجيل وأدر العجلة</>}
                </Button>
                <p className="text-xs text-center text-slate-500">
                  بتسجيلك توافق على استلام دعوة الافتتاح عبر الجوال
                </p>
              </CardContent>
            </Card>
          )}

          {step === "spinning" && result && (
            <PrizeWheel prizes={result.prizes} winner={result.prizeWon} />
          )}

          {step === "result" && result && (
            <ResultCard result={result} branchName={campaign.branchName} openingDate={campaign.openingDate} />
          )}
        </div>

        <div className="text-center mt-6 text-xs text-slate-500">
          نشكرك على ثقتك — مخبز باتر 🧈
        </div>
      </div>

      <style>{`
        @keyframes float-slow { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-20px) rotate(10deg); } }
        @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes spin-wheel { from { transform: rotate(0deg); } to { transform: rotate(1800deg); } }
        @keyframes fall { to { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
        .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; }
        .animate-spin-wheel { animation: spin-wheel 4s cubic-bezier(0.17, 0.67, 0.31, 1) forwards; }
        .confetti-piece { position: fixed; top: -20px; animation: fall linear forwards; pointer-events: none; z-index: 50; }
      `}</style>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-bold">{label} {required && <span className="text-red-500">*</span>}</Label>
      {children}
    </div>
  );
}

function FloatingShapes() {
  const shapes = ["🎈", "🎉", "🎊", "✨", "🧁", "🍰", "⭐", "🎁"];
  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: 12 }).map((_, i) => {
        const left = (i * 37) % 100;
        const top = (i * 53) % 90;
        const delay = (i * 0.7) % 5;
        const size = 18 + (i % 4) * 6;
        return (
          <div key={i} className="absolute animate-float-slow opacity-30"
            style={{ left: `${left}%`, top: `${top}%`, fontSize: `${size}px`, animationDelay: `${delay}s` }}>
            {shapes[i % shapes.length]}
          </div>
        );
      })}
    </div>
  );
}

function Confetti() {
  const colors = ["#fbbf24", "#ec4899", "#f97316", "#10b981", "#3b82f6", "#a855f7"];
  return (
    <>
      {Array.from({ length: 60 }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 2;
        const duration = 3 + Math.random() * 3;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = 6 + Math.random() * 8;
        return (
          <div key={i} className="confetti-piece" style={{
            left: `${left}%`, width: `${size}px`, height: `${size}px`,
            background: color, animationDelay: `${delay}s`, animationDuration: `${duration}s`,
            borderRadius: i % 2 === 0 ? "50%" : "2px",
          }} />
        );
      })}
    </>
  );
}

function PrizeWheel({ prizes, winner }: { prizes: string[]; winner: string }) {
  // 8 شرائح كحد أقصى للوضوح
  const slices = prizes.slice(0, 8);
  while (slices.length < 6) slices.push("🎁");
  const colors = ["#fbbf24", "#ec4899", "#f97316", "#10b981", "#3b82f6", "#a855f7", "#ef4444", "#14b8a6"];
  const sliceAngle = 360 / slices.length;

  return (
    <Card className="shadow-2xl border-2 border-amber-300">
      <CardContent className="p-6 text-center space-y-4">
        <h3 className="text-lg font-bold text-amber-900">عجلة الحظ تدور... 🎡</h3>
        <div className="relative w-64 h-64 mx-auto">
          {/* المؤشر */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
            <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[24px] border-t-red-600 drop-shadow-lg" />
          </div>
          {/* العجلة */}
          <svg viewBox="0 0 200 200" className="w-full h-full animate-spin-wheel drop-shadow-xl">
            {slices.map((label, i) => {
              const startAngle = i * sliceAngle - 90;
              const endAngle = (i + 1) * sliceAngle - 90;
              const x1 = 100 + 95 * Math.cos((startAngle * Math.PI) / 180);
              const y1 = 100 + 95 * Math.sin((startAngle * Math.PI) / 180);
              const x2 = 100 + 95 * Math.cos((endAngle * Math.PI) / 180);
              const y2 = 100 + 95 * Math.sin((endAngle * Math.PI) / 180);
              const largeArc = sliceAngle > 180 ? 1 : 0;
              const midAngle = (startAngle + endAngle) / 2;
              const tx = 100 + 60 * Math.cos((midAngle * Math.PI) / 180);
              const ty = 100 + 60 * Math.sin((midAngle * Math.PI) / 180);
              return (
                <g key={i}>
                  <path d={`M100,100 L${x1},${y1} A95,95 0 ${largeArc} 1 ${x2},${y2} Z`}
                    fill={colors[i % colors.length]} stroke="#fff" strokeWidth="2" />
                  <text x={tx} y={ty} fill="#fff" fontSize="10" fontWeight="bold"
                    textAnchor="middle" dominantBaseline="middle"
                    transform={`rotate(${midAngle + 90} ${tx} ${ty})`}>
                    {label.length > 12 ? label.slice(0, 12) + "…" : label}
                  </text>
                </g>
              );
            })}
            <circle cx="100" cy="100" r="15" fill="#fff" stroke="#fbbf24" strokeWidth="3" />
          </svg>
        </div>
        <p className="text-sm text-slate-600 animate-pulse">انتظر لحظة... الجائزة في طريقها إليك 🎁</p>
      </CardContent>
    </Card>
  );
}

function ResultCard({ result, branchName, openingDate }:
  { result: { ticketNumber: string; prizeWon: string; guestName: string }; branchName: string; openingDate: string | null }) {
  return (
    <Card className="shadow-2xl border-2 border-pink-300 bg-gradient-to-br from-white to-pink-50">
      <CardContent className="p-6 text-center space-y-4">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
        <h2 className="text-2xl font-bold text-amber-900">مبروك يا {result.guestName}! 🎉</h2>
        <div className="bg-gradient-to-r from-amber-100 to-pink-100 rounded-xl p-4 space-y-2">
          <div className="text-sm text-slate-600">جائزتك هي:</div>
          <div className="text-3xl font-bold text-pink-600 flex items-center justify-center gap-2">
            <Gift className="w-7 h-7" /> {result.prizeWon}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border-2 border-dashed border-amber-400 space-y-1">
          <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
            <Ticket className="w-4 h-4" /> رقم تذكرة الضيف
          </div>
          <div className="text-3xl font-mono font-bold text-amber-700 tracking-widest">{result.ticketNumber}</div>
        </div>
        <div className="text-sm text-slate-700 leading-relaxed">
          احتفظ بهذا الرقم — قدّمه عند الافتتاح <br />
          لتسلّم هديتك من {branchName} {openingDate && `يوم ${openingDate}`}
        </div>
        <Button onClick={() => window.print()} variant="outline" className="w-full" data-testid="btn-save-ticket">
          احفظ التذكرة (لقطة شاشة أو طباعة)
        </Button>
      </CardContent>
    </Card>
  );
}
