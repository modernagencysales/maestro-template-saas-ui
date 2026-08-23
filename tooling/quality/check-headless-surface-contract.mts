import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";
import { confectManifest } from "../../packages/template-core/src/generated/confectManifest";
import { descriptorFor } from "./src/check-definitions.mts";
import { isDirectRun } from "./src/direct-run.mts";
import { evaluateStaticCheck } from "./src/gate.mts";

export const descriptor = descriptorFor("headless-surface-contract");

const externalSurfaces = ["api", "cli", "mcp"] as const;
type ExternalSurface = (typeof externalSurfaces)[number];

const clientCallableSurfaces = ["web", ...externalSurfaces] as const;
type ClientCallableSurface = (typeof clientCallableSurfaces)[number];

type Surface = ExternalSurface | "web" | "workflow" | "internal" | string;

export type HeadlessManifestOperation = {
  readonly operationId: string;
  readonly surfaces: readonly Surface[];
  readonly typedErrors: readonly string[];
  readonly kind?: string;
  readonly idempotent?: boolean;
};

const hasExternalSurface = (operation: HeadlessManifestOperation): boolean =>
  operation.surfaces.some((surface) =>
    externalSurfaces.includes(surface as ExternalSurface),
  );

const exposedOperationIds = (
  operations: readonly HeadlessManifestOperation[],
  surface: ExternalSurface,
): string[] =>
  operations
    .filter((operation) => operation.surfaces.includes(surface))
    .map((operation) => operation.operationId);

export const missingTypedErrors = (
  operations: readonly HeadlessManifestOperation[],
): string[] =>
  operations
    .filter(
      (operation) =>
        hasExternalSurface(operation) && operation.typedErrors.length === 0,
    )
    .map((operation) => operation.operationId);

export const missingExternalValidationError = (
  operations: readonly HeadlessManifestOperation[],
): string[] =>
  operations
    .filter(
      (operation) =>
        hasExternalSurface(operation) &&
        !operation.typedErrors.includes("ValidationFailed"),
    )
    .map((operation) => operation.operationId);

const hasClientCallableSurface = (
  operation: HeadlessManifestOperation,
): boolean =>
  operation.surfaces.some((surface) =>
    clientCallableSurfaces.includes(surface as ClientCallableSurface),
  );

const isInternalNamedOperation = (
  operation: HeadlessManifestOperation,
): boolean => {
  const operationName = operation.operationId.split(".").at(-1) ?? "";
  return operationName.endsWith("Internal");
};

export const internalNamedOperationsWithClientSurfaces = (
  operations: readonly HeadlessManifestOperation[],
): string[] =>
  operations
    .filter(
      (operation) =>
        isInternalNamedOperation(operation) &&
        hasClientCallableSurface(operation),
    )
    .map((operation) => operation.operationId);

export const cannedRegistryImport = (source: string): string[] => {
  const forbiddenImport =
    /import\s*\{[^}]*\btemplateRegistry\b[^}]*\}\s*from\s*["']@maestro-template\/template-core["']/m;
  return forbiddenImport.test(source) ? ["templateRegistry"] : [];
};

type RuntimeSource = {
  readonly path: string;
  readonly source: string;
};

export const cannedRegistryImportFailures = (
  sources: readonly RuntimeSource[],
): string[] =>
  sources.flatMap(({ path, source }) =>
    cannedRegistryImport(source).map(
      (marker) => `${path} imports forbidden canned registry ${marker}`,
    ),
  );

const missingLiteralGeneratedRefMapping = (
  operationIds: readonly string[],
  source: string,
): string[] =>
  operationIds.filter(
    (operationId) =>
      !source.includes(`"${operationId}"`) &&
      !source.includes(`'${operationId}'`) &&
      !source.includes(`\`${operationId}\``),
  );

const parseTypeScript = (source: string): ts.SourceFile =>
  ts.createSourceFile(
    "headless-projection.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

const propertyNameText = (name: ts.PropertyName): string | undefined => {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  )
    return name.text;
  return undefined;
};

const unwrapExpression = (expression: ts.Expression): ts.Expression => {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current)
  )
    current = current.expression;
  return current;
};

const objectMapping = (
  sourceFile: ts.SourceFile,
  objectName: string,
): ReadonlyMap<string, ts.Expression> => {
  const result = new Map<string, ts.Expression>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === objectName &&
      node.initializer !== undefined
    ) {
      const initializer = unwrapExpression(node.initializer);
      if (!ts.isObjectLiteralExpression(initializer)) return;
      for (const property of initializer.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const name = propertyNameText(property.name);
        if (name !== undefined) result.set(name, property.initializer);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return result;
};

const expressionRoot = (expression: ts.Expression): string | undefined => {
  if (ts.isIdentifier(expression)) return expression.text;
  if (
    ts.isPropertyAccessExpression(expression) ||
    ts.isElementAccessExpression(expression)
  )
    return expressionRoot(expression.expression);
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isNonNullExpression(expression)
  )
    return expressionRoot(expression.expression);
  return undefined;
};

