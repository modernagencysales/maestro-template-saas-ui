import { createHash } from "node:crypto";
import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
  type AgentPackArgumentResult,
  type AgentPackDiagnostic,
  type AgentPackJsonValue,
} from "./contracts.js";
import type { RepositoryContext } from "./repoContext.js";

export type RecipeArgumentBinding =
  | { readonly source: "answer"; readonly answerId: string }
  | { readonly source: "literal"; readonly value: string | boolean };
export type RecipeExecutionProjection = {
  readonly version: number;
  readonly mode: "greenfield-additive";
  readonly steps: readonly {
    readonly id: string;
    readonly generatorId: string;
    readonly arguments: Readonly<Record<string, RecipeArgumentBinding>>;
  }[];
};
export type RecipeQuestionProjection = {
  readonly id: string;
  readonly prompt: string;
  readonly why: string;
  readonly answerKind: "text" | "choice" | "boolean";
  readonly choices?: readonly string[];
};
export type RecipeCommandProjection = {
  readonly schemaVersion: number;
  readonly id: string;
  readonly outcome: string;
  readonly availability: "available" | "unavailable" | "template-gap";
  readonly questions: readonly RecipeQuestionProjection[];
  readonly generatorPreviews: readonly AgentPackJsonValue[];
  readonly execution?: RecipeExecutionProjection;
  readonly document: { readonly [key: string]: AgentPackJsonValue };
};
export type RecipeCatalogProjection = {
  readonly recipes: readonly RecipeCommandProjection[];
  readonly resolve: (query: string) =>
    | { readonly kind: "recipe"; readonly recipe: RecipeCommandProjection }
    | {
        readonly kind: "template-gap";
        readonly query: string;
        readonly adjacent: readonly RecipeCommandProjection[];
        readonly backlogRef: string;
      };
};
export type RecipeGeneratorOutput = {
  readonly files: readonly {
    readonly path: string;
    readonly content: string;
    readonly beforeSha256: string | null;
  }[];
  readonly provenancePaths: readonly string[];
  readonly collisions: readonly string[];
  readonly semanticRuleIds: readonly string[];
  readonly manualFollowUp: readonly string[];
  readonly codegen: readonly string[];
  readonly focusedGates: readonly string[];
};
export type RecipeOperation = {
  readonly path: string;
  readonly content: string;
  readonly contentSha256: string;
  readonly beforeSha256: string | null;
  readonly generatorStepId: string;
};
export type RecipeExecutionPlan = {
  readonly schemaVersion: 1;
  readonly recipeId: string;
  readonly recipeSchemaVersion: number;
  readonly recipeExecutionVersion: number;
  readonly targetRoot: string;
  readonly steps: readonly {
    readonly id: string;
    readonly generatorId: string;
    readonly args: Readonly<Record<string, string | boolean>>;
    readonly generatorVersion: string;
  }[];
  readonly operations: readonly RecipeOperation[];
  readonly collisions: readonly string[];
  readonly provenancePaths: readonly string[];
  readonly semanticRuleIds: readonly string[];
  readonly codegen: readonly string[];
  readonly focusedGates: readonly string[];
  readonly fingerprint: string;
};
export type RecipeTransactionReceipt = {
  readonly schemaVersion: 1;
  readonly kind: "maestro-recipe-transaction";
  readonly status: "applied";
  readonly recipeId: string;
  readonly recipeSchemaVersion: number;
  readonly planFingerprint: string;
  readonly preflightFingerprint: string;
  readonly answersSha256: string;
  readonly generatorVersions: readonly string[];
  readonly operationPaths: readonly string[];
  readonly provenancePaths: readonly string[];
  readonly candidateCommit: string | null;
  readonly templateInstanceFingerprint: string | null;
  readonly journalPath: string;
  readonly receiptPath: string;
};
export type RecipeCommandDependencies = {
  readonly load: (
    repo: RepositoryContext,
  ) => Promise<RecipeCatalogProjection> | RecipeCatalogProjection;
  readonly generators?: {
    readonly resolve: (
      generatorId: string,
    ) =>
      | { readonly supported: true; readonly version: string }
      | { readonly supported: false };
    readonly preview: (request: {
      readonly generatorId: string;
      readonly args: Readonly<Record<string, string | boolean>>;
      readonly repo: RepositoryContext;
    }) => Promise<
      | { readonly ok: true; readonly output: RecipeGeneratorOutput }
      | { readonly ok: false; readonly message: string }
    >;
  };
  readonly preflight?: {
    readonly inspect: (
      repo: RepositoryContext,
      plan: RecipeExecutionPlan,
    ) => Promise<{
      readonly fingerprint: string;
      readonly blockingCodes: readonly string[];
    }>;
  };
  readonly transaction?: {
    readonly apply: (request: {
      readonly repo: RepositoryContext;
      readonly plan: RecipeExecutionPlan;
      readonly preflightFingerprint: string;
      readonly answersSha256: string;
    }) => Promise<
      | { readonly ok: true; readonly receipt: RecipeTransactionReceipt }
      | { readonly ok: false; readonly message: string }
    >;
  };
};

