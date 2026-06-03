import { useEffect, useRef, useState } from "react";
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
  Home,
  Sparkles,
  X,
  Smartphone,
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
  const colors = ["#f97316", "#fb923c", "#fbbf24", "#ffffff", "#34d399", "#f43f5e"];
  const parts = Array.from({ length: 150 }, () => ({
    x: canvas.width / 2 + (Math.random() - 0.5) * 120,
    y: canvas.height * 0.32,
    vx: (Math.random() - 0.5) * 13,
    vy: Math.random() * -13 - 4,
    size: Math.random() * 8 + 4,
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

function isIOSDevice() {
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
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

  // add-to-home-screen
  const installEvtRef = useRef<any>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  // interactive 3D tilt
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.get("welcome") === "1") setWelcome(true);
    if (search.get("existing") === "1") setAlreadyRegistered(true);

    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      installEvtRef.current = e;
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as any).standalone === true
    );
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
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

  const handleAddToHome = async () => {
    const evt = installEvtRef.current;
    if (evt) {
      evt.prompt();
      try {
        await evt.userChoice;
      } catch {
        /* ignore */
      }
      installEvtRef.current = null;
      setCanInstall(false);
    } else {
      setShowInstallHelp(true);
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
    setTilt({ rx: -py * 7, ry: px * 7 });
  };
  const onCardLeave = () => setTilt({ rx: 0, ry: 0 });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4" dir="rtl">
        <Card className="p-8 text-center bg-slate-800 border-slate-700 max-w-md">
          <h1 className="text-2xl font-bold text-white mb-2">البطاقة غير موجودة</h1>
          <p className="text-slate-400" data-testid="text-card-error">{error || "الرمز غير صالح"}</p>
        </Card>
      </div>
    );
  }

  const exhausted = card.remainingUses <= 0 || card.status === "exhausted";
  const disabled = card.status === "disabled";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 overflow-x-hidden" dir="rtl">
      <div className="w-full max-w-md">
        {welcome && (
          <div
            className="mb-4 rounded-2xl bg-gradient-to-r from-emerald-600/90 to-emerald-500/90 px-4 py-3 text-center shadow-lg shadow-emerald-900/30 animate-in fade-in slide-in-from-top-2 duration-500"
            data-testid="banner-welcome"
          >
            <p className="text-white font-bold flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5" />
              مبروك! تم تفعيل بطاقتك بنجاح 🎉
            </p>
            <p className="text-emerald-50 text-xs mt-1">احفظها على شاشتك الرئيسية لتستخدمها بسهولة</p>
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

        {/* Interactive card with 3D tilt + shine */}
        <div style={{ perspective: "1200px" }}>
          <div
            onPointerMove={onCardMove}
            onPointerLeave={onCardLeave}
            style={{
              transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
              transition: tilt.rx === 0 && tilt.ry === 0 ? "transform 0.4s ease" : "transform 0.05s linear",
            }}
            className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 rounded-3xl shadow-2xl relative overflow-hidden border border-slate-600/50 will-change-transform animate-in fade-in zoom-in-95 duration-500"
            data-testid="card-loyalty"
          >
            {/* moving shine */}
            <div
              className="pointer-events-none absolute inset-0 z-20 opacity-60"
              style={{
                background: `radial-gradient(circle at ${50 + tilt.ry * 4}% ${50 - tilt.rx * 4}%, rgba(255,255,255,0.18), transparent 45%)`,
              }}
            />
            <div className="h-2 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500" />
            <div className="relative z-10 p-4 sm:p-6">
              <div className="text-center mb-4">
                <div className="inline-block bg-white rounded-2xl p-3 shadow-xl">
                  <img
                    src="/butter-logo.png"
                    alt="BUTTER BAKERY"
                    className="h-12 mx-auto"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const next = e.currentTarget.nextElementSibling as HTMLElement;
                      if (next) next.classList.remove("hidden");
                    }}
                  />
                  <div className="hidden text-xl font-black text-orange-500 tracking-wider">BUTTER BAKERY</div>
                </div>
              </div>

              <div className="text-center mb-2">
                <p className="text-slate-300 text-sm">مرحباً</p>
                <h2 className="text-lg font-bold text-white" data-testid="text-customer-name">{card.customerName}</h2>
                <p className="text-orange-300 text-sm mt-1">{card.campaignName}</p>
              </div>

              <div className="text-center my-4">
                <div className="inline-block relative">
                  <div className="absolute inset-0 bg-orange-500 rounded-2xl blur-xl opacity-40" />
                  <div className="relative bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl px-10 py-5 shadow-2xl border border-orange-400/30">
                    <p className="text-orange-100 text-xs mb-1 font-medium">خصم حصري</p>
                    <p className="text-4xl font-black text-white drop-shadow-lg" data-testid="text-discount-value">{discountText}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center my-4">
                <div className={`bg-white p-4 rounded-2xl shadow-xl ${exhausted || disabled ? "opacity-40 grayscale" : ""}`}>
                  <QRCodeSVG value={card.code} size={140} level="H" includeMargin={false} fgColor="#1e293b" />
                </div>
              </div>

              <div className="text-center my-3">
                <p className="text-slate-400 text-xs mb-2">رمز البطاقة</p>
                <div className="inline-block bg-slate-700/50 rounded-xl px-8 py-3 border border-slate-600">
                  <code className="text-xl font-black tracking-widest text-white" data-testid="text-card-code">{card.code}</code>
                </div>
              </div>

              {/* Usage status */}
              <div className="text-center mt-4">
                {disabled ? (
                  <div className="bg-red-500/20 border border-red-500/40 rounded-lg py-2 px-4 inline-block">
                    <span className="text-red-300 font-medium" data-testid="status-card">البطاقة موقوفة</span>
                  </div>
                ) : exhausted ? (
                  <div className="bg-red-500/20 border border-red-500/40 rounded-lg py-2 px-4 inline-block">
                    <span className="text-red-300 font-medium" data-testid="status-card">تم استخدام جميع مرات الخصم</span>
                  </div>
                ) : (
                  <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-lg py-2 px-4 inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-300 font-medium" data-testid="status-card">
                      متبقٍ {card.remainingUses} من {card.maxUses}
                    </span>
                  </div>
                )}
              </div>

              <div className="text-center text-slate-300 text-sm mt-4 space-y-1">
                {card.validTo && (
                  <p className="flex items-center justify-center gap-2">
                    <Calendar className="h-4 w-4 text-orange-400" />
                    <span>صالح حتى: <strong className="text-white">{card.validTo}</strong></span>
                  </p>
                )}
                {card.minimumOrder && (
                  <p className="text-slate-400">الحد الأدنى للطلب: {Number(card.minimumOrder).toLocaleString()} ر.س</p>
                )}
              </div>

              {card.terms && (
                <div className="mt-4 text-center text-xs text-slate-400 bg-slate-700/30 rounded-lg p-3 border border-slate-700">
                  {card.terms}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {!isStandalone && (
            <Button
              className="w-full gap-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white py-6 text-lg rounded-xl shadow-lg shadow-orange-900/30"
              onClick={handleAddToHome}
              data-testid="button-add-home"
            >
              <Home className="h-5 w-5" />
              أضف البطاقة إلى شاشة الجوال
            </Button>
          )}

          <Button
            className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white py-6 text-lg rounded-xl"
            onClick={shareViaWhatsApp}
            data-testid="button-share-whatsapp"
          >
            <MessageCircle className="h-5 w-5" />
            مشاركة عبر واتساب
          </Button>

          {card.appleWalletAvailable && (
            <Button
              className="w-full gap-2 bg-black hover:bg-slate-900 text-white py-5 rounded-xl border border-slate-600"
              onClick={handleAddToAppleWallet}
              data-testid="button-add-apple-wallet"
            >
              <Wallet className="h-5 w-5" />
              إضافة إلى محفظة آبل
            </Button>
          )}

          {card.googleWalletAvailable && (
            <Button
              className="w-full gap-2 bg-slate-700 hover:bg-slate-600 text-white py-5 rounded-xl border border-slate-600"
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
            className="w-full gap-2 py-5 rounded-xl bg-slate-800 border-slate-600 text-white hover:bg-slate-700"
            onClick={handleShare}
            data-testid="button-share"
          >
            <Share2 className="h-5 w-5" />
            مشاركة
          </Button>
        </div>

        <div className="text-center mt-8 text-slate-500 text-sm">
          <p className="text-orange-400 font-medium">BUTTER BAKERY</p>
          <p className="text-xs mt-1">شركة الزبد الأفضل التجارية</p>
        </div>
      </div>

      {/* Add-to-home-screen instructions (fallback when no native prompt) */}
      {showInstallHelp && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowInstallHelp(false)}
          data-testid="modal-install-help"
        >
          <div
            className="bg-slate-800 border border-slate-600 rounded-3xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-orange-400" />
                أضف البطاقة إلى الشاشة الرئيسية
              </h3>
              <button
                onClick={() => setShowInstallHelp(false)}
                className="text-slate-400 hover:text-white"
                data-testid="button-close-install-help"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {isIOSDevice() ? (
              <ol className="text-slate-200 space-y-3 text-sm list-decimal pr-5">
                <li>اضغط على زر المشاركة <span className="text-orange-300">(المربع مع السهم لأعلى)</span> في شريط Safari بالأسفل.</li>
                <li>اختر <strong className="text-white">«إضافة إلى الشاشة الرئيسية»</strong>.</li>
                <li>اضغط <strong className="text-white">«إضافة»</strong> — ستظهر أيقونة البطاقة على شاشتك.</li>
              </ol>
            ) : (
              <ol className="text-slate-200 space-y-3 text-sm list-decimal pr-5">
                <li>افتح قائمة المتصفح <span className="text-orange-300">(النقاط الثلاث ⋮)</span> بالأعلى.</li>
                <li>اختر <strong className="text-white">«إضافة إلى الشاشة الرئيسية»</strong> أو <strong className="text-white">«تثبيت التطبيق»</strong>.</li>
                <li>أكّد الإضافة — ستظهر أيقونة البطاقة على شاشتك.</li>
              </ol>
            )}
            <Button
              className="w-full mt-5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-5"
              onClick={() => setShowInstallHelp(false)}
              data-testid="button-install-help-ok"
            >
              تمام، فهمت
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
