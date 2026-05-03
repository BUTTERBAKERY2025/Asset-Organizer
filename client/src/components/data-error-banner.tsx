import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Surfaces failed background queries with a single "retry all" button so the
 * user never has to reload the whole page when Supabase has a hiccup.
 *
 * Subscribes to the query cache and counts how many queries are in the `error`
 * state. When > 0, slides in a small amber banner at the bottom-left. Clicking
 * "إعادة المحاولة" calls refetch on every failed query in parallel and clears
 * the banner once they all settle (success or fail).
 */
export function DataErrorBanner() {
  const queryClient = useQueryClient();
  const [failedCount, setFailedCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const recompute = () => {
      const failed = cache.getAll().filter((q) => q.state.status === "error").length;
      setFailedCount(failed);
      if (failed === 0) setDismissed(false);
    };
    recompute();
    const unsubscribe = cache.subscribe(() => recompute());
    return unsubscribe;
  }, [queryClient]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const failed = queryClient.getQueryCache().getAll().filter((q) => q.state.status === "error");
      await Promise.allSettled(failed.map((q) => queryClient.refetchQueries({ queryKey: q.queryKey, exact: true })));
    } finally {
      setRetrying(false);
    }
  };

  if (failedCount === 0 || dismissed) return null;

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
        onClick={() => setDismissed(true)}
        className="text-amber-700 hover:text-amber-900 p-1 -mt-1 -mr-1 rounded"
        aria-label="إغلاق"
        data-testid="button-dismiss-error-banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
