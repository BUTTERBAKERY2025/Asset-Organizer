// يجلب لوجو الشركة كـ data URI (base64) لتضمينه في مستندات الطباعة الرسمية
// بشكل موثوق دون الاعتماد على الشبكة أثناء فتح نافذة الطباعة. النتيجة مخزّنة مؤقتاً.

let _logoCache: string | null | undefined;
let _butterBakeryLogoCache: string | null | undefined;

async function imageDataUri(path: string): Promise<string | null> {
  try {
    const res = await fetch(path, { credentials: "include" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(new Error("logo read failed"));
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function getCompanyLogoDataUri(): Promise<string | null> {
  if (_logoCache) return _logoCache;
  _logoCache = await imageDataUri("/company-logo.png");
  return _logoCache;
}

// The same authentic orange script mark used by client/src/pages/login.tsx.
// /butter-logo.png is byte-identical to its imported login asset.
export async function getButterBakeryLogoDataUri(): Promise<string | null> {
  if (_butterBakeryLogoCache) return _butterBakeryLogoCache;
  _butterBakeryLogoCache = await imageDataUri("/butter-logo.png");
  return _butterBakeryLogoCache;
}
