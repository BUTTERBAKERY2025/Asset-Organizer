import { useEffect, useState, type ReactNode } from "react";

/** Explicit extraction boundary: omit unrelated platform navigation, not branch-page markup. */
export function Layout({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState("");
  useEffect(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    document.documentElement.dataset.syntheticPreview = "true";
    const onAction = (event: Event) => setNotice((event as CustomEvent<string>).detail);
    window.addEventListener("synthetic-preview-action", onAction);
    return () => { window.removeEventListener("synthetic-preview-action", onAction); };
  }, []);
  return <div className="min-h-screen bg-background text-foreground" dir="rtl">
    {children}
    {notice && <p role="status" className="fixed bottom-3 left-3 right-3 z-50 rounded-lg border bg-card p-3 text-sm">{notice}</p>}
  </div>;
}