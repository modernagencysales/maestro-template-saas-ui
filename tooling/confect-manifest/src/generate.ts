import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";
import {
  buildContractManifest,
  buildContractJsonSchemas,
  duplicateOperationIds,
  mergeContractSchemaRegistries,
  missingSchemasForManifest,
  type ContractFunctionManifest,
  type ContractSchemaRegistry,
} from "./index";
import {
  discoverReviewedContractSpecs,
  generatedRefModuleForSpec,
  missingGeneratedRefs,
} from "./specClosure";
import {
  manifest as sourceGroundedBriefManifest,
  schemaRegistry as sourceGroundedBriefSchemaRegistry,
} from "../../../packages/convex/confect/capabilities/sourceGroundedBrief.spec";
import {
  manifest as brainPagesManifest,
  schemaRegistry as brainPagesSchemaRegistry,
} from "../../../packages/convex/confect/brain/pages.spec";
import {
  manifest as dataLifecycleManifest,
  schemaRegistry as dataLifecycleSchemaRegistry,
} from "../../../packages/convex/confect/ops/dataLifecycle.spec";
import {
  manifest as emailManifest,
  schemaRegistry as emailSchemaRegistry,
} from "../../../packages/convex/confect/ops/email.spec";

const root = resolve(".");
const inventoryContractSpecs = await Promise.all(
  discoverReviewedContractSpecs(root).map(async (path) => {
    const loaded = (await import(pathToFileURL(resolve(root, path)).href)) as {
      readonly manifest?: readonly ContractFunctionManifest[];
      readonly schemaRegistry?: ContractSchemaRegistry;
    };
    if (!Array.isArray(loaded.manifest) || loaded.schemaRegistry === undefined)
      throw new Error(`Confect contract spec exports are invalid: ${path}`);
    return {
      path,
      manifest: loaded.manifest,
      schemaRegistry: loaded.schemaRegistry,
    };
  }),
);

const inventoryFunctions = inventoryContractSpecs.flatMap(
  ({ manifest }) => manifest,
);
const inventorySchemaRegistry = mergeContractSchemaRegistries(
  ...inventoryContractSpecs.map(({ schemaRegistry: registry }) => registry),
);
const inventoryDuplicateIds = duplicateOperationIds(inventoryFunctions);
if (inventoryDuplicateIds.length > 0)
  throw new Error(
    `Confect inventory operation ids must be unique: ${inventoryDuplicateIds.join(", ")}`,
  );
const inventoryManifest = buildContractManifest(inventoryFunctions);
const inventoryMissingSchemas = missingSchemasForManifest(
  inventoryManifest,
  inventorySchemaRegistry,
);
if (inventoryMissingSchemas.length > 0)
  throw new Error(
    `Confect inventory references schemas missing from registries: ${inventoryMissingSchemas.join(", ")}`,
  );

const functions = [
  ...brainPagesManifest,
  ...sourceGroundedBriefManifest,
  ...dataLifecycleManifest,
  ...emailManifest,
];
const schemaRegistry = mergeContractSchemaRegistries(
  brainPagesSchemaRegistry,
  sourceGroundedBriefSchemaRegistry,
  dataLifecycleSchemaRegistry,
  emailSchemaRegistry,
);

const duplicateIds = duplicateOperationIds(functions);
if (duplicateIds.length > 0) {
  throw new Error(
    `Confect manifest operation ids must be unique: ${duplicateIds.join(", ")}`,
  );
}

const manifest = buildContractManifest(functions);

const entriesMissingSchemaNames = manifest.functions.flatMap((entry) => [
  ...(entry.argsSchemaName.length > 0
    ? []
    : [`${entry.operationId} (argsSchemaName)`]),
  ...(entry.returnsSchemaName.length > 0
    ? []
    : [`${entry.operationId} (returnsSchemaName)`]),
]);
if (entriesMissingSchemaNames.length > 0) {
  throw new Error(
    `Confect manifest operations must declare schema names: ${entriesMissingSchemaNames.join(", ")}`,
  );
}

const missingSchemas = missingSchemasForManifest(manifest, schemaRegistry);
if (missingSchemas.length > 0) {
  throw new Error(
    `Confect manifest references schemas missing from registries: ${missingSchemas.join(", ")}`,
  );
}

const specPathByOperationId = new Map(
  inventoryContractSpecs.flatMap(({ path, manifest: specManifest }) =>
    specManifest.map((entry) => [entry.operationId, path] as const),
  ),
);
const missingRefs = missingGeneratedRefs(
  root,
  inventoryManifest.functions.map((entry) => {
    const specPath = specPathByOperationId.get(entry.operationId);
    if (specPath === undefined)
      throw new Error(
        `Confect operation has no source spec: ${entry.operationId}`,
      );
    return {
      specPath,
      operationId: entry.operationId,
      name: entry.name,
    };
  }),
);

if (missingRefs.length > 0) {
  throw new Error(
    `Confect manifest operations must have generated Convex refs. Run pnpm confect:codegen. Missing: ${missingRefs.join(", ")}`,
  );
}

const jsonSchemas = buildContractJsonSchemas(schemaRegistry);

const jsonSource = (value: unknown): string => JSON.stringify(value, null, 2);

