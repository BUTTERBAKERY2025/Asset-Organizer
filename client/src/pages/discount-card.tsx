import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Download, Share2, Calendar, MessageCircle } from "lucide-react";

// Get the production site URL
const getSiteUrl = () => {
  const envUrl = import.meta.env.VITE_PUBLIC_SITE_URL;
  if (envUrl) return envUrl;
  return window.location.origin;
};

interface DiscountData {
  id: number;
  code: string;
  name: string;
  discountType: string;
  discountValue: string;
  validFrom: string;
  validTo: string;
  terms?: string;
  minimumOrder?: string;
}

export default function DiscountCardPage() {
  const [, params] = useRoute("/discount/:code");
  const [discount, setDiscount] = useState<DiscountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params?.code) {
      fetch(`/api/social-responsibility/discounts/code/${params.code}`)
        .then(res => {
          if (!res.ok) throw new Error("الخصم غير موجود");
          return res.json();
        })
        .then(data => {
          setDiscount(data);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [params?.code]);

  const handleAddToWallet = () => {
    alert("ميزة إضافة المحفظة قيد التطوير");
  };

  const handleShare = async () => {
    if (navigator.share && discount) {
      try {
        await navigator.share({
          title: `خصم ${discount.name}`,
          text: `استخدم رمز الخصم: ${discount.code} للحصول على ${discount.discountType === "percentage" ? `${discount.discountValue}%` : `${discount.discountValue} ر.س`} خصم!`,
          url: window.location.href,
        });
      } catch (err) {
        console.log("Share cancelled");
      }
    }
  };

  const shareViaWhatsApp = () => {
    if (discount) {
      const cardUrl = window.location.href;
      const message = `🎁 *كارد خصم من BUTTER BAKERY*\n\n` +
        `📍 ${discount.name}\n` +
        `💰 خصم: ${discount.discountType === "percentage" ? `${discount.discountValue}%` : `${discount.discountValue} ر.س`}\n` +
        `🔖 الرمز: ${discount.code}\n` +
        `📅 صالح حتى: ${discount.validTo}\n\n` +
        `👆 اضغط على الرابط لعرض الكارد:\n${cardUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !discount) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <Card className="p-8 text-center bg-slate-800 border-slate-700">
          <h1 className="text-2xl font-bold text-white mb-2">الخصم غير موجود</h1>
          <p className="text-slate-400">رمز الخصم غير صالح أو منتهي الصلاحية</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Discount Card */}
        <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 rounded-3xl shadow-2xl relative overflow-hidden border border-slate-600/50">
          {/* Top accent line */}
          <div className="h-2 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500" />
          
          {/* Decorative Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-0 left-0 w-full h-full" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>
          
          <div className="relative z-10 p-4 sm:p-6">
            {/* Logo */}
            <div className="text-center mb-4 sm:mb-6">
              <div className="inline-block bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xl">
                <img 
                  src="/butter-logo.png" 
                  alt="BUTTER BAKERY" 
                  className="h-12 sm:h-16 mx-auto"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const next = e.currentTarget.nextElementSibling as HTMLElement;
                    if (next) next.classList.remove('hidden');
                  }}
                />
                <div className="hidden text-xl sm:text-2xl font-black text-orange-500 tracking-wider">
                  BUTTER BAKERY
                </div>
              </div>
            </div>

            {/* Discount Name */}
            <div className="text-center mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-white">{discount.name}</h2>
            </div>

            {/* Discount Value */}
            <div className="text-center my-4 sm:my-6">
              <div className="inline-block relative">
                <div className="absolute inset-0 bg-orange-500 rounded-xl sm:rounded-2xl blur-xl opacity-40" />
                <div className="relative bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl sm:rounded-2xl px-8 sm:px-12 py-4 sm:py-6 shadow-2xl border border-orange-400/30">
                  <p className="text-orange-100 text-xs sm:text-sm mb-1 font-medium">خصم حصري</p>
                  <p className="text-3xl sm:text-4xl md:text-5xl font-black text-white drop-shadow-lg">
                    {discount.discountType === "percentage" 
                      ? `${discount.discountValue}%` 
                      : `${Number(discount.discountValue).toLocaleString()} ر.س`}
                  </p>
                </div>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex justify-center my-4 sm:my-6">
              <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-xl">
                <QRCodeSVG 
                  value={window.location.href}
                  size={100}
                  level="H"
                  includeMargin={false}
                  fgColor="#1e293b"
                  className="w-[100px] h-[100px] sm:w-[130px] sm:h-[130px]"
                />
              </div>
            </div>

            {/* Code */}
            <div className="text-center my-3 sm:my-4">
              <p className="text-slate-400 text-xs sm:text-sm mb-2">رمز الخصم</p>
              <div className="inline-block bg-slate-700/50 backdrop-blur-sm rounded-lg sm:rounded-xl px-6 sm:px-8 py-3 sm:py-4 border border-slate-600">
                <code className="text-lg sm:text-xl md:text-2xl font-black tracking-widest text-white">{discount.code}</code>
              </div>
            </div>

            {/* Validity */}
            <div className="text-center text-slate-300 text-sm mt-6 space-y-1">
              <p className="flex items-center justify-center gap-2">
                <Calendar className="h-4 w-4 text-orange-400" />
                <span>صالح حتى: <strong className="text-white">{discount.validTo}</strong></span>
              </p>
              {discount.minimumOrder && (
                <p className="text-slate-400">الحد الأدنى للطلب: {Number(discount.minimumOrder).toLocaleString()} ر.س</p>
              )}
            </div>

            {/* Terms */}
            {discount.terms && (
              <div className="mt-4 text-center text-xs text-slate-400 bg-slate-700/30 rounded-lg p-3 border border-slate-700">
                {discount.terms}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 space-y-3">
          <Button 
            className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white py-6 text-lg rounded-xl"
            onClick={shareViaWhatsApp}
          >
            <MessageCircle className="h-5 w-5" />
            مشاركة عبر واتساب
          </Button>
          
          <Button 
            className="w-full gap-2 bg-slate-700 hover:bg-slate-600 text-white py-5 rounded-xl border border-slate-600"
            onClick={handleAddToWallet}
          >
            <Wallet className="h-5 w-5" />
            إضافة إلى المحفظة
          </Button>
          
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline"
              className="gap-2 py-5 rounded-xl bg-slate-800 border-slate-600 text-white hover:bg-slate-700"
              onClick={handleShare}
            >
              <Share2 className="h-5 w-5" />
              مشاركة
            </Button>
            <Button 
              variant="outline"
              className="gap-2 py-5 rounded-xl bg-slate-800 border-slate-600 text-white hover:bg-slate-700"
              onClick={() => window.print()}
            >
              <Download className="h-5 w-5" />
              حفظ
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-slate-500 text-sm">
          <p className="text-orange-400 font-medium">BUTTER BAKERY</p>
          <p className="text-xs mt-1">شركة الزبد الأفضل التجارية</p>
        </div>
      </div>
    </div>
  );
}
