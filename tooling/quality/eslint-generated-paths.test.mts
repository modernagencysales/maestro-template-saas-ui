import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

describe("ESLint generated path ownership", () => {
  it("ignores canonical Convex codegen at every supported depth", async () => {
    const eslint = new ESLint({ cwd: repositoryRoot });

    await expect(
      eslint.isPathIgnored(
        "packages/convex/convex/components/workflowAdmission/_generated/component.ts",
      ),
    ).resolves.toBe(true);
    await expect(
      eslint.isPathIgnored("packages/convex/convex/_generated/server.d.ts"),
    ).resolves.toBe(true);
    await expect(
      eslint.isPathIgnored(
        "packages/convex/convex/components/workflowAdmission/convex.config.ts",
      ),
    ).resolves.toBe(false);
  });
});

describe("ESLint shift-left policy", () => {
  it("reports quality thresholds without weakening correctness rules", () => {
    const result = spawnSync(
      "pnpm",
      [
        "exec",
        "eslint",
        "--format",
        "json",
        "--stdin",
        "--stdin-filename",
        "tooling/quality/eslint-policy.fixture.ts",
      ],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: { ...process.env, ESLINT_SHIFT_LEFT: "1" },
        input: `export function inspect(
  value: any,
  first: boolean,
  second: boolean,
  third: boolean,
  fourth: boolean,
  fifth: boolean,
): number {
  let count = 0;
  if (value) {
    if (first) {
      if (second) {
        if (third) {
          if (fourth) count += 1;
        }
      }
    }
  }
  if (first) count += 1;
  if (second) count += 1;
  if (third) count += 1;
  if (fourth) count += 1;
  if (fifth) count += 1;
  return count;
}\n`,
      },
    );
    expect(result.error).toBeUndefined();
    const reports = JSON.parse(result.stdout) as {
      readonly messages: readonly {
        readonly ruleId: string | null;
        readonly severity: number;
      }[];
    }[];
    const report = reports[0];
    if (report === undefined) throw new Error("ESLint emitted no JSON report");
    const severities = new Map(
      report.messages.map(({ ruleId, severity }) => [ruleId, severity]),
    );

    expect(severities.get("complexity")).toBe(1);
    expect(severities.get("max-depth")).toBe(1);
    expect(severities.get("max-params")).toBe(1);
    expect(severities.get("@typescript-eslint/no-explicit-any")).toBe(2);
    expect(result.status).toBe(1);
  });
});
