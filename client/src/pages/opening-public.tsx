import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PartyPopper, Gift, Sparkles, Loader2, CheckCircle2, MapPin, Calendar, Ticket, Check, ChevronsUpDown, User, UserRound } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import butterLogo from "@/assets/butter-logo.png";

interface Campaign {
  id: number; slug: string; title: string; branchName: string; branchCity: string;
  branchAddress: string | null; openingDate: string | null; headline: string | null;
  description: string | null; prizesJson: string | null;
}

const SAUDI_CITIES = [
  "الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الخبر", "الظهران", "الطائف",
  "بريدة", "عنيزة", "الرس", "حائل", "تبوك", "أبها", "خميس مشيط", "نجران", "جازان", "الباحة",
  "عرعر", "سكاكا", "القريات", "الجوف", "ينبع", "الجبيل", "رابغ", "الأحساء", "الهفوف", "حفر الباطن",
  "الخرج", "المجمعة", "الزلفي", "الدوادمي", "وادي الدواسر", "الأفلاج", "شقراء", "ضرما", "العلا",
  "بدر", "العيون", "بيشة", "محايل عسير", "النماص", "تنومة", "بلجرشي", "المخواة", "صبيا", "صامطة",
  "أبو عريش", "فرسان", "رفحاء", "طريف", "دومة الجندل", "أملج", "تيماء", "ضباء", "حقل", "الوجه",
  "أخرى",
];

type Step = "form" | "spinning" | "result";

export default function OpeningPublicPage() {
  const params = useParams();
  const slug = String((params as any).slug || "");
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({ name: "", phone: "", gender: "", city: "", district: "" });
  const [cityOpen, setCityOpen] = useState(false);
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
    if (!form.gender) return "اختر النوع";
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
          <img src={butterLogo} alt="Butter Bakery" className="h-28 sm:h-32 w-auto mx-auto drop-shadow-sm" data-testid="img-logo" />
          <div className="inline-block animate-bounce-slow mt-1">
            <PartyPopper className="w-10 h-10 text-amber-600 mx-auto" />
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
                  <Field label="النوع" required>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setForm({ ...form, gender: "male" })}
                        data-testid="btn-gender-male"
                        className={`h-14 rounded-lg border-2 font-bold flex items-center justify-center gap-2 transition-all ${
                          form.gender === "male" ? "border-blue-500 bg-blue-50 text-blue-700 shadow-md" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}>
                        <User className="w-5 h-5" /> ذكر
                      </button>
                      <button type="button" onClick={() => setForm({ ...form, gender: "female" })}
                        data-testid="btn-gender-female"
                        className={`h-14 rounded-lg border-2 font-bold flex items-center justify-center gap-2 transition-all ${
                          form.gender === "female" ? "border-pink-500 bg-pink-50 text-pink-700 shadow-md" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}>
                        <UserRound className="w-5 h-5" /> أنثى
                      </button>
                    </div>
                  </Field>
                  <Field label="المدينة" required>
                    <Popover open={cityOpen} onOpenChange={setCityOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="h-12 w-full justify-between text-base font-normal"
                          data-testid="btn-city-picker">
                          <span className={form.city ? "" : "text-slate-400"}>
                            {form.city || "اختر أو ابحث عن المدينة"}
                          </span>
                          <ChevronsUpDown className="w-4 h-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                        <Command>
                          <CommandInput placeholder="ابحث عن مدينتك..." className="h-11 text-base" />
                          <CommandList className="max-h-64">
                            <CommandEmpty>لا توجد نتائج. اختر "أخرى" أو اكتب الحي يدوياً.</CommandEmpty>
                            <CommandGroup>
                              {SAUDI_CITIES.map(c => (
                                <CommandItem key={c} value={c}
                                  onSelect={() => { setForm({ ...form, city: c }); setCityOpen(false); }}
                                  data-testid={`city-option-${c}`}
                                  className="text-base py-3">
                                  <Check className={`w-4 h-4 ml-2 ${form.city === c ? "opacity-100" : "opacity-0"}`} />
                                  {c}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
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
          نشكرك على ثقتك — BUTTER BAKERY
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
