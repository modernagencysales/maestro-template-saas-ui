import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
  type AgentPackArgumentResult,
  type AgentPackDiagnostic,
  type AgentPackJsonValue,
} from "./contracts.js";
import type { RepositoryContext } from "./repoContext.js";

export type ScaffoldArguments = Readonly<Record<string, AgentPackJsonValue>>;

export type ScaffoldGeneratorOutput = {
  readonly files: readonly {
    readonly path: string;
    readonly content: string;
  }[];
  readonly provenancePaths: readonly string[];
  readonly collisions: readonly string[];
  readonly semanticRuleIds: readonly string[];
  readonly manualFollowUp: readonly string[];
  readonly codegen: readonly string[];
  readonly focusedGates: readonly string[];
};

export type ScaffoldSuggestion = {
  readonly generatorId: string;
  readonly recipe: string;
  readonly command: string;
};

export type WorkflowScaffoldRestriction = {
  readonly ruleId: string;
  readonly status: "intentionally-restricted" | "unsupported";
  readonly alternative: string;
  readonly adrPath: string;
};

export type WorkflowSemanticProjection = {
  readonly id: string;
  readonly status: "supported" | "intentionally-restricted" | "unsupported";
  readonly repair: string;
};

export type WorkflowResolution =
  | {
      readonly kind: "declared-alternative";
      readonly ruleId: string;
      readonly alternative: string;
    }
  | {
      readonly kind: "reviewed-adr";
      readonly ruleId: string;
      readonly adrRef: string;
    };

export type ScaffoldGeneratorRequest = {
  readonly generatorId: string;
  readonly args: ScaffoldArguments;
  readonly write: boolean;
  readonly repo: RepositoryContext;
};

export type ScaffoldGeneratorRunResult =
  | { readonly ok: true; readonly output: ScaffoldGeneratorOutput }
  | { readonly ok: false; readonly message: string };

export type ScaffoldDependencies = {
  readonly generators: {
    readonly resolve: (generatorId: string) =>
      | { readonly supported: true }
      | {
          readonly supported: false;
          readonly nearest: readonly ScaffoldSuggestion[];
        };
    readonly run: (
      request: ScaffoldGeneratorRequest,
    ) => Promise<ScaffoldGeneratorRunResult>;
  };
  readonly preflight: {
    readonly inspect: (repo: RepositoryContext) => Promise<{
      readonly fingerprint: string;
      readonly safeToMutate: boolean;
      readonly cleanWorktree: boolean;
    }>;
  };
  readonly workflow: {
    readonly semantics: readonly WorkflowSemanticProjection[];
    readonly reviewedAdrRefs: (repo: RepositoryContext) => ReadonlySet<string>;
  };
};

export type ScaffoldInput = {
  readonly generatorId: string;
  readonly args: ScaffoldArguments;
  readonly write: boolean;
  readonly workflowRuleIds: readonly string[];
  readonly workflowResolutions: readonly WorkflowResolution[];
};

export function createScaffoldCommand(dependencies: ScaffoldDependencies) {
  return defineAgentPackCommand({
    id: "scaffold",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: decodeScaffoldInput,
    mutationPosture: ({ write }) => (write ? "write" : "preview"),
    execute: (input, context) => executeScaffold(input, context, dependencies),
  });
}

async function executeScaffold(
  input: ScaffoldInput,
  context: { readonly repo: RepositoryContext },
  dependencies: ScaffoldDependencies,
) {
  const mutationPosture = input.write
    ? ("write" as const)
    : ("preview" as const);
  const resolution = dependencies.generators.resolve(input.generatorId);
  if (!resolution.supported)
    return unsupportedScaffold(input, mutationPosture, resolution.nearest);

  const restrictions = workflowRestrictions(
    input.workflowRuleIds,
    input.workflowResolutions,
    dependencies.workflow,
    context.repo,
  );
  if (restrictions.length > 0)
    return restrictedScaffold(input, mutationPosture, restrictions);

  const preflight = input.write
    ? await dependencies.preflight.inspect(context.repo)
    : undefined;
  const preview = await dependencies.generators.run({
    generatorId: input.generatorId,
    args: input.args,
    write: false,
    repo: context.repo,
  });
  if (!preview.ok)
    return generatorUnavailable(input, mutationPosture, preview.message);
  if (!input.write)
    return scaffoldSuccess(input, mutationPosture, preview.output);
  return writeScaffold(
    input,
    context.repo,
    dependencies,
    preflight,
    preview.output,
  );
}

