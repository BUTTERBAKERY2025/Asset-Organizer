// Reserve the tab during the user's click, before awaiting the token request.
export function reserveWhatsAppWindow(): Window | null {
  const tab = window.open("about:blank", "_blank");
  if (tab) {
    tab.opener = null;
    tab.document.title = "جارٍ تجهيز رسالة واتساب";
    tab.document.body.textContent = "جارٍ تجهيز رسالة واتساب…";
  }
  return tab;
}

export function navigateWhatsAppWindow(tab: Window | null, url: string): boolean {
  if (!tab || tab.closed) return false;
  try {
    tab.location.replace(url);
    return true;
  } catch {
    tab.close();
    return false;
  }
}

export function onboardingWhatsAppUrl(phone: string, link: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(`🥐 *Butter Bakery* — إشعار مباشرة العمل\n\nرابط التوقيع (يفتح داخل الفرع):\n${link}`)}`;
}