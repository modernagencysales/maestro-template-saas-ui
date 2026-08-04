import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
  type AgentPackArgumentResult,
  type AgentPackJsonValue,
} from "./contracts.js";
import type { RepositoryContext } from "./repoContext.js";
import { readFileSync } from "node:fs";
import { isAbsolute, normalize } from "node:path";

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
      const contractFindings = requiredPlanFields(plan, context.repo);
      const validatorFindings = [...input.validate(plan, context.repo)];
      const findings = [
        ...contractFindings.map(({ message }) => message),
        ...validatorFindings,
      ];
      const diagnostics = [
        ...contractFindings,
        ...validatorFindings.map((message) => ({
          code: "AGENT_PACK_PLAN_INVALID",
          message,
        })),
      ].map(({ code, message }) => ({
        code,
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

const REQUIRED_ARRAYS = [
  "qualityTargets",
  "architectureRules",
  "cucumberFeatures",
  "denialCases",
  "focusedTests",
  "conflictDomains",
] as const;

function requiredPlanFields(
  plan: PlanCheckInput["plan"],
  repo: RepositoryContext,
): Array<{ code: string; message: string }> {
  const findings = REQUIRED_ARRAYS.flatMap((field) => {
    const value = plan[field];
    const valid =
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((item) => typeof item === "string" && item.trim() !== "");
    return valid
      ? []
      : [
          {
            code: `plan.${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}.required`,
            message: `${field} must be a non-empty string array`,
          },
        ];
  });
  const manifest = JSON.parse(
    readFileSync(`${repo.sourceRoot}/package.json`, "utf8"),
  ) as { scripts?: Record<string, string> };
  const rules = readFileSync(
    `${repo.sourceRoot}/docs/rule-coverage.md`,
    "utf8",
  );
  for (const target of strings(plan.qualityTargets)) {
    if (manifest.scripts?.[target] === undefined)
      findings.push({
        code: "plan.quality-targets.unknown",
        message: `quality target is not a package script: ${target}`,
      });
  }
  for (const rule of strings(plan.architectureRules)) {
    if (!rules.includes(rule))
      findings.push({
        code: "plan.architecture-rules.unknown",
        message: `architecture rule is not mechanically documented: ${rule}`,
      });
  }
  for (const path of strings(plan.cucumberFeatures)) {
    if (
      isAbsolute(path) ||
      normalize(path).startsWith("..") ||
      !path.endsWith(".feature")
    )
      findings.push({
        code: "plan.cucumber-features.invalid",
        message: `Cucumber path must be repository-relative and end in .feature: ${path}`,
      });
  }
  return findings;
}

function strings(value: AgentPackJsonValue | undefined): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
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
