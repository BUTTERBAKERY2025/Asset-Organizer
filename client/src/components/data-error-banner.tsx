import { useEffect, useRef, useState } from "react";
import { useQueryClient, type Query } from "@tanstack/react-query";
import { AlertCircle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SHOW_DELAY_MS = 4000;
const MIN_DISPLAY_MS = 4000;

// Session-wide set of query-key signatures the user has already dismissed.
// Persisted across route navigations so the banner doesn't pop back up
// for the same failing endpoint after the user closed it.
function getDismissedSet(): Set<string> {
  const w = window as any;
  if (!w.__bannerDismissedKeys) w.__bannerDismissedKeys = new Set<string>();
  return w.__bannerDismissedKeys;
}

function keySig(q: Query): string {
  return JSON.stringify(q.queryKey);
}

function isTransientError(q: Query): boolean {
  if (q.state.status !== "error") return false;
  if (q.getObserversCount() === 0) return false;
  // If the query already has cached data from a previous successful fetch,
  // the user is NOT actually missing anything — don't nag them.
  if (q.state.data !== undefined) return false;
  // Skip queries that are currently retrying — banner should only show
  // after retries are exhausted.
  if (q.state.fetchStatus === "fetching") return false;
  // Skip queries the user already dismissed during this session.
  if (getDismissedSet().has(keySig(q))) return false;
  const err = q.state.error;
  const msg = err instanceof Error ? err.message : String(err || "");
  if (/^(400|401|403|404|409|410|422):/.test(msg)) return false;
  if (/abort/i.test(msg) || /cancel/i.test(msg)) return false;
  // Log once per error so we can diagnose recurring failures
  const w = window as any;
  w.__failedQueryLog = w.__failedQueryLog || new Set<string>();
  const sig = `${JSON.stringify(q.queryKey)}::${msg}`;
  if (!w.__failedQueryLog.has(sig)) {
    w.__failedQueryLog.add(sig);
    console.warn("[data-error-banner] failing query:", q.queryKey, "→", msg);
  }
  return true;
}

export function DataErrorBanner() {
  const queryClient = useQueryClient();
  const [failedCount, setFailedCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const shownAt = useRef<number | null>(null);
  const dismissedRef = useRef(false);

  useEffect(() => { dismissedRef.current = dismissed; }, [dismissed]);

  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const clearShow = () => { if (showTimer.current) { window.clearTimeout(showTimer.current); showTimer.current = null; } };
    const clearHide = () => { if (hideTimer.current) { window.clearTimeout(hideTimer.current); hideTimer.current = null; } };
    const recompute = () => {
      const failed = cache.getAll().filter(isTransientError).length;
      setFailedCount(failed);
      if (failed === 0) {
        clearShow();
        const elapsed = shownAt.current ? Date.now() - shownAt.current : Infinity;
        if (visible && elapsed < MIN_DISPLAY_MS) {
          if (!hideTimer.current) {
            hideTimer.current = window.setTimeout(() => {
              const stillFailed = cache.getAll().filter(isTransientError).length;
              hideTimer.current = null;
              if (stillFailed === 0) {
                setVisible(false);
                setDismissed(false);
                shownAt.current = null;
              }
            }, MIN_DISPLAY_MS - elapsed);
          }
        } else {
          clearHide();
          setVisible(false);
          setDismissed(false);
          shownAt.current = null;
        }
        return;
      }
      clearHide();
      if (!visible && !showTimer.current && !dismissed) {
        showTimer.current = window.setTimeout(() => {
          showTimer.current = null;
          if (dismissedRef.current) return;
          const stillFailed = cache.getAll().filter(isTransientError).length;
          if (stillFailed > 0) {
            setVisible(true);
            shownAt.current = Date.now();
          }
        }, SHOW_DELAY_MS);
      }
    };
    recompute();
    const unsubscribe = cache.subscribe(() => recompute());
    return () => {
      unsubscribe();
      clearShow();
      clearHide();
    };
  }, [queryClient, visible, dismissed]);

  const handleDismiss = () => {
    if (showTimer.current) { window.clearTimeout(showTimer.current); showTimer.current = null; }
    if (hideTimer.current) { window.clearTimeout(hideTimer.current); hideTimer.current = null; }
    // Remember which failing queries the user dismissed so we don't pop
    // the banner up again for the same endpoints on later navigations.
    // Narrow to transient (banner-eligible) queries only, so future
    // failures with different characteristics still surface.
    const dismissedSet = getDismissedSet();
    queryClient.getQueryCache().getAll().filter(isTransientError).forEach((q) => {
      dismissedSet.add(keySig(q));
    });
    setDismissed(true);
    setVisible(false);
    shownAt.current = null;
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const failed = queryClient.getQueryCache().getAll().filter(isTransientError);
      // Clear dismissed flag for the queries we're actively retrying.
      const dismissedSet = getDismissedSet();
      failed.forEach((q) => dismissedSet.delete(keySig(q)));
      await Promise.allSettled(failed.map((q) => queryClient.refetchQueries({ queryKey: q.queryKey, exact: true })));
    } finally {
      setRetrying(false);
    }
  };

  if (!visible || failedCount === 0 || dismissed) return null;

  return (
    <div
      role="alert"
      data-testid="data-error-banner"
      dir="rtl"
      className={cn(
        "fixed bottom-4 right-4 z-[60] max-w-sm",
        "bg-amber-50 border border-amber-300 text-amber-900",
        "shadow-lg rounded-xl p-3 flex items-start gap-3",
        "animate-in slide-in-from-bottom-4 duration-300"
      )}
      style={{ fontFamily: "'Cairo', sans-serif" }}
    >
      <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">
          تعذّر تحميل بعض البيانات
        </p>
        <p className="text-xs text-amber-800/80 mt-0.5">
          {failedCount === 1
            ? "طلب واحد لم يكتمل — اضغط لإعادة المحاولة بدون إعادة تحميل الصفحة."
            : `${failedCount} طلبات لم تكتمل — اضغط لإعادة المحاولة بدون إعادة تحميل الصفحة.`}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Button
            size="sm"
            onClick={handleRetry}
            disabled={retrying}
            className="h-7 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white"
            data-testid="button-retry-failed-queries"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 ml-1", retrying && "animate-spin")} />
            {retrying ? "جارٍ المحاولة..." : "إعادة المحاولة"}
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="text-amber-700 hover:text-amber-900 p-1 -mt-1 -mr-1 rounded"
        aria-label="إغلاق"
        data-testid="button-dismiss-error-banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
