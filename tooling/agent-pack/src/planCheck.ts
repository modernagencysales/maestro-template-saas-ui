import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
  type AgentPackArgumentResult,
  type AgentPackJsonValue,
} from "./contracts.js";
import type { RepositoryContext } from "./repoContext.js";

export type PlanCheckInput = {
  readonly plan: Readonly<Record<string, AgentPackJsonValue>>;
};

export type StackPlanValidator = (
  plan: PlanCheckInput["plan"],
  repo: RepositoryContext,
) => readonly string[];

export function createPlanCheckCommand(input: {
  readonly validate: StackPlanValidator;
}) {
  return defineAgentPackCommand({
    id: "plan-check",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: decodePlanCheckInput,
    mutationPosture: () => "read-only",
    execute: async ({ plan }, context) => {
      const findings = [...input.validate(plan, context.repo)];
      const diagnostics = findings.map((message) => ({
        code: "AGENT_PACK_PLAN_INVALID",
        severity: "error" as const,
        message,
        safeToContinue: false,
        nextAction:
          "Repair the declared plan schema, completeness, order, risks, or ADR references.",
        rerun: "pnpm maestro -- plan-check --plan <manifest.json>",
      }));
      return {
        mutationPosture: "read-only" as const,
        exitClass:
          diagnostics.length === 0
            ? ("success" as const)
            : ("findings" as const),
        summary:
          diagnostics.length === 0
            ? "Plan check passed."
            : "Plan check found deterministic manifest violations.",
        diagnostics,
        data: { valid: findings.length === 0, findings },
      };
    },
  });
}

function decodePlanCheckInput(
  input: unknown,
): AgentPackArgumentResult<PlanCheckInput> {
  if (
    isRecord(input) &&
    Object.keys(input).length === 1 &&
    isRecord(input.plan) &&
    typeof input.plan.feature === "string" &&
    Array.isArray(input.plan.slices) &&
    Array.isArray(input.plan.allTaskRefs) &&
    isAgentPackJsonValue(input.plan)
  ) {
    return { ok: true, args: { plan: input.plan } };
  }
  return {
    ok: false,
    diagnostics: [
      {
        code: "AGENT_PACK_PLAN_CHECK_INVALID",
        severity: "error",
        message: "Plan check requires one JSON stack-plan manifest.",
        safeToContinue: false,
        nextAction: "Provide a manifest with feature, slices, and allTaskRefs.",
        rerun: "pnpm maestro -- plan-check --plan <manifest.json>",
      },
    ],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAgentPackJsonValue(value: unknown): value is AgentPackJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.every(isAgentPackJsonValue);
  return isRecord(value) && Object.values(value).every(isAgentPackJsonValue);
}