async function writeScaffold(
  input: ScaffoldInput,
  repo: RepositoryContext,
  dependencies: ScaffoldDependencies,
  preflight:
    | {
        readonly fingerprint: string;
        readonly safeToMutate: boolean;
        readonly cleanWorktree: boolean;
      }
    | undefined,
  preview: ScaffoldGeneratorOutput,
) {
  const mutationPosture = "write" as const;
  if (preview.collisions.length > 0)
    return scaffoldCollision(input, mutationPosture, preview);
  if (preflight === undefined || !preflight.safeToMutate)
    return scaffoldBlocked(input, mutationPosture, preview, preflightBlock());

  const written = await dependencies.generators.run({
    generatorId: input.generatorId,
    args: input.args,
    write: true,
    repo,
  });
  if (!written.ok)
    return generatorUnavailable(input, mutationPosture, written.message);
  return written.output.collisions.length > 0
    ? scaffoldCollision(input, mutationPosture, written.output)
    : scaffoldSuccess(input, mutationPosture, written.output);
}

function unsupportedScaffold(
  input: ScaffoldInput,
  mutationPosture: "preview" | "write",
  nearest: readonly ScaffoldSuggestion[],
) {
  return {
    mutationPosture,
    exitClass: "findings" as const,
    summary: "No reviewed generator matches this scaffold request.",
    diagnostics: [unsupportedDiagnostic(input.generatorId, nearest)],
    data: scaffoldData(input, {
      output: null,
      nearest,
      templateGap: {
        kind: "template-gap" as const,
        target: input.generatorId,
        followUpGates: [],
        templateBacklogRef: "<required-reviewed-template-backlog-ref>",
        templateResolutionPath: "<required-promotion-or-import-path>",
      },
      restrictions: [],
    }),
  };
}

function restrictedScaffold(
  input: ScaffoldInput,
  mutationPosture: "preview" | "write",
  restrictions: readonly WorkflowScaffoldRestriction[],
) {
  return {
    mutationPosture,
    exitClass: "blockedMutation" as const,
    summary: "Workflow scaffold uses a restricted primitive.",
    diagnostics: restrictions.map(restrictionDiagnostic),
    data: scaffoldData(input, {
      output: null,
      nearest: [],
      templateGap: null,
      restrictions,
    }),
  };
}

function decodeScaffoldInput(
  input: unknown,
): AgentPackArgumentResult<ScaffoldInput> {
  const candidate = scaffoldCandidate(input);
  if (candidate === undefined) return invalidScaffoldInput();
  const args = decodedScaffoldInput(candidate);
  return args === undefined ? invalidScaffoldInput() : { ok: true, args };
}

type ScaffoldCandidate = {
  readonly generatorId: unknown;
  readonly args: unknown;
  readonly write: unknown;
  readonly workflowRuleIds: unknown;
  readonly workflowResolutions: unknown;
};

function scaffoldCandidate(input: unknown): ScaffoldCandidate | undefined {
  const allowed = new Set([
    "generatorId",
    "args",
    "write",
    "workflowRuleIds",
    "workflowResolutions",
  ]);
  if (
    !isRecord(input) ||
    !Object.keys(input).every((key) => allowed.has(key))
  ) {
    return undefined;
  }
  return {
    generatorId: input.generatorId,
    args: input.args,
    write: input.write ?? false,
    workflowRuleIds: input.workflowRuleIds ?? [],
    workflowResolutions: input.workflowResolutions ?? [],
  };
}

function decodedScaffoldInput(
  candidate: ScaffoldCandidate,
): ScaffoldInput | undefined {
  if (
    !isScaffoldGeneratorId(candidate.generatorId) ||
    !isJsonRecord(candidate.args) ||
    typeof candidate.write !== "boolean" ||
    !isWorkflowRuleIds(candidate.workflowRuleIds) ||
    !isWorkflowResolutions(candidate.workflowResolutions)
  ) {
    return undefined;
  }
  return {
    generatorId: candidate.generatorId,
    args: candidate.args,
    write: candidate.write,
    workflowRuleIds: candidate.workflowRuleIds,
    workflowResolutions: candidate.workflowResolutions,
  };
}

function isScaffoldGeneratorId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9][a-z0-9:_-]*$/.test(value);
}

function isWorkflowRuleIds(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (ruleId) =>
        typeof ruleId === "string" && /^[A-Z0-9][A-Z0-9_-]*$/.test(ruleId),
    )
  );
}

