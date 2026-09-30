import { useEffect, useMemo, useRef, useState } from "react";

export type OperationsCenterLiveReason = "change" | "poll" | "reconnect" | "scope-invalidated";
export type OperationsCenterLiveStatus = "disabled" | "connecting" | "connected" | "polling" | "access-invalidated";

/**
 * Hints are NOT data. Consumers must refetch their authenticated workspace GET
 * and clear the previous branch's data when scope-invalidated is received.
 * lastCheckedAt records a transport/poll attempt, not a change in business data.
 */
export function useOperationsCenterLive({
  enabled,
  branchIds,
  onInvalidate,
}: {
  enabled: boolean;
  branchIds: string[];
  onInvalidate: (reason: OperationsCenterLiveReason) => void;
}) {
  const [status, setStatus] = useState<OperationsCenterLiveStatus>("disabled");
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [lastChangeHintAt, setLastChangeHintAt] = useState<number | null>(null);
  const callback = useRef(onInvalidate);
  callback.current = onInvalidate;
  const scope = useMemo(() => [...new Set(branchIds)].sort().join(","), [branchIds]);
  const previousScope = useRef(scope);

  useEffect(() => {
    if (previousScope.current !== scope) {
      callback.current("scope-invalidated");
      previousScope.current = scope;
    }
    if (!enabled || !scope) {
      setStatus("disabled");
      return;
    }
    let active = true;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let accessInvalidated = false;
    const invalidate = (reason: OperationsCenterLiveReason) => {
      if (!active) return;
      callback.current(reason);
    };
    const scheduleRetry = () => {
      if (!active) return;
      source?.close();
      source = null;
      if (readyTimer) clearTimeout(readyTimer);
      setStatus(accessInvalidated ? "access-invalidated" : "polling");
      clearTimeout(retryTimer);
      retryTimer = setTimeout(connect, Math.min(60_000, 5_000 * 2 ** Math.min(failures++, 4)));
    };
    const connect = () => {
      if (!active || document.hidden || !navigator.onLine) {
        scheduleRetry();
        return;
      }
      source?.close();
      setStatus("connecting");
      source = new EventSource(`/api/operations-center/events?branchIds=${encodeURIComponent(scope)}`);
      readyTimer = setTimeout(scheduleRetry, 12_000);
      source.addEventListener("ready", () => {
        if (!active) return;
        if (readyTimer) clearTimeout(readyTimer);
        failures = 0;
        accessInvalidated = false;
        setLastCheckedAt(Date.now());
        setStatus("connected");
        invalidate("reconnect"); // no replay: catch writes missed during disconnect
      });
      source.addEventListener("invalidate", () => {
        if (!active) return;
        setLastChangeHintAt(Date.now());
        invalidate("change");
      });
      source.addEventListener("scope-invalidated", () => {
        if (!active) return;
        accessInvalidated = true;
        setStatus("access-invalidated");
        invalidate("scope-invalidated");
        scheduleRetry();
      });
      source.onerror = scheduleRetry;
    };
    const poll = () => {
      if (document.hidden || !navigator.onLine) return;
      // Poll regardless of SSE state: the event bus is process-local and not replayable.
      setLastCheckedAt(Date.now());
      invalidate("poll");
    };
    const onVisible = () => {
      if (!document.hidden) {
        poll();
        if (!source) {
          clearTimeout(retryTimer);
          connect();
        }
      }
    };
    const interval = setInterval(poll, 45_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    connect();
    return () => {
      active = false;
      source?.close();
      clearTimeout(retryTimer);
      clearTimeout(readyTimer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [enabled, scope]);

  return { status, lastCheckedAt, lastChangeHintAt };
}