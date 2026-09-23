import { CancelledError, QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  HttpError,
  classifyDataError,
  getHttpStatus,
  shouldRetryQuery,
} from "../client/src/lib/queryClient";

describe("query reliability classification", () => {
  it("retains typed HTTP status and the exact legacy message prefix", () => {
    const error = new HttpError(403, "Forbidden");
    expect(error.status).toBe(403);
    expect(error.message).toBe("403: Forbidden");
    expect(getHttpStatus(error)).toBe(403);
  });

  it("does not retry or banner typed and legacy authoritative 403 failures", () => {
    for (const error of [new HttpError(403, "sensitive body"), new Error("403: legacy body")]) {
      expect(shouldRetryQuery(0, error)).toBe(false);
      expect(classifyDataError(error)).toBeNull();
    }
  });

  it("retries a server failure at most twice and exposes only a safe classification", () => {
    const error = new HttpError(500, "token=secret&customerId=123");
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(1, error)).toBe(true);
    expect(shouldRetryQuery(2, error)).toBe(false);
    expect(classifyDataError(error)).toEqual({
      category: "server",
      status: 500,
      safeArabicLabel: "خطأ مؤقت في الخادم (500)",
    });
    expect(classifyDataError(error)?.safeArabicLabel).not.toMatch(/secret|customer|123/);
  });

  it("never retries or banners browser aborts and TanStack cancellations", () => {
    for (const error of [
      new DOMException("The operation was aborted", "AbortError"),
      new CancelledError(),
    ]) {
      expect(shouldRetryQuery(0, error)).toBe(false);
      expect(classifyDataError(error)).toBeNull();
    }
  });

  it("classifies network failures and timeouts without leaking their messages", () => {
    const network = new TypeError("Failed to fetch https://host/path?token=secret");
    const timeout = new DOMException("Request timed out", "TimeoutError");
    expect(shouldRetryQuery(0, network)).toBe(true);
    expect(classifyDataError(network)).toEqual({
      category: "connection",
      safeArabicLabel: "تعذّر الاتصال بالخادم",
    });
    expect(shouldRetryQuery(0, timeout)).toBe(true);
    expect(classifyDataError(timeout)).toEqual({
      category: "timeout",
      safeArabicLabel: "انتهت مهلة الاتصال",
    });
  });

  it.each([408, 425, 429])("treats exceptional transient status %i as retryable", (status) => {
    const error = new HttpError(status, "temporary");
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(classifyDataError(error)?.category).toBe("status");
  });

  it("recovers a read after one transient 503 without leaving an error", async () => {
    let calls = 0;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: shouldRetryQuery, retryDelay: 0 } },
    });
    const result = await client.fetchQuery({
      queryKey: ["/api/central-kitchen-demand?page=1"],
      queryFn: async () => {
        calls += 1;
        if (calls === 1) throw new HttpError(503, "temporary");
        return { rows: [], total: 0 };
      },
    });
    expect(result).toEqual({ rows: [], total: 0 });
    expect(calls).toBe(2);
    expect(client.getQueryState(["/api/central-kitchen-demand?page=1"])?.status).toBe("success");
  });

  it("surfaces persistent 503 accurately and manual refetch clears it without rebuilding the client", async () => {
    let available = false;
    let calls = 0;
    const key = ["/api/central-kitchen-demand?page=1"];
    const client = new QueryClient({
      defaultOptions: { queries: { retry: shouldRetryQuery, retryDelay: 0 } },
    });
    const queryFn = async () => {
      calls += 1;
      if (!available) throw new HttpError(503, "internal details");
      return { rows: [], total: 0 };
    };

    await expect(client.fetchQuery({ queryKey: key, queryFn })).rejects.toMatchObject({ status: 503 });
    expect(calls).toBe(3);
    expect(classifyDataError(client.getQueryState(key)?.error)).toEqual({
      category: "server",
      status: 503,
      safeArabicLabel: "خطأ مؤقت في الخادم (503)",
    });

    available = true;
    await client.refetchQueries({ queryKey: key, exact: true });
    expect(client.getQueryState(key)?.status).toBe("success");
    expect(client.getQueryState(key)?.error).toBeNull();
  });
});