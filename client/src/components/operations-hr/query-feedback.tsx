import { Button } from "@/components/ui/button";
import { operationsQueryError, type OperationsReadState } from "@/lib/operations-payroll-report";

export function OperationsQueryFeedback({ state, loading, failure, onRetry, error }: {
  state: OperationsReadState; loading: string; failure: string; onRetry: () => unknown; error?: unknown;
}) {
  if (state === "loading") return <p role="status" className="mt-3 text-sm text-muted-foreground">{loading}</p>;
  if (state !== "error") return null;
  const detail = operationsQueryError(error);
  return <div role="alert" className="mt-3 space-y-2 text-sm">
    <p>{failure}{detail ? ` ${detail}` : ""}</p>
    <Button type="button" variant="outline" size="sm" onClick={() => { void onRetry(); }}>إعادة المحاولة</Button>
  </div>;
}