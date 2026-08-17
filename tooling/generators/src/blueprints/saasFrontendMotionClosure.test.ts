import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildSaasApplicationTargetPlan } from "./saasApplication";

describe("SaaS UI generated target Motion dependency closure", () => {
  it("imports framer-motion after a frozen generated-target install", () => {
    const target = mkdtempSync(join(tmpdir(), "saas-ui-motion-closure-"));

    try {
      for (const entry of buildSaasApplicationTargetPlan({
        name: "Motion closure",
      }).entries) {
        const path = join(target, entry.path);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, entry.content);
      }

      try {
        execFileSync("pnpm", ["install", "--frozen-lockfile"], {
          cwd: target,
          stdio: "pipe",
        });
      } catch (error) {
        const result = error as { stderr?: Buffer; stdout?: Buffer };
        throw new Error(
          `Frozen generated-target install failed:\n${result.stdout?.toString() ?? ""}${result.stderr?.toString() ?? ""}`,
        );
      }
      const output = execFileSync(
        "node",
        [
          "--input-type=module",
          "--eval",
          'await import("framer-motion"); process.exit(0)',
        ],
        { cwd: join(target, "apps/web"), encoding: "utf8" },
      );

      expect(output).toBe("");
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 180_000);
});
