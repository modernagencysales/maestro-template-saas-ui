import * as JsonSchema from "effect/JsonSchema";
import * as Schema from "effect/Schema";

export type ContractFunctionKind = "query" | "mutation" | "action";
export type ContractSurface =
  "api" | "cli" | "mcp" | "web" | "workflow" | "internal";

export type ContractFunctionManifest = {
  readonly namespace: string;
  readonly name: string;
  readonly operationId: string;
  readonly kind: ContractFunctionKind;
  readonly surfaces: readonly ContractSurface[];
  readonly typedErrors: readonly string[];
  readonly idempotent: boolean;
  readonly argsSchemaName: string;
  readonly returnsSchemaName: string;
};

export type ContractManifest = {
  readonly version: 1;
  readonly generatedAt: string;
  readonly functions: readonly ContractFunctionManifest[];
};

export type ContractSchemaRegistry = Readonly<
  Record<string, Schema.Constraint>
>;

export type ContractJsonSchemas = {
  readonly openApi31: Readonly<Record<string, unknown>>;
  readonly mcp: Readonly<Record<string, unknown>>;
};

const flattenJsonSchemaDocument = (
  document: JsonSchema.Document<"draft-2020-12">,
): Readonly<Record<string, unknown>> => ({
  $schema: JsonSchema.META_SCHEMA_URI_DRAFT_2020_12,
  ...document.schema,
  ...(Object.keys(document.definitions).length === 0
    ? {}
    : { $defs: document.definitions }),
});

const toOpenApi31CompatibleDocument = (
  document: JsonSchema.Document<"draft-2020-12">,
): JsonSchema.Document<"draft-2020-12"> => {
  const converted = JsonSchema.toMultiDocumentOpenApi3_1({
    dialect: "draft-2020-12",
    schemas: [document.schema],
    definitions: document.definitions,
  });
  return {
    dialect: "draft-2020-12",
    schema: JsonSchema.fromSchemaOpenApi3_1(converted.schemas[0]).schema,
    definitions: Object.fromEntries(
      Object.entries(converted.definitions).map(([name, schema]) => [
        name,
        JsonSchema.fromSchemaOpenApi3_1(schema).schema,
      ]),
    ),
  };
};

export const buildContractManifest = (
  functions: readonly ContractFunctionManifest[],
  generatedAt = "1970-01-01T00:00:00.000Z",
): ContractManifest => ({
  version: 1,
  generatedAt,
  functions: [...functions].sort((left, right) =>
    left.operationId.localeCompare(right.operationId),
  ),
});

export const manifestOperationIds = (
  manifest: ContractManifest,
): readonly string[] => manifest.functions.map((entry) => entry.operationId);

export const duplicateOperationIds = (
  functions: readonly ContractFunctionManifest[],
): readonly string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const entry of functions) {
    if (seen.has(entry.operationId)) {
      duplicates.add(entry.operationId);
      continue;
    }

    seen.add(entry.operationId);
  }

  return [...duplicates].sort((left, right) => left.localeCompare(right));
};

export const mergeContractSchemaRegistries = (
  ...registries: readonly ContractSchemaRegistry[]
): ContractSchemaRegistry => Object.assign({}, ...registries);

export const buildContractJsonSchemas = (
  schemaRegistry: ContractSchemaRegistry,
): ContractJsonSchemas => {
  const registryEntries = Object.entries(schemaRegistry).sort(
    ([left], [right]) => left.localeCompare(right),
  );

  return {
    openApi31: Object.fromEntries(
      registryEntries.map(([name, schema]) => [
        name,
        flattenJsonSchemaDocument(
          toOpenApi31CompatibleDocument(Schema.toJsonSchemaDocument(schema)),
        ),
      ]),
    ),
    mcp: Object.fromEntries(
      registryEntries.map(([name, schema]) => [
        name,
        flattenJsonSchemaDocument(Schema.toJsonSchemaDocument(schema)),
      ]),
    ),
  };
};

export const missingSchemasForManifest = (
  manifest: ContractManifest,
  schemaRegistry: ContractSchemaRegistry,
): readonly string[] => {
  const missing = new Set<string>();

  for (const entry of manifest.functions) {
    if (!(entry.argsSchemaName in schemaRegistry)) {
      missing.add(entry.argsSchemaName);
    }

    if (!(entry.returnsSchemaName in schemaRegistry)) {
      missing.add(entry.returnsSchemaName);
    }
  }

  return [...missing].sort((left, right) => left.localeCompare(right));
};
