import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("routes declared root generator scripts through executable entries", () => {
    const packageJson = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, "../../../package.json"),
        "utf8",
      ),
    ) as { readonly scripts: Readonly<Record<string, string>> };

    const inertScripts = Object.entries(packageJson.scripts)
      .filter(([name]) => name.startsWith("template:"))
      .filter(([, command]) =>
        command.includes("tooling/generators/src/index.ts"),
      )
      .map(([name]) => name);

    expect(inertScripts).toEqual([]);
  });
});
