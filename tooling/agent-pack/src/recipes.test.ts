import { describe, expect, it } from "vitest";
import { executeAgentPackCommand } from "./contracts.js";
import {
  createAddRecipeCommand,
  createRecipesCommand,
  type RecipeCatalogProjection,
  type RecipeCommandProjection,
} from "./recipes.js";
import { createRepositoryContext } from "./repoContext.js";

const context = {
  schemaVersion: 1 as const,
  invocation: "library" as const,
  repo: createRepositoryContext({ cwd: "/customer" }),
};
const recipe = (
  id: string,
  availability: RecipeCommandProjection["availability"] = "available",
): RecipeCommandProjection => ({
  id,
  outcome: `Outcome for ${id}`,
  availability,
  questions: [
    {
      id: "name",
      prompt: "What should people call it?",
      why: "Names the visible entity.",
      answerKind: "text",
    },
  ],
  generatorPreviews: [
    {
      generatorId: "add-feature",
      command: "pnpm template:add-feature -- --name <name>",
      purpose: "Preview the slice.",
    },
  ],
  document: {
    schemaVersion: 1,
    id,
    outcome: `Outcome for ${id}`,
    availability: { status: availability },
  },
});
const recipes = [
  recipe("crud-business-entity"),
  recipe("validated-file-import"),
  recipe("approval-background-automation", "unavailable"),
] as const;
const catalog: RecipeCatalogProjection = {
  recipes,
  resolve: (query) => {
    const exact = recipes.find(({ id }) => id === query);
    return exact === undefined
      ? {
          kind: "template-gap" as const,
          query,
          adjacent: recipes.slice(0, 2),
          backlogRef: "AP-009 outcome recipe library",
        }
      : { kind: "recipe" as const, recipe: exact };
  },
};
const dependencies = { load: () => catalog };

describe("recipe commands", () => {
  it("previews only consequential questions and exact generator work", async () => {
    const result = await executeAgentPackCommand(
      createAddRecipeCommand(dependencies),
      {
        query: "crud-business-entity",
        answers: { name: "Request" },
      },
      context,
    );

    expect(result).toMatchObject({
      mutationPosture: "preview",
      exitClass: "success",
      data: {
        kind: "recipe",
        answers: { name: "Request" },
        questions: [{ id: "name" }],
        generatorPreviews: [{ generatorId: "add-feature" }],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /choose (a|an) (database|framework|architecture|provider)/i,
    );
  });

  it("returns adjacent reviewed recipes and a template-gap for unknown language", async () => {
    const result = await executeAgentPackCommand(
      createAddRecipeCommand(dependencies),
      { query: "invent a loyalty portal" },
      context,
    );

    expect(result).toMatchObject({
      mutationPosture: "preview",
      exitClass: "findings",
      diagnostics: [{ code: "AGENT_PACK_RECIPE_TEMPLATE_GAP" }],
      data: {
        kind: "template-gap",
        adjacent: [
          { id: "crud-business-entity" },
          { id: "validated-file-import" },
        ],
        backlogRef: "AP-009 outcome recipe library",
      },
    });
  });

  it("keeps unsupported automation honestly unavailable", async () => {
    const result = await executeAgentPackCommand(
      createAddRecipeCommand(dependencies),
      { query: "approval-background-automation" },
      context,
    );

    expect(result).toMatchObject({
      mutationPosture: "preview",
      exitClass: "unavailableDependency",
      diagnostics: [{ code: "AGENT_PACK_RECIPE_UNAVAILABLE" }],
    });
  });

  it("lists and shows the advanced recipe catalog read-only", async () => {
    const command = createRecipesCommand(dependencies);
    const listed = await executeAgentPackCommand(
      command,
      { action: "list" },
      context,
    );
    const shown = await executeAgentPackCommand(
      command,
      { action: "show", id: "validated-file-import" },
      context,
    );

    expect(listed).toMatchObject({
      mutationPosture: "read-only",
      exitClass: "success",
    });
    expect(
      (listed.data as { readonly recipes: readonly unknown[] }).recipes,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "validated-file-import" }),
      ]),
    );
    expect(shown).toMatchObject({
      mutationPosture: "read-only",
      exitClass: "success",
      data: { recipe: { id: "validated-file-import" } },
    });
  });

  it("rejects --write-shaped input instead of mutating", async () => {
    const result = await executeAgentPackCommand(
      createAddRecipeCommand(dependencies),
      { query: "crud-business-entity", write: true },
      context,
    );
    expect(result).toMatchObject({
      mutationPosture: "read-only",
      exitClass: "invalidInvocation",
    });
  });
});