type AddRecipeInput = {
  readonly query: string;
  readonly answers: Readonly<Record<string, string | boolean>>;
  readonly write: boolean;
};
type RecipeSummary = {
  readonly id: string;
  readonly outcome: string;
  readonly availability: RecipeCommandProjection["availability"];
};
type AddRecipeData = AgentPackJsonValue;

export function createAddRecipeCommand(
  dependencies: RecipeCommandDependencies,
) {
  return defineAgentPackCommand<"add", AddRecipeInput, AddRecipeData>({
    id: "add",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: decodeAddRecipeInput,
    mutationPosture: ({ write }) => (write ? "write" : "preview"),
    execute: async (input, context) => {
      const mutationPosture = input.write ? "write" : "preview";
      const resolution = (await dependencies.load(context.repo)).resolve(
        input.query,
      );
      if (resolution.kind === "template-gap")
        return templateGapResult(input, resolution, mutationPosture);
      return executeResolvedRecipe(
        dependencies,
        input,
        context.repo,
        resolution.recipe,
        mutationPosture,
      );
    },
  });
}

type RecipeMutationPosture = "preview" | "write";
type TemplateGapResolution = Extract<
  ReturnType<RecipeCatalogProjection["resolve"]>,
  { readonly kind: "template-gap" }
>;

function templateGapResult(
  input: AddRecipeInput,
  resolution: TemplateGapResolution,
  mutationPosture: RecipeMutationPosture,
) {
  return {
    mutationPosture,
    exitClass: "findings" as const,
    summary: "No reviewed recipe exactly matches this outcome.",
    diagnostics: [templateGapDiagnostic(input.query)],
    data: {
      kind: "template-gap",
      query: resolution.query,
      adjacent: resolution.adjacent.map(summary),
      backlogRef: resolution.backlogRef,
    },
  };
}

async function executeResolvedRecipe(
  dependencies: RecipeCommandDependencies,
  input: AddRecipeInput,
  repo: RepositoryContext,
  recipe: RecipeCommandProjection,
  mutationPosture: RecipeMutationPosture,
) {
  const baseData = recipeBaseData(recipe, input.answers);
  if (recipe.availability !== "available")
    return {
      mutationPosture,
      exitClass: "unavailableDependency" as const,
      summary: `Recipe ${recipe.id} is honestly unavailable.`,
      diagnostics: [unavailableDiagnostic(recipe)],
      data: baseData,
    };
  const answers = validateAnswers(recipe.questions, input.answers);
  if (!answers.ok)
    return blocked(mutationPosture, {
      code: "AGENT_PACK_RECIPE_ANSWERS_INCOMPLETE",
      message: answers.message,
      nextAction:
        "Answer every consequential recipe question with an explicit reviewed value.",
      rerun: addRerun(input, false),
      data: baseData,
    });
  if (!recipe.execution || !dependencies.generators || !dependencies.preflight)
    return blocked(mutationPosture, {
      code: "AGENT_PACK_RECIPE_EXECUTION_UNAVAILABLE",
      message: `Recipe ${recipe.id} has no installed executable binding.`,
      nextAction:
        "Use the preview only or install a release that carries the reviewed execution contract.",
      rerun: `pnpm maestro -- recipes show ${recipe.id} --json`,
      data: baseData,
    });
  const planResult = await buildPlan(
    recipe,
    input.answers,
    repo,
    dependencies.generators,
  );
  if (!planResult.ok)
    return blocked(mutationPosture, {
      code: planResult.code,
      message: planResult.message,
      nextAction: planResult.nextAction,
      rerun: addRerun(input, false),
      data: baseData,
    });
  const plan = planResult.plan;
  const preflight = await dependencies.preflight.inspect(repo, plan);
  const planData = {
    ...baseData,
    plan,
    preflightFingerprint: preflight.fingerprint,
  };
  if (plan.collisions.length > 0)
    return blocked(mutationPosture, {
      code: "AGENT_PACK_RECIPE_COLLISION",
      message: `Recipe paths collide with customer-owned files: ${plan.collisions.join(", ")}.`,
      nextAction:
        "Choose a reviewed new entity name or extend the existing slice deliberately.",
      rerun: addRerun(input, false),
      data: planData,
    });
  const data = { ...planData, confirmationCommand: addRerun(input, true) };
  if (!input.write)
    return {
      mutationPosture,
      exitClass: "success" as const,
      summary: `Previewed executable recipe ${recipe.id}; no files were changed.`,
      diagnostics: [],
      data,
    };
  return applyRecipePlan({
    dependencies,
    input,
    repo,
    recipe,
    plan,
    preflight,
  });
}

