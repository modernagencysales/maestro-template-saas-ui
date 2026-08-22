import { describe, expect, it } from "vitest";
import { executeAgentPackCommand } from "./contracts.js";
import {
  createAddRecipeCommand,
  createRecipesCommand,
  type RecipeCatalogProjection,
  type RecipeCommandProjection,
} from "./recipes.js";
import { mutationBlockingPreflightCodes } from "./preflight.js";
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
  schemaVersion: 2,
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
  execution: {
    version: 1,
    mode: "greenfield-additive",
    steps: [
      {
        id: "visible-slice",
        generatorId: "add-feature",
        arguments: {
          name: { source: "answer", answerId: "name" },
          disposition: { source: "literal", value: "extend" },
        },
      },
    ],
  },
  document: {
    schemaVersion: 2,
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
const receipt = {
  schemaVersion: 1 as const,
  kind: "maestro-recipe-transaction" as const,
  status: "applied" as const,
  recipeId: "crud-business-entity",
  recipeSchemaVersion: 2,
  planFingerprint: "recipe_plan_sha256:fixture",
  preflightFingerprint: "preflight_sha256:fixture",
  answersSha256: "sha256:answers",
  generatorVersions: ["add-feature@1"],
  operationPaths: ["apps/web/src/features/request.ts"],
  provenancePaths: [
    "docs/template/generated/provenance/add-feature/request.json",
  ],
  candidateCommit: null,
  templateInstanceFingerprint: null,
  journalPath: ".maestro/recipe-transactions/fixture/transaction.json",
  receiptPath: ".maestro/recipe-transactions/fixture/receipt.json",
};
let applied = 0;
const dependencies = {
  load: () => catalog,
  generators: {
    resolve: (generatorId: string) =>
      generatorId === "add-feature"
        ? { supported: true as const, version: "add-feature@1" }
        : { supported: false as const },
    preview: async () => ({
      ok: true as const,
      output: {
        files: [
          {
            path: "apps/web/src/features/request.ts",
            content: "export const request = true;\n",
            beforeSha256: null,
          },
        ],
        provenancePaths: [
          "docs/template/generated/provenance/add-feature/request.json",
        ],
        collisions: [],
        semanticRuleIds: [],
        manualFollowUp: [],
        codegen: [
          "pnpm confect:codegen",
          "pnpm confect:manifest",
          "pnpm format",
          "pnpm --dir apps/web build",
        ],
        focusedGates: ["pnpm --dir apps/web typecheck"],
      },
    }),
  },
  preflight: {
    inspect: async () => ({
      fingerprint: "preflight_sha256:fixture",
      blockingCodes: [],
    }),
  },
  transaction: {
    apply: async () => {
      applied += 1;
      return { ok: true as const, receipt };
    },
  },
};

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
        plan: {
          fingerprint: expect.stringMatching(/^recipe_plan_sha256:/),
          codegen: [
            "pnpm confect:codegen",
            "pnpm confect:manifest",
            "pnpm format",
            "pnpm --dir apps/web build",
          ],
          operations: [
            expect.objectContaining({
              path: "apps/web/src/features/request.ts",
            }),
          ],
        },
        preflightFingerprint: "preflight_sha256:fixture",
        confirmationCommand: expect.stringMatching(/--write/),
      },
    });
    expect(JSON.stringify(result.data)).not.toMatch(
      /privacy-reviewed|plan-fingerprint|preflight-fingerprint/,
    );
    expect(JSON.stringify(result)).not.toMatch(
      /choose (a|an) (database|framework|architecture|provider)/i,
    );
  });

  it("blocks collision previews without emitting write authority", async () => {
    const result = await executeAgentPackCommand(
      createAddRecipeCommand({
        ...dependencies,
        generators: {
          ...dependencies.generators,
          preview: async () => ({
            ok: true as const,
            output: {
              files: [
                {
                  path: "apps/web/src/features/request.ts",
                  content: "export const request = true;\n",
                  beforeSha256: "sha256:customer-owned",
                },
              ],
              provenancePaths: [],
              collisions: ["apps/web/src/features/request.ts"],
              semanticRuleIds: [],
              manualFollowUp: [],
              codegen: [],
              focusedGates: [],
            },
          }),
        },
      }),
      { query: "crud-business-entity", answers: { name: "Request" } },
      context,
    );

    expect(result).toMatchObject({
      mutationPosture: "preview",
      exitClass: "findings",
      diagnostics: [{ code: "AGENT_PACK_RECIPE_COLLISION" }],
      data: {
        plan: { collisions: ["apps/web/src/features/request.ts"] },
      },
    });
    expect(result.data).not.toHaveProperty("confirmationCommand");
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

  it("fails closed for unreviewed generators and unsafe generated paths", async () => {
    const unreviewed = await executeAgentPackCommand(
      createAddRecipeCommand({
        ...dependencies,
        generators: {
          ...dependencies.generators,
          resolve: () => ({ supported: false as const }),
        },
      }),
      { query: "crud-business-entity", answers: { name: "Request" } },
      context,
    );
    expect(unreviewed).toMatchObject({
      exitClass: "findings",
      diagnostics: [{ code: "AGENT_PACK_RECIPE_GENERATOR_UNREVIEWED" }],
    });

    const unsafe = await executeAgentPackCommand(
      createAddRecipeCommand({
        ...dependencies,
        generators: {
          ...dependencies.generators,
          preview: async () => ({
            ok: true as const,
            output: {
              files: [
                {
                  path: "../escape.ts",
                  content: "unsafe\n",
                  beforeSha256: null,
                },
              ],
              provenancePaths: [],
              collisions: [],
              semanticRuleIds: [],
              manualFollowUp: [],
              codegen: [],
              focusedGates: [],
            },
          }),
        },
      }),
      { query: "crud-business-entity", answers: { name: "Request" } },
      context,
    );
    expect(unsafe).toMatchObject({
      exitClass: "findings",
      diagnostics: [{ code: "AGENT_PACK_RECIPE_PATH_ESCAPE" }],
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

  it("rebuilds the current plan and writes despite unrelated dirty worktree state", async () => {
    applied = 0;
    let currentBeforeSha256 = "sha256:before-preview";
    let appliedBeforeSha256: string | null | undefined;
    const command = createAddRecipeCommand({
      ...dependencies,
      generators: {
        ...dependencies.generators,
        preview: async () => ({
          ok: true as const,
          output: {
            files: [
              {
                path: "apps/web/src/features/request.ts",
                content: "export const request = true;\n",
                beforeSha256: currentBeforeSha256,
              },
            ],
            provenancePaths: [],
            collisions: [],
            semanticRuleIds: [],
            manualFollowUp: [],
            codegen: [
              "pnpm confect:codegen",
              "pnpm confect:manifest",
              "pnpm format",
              "pnpm --dir apps/web build",
            ],
            focusedGates: ["pnpm --dir apps/web typecheck"],
          },
        }),
      },
      transaction: {
        apply: async ({ plan }) => {
          applied += 1;
          appliedBeforeSha256 = plan.operations[0]?.beforeSha256;
          return { ok: true as const, receipt };
        },
      },
    });
    const preview = await executeAgentPackCommand(
      command,
      { query: "crud-business-entity", answers: { name: "Request" } },
      context,
    );
    currentBeforeSha256 = "sha256:before-write";
    const written = await executeAgentPackCommand(
      command,
      {
        query: "crud-business-entity",
        answers: { name: "Request" },
        write: true,
      },
      context,
    );
    expect(preview).toMatchObject({ exitClass: "success" });
    expect(written).toMatchObject({
      mutationPosture: "write",
      exitClass: "success",
      data: {
        receipt: { kind: "maestro-recipe-transaction" },
        followUpActions: [
          { command: "pnpm confect:codegen" },
          { command: "pnpm confect:manifest" },
          { command: "pnpm format" },
          { command: "pnpm --dir apps/web build" },
          { command: "pnpm --dir apps/web typecheck" },
        ],
      },
    });
    expect(written.data).not.toHaveProperty("confirmationCommand");
    expect(applied).toBe(1);
    expect(appliedBeforeSha256).toBe("sha256:before-write");
  });

  it("reports every concurrent retained preflight denial before applying", async () => {
    applied = 0;
    const result = await executeAgentPackCommand(
      createAddRecipeCommand({
        ...dependencies,
        preflight: {
          inspect: async () => ({
            fingerprint: "preflight_sha256:blocked",
            blockingCodes: mutationBlockingPreflightCodes,
          }),
        },
      }),
      {
        query: "crud-business-entity",
        answers: { name: "Request" },
        write: true,
      },
      context,
    );

    expect(result).toMatchObject({ exitClass: "blockedMutation" });
    expect(result.diagnostics.map(({ code }) => code)).toEqual(
      mutationBlockingPreflightCodes,
    );
    expect(applied).toBe(0);
  });
});
