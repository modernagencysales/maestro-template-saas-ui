import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { parseDataResourceCatalog } from "@maestro-template/template-core/dataResourceCatalog";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const SOURCE_ROOTS = ["packages/convex/confect", "packages/convex/convex"];
const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const DESTRUCTIVE_METHODS = new Set(["delete", "patch", "replace"]);

export type RawDbMutationFinding = {
  readonly subject: string;
  readonly issue: string;
};
export type RawDbMutationSource = {
  readonly path: string;
  readonly source: string;
};
export type ComponentMutationAllowance = {
  readonly path: string;
  readonly method: "patch";
  readonly component: string;
};

export const RAW_DB_MUTATION_ALLOWLIST: readonly ComponentMutationAllowance[] =
  Object.freeze([
    {
      path: "packages/convex/convex/components/workflowAdmission/admission.ts",
      method: "patch",
      component: "workflowAdmission",
    },
    {
      path: "packages/convex/convex/components/workflowDeadline/deadlines.ts",
      method: "patch",
      component: "workflowDeadline",
    },
  ]);

const staticPropertyName = (expression: ts.Expression): string | undefined =>
  ts.isPropertyAccessExpression(expression)
    ? expression.name.text
    : ts.isElementAccessExpression(expression) &&
        expression.argumentExpression !== undefined &&
        ts.isStringLiteral(expression.argumentExpression)
      ? expression.argumentExpression.text
      : undefined;
const propertyReceiver = (
  expression: ts.Expression,
): ts.Expression | undefined =>
  ts.isPropertyAccessExpression(expression) ||
  ts.isElementAccessExpression(expression)
    ? expression.expression
    : undefined;

type FunctionIndex = ReadonlyMap<string, ts.FunctionLikeDeclaration>;
const indexFunctions = (sourceFile: ts.SourceFile): FunctionIndex => {
  const functions = new Map<string, ts.FunctionLikeDeclaration>();
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name !== undefined)
      functions.set(node.name.text, node);
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined &&
      (ts.isFunctionExpression(node.initializer) ||
        ts.isArrowFunction(node.initializer))
    )
      functions.set(node.name.text, node.initializer);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return functions;
};

const isDbOrigin = (
  expression: ts.Expression,
  aliases: ReadonlySet<string>,
  returningFunctions: ReadonlySet<string>,
): boolean => {
  if (ts.isParenthesizedExpression(expression))
    return isDbOrigin(expression.expression, aliases, returningFunctions);
  if (ts.isIdentifier(expression)) return aliases.has(expression.text);
  if (ts.isPropertyAccessExpression(expression))
    return expression.name.text === "db";
  if (ts.isElementAccessExpression(expression)) {
    const argument = expression.argumentExpression;
    return (
      argument !== undefined &&
      ts.isStringLiteral(argument) &&
      argument.text === "db"
    );
  }
  return (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    returningFunctions.has(expression.expression.text)
  );
};

