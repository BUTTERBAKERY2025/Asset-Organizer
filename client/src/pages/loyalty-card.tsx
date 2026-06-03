import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  Share2,
  Calendar,
  MessageCircle,
  Loader2,
  CheckCircle2,
  Sparkles,
  Crown,
  QrCode,
  RotateCcw,
} from "lucide-react";

interface CardData {
  code: string;
  maxUses: number;
  usedCount: number;
  remainingUses: number;
  status: string;
  customerName: string;
  campaignName: string;
  description?: string;
  discountType: string;
  discountValue: string;
  minimumOrder?: string;
  terms?: string;
  validTo?: string;
  campaignStatus: string;
  appleWalletAvailable?: boolean;
  googleWalletAvailable?: boolean;
}

// Lightweight, dependency-free confetti burst.
function launchConfetti() {
  if (typeof document === "undefined") return;
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  const colors = ["#f97316", "#fb923c", "#fbbf24", "#fde68a", "#ffffff", "#f59e0b"];
  const parts = Array.from({ length: 160 }, () => ({
    x: canvas.width / 2 + (Math.random() - 0.5) * 140,
    y: canvas.height * 0.3,
    vx: (Math.random() - 0.5) * 14,
    vy: Math.random() * -14 - 4,
    size: Math.random() * 9 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.35,
  }));
  const start = performance.now();
  let raf = 0;
  const tick = (t: number) => {
    const elapsed = t - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.vy += 0.32;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - elapsed / 3200);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    if (elapsed < 3300) {
      raf = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(raf);
      canvas.remove();
    }
  };
  raf = requestAnimationFrame(tick);
}