function isWorkflowResolutions(
  value: unknown,
): value is readonly WorkflowResolution[] {
  return Array.isArray(value) && value.every(isWorkflowResolution);
}

function isWorkflowResolution(value: unknown): value is WorkflowResolution {
  if (!isRecord(value) || typeof value.ruleId !== "string") return false;
  if (value.kind === "declared-alternative") {
    return (
      Object.keys(value).length === 3 &&
      typeof value.alternative === "string" &&
      value.alternative.length > 0
    );
  }
  return (
    value.kind === "reviewed-adr" &&
    Object.keys(value).length === 3 &&
    typeof value.adrRef === "string" &&
    /^docs\/template\/adr\/\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(
      value.adrRef,
    )
  );
}

function workflowRestrictions(
  ruleIds: readonly string[],
  resolutions: readonly WorkflowResolution[],
  authority: ScaffoldDependencies["workflow"],
  repo: RepositoryContext,
): readonly WorkflowScaffoldRestriction[] {
  const rules = new Map(authority.semantics.map((rule) => [rule.id, rule]));
  return ruleIds.flatMap((ruleId) =>
    workflowRestriction(ruleId, resolutions, rules, authority, repo),
  );
}

function workflowRestriction(
  ruleId: string,
  resolutions: readonly WorkflowResolution[],
  rules: ReadonlyMap<string, WorkflowSemanticProjection>,
  authority: ScaffoldDependencies["workflow"],
  repo: RepositoryContext,
): readonly WorkflowScaffoldRestriction[] {
  const rule = rules.get(ruleId);
  if (rule?.status === "supported") return [];
  const matching = resolutions.filter(
    (resolution) => resolution.ruleId === ruleId,
  );
  if (hasReviewedResolution(rule, matching, authority, repo)) return [];
  return [unresolvedRestriction(ruleId, rule, matching)];
}

function hasReviewedResolution(
  rule: WorkflowSemanticProjection | undefined,
  matching: readonly WorkflowResolution[],
  authority: ScaffoldDependencies["workflow"],
  repo: RepositoryContext,
): boolean {
  const selection = matching[0];
  if (rule === undefined || matching.length !== 1 || selection === undefined)
    return false;
  return resolutionIsReviewed(selection, rule, authority.reviewedAdrRefs(repo));
}

function unresolvedRestriction(
  ruleId: string,
  rule: WorkflowSemanticProjection | undefined,
  matching: readonly WorkflowResolution[],
): WorkflowScaffoldRestriction {
  const adr = matching.find(isReviewedAdrResolution);
  return {
    ruleId,
    status:
      rule?.status === "intentionally-restricted"
        ? "intentionally-restricted"
        : "unsupported",
    alternative:
      rule?.repair ?? "Select a rule declared by WORKFLOW_SEMANTICS.",
    adrPath: adr?.adrRef ?? "<existing-reviewed-adr-required>",
  };
}

function isReviewedAdrResolution(
  resolution: WorkflowResolution,
): resolution is Extract<
  WorkflowResolution,
  { readonly kind: "reviewed-adr" }
> {
  return resolution.kind === "reviewed-adr";
}

function resolutionIsReviewed(
  resolution: WorkflowResolution,
  rule: WorkflowSemanticProjection,
  reviewedAdrRefs: ReadonlySet<string>,
): boolean {
  return resolution.kind === "declared-alternative"
    ? resolution.alternative === rule.repair
    : reviewedAdrRefs.has(resolution.adrRef);
}

function scaffoldSuccess(
  input: ScaffoldInput,
  mutationPosture: "preview" | "write",
  output: ScaffoldGeneratorOutput,
) {
  return {
    mutationPosture,
    exitClass: "success" as const,
    summary:
      mutationPosture === "preview"
        ? "Scaffold preview is ready for review."
        : "Scaffold files were generated.",
    diagnostics: [],
    data: scaffoldData(input, {
      output,
      nearest: [],
      templateGap: null,
      restrictions: [],
    }),
  };
}

type ScaffoldBlock = {
  readonly code: string;
  readonly message: string;
  readonly nextAction: string;
};

function scaffoldCollision(
  input: ScaffoldInput,
  mutationPosture: "preview" | "write",
  output: ScaffoldGeneratorOutput,
) {
  return scaffoldBlocked(input, mutationPosture, output, {
    code: "AGENT_PACK_SCAFFOLD_COLLISION",
    message: `Scaffold paths collide with existing files: ${output.collisions.join(", ")}.`,
    nextAction:
      "Choose a reviewed new name or extend the existing generated slice.",
  });
}

