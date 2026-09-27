import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  removeQueries: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: mocks.useQuery,
  useQueryClient: () => ({ removeQueries: mocks.removeQueries }),
}));

import { useRecipeMaterialRequirements, RecipeMaterialsPreview } from "../client/src/components/central-kitchen/recipe-materials";

beforeEach(() => vi.stubGlobal("React", React));

function Probe({ enabled }: { enabled: boolean }) {
  useRecipeMaterialRequirements({ batchId: 24, enabled });
  return null;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("production materials query isolation", () => {
  it("does not execute the materials query when scope is disabled", () => {
    mocks.useQuery.mockImplementation(options => {
      if (options.enabled) void options.queryFn();
      return { isLoading: true };
    });
    renderToStaticMarkup(createElement(Probe, { enabled: false }));
    expect(mocks.useQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    expect(mocks.removeQueries).not.toHaveBeenCalled();
  });

  it("rejects 403 without disrupting observers and never renders stale data from an errored query", async () => {
    let queryFn: () => Promise<unknown> = async () => null;
    mocks.useQuery.mockImplementation(options => {
      queryFn = options.queryFn;
      return { isLoading: true };
    });
    renderToStaticMarkup(createElement(Probe, { enabled: true }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 403, ok: false, json: async () => ({ error: "غير مصرح" }),
    }));
    await expect(queryFn()).rejects.toThrow("غير مصرح");
    expect(mocks.removeQueries).not.toHaveBeenCalled();
    const html = renderToStaticMarkup(createElement(RecipeMaterialsPreview, {
      query: {
        isLoading: false, isError: true, error: new Error("غير مصرح"),
        data: { recipe: { recipeId: 999, recipeVersion: "SECRET" }, requirements: [] },
      } as any,
    }));
    expect(html).not.toContain("SECRET");
    expect(html).not.toContain("999");
  });
});