import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCliAsync } from "../index";
import { ADD_HELP, RECIPES_HELP } from "./recipes";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const crudAnswers = [
  "--answer",
  "entityName=Request",
  "--answer",
  "canonicalOwner=access-and-tenancy",
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

describe("recipe CLI", () => {
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

  it("previews one closed executable plan and blocks unconfirmed writes", async () => {
    const preview = await runCliAsync(
      ["add", "crud-business-entity", ...crudAnswers, "--json"],
      undefined,
      repoRoot,
    );
    const write = await runCliAsync(
      [
        "add",
        "crud-business-entity",
        ...crudAnswers,
        "--write",
        "--privacy-reviewed",
        "--plan-fingerprint",
        "recipe_plan_sha256:stale",
        "--preflight-fingerprint",
        "preflight_sha256:stale",
        "--json",
      ],
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
        confirmationCommand: expect.stringMatching(
          /--write.*--privacy-reviewed.*--plan-fingerprint.*--preflight-fingerprint/,
        ),
      },
    });
    expect(JSON.parse(write.stdout)).toMatchObject({
      mutationPosture: "write",
      exitClass: "blockedMutation",
      diagnostics: [{ code: "AGENT_PACK_RECIPE_AUTHORITY_STALE" }],
    });
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
