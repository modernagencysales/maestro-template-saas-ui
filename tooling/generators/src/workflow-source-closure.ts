import { createHash } from "node:crypto";
import { existsSync, realpathSync, readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

import ts from "typescript";

export type SourceClosure = {
  readonly roots: readonly string[];
  readonly modules: readonly {
    readonly path: string;
    readonly checksum: string;
  }[];
  readonly checksum: string;
};

const sha256 = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
};

const canonicalJson = (value: unknown): string =>
  JSON.stringify(canonicalize(value));

export const checksumSourceClosure = (
  closure: Pick<SourceClosure, "roots" | "modules">,
): string =>
  sha256(canonicalJson({ roots: closure.roots, modules: closure.modules }));

export const normalizedSourcePath = (
  root: string,
  absolutePath: string,
): string => {
  const path = relative(root, absolutePath).split(sep).join("/");
  if (path === ".." || path.startsWith("../")) {
    throw new Error(`Source closure escaped repository root: ${absolutePath}`);
  }
  return path;
};

const stringLiteralText = (node: ts.Node | undefined): string | undefined => {
  if (node === undefined) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return undefined;
};

const moduleSpecifierText = (node: ts.Node): string | undefined => {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    return stringLiteralText(node.moduleSpecifier);
  }
  if (
    ts.isImportEqualsDeclaration(node) &&
    ts.isExternalModuleReference(node.moduleReference)
  ) {
    return stringLiteralText(node.moduleReference.expression);
  }
  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
    return stringLiteralText(node.argument.literal);
  }
  return undefined;
};

const isDynamicImport = (node: ts.CallExpression): boolean =>
  node.expression.kind === ts.SyntaxKind.ImportKeyword;

const isCommonJsRequire = (node: ts.CallExpression): boolean =>
  ts.isIdentifier(node.expression) && node.expression.text === "require";

export const relativeModuleSpecifiers = (
  source: string,
  fileName: string,
): readonly string[] => {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers = new Set<string>();
  const visit = (node: ts.Node): void => {
    const declared = moduleSpecifierText(node);
    if (declared?.startsWith(".")) specifiers.add(declared);

    if (
      ts.isCallExpression(node) &&
      (isDynamicImport(node) || isCommonJsRequire(node))
    ) {
      const argument = node.arguments[0];
      const dynamic = stringLiteralText(argument);
      if (dynamic === undefined) {
        throw new Error(
          `Non-literal dynamic import is not permitted in publication source closure: ${fileName}`,
        );
      }
      if (dynamic.startsWith(".")) specifiers.add(dynamic);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...specifiers].sort();
};

const resolveImports = (
  fromPath: string,
  specifier: string,
  pathExists: (path: string) => boolean,
): readonly string[] => {
  const base = resolve(dirname(fromPath), specifier);
  const sourceBase = base.replace(/\.(?:c|m)?js$/, "");
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.cts`,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.cjs`,
    `${base}.d.ts`,
    `${sourceBase}.ts`,
    `${sourceBase}.tsx`,
    `${sourceBase}.mts`,
    `${sourceBase}.cts`,
    `${sourceBase}.js`,
    `${sourceBase}.mjs`,
    `${sourceBase}.cjs`,
    `${sourceBase}.d.ts`,
    resolve(base, "index.ts"),
    resolve(base, "index.tsx"),
    resolve(base, "index.mts"),
    resolve(base, "index.cts"),
    resolve(base, "index.js"),
    resolve(base, "index.mjs"),
    resolve(base, "index.cjs"),
    resolve(base, "index.d.ts"),
  ];
  const resolvedPaths = [...new Set(candidates.filter(pathExists))];
  if (resolvedPaths.length === 0) {
    throw new Error(`Unresolved import ${specifier} from ${fromPath}`);
  }
  return resolvedPaths;
};

export const isMutableGeneratedProjection = (
  repositoryRoot: string,
  absolutePath: string,
): boolean => {
  const path = normalizedSourcePath(repositoryRoot, absolutePath);
  return (
    path.includes("/confect/_generated/") ||
    path === "packages/convex/convex/_generated/api.d.ts" ||
    path === "packages/convex/confect/http.ts"
  );
};

export const buildResolvedSourceClosure = (
  cwd: string,
  roots: readonly string[],
  overlay: ReadonlyMap<string, string> = new Map(),
): SourceClosure => {
  const repositoryRoot = realpathSync(resolve(cwd));
  const pending = roots.map((root) => resolve(repositoryRoot, root));
  const sources = new Map<string, string>();
  while (pending.length > 0) {
    const requestedPath = pending.pop();
    if (!requestedPath) continue;
    if (!overlay.has(requestedPath) && !existsSync(requestedPath)) {
      throw new Error(`Source closure root is missing: ${requestedPath}`);
    }
    const absolutePath = overlay.has(requestedPath)
      ? requestedPath
      : realpathSync(requestedPath);
    normalizedSourcePath(repositoryRoot, absolutePath);
    if (sources.has(absolutePath)) continue;
    const source =
      overlay.get(absolutePath) ?? readFileSync(absolutePath, "utf8");
    sources.set(absolutePath, source);
    for (const specifier of relativeModuleSpecifiers(source, absolutePath)) {
      pending.push(
        ...resolveImports(
          absolutePath,
          specifier,
          (candidate) => overlay.has(candidate) || existsSync(candidate),
        ).filter(
          (candidate) =>
            !isMutableGeneratedProjection(repositoryRoot, candidate),
        ),
      );
    }
  }
  const modules = [...sources]
    .map(([path, source]) => ({
      path: normalizedSourcePath(repositoryRoot, path),
      checksum: sha256(source),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const normalizedRoots = roots
    .map((root) =>
      normalizedSourcePath(repositoryRoot, resolve(repositoryRoot, root)),
    )
    .sort();
  return {
    roots: normalizedRoots,
    modules,
    checksum: checksumSourceClosure({ roots: normalizedRoots, modules }),
  };
};
