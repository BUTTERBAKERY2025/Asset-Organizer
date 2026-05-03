import { useEffect, useState, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PING_INTERVAL_MS = 30000;
const PING_TIMEOUT_MS = 8000;
const SLOW_LATENCY_MS = 4000;
const SLOW_STREAK_THRESHOLD = 3; // require 3 consecutive slow pings before showing banner

/**
 * Detects slow internet (high latency) and shows an amber banner.
 * Complements the existing OfflineIndicator (which only handles full disconnect).
 * Useful for site engineers/supervisors working from a tablet on weak 3G/4G.
 *
 * Requires SLOW_STREAK_THRESHOLD consecutive slow pings before showing the banner
 * to avoid flickering on transient hiccups (e.g. a single slow request during preload).
 */
export function SlowConnectionBanner() {
  const [isSlow, setIsSlow] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slowStreakRef = useRef(0);

  const ping = async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      slowStreakRef.current = 0;
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
      if (elapsed > SLOW_LATENCY_MS) {
        slowStreakRef.current += 1;
        if (slowStreakRef.current >= SLOW_STREAK_THRESHOLD) {
          setIsSlow(true);
        }
      } else {
        slowStreakRef.current = 0;
        setIsSlow(false);
        setDismissed(false);
      }
    } catch {
      clearTimeout(timeoutId);
      // Treat timeout/error as a slow signal (offline is handled by OfflineIndicator).
      // Still require the streak threshold to avoid one-off failures triggering the banner.
      slowStreakRef.current += 1;
      setLatency(null);
      if (slowStreakRef.current >= SLOW_STREAK_THRESHOLD) {
        setIsSlow(true);
      }
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
