// بطاقة صغيرة تظهر مرة واحدة لتفعيل إشعارات الجوال بعد تسجيل الدخول
import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  pushSupported,
  iosNeedsInstall,
  enablePushNotifications,
  syncPushSubscription,
} from "@/lib/push-notifications";

const DISMISS_KEY = "push-prompt-dismissed";

export function PushNotificationPrompt() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !pushSupported()) return;
    if (Notification.permission === "granted") {
      // مفعّلة مسبقاً — تأكد فقط أن هذا الجهاز مسجَّل للمستخدم الحالي
      syncPushSubscription();
      return;
    }
    if (Notification.permission === "denied") return;
    if (iosNeedsInstall()) return; // الآيفون يحتاج الحفظ على الشاشة الرئيسية أولاً
    if (localStorage.getItem(DISMISS_KEY)) return;
    const t = setTimeout(() => setShow(true), 4000);
    return () => clearTimeout(t);
  }, [isAuthenticated]);

  if (!show) return null;

  const enable = async () => {
    setBusy(true);
    const result = await enablePushNotifications();
    setBusy(false);
    setShow(false);
    if (result === "enabled") {
      toast({ title: "تم تفعيل إشعارات الجوال ✓", description: "ستصلك التعميمات والإشعارات التي تخصك على هذا الجهاز" });
      localStorage.setItem(DISMISS_KEY, "1");
    } else if (result === "denied") {
      toast({ title: "لم يتم السماح بالإشعارات", description: "يمكنك تفعيلها لاحقاً من إعدادات المتصفح", variant: "destructive" });
      localStorage.setItem(DISMISS_KEY, "1");
    } else {
      toast({ title: "تعذر التفعيل", description: "حاول مرة أخرى لاحقاً", variant: "destructive" });
    }
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  return (
    <div dir="rtl" className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-4 sm:w-96 z-50 rounded-xl border bg-white shadow-lg p-4 flex items-start gap-3">
      <div className="rounded-full bg-amber-100 p-2 shrink-0">
        <Bell className="h-5 w-5 text-amber-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-gray-800">تفعيل إشعارات الجوال</p>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          استقبل التعميمات والإشعارات التي تخصك على جهازك مباشرة — حتى والتطبيق مغلق
        </p>
        <div className="flex gap-2 mt-3">
          <Button size="sm" onClick={enable} disabled={busy} className="h-8 text-xs">
            {busy ? "جاري التفعيل..." : "تفعيل الإشعارات"}
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss} className="h-8 text-xs text-gray-500">
            ليس الآن
          </Button>
        </div>
      </div>
      <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 shrink-0" aria-label="إغلاق">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
