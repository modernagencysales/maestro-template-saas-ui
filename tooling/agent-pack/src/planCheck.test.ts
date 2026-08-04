import { describe, expect, it, vi } from "vitest";
import { executeAgentPackCommand } from "./contracts.js";
import { createPlanCheckCommand } from "./planCheck.js";
import { createRepositoryContext } from "./repoContext.js";
import { resolve } from "node:path";

const context = {
  schemaVersion: 1 as const,
  invocation: "library" as const,
  repo: createRepositoryContext({
    cwd: resolve(import.meta.dirname, "../../.."),
  }),
};
const plan = {
  feature: "agent-pack scaffold",
  slices: [],
  allTaskRefs: [],
  qualityTargets: ["lint"],
  architectureRules: ["Preserve layer law (imports respect layers)"],
  cucumberFeatures: ["features/scaffold.feature"],
  denialCases: ["unauthorized access"],
  focusedTests: ["tooling/agent-pack/src/planCheck.test.ts"],
  conflictDomains: ["tooling/agent-pack"],
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
    expect(validate).toHaveBeenCalledWith(plan, context.repo);
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
    "qualityTargets",
    "architectureRules",
    "cucumberFeatures",
    "denialCases",
    "focusedTests",
    "conflictDomains",
  ] as const)("rejects a plan without non-empty %s", async (field) => {
    const result = await executeAgentPackCommand(
      createPlanCheckCommand({ validate: () => [] }),
      { plan: { ...plan, [field]: [] } },
      context,
    );

    expect(result).toMatchObject({
      exitClass: "findings",
      diagnostics: [
        expect.objectContaining({
          code: `plan.${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}.required`,
        }),
      ],
    });
  });

  it("rejects unknown commands, prose-only rules, and unsafe feature paths", async () => {
    const result = await executeAgentPackCommand(
      createPlanCheckCommand({ validate: () => [] }),
      {
        plan: {
          ...plan,
          qualityTargets: ["not-a-package-script"],
          architectureRules: ["please write clean code"],
          cucumberFeatures: ["../outside.feature"],
        },
      },
      context,
    );

    expect(result.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "plan.quality-targets.unknown",
        "plan.architecture-rules.unknown",
        "plan.cucumber-features.invalid",
      ]),
    );
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
