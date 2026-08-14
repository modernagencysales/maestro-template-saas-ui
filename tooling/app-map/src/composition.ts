import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseDataResourceCatalog } from "@maestro-template/template-core/dataResourceCatalog";
import { parseProductTopology } from "@maestro-template/template-core/productTopology";
import { parseSystemCatalog } from "@maestro-template/template-core/systemCatalog";
import { parseTemplateInstanceText } from "@maestro-template/template-core/templateInstance";
import ts from "typescript";
import { parse as parseYaml } from "yaml";
import { buildAppMap } from "./build";
import { isExactGitRevision } from "./gitDiff";
import {
  APP_MAP_INPUT_MANIFEST_V1,
  groupForNodeKind,
  type AppMapBuildInputV1,
  type AppMapBuildResult,
  type AppMapEdgeV1,
  type AppMapFactBatchV1,
  type AppMapInputManifestEntryV1,
  type AppMapNodeKind,
  type AppMapNodeV1,
  type AppMapProvenanceV1,
  type AppMapReviewedGenerationV1,
} from "./schema";

const run = promisify(execFile);
const compare = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const digest = (bytes: string | Buffer): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

export type AppMapCompositionRequest = {
  readonly repoRoot: string;
  readonly revision: string;
  readonly generatedSourceOverrides?: readonly AppMapGeneratedSourceOverrideV1[];
};
export type AppMapGeneratedSourceOverrideV1 = {
  readonly sourceId: "template-instance";
  readonly sourcePath: "template-instance.json";
  readonly bytes: string;
  readonly bytesDigest: string;
  readonly generation: AppMapReviewedGenerationV1;
};
export type AppMapCompositionResult =
  | {
      readonly ok: true;
      readonly input: AppMapBuildInputV1;
      readonly build: Extract<AppMapBuildResult, { readonly ok: true }>;
    }
  | {
      readonly ok: false;
      readonly code: "APP_MAP_COMPOSITION_INVALID";
      readonly message: string;
    };

type SourceBytes = {
  readonly bytes: string;
  readonly digest: string;
  readonly treeFiles?: Readonly<Record<string, string>>;
  readonly generation?: AppMapReviewedGenerationV1;
};

const git = async (
  repoRoot: string,
  args: readonly string[],
  encoding: BufferEncoding = "utf8",
): Promise<string> => {
  const result = await run("git", [...args], {
    cwd: repoRoot,
    maxBuffer: 32 * 1024 * 1024,
    encoding,
  });
  return result.stdout;
};