function preflightBlock(): ScaffoldBlock {
  return {
    code: "AGENT_PACK_SCAFFOLD_PREFLIGHT_UNSAFE",
    message: "Scaffold writes require a passing preflight.",
    nextAction: "Resolve the preflight findings and retry the scaffold write.",
  };
}

function scaffoldBlocked(
  input: ScaffoldInput,
  mutationPosture: "preview" | "write",
  output: ScaffoldGeneratorOutput,
  block: ScaffoldBlock,
) {
  return {
    mutationPosture,
    exitClass: "blockedMutation" as const,
    summary: "Scaffold write was blocked.",
    diagnostics: [
      diagnostic({
        ...block,
        severity: "error",
        safeToContinue: false,
        rerun: scaffoldRerun(input),
      }),
    ],
    data: scaffoldData(input, {
      output,
      nearest: [],
      templateGap: null,
      restrictions: [],
    }),
  };
}

function generatorUnavailable(
  input: ScaffoldInput,
  mutationPosture: "preview" | "write",
  message: string,
) {
  return {
    mutationPosture,
    exitClass: "unavailableDependency" as const,
    summary: "The reviewed generator operation was unavailable.",
    diagnostics: [
      diagnostic({
        code: "AGENT_PACK_GENERATOR_UNAVAILABLE",
        severity: "error",
        message,
        safeToContinue: false,
        nextAction: "Restore the canonical generator operation and retry.",
        rerun: scaffoldRerun(input),
      }),
    ],
    data: scaffoldData(input, {
      output: null,
      nearest: [],
      templateGap: null,
      restrictions: [],
    }),
  };
}

function scaffoldData(
  input: ScaffoldInput,
  evidence: {
    readonly output: ScaffoldGeneratorOutput | null;
    readonly nearest: readonly ScaffoldSuggestion[];
    readonly templateGap: {
      readonly kind: "template-gap";
      readonly target: string;
      readonly followUpGates: readonly string[];
      readonly templateBacklogRef: string;
      readonly templateResolutionPath: string;
    } | null;
    readonly restrictions: readonly WorkflowScaffoldRestriction[];
  },
) {
  return {
    mode: input.write ? ("write" as const) : ("preview" as const),
    generatorId: input.generatorId,
    privacy: {
      classification: "review-required" as const,
      secrets: "names-only" as const,
    },
    ...evidence,
  };
}

function unsupportedDiagnostic(
  generatorId: string,
  nearest: readonly ScaffoldSuggestion[],
): AgentPackDiagnostic {
  const first = nearest[0];
  return diagnostic({
    code: "AGENT_PACK_SCAFFOLD_UNSUPPORTED",
    severity: "warning",
    message: `Unsupported scaffold request: ${generatorId}.`,
    safeToContinue: true,
    nextAction:
      first === undefined
        ? "Create a reviewed template-gap work package before implementation."
        : `Review ${first.recipe} and preview ${first.command}.`,
    rerun: "pnpm maestro -- scaffold --generator <reviewed-generator>",
  });
}

function restrictionDiagnostic(
  restriction: WorkflowScaffoldRestriction,
): AgentPackDiagnostic {
  return diagnostic({
    code: "AGENT_PACK_WORKFLOW_PRIMITIVE_RESTRICTED",
    severity: "error",
    message: `${restriction.ruleId} is ${restriction.status}.`,
    safeToContinue: false,
    nextAction: `${restriction.alternative} ADR path: ${restriction.adrPath}.`,
    rerun: "pnpm check:workflow:fast",
  });
}

function invalidScaffoldInput(): AgentPackArgumentResult<ScaffoldInput> {
  return {
    ok: false,
    diagnostics: [
      diagnostic({
        code: "AGENT_PACK_SCAFFOLD_INVALID",
        severity: "error",
        message:
          "Scaffold requires a reviewed generator ID and structured JSON arguments.",
        safeToContinue: false,
        nextAction:
          "Use a reviewed generator recipe and preview before requesting --write.",
        rerun: "pnpm maestro -- scaffold --generator <reviewed-generator>",
      }),
    ],
  };
}

function diagnostic(value: AgentPackDiagnostic): AgentPackDiagnostic {
  return value;
}

function scaffoldRerun(input: ScaffoldInput): string {
  return `pnpm maestro -- scaffold --generator ${input.generatorId}${input.write ? " --write" : ""}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonRecord(value: unknown): value is ScaffoldArguments {
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): value is AgentPackJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}
