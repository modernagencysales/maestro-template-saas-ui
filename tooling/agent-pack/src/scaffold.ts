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
    readonly reviewedAdrRefs: ReadonlySet<string>;
  };
};

export type ScaffoldInput = {
  readonly generatorId: string;
  readonly args: ScaffoldArguments;
  readonly write: boolean;
  readonly preflightFingerprint?: string;
  readonly workflowRuleIds: readonly string[];
  readonly workflowResolutions: readonly WorkflowResolution[];
};

export function createScaffoldCommand(dependencies: ScaffoldDependencies) {
  return defineAgentPackCommand({
    id: "scaffold",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: decodeScaffoldInput,
    mutationPosture: ({ write }) => (write ? "write" : "preview"),
    execute: async (input, context) => {
      const mutationPosture = input.write
        ? ("write" as const)
        : ("preview" as const);
      const resolution = dependencies.generators.resolve(input.generatorId);
      if (!resolution.supported) {
        const diagnostic = unsupportedDiagnostic(
          input.generatorId,
          resolution.nearest,
        );
        return {
          mutationPosture,
          exitClass: "findings" as const,
          summary: "No reviewed generator matches this scaffold request.",
          diagnostics: [diagnostic],
          data: scaffoldData(input, {
            output: null,
            nearest: resolution.nearest,
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

      const restrictions = workflowRestrictions(
        input.workflowRuleIds,
        input.workflowResolutions,
        dependencies.workflow,
      );
      if (restrictions.length > 0) {
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

      const preview = await dependencies.generators.run({
        generatorId: input.generatorId,
        args: input.args,
        write: false,
        repo: context.repo,
      });
      if (!preview.ok)
        return generatorUnavailable(input, mutationPosture, preview.message);

      if (!input.write) {
        return scaffoldSuccess(input, mutationPosture, preview.output);
      }
      if (preview.output.collisions.length > 0) {
        return scaffoldBlocked(
          input,
          mutationPosture,
          preview.output,
          "AGENT_PACK_SCAFFOLD_COLLISION",
          `Scaffold paths collide with existing files: ${preview.output.collisions.join(", ")}.`,
          "Choose a reviewed new name or extend the existing generated slice.",
        );
      }

      const preflight = await dependencies.preflight.inspect(context.repo);
      if (!preflight.cleanWorktree) {
        return scaffoldBlocked(
          input,
          mutationPosture,
          preview.output,
          "AGENT_PACK_SCAFFOLD_WORKTREE_DIRTY",
          "Scaffold writes require explicit clean-worktree evidence.",
          "Commit or remove unrelated changes, rerun preflight, and retry with its unchanged fingerprint.",
        );
      }
      if (
        !preflight.safeToMutate ||
        input.preflightFingerprint === undefined ||
        input.preflightFingerprint !== preflight.fingerprint
      ) {
        return scaffoldBlocked(
          input,
          mutationPosture,
          preview.output,
          "AGENT_PACK_SCAFFOLD_PREFLIGHT_STALE",
          "The passing preflight fingerprint is missing, blocking, or changed.",
          "Run preflight again and pass its unchanged fingerprint to --write.",
        );
      }

      const written = await dependencies.generators.run({
        generatorId: input.generatorId,
        args: input.args,
        write: true,
        repo: context.repo,
      });
      return written.ok
        ? scaffoldSuccess(input, mutationPosture, written.output)
        : generatorUnavailable(input, mutationPosture, written.message);
    },
  });
}

function decodeScaffoldInput(
  input: unknown,
): AgentPackArgumentResult<ScaffoldInput> {
  const allowed = new Set([
    "generatorId",
    "args",
    "write",
    "preflightFingerprint",
    "workflowRuleIds",
    "workflowResolutions",
  ]);
  if (
    !isRecord(input) ||
    !Object.keys(input).every((key) => allowed.has(key))
  ) {
    return invalidScaffoldInput();
  }
  const write = input.write ?? false;
  const workflowRuleIds = input.workflowRuleIds ?? [];
  const workflowResolutions = input.workflowResolutions ?? [];
  if (
    typeof input.generatorId !== "string" ||
    !/^[a-z0-9][a-z0-9:_-]*$/.test(input.generatorId) ||
    !isJsonRecord(input.args) ||
    typeof write !== "boolean" ||
    (input.preflightFingerprint !== undefined &&
      (typeof input.preflightFingerprint !== "string" ||
        !input.preflightFingerprint.startsWith("preflight_sha256:"))) ||
    !Array.isArray(workflowRuleIds) ||
    !workflowRuleIds.every(
      (ruleId) =>
        typeof ruleId === "string" && /^[A-Z0-9][A-Z0-9_-]*$/.test(ruleId),
    ) ||
    !Array.isArray(workflowResolutions) ||
    !workflowResolutions.every(isWorkflowResolution)
  ) {
    return invalidScaffoldInput();
  }
  return {
    ok: true,
    args: {
      generatorId: input.generatorId,
      args: input.args,
      write,
      ...(typeof input.preflightFingerprint === "string"
        ? { preflightFingerprint: input.preflightFingerprint }
        : {}),
      workflowRuleIds,
      workflowResolutions,
    },
  };
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
): readonly WorkflowScaffoldRestriction[] {
  const rules = new Map(authority.semantics.map((rule) => [rule.id, rule]));
  return ruleIds.flatMap((ruleId) => {
    const rule = rules.get(ruleId);
    if (rule?.status === "supported") return [];
    const matching = resolutions.filter(
      (resolution) => resolution.ruleId === ruleId,
    );
    const selection = matching[0];
    if (
      rule !== undefined &&
      matching.length === 1 &&
      selection !== undefined &&
      resolutionIsReviewed(selection, rule, authority.reviewedAdrRefs)
    ) {
      return [];
    }
    const selectedAdr = matching.find(
      (
        resolution,
      ): resolution is Extract<
        WorkflowResolution,
        { readonly kind: "reviewed-adr" }
      > => resolution.kind === "reviewed-adr",
    );
    return [
      {
        ruleId,
        status: rule?.status ?? "unsupported",
        alternative:
          rule?.repair ?? "Select a rule declared by WORKFLOW_SEMANTICS.",
        adrPath: selectedAdr?.adrRef ?? "<existing-reviewed-adr-required>",
      },
    ];
  });
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

function scaffoldBlocked(
  input: ScaffoldInput,
  mutationPosture: "preview" | "write",
  output: ScaffoldGeneratorOutput,
  code: string,
  message: string,
  nextAction: string,
) {
  return {
    mutationPosture,
    exitClass: "blockedMutation" as const,
    summary: "Scaffold write was blocked.",
    diagnostics: [
      diagnostic(
        code,
        "error",
        message,
        false,
        nextAction,
        scaffoldRerun(input),
      ),
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
      diagnostic(
        "AGENT_PACK_GENERATOR_UNAVAILABLE",
        "error",
        message,
        false,
        "Restore the canonical generator operation and retry.",
        scaffoldRerun(input),
      ),
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
    ...evidence,
  };
}

function unsupportedDiagnostic(
  generatorId: string,
  nearest: readonly ScaffoldSuggestion[],
): AgentPackDiagnostic {
  const first = nearest[0];
  return diagnostic(
    "AGENT_PACK_SCAFFOLD_UNSUPPORTED",
    "warning",
    `Unsupported scaffold request: ${generatorId}.`,
    true,
    first === undefined
      ? "Create a reviewed template-gap work package before implementation."
      : `Review ${first.recipe} and preview ${first.command}.`,
    "pnpm maestro -- scaffold --generator <reviewed-generator>",
  );
}

function restrictionDiagnostic(
  restriction: WorkflowScaffoldRestriction,
): AgentPackDiagnostic {
  return diagnostic(
    "AGENT_PACK_WORKFLOW_PRIMITIVE_RESTRICTED",
    "error",
    `${restriction.ruleId} is ${restriction.status}.`,
    false,
    `${restriction.alternative} ADR path: ${restriction.adrPath}.`,
    "pnpm check:workflow:fast",
  );
}

function invalidScaffoldInput(): AgentPackArgumentResult<ScaffoldInput> {
  return {
    ok: false,
    diagnostics: [
      diagnostic(
        "AGENT_PACK_SCAFFOLD_INVALID",
        "error",
        "Scaffold requires a reviewed generator ID and structured JSON arguments.",
        false,
        "Use a reviewed generator recipe and preview before requesting --write.",
        "pnpm maestro -- scaffold --generator <reviewed-generator>",
      ),
    ],
  };
}

function diagnostic(
  code: string,
  severity: "warning" | "error",
  message: string,
  safeToContinue: boolean,
  nextAction: string,
  rerun: string,
): AgentPackDiagnostic {
  return { code, severity, message, safeToContinue, nextAction, rerun };
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
