import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCliAsync } from "../index";

const temporaryRoots: string[] = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("materialized customer CLI runtime closure", () => {
  it("installs, imports, preflights, and reaches start without factory-only packages", async () => {
    const parent = mkdtempSync(join(tmpdir(), "maestro-customer-cli-"));
    temporaryRoots.push(parent);
    const target = join(parent, "customer");
    const created = await runCliAsync(
      [
        "create",
        target,
        "--name",
        "Runtime Closure",
        "--outcome",
        "Track one customer request",
        "--demo-only",
        "--write",
        "--json",
      ],
      undefined,
      process.cwd(),
    );
    expect(created.exitCode, created.stderr).toBe(0);

    const customerEntry = readFileSync(
      join(target, "apps/cli/src/index.ts"),
      "utf8",
    );
    const customerComposition = readFileSync(
      join(target, "apps/cli/src/factory/customerComposition.ts"),
      "utf8",
    );
    expect(customerEntry).toContain("createCustomerCliComposition");
    expect(customerComposition).not.toMatch(
      /@maestro-template\/(stack-tooling|release-tooling)/,
    );

    execFileSync("pnpm", ["install", "--offline", "--frozen-lockfile"], {
      cwd: target,
      stdio: "pipe",
      timeout: 120_000,
    });
    expect(existsSync(join(target, ".git"))).toBe(false);
    execFileSync("git", ["init", "--quiet"], { cwd: target });
    execFileSync("pnpm", ["run", "prepare"], {
      cwd: target,
      stdio: "pipe",
      timeout: 30_000,
    });
    expect(existsSync(join(target, ".git/hooks/pre-commit"))).toBe(true);
    expect(existsSync(join(target, ".git/hooks/pre-push"))).toBe(true);
    execFileSync(
      "pnpm",
      [
        "exec",
        "tsx",
        "--eval",
        'import("./apps/cli/src/index.ts").then(() => console.log("imported"))',
      ],
      { cwd: target, stdio: "pipe", timeout: 30_000 },
    );

    const preflight = spawnSync(
      "pnpm",
      ["--silent", "maestro", "--", "preflight", "--mode", "fake", "--json"],
      { cwd: target, encoding: "utf8", timeout: 30_000 },
    );
    expect(preflight.error).toBeUndefined();
    expect(() => JSON.parse(preflight.stdout)).not.toThrow();
    expect(preflight.stderr).not.toContain("ERR_MODULE_NOT_FOUND");

    const start = spawnSync("pnpm", ["maestro", "--", "start", "--help"], {
      cwd: target,
      encoding: "utf8",
      timeout: 30_000,
    });
    expect(start.status, start.stderr).toBe(0);
    expect(start.stdout).toContain("maestro start");
    expect(start.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
  }, 180_000);
});
