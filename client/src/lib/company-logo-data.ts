// يجلب لوجو الشركة كـ data URI (base64) لتضمينه في مستندات الطباعة الرسمية
// بشكل موثوق دون الاعتماد على الشبكة أثناء فتح نافذة الطباعة. النتيجة مخزّنة مؤقتاً.

let _logoCache: string | null | undefined;

export async function getCompanyLogoDataUri(): Promise<string | null> {
  if (_logoCache) return _logoCache;
  try {
    const res = await fetch("/company-logo.png", { credentials: "include" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUri = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(new Error("logo read failed"));
      fr.readAsDataURL(blob);
    });
    _logoCache = dataUri;
    return dataUri;
  } catch {
    return null;
  }
}
