import { describe, expect, it } from "vitest";
import { resolveScheduleBranch as resolve } from "../client/src/lib/schedule-branch-selection";

describe("schedule branch selection after asynchronous authorization", () => {
  const one = [{ id: "branch-a" }];
  const two = [...one, { id: "branch-b" }];
  it("waits for permissions then opens the single authorized branch", () => {
    expect(resolve("", [], false, false)).toBe("");
    expect(resolve("", one, true, false)).toBe("branch-a");
  });
  it("recovers the previously stranded all-branches selection", () => {
    expect(resolve("all", one, true, false)).toBe("branch-a");
  });
  it("does not use stale branches during loading or failure", () => {
    expect(resolve("branch-a", one, false, false)).toBe("");
  });
  it("restores a multi-branch choice after refetch", () => {
    expect(resolve("branch-b", [], false, false)).toBe("");
    expect(resolve("branch-b", two, true, true)).toBe("branch-b");
  });
  it("preserves all-branches view for authorized multi-branch users and admins", () => {
    expect(resolve("", two, true, true)).toBe("all");
    expect(resolve("all", one, true, true)).toBe("all");
  });
  it("never reuses a removed branch", () => {
    expect(resolve("revoked", one, true, false)).toBe("branch-a");
    expect(resolve("revoked", two, true, true)).toBe("all");
    expect(resolve("revoked", [], true, true)).toBe("");
  });
  it("fails closed for empty authorization and inconsistent restricted scope", () => {
    expect(resolve("all", [], true, false)).toBe("");
    expect(resolve("branch-a", two, true, false)).toBe("");
  });
});