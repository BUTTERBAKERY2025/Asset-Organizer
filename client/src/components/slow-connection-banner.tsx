import { useEffect, useState, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PING_INTERVAL_MS = 25000;
const PING_TIMEOUT_MS = 6000;
const SLOW_LATENCY_MS = 2500;

/**
 * Detects slow internet (high latency) and shows an amber banner.
 * Complements the existing OfflineIndicator (which only handles full disconnect).
 * Useful for site engineers/supervisors working from a tablet on weak 3G/4G.
 */
export function SlowConnectionBanner() {
  const [isSlow, setIsSlow] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ping = async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setIsSlow(false);
      setLatency(null);
      return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    const start = Date.now();
    try {
      const res = await fetch("/api/health", {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error("bad status");
      const elapsed = Date.now() - start;
      setLatency(elapsed);
      const slow = elapsed > SLOW_LATENCY_MS;
      setIsSlow(slow);
      if (!slow) setDismissed(false);
    } catch {
      clearTimeout(timeoutId);
      // Treat timeout/error as slow (offline is handled by OfflineIndicator)
      setLatency(null);
      setIsSlow(true);
    }
  };

  useEffect(() => {
    void ping();
    intervalRef.current = setInterval(ping, PING_INTERVAL_MS);
    const onOnline = () => {
      setDismissed(false);
      void ping();
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!isSlow || dismissed) return null;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      dir="rtl"
      className={cn(
        "fixed bottom-4 right-4 z-[55] max-w-sm",
        "flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-sm font-medium",
        "bg-amber-500 text-amber-50 border border-amber-600",
      )}
      data-testid="banner-slow-connection"
    >
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1">
        الاتصال بطيء{latency ? ` (${(latency / 1000).toFixed(1)}ث)` : ""} — قد تتأخر العمليات
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="h-7 w-7 flex items-center justify-center rounded hover:bg-black/10 shrink-0"
        aria-label="إخفاء"
        data-testid="button-dismiss-slow-connection"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
