import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { format } from "prettier";
import {
  buildContractManifest,
  buildContractJsonSchemas,
  duplicateOperationIds,
  mergeContractSchemaRegistries,
  missingSchemasForManifest,
} from "./index";
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

const generatedRefModules: Readonly<Record<string, string>> = {
  "brain.pages": "packages/convex/convex/brain/pages.ts",
  "capabilities.sourceGroundedBrief":
    "packages/convex/convex/capabilities/sourceGroundedBrief.ts",
  "ops.dataLifecycle": "packages/convex/convex/ops/dataLifecycle.ts",
  "ops.email": "packages/convex/convex/ops/email.ts",
};

const escapeRegExp = (input: string): string =>
  input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const missingGeneratedRefs = manifest.functions.flatMap((entry) => {
  const modulePath = generatedRefModules[entry.namespace];
  if (modulePath === undefined) {
    return [`${entry.operationId} (no generated ref module configured)`];
  }

  const moduleSource = readFileSync(resolve(modulePath), "utf8");
  const exportPattern = new RegExp(
    `export\\s+const\\s+${escapeRegExp(entry.name)}\\s*=`,
  );

  return exportPattern.test(moduleSource) ? [] : [entry.operationId];
});

if (missingGeneratedRefs.length > 0) {
  throw new Error(
    `Confect manifest operations must have generated Convex refs. Run pnpm confect:codegen. Missing: ${missingGeneratedRefs.join(", ")}`,
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