const schemaMapSource = (
  constName: string,
  schemas: Readonly<Record<string, unknown>>,
): string => {
  const duplicateSchemaValues = new Map<string, string>();
  const schemaValueCounts = new Map<string, number>();

  for (const value of Object.values(schemas)) {
    const source = jsonSource(value);
    schemaValueCounts.set(source, (schemaValueCounts.get(source) ?? 0) + 1);
  }

  const duplicateDeclarations = [...schemaValueCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([source], index) => {
      const duplicateConstName = `${constName}Value${index + 1}`;
      duplicateSchemaValues.set(source, duplicateConstName);
      return `const ${duplicateConstName} = ${source} as const;`;
    });

  const properties = Object.entries(schemas).map(([name, value]) => {
    const valueSource = jsonSource(value);
    return `${JSON.stringify(name)}: ${duplicateSchemaValues.get(valueSource) ?? valueSource}`;
  });

  return `${duplicateDeclarations.join("\n\n")}${duplicateDeclarations.length > 0 ? "\n\n" : ""}const ${constName} = {\n${properties.join(",\n")},\n} as const;`;
};

const jsonSchemasSource =
  JSON.stringify(jsonSchemas.openApi31) === JSON.stringify(jsonSchemas.mcp)
    ? `${schemaMapSource("sharedConfectJsonSchemas", jsonSchemas.openApi31)}\n\nexport const confectJsonSchemas = {\n  openApi31: sharedConfectJsonSchemas,\n  mcp: sharedConfectJsonSchemas,\n} as const;`
    : `${schemaMapSource("openApi31ConfectJsonSchemas", jsonSchemas.openApi31)}\n\n${schemaMapSource("mcpConfectJsonSchemas", jsonSchemas.mcp)}\n\nexport const confectJsonSchemas = {\n  openApi31: openApi31ConfectJsonSchemas,\n  mcp: mcpConfectJsonSchemas,\n} as const;`;

const target = resolve(
  "packages/template-core/src/generated/confectManifest.ts",
);
mkdirSync(dirname(target), { recursive: true });
const generated = await format(
  `/* Generated by pnpm confect:manifest. Do not edit by hand. */\n\nexport const confectManifest = ${JSON.stringify(manifest, null, 2)} as const;\n\n${jsonSchemasSource}\n\nexport type ConfectManifest = typeof confectManifest;\n`,
  { parser: "typescript" },
);

writeFileSync(target, generated);

const sha256 = (value: string | Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const inventoryOperationIds = inventoryManifest.functions.map(
  ({ operationId }) => operationId,
);
const runtimeOperationIds = manifest.functions.map(
  ({ operationId }) => operationId,
);
const runtimeOperationIdSet = new Set(runtimeOperationIds);
const inventoryOperationIdSet = new Set(inventoryOperationIds);
const inventoryFunctionsWithProvenance = inventoryManifest.functions.map(
  (entry) => {
    const sourceSpec = specPathByOperationId.get(entry.operationId);
    if (sourceSpec === undefined)
      throw new Error(
        `Confect inventory operation has no source spec: ${entry.operationId}`,
      );
    const modulePath = generatedRefModuleForSpec(sourceSpec)
      .replace(/^packages\/convex\/convex\//u, "")
      .replace(/\.ts$/u, "");
    return {
      ...entry,
      sourceSpec,
      generatedRefLocator: `${modulePath}:${entry.name}`,
    };
  },
);
const inventoryTarget = resolve(
  "packages/convex/confect/_generated/confectManifest.inventory.ts",
);
const inventorySource = await format(
  `/* Generated by pnpm confect:manifest for controller inventory only. Do not import from runtime code. */\n\nexport const confectInventoryManifest = ${JSON.stringify(
    {
      ...inventoryManifest,
      functions: inventoryFunctionsWithProvenance,
    },
    null,
    2,
  )} as const;\n\nexport type ConfectInventoryManifest = typeof confectInventoryManifest;\n`,
  { parser: "typescript" },
);
const inventoryDigestTarget = resolve(
  "packages/convex/confect/_generated/confectManifest.inventory.digest.json",
);
const inventoryDigest = {
  schemaVersion: 1,
  generator: "pnpm confect:manifest",
  sourceSpecs: inventoryContractSpecs.map(({ path }) => ({
    path,
    sha256: sha256(readFileSync(resolve(root, path))),
  })),
  runtimeOperationIds,
  inventoryOperationIds,
  addedOperationIds: inventoryOperationIds.filter(
    (operationId) => !runtimeOperationIdSet.has(operationId),
  ),
  removedOperationIds: runtimeOperationIds.filter(
    (operationId) => !inventoryOperationIdSet.has(operationId),
  ),
  outputs: [
    {
      path: "packages/template-core/src/generated/confectManifest.ts",
      sha256: sha256(generated),
    },
    {
      path: "packages/convex/confect/_generated/confectManifest.inventory.ts",
      sha256: sha256(inventorySource),
    },
  ],
} as const;
mkdirSync(dirname(inventoryTarget), { recursive: true });
writeFileSync(inventoryTarget, inventorySource);
writeFileSync(
  inventoryDigestTarget,
  `${JSON.stringify(inventoryDigest, null, 2)}\n`,
);
