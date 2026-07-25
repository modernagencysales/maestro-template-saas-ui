import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isCliDirectRun } from "./direct-run";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

describe("CLI direct-entry guard", () => {
  it("matches only the exact resolved process entry URL", () => {
    const entry = "/repo/apps/cli/src/index.ts";
    const url = "file:///repo/apps/cli/src/index.ts";

    expect(isCliDirectRun(url, ["node", entry])).toBe(true);
    expect(isCliDirectRun(url, ["node", "/tmp/index.ts"])).toBe(false);
    expect(isCliDirectRun(url, ["node", `${entry}.fixture`])).toBe(false);
    expect(isCliDirectRun(url, ["node"])).toBe(false);
  });

  it("imports without executing help for an unrelated index.ts entry", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "--eval",
        [
          'process.argv[1] = "/tmp/index.ts";',
          'await import("./apps/cli/src/index.ts");',
        ].join("\n"),
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );

    expect(output).toBe("");
  });
});
