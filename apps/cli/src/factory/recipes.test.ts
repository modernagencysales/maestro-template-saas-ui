import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCliAsync } from "../index";
import { ADD_HELP, RECIPES_HELP } from "./recipes";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

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

    expect(JSON.parse(listed.stdout)).toMatchObject({
      schemaVersion: 1,
      command: { id: "recipes", version: 1 },
      mutationPosture: "read-only",
      data: {
        recipes: expect.arrayContaining([{ id: "validated-file-import" }]),
      },
    });
    expect(JSON.parse(shown.stdout)).toMatchObject({
      exitClass: "success",
      data: { recipe: { id: "validated-file-import" } },
    });
  });

  it("previews add without mutation and rejects --write", async () => {
    const preview = await runCliAsync(
      [
        "add",
        "crud-business-entity",
        "--answer",
        "entityName=Request",
        "--json",
      ],
      undefined,
      repoRoot,
    );
    const write = await runCliAsync(
      ["add", "crud-business-entity", "--write", "--json"],
      undefined,
      repoRoot,
    );

    expect(JSON.parse(preview.stdout)).toMatchObject({
      mutationPosture: "preview",
      exitClass: "success",
      data: {
        answers: { entityName: "Request" },
        generatorPreviews: expect.any(Array),
      },
    });
    expect(JSON.parse(write.stdout)).toMatchObject({
      exitClass: "invalidInvocation",
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
