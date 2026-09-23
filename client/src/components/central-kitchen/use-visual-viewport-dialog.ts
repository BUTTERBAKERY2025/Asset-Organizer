import { useEffect, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";

type Options = { open: boolean; maxHeight: number; viewportFraction: number };

/**
 * Keeps a centred Radix dialog inside the *visual* viewport when a mobile
 * keyboard shrinks it. `dvh` follows the layout viewport in some iOS cases.
 */
export function useVisualViewportDialog({ open, maxHeight, viewportFraction }: Options): CSSProperties | undefined {
  const read = () => {
    if (typeof window === "undefined") return undefined;
    const viewport = window.visualViewport;
    const availableHeight = Math.min(viewport?.height ?? window.innerHeight, window.innerHeight);
    const offsetTop = viewport?.offsetTop ?? 0;
    const height = Math.min(maxHeight, Math.max(220, Math.floor(availableHeight * viewportFraction)));
    // DialogContent carries a generic duration utility. Without overriding it,
    // CSS treats height/top as transitionable and the old (taller) shell can
    // remain clipped for a frame after the keyboard opens.
    return {
      height: `${height}px`,
      maxHeight: `${height}px`,
      top: `${Math.floor(offsetTop + availableHeight / 2)}px`,
      transitionDuration: "0ms",
      animationDuration: "0ms",
    };
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
    let frame = 0;
    // Chromium and iOS can dispatch resize while innerHeight is still from the
    // previous frame. Re-read once layout settles so a stale pixel height can
    // never leave the dialog below the visible viewport.
    const handleViewportChange = () => {
      update();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const viewport = window.visualViewport;
    handleViewportChange();
    viewport?.addEventListener("resize", handleViewportChange);
    viewport?.addEventListener("scroll", handleViewportChange);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", handleViewportChange);
      viewport?.removeEventListener("scroll", handleViewportChange);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [open, maxHeight, viewportFraction]);

  return style;
}