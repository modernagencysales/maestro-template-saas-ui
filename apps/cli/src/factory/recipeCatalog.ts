import {
  buildRecipeIndex,
  loadRecipeCatalog,
  resolveRecipe,
  type OutcomeRecipe,
} from "@maestro-template/template-core";
import type {
  RecipeCatalogProjection,
  RecipeCommandProjection,
} from "@maestro-template/agent-pack";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const digest = (bytes: string): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

export function loadRecipeCatalogProjection(
  sourceRoot: string,
): RecipeCatalogProjection {
  const root = join(sourceRoot, "docs/template/recipes");
  const sources = readdirSync(root)
    .filter((file) => file.endsWith(".json") && file !== "index.generated.json")
    .sort()
    .map((file) => ({ file, bytes: readFileSync(join(root, file), "utf8") }));
  const index = JSON.parse(
    readFileSync(join(root, "index.generated.json"), "utf8"),
  ) as unknown;
  const catalog = loadRecipeCatalog(
    index,
    new Map(sources.map(({ file, bytes }) => [file, bytes])),
    digest,
  );
  const projected = new Map(
    catalog.recipes.map((recipe) => [recipe.id, projectRecipe(recipe)]),
  );
  return {
    recipes: [...projected.values()],
    resolve: (query) => {
      const resolution = resolveRecipe(catalog, query);
      if (resolution.kind === "recipe")
        return {
          kind: "recipe",
          recipe: requireProjectedRecipe(projected, resolution.recipe.id),
        };
      return {
        ...resolution,
        adjacent: resolution.adjacent.map((recipe) =>
          requireProjectedRecipe(projected, recipe.id),
        ),
      };
    },
  };
}

function requireProjectedRecipe(
  projected: ReadonlyMap<string, RecipeCommandProjection>,
  id: string,
): RecipeCommandProjection {
  const recipe = projected.get(id);
  if (recipe === undefined)
    throw new Error(
      `Recipe projection is unavailable for ${JSON.stringify(id)}.`,
    );
  return recipe;
}

export function currentGeneratedRecipeIndex(sourceRoot: string) {
  const root = join(sourceRoot, "docs/template/recipes");
  const sources = readdirSync(root)
    .filter((file) => file.endsWith(".json") && file !== "index.generated.json")
    .map((file) => ({ file, bytes: readFileSync(join(root, file), "utf8") }));
  return buildRecipeIndex(sources, digest);
}

function projectRecipe(recipe: OutcomeRecipe): RecipeCommandProjection {
  const document = JSON.parse(JSON.stringify(recipe)) as {
    readonly [
      key: string
    ]: import("@maestro-template/agent-pack").AgentPackJsonValue;
  };
  return {
    schemaVersion: recipe.schemaVersion,
    id: recipe.id,
    outcome: recipe.outcome,
    availability: recipe.availability.status,
    questions: recipe.consequentialQuestions,
    generatorPreviews:
      document.generatorPreviews as readonly import("@maestro-template/agent-pack").AgentPackJsonValue[],
    ...(recipe.execution === undefined ? {} : { execution: recipe.execution }),
    document,
  };
}
