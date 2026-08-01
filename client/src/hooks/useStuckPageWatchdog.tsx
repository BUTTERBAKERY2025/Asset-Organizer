import { useEffect, useState } from "react";

// نفس مفاتيح حارس إعادة التحميل المستخدمة في pagePreloader (فشل تحميل الأجزاء)
// حتى يكون هناك سقف واحد مشترك: إعادة تحميل تلقائية واحدة فقط لكل حادثة (60 ثانية)
// مهما كان مصدرها — بعدها تظهر رسالة الاسترداد اليدوية بدل تكرار التحميل.
const RELOAD_COUNT_KEY = "__chunk_reload_count";
const RELOAD_AT_KEY = "__chunk_reload_at";
const RELOAD_WINDOW_MS = 60_000;

/**
 * شبكة أمان ضد الصفحات العالقة (المهمة #42):
 * إذا بقيت شاشة التحميل ظاهرة أكثر من timeoutMs (افتراضياً 20 ثانية)
 * تُعاد محاولة تحميل الصفحة تلقائياً مرة واحدة فقط خلال نافذة 60 ثانية
 * (حارس ضد حلقة إعادة التحميل اللانهائية). إن فشلت المحاولة أيضاً،
 * يُرجِع الخطاف true حتى تعرض الشاشة رسالة واضحة مع زر تحديث يدوي.
 */
export function useStuckPageWatchdog(timeoutMs = 20_000): boolean {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const count = parseInt(sessionStorage.getItem(RELOAD_COUNT_KEY) || "0", 10) || 0;
        const lastAt = parseInt(sessionStorage.getItem(RELOAD_AT_KEY) || "0", 10) || 0;
        const effectiveCount = Date.now() - lastAt > RELOAD_WINDOW_MS ? 0 : count;
        if (effectiveCount < 1) {
          sessionStorage.setItem(RELOAD_COUNT_KEY, String(effectiveCount + 1));
          sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()));
          window.location.reload();
          return;
        }
      } catch {
        // sessionStorage غير متاح (وضع خاص صارم): لا نعيد التحميل تلقائياً
        // حتى لا ندخل في حلقة، نكتفي بعرض رسالة الخطأ مع زر التحديث.
      }
      setStuck(true);
    }, timeoutMs);
    return () => clearTimeout(t);
  }, [timeoutMs]);

  return stuck;
}

/** رسالة تظهر فقط عند فشل إعادة التحميل التلقائية أيضاً */
export function StuckPageMessage() {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 p-6 text-center" dir="rtl" data-testid="stuck-page-message">
      <p className="text-base font-semibold">تعذّر تحميل الصفحة</p>
      <p className="text-sm text-muted-foreground max-w-sm">
        يبدو أن هناك مشكلة في الاتصال أو نسخة قديمة محفوظة في المتصفح. جرّب تحديث الصفحة، وإن استمرت المشكلة حدّث تحديثاً قوياً (Ctrl+Shift+R).
      </p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        data-testid="button-stuck-reload"
      >
        تحديث الصفحة
      </button>
    </div>
  );
}
