import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2, RefreshCw, Send, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushNotificationStatus,
  reinitializePushNotifications,
  sendTestPushToCurrentDevice,
  setPushSubscriptionSession,
  syncPushSubscription,
  type PushSyncResult,
  type PushNotificationStatus,
} from "@/lib/push-notifications";

const DISMISS_KEY = "push-prompt-dismissed";
const IOS_DISMISS_KEY = "push-ios-guide-dismissed";

export interface MobilePushSettingsProps {
  className?: string;
  compact?: boolean;
}

/** Reusable notification settings/status card for authenticated surfaces. */
export function MobilePushSettings({ className, compact = true }: MobilePushSettingsProps) {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<PushNotificationStatus>("checking");
  const [busy, setBusy] = useState<"enable" | "disable" | "sync" | "reset" | "test" | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setStatus("checking");
    const synced = await syncPushSubscription();
    if (synced === "enabled") {
      setStatus("enabled");
      return;
    }
    if (synced !== "none") {
      setStatus(synced);
      return;
    }
    setStatus(await getPushNotificationStatus());
  }, [isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh, user?.id]);

  if (!isAuthenticated) return null;

  const enable = async () => {
    setBusy("enable");
    const result = await enablePushNotifications();
    setBusy(null);
    if (result === "enabled") {
      setStatus("enabled");
      localStorage.setItem(DISMISS_KEY, "1");
      toast({ title: "تم تفعيل إشعارات الجوال", description: "ستصل التنبيهات الخاصة بحسابك إلى هذا الجهاز." });
    } else {
      setStatus(result === "error" ? "server-error" : result);
    }
  };

  const disable = async () => {
    setBusy("disable");
    const result = await disablePushNotifications();
    setBusy(null);
    setStatus(result === "disabled" ? "disabled" : result === "unsupported" ? "unsupported" : "server-error");
  };

  const sync = async () => {
    setBusy("sync");
    const result = await syncPushSubscription();
    setBusy(null);
    setStatus(result === "enabled" ? "enabled" : result === "none" ? "disabled" : result);
  };

  const reset = async () => {
    setBusy("reset");
    const result = await reinitializePushNotifications();
    setBusy(null);
    setStatus(result === "error" ? "server-error" : result);
  };

  const test = async () => {
    setBusy("test");
    const sent = await sendTestPushToCurrentDevice();
    setBusy(null);
    toast(sent
      ? { title: "تم إرسال إشعار تجريبي لهذا الجهاز" }
      : { title: "تعذر إرسال الإشعار التجريبي", description: "لم يُرسل لأي مستخدم أو جهاز آخر.", variant: "destructive" });
  };

  const messages: Record<PushNotificationStatus, string> = {
    checking: "جارٍ التحقق من حالة الإشعارات…",
    enabled: "الإشعارات مفعّلة لهذا الحساب على هذا الجهاز.",
    disabled: "الإشعارات غير مفعّلة على هذا الجهاز.",
    denied: "الإشعارات محجوبة. اسمح بها من إعدادات الموقع في المتصفح ثم أعد المحاولة.",
    unsupported: "هذا المتصفح أو الجهاز لا يدعم إشعارات الويب.",
    "not-installed": "على iPhone أو iPad: اضغط مشاركة، ثم «إضافة إلى الشاشة الرئيسية»، وافتح التطبيق من الأيقونة الجديدة.",
    "ownership-conflict": "اشتراك المتصفح القديم مرتبط بحساب آخر. أعد تهيئة هذا الجهاز لإنشاء اشتراك جديد؛ لن يُنقل اشتراك الحساب الآخر.",
    "session-expired": "انتهت جلسة الدخول. سجّل الدخول مجدداً ثم أعد مزامنة الإشعارات.",
    "provider-unsupported": "عنوان مزود الإشعارات الذي أعاده هذا المتصفح غير مدعوم. حدّث المتصفح أو استخدم متصفحاً مدعوماً.",
    "server-error": "خدمة اشتراكات الإشعارات غير متاحة حالياً. أعد المحاولة؛ المشكلة ليست بالضرورة في اتصال جهازك.",
  };

  return (
    <section
      dir="rtl"
      className={cn("rounded-xl border bg-background p-3 text-right", !compact && "p-4", className)}
      aria-label="إعدادات إشعارات الجوال"
      data-testid="mobile-push-settings"
    >
      <div className="flex items-start gap-2.5">
        <div className={cn("mt-0.5 rounded-full p-2", status === "enabled" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
          {status === "disabled" || status === "denied" ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">إشعارات الجوال</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground" role="status">{messages[status]}</p>
          {status === "not-installed" && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Share className="h-3.5 w-3.5 text-blue-600" /> مشاركة</span>
              <span className="inline-flex items-center gap-1"><SquarePlus className="h-3.5 w-3.5" /> إضافة إلى الشاشة الرئيسية</span>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {status === "disabled" && (
              <Button type="button" size="sm" className="h-8 text-xs" disabled={busy !== null} onClick={() => void enable()}>
                {busy === "enable" && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" />} تفعيل
              </Button>
            )}
            {(status === "server-error" || status === "ownership-conflict" || status === "provider-unsupported") && (
              <>
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={busy !== null} onClick={() => void sync()}>
                  {busy === "sync" ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="ml-1 h-3.5 w-3.5" />} إعادة المزامنة
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" disabled={busy !== null} onClick={() => void reset()}>
                  {busy === "reset" && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" />}
                  إعادة تهيئة هذا الجهاز
                </Button>
              </>
            )}
            {status === "enabled" && (
              <>
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={busy !== null} onClick={() => void test()}>
                  {busy === "test" ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <Send className="ml-1 h-3.5 w-3.5" />} اختبار هذا الجهاز
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" disabled={busy !== null} onClick={() => void disable()}>
                  {busy === "disable" && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" />} إيقاف
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PushNotificationPrompt() {
  const { isAuthenticated, user } = useAuth();
  const [show, setShow] = useState(false);
  const [iosGuide, setIosGuide] = useState(false);

  useEffect(() => {
    const sessionUserId = isAuthenticated && user?.id != null ? String(user.id) : null;
    setPushSubscriptionSession(sessionUserId);
    if (!sessionUserId) {
      setShow(false);
      setIosGuide(false);
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let retryTimer: number | undefined;
    let running = false;
    let runAgain = false;
    let failures = 0;

    const updatePrompt = async (syncResult: PushSyncResult) => {
      const status = syncResult === "enabled"
        ? "enabled"
        : syncResult === "none"
          ? await getPushNotificationStatus()
          : syncResult;
      if (cancelled) return;
      if (status === "enabled") {
        return;
      }
      const ios = status === "not-installed";
      const dismissed = localStorage.getItem(ios ? IOS_DISMISS_KEY : DISMISS_KEY);
      if (!dismissed && status !== "unsupported" && status !== "denied") {
        timer = window.setTimeout(() => ios ? setIosGuide(true) : setShow(true), 4000);
      }
    };

    const runSync = async () => {
      if (cancelled) return;
      if (running) {
        runAgain = true;
        return;
      }
      running = true;
      const result = await syncPushSubscription();
      running = false;
      if (cancelled) return;
      await updatePrompt(result);
      if (result === "server-error" && failures < 2) {
        const delays = [1_000, 4_000] as const;
        retryTimer = window.setTimeout(() => void runSync(), delays[failures]);
        failures += 1;
      } else if (result !== "server-error") {
        failures = 0;
      }
      if (runAgain) {
        runAgain = false;
        void runSync();
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void runSync();
    };
    const onOnline = () => void runSync();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    void runSync();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [isAuthenticated, user?.id]);

  if (!show && !iosGuide) return null;
  const dismiss = () => {
    localStorage.setItem(iosGuide ? IOS_DISMISS_KEY : DISMISS_KEY, "1");
    setShow(false);
    setIosGuide(false);
  };
  return (
    <div className="fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:left-4 sm:w-96">
      <button type="button" onClick={dismiss} className="absolute left-2 top-2 z-10 p-1 text-muted-foreground" aria-label="إغلاق">
        <X className="h-4 w-4" />
      </button>
      <MobilePushSettings compact={false} className="pr-4 shadow-lg" />
      <Button type="button" size="sm" variant="ghost" onClick={dismiss} className="absolute bottom-2 left-2 h-7 text-xs text-muted-foreground">ليس الآن</Button>
    </div>
  );
}