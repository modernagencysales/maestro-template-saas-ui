import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createAddRecipeCommand,
  createRecipesCommand,
} from "@maestro-template/agent-pack";
import { runCliAsync } from "../index";
import { ADD_HELP, createRecipeCliHandlers, RECIPES_HELP } from "./recipes";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const crudAnswers = [
  "--answer",
  "entityName=Request",
  "--answer",
  "canonicalOwner=access-and-tenancy",
  "--answer",
  "screenCatalogId=starter-route:apps/web/src/routes/_app/$workspace/_dashboard/contacts/index.tsx",
  "--answer",
  "tenantScope=workspace",
  "--answer",
  "sensitivity=internal",
  "--answer",
  "pii=none",
  "--answer",
  "exportMode=json",
  "--answer",
  "deleteMode=delete",
  "--answer",
  "retention=retain-until-workspace-delete",
  "--answer",
  "appendOnly=false",
] as const;

const recipeFixture = {
  schemaVersion: 1,
  id: "fixture",
  outcome: "Fixture",
  availability: "available" as const,
  questions: [
    {
      id: "name",
      prompt: "Name",
      why: "Fixture",
      answerKind: "text" as const,
    },
  ],
  generatorPreviews: [],
  execution: {
    version: 1,
    mode: "greenfield-additive" as const,
    steps: [
      {
        id: "fixture",
        generatorId: "fixture",
        arguments: { name: { source: "answer" as const, answerId: "name" } },
      },
    ],
  },
  document: { id: "fixture" },
};

describe("recipe CLI", () => {
  it("previews then applies the same direct write command", async () => {
    let applied = 0;
    const dependencies = {
      load: () => ({
        recipes: [recipeFixture],
        resolve: (query: string) =>
          query === "fixture"
            ? { kind: "recipe" as const, recipe: recipeFixture }
            : {
                kind: "template-gap" as const,
                query,
                adjacent: [],
                backlogRef: "fixture",
              },
      }),
      generators: {
        resolve: () => ({ supported: true as const, version: "fixture@1" }),
        preview: async () => ({
          ok: true as const,
          output: {
            files: [
              {
                path: "apps/web/src/fixture.ts",
                content: "fixture\n",
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
      preflight: {
        inspect: async () => ({
          fingerprint: "preflight_sha256:fixture",
          blockingCodes: [],
        }),
      },
      transaction: {
        apply: async () => {
          applied += 1;
          return {
            ok: true as const,
            receipt: {
              schemaVersion: 1 as const,
              kind: "maestro-recipe-transaction" as const,
              status: "applied" as const,
              recipeId: "fixture",
              recipeSchemaVersion: 1,
              planFingerprint: "recipe_plan_sha256:fixture",
              preflightFingerprint: "preflight_sha256:fixture",
              answersSha256: "sha256:fixture",
              generatorVersions: ["fixture@1"],
              operationPaths: ["apps/web/src/fixture.ts"],
              provenancePaths: [],
              candidateCommit: null,
              templateInstanceFingerprint: null,
              journalPath: ".maestro/fixture.json",
              receiptPath: ".maestro/receipt.json",
            },
          };
        },
      },
    };
    const handlers = createRecipeCliHandlers({
      add: createAddRecipeCommand(dependencies),
      recipes: createRecipesCommand(dependencies),
    });
    const add = handlers.find(({ command }) => command === "add");
    const argv = ["add", "fixture", "--answer", "name=Fixture"] as const;
    const preview = await add?.run([...argv, "--json"], "/fixture");
    const written = await add?.run([...argv, "--write", "--json"], "/fixture");

    expect(JSON.parse(preview?.stdout ?? "null")).toMatchObject({
      mutationPosture: "preview",
      exitClass: "success",
    });
    expect(JSON.parse(written?.stdout ?? "null")).toMatchObject({
      mutationPosture: "write",
      exitClass: "success",
      data: { receipt: { kind: "maestro-recipe-transaction" } },
    });
    expect(applied).toBe(1);
  });

  it("lists and shows reviewed recipes through versioned JSON", async () => {
    const listed = await runCliAsync(
      ["recipes", "list", "--json"],
      undefined,
      repoRoot,
    );
    const shown = await runCliAsync(
      ["recipes", "show", "validated-file-import", "--json"],
      undefined,
      repoRoot,
    );

    const listedResult = JSON.parse(listed.stdout) as {
      readonly data: { readonly recipes: readonly unknown[] };
    };
    expect(listedResult).toMatchObject({
      schemaVersion: 1,
      command: { id: "recipes", version: 1 },
      mutationPosture: "read-only",
    });
    expect(listedResult.data.recipes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "validated-file-import" }),
      ]),
    );
    expect(JSON.parse(shown.stdout)).toMatchObject({
      exitClass: "success",
      data: { recipe: { id: "validated-file-import" } },
    });
  });

  it("previews one closed executable plan and returns a direct write rerun", async () => {
    const preview = await runCliAsync(
      ["add", "crud-business-entity", ...crudAnswers, "--json"],
      undefined,
      repoRoot,
    );

    expect(JSON.parse(preview.stdout)).toMatchObject({
      mutationPosture: "preview",
      exitClass: "success",
      data: {
        answers: { entityName: "Request" },
        generatorPreviews: expect.any(Array),
        plan: {
          operations: expect.arrayContaining([
            expect.objectContaining({
              path: expect.stringMatching(/cP11Probe|request|Request/i),
            }),
          ]),
          fingerprint: expect.stringMatching(/^recipe_plan_sha256:/),
        },
        confirmationCommand: expect.stringMatching(/--write/),
      },
    });
    expect(JSON.parse(preview.stdout).data.confirmationCommand).not.toMatch(
      /privacy-reviewed|plan-fingerprint|preflight-fingerprint/,
    );
  });

  it("returns adjacent recipes and a template-gap for unknown language", async () => {
    const result = await runCliAsync(
      ["add", "customer-loyalty-portal", "--json"],
      undefined,
      repoRoot,
    );
    expect(JSON.parse(result.stdout)).toMatchObject({
      exitClass: "findings",
      data: {
        kind: "template-gap",
        adjacent: expect.any(Array),
        backlogRef: "AP-009 outcome recipe library",
      },
    });
  });

  it("routes exact novice and advanced help", async () => {
    await expect(
      runCliAsync(["add", "--help"], undefined, repoRoot),
    ).resolves.toMatchObject({ exitCode: 0, stdout: ADD_HELP });
    await expect(
      runCliAsync(["recipes", "--help"], undefined, repoRoot),
    ).resolves.toMatchObject({ exitCode: 0, stdout: RECIPES_HELP });
  });
});
