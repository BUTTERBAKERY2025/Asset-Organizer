import { useEffect, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";

type Options = { open: boolean; maxHeight: number; viewportFraction: number };

/**
 * Keeps a centred Radix dialog inside the *visual* viewport when a mobile
 * keyboard shrinks it. `dvh` follows the layout viewport in some iOS cases.
 */
export function useVisualViewportDialog({ open, maxHeight, viewportFraction }: Options): CSSProperties | undefined {
  const fallback: CSSProperties = {
    height: `min(${maxHeight}px, ${viewportFraction * 100}vh)`,
    maxHeight: `min(${maxHeight}px, ${viewportFraction * 100}vh)`,
    top: `${viewportFraction * 50}vh`,
  };
  const read = () => {
    if (typeof window === "undefined") return undefined;
    const viewport = window.visualViewport;
    const availableHeight = Math.min(viewport?.height ?? window.innerHeight, window.innerHeight);
    const offsetTop = viewport?.offsetTop ?? 0;
    // A normal layout viewport can remain CSS-driven. Switch to explicit
    // pixels only when the visual viewport has diverged (mobile keyboard).
    if (!viewport || (Math.abs(availableHeight - window.innerHeight) < 1 && offsetTop === 0)) return fallback;
    const height = Math.min(maxHeight, Math.max(220, Math.floor(availableHeight * viewportFraction)));
    return { height: `${height}px`, maxHeight: `${height}px`, top: `${Math.floor(offsetTop + availableHeight / 2)}px` };
  };
  const [style, setStyle] = useState<CSSProperties | undefined>(read);

  useEffect(() => {
    if (!open) {
      setStyle(undefined);
      return;
    }
    // Browser visual-viewport events can fire immediately before the next
    // paint; flush keeps the footer in bounds during that same keyboard frame.
    const update = () => flushSync(() => setStyle(read()));
    const viewport = window.visualViewport;
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [open, maxHeight, viewportFraction]);

  return style;
}