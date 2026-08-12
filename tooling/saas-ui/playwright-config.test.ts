import { describe, expect, it } from "vitest";

import config from "../../playwright.config";

describe("golden authority web servers", () => {
  it("allows a cold generated authority to finish before Playwright times out", () => {
    if (!Array.isArray(config.webServer))
      throw new Error("Expected web servers");

    const reference = config.webServer.find((server) =>
      server.command.includes(" reference "),
    );
    const generated = config.webServer.find((server) =>
      server.command.includes(" generated "),
    );

    expect(reference?.timeout).toBe(120_000);
    expect(generated?.timeout).toBe(180_000);
  });
});