function recipeBaseData(
  recipe: RecipeCommandProjection,
  answers: Readonly<Record<string, string | boolean>>,
) {
  return {
    kind: "recipe" as const,
    recipe: recipe.document,
    answers,
    questions: recipe.questions,
    generatorPreviews: recipe.generatorPreviews,
  };
}

type RecipePreflight = Awaited<
  ReturnType<NonNullable<RecipeCommandDependencies["preflight"]>["inspect"]>
>;

async function applyRecipePlan(input: {
  readonly dependencies: RecipeCommandDependencies;
  readonly input: AddRecipeInput;
  readonly repo: RepositoryContext;
  readonly recipe: RecipeCommandProjection;
  readonly plan: RecipeExecutionPlan;
  readonly preflight: RecipePreflight;
}) {
  const { dependencies, recipe, plan, preflight, repo } = input;
  const planData = {
    ...recipeBaseData(recipe, input.input.answers),
    plan,
    preflightFingerprint: preflight.fingerprint,
  };
  const data = {
    ...planData,
    confirmationCommand: addRerun(input.input, true),
  };
  if (preflight.blockingCodes.length > 0)
    return blocked("write", {
      code: preflight.blockingCodes,
      message: `Recipe write remains blocked by preflight denials ${preflight.blockingCodes.join(", ")}.`,
      nextAction:
        "Resolve the reported preflight denial, then rerun the direct recipe write.",
      rerun: addRerun(input.input, false),
      data,
    });
  if (!dependencies.transaction)
    return blocked("write", {
      code: "AGENT_PACK_RECIPE_TRANSACTION_UNAVAILABLE",
      message: "Atomic recipe materialization is unavailable.",
      nextAction:
        "Install the journaled recipe transaction adapter; do not invoke generators sequentially.",
      rerun: addRerun(input.input, false),
      data,
    });
  const applied = await dependencies.transaction.apply({
    repo,
    plan,
    preflightFingerprint: preflight.fingerprint,
    answersSha256: sha256(stableJson(input.input.answers)),
  });
  if (!applied.ok)
    return blocked("write", {
      code: "AGENT_PACK_RECIPE_TRANSACTION_FAILED",
      message: applied.message,
      nextAction:
        "Inspect the retained transaction journal, repair the target, and preview again.",
      rerun: addRerun(input.input, false),
      data,
    });
  return {
    mutationPosture: "write" as const,
    exitClass: "success" as const,
    summary: `Applied recipe ${recipe.id} atomically.`,
    diagnostics: [],
    data: {
      ...planData,
      receipt: applied.receipt,
      followUpActions: [...plan.codegen, ...plan.focusedGates].map(
        (command) => ({
          command,
        }),
      ),
    },
  };
}

type PlanBuildFailure = {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
  readonly nextAction: string;
};
type PlanBuildResult =
  { readonly ok: true; readonly plan: RecipeExecutionPlan } | PlanBuildFailure;
type PlanAccumulator = {
  readonly steps: RecipeExecutionPlan["steps"][number][];
  readonly operations: RecipeOperation[];
  readonly collisions: Set<string>;
  readonly provenance: Set<string>;
  readonly semanticRules: Set<string>;
  readonly codegen: Set<string>;
  readonly focusedGates: Set<string>;
  readonly paths: Set<string>;
};
type RecipeStep = RecipeExecutionProjection["steps"][number];

