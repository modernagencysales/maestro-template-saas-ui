import { describe, expect, it } from "vitest";
import { isGeneratorDirectRun } from "./direct-run";

describe("generator direct-entry guard", () => {
  it("matches only the exact resolved entry URL", () => {
    const entry = "/repo/tooling/generators/src/index.ts";
    const url = "file:///repo/tooling/generators/src/index.ts";

    expect(isGeneratorDirectRun(url, ["node", entry])).toBe(true);
    expect(isGeneratorDirectRun(url, ["node", "/tmp/index.ts"])).toBe(false);
    expect(isGeneratorDirectRun(url, ["node", `${entry}.fixture`])).toBe(false);
    expect(isGeneratorDirectRun(url, ["node"])).toBe(false);
  });
});
