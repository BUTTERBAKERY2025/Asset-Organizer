// أدوات نافذة الطباعة المشتركة.
//
// المشكلة في الإنتاج (وليست في التطوير لأن helmet مُعطَّل هناك):
// 1) سياسة CSP (scriptSrc 'self') تمنع السكربتات المُضمَّنة. حلّها: نفتح النافذة
//    على /print-document.html المُستثناة من CSP في الخادم، فتعمل السكربتات بداخلها.
// 2) سياسة COOP (same-origin) تقطع علاقة النافذة الأصلية بنافذة الطباعة المنبثقة،
//    فلا تستطيع النافذة الأصلية الوصول إلى محتوى النافذة الجديدة أو استدعاء دوالها.
//    حلّها: نمرّر مستند HTML عبر localStorage (مشترك لكل النوافذ من نفس الأصل،
//    ولا تتأثر مشاركته بـ COOP). الصفحة الوسيطة تقرأ المفتاح من الـ hash وتعرض
//    المستند بنفسها ثم تطبع.

const SHELL_URL = "/print-document.html?v=2";

export interface PrintTarget {
  key: string;
  win: Window | null;
}

// يفتح نافذة الطباعة على الصفحة الوسيطة مع مفتاح فريد في عنوان الـ hash. يجب
// استدعاؤها بشكل متزامن داخل معالج النقر (onClick) لتفادي حجب النوافذ المنبثقة.
export function openPrintWindow(): PrintTarget {
  const key =
    "__print_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  const win = window.open(SHELL_URL + "#" + encodeURIComponent(key), "_blank");
  return { key, win };
}

// يمرّر مستند HTML النهائي إلى الصفحة الوسيطة عبر localStorage.
export function renderToPrintWindow(target: PrintTarget, html: string) {
  try {
    localStorage.setItem(target.key, html);
    return;
  } catch {
    // احتياطي (بيئة التطوير حيث لا COOP، أو عند فشل localStorage): الكتابة المباشرة.
    try {
      if (target.win) {
        target.win.document.open();
        target.win.document.write(html);
        target.win.document.close();
      }
    } catch {}
  }
}