const planFailure = (
  code: string,
  message: string,
  nextAction: string,
): PlanBuildFailure => ({ ok: false, code, message, nextAction });

function bindStepArguments(
  step: RecipeStep,
  answers: Readonly<Record<string, string | boolean>>,
):
  | { readonly ok: true; readonly args: Record<string, string | boolean> }
  | PlanBuildFailure {
  const args: Record<string, string | boolean> = {};
  for (const [name, binding] of Object.entries(step.arguments)) {
    const value =
      binding.source === "literal" ? binding.value : answers[binding.answerId];
    if (value === undefined)
      return planFailure(
        "AGENT_PACK_RECIPE_BINDING_INVALID",
        `Recipe step ${step.id} cannot resolve answer ${binding.source === "answer" ? binding.answerId : name}.`,
        "Repair the versioned recipe answer binding; do not infer a value.",
      );
    args[name] = value;
  }
  return { ok: true, args };
}

function collectPreviewMetadata(
  accumulator: PlanAccumulator,
  output: RecipeGeneratorOutput,
): void {
  for (const collision of output.collisions)
    accumulator.collisions.add(collision);
  for (const path of output.provenancePaths) accumulator.provenance.add(path);
  for (const id of output.semanticRuleIds) accumulator.semanticRules.add(id);
  for (const command of output.codegen) accumulator.codegen.add(command);
  for (const gate of output.focusedGates) accumulator.focusedGates.add(gate);
}

function collectPreviewOperations(
  accumulator: PlanAccumulator,
  step: RecipeStep,
  output: RecipeGeneratorOutput,
): PlanBuildFailure | undefined {
  for (const file of output.files) {
    if (!safeRelativePath(file.path))
      return planFailure(
        "AGENT_PACK_RECIPE_PATH_ESCAPE",
        `Recipe generator emitted unsafe path ${JSON.stringify(file.path)}.`,
        "Repair the canonical generator; do not write this plan.",
      );
    if (accumulator.paths.has(file.path))
      return planFailure(
        "AGENT_PACK_RECIPE_PLAN_CONFLICT",
        `Recipe generators both own ${file.path}.`,
        "Review one canonical owner for every generated operation.",
      );
    accumulator.paths.add(file.path);
    accumulator.operations.push({
      path: file.path,
      content: file.content,
      contentSha256: sha256(file.content),
      beforeSha256: file.beforeSha256,
      generatorStepId: step.id,
    });
  }
  return undefined;
}

async function buildPlan(
  recipe: RecipeCommandProjection,
  answers: Readonly<Record<string, string | boolean>>,
  repo: RepositoryContext,
  generators: NonNullable<RecipeCommandDependencies["generators"]>,
): Promise<PlanBuildResult> {
  const accumulator: PlanAccumulator = {
    steps: [],
    operations: [],
    collisions: new Set(),
    provenance: new Set(),
    semanticRules: new Set(),
    codegen: new Set(),
    focusedGates: new Set(),
    paths: new Set(),
  };
  for (const step of recipe.execution?.steps ?? []) {
    const resolution = generators.resolve(step.generatorId);
    if (!resolution.supported)
      return planFailure(
        "AGENT_PACK_RECIPE_GENERATOR_UNREVIEWED",
        `Recipe step ${step.id} names unreviewed generator ${step.generatorId}.`,
        "Use only a generator registered by the canonical reviewed dispatcher.",
      );
    const binding = bindStepArguments(step, answers);
    if (!binding.ok) return binding;
    const preview = await generators.preview({
      generatorId: step.generatorId,
      args: binding.args,
      repo,
    });
    if (!preview.ok)
      return planFailure(
        "AGENT_PACK_RECIPE_GENERATOR_UNAVAILABLE",
        preview.message,
        "Repair the reviewed generator inputs and preview the recipe again.",
      );
    accumulator.steps.push({
      id: step.id,
      generatorId: step.generatorId,
      args: binding.args,
      generatorVersion: resolution.version,
    });
    collectPreviewMetadata(accumulator, preview.output);
    const operationFailure = collectPreviewOperations(
      accumulator,
      step,
      preview.output,
    );
    if (operationFailure) return operationFailure;
  }
  const unsigned = {
    schemaVersion: 1 as const,
    recipeId: recipe.id,
    recipeSchemaVersion: recipe.schemaVersion,
    recipeExecutionVersion: recipe.execution?.version ?? 0,
    targetRoot: repo.targetRoot,
    steps: accumulator.steps,
    operations: accumulator.operations,
    collisions: [...accumulator.collisions].sort(),
    provenancePaths: [...accumulator.provenance].sort(),
    semanticRuleIds: [...accumulator.semanticRules].sort(),
    codegen: [...accumulator.codegen],
    focusedGates: [...accumulator.focusedGates].sort(),
  };
  return {
    ok: true,
    plan: { ...unsigned, fingerprint: fingerprintRecipePlan(unsigned) },
  };
}