const collectProvenance = (
  sourceFile: ts.SourceFile,
): {
  readonly aliases: ReadonlySet<string>;
  readonly returningFunctions: ReadonlySet<string>;
  readonly destructiveAliases: ReadonlyMap<string, string>;
} => {
  const aliases = new Set<string>();
  const returningFunctions = new Set<string>();
  const destructiveAliases = new Map<string, string>();
  const functions = indexFunctions(sourceFile);
  const nodes: ts.Node[] = [];
  const calls: ts.CallExpression[] = [];
  const gather = (node: ts.Node): void => {
    nodes.push(node);
    if (ts.isCallExpression(node)) calls.push(node);
    ts.forEachChild(node, gather);
  };
  gather(sourceFile);

  const bindDestructiveMethods = (pattern: ts.ObjectBindingPattern): void => {
    for (const element of pattern.elements) {
      const property = element.propertyName ?? element.name;
      if (
        ts.isIdentifier(property) &&
        DESTRUCTIVE_METHODS.has(property.text) &&
        ts.isIdentifier(element.name)
      )
        destructiveAliases.set(element.name.text, property.text);
    }
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer !== undefined &&
        isDbOrigin(node.initializer, aliases, returningFunctions) &&
        !aliases.has(node.name.text)
      ) {
        aliases.add(node.name.text);
        changed = true;
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer !== undefined &&
        (ts.isPropertyAccessExpression(node.initializer) ||
          ts.isElementAccessExpression(node.initializer))
      ) {
        const method = staticPropertyName(node.initializer);
        const receiver = propertyReceiver(node.initializer);
        if (
          method !== undefined &&
          DESTRUCTIVE_METHODS.has(method) &&
          receiver !== undefined &&
          isDbOrigin(receiver, aliases, returningFunctions)
        )
          destructiveAliases.set(node.name.text, method);
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isObjectBindingPattern(node.name) &&
        node.initializer !== undefined &&
        isDbOrigin(node.initializer, aliases, returningFunctions)
      )
        bindDestructiveMethods(node.name);
      if (
        ts.isVariableDeclaration(node) &&
        ts.isObjectBindingPattern(node.name) &&
        node.initializer !== undefined
      ) {
        for (const element of node.name.elements) {
          const property = element.propertyName ?? element.name;
          if (
            ts.isIdentifier(property) &&
            property.text === "db" &&
            ts.isIdentifier(element.name) &&
            !aliases.has(element.name.text)
          ) {
            aliases.add(element.name.text);
            changed = true;
          }
        }
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        const left = ts.isParenthesizedExpression(node.left)
          ? node.left.expression
          : node.left;
        if (
          ts.isIdentifier(left) &&
          isDbOrigin(node.right, aliases, returningFunctions) &&
          !aliases.has(left.text)
        ) {
          aliases.add(left.text);
          changed = true;
        }
        if (
          ts.isObjectLiteralExpression(left) &&
          isDbOrigin(node.right, aliases, returningFunctions)
        ) {
          for (const property of left.properties) {
            const name = property.name;
            if (name === undefined || !ts.isIdentifier(name)) continue;
            if (!DESTRUCTIVE_METHODS.has(name.text)) continue;
            const local =
              ts.isPropertyAssignment(property) &&
              ts.isIdentifier(property.initializer)
                ? property.initializer.text
                : name.text;
            destructiveAliases.set(local, name.text);
          }
        }
      }
    }
    for (const [name, declaration] of functions) {
      let returnsDb = false;
      const body = declaration.body;
      if (body !== undefined && !ts.isBlock(body))
        returnsDb = isDbOrigin(body, aliases, returningFunctions);
      if (body !== undefined && ts.isBlock(body)) {
        const visitReturns = (node: ts.Node): void => {
          if (node !== body && ts.isFunctionLike(node)) return;
          if (
            ts.isReturnStatement(node) &&
            node.expression !== undefined &&
            isDbOrigin(node.expression, aliases, returningFunctions)
          )
            returnsDb = true;
          ts.forEachChild(node, visitReturns);
        };
        visitReturns(body);
      }
      if (returnsDb && !returningFunctions.has(name)) {
        returningFunctions.add(name);
        changed = true;
      }
    }
    for (const call of calls) {
      if (!ts.isIdentifier(call.expression)) continue;
      const declaration = functions.get(call.expression.text);
      if (declaration === undefined) continue;
      call.arguments.forEach((argument, index) => {
        const parameter = declaration.parameters[index];
        if (
          parameter !== undefined &&
          ts.isIdentifier(parameter.name) &&
          isDbOrigin(argument, aliases, returningFunctions) &&
          !aliases.has(parameter.name.text)
        ) {
          aliases.add(parameter.name.text);
          changed = true;
        }
      });
    }
  }
  return { aliases, returningFunctions, destructiveAliases };
};

