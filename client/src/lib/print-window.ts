// أدوات نافذة الطباعة المشتركة.
//
// لماذا صفحة وسيطة (/print-document.html) وليس about:blank أو Blob؟
// إعدادات الأمان في الخادم (helmet CSP) تُطبَّق في الإنتاج فقط وتضع
// scriptSrc: 'self' — أي أن أي سكربت مُضمَّن (<script> inline) محظور. مستندات
// about:blank وBlob وiframe ترث سياسة CSP الخاصة بالنافذة الأصلية، فتُحجب فيها
// السكربتات (ترقيم صفحات قرار المجلس الذي يبني كامل المحتوى + الطباعة التلقائية)
// وتظهر صفحة بيضاء. لذلك نفتح النافذة على صفحة /print-document.html المُستثناة من
// CSP في الخادم؛ هذه الصفحة لا تحمل أي سياسة أمان فتعمل السكربتات بداخلها.
//
// ملاحظة: لا تظهر مشكلة الصفحة البيضاء في بيئة التطوير لأن helmet مُعطَّل هناك،
// وإنما تظهر فقط في الموقع المنشور (الإنتاج).

const PRINT_SHELL_URL = "/print-document.html";

// يفتح نافذة الطباعة على الصفحة الوسيطة. يجب استدعاؤها بشكل متزامن داخل معالج
// النقر (onClick) لتفادي حجب النوافذ المنبثقة.
export function openPrintWindow(): Window | null {
  return window.open(PRINT_SHELL_URL, "_blank");
}

// يكتب مستند HTML النهائي داخل نافذة مفتوحة على الصفحة الوسيطة. ننتظر حتى تُحمّل
// الصفحة الوسيطة (تُعرّف __renderPrint) ثم نمرر لها المحتوى لتكتبه ضمن سياقها
// المُستثنى من CSP، فتعمل السكربتات المُضمَّنة.
export function renderToPrintWindow(win: Window, html: string) {
  let attempts = 0;
  const tryRender = () => {
    if (win.closed) return;
    let ready = false;
    try {
      const w = win as unknown as { __printReady?: boolean; __renderPrint?: (h: string) => void };
      ready = w.__printReady === true && typeof w.__renderPrint === "function";
      if (ready) {
        w.__renderPrint!(html);
        return;
      }
    } catch {
      // النافذة لا تزال تُحمّل الصفحة الوسيطة — نعيد المحاولة.
    }
    if (attempts++ < 200) {
      setTimeout(tryRender, 25); // حتى ~5 ثوانٍ
    }
  };
  tryRender();
}