type RecipesInput =
  | { readonly action: "list" }
  | { readonly action: "show"; readonly id: string };
type RecipesData =
  | { readonly recipes: readonly RecipeSummary[] }
  | {
      readonly recipe: RecipeCommandProjection["document"] | null;
      readonly adjacent?: readonly RecipeSummary[];
      readonly backlogRef?: string;
    };
export function createRecipesCommand(dependencies: RecipeCommandDependencies) {
  return defineAgentPackCommand<"recipes", RecipesInput, RecipesData>({
    id: "recipes",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: decodeRecipesInput,
    mutationPosture: () => "read-only" as const,
    execute: async (input, context) => {
      const catalog = await dependencies.load(context.repo);
      if (input.action === "list")
        return {
          mutationPosture: "read-only" as const,
          exitClass: "success" as const,
          summary: `Found ${catalog.recipes.length} reviewed recipes.`,
          diagnostics: [],
          data: { recipes: catalog.recipes.map(summary) },
        };
      const recipe = catalog.recipes.find(({ id }) => id === input.id);
      if (!recipe) {
        const resolution = catalog.resolve(input.id);
        return {
          mutationPosture: "read-only" as const,
          exitClass: "findings" as const,
          summary: `Recipe ${input.id} is not reviewed.`,
          diagnostics: [templateGapDiagnostic(input.id)],
          data: {
            recipe: null,
            adjacent:
              resolution.kind === "template-gap"
                ? resolution.adjacent.map(summary)
                : [],
            backlogRef: "AP-009 outcome recipe library",
          },
        };
      }
      return {
        mutationPosture: "read-only" as const,
        exitClass: "success" as const,
        summary: `Showing recipe ${recipe.id}.`,
        diagnostics: [],
        data: { recipe: recipe.document },
      };
    },
  });
}

function validateAnswers(
  questions: readonly RecipeQuestionProjection[],
  answers: Readonly<Record<string, string | boolean>>,
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  const known = new Set(questions.map(({ id }) => id));
  const extras = Object.keys(answers).filter((id) => !known.has(id));
  if (extras.length)
    return {
      ok: false,
      message: `Unknown recipe answers: ${extras.join(", ")}.`,
    };
  const invalid: string[] = [];
  for (const question of questions) {
    const answer = answers[question.id];
    if (!validAnswer(question, answer)) invalid.push(question.id);
  }
  return invalid.length
    ? {
        ok: false,
        message: `Missing or invalid recipe answers: ${invalid.join(", ")}.`,
      }
    : { ok: true };
}

function validAnswer(
  question: RecipeQuestionProjection,
  answer: string | boolean | undefined,
): boolean {
  if (answer === undefined) return false;
  if (question.answerKind === "boolean") return typeof answer === "boolean";
  if (typeof answer !== "string" || answer.trim() === "") return false;
  return (
    question.answerKind !== "choice" ||
    question.choices?.includes(answer) === true
  );
}

function decodeAddRecipeInput(
  value: unknown,
): AgentPackArgumentResult<AddRecipeInput> {
  const keys = ["query", "answers", "write"];
  if (!isRecord(value) || !onlyKeys(value, keys))
    return invalid("add", "Provide one reviewed outcome or recipe id.");
  const answers = value.answers ?? {};
  const write = value.write ?? false;
  if (
    typeof value.query !== "string" ||
    value.query.trim() === "" ||
    !isRecord(answers) ||
    Object.values(answers).some(
      (answer) => typeof answer !== "string" && typeof answer !== "boolean",
    ) ||
    typeof write !== "boolean"
  )
    return invalid(
      "add",
      "Provide one reviewed outcome or recipe id and use --write only for mutation.",
    );
  return {
    ok: true,
    args: {
      query: value.query,
      answers: answers as Record<string, string | boolean>,
      write,
    },
  };
}
function decodeRecipesInput(
  value: unknown,
): AgentPackArgumentResult<RecipesInput> {
  if (!isRecord(value) || !onlyKeys(value, ["action", "id"]))
    return invalid("recipes", "Use recipes list or recipes show <id>.");
  if (value.action === "list" && value.id === undefined)
    return { ok: true, args: { action: "list" } };
  if (
    value.action === "show" &&
    typeof value.id === "string" &&
    value.id.length > 0
  )
    return { ok: true, args: { action: "show", id: value.id } };
  return invalid("recipes", "Use recipes list or recipes show <id>.");
}

