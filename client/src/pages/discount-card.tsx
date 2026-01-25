import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Download, Share2 } from "lucide-react";

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !discount) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">الخصم غير موجود</h1>
          <p className="text-gray-600">رمز الخصم غير صالح أو منتهي الصلاحية</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Discount Card */}
        <div className="bg-gradient-to-br from-amber-500 via-amber-400 to-yellow-500 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-4 left-4 w-24 h-24 border-4 border-white/20 rounded-full" />
          <div className="absolute bottom-4 right-4 w-20 h-20 border-4 border-white/20 rounded-full" />
          
          <div className="relative z-10">
            {/* Logo */}
            <div className="text-center mb-4">
              <div className="inline-block">
                <img 
                  src="/butter-logo.png" 
                  alt="BUTTER BAKERY" 
                  className="h-16 mx-auto mb-2"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden text-2xl font-black tracking-wider">
                  BUTTER BAKERY
                </div>
              </div>
              <h2 className="text-xl font-bold mt-2">{discount.name}</h2>
            </div>

            {/* Discount Value */}
            <div className="text-center my-6">
              <div className="inline-block bg-white text-amber-600 rounded-2xl px-10 py-5 shadow-lg">
                <p className="text-sm text-amber-500 mb-1">خصم</p>
                <p className="text-5xl font-black">
                  {discount.discountType === "percentage" 
                    ? `${discount.discountValue}%` 
                    : `${Number(discount.discountValue).toLocaleString()} ر.س`}
                </p>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex justify-center my-6">
              <div className="bg-white p-4 rounded-2xl shadow-lg">
                <QRCodeSVG 
                  value={`${window.location.origin}/discount/${discount.code}`}
                  size={140}
                  level="H"
                  includeMargin={false}
                />
              </div>
            </div>

            {/* Code */}
            <div className="text-center my-4">
              <p className="text-white/80 text-sm mb-2">رمز الخصم</p>
              <div className="inline-block bg-white/20 backdrop-blur-sm rounded-xl px-8 py-4 border border-white/30">
                <code className="text-3xl font-black tracking-widest">{discount.code}</code>
              </div>
            </div>

            {/* Validity */}
            <div className="text-center text-white/90 text-sm mt-6 space-y-1">
              <p className="font-medium">صالح حتى: {discount.validTo}</p>
              {discount.minimumOrder && (
                <p>الحد الأدنى للطلب: {Number(discount.minimumOrder).toLocaleString()} ر.س</p>
              )}
            </div>

            {/* Terms */}
            {discount.terms && (
              <div className="mt-4 text-center text-xs text-white/70 bg-white/10 rounded-lg p-3">
                {discount.terms}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 space-y-3">
          <Button 
            className="w-full gap-2 bg-black hover:bg-gray-800 text-white py-6 text-lg rounded-xl"
            onClick={handleAddToWallet}
          >
            <Wallet className="h-5 w-5" />
            إضافة إلى المحفظة
          </Button>
          
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline"
              className="gap-2 py-5 rounded-xl"
              onClick={handleShare}
            >
              <Share2 className="h-5 w-5" />
              مشاركة
            </Button>
            <Button 
              variant="outline"
              className="gap-2 py-5 rounded-xl"
              onClick={() => window.print()}
            >
              <Download className="h-5 w-5" />
              حفظ
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-amber-700 text-sm">
          <p>BUTTER BAKERY</p>
          <p className="text-xs text-amber-600/70 mt-1">شركة الزبد الأفضل التجارية</p>
        </div>
      </div>
    </div>
  );
}
