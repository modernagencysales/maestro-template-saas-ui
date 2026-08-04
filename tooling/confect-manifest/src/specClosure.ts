import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";

const filesBelow = (path: string): readonly string[] =>
  readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isSymbolicLink() || lstatSync(child).isSymbolicLink()) return [];
    if (entry.isDirectory()) return filesBelow(child);
    return entry.isFile() ? [child] : [];
  });

export const discoverReviewedContractSpecs = (
  root: string,
): readonly string[] => {
  const directory = join(root, "packages/convex/confect");
  if (!existsSync(directory)) return [];
  return filesBelow(directory)
    .filter((path) => path.endsWith(".spec.ts"))
    .filter((path) => {
      const source = readFileSync(path, "utf8");
      return (
        /\bexport\s+const\s+manifest\b/u.test(source) &&
        /\bexport\s+const\s+schemaRegistry\b/u.test(source)
      );
    })
    .map((path) => relative(root, path).split(sep).join("/"))
    .sort((left, right) => left.localeCompare(right));
};

export const generatedRefModuleForSpec = (specPath: string): string =>
  specPath
    .replace(/^packages\/convex\/confect\//u, "packages/convex/convex/")
    .replace(/\.spec\.ts$/u, ".ts");

export const missingGeneratedRefs = (
  root: string,
  entries: readonly {
    readonly specPath: string;
    readonly operationId: string;
    readonly name: string;
  }[],
): readonly string[] =>
  entries.flatMap(({ specPath, operationId, name }) => {
    const modulePath = join(root, generatedRefModuleForSpec(specPath));
    if (!existsSync(modulePath)) return [operationId];
    const source = readFileSync(modulePath, "utf8");
    const sourceFile = ts.createSourceFile(
      modulePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const matchingExports = sourceFile.statements.flatMap((statement) =>
      ts.isVariableStatement(statement) &&
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
        ? statement.declarationList.declarations.filter(
            (declaration) =>
              ts.isIdentifier(declaration.name) &&
              declaration.name.text === name &&
              declaration.initializer !== undefined,
          )
        : [],
    );
    return matchingExports.length === 1 ? [] : [operationId];
  });
