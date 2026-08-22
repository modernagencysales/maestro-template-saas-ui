import {
  buildRecipeIndex,
  loadRecipeCatalog,
  type OutcomeRecipe,
} from "@maestro-template/template-core";
import { parseSystemCatalog } from "@maestro-template/template-core/systemCatalog";
import { WORKFLOW_SEMANTICS } from "@maestro-template/template-core/workflow-semantics";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REVIEWED_GENERATOR_DESCRIPTORS } from "../generators/src/index.ts";
import { isDirectRun } from "./src/direct-run.mts";

const EXPECTED_RECIPE_IDS = [
  "approval-background-automation",
  "crud-business-entity",
  "validated-file-import",
] as const;
const digest = (bytes: string): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

export function checkRecipes(repoRoot: string): readonly string[] {
  const findings: string[] = [];
  const recipeRoot = join(repoRoot, "docs/template/recipes");
  const sources = readdirSync(recipeRoot)
    .filter((file) => file.endsWith(".json") && file !== "index.generated.json")
    .sort()
    .map((file) => ({
      file,
      bytes: readFileSync(join(recipeRoot, file), "utf8"),
    }));
  let expectedIndex;
  let catalog;
  try {
    expectedIndex = buildRecipeIndex(sources, digest);
    const committedIndex = JSON.parse(
      readFileSync(join(recipeRoot, "index.generated.json"), "utf8"),
    ) as unknown;
    if (JSON.stringify(committedIndex) !== JSON.stringify(expectedIndex))
      findings.push(
        "generated-index: docs/template/recipes/index.generated.json is stale",
      );
    catalog = loadRecipeCatalog(
      committedIndex,
      new Map(sources.map(({ file, bytes }) => [file, bytes])),
      digest,
    );
  } catch (error) {
    return [`catalog: ${message(error)}`];
  }
  if (
    JSON.stringify(catalog.recipes.map(({ id }) => id)) !==
    JSON.stringify(EXPECTED_RECIPE_IDS)
  )
    findings.push(
      "inventory: exactly the three reviewed initial recipes are required",
    );

  const systems = parseSystemCatalog(
    JSON.parse(
      readFileSync(join(repoRoot, "docs/template/system-catalog.json"), "utf8"),
    ) as unknown,
  );
  const systemIds = new Set(systems.systems.map(({ id }) => id));
  const semantics = new Map(WORKFLOW_SEMANTICS.map((rule) => [rule.id, rule]));
  for (const recipe of catalog.recipes) {
    checkOwners(recipe, systemIds, findings);
    checkGenerators(recipe, findings);
    checkGateCommands(repoRoot, recipe, findings);
    checkSemanticAvailability(recipe, semantics, findings);
  }
  return findings;
}

function checkOwners(
  recipe: OutcomeRecipe,
  systemIds: ReadonlySet<string>,
  findings: string[],
): void {
  for (const { id } of recipe.canonicalSystems)
    if (!systemIds.has(id))
      findings.push(`${recipe.id}: unknown canonical owner ${id}`);
}

function checkGenerators(recipe: OutcomeRecipe, findings: string[]): void {
  const previewIds = new Set<string>();
  for (const preview of recipe.generatorPreviews) {
    previewIds.add(preview.generatorId);
    const descriptor = REVIEWED_GENERATOR_DESCRIPTORS.find(
      ({ generatorId }) => generatorId === preview.generatorId,
    );
    if (descriptor === undefined)
      findings.push(`${recipe.id}: unknown generator ${preview.generatorId}`);
    else if (!preview.command.startsWith(`${descriptor.command} -- `))
      findings.push(
        `${recipe.id}: ${preview.generatorId} command must start with ${descriptor.command} --`,
      );
  }
  if (recipe.id === "crud-business-entity" && recipe.execution === undefined)
    findings.push(`${recipe.id}: executable generator binding is required`);
  for (const step of recipe.execution?.steps ?? []) {
    if (
      !REVIEWED_GENERATOR_DESCRIPTORS.some(
        ({ generatorId }) => generatorId === step.generatorId,
      )
    )
      findings.push(
        `${recipe.id}: execution names unknown generator ${step.generatorId}`,
      );
    if (!previewIds.has(step.generatorId))
      findings.push(
        `${recipe.id}: execution generator ${step.generatorId} lacks its human preview`,
      );
  }
  if (recipe.id === "crud-business-entity") {
    const table = recipe.execution?.steps.find(
      ({ generatorId }) => generatorId === "add-table",
    );
    const required = [
      "name",
      "system",
      "disposition",
      "tenantScope",
      "sensitivity",
      "pii",
      "exportMode",
      "deleteMode",
      "retention",
      "appendOnly",
      "businessEntity",
    ];
    const missing = required.filter(
      (argument) => table?.arguments[argument] === undefined,
    );
    if (missing.length > 0)
      findings.push(
        `${recipe.id}: add-table execution lacks explicit bindings for ${missing.join(", ")}`,
      );
  }
}

function checkGateCommands(
  repoRoot: string,
  recipe: OutcomeRecipe,
  findings: string[],
): void {
  for (const command of recipe.focusedGates) {
    const parts = command.split(" ");
    const directory = parts[1] === "--dir" ? parts[2] : undefined;
    const script = directory === undefined ? parts[1] : parts[3];
    if (parts[0] !== "pnpm" || script === undefined) {
      findings.push(`${recipe.id}: invalid focused gate command ${command}`);
      continue;
    }
    const packagePath = join(repoRoot, directory ?? ".", "package.json");
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as {
      readonly scripts?: Readonly<Record<string, string>>;
    };
    if (packageJson.scripts?.[script] === undefined)
      findings.push(`${recipe.id}: focused gate is not live ${command}`);
  }
}

function checkSemanticAvailability(
  recipe: OutcomeRecipe,
  semantics: ReadonlyMap<string, (typeof WORKFLOW_SEMANTICS)[number]>,
  findings: string[],
): void {
  if (recipe.availability.status !== "unavailable") return;
  const rules = recipe.availability.requiredSemanticPrimitives.map((id) =>
    semantics.get(id),
  );
  if (rules.some((rule) => rule === undefined))
    findings.push(
      `${recipe.id}: availability names an unknown semantic primitive`,
    );
  if (rules.every((rule) => rule?.status === "supported"))
    findings.push(
      `${recipe.id}: unavailable posture is stale; every primitive is supported`,
    );
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : "unknown recipe validation failure";

if (isDirectRun(import.meta.url)) {
  const findings = checkRecipes(process.cwd());
  if (findings.length === 0) console.log("check:recipes: ok");
  else {
    for (const finding of findings) console.error(`check:recipes: ${finding}`);
    process.exitCode = 1;
  }
}
