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
    readonly inspect: (repo: RepositoryContext) => Promise<{
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
      const mutationPosture = input.write
        ? ("write" as const)
        : ("preview" as const);
      const resolution = (await dependencies.load(context.repo)).resolve(
        input.query,
      );
      if (resolution.kind === "template-gap")
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
      const recipe = resolution.recipe;
      const baseData = {
        kind: "recipe" as const,
        recipe: recipe.document,
        answers: input.answers,
        questions: recipe.questions,
        generatorPreviews: recipe.generatorPreviews,
      };
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
        return blocked(
          mutationPosture,
          "AGENT_PACK_RECIPE_ANSWERS_INCOMPLETE",
          answers.message,
          "Answer every consequential recipe question with an explicit reviewed value.",
          addRerun(input, false),
          baseData,
        );
      if (
        !recipe.execution ||
        !dependencies.generators ||
        !dependencies.preflight
      )
        return blocked(
          mutationPosture,
          "AGENT_PACK_RECIPE_EXECUTION_UNAVAILABLE",
          `Recipe ${recipe.id} has no installed executable binding.`,
          "Use the preview only or install a release that carries the reviewed execution contract.",
          `pnpm maestro -- recipes show ${recipe.id} --json`,
          baseData,
        );
      const planResult = await buildPlan(
        recipe,
        input.answers,
        context.repo,
        dependencies.generators,
      );
      if (!planResult.ok)
        return blocked(
          mutationPosture,
          planResult.code,
          planResult.message,
          planResult.nextAction,
          addRerun(input, false),
          baseData,
        );
      const preflight = await dependencies.preflight.inspect(context.repo);
      const plan = planResult.plan;
      const planData = {
        ...baseData,
        plan,
        preflightFingerprint: preflight.fingerprint,
      };
      if (plan.collisions.length > 0)
        return blocked(
          mutationPosture,
          "AGENT_PACK_RECIPE_COLLISION",
          `Recipe paths collide with customer-owned files: ${plan.collisions.join(", ")}.`,
          "Choose a reviewed new entity name or extend the existing slice deliberately.",
          addRerun(input, false),
          planData,
        );
      const data = {
        ...planData,
        confirmationCommand: addRerun(input, true),
      };
      if (!input.write)
        return {
          mutationPosture,
          exitClass: "success" as const,
          summary: `Previewed executable recipe ${recipe.id}; no files were changed.`,
          diagnostics: [],
          data,
        };
      const preflightBlocker = preflight.blockingCodes[0];
      if (preflightBlocker !== undefined)
        return blocked(
          mutationPosture,
          preflightBlocker,
          `Recipe write remains blocked by preflight denial ${preflightBlocker}.`,
          "Resolve the reported preflight denial, then rerun the direct recipe write.",
          addRerun(input, false),
          data,
        );
      if (!dependencies.transaction)
        return blocked(
          mutationPosture,
          "AGENT_PACK_RECIPE_TRANSACTION_UNAVAILABLE",
          "Atomic recipe materialization is unavailable.",
          "Install the journaled recipe transaction adapter; do not invoke generators sequentially.",
          addRerun(input, false),
          data,
        );
      const answersSha256 = sha256(stableJson(input.answers));
      const applied = await dependencies.transaction.apply({
        repo: context.repo,
        plan,
        preflightFingerprint: preflight.fingerprint,
        answersSha256,
      });
      return applied.ok
        ? {
            mutationPosture,
            exitClass: "success" as const,
            summary: `Applied recipe ${recipe.id} atomically.`,
            diagnostics: [],
            data: {
              ...planData,
              receipt: applied.receipt,
              followUpActions: [...plan.codegen, ...plan.focusedGates].map(
                (command) => ({ command }),
              ),
            },
          }
        : blocked(
            mutationPosture,
            "AGENT_PACK_RECIPE_TRANSACTION_FAILED",
            applied.message,
            "Inspect the retained transaction journal, repair the target, and preview again.",
            addRerun(input, false),
            data,
          );
    },
  });
}

async function buildPlan(
  recipe: RecipeCommandProjection,
  answers: Readonly<Record<string, string | boolean>>,
  repo: RepositoryContext,
  generators: NonNullable<RecipeCommandDependencies["generators"]>,
): Promise<
  | { readonly ok: true; readonly plan: RecipeExecutionPlan }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly nextAction: string;
    }
