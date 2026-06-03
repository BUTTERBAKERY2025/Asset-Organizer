import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Share2, Calendar, MessageCircle, Loader2, CheckCircle2 } from "lucide-react";

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

export default function LoyaltyCardPage() {
  const [, params] = useRoute("/card/:code");
  const code = params?.code;
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const discountText = card
    ? card.discountType === "gift"
      ? (card.description || "هدية مجانية")
      : card.discountType === "percentage"
      ? `${Number(card.discountValue)}%`
      : `${Number(card.discountValue).toLocaleString()} ر.س`
    : "";

  const [googleLoading, setGoogleLoading] = useState(false);

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
    const cardUrl = window.location.href;
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
          url: window.location.href,
        });
      } catch {
        /* cancelled */
      }
    } else {
      shareViaWhatsApp();
    }
  };

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 rounded-3xl shadow-2xl relative overflow-hidden border border-slate-600/50">
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
                <QRCodeSVG
                  value={card.code}
                  size={140}
                  level="H"
                  includeMargin={false}
                  fgColor="#1e293b"
                />
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

        <div className="mt-6 space-y-3">
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
              {googleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Wallet className="h-5 w-5" />
              )}
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
    </div>
  );
}
