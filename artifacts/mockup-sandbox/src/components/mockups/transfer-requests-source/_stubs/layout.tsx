import { useEffect, useState, type ReactNode } from "react";
import { previewNotice } from "./actions";

/** Global app chrome is omitted; page/components are the actual extracted source. */
export function Layout({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState("");
  useEffect(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    document.documentElement.dataset.syntheticPreview = "true";
    const onAction = (event: Event) => setNotice((event as CustomEvent<string>).detail);
    // Also isolate plain <a> links in the actual document/delivery components.
    const onLink = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest?.("a[href]");
      if (anchor) { event.preventDefault(); previewNotice("معاينة فقط — فتح الروابط والتنقل الخارجي معطل."); }
    };
    window.addEventListener("synthetic-preview-action", onAction);
    document.addEventListener("click", onLink, true);
    return () => {
      window.removeEventListener("synthetic-preview-action", onAction);
      document.removeEventListener("click", onLink, true);
    };
  }, []);
  return <div className="min-h-screen bg-background text-foreground" dir="rtl">
    {children}
    {notice && <p role="status" className="fixed bottom-3 left-3 right-3 z-50 rounded-lg border bg-card p-3 text-sm">{notice}</p>}
  </div>;
}