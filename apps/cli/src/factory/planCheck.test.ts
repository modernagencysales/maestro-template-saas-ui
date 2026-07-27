import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPlanCheckCommand } from "@maestro-template/agent-pack";
import { validatePlan } from "@maestro-template/stack-tooling";
import { describe, expect, it } from "vitest";
import { runPlanCheckCli } from "./planCheck";

describe("plan-check CLI adapter", () => {
  it("strictly reads a manifest and renders the shared result", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "maestro-plan-check-"));
    try {
      await writeFile(
        join(cwd, "plan.json"),
        JSON.stringify({
          feature: "x",
          slices: [],
          allTaskRefs: [],
          adrRefs: [],
        }),
      );
      const result = await runPlanCheckCli(
        createPlanCheckCommand({ validate: (plan) => validatePlan(plan) }),
        ["plan-check", "--plan", "plan.json", "--json"],
        cwd,
      );
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: { id: "plan-check" },
        data: { valid: true },
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it.each([
    ["missing path", ["plan-check", "--json"]],
    ["duplicate path", ["plan-check", "--plan", "a", "--plan", "b", "--json"]],
    ["unknown option", ["plan-check", "--wat", "--json"]],
    [
      "path outside the repository",
      ["plan-check", "--plan", "../plan.json", "--json"],
    ],
  ])("fails closed for %s", async (_case, argv) => {
    const result = await runPlanCheckCli(
      createPlanCheckCommand({ validate: () => [] }),
      argv,
      "/fixture",
    );
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      exitClass: "invalidInvocation",
    });
  });
});
