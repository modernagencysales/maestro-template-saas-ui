import { describe, expect, it, vi } from "vitest";
import { executeAgentPackCommand } from "./contracts.js";
import { createPlanCheckCommand } from "./planCheck.js";
import { createRepositoryContext } from "./repoContext.js";

const context = {
  schemaVersion: 1 as const,
  invocation: "library" as const,
  repo: createRepositoryContext({ cwd: "/repo" }),
};
const plan = {
  feature: "agent-pack scaffold",
  slices: [],
  allTaskRefs: [],
};

describe("plan-check command", () => {
  it("delegates the exact plan to the stack validator", async () => {
    const validate = vi.fn(() => [] as readonly string[]);
    const result = await executeAgentPackCommand(
      createPlanCheckCommand({ validate }),
      { plan },
      context,
    );

    expect(validate).toHaveBeenCalledOnce();
    expect(validate).toHaveBeenCalledWith(plan);
    expect(result).toMatchObject({
      mutationPosture: "read-only",
      exitClass: "success",
      diagnostics: [],
      data: { valid: true, findings: [] },
    });
  });

  it("projects deterministic validator findings without grading judgment", async () => {
    const findings = [
      "slice 2 breaks dependency order",
      "stack does not cover task WP-3.3",
    ];
    const result = await executeAgentPackCommand(
      createPlanCheckCommand({ validate: () => findings }),
      { plan },
      context,
    );

    expect(result).toMatchObject({
      exitClass: "findings",
      diagnostics: findings.map((message) => ({
        code: "AGENT_PACK_PLAN_INVALID",
        severity: "error",
        message,
        safeToContinue: false,
      })),
      data: { valid: false, findings },
    });
  });

  it.each([
    {},
    { plan: null },
    { plan: { feature: "x", slices: [] } },
    { plan, extra: true },
  ])("rejects malformed transport input %#", async (input) => {
    const validate = vi.fn(() => [] as readonly string[]);
    const result = await executeAgentPackCommand(
      createPlanCheckCommand({ validate }),
      input,
      context,
    );

    expect(result).toMatchObject({ exitClass: "invalidInvocation" });
    expect(validate).not.toHaveBeenCalled();
  });
});
