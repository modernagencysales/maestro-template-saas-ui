import { execFileSync } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isCliDirectRun } from "./direct-run";
import { runCliEntry } from "./index";

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

  it(
    "imports without executing help for an unrelated index.ts entry",
    { timeout: 15_000 },
    () => {
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
    },
  );

  it("routes exact plain mcp argv to stdio without CLI rendering", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    await runCliEntry(["mcp"], {
      stdin: Readable.from([
        `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })}\n`,
      ]),
      stdout: writable(stdout),
      stderr: writable(stderr),
      cwd: repoRoot,
    });
    expect(JSON.parse(stdout.join(""))).toMatchObject({
      jsonrpc: "2.0",
      result: { tools: expect.any(Array) },
    });
    expect(stderr).toEqual([]);
  });
});

function writable(chunks: string[]): Writable {
  return new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
}
