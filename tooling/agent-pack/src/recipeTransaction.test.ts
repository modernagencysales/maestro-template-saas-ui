import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRepositoryContext } from "./repoContext.js";
import { createNodeRecipeTransaction } from "./recipeTransaction.js";
import {
  fingerprintRecipePlan,
  sha256RecipeBytes,
  type RecipeExecutionPlan,
} from "./recipes.js";

const fixture = () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "maestro-recipe-")));
  mkdirSync(join(root, "catalog"));
  writeFileSync(join(root, "catalog/data.json"), "old\n");
  const unsigned = {
    schemaVersion: 1 as const,
    recipeId: "crud-business-entity",
    recipeSchemaVersion: 2,
    recipeExecutionVersion: 1,
    targetRoot: root,
    steps: [
      {
        id: "durable-table",
        generatorId: "add-table",
        args: { name: "Request" },
        generatorVersion: "add-table@1",
      },
    ],
    operations: [
      {
        path: "catalog/data.json",
        content: "new\n",
        contentSha256: sha256RecipeBytes("new\n"),
        beforeSha256: sha256RecipeBytes("old\n"),
        generatorStepId: "durable-table",
      },
      {
        path: "feature/request.ts",
        content: "export const request = true;\n",
        contentSha256: sha256RecipeBytes("export const request = true;\n"),
        beforeSha256: null,
        generatorStepId: "durable-table",
      },
    ],
    collisions: [],
    provenancePaths: ["feature/request.ts"],
    semanticRuleIds: [],
    focusedGates: [],
  };
  const plan: RecipeExecutionPlan = {
    ...unsigned,
    fingerprint: fingerprintRecipePlan(unsigned),
  };
  return {
    root,
    plan,
    request: {
      repo: createRepositoryContext({ cwd: root }),
      plan,
      preflightFingerprint: "preflight_sha256:fixture",
      answersSha256: sha256RecipeBytes("answers"),
    },
  };
};

describe("atomic recipe transaction", () => {
  it("applies replacements and creates in one journaled receipt", async () => {
    const value = fixture();
    const result = await createNodeRecipeTransaction().apply(value.request);
    expect(result).toMatchObject({
      ok: true,
      receipt: {
        kind: "maestro-recipe-transaction",
        planFingerprint: value.plan.fingerprint,
      },
    });
    expect(readFileSync(join(value.root, "catalog/data.json"), "utf8")).toBe(
      "new\n",
    );
    expect(
      readFileSync(join(value.root, "feature/request.ts"), "utf8"),
    ).toContain("request");
  });

  it("rolls back every applied operation when a later step fails", async () => {
    const value = fixture();
    const result = await createNodeRecipeTransaction({
      failAfterOperation: 2,
    }).apply(value.request);
    expect(result).toMatchObject({ ok: false });
    expect(readFileSync(join(value.root, "catalog/data.json"), "utf8")).toBe(
      "old\n",
    );
    expect(() =>
      readFileSync(join(value.root, "feature/request.ts")),
    ).toThrow();
  });

  it("fails closed on target drift, replay, and symlink traversal", async () => {
    const drift = fixture();
    writeFileSync(join(drift.root, "catalog/data.json"), "drift\n");
    await expect(
      createNodeRecipeTransaction().apply(drift.request),
    ).resolves.toMatchObject({
      ok: false,
      message: expect.stringMatching(/drifted after preview/),
    });

    const replay = fixture();
    await createNodeRecipeTransaction().apply(replay.request);
    await expect(
      createNodeRecipeTransaction().apply(replay.request),
    ).resolves.toMatchObject({
      ok: false,
      message: expect.stringMatching(/replay/),
    });

    const symlink = fixture();
    mkdirSync(join(symlink.root, "outside"));
    symlinkSync(join(symlink.root, "outside"), join(symlink.root, "feature"));
    await expect(
      createNodeRecipeTransaction().apply(symlink.request),
    ).resolves.toMatchObject({
      ok: false,
      message: expect.stringMatching(/symlink/),
    });
  });
});
