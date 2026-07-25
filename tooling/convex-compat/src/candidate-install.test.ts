import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const candidateRoot = mkdtempSync(join(tmpdir(), "maestro-workpool-048-"));

const runPnpm = (...args: readonly string[]): void => {
  execFileSync("pnpm", [...args], {
    cwd: candidateRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
};

describe("isolated Workpool 0.4.8 candidate", () => {
  beforeAll(() => {
    writeFileSync(
      join(candidateRoot, "package.json"),
      JSON.stringify({
        name: "maestro-workpool-048-proof",
        private: true,
        dependencies: {
          "@convex-dev/workflow": "0.4.4",
          "@convex-dev/workpool": "0.4.8",
          convex: "1.42.3",
          "convex-test": "0.0.54",
        },
      }),
    );
    runPnpm("install", "--ignore-workspace", "--lockfile-only");
    runPnpm("install", "--ignore-workspace", "--frozen-lockfile");
  }, 120_000);

  afterAll(() => rmSync(candidateRoot, { recursive: true, force: true }));

  it("resolves the exact candidate set through a fresh frozen install", () => {
    const lock = readFileSync(join(candidateRoot, "pnpm-lock.yaml"), "utf8");
    const installed = JSON.parse(
      readFileSync(
        join(candidateRoot, "node_modules/@convex-dev/workpool/package.json"),
        "utf8",
      ),
    ) as { readonly version?: string };
    expect(installed.version).toBe("0.4.8");
    expect(lock).toContain("'@convex-dev/workpool':");
    expect(lock).toContain("specifier: 0.4.8");
    expect(lock).toContain("specifier: 1.42.3");
  });

  it("reports the published 0.4.8 source regressions honestly", () => {
    const source = readFileSync(
      join(
        candidateRoot,
        "node_modules/@convex-dev/workpool/src/component/stateMachine.test.ts",
      ),
      "utf8",
    );
    expect(source).toContain("duplicate complete with correct attempt");
    expect(source).toContain("multiple cancels for same work");
    expect(source).toContain("duplicate complete with correct attempt -> BUG");
    expect(source).toContain("multiple cancels for same work -> BUG");
  });
});
