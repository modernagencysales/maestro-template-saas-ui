import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
  type AgentPackArgumentResult,
  type AgentPackDiagnostic,
  type AgentPackJsonValue,
} from "./contracts.js";
import type { RepositoryContext } from "./repoContext.js";

export type RecipeCommandProjection = {
  readonly id: string;
  readonly outcome: string;
  readonly availability: "available" | "unavailable" | "template-gap";
  readonly questions: readonly AgentPackJsonValue[];
  readonly generatorPreviews: readonly AgentPackJsonValue[];
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

export type RecipeCommandDependencies = {
  readonly load: (
    repo: RepositoryContext,
  ) => Promise<RecipeCatalogProjection> | RecipeCatalogProjection;
};

type AddRecipeInput = {
  readonly query: string;
  readonly answers: Readonly<Record<string, string | boolean>>;
};
type RecipeSummary = {
  readonly id: string;
  readonly outcome: string;
  readonly availability: RecipeCommandProjection["availability"];
};
type AddRecipeData =
  | {
      readonly kind: "template-gap";
      readonly query: string;
      readonly adjacent: readonly RecipeSummary[];
      readonly backlogRef: string;
    }
  | {
      readonly kind: "recipe";
      readonly recipe: RecipeCommandProjection["document"];
      readonly answers: Readonly<Record<string, string | boolean>>;
      readonly questions: readonly AgentPackJsonValue[];
      readonly generatorPreviews: readonly AgentPackJsonValue[];
    };

export function createAddRecipeCommand(
  dependencies: RecipeCommandDependencies,
) {
  return defineAgentPackCommand<"add", AddRecipeInput, AddRecipeData>({
    id: "add",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: decodeAddRecipeInput,
    mutationPosture: () => "preview" as const,
    execute: async (input, context) => {
      const resolution = (await dependencies.load(context.repo)).resolve(
        input.query,
      );
      if (resolution.kind === "template-gap") {
        return {
          mutationPosture: "preview" as const,
          exitClass: "findings" as const,
          summary: "No reviewed recipe exactly matches this outcome.",
          diagnostics: [templateGapDiagnostic(input.query)],
          data: {
            kind: "template-gap" as const,
            query: resolution.query,
            adjacent: resolution.adjacent.map(summary),
            backlogRef: resolution.backlogRef,
          },
        };
      }
      const recipe = resolution.recipe;
      if (recipe.availability !== "available") {
        return {
          mutationPosture: "preview" as const,
          exitClass: "unavailableDependency" as const,
          summary: `Recipe ${recipe.id} is honestly unavailable.`,
          diagnostics: [unavailableDiagnostic(recipe)],
          data: {
            kind: "recipe" as const,
            recipe: recipe.document,
            answers: input.answers,
            questions: recipe.questions,
            generatorPreviews: recipe.generatorPreviews,
          },
        };
      }
      return {
        mutationPosture: "preview" as const,
        exitClass: "success" as const,
        summary: `Previewed recipe ${recipe.id}; no files were changed.`,
        diagnostics: [],
        data: {
          kind: "recipe" as const,
          recipe: recipe.document,
          answers: input.answers,
          questions: recipe.questions,
          generatorPreviews: recipe.generatorPreviews,
        },
      };
    },
  });
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
      if (input.action === "list") {
        return {
          mutationPosture: "read-only" as const,
          exitClass: "success" as const,
          summary: `Found ${catalog.recipes.length} reviewed recipes.`,
          diagnostics: [],
          data: { recipes: catalog.recipes.map(summary) },
        };
      }
      const recipe = catalog.recipes.find(({ id }) => id === input.id);
      if (recipe === undefined) {
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

function decodeAddRecipeInput(
  value: unknown,
): AgentPackArgumentResult<AddRecipeInput> {
  if (!isRecord(value) || !onlyKeys(value, ["query", "answers"]))
    return invalid("add", "Provide one reviewed outcome or recipe id.");
  const answers = value.answers ?? {};
  if (
    typeof value.query !== "string" ||
    value.query.trim().length === 0 ||
    !isRecord(answers) ||
    Object.values(answers).some(
      (answer) => typeof answer !== "string" && typeof answer !== "boolean",
    )
  )
    return invalid(
      "add",
      "Provide one reviewed outcome and text/boolean answers.",
    );
  return {
    ok: true,
    args: {
      query: value.query,
      answers: answers as Record<string, string | boolean>,
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
  rerun: `pnpm maestro -- recipes list --json`,
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
