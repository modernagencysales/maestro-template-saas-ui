import { describe, expect, it } from "vitest";

import config from "../../playwright.config";

describe("starter route Playwright server", () => {
  it("starts only the checked-in template app", () => {
    if (Array.isArray(config.webServer) || !config.webServer)
      throw new Error("Expected one web server");

    expect(config.webServer.command).toContain("apps/web dev");
    expect(config.webServer.reuseExistingServer).toBe(true);
  });
});
