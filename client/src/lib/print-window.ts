// أدوات نافذة الطباعة المشتركة.
//
// لماذا document.write وليس Blob/iframe؟
// إعدادات الأمان في الخادم (helmet CSP) تضع scriptSrc: 'self' فقط — أي أن أي
// سكربت مُضمَّن (<script> inline) محظور. مستندات Blob وiframe ترث سياسة CSP
// الخاصة بالصفحة، فتُحجب فيها السكربتات (ترقيم صفحات قرار المجلس + الطباعة
// التلقائية) وتظهر صفحة بيضاء. أما نافذة about:blank المفتوحة عبر window.open ثم
// المكتوبة بـ document.write فلا تخضع لتلك السياسة، فتعمل السكربتات بشكل صحيح.
//
// لماذا الرسالة المؤقتة (placeholder)؟
// إذا فُتحت النافذة ثم كُتب المحتوى بعد انتظار (await) جلب البيانات، يفشل
// document.write أحياناً في كروم (صفحة بيضاء) لأن مستند about:blank يكون قد انتهى
// تحميله. كتابة محتوى بسيط فوراً (بشكل متزامن) يثبّت ملكية المستند، ثم نعيد كتابته
// لاحقاً عبر document.open/write/close بشكل موثوق.

const LOADING_HTML = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>جارٍ التحضير…</title></head><body style="font-family:system-ui,'Segoe UI',Tahoma,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#7a5c1e;font-size:18px;">جارٍ تجهيز المستند للطباعة…</body></html>`;

// يفتح نافذة الطباعة فوراً. يجب استدعاؤها بشكل متزامن داخل معالج النقر (onClick)
// لتفادي حجب النوافذ المنبثقة، ثم تمرير النافذة الناتجة إلى دالة الطباعة.
export function openPrintWindow(): Window | null {
  const win = window.open("", "_blank");
  if (win) {
    try {
      win.document.write(LOADING_HTML);
    } catch {}
  }
  return win;
}

// يكتب مستند HTML النهائي داخل نافذة مفتوحة مسبقاً.
export function renderToPrintWindow(win: Window, html: string) {
  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch {}
}
