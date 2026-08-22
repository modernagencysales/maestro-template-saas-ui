import { parseOutcomeRecipe, type OutcomeRecipe } from "./schema";

export type RecipeIndex = {
  readonly schemaVersion: 1;
  readonly generated: true;
  readonly recipes: readonly {
    readonly id: string;
    readonly file: string;
    readonly sha256: string;
  }[];
};

export type RecipeCatalog = {
  readonly recipes: readonly OutcomeRecipe[];
  readonly byId: ReadonlyMap<string, OutcomeRecipe>;
};

export type RecipeResolution =
  | { readonly kind: "recipe"; readonly recipe: OutcomeRecipe }
  | {
      readonly kind: "template-gap";
      readonly query: string;
      readonly adjacent: readonly OutcomeRecipe[];
      readonly backlogRef: "AP-009 outcome recipe library";
    };

type Digest = (bytes: string) => string;
type IndexedSource = { readonly file: string; readonly bytes: string };

export function buildRecipeIndex(
  sources: readonly IndexedSource[],
  digest: Digest,
): RecipeIndex {
  const recipes = sources
    .map(({ file, bytes }) => ({
      id: parseOutcomeRecipe(JSON.parse(bytes) as unknown).id,
      file,
      sha256: digest(bytes),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  if (new Set(recipes.map(({ id }) => id)).size !== recipes.length)
    throw new RangeError("recipe index contains duplicate ids");
  return Object.freeze({ schemaVersion: 1, generated: true, recipes });
}

export function loadRecipeCatalog(
  indexValue: unknown,
  sourceBytes: ReadonlyMap<string, string>,
  digest: Digest,
): RecipeCatalog {
  const index = parseRecipeIndex(indexValue);
  const recipes = index.recipes.map((entry) => {
    const bytes = sourceBytes.get(entry.file);
    if (bytes === undefined || digest(bytes) !== entry.sha256)
      throw new RangeError(`recipe index checksum mismatch: ${entry.file}`);
    const recipe = parseOutcomeRecipe(JSON.parse(bytes) as unknown);
    if (recipe.id !== entry.id)
      throw new RangeError(`recipe index id mismatch: ${entry.file}`);
    return recipe;
  });
  return Object.freeze({
    recipes: Object.freeze(recipes),
    byId: new Map(recipes.map((recipe) => [recipe.id, recipe])),
  });
}

export function resolveRecipe(
  catalog: RecipeCatalog,
  query: string,
): RecipeResolution {
  const normalized = normalize(query);
  const exact = catalog.recipes.find((recipe) =>
    [recipe.id, recipe.outcome, ...recipe.aliases].some(
      (candidate) => normalize(candidate) === normalized,
    ),
  );
  if (exact !== undefined) return { kind: "recipe", recipe: exact };
  const queryWords = words(normalized);
  const adjacent = catalog.recipes
    .map((recipe) => ({
      recipe,
      score: words(
        [recipe.id, recipe.outcome, ...recipe.aliases].join(" "),
      ).filter((word) => queryWords.includes(word)).length,
    }))
    .sort((left, right) =>
      right.score === left.score
        ? left.recipe.id.localeCompare(right.recipe.id)
        : right.score - left.score,
    )
    .slice(0, 2)
    .map(({ recipe }) => recipe);
  return {
    kind: "template-gap",
    query,
    adjacent,
    backlogRef: "AP-009 outcome recipe library",
  };
}

function parseRecipeIndex(value: unknown): RecipeIndex {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new RangeError("recipe index must be an object");
  const input = value as Record<string, unknown>;
  if (
    input.schemaVersion !== 1 ||
    input.generated !== true ||
    !Array.isArray(input.recipes) ||
    input.recipes.length === 0
  )
    throw new RangeError("invalid generated recipe index");
  const recipes = input.recipes.map((value) => {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new RangeError("invalid recipe index entry");
    const entry = value as Record<string, unknown>;
    if (
      typeof entry.id !== "string" ||
      typeof entry.file !== "string" ||
      typeof entry.sha256 !== "string" ||
      !entry.sha256.startsWith("sha256:")
    )
      throw new RangeError("invalid recipe index entry");
    return { id: entry.id, file: entry.file, sha256: entry.sha256 };
  });
  return { schemaVersion: 1, generated: true, recipes };
}

const normalize = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const words = (value: string): readonly string[] =>
  normalize(value).split("-").filter(Boolean);