const readCanonicalSource = async (
  request: AppMapCompositionRequest,
  entry: AppMapInputManifestEntryV1,
): Promise<SourceBytes> => {
  if (entry.source.digestContract === "sha256-file-bytes-v1") {
    const bytes = await git(request.repoRoot, [
      "show",
      `${request.revision}:${entry.source.path}`,
    ]);
    return { bytes, digest: digest(bytes) };
  }
  const listing = await git(request.repoRoot, [
    "ls-tree",
    "-r",
    "--name-only",
    request.revision,
    "--",
    entry.source.path,
  ]);
  const paths = listing.split("\n").filter(Boolean).sort(compare);
  const treeFiles = Object.fromEntries(
    await Promise.all(
      paths.map(
        async (path) =>
          [
            path,
            await git(request.repoRoot, [
              "show",
              `${request.revision}:${path}`,
            ]),
          ] as const,
      ),
    ),
  );
  const records = paths.map((path) => ({
    path,
    digest: digest(treeFiles[path] ?? ""),
  }));
  const bytes = `${JSON.stringify(records)}\n`;
  return { bytes, digest: digest(bytes), treeFiles };
};
const readSource = async (
  request: AppMapCompositionRequest,
  entry: AppMapInputManifestEntryV1,
): Promise<SourceBytes> => {
  const overrides = request.generatedSourceOverrides ?? [];
  const override = overrides.find(
    ({ sourceId }) => sourceId === entry.source.id,
  );
  if (!override) return readCanonicalSource(request, entry);
  if (
    JSON.stringify(Object.keys(override).sort()) !==
      JSON.stringify([
        "bytes",
        "bytesDigest",
        "generation",
        "sourceId",
        "sourcePath",
      ]) ||
    JSON.stringify(Object.keys(override.generation).sort()) !==
      JSON.stringify([
        "blueprintId",
        "blueprintManifestDigest",
        "blueprintPlanDigest",
        "blueprintProvenance",
        "kind",
        "sourceRevision",
      ]) ||
    override.sourceId !== "template-instance" ||
    entry.source.id !== "template-instance" ||
    override.sourcePath !== entry.source.path ||
    override.bytesDigest !== digest(override.bytes) ||
    override.generation.kind !== "release-blueprint-template-instance-facts" ||
    override.generation.sourceRevision !== request.revision ||
    !/^sha256:[a-f0-9]{64}$/u.test(override.generation.blueprintPlanDigest) ||
    !/^sha256:[a-f0-9]{64}$/u.test(override.generation.blueprintManifestDigest)
  )
    throw new Error("Reviewed generated App Map source override is invalid.");
  const value = JSON.parse(override.bytes) as unknown;
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    JSON.stringify(Object.keys(value).sort()) !==
      JSON.stringify([
        "blueprint",
        "kind",
        "schemaVersion",
        "sourceRevision",
        "support",
      ]) ||
    Reflect.get(value, "schemaVersion") !== 1 ||
    Reflect.get(value, "kind") !== override.generation.kind ||
    Reflect.get(value, "sourceRevision") !== request.revision
  )
    throw new Error("Reviewed generated template-instance facts are invalid.");
  const blueprint = Reflect.get(value, "blueprint") as unknown;
  const support = Reflect.get(value, "support") as unknown;
  if (
    typeof blueprint !== "object" ||
    blueprint === null ||
    Array.isArray(blueprint) ||
    JSON.stringify(Object.keys(blueprint).sort()) !==
      JSON.stringify(["id", "manifestDigest", "planDigest", "provenance"]) ||
    Reflect.get(blueprint, "id") !== override.generation.blueprintId ||
    Reflect.get(blueprint, "provenance") !==
      override.generation.blueprintProvenance ||
    Reflect.get(blueprint, "planDigest") !==
      override.generation.blueprintPlanDigest ||
    Reflect.get(blueprint, "manifestDigest") !==
      override.generation.blueprintManifestDigest ||
    typeof support !== "object" ||
    support === null ||
    Array.isArray(support) ||
    JSON.stringify(Object.keys(support)) !== JSON.stringify(["state"]) ||
    Reflect.get(support, "state") !== "supported"
  )
    throw new Error("Reviewed generated template-instance facts mismatch.");
  return {
    bytes: override.bytes,
    digest: override.bytesDigest,
    generation: override.generation,
  };
};

const sourceDescriptor = (
  entry: AppMapInputManifestEntryV1,
  revision: string,
  source: SourceBytes,
) => ({
  id: entry.source.id,
  kind: entry.source.kind,
  path: entry.source.path,
  subject: entry.source.subject,
  owner: entry.source.owner,
  digestContract: entry.source.digestContract,
  version: revision,
  digest: source.digest,
  ...(source.generation === undefined ? {} : { generation: source.generation }),
});
const provenance = (
  entry: AppMapInputManifestEntryV1,
  revision: string,
  sourceDigest: string,
  factId: string,
): AppMapProvenanceV1 => ({
  authority: "canonical",
  sourceId: entry.source.id,
  sourcePath: entry.source.path,
  sourceVersion: revision,
  sourceDigest,
  factId,
});
const node = (
  entry: AppMapInputManifestEntryV1,
  revision: string,
  sourceDigest: string,
  value: {
    readonly id: string;
    readonly kind: AppMapNodeKind;
    readonly label: string;
    readonly version?: string;
  },
): AppMapNodeV1 => ({
  id: value.id,
  kind: value.kind,
  group: groupForNodeKind(value.kind),
  label: value.label,
  version: value.version ?? "1",
  provenance: provenance(entry, revision, sourceDigest, `node:${value.id}`),
});
const edge = (
  entry: AppMapInputManifestEntryV1,
  revision: string,
  sourceDigest: string,
  value: Omit<AppMapEdgeV1, "provenance">,
): AppMapEdgeV1 => ({
  ...value,
  provenance: provenance(entry, revision, sourceDigest, `edge:${value.id}`),
});

const unwrapExpression = (value: ts.Expression): ts.Expression => {
  let current = value;
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current)
  )
    current = current.expression;
  return current;
};
const literalValue = (value: ts.Expression): unknown => {
  const expression = unwrapExpression(value);
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  )
    return expression.text;
  if (ts.isNumericLiteral(expression)) return Number(expression.text);
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (expression.kind === ts.SyntaxKind.NullKeyword) return null;
  if (
    ts.isPrefixUnaryExpression(expression) &&
    ts.isNumericLiteral(expression.operand)
  )
    return expression.operator === ts.SyntaxKind.MinusToken
      ? -Number(expression.operand.text)
      : Number(expression.operand.text);
  if (ts.isArrayLiteralExpression(expression))
    return expression.elements.map((item) =>
      literalValue(item as ts.Expression),
    );
  if (ts.isObjectLiteralExpression(expression)) {
    const output: Record<string, unknown> = {};
    for (const property of expression.properties) {
      if (!ts.isPropertyAssignment(property))
        throw new Error(
          "Canonical TypeScript object contains a non-literal property.",
        );
      const name = property.name;
      const key =
        ts.isIdentifier(name) ||
        ts.isStringLiteral(name) ||
        ts.isNumericLiteral(name)
          ? name.text
          : undefined;
      if (!key)
        throw new Error(
          "Canonical TypeScript object contains a computed property.",
        );
      output[key] = literalValue(property.initializer);
    }
    return output;
  }
  throw new Error(
    "Canonical TypeScript artifact contains a non-literal value.",
  );
};
const sourceFile = (bytes: string): ts.SourceFile =>
  ts.createSourceFile("canonical.ts", bytes, ts.ScriptTarget.Latest, true);
const exportedConst = (bytes: string, name: string): unknown => {
  for (const statement of sourceFile(bytes).statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === name &&
        declaration.initializer
      )
        return literalValue(declaration.initializer);
    }
  }
  throw new Error(`Canonical TypeScript export ${name} was not found.`);
};
const record = (value: unknown): Readonly<Record<string, unknown>> => {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("Canonical record is invalid.");
  return value as Readonly<Record<string, unknown>>;
};
const text = (value: unknown): string => {
  if (typeof value !== "string" || value.length === 0)
    throw new Error("Canonical text is invalid.");
  return value;
};
const array = (value: unknown): readonly unknown[] => {
  if (!Array.isArray(value)) throw new Error("Canonical array is invalid.");
  return value;
};
const kebab = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replaceAll("_", "-")
    .toLowerCase();
const capabilityProjectionId = (
  operationId: string,
  topologyResourceIds: ReadonlySet<string>,
): string | undefined => {
  const namespace = operationId.split(".").slice(0, -1);
  if (namespace[0] !== "capabilities" || namespace.length !== 2)
    return undefined;
  const candidate = `capability:${kebab(namespace[1] as string)}`;
  return topologyResourceIds.has(candidate) ? candidate : undefined;
};
const headlessProjectionIds = (
  surfaces: readonly unknown[],
  topologyResourceIds: ReadonlySet<string>,
): readonly string[] => {
  const candidates = new Set<string>();
  for (const surface of surfaces) {
    if (surface === "mcp") candidates.add("headless:mcp");
    if (surface === "api") candidates.add("headless:openapi");
    if (surface === "workflow" || surface === "internal")
      candidates.add("headless:executor");
  }
  return [...candidates]
    .filter((id) => topologyResourceIds.has(id))
    .sort(compare);
};
const operationRecords = (
  bytes: string,
): readonly Readonly<Record<string, unknown>>[] => {
  const manifest = record(exportedConst(bytes, "confectManifest"));
  if (manifest.version !== 1)
    throw new Error("Canonical Confect manifest is invalid.");
  return array(manifest.functions).map(record);
};
const workflowRegistryEntries = (
  bytes: string,
): readonly {
  readonly kind: "workflow" | "capability";
  readonly local: string;
  readonly path: string;
}[] => {
  const file = sourceFile(bytes);
  const imports = new Map<string, string>();
  for (const statement of file.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    )
      continue;
    const bindings = statement.importClause?.namedBindings;
    for (const item of bindings && ts.isNamedImports(bindings)
      ? bindings.elements
      : [])
      imports.set(item.name.text, statement.moduleSpecifier.text);
  }
  const output: {
    kind: "workflow" | "capability";
    local: string;
    path: string;
  }[] = [];
  let registryFound = false;
  const visit = (nodeValue: ts.Node): void => {
    if (
      ts.isCallExpression(nodeValue) &&
      ts.isIdentifier(nodeValue.expression) &&
      nodeValue.expression.text === "definePublicationRegistry"
    ) {
      registryFound = true;
      const config = nodeValue.arguments[0];
      if (!config || !ts.isObjectLiteralExpression(config))
        throw new Error("Workflow registry config is invalid.");
      for (const property of config.properties) {
        if (
          !ts.isPropertyAssignment(property) ||
          !ts.isIdentifier(property.name) ||
          !ts.isArrayLiteralExpression(property.initializer)
        )
          continue;
        const kind =
          property.name.text === "workflows"
            ? "workflow"
            : property.name.text === "capabilities"
              ? "capability"
              : undefined;
        if (!kind) continue;
        for (const item of property.initializer.elements) {
          if (!ts.isIdentifier(item) || !imports.has(item.text))
            throw new Error("Workflow registry entry is invalid.");
          output.push({
            kind,
            local: item.text,
            path: imports.get(item.text) as string,
          });
        }
      }
    }
    ts.forEachChild(nodeValue, visit);
  };
  visit(file);
  if (!registryFound) throw new Error("Workflow registry is missing.");
  return output.sort((left, right) => compare(left.local, right.local));
};
const routePaths = (bytes: string): readonly string[] => {
  const fullPaths = new Set<string>();
  const updatePaths = new Set<string>();
  const visit = (value: ts.Node): void => {
    if (
      ts.isPropertySignature(value) &&
      ts.isIdentifier(value.name) &&
      value.name.text === "fullPath" &&
      value.type &&
      ts.isLiteralTypeNode(value.type) &&
      ts.isStringLiteral(value.type.literal) &&
      value.type.literal.text !== "/"
    )
      fullPaths.add(value.type.literal.text);
    if (
      ts.isCallExpression(value) &&
      ts.isPropertyAccessExpression(value.expression) &&
      value.expression.name.text === "update"
    ) {
      const config = value.arguments[0];
      const configObject = config ? unwrapExpression(config) : undefined;
      if (configObject && ts.isObjectLiteralExpression(configObject)) {
        const pathProperty = configObject.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === "path",
        );
        if (
          pathProperty &&
          ts.isStringLiteral(pathProperty.initializer) &&
          pathProperty.initializer.text !== "/"
        )
          updatePaths.add(pathProperty.initializer.text);
      }
    }
    ts.forEachChild(value, visit);
  };
  visit(sourceFile(bytes));
  const paths = fullPaths.size > 0 ? fullPaths : updatePaths;
  if (paths.size === 0)
    throw new Error("Canonical route tree has no application routes.");
  return [...paths].sort(compare);
};
const workflowSemanticRules = (
  bytes: string,
): readonly {
  readonly id: string;
  readonly subject: string;
  readonly status: string;
}[] => {
  const rows = bytes
    .split("\n")
    .filter((line) => line.startsWith("| WF-"))
    .map((line) =>
      line
        .split("|")
        .slice(1, 4)
        .map((cell) => cell.trim().replaceAll("`", "")),
    )
    .map(([id, subject, status]) => ({
      id: text(id),
      subject: text(subject),
      status: text(status),
    }));
  if (rows.length === 0) throw new Error("Workflow semantics are empty.");
  return rows;
};