function blocked(
  mutationPosture: RecipeMutationPosture,
  finding: {
    readonly code: string | readonly string[];
    readonly message: string;
    readonly nextAction: string;
    readonly rerun: string;
    readonly data: AgentPackJsonValue;
  },
) {
  const codes =
    typeof finding.code === "string" ? [finding.code] : finding.code;
  return {
    mutationPosture,
    exitClass:
      mutationPosture === "write"
        ? ("blockedMutation" as const)
        : ("findings" as const),
    summary:
      mutationPosture === "write"
        ? "Recipe write was blocked."
        : "Recipe preview found blocking findings.",
    diagnostics: codes.map((blockingCode) => ({
      code: blockingCode,
      severity: "error" as const,
      message: finding.message,
      safeToContinue: mutationPosture === "preview",
      nextAction: finding.nextAction,
      rerun: finding.rerun,
    })),
    data: finding.data,
  };
}
function addRerun(input: AddRecipeInput, write: boolean): string {
  const args = Object.entries(input.answers)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([id, value]) => ["--answer", `${id}=${String(value)}`]);
  if (write) {
    args.push("--write");
  }
  return [
    "pnpm maestro -- add",
    JSON.stringify(input.query),
    ...args.map((arg) => JSON.stringify(arg)),
  ].join(" ");
}
const safeRelativePath = (path: string): boolean =>
  path.length > 0 &&
  !path.startsWith("/") &&
  !path.startsWith("\\") &&
  !path
    .split(/[\\/]/u)
    .some((part) => part === "" || part === "." || part === "..");
export const sha256RecipeBytes = (value: string | Buffer): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const sha256 = sha256RecipeBytes;
export const fingerprintRecipePlan = (
  plan: Omit<RecipeExecutionPlan, "fingerprint">,
): string => `recipe_plan_${sha256(stableJson(plan))}`;
const stableJson = (value: unknown): string => JSON.stringify(sortValue(value));
const sortValue = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(sortValue)
    : isRecord(value)
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, entry]) => [key, sortValue(entry)]),
        )
      : value;
const summary = (recipe: RecipeCommandProjection) => ({
  id: recipe.id,
  outcome: recipe.outcome,
  availability: recipe.availability,
});
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const onlyKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).every((key) => keys.includes(key));
const invalid = <T>(
  command: string,
  message: string,
): AgentPackArgumentResult<T> => ({
  ok: false,
  diagnostics: [
    {
      code: "AGENT_PACK_RECIPE_INVALID",
      severity: "error",
      message,
      safeToContinue: true,
      nextAction: message,
      rerun: `pnpm maestro -- ${command} --help`,
    },
  ],
});
const templateGapDiagnostic = (query: string): AgentPackDiagnostic => ({
  code: "AGENT_PACK_RECIPE_TEMPLATE_GAP",
  severity: "warning",
  message: `No reviewed recipe owns ${JSON.stringify(query)}.`,
  safeToContinue: true,
  nextAction:
    "Review adjacent recipes or record a template-gap; do not invent architecture.",
  rerun: "pnpm maestro -- recipes list --json",
});
const unavailableDiagnostic = (
  recipe: RecipeCommandProjection,
): AgentPackDiagnostic => ({
  code: "AGENT_PACK_RECIPE_UNAVAILABLE",
  severity: "error",
  message: `Recipe ${recipe.id} requires unsupported or restricted primitives.`,
  safeToContinue: true,
  nextAction:
    "Inspect the recipe and semantic ledger; do not scaffold the blocked workflow.",
  rerun: `pnpm maestro -- recipes show ${recipe.id} --json`,
});