const componentAllowanceValid = (
  sourceFile: ts.SourceFile,
  path: string,
  method: string,
  allowlist: readonly ComponentMutationAllowance[],
): boolean => {
  const allowance = allowlist.find(
    (entry) => entry.path === path && entry.method === method,
  );
  if (allowance === undefined) return false;
  const realImport = sourceFile.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "./_generated/server",
  );
  return (
    realImport &&
    path.startsWith(`packages/convex/convex/components/${allowance.component}/`)
  );
};

export const validateRawDbMutations = (
  sources: readonly RawDbMutationSource[],
  allowlist: readonly ComponentMutationAllowance[] = RAW_DB_MUTATION_ALLOWLIST,
): readonly RawDbMutationFinding[] => {
  const findings: RawDbMutationFinding[] = [];
  for (const source of sources) {
    const sourceFile = ts.createSourceFile(
      source.path,
      source.source,
      ts.ScriptTarget.Latest,
      true,
      source.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const diagnostics = (
      sourceFile as ts.SourceFile & {
        readonly parseDiagnostics?: readonly ts.Diagnostic[];
      }
    ).parseDiagnostics;
    if (diagnostics !== undefined && diagnostics.length > 0) {
      findings.push({
        subject: source.path,
        issue: "TypeScript source does not parse",
      });
      continue;
    }
    const { aliases, returningFunctions, destructiveAliases } =
      collectProvenance(sourceFile);
    const report = (node: ts.Node, method: string): void => {
      if (componentAllowanceValid(sourceFile, source.path, method, allowlist))
        return;
      const line =
        sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      findings.push({
        subject: `${source.path}:${String(line)}`,
        issue: `raw Convex db.${method} is forbidden outside an exact component-local patch allowance`,
      });
    };
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        if (
          ts.isIdentifier(node.expression) &&
          destructiveAliases.has(node.expression.text)
        )
          report(
            node,
            destructiveAliases.get(node.expression.text) ?? "dynamic",
          );
        const receiver = propertyReceiver(node.expression);
        if (
          receiver !== undefined &&
          isDbOrigin(receiver, aliases, returningFunctions)
        ) {
          const method = staticPropertyName(node.expression);
          if (method === undefined) report(node, "dynamic");
          else if (DESTRUCTIVE_METHODS.has(method)) report(node, method);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return findings;
};

const sourcesIn = (root: string, directory: string): readonly string[] =>
  readdirSync(join(root, directory), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return sourcesIn(root, path);
      return entry.isFile() &&
        SOURCE_EXTENSIONS.some((extension) => path.endsWith(extension))
        ? [path]
        : [];
    },
  );

export const checkAppendOnlyTables = (
  root = ROOT,
): readonly RawDbMutationFinding[] => {
  const catalog = parseDataResourceCatalog(
    JSON.parse(
      readFileSync(join(root, "docs/template/data-resources.json"), "utf8"),
    ) as unknown,
  );
  if (!catalog.resources.some(({ appendOnly }) => appendOnly))
    throw new RangeError("data resource catalog has no append-only resources");
  return validateRawDbMutations(
    SOURCE_ROOTS.flatMap((directory) => sourcesIn(root, directory)).map(
      (path) => ({
        path: relative(root, join(root, path)),
        source: readFileSync(join(root, path), "utf8"),
      }),
    ),
  );
};

export const runAppendOnlyTableCheck = (): void => {
  try {
    const findings = checkAppendOnlyTables();
    if (findings.length > 0) {
      console.error("x raw Convex database mutation boundary violated:");
      for (const finding of findings)
        console.error(`  - ${finding.subject}: ${finding.issue}`);
      process.exitCode = 1;
      return;
    }
    console.log(
      "ok append-only tables - raw destructive database access is bounded",
    );
  } catch (error: unknown) {
    console.error(
      `x append-only table mutation boundary invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url))
  runAppendOnlyTableCheck();
