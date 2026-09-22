import { useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enablePushNotifications, iosNeedsInstall, pushSupported } from "@/lib/push-notifications";

type EnableResult = "enabled" | "denied" | "unsupported" | "error";

export function OrderNotificationsOptIn() {
  const [state, setState] = useState<"idle" | "loading" | EnableResult>("idle");
  if (!pushSupported() && !iosNeedsInstall()) return null;

  const enable = async () => {
    setState("loading");
    try {
      setState(await enablePushNotifications() as EnableResult);
    } catch {
      setState("error");
    }
  };

  if (state === "enabled") return <p className="text-xs text-emerald-700" role="status">تم تفعيل تنبيهات تحديثات الطلب.</p>;
  return <div className="rounded-lg border border-sky-200 bg-sky-50/65 px-3 py-2.5">
    <div className="flex items-start gap-2">
      <Bell className="mt-0.5 h-4 w-4 shrink-0 text-sky-800" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-sky-950">تابع تحديثات الطلب من جهازك</p>
        {iosNeedsInstall() ? <p className="mt-1 text-[11px] leading-5 text-sky-900">في iPhone أو iPad: افتح القائمة «مشاركة»، اختر «إضافة إلى الشاشة الرئيسية»، ثم افتح التطبيق منها لتفعيل التنبيهات.</p>
          : state === "denied" ? <p className="mt-1 text-[11px] leading-5 text-sky-900">التنبيهات محجوبة من المتصفح. فعّلها من إعدادات الموقع ثم أعد المحاولة.</p>
            : state === "unsupported" ? <p className="mt-1 text-[11px] leading-5 text-sky-900">هذا المتصفح لا يدعم تنبيهات التطبيق.</p>
              : state === "error" ? <p className="mt-1 text-[11px] leading-5 text-sky-900">تعذر التفعيل الآن. تحقق من الاتصال ثم أعد المحاولة.</p>
              : <p className="mt-1 text-[11px] leading-5 text-sky-900">فعّل التنبيه الاختياري لمعرفة الاعتماد والتجهيز والإرسال والاستلام.</p>}
        {!iosNeedsInstall() && state !== "unsupported" && <Button type="button" size="sm" variant="outline" className="mt-2 min-h-9 border-sky-300 bg-background" disabled={state === "loading"} onClick={() => void enable()}>
          {state === "loading" && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" />}{state === "denied" || state === "error" ? "إعادة المحاولة" : "تفعيل التنبيهات"}
        </Button>}
      </div>
    </div>
  </div>;
}