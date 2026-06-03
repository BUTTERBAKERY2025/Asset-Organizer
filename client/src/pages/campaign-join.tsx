import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift, Loader2, Phone, User, MapPin } from "lucide-react";

interface CampaignInfo {
  name: string;
  description?: string;
  discountType: string;
  discountValue: string;
  maxUsesPerCustomer: number;
  minimumOrder?: string;
  terms?: string;
}

export default function CampaignJoinPage() {
  const [, params] = useRoute("/join/:slug");
  const [, navigate] = useLocation();
  const slug = params?.slug;

  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [city, setCity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/loyalty/campaign/${slug}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "الحملة غير موجودة");
        return data;
      })
      .then((data) => {
        setCampaign(data);
        setLoading(false);
      })
      .catch((err) => {
        setLoadError(err.message);
        setLoading(false);
      });
  }, [slug]);

  const discountText = campaign
    ? campaign.discountType === "gift"
      ? (campaign.description || "هدية مجانية")
      : campaign.discountType === "percentage"
      ? `${Number(campaign.discountValue)}%`
      : `${Number(campaign.discountValue).toLocaleString()} ر.س`
    : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (name.trim().length < 2) {
      setFormError("الرجاء إدخال الاسم");
      return;
    }
    if (phone.replace(/\D/g, "").length < 9) {
      setFormError("الرجاء إدخال رقم جوال صحيح");
      return;
    }
    if (gender !== "male" && gender !== "female") {
      setFormError("الرجاء اختيار الجنس (ذكر / أنثى)");
      return;
    }
    if (city.trim().length < 2) {
      setFormError("الرجاء إدخال اسم المدينة");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/loyalty/${slug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          gender,
          city: city.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر إصدار البطاقة");
      const dest = data.alreadyRegistered
        ? `/card/${data.code}?existing=1`
        : `/card/${data.code}?welcome=1`;
      navigate(dest);
    } catch (err: any) {
      setFormError(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (loadError || !campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4" dir="rtl">
        <Card className="p-8 text-center bg-slate-800 border-slate-700 max-w-md">
          <h1 className="text-2xl font-bold text-white mb-2">الحملة غير متاحة</h1>
          <p className="text-slate-400" data-testid="text-campaign-error">{loadError || "الرابط غير صالح"}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-slate-600/50">
          <div className="h-2 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500" />
          <div className="p-6">
            <div className="text-center mb-5">
              <div className="inline-block bg-white rounded-2xl p-3 shadow-xl mb-3">
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
              <h1 className="text-xl font-bold text-white" data-testid="text-campaign-name">{campaign.name}</h1>
              {campaign.description && (
                <p className="text-slate-300 text-sm mt-2">{campaign.description}</p>
              )}
            </div>

            <div className="text-center my-5">
              <div className="inline-block relative">
                <div className="absolute inset-0 bg-orange-500 rounded-2xl blur-xl opacity-40" />
                <div className="relative bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl px-10 py-5 shadow-2xl border border-orange-400/30">
                  <p className="text-orange-100 text-xs mb-1 font-medium flex items-center justify-center gap-1">
                    <Gift className="h-4 w-4" /> خصم خاص لك
                  </p>
                  <p className="text-4xl font-black text-white drop-shadow-lg" data-testid="text-discount-value">{discountText}</p>
                </div>
              </div>
              <p className="text-slate-400 text-xs mt-3">
                قابل للاستخدام حتى {campaign.maxUsesPerCustomer} {campaign.maxUsesPerCustomer === 1 ? "مرة" : "مرات"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="join-name" className="text-slate-200 mb-1.5 block">الاسم</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="join-name"
                    data-testid="input-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="اكتب اسمك"
                    className="pr-9 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="join-phone" className="text-slate-200 mb-1.5 block">رقم الجوال</Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="join-phone"
                    data-testid="input-phone"
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="05XXXXXXXX"
                    className="pr-9 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <Label className="text-slate-200 mb-1.5 block">الجنس</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    data-testid="button-gender-male"
                    onClick={() => setGender("male")}
                    className={`py-3 rounded-xl border text-center font-medium transition ${
                      gender === "male"
                        ? "bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20"
                        : "bg-slate-900/50 border-slate-600 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    ذكر
                  </button>
                  <button
                    type="button"
                    data-testid="button-gender-female"
                    onClick={() => setGender("female")}
                    className={`py-3 rounded-xl border text-center font-medium transition ${
                      gender === "female"
                        ? "bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20"
                        : "bg-slate-900/50 border-slate-600 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    أنثى
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="join-city" className="text-slate-200 mb-1.5 block">المدينة</Label>
                <div className="relative">
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="join-city"
                    data-testid="input-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="اكتب اسم مدينتك"
                    className="pr-9 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              {formError && (
                <p className="text-red-400 text-sm text-center" data-testid="text-form-error">{formError}</p>
              )}

              <Button
                type="submit"
                disabled={submitting}
                data-testid="button-get-card"
                className="w-full gap-2 bg-orange-600 hover:bg-orange-700 text-white py-6 text-lg rounded-xl"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Gift className="h-5 w-5" />}
                احصل على بطاقتك
              </Button>
            </form>

            {campaign.terms && (
              <p className="mt-4 text-center text-xs text-slate-400 bg-slate-700/30 rounded-lg p-3 border border-slate-700">
                {campaign.terms}
              </p>
            )}
          </div>
        </div>
        <div className="text-center mt-6 text-slate-500 text-sm">
          <p className="text-orange-400 font-medium">BUTTER BAKERY</p>
          <p className="text-xs mt-1">شركة الزبد الأفضل التجارية</p>
        </div>
      </div>
    </div>
  );
}