export default function LoyaltyCardPage() {
  const [, params] = useRoute("/card/:code");
  const code = params?.code;
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  // welcome / already-registered banners (read once from the URL)
  const [welcome, setWelcome] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  // interactive flip + 3D tilt
  const [flipped, setFlipped] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.get("welcome") === "1") setWelcome(true);
    if (search.get("existing") === "1") setAlreadyRegistered(true);
  }, []);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/public/loyalty/card/${code}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "البطاقة غير موجودة");
        return data;
      })
      .then((data) => {
        setCard(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [code]);

  // Fire confetti once the card has loaded after a fresh registration.
  useEffect(() => {
    if (card && welcome) {
      const id = setTimeout(launchConfetti, 250);
      return () => clearTimeout(id);
    }
  }, [card, welcome]);

  const discountText = card
    ? card.discountType === "gift"
      ? card.description || "هدية مجانية"
      : card.discountType === "percentage"
      ? `${Number(card.discountValue)}%`
      : `${Number(card.discountValue).toLocaleString()} ر.س`
    : "";

  const handleAddToAppleWallet = () => {
    if (!code) return;
    window.location.href = `/api/public/loyalty/card/${code}/apple.pkpass`;
  };

  const handleAddToGoogleWallet = async () => {
    if (!code || googleLoading) return;
    setGoogleLoading(true);
    try {
      const res = await fetch(`/api/public/loyalty/card/${code}/google`);
      const data = await res.json();
      if (!res.ok || !data.saveUrl) {
        throw new Error(data.error || "تعذّر إنشاء رابط جوجل");
      }
      window.open(data.saveUrl, "_blank");
    } catch (err) {
      alert(err instanceof Error ? err.message : "تعذّر إنشاء رابط جوجل");
    } finally {
      setGoogleLoading(false);
    }
  };

  const shareViaWhatsApp = () => {
    if (!card) return;
    const cardUrl = window.location.origin + `/card/${card.code}`;
    const message =
      `🎁 *بطاقتي من BUTTER BAKERY*\n\n` +
      `📍 ${card.campaignName}\n` +
      `💰 خصم: ${discountText}\n` +
      `🔖 الرمز: ${card.code}\n` +
      `🔁 الاستخدامات المتبقية: ${card.remainingUses}\n\n` +
      `👆 اضغط على الرابط لعرض البطاقة:\n${cardUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleShare = async () => {
    if (navigator.share && card) {
      try {
        await navigator.share({
          title: `بطاقة ${card.campaignName}`,
          text: `رمز الخصم الخاص بي: ${card.code}`,
          url: window.location.origin + `/card/${card.code}`,
        });
      } catch {
        /* cancelled */
      }
    } else {
      shareViaWhatsApp();
    }
  };

  const onCardMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: -py * 8, ry: px * 8 });
  };
  const onCardLeave = () => setTilt({ rx: 0, ry: 0 });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1206] via-[#0f0a04] to-black flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1206] via-[#0f0a04] to-black flex items-center justify-center p-4" dir="rtl">
        <Card className="p-8 text-center bg-slate-900 border-slate-700 max-w-md">
          <h1 className="text-2xl font-bold text-white mb-2">البطاقة غير موجودة</h1>
          <p className="text-slate-400" data-testid="text-card-error">{error || "الرمز غير صالح"}</p>
        </Card>
      </div>
    );
  }

  const exhausted = card.remainingUses <= 0 || card.status === "exhausted";
  const disabled = card.status === "disabled";
  const usedPct = card.maxUses > 0 ? Math.min(100, (card.usedCount / card.maxUses) * 100) : 0;

  return (
    <div
      className="min-h-screen relative flex items-center justify-center p-4 overflow-x-hidden bg-gradient-to-br from-[#1c1407] via-[#0f0a04] to-black"
      dir="rtl"
    >
      {/* component-scoped keyframes */}
      <style>{`
        @keyframes butterShimmer { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes butterFloat { 0%,100%{transform:translateY(0) rotate(0deg);opacity:.5} 50%{transform:translateY(-14px) rotate(12deg);opacity:1} }
        @keyframes butterGlow { 0%,100%{opacity:.35} 50%{opacity:.7} }
      `}</style>

      {/* ambient golden glow blobs */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-amber-500/20 blur-3xl" style={{ animation: "butterGlow 6s ease-in-out infinite" }} />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-orange-600/20 blur-3xl" style={{ animation: "butterGlow 7s ease-in-out infinite" }} />

      <div className="w-full max-w-md relative z-10">
        {welcome && (
          <div
            className="mb-4 rounded-2xl bg-gradient-to-r from-emerald-600/90 to-emerald-500/90 px-4 py-3 text-center shadow-lg shadow-emerald-900/30 animate-in fade-in slide-in-from-top-2 duration-500"
            data-testid="banner-welcome"
          >
            <p className="text-white font-bold flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5" />
              مبروك! تم تفعيل بطاقتك بنجاح 🎉
            </p>
            <p className="text-emerald-50 text-xs mt-1">استمتع بمزاياك الحصرية لدى BUTTER BAKERY</p>
          </div>
        )}

        {alreadyRegistered && (
          <div
            className="mb-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 px-4 py-3 text-center"
            data-testid="banner-already-registered"
          >
            <p className="text-amber-200 font-medium">هذا الرقم مسجّل مسبقاً — هذه بطاقتك 👇</p>
          </div>
        )}

        {/* Interactive flip card with 3D tilt */}
        <div style={{ perspective: "1500px" }} className="select-none">
          <div
            onPointerMove={onCardMove}
            onPointerLeave={onCardLeave}
            style={{
              transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
              transition: tilt.rx === 0 && tilt.ry === 0 ? "transform 0.4s ease" : "transform 0.05s linear",
            }}
            className="will-change-transform"
          >
            <div
              onClick={() => setFlipped((f) => !f)}
              className="relative cursor-pointer transition-transform duration-700 ease-out animate-in fade-in zoom-in-95"
              style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
              data-testid="card-loyalty"
              role="button"
              aria-label="اقلب البطاقة"
            >
              {/* ===================== FRONT ===================== */}
              <div style={{ backfaceVisibility: "hidden" }}>
                <div
                  className="rounded-[28px] p-[2px] shadow-2xl shadow-amber-950/50"
                  style={{
                    background: "linear-gradient(120deg,#fde68a,#f59e0b,#b45309,#fbbf24,#fde68a)",
                    backgroundSize: "300% 300%",
                    animation: "butterShimmer 6s ease infinite",
                  }}
                >
                  <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#26190a] via-[#1a1206] to-[#0d0903] p-6">
                    {/* moving holographic shine */}
                    <div
                      className="pointer-events-none absolute inset-0 z-20"
                      style={{
                        background: `radial-gradient(circle at ${50 + tilt.ry * 5}% ${50 - tilt.rx * 5}%, rgba(255,236,179,0.22), transparent 42%)`,
                      }}
                    />
                    {/* floating sparkles */}
                    <Sparkles className="absolute top-6 left-6 h-4 w-4 text-amber-300/70" style={{ animation: "butterFloat 4s ease-in-out infinite" }} />
                    <Sparkles className="absolute bottom-24 left-10 h-3 w-3 text-orange-300/60" style={{ animation: "butterFloat 5s ease-in-out infinite .8s" }} />
                    <Sparkles className="absolute top-28 right-8 h-3.5 w-3.5 text-amber-200/60" style={{ animation: "butterFloat 6s ease-in-out infinite .4s" }} />

                    <div className="relative z-10">
                      {/* header: brand + tier */}
                      <div className="flex items-center justify-between">
                        <div className="bg-white rounded-2xl p-2.5 shadow-lg">
                          <img
                            src="/butter-logo.png"
                            alt="BUTTER BAKERY"
                            className="h-9"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              const next = e.currentTarget.nextElementSibling as HTMLElement;
                              if (next) next.classList.remove("hidden");
                            }}
                          />
                          <div className="hidden text-base font-black text-orange-500 tracking-wider">BUTTER</div>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5">
                          <Crown className="h-4 w-4 text-amber-300" />
                          <span className="text-xs font-bold text-amber-200">عضوية ذهبية</span>
                        </div>
                      </div>

                      {/* discount hero */}
                      <div className="text-center my-7">
                        <p className="text-amber-200/80 text-xs font-semibold tracking-wider mb-2">خصمك الحصري</p>
                        <div className="relative inline-block">
                          <div className="absolute inset-0 bg-amber-400 rounded-2xl blur-2xl opacity-30" />
                          <p
                            className="relative text-6xl font-black tracking-tight bg-gradient-to-b from-amber-100 via-amber-300 to-orange-400 bg-clip-text text-transparent drop-shadow"
                            data-testid="text-discount-value"
                          >
                            {discountText}
                          </p>
                        </div>
                      </div>

                      {/* holder name */}
                      <div className="mb-5">
                        <p className="text-amber-200/60 text-[11px] tracking-wider mb-1">حامل البطاقة</p>
                        <h2 className="text-xl font-bold text-white tracking-wide" data-testid="text-customer-name">
                          {card.customerName}
                        </h2>
                        <p className="text-amber-300/80 text-xs mt-0.5">{card.campaignName}</p>
                      </div>

                      {/* usage meter */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1.5">
                          <span className="text-amber-200/70">الاستخدامات</span>
                          {disabled ? (
                            <span className="text-red-300 font-semibold" data-testid="status-card">موقوفة</span>
                          ) : exhausted ? (
                            <span className="text-red-300 font-semibold" data-testid="status-card">انتهت</span>
                          ) : (
                            <span className="text-emerald-300 font-semibold" data-testid="status-card">
                              متبقٍ {card.remainingUses} من {card.maxUses}
                            </span>
                          )}
                        </div>
                        <div className="h-2 w-full rounded-full bg-black/40 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${exhausted || disabled ? "bg-red-500/70" : "bg-gradient-to-r from-amber-300 to-orange-500"}`}
                            style={{ width: `${100 - usedPct}%` }}
                          />
                        </div>
                      </div>

                      {/* flip hint */}
                      <div className="mt-6 flex items-center justify-center gap-2 text-amber-200/70 text-xs">
                        <QrCode className="h-4 w-4" />
                        <span>اضغط لعرض الباركود</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ===================== BACK ===================== */}
              <div
                className="absolute inset-0"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <div
                  className="h-full rounded-[28px] p-[2px] shadow-2xl shadow-amber-950/50"
                  style={{
                    background: "linear-gradient(120deg,#fde68a,#f59e0b,#b45309,#fbbf24,#fde68a)",
                    backgroundSize: "300% 300%",
                    animation: "butterShimmer 6s ease infinite",
                  }}
                >
                  <div className="h-full overflow-hidden rounded-[26px] bg-gradient-to-br from-[#26190a] via-[#1a1206] to-[#0d0903] p-6 flex flex-col items-center justify-center">
                    <p className="text-amber-200/80 text-xs font-semibold tracking-wider mb-4">امسح الباركود عند الدفع</p>
                    <div className={`bg-white p-4 rounded-2xl shadow-xl ${exhausted || disabled ? "opacity-40 grayscale" : ""}`}>
                      <QRCodeSVG value={card.code} size={150} level="H" includeMargin={false} fgColor="#1a1206" />
                    </div>

                    <div className="mt-4 text-center">
                      <p className="text-amber-200/60 text-[11px] mb-1">رمز البطاقة</p>
                      <code className="text-lg font-black tracking-[0.2em] text-white" data-testid="text-card-code">
                        {card.code}
                      </code>
                    </div>

                    <div className="mt-4 w-full space-y-1.5 text-center text-xs text-amber-100/80">
                      {card.validTo && (
                        <p className="flex items-center justify-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-amber-400" />
                          <span>صالحة حتى: <strong className="text-white">{card.validTo}</strong></span>
                        </p>
                      )}
                      {card.minimumOrder && (
                        <p className="text-amber-200/60">الحد الأدنى للطلب: {Number(card.minimumOrder).toLocaleString()} ر.س</p>
                      )}
                    </div>

                    {card.terms && (
                      <p className="mt-3 text-center text-[11px] text-amber-200/50 leading-relaxed line-clamp-3">{card.terms}</p>
                    )}

                    <div className="mt-5 flex items-center justify-center gap-2 text-amber-200/70 text-xs">
                      <RotateCcw className="h-4 w-4" />
                      <span>اضغط للرجوع</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* actions */}
        <div className="mt-6 space-y-3">
          <Button
            className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-6 text-base font-bold rounded-2xl shadow-lg shadow-orange-900/30"
            onClick={() => setFlipped((f) => !f)}
            data-testid="button-flip-card"
          >
            <RotateCcw className="h-5 w-5" />
            {flipped ? "عرض تفاصيل البطاقة" : "عرض الباركود"}
          </Button>

          <Button
            className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white py-6 text-base rounded-2xl"
            onClick={shareViaWhatsApp}
            data-testid="button-share-whatsapp"
          >
            <MessageCircle className="h-5 w-5" />
            مشاركة عبر واتساب
          </Button>

          {card.appleWalletAvailable && (
            <Button
              className="w-full gap-2 bg-black hover:bg-slate-900 text-white py-5 rounded-2xl border border-slate-600"
              onClick={handleAddToAppleWallet}
              data-testid="button-add-apple-wallet"
            >
              <Wallet className="h-5 w-5" />
              إضافة إلى محفظة آبل
            </Button>
          )}

          {card.googleWalletAvailable && (
            <Button
              className="w-full gap-2 bg-slate-700 hover:bg-slate-600 text-white py-5 rounded-2xl border border-slate-600"
              onClick={handleAddToGoogleWallet}
              disabled={googleLoading}
              data-testid="button-add-google-wallet"
            >
              {googleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wallet className="h-5 w-5" />}
              حفظ في محفظة جوجل
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full gap-2 py-5 rounded-2xl bg-white/5 border-amber-500/30 text-amber-100 hover:bg-white/10"
            onClick={handleShare}
            data-testid="button-share"
          >
            <Share2 className="h-5 w-5" />
            مشاركة
          </Button>
        </div>

        <div className="text-center mt-8 text-amber-200/40 text-sm">
          <p className="text-amber-400 font-bold tracking-wide">BUTTER BAKERY</p>
          <p className="text-xs mt-1">شركة الزبد الأفضل التجارية</p>
        </div>
      </div>
    </div>
  );
}
