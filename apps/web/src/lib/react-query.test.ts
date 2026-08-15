import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("getQueryClient", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
    vi.resetModules();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("configures the singleton used by the Starter provider", async () => {
    const { getQueryClient } = await import("./react-query");
    const queryFn = async () => "connected";

    const configured = getQueryClient({
      defaultOptions: { queries: { queryFn } },
    });

    expect(configured.getDefaultOptions().queries?.queryFn).toBe(queryFn);
    expect(getQueryClient()).toBe(configured);
  });
});
