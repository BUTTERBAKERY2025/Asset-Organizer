import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryObserver } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import { isAuthoritativeAuthReady } from "./auth-readiness";
import { ownerAccessRevoked, restoreOwnerAccess, revokeOwnerAccess } from "../hooks/use-owner-portal";

afterEach(() => { restoreOwnerAccess(); queryClient.clear(); vi.restoreAllMocks(); });

describe("owner access revocation", () => {
  it("purges active AND inactive cached owner data on 403, leaves a denied UI state, and revalidates auth", () => {
    const activeKey = ["owner", "sales", "branch-a"];
    const inactiveKey = ["owner", "shareholders", 2];
    queryClient.setQueryData(activeKey, { sales: 124.5 });
    queryClient.setQueryData(inactiveKey, { name: "Private" });
    const observer = new QueryObserver(queryClient, { queryKey: activeKey, queryFn: async () => ({ sales: 124.5 }), enabled: false });
    const unsubscribe = observer.subscribe(() => {});
    const refresh = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const cancel = vi.spyOn(queryClient, "cancelQueries");
    revokeOwnerAccess(403);
    expect(ownerAccessRevoked()).toBe(true);
    expect(queryClient.getQueryData(activeKey)).toBeUndefined();
    expect(queryClient.getQueryData(inactiveKey)).toBeUndefined();
    expect(cancel).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledWith({ queryKey: ["/api/auth/me"], refetchType: "all" });
    unsubscribe();
  });

  it("keeps cached identity behind the gate until /me was freshly resolved", () => {
    const auth = { fetchedAfterMount: true, fetching: false, error: false, role: "business_owner", hasUser: true, legacyLoading: false };
    expect(isAuthoritativeAuthReady({ ...auth, fetchedAfterMount: false })).toBe(false);
    expect(isAuthoritativeAuthReady({ ...auth, fetching: true })).toBe(false);
    expect(isAuthoritativeAuthReady({ ...auth, error: true })).toBe(false);
    expect(isAuthoritativeAuthReady(auth)).toBe(true);
    expect(isAuthoritativeAuthReady({ ...auth, role: "employee", legacyLoading: true })).toBe(false);
    expect(isAuthoritativeAuthReady({ ...auth, role: "employee" })).toBe(true);
  });
});