const factsFor = (
  entry: AppMapInputManifestEntryV1,
  revision: string,
  source: SourceBytes,
  topologyResourceIds: ReadonlySet<string>,
): {
  readonly nodes: readonly AppMapNodeV1[];
  readonly edges: readonly AppMapEdgeV1[];
} => {
  if (entry.source.id === "system-catalog") {
    const catalog = parseSystemCatalog(JSON.parse(source.bytes) as unknown);
    return {
      nodes: catalog.systems.map((system) =>
        node(entry, revision, source.digest, {
          id: `system:${system.id}`,
          kind: "system",
          label: system.name,
        }),
      ),
      edges: [],
    };
  }
  if (entry.source.id === "product-topology") {
    const topology = parseProductTopology(JSON.parse(source.bytes) as unknown);
    const kind = (
      value: (typeof topology.resources)[number]["kind"],
    ): AppMapNodeKind =>
      value === "headless"
        ? "headless-operation"
        : value === "job"
          ? "capability"
          : value;
    return {
      nodes: topology.resources
        .filter((resource) => resource.kind !== "route")
        .map((resource) =>
          node(entry, revision, source.digest, {
            id: resource.id,
            kind: kind(resource.kind),
            label: resource.responsibility,
            version: resource.lifecycle,
          }),
        ),
      edges: topology.resources.flatMap((resource) => [
        edge(entry, revision, source.digest, {
          id: `owns:system:${resource.system}->${resource.id}`,
          kind: "owns",
          from: `system:${resource.system}`,
          to: resource.id,
        }),
        ...resource.uses.map((dependency) =>
          edge(entry, revision, source.digest, {
            id: `depends-on:${resource.id}->system:${dependency}`,
            kind: "depends-on",
            from: resource.id,
            to: `system:${dependency}`,
          }),
        ),
      ]),
    };
  }
  if (entry.source.id === "data-resources") {
    const catalog = parseDataResourceCatalog(
      JSON.parse(source.bytes) as unknown,
    );
    return {
      nodes: catalog.resources.map((resource) =>
        node(entry, revision, source.digest, {
          id: `table:${resource.id}`,
          kind: "table",
          label: resource.detail,
        }),
      ),
      edges: catalog.resources.map((resource) =>
        edge(entry, revision, source.digest, {
          id: `owns:system:${resource.system}->table:${resource.id}`,
          kind: "owns",
          from: `system:${resource.system}`,
          to: `table:${resource.id}`,
        }),
      ),
    };
  }
  if (entry.source.id === "confect-contracts") {
    const operations = operationRecords(source.bytes);
    const relations = new Map<string, AppMapEdgeV1>();
    for (const operation of operations) {
      const operationId = text(operation.operationId);
      const capabilityId = capabilityProjectionId(
        operationId,
        topologyResourceIds,
      );
      if (!capabilityId) continue;
      for (const headlessId of headlessProjectionIds(
        array(operation.surfaces),
        topologyResourceIds,
      )) {
        const id = `exposes:${capabilityId}->${headlessId}`;
        relations.set(
          id,
          edge(entry, revision, source.digest, {
            id,
            kind: "exposes",
            from: capabilityId,
            to: headlessId,
          }),
        );
      }
    }
    return {
      nodes: [],
      edges: [...relations.values()].sort((left, right) =>
        compare(left.id, right.id),
      ),
    };
  }
  if (entry.source.id === "workflow-registry") {
    const registry = workflowRegistryEntries(source.bytes);
    const workflows = registry.filter((item) => item.kind === "workflow");
    const logicalName = (local: string): string =>
      local.replace(/V[0-9]+Release$/, "").replace(/Release$/, "");
    const version = (local: string): string =>
      local.match(/V([0-9]+)Release$/)?.[1] ?? "1";
    return {
      nodes: [
        ...workflows.flatMap((item) => {
          const name = logicalName(item.local);
          return [
            node(entry, revision, source.digest, {
              id: `workflow-publication:${name}`,
              kind: "workflow",
              label: name,
            }),
            node(entry, revision, source.digest, {
              id: `workflow-publication:${name}:v${version(item.local)}`,
              kind: "workflow-version",
              label: `${name} v${version(item.local)}`,
              version: version(item.local),
            }),
          ];
        }),
      ],
      edges: [
        ...workflows.flatMap((item) => {
          const name = logicalName(item.local);
          const workflowId = `workflow-publication:${name}`;
          const versionId = `${workflowId}:v${version(item.local)}`;
          return [
            edge(entry, revision, source.digest, {
              id: `owns:system:workflow-runtime->${workflowId}`,
              kind: "owns",
              from: "system:workflow-runtime",
              to: workflowId,
            }),
            edge(entry, revision, source.digest, {
              id: `owns:system:workflow-runtime->${versionId}`,
              kind: "owns",
              from: "system:workflow-runtime",
              to: versionId,
            }),
            edge(entry, revision, source.digest, {
              id: `depends-on:${versionId}->${workflowId}`,
              kind: "depends-on",
              from: versionId,
              to: workflowId,
            }),
          ];
        }),
      ],
    };
  }
  if (entry.source.id === "workflow-semantics") {
    const rules = workflowSemanticRules(source.bytes);
    return {
      nodes: rules.map((rule) =>
        node(entry, revision, source.digest, {
          id: `semantic-rule:${rule.id}`,
          kind: "semantic-rule",
          label: `${rule.id}: ${rule.subject}`,
          version: rule.status,
        }),
      ),
      edges: [],
    };
  }
  if (entry.source.id === "route-tree") {
    return {
      nodes: routePaths(source.bytes).map((path) =>
        node(entry, revision, source.digest, {
          id: `route:${path.slice(1)}`,
          kind: "route",
          label: path,
        }),
      ),
      edges: routePaths(source.bytes).map((path) =>
        edge(entry, revision, source.digest, {
          id: `generated-by:route:${path.slice(1)}->package:apps/web`,
          kind: "generated-by",
          from: `route:${path.slice(1)}`,
          to: "package:apps/web",
        }),
      ),
    };
  }
  if (entry.source.id === "headless-registry") {
    const operations = operationRecords(source.bytes);
    const relations = new Map<string, AppMapEdgeV1>();
    for (const operation of operations) {
      const operationId = text(operation.operationId);
      const capabilityId = capabilityProjectionId(
        operationId,
        topologyResourceIds,
      );
      if (!capabilityId) continue;
      for (const headlessId of headlessProjectionIds(
        array(operation.surfaces),
        topologyResourceIds,
      )) {
        const id = `projects:${headlessId}->${capabilityId}`;
        relations.set(
          id,
          edge(entry, revision, source.digest, {
            id,
            kind: "projects",
            from: headlessId,
            to: capabilityId,
          }),
        );
      }
    }
    return {
      nodes: [],
      edges: [...relations.values()].sort((left, right) =>
        compare(left.id, right.id),
      ),
    };
  }
  if (entry.source.id === "workspace-metadata") {
    const lock = record(parseYaml(source.bytes));
    const importers = record(lock.importers);
    const importerIds = Object.keys(importers).sort(compare);
    if (importerIds.length === 0)
      throw new Error("Canonical workspace lockfile has no importers.");
    return {
      nodes: importerIds.map((importer) =>
        node(entry, revision, source.digest, {
          id: `package:${importer === "." ? "workspace" : importer}`,
          kind: "package",
          label: importer,
        }),
      ),
      edges: [],
    };
  }
  if (entry.source.id === "generator-provenance") {
    const files = source.treeFiles;
    if (!files || Object.keys(files).length === 0)
      throw new Error("Generator provenance tree is empty.");
    const generatedNodes: AppMapNodeV1[] = [];
    const generatedEdges: AppMapEdgeV1[] = [];
    const generatedName = (value: string): string =>
      value
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[^A-Za-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();
    for (const [path, bytes] of Object.entries(files).sort(([left], [right]) =>
      compare(left, right),
    )) {
      const value = record(JSON.parse(bytes));
      const generator = text(value.generator);
      const name = text(value.name);
      const canonicalName = generatedName(name);
      const publication =
        value.publication === undefined ? undefined : record(value.publication);
      const generatedKind =
        generator === "add-capability"
          ? ("capability" as const)
          : generator === "add-client-domain"
            ? ("resource" as const)
            : generator === "add-workflow" && publication === undefined
              ? ("workflow" as const)
              : undefined;
      const target =
        generator === "add-table"
          ? `table:${name}`
          : generator === "add-workflow" && publication !== undefined
            ? `workflow-publication:${name}:v${publication.workflowVersion as number}`
            : generator === "add-capability"
              ? `capability:${canonicalName}`
              : generator === "add-client-domain"
                ? `resource:client-domain:${canonicalName}`
                : generator === "add-workflow"
                  ? `workflow:${canonicalName}`
                  : generator === "add-feature"
                    ? `route:${name}`
                    : undefined;
      if (!target)
        throw new Error(`Unsupported generator provenance: ${path}.`);
      if (generatedKind) {
        generatedNodes.push(
          node(entry, revision, source.digest, {
            id: target,
            kind: generatedKind,
            label: name,
          }),
        );
      }
      if (
        generatedKind ||
        (generator === "add-feature" && !topologyResourceIds.has(target))
      ) {
        const system = text(record(value.ownership).system);
        generatedEdges.push(
          edge(entry, revision, source.digest, {
            id: `owns:system:${system}->${target}`,
            kind: "owns",
            from: `system:${system}`,
            to: target,
          }),
        );
      }
      generatedEdges.push(
        edge(entry, revision, source.digest, {
          id: `generated-by:${target}->package:tooling/generators`,
          kind: "generated-by",
          from: target,
          to: "package:tooling/generators",
        }),
      );
    }
    return { nodes: generatedNodes, edges: generatedEdges };
  }
  if (entry.source.id === "template-instance") {
    if (source.generation) return { nodes: [], edges: [] };
    const instance = parseTemplateInstanceText(source.bytes);
    if (instance.support.state !== "supported")
      throw new Error(
        "Template instance is outside the canonical support range.",
      );
    return { nodes: [], edges: [] };
  }
  throw new Error("Unsupported canonical App Map source.");
};

export const composeAppMap = async (
  request: AppMapCompositionRequest,
): Promise<AppMapCompositionResult> => {
  if (!isExactGitRevision(request.revision))
    return {
      ok: false,
      code: "APP_MAP_COMPOSITION_INVALID",
      message: "App Map composition requires an exact Git revision.",
    };
  try {
    const overrides = request.generatedSourceOverrides ?? [];
    if (
      overrides.length > 1 ||
      new Set(overrides.map(({ sourceId }) => sourceId)).size !==
        overrides.length ||
      overrides.some(
        ({ sourceId, sourcePath }) =>
          sourceId !== "template-instance" ||
          sourcePath !== "template-instance.json",
      )
    )
      throw new Error("Generated App Map source overrides are not closed.");
    const loadedSources = await Promise.all(
      APP_MAP_INPUT_MANIFEST_V1.requiredSources.map(async (entry) => ({
        entry,
        source: await readSource(request, entry),
      })),
    );
    const topologySource = loadedSources.find(
      ({ entry }) => entry.source.id === "product-topology",
    );
    if (!topologySource)
      throw new Error("Canonical product topology source is missing.");
    const topologyResourceIds = new Set(
      parseProductTopology(
        JSON.parse(topologySource.source.bytes) as unknown,
      ).resources.map(({ id }) => id),
    );
    const batches: AppMapFactBatchV1[] = [];
    for (const { entry, source } of loadedSources) {
      const facts = factsFor(
        entry,
        request.revision,
        source,
        topologyResourceIds,
      );
      batches.push({
        adapterId: entry.adapter.id,
        adapterVersion: 1,
        source: sourceDescriptor(entry, request.revision, source),
        nodes: facts.nodes,
        edges: facts.edges,
      } as AppMapFactBatchV1);
    }
    const input: AppMapBuildInputV1 = {
      schemaVersion: 1,
      inputManifest: {
        id: APP_MAP_INPUT_MANIFEST_V1.id,
        version: APP_MAP_INPUT_MANIFEST_V1.version,
      },
      subject: { id: "repository", revision: request.revision },
      batches,
    };
    const build = buildAppMap(input);
    return build.ok
      ? { ok: true, input, build }
      : {
          ok: false,
          code: "APP_MAP_COMPOSITION_INVALID",
          message: build.diagnostics.map((item) => item.message).join(" "),
        };
  } catch (error) {
    return {
      ok: false,
      code: "APP_MAP_COMPOSITION_INVALID",
      message: `Canonical App Map source composition failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    };
  }
};

export const resolveRepositoryRevision = async (
  repoRoot: string,
): Promise<string> => (await git(repoRoot, ["rev-parse", "HEAD"])).trim();
