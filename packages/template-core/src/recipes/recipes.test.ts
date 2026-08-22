import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildRecipeIndex, loadRecipeCatalog, resolveRecipe } from "./loader";
import { parseOutcomeRecipe } from "./schema";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const recipeRoot = join(repoRoot, "docs/template/recipes");
const digest = (bytes: string) =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const files = [
  "approval-background-automation.json",
  "crud-business-entity.json",
  "validated-file-import.json",
] as const;
const sourceBytes = new Map(
  files.map((file) => [file, readFileSync(join(recipeRoot, file), "utf8")]),
);
const indexValue = JSON.parse(
  readFileSync(join(recipeRoot, "index.generated.json"), "utf8"),
) as unknown;

describe("outcome recipe catalog", () => {
  it("loads exactly three checksum-bound machine-readable recipes", () => {
    const catalog = loadRecipeCatalog(indexValue, sourceBytes, digest);

    expect(catalog.recipes.map(({ id }) => id)).toEqual([
      "approval-background-automation",
      "crud-business-entity",
      "validated-file-import",
    ]);
    expect(catalog.recipes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "crud-business-entity",
          minimumPrimitive: expect.any(String),
          consequentialQuestions: expect.any(Array),
          execution: expect.objectContaining({
            version: 1,
            mode: "greenfield-additive",
            steps: [
              expect.objectContaining({
                id: "durable-table",
                generatorId: "add-table",
              }),
              expect.objectContaining({
                id: "visible-slice",
                generatorId: "add-feature",
              }),
            ],
          }),
          escalationTriggers: expect.any(Array),
        }),
        expect.objectContaining({
          id: "approval-background-automation",
          availability: expect.objectContaining({
            status: "available",
          }),
        }),
      ]),
    );
  });

  it("rebuilds the generated index without parallel hand-written facts", () => {
    expect(
      buildRecipeIndex(
        [...sourceBytes].map(([file, bytes]) => ({ file, bytes })),
        digest,
      ),
    ).toEqual(indexValue);
  });

  it("resolves reviewed language and returns adjacent template-gap results", () => {
    const catalog = loadRecipeCatalog(indexValue, sourceBytes, digest);
    expect(resolveRecipe(catalog, "import a csv")).toMatchObject({
      kind: "recipe",
      recipe: { id: "validated-file-import" },
    });

    const unknown = resolveRecipe(catalog, "build a customer loyalty portal");
    expect(unknown).toMatchObject({
      kind: "template-gap",
      query: "build a customer loyalty portal",
      backlogRef: "AP-009 outcome recipe library",
    });
    expect(
      unknown.kind === "template-gap" ? unknown.adjacent : [],
    ).toHaveLength(2);
    expect(JSON.stringify(unknown)).not.toMatch(/generatorId.*loyalty/i);
  });

  it("fails closed on checksum drift and unknown availability", () => {
    const drifted = new Map(sourceBytes);
    drifted.set("crud-business-entity.json", "{}\n");
    expect(() => loadRecipeCatalog(indexValue, drifted, digest)).toThrow(
      /checksum mismatch/,
    );

    const recipe = JSON.parse(sourceBytes.get(files[0]) ?? "{}") as Record<
      string,
      unknown
    >;
    recipe.availability = { status: "invented" };
    expect(() => parseOutcomeRecipe(recipe)).toThrow(/availability status/);
  });

  it("fails closed when executable bindings reference undeclared answers", () => {
    const recipe = JSON.parse(
      sourceBytes.get("crud-business-entity.json") ?? "{}",
    ) as Record<string, unknown>;
    const execution = recipe.execution as {
      steps: { arguments: Record<string, unknown> }[];
    };
    const firstStep = execution.steps[0];
    if (firstStep === undefined) throw new Error("missing recipe step");
    firstStep.arguments.name = {
      source: "answer",
      answerId: "undeclared",
    };
    expect(() => parseOutcomeRecipe(recipe)).toThrow(
      /references unknown answer undeclared/,
    );
  });
});
