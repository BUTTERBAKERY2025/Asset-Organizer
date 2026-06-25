// يحمّل مستند HTML المُجهّز داخل نافذة طباعة مفتوحة مسبقاً عبر Blob URL.
// السبب: عند فتح النافذة بنقرة المستخدم ثم كتابة المحتوى بعد انتظار (await) جلب
// البيانات، يفشل document.write في كروم أحياناً (صفحة بيضاء) ولا تُنفَّذ السكربتات
// المُضمَّنة (الطباعة التلقائية). تحميل المحتوى كـ Blob يجعل النافذة تتنقّل لمستند
// حقيقي فتُعرض الصفحة وتعمل السكربتات بشكل موثوق.
export function renderToPrintWindow(win: Window, html: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  let revoked = false;
  const revoke = () => {
    if (revoked) return;
    revoked = true;
    try {
      URL.revokeObjectURL(url);
    } catch {}
  };
  win.location.href = url;
  try {
    win.addEventListener("pagehide", revoke, { once: true });
    win.addEventListener("afterprint", revoke, { once: true });
  } catch {}
  // شبكة أمان: إذا لم تُطلَق أحداث النافذة لأي سبب، حرّر الرابط بعد مهلة طويلة.
  setTimeout(revoke, 5 * 60 * 1000);
}