const isElementAccessOn = (
  expression: ts.Expression,
  objectName: string,
): boolean =>
  ts.isElementAccessExpression(expression) &&
  ts.isIdentifier(expression.expression) &&
  expression.expression.text === objectName;

const callCount = (
  sourceFile: ts.SourceFile,
  predicate: (call: ts.CallExpression) => boolean,
): number => {
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && predicate(node)) count += 1;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return count;
};

export const missingHttpGeneratedRefMapping = (
  operationIds: readonly string[],
  source: string,
): string[] => {
  const mappings = objectMapping(parseTypeScript(source), "operationRefs");
  return operationIds.filter((operationId) => {
    const ref = mappings.get(operationId);
    return ref === undefined || expressionRoot(ref) !== "api";
  });
};

export const missingCliGeneratedRefUsage = (
  operationIds: readonly string[],
  source: string,
): string[] => {
  const sourceFile = parseTypeScript(source);
  const mappings = objectMapping(sourceFile, "staticCliOperationRefs");
  const derivedRefs = new Set<string>();
  const visitDerived = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined &&
      (isElementAccessOn(node.initializer, "staticCliOperationRefs") ||
        (ts.isCallExpression(node.initializer) &&
          node.initializer.arguments.some(
            (argument) =>
              ts.isIdentifier(argument) &&
              argument.text === "staticCliOperationRefs",
          )))
    )
      derivedRefs.add(node.name.text);
    ts.forEachChild(node, visitDerived);
  };
  visitDerived(sourceFile);
  const usesGeneratedCliRefs =
    callCount(
      sourceFile,
      (call) =>
        ts.isIdentifier(call.expression) &&
        call.expression.text === "runTemplateApiOperation" &&
        call.arguments[0] !== undefined &&
        (isElementAccessOn(call.arguments[0], "staticCliOperationRefs") ||
          (ts.isIdentifier(call.arguments[0]) &&
            derivedRefs.has(call.arguments[0].text))),
    ) > 0;

  return operationIds.filter((operationId) => {
    const ref = mappings.get(operationId);
    return (
      ref === undefined ||
      (!ts.isStringLiteralLike(ref) &&
        !ts.isNoSubstitutionTemplateLiteral(ref)) ||
      !usesGeneratedCliRefs
    );
  });
};

export const missingMcpGeneratedRefUsage = (
  operationIds: readonly string[],
  source: string,
): string[] => {
  const sourceFile = parseTypeScript(source);
  const mappings = objectMapping(sourceFile, "generatedMcpOperationRefs");
  const sharedCalls = callCount(
    sourceFile,
    (call) =>
      ts.isIdentifier(call.expression) &&
      call.expression.text === "mcpToolNameFor",
  );
  const sharedFallback =
    sharedCalls >= 2 &&
    source.includes("generatedMcpOperationRefs[operationId]") &&
    source.includes("template.${operationId}");
  if (sharedFallback) return [];

  let directAccesses = 0;
  const visit = (node: ts.Node): void => {
    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "generatedMcpOperationRefs"
    )
      directAccesses += 1;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return operationIds.filter((operationId) => {
    const ref = mappings.get(operationId);
    return (
      ref === undefined ||
      (!ts.isStringLiteralLike(ref) &&
        !ts.isNoSubstitutionTemplateLiteral(ref)) ||
      directAccesses < 2
    );
  });
};