> {
  const steps: RecipeExecutionPlan["steps"][number][] = [];
  const operations: RecipeOperation[] = [];
  const collisions = new Set<string>();
  const provenance = new Set<string>();
  const semanticRules = new Set<string>();
  const codegen = new Set<string>();
  const focusedGates = new Set<string>();
  const paths = new Set<string>();
  for (const step of recipe.execution?.steps ?? []) {
    const resolution = generators.resolve(step.generatorId);
    if (!resolution.supported)
      return {
        ok: false,
        code: "AGENT_PACK_RECIPE_GENERATOR_UNREVIEWED",
        message: `Recipe step ${step.id} names unreviewed generator ${step.generatorId}.`,
        nextAction:
          "Use only a generator registered by the canonical reviewed dispatcher.",
      };
    const args: Record<string, string | boolean> = {};
    for (const [name, binding] of Object.entries(step.arguments)) {
      const value =
        binding.source === "literal"
          ? binding.value
          : answers[binding.answerId];
      if (value === undefined)
        return {
          ok: false,
          code: "AGENT_PACK_RECIPE_BINDING_INVALID",
          message: `Recipe step ${step.id} cannot resolve answer ${binding.source === "answer" ? binding.answerId : name}.`,
          nextAction:
            "Repair the versioned recipe answer binding; do not infer a value.",
        };
      args[name] = value;
    }
    const preview = await generators.preview({
      generatorId: step.generatorId,
      args,
      repo,
    });
    if (!preview.ok)
      return {
        ok: false,
        code: "AGENT_PACK_RECIPE_GENERATOR_UNAVAILABLE",
        message: preview.message,
        nextAction:
          "Repair the reviewed generator inputs and preview the recipe again.",
      };
    steps.push({
      id: step.id,
      generatorId: step.generatorId,
      args,
      generatorVersion: resolution.version,
    });
    for (const collision of preview.output.collisions)
      collisions.add(collision);
    for (const path of preview.output.provenancePaths) provenance.add(path);
    for (const id of preview.output.semanticRuleIds) semanticRules.add(id);
    for (const command of preview.output.codegen) codegen.add(command);
    for (const gate of preview.output.focusedGates) focusedGates.add(gate);
    for (const file of preview.output.files) {
      if (!safeRelativePath(file.path))
        return {
          ok: false,
          code: "AGENT_PACK_RECIPE_PATH_ESCAPE",
          message: `Recipe generator emitted unsafe path ${JSON.stringify(file.path)}.`,
          nextAction: "Repair the canonical generator; do not write this plan.",
        };
      if (paths.has(file.path))
        return {
          ok: false,
          code: "AGENT_PACK_RECIPE_PLAN_CONFLICT",
          message: `Recipe generators both own ${file.path}.`,
          nextAction:
            "Review one canonical owner for every generated operation.",
        };
      paths.add(file.path);
      operations.push({
        path: file.path,
        content: file.content,
        contentSha256: sha256(file.content),
        beforeSha256: file.beforeSha256,
        generatorStepId: step.id,
      });
    }
  }
  const unsigned = {
    schemaVersion: 1 as const,
    recipeId: recipe.id,
    recipeSchemaVersion: recipe.schemaVersion,
    recipeExecutionVersion: recipe.execution?.version ?? 0,
    targetRoot: repo.targetRoot,
    steps,
    operations,
    collisions: [...collisions].sort(),
    provenancePaths: [...provenance].sort(),
    semanticRuleIds: [...semanticRules].sort(),
    codegen: [...codegen],
    focusedGates: [...focusedGates].sort(),
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
    if (answer === undefined) invalid.push(question.id);
    else if (question.answerKind === "boolean" && typeof answer !== "boolean")
      invalid.push(question.id);
    else if (
      question.answerKind !== "boolean" &&
      (typeof answer !== "string" || answer.trim() === "")
    )
      invalid.push(question.id);
    else if (
      question.answerKind === "choice" &&
      !question.choices?.includes(String(answer))
    )
      invalid.push(question.id);
  }
  return invalid.length
    ? {
        ok: false,
        message: `Missing or invalid recipe answers: ${invalid.join(", ")}.`,
      }
    : { ok: true };
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
  mutationPosture: "preview" | "write",
  code: string,
  message: string,
  nextAction: string,
  rerun: string,
  data: AgentPackJsonValue,
) {
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
    diagnostics: [
      {
        code,
        severity: "error" as const,
        message,
        safeToContinue: mutationPosture === "preview",
        nextAction,
        rerun,
      },
    ],
    data,
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