export const missingHttpExecutorDispatch = (source: string): boolean =>
  !/\bexecuteHeadlessOperation\s*\(/.test(source) ||
  !/\brefs\s*:\s*operationRefs\b/.test(source);

export const missingRuntimeAdapterDispatch = (source: string): boolean =>
  !/\bTemplateRuntimeAdapter\b/.test(source) ||
  !/\bruntime\.runGeneratedOperation\s*\(/.test(source);

type GeneratedRefProjection = "literal" | "http" | "cli" | "mcp";

export const missingGeneratedRefMapping = (
  operationIds: readonly string[],
  source: string,
  projection: GeneratedRefProjection = "literal",
): string[] => {
  if (projection === "http") {
    return missingHttpGeneratedRefMapping(operationIds, source);
  }
  if (projection === "cli") {
    return missingCliGeneratedRefUsage(operationIds, source);
  }
  if (projection === "mcp") {
    return missingMcpGeneratedRefUsage(operationIds, source);
  }
  return missingLiteralGeneratedRefMapping(operationIds, source);
};

const readRepoFile = async (repoRoot: string, path: string): Promise<string> =>
  readFile(join(repoRoot, path), "utf8");

const readOptionalRepoFile = async (
  repoRoot: string,
  path: string,
): Promise<string | undefined> =>
  existsSync(join(repoRoot, path)) ? readRepoFile(repoRoot, path) : undefined;

export const optionalRuntimeSource = (
  path: string,
  source: string | undefined,
): readonly { readonly path: string; readonly source: string }[] =>
  source === undefined ? [] : [{ path, source }];

export const mcpProjectionPath = (workflowSelected: boolean): string =>
  workflowSelected
    ? "tooling/workflow/src/index.ts"
    : "apps/cli/src/headlessRegistry.ts";

export const evaluateHeadlessSurfaceContract = async (
  repoRoot: string,
): Promise<readonly string[]> => {
  const staticResult = await evaluateStaticCheck(repoRoot, descriptor);
  const failures = [...staticResult.failures];
  const operations =
    confectManifest.functions as readonly HeadlessManifestOperation[];

  const workflowIndexPath = "tooling/workflow/src/index.ts";
  const workflowProjectionPath = mcpProjectionPath(
    existsSync(join(repoRoot, workflowIndexPath)),
  );
  const [httpSource, cliSource, workflowSource, executorSource] =
    await Promise.all([
      readRepoFile(repoRoot, "packages/convex/confect/http.ts"),
      readRepoFile(repoRoot, "apps/cli/src/index.ts"),
      readRepoFile(repoRoot, workflowProjectionPath),
      readRepoFile(repoRoot, "packages/convex/confect/manifest/executor.ts"),
    ]);
  const workflowCompatPath = "tooling/workflow/src/workflow-compat.ts";
  const workflowCompatSource = await readOptionalRepoFile(
    repoRoot,
    workflowCompatPath,
  );

  failures.push(
    ...missingTypedErrors(operations).map(
      (operationId) =>
        `operation ${operationId} is exposed to API/CLI/MCP without public typed errors`,
    ),
  );

  for (const operationId of missingExternalValidationError(operations)) {
    failures.push(
      `operation ${operationId} is exposed to API/CLI/MCP without declaring ValidationFailed for envelope validation errors`,
    );
  }

  for (const operationId of internalNamedOperationsWithClientSurfaces(
    operations,
  )) {
    failures.push(
      `operation ${operationId} is internally named but exposed to a client-callable surface`,
    );
  }

  const apiMissingRefs = missingGeneratedRefMapping(
    exposedOperationIds(operations, "api"),
    httpSource,
    "http",
  );
  const cliMissingRefs = missingGeneratedRefMapping(
    exposedOperationIds(operations, "cli"),
    cliSource,
    "cli",
  );
  const mcpMissingRefs = missingGeneratedRefMapping(
    exposedOperationIds(operations, "mcp"),
    workflowSource,
    "mcp",
  );
  const runtimeSources = [
    { path: "packages/convex/confect/http.ts", source: httpSource },
    { path: "apps/cli/src/index.ts", source: cliSource },
    { path: workflowProjectionPath, source: workflowSource },
    ...optionalRuntimeSource(workflowCompatPath, workflowCompatSource),
    {
      path: "packages/convex/confect/manifest/executor.ts",
      source: executorSource,
    },
  ] as const;

  for (const operationId of apiMissingRefs) {
    failures.push(
      `API operation ${operationId} lacks a generated ref mapping in packages/convex/confect/http.ts`,
    );
  }
  if (missingHttpExecutorDispatch(httpSource)) {
    failures.push(
      "API HTTP dispatch must execute generated operationRefs through executeHeadlessOperation",
    );
  }
  for (const operationId of cliMissingRefs) {
    failures.push(
      `CLI operation ${operationId} lacks a generated ref mapping in apps/cli/src/index.ts`,
    );
  }
  for (const operationId of mcpMissingRefs) {
    failures.push(
      `MCP operation ${operationId} lacks a generated ref mapping in the MCP projection`,
    );
  }
  if (missingRuntimeAdapterDispatch(workflowSource)) {
    failures.push(
      "CLI/MCP compatibility projection must dispatch through an explicit runtime adapter before returning FeatureDisabled",
    );
  }

  for (const failure of cannedRegistryImportFailures(runtimeSources)) {
    failures.push(failure);
  }

  if (httpSource.includes("@maestro-template/workflow-tooling")) {
    failures.push(
      "packages/convex/confect/http.ts must not import @maestro-template/workflow-tooling",
    );
  }

  return failures;
};

export const runHeadlessSurfaceContractCheck = async (
  repoRoot = process.cwd(),
): Promise<void> => {
  const failures = await evaluateHeadlessSurfaceContract(repoRoot);
  if (failures.length === 0) {
    console.log(`${descriptor.name}: ok`);
    return;
  }

  for (const failure of failures) {
    console.error(`${descriptor.name}: ${failure}`);
  }
  process.exitCode = 1;
};

if (isDirectRun(import.meta.url)) await runHeadlessSurfaceContractCheck();
