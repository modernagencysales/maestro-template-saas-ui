import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseSystemCatalog,
  type SystemCatalog,
} from "@maestro-template/template-core/systemCatalog";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const CATALOG_PATH = "docs/template/system-catalog.json";
const TABLES_PATH = "packages/convex/confect/tables";

export type SystemCatalogFinding = {
  readonly subject: string;
  readonly issue: string;
};

export type SystemCatalogFileSystem = {
  readonly exists: (path: string) => boolean;
  readonly isFile: (path: string) => boolean;
  readonly tableNames: () => readonly string[];
};

const repoFileSystem = (
  root: string,
  tablesPath = TABLES_PATH,
): SystemCatalogFileSystem => ({
  exists: (path) => existsSync(join(root, path)),
  isFile: (path) =>
    existsSync(join(root, path)) && statSync(join(root, path)).isFile(),
  tableNames: () =>
    readdirSync(join(root, tablesPath), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .filter((entry) => !entry.name.endsWith(".test.ts"))
      .map((entry) => entry.name.slice(0, -3))
      .sort(),
});

const pathBeforeFragment = (value: string): string =>
  value.split("#", 1)[0] ?? value;

const duplicates = (values: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    (seen.has(value) ? repeated : seen).add(value);
  }
  return [...repeated].sort();
};

export const validateSystemCatalog = (
  catalog: SystemCatalog,
  fileSystem: SystemCatalogFileSystem,
): readonly SystemCatalogFinding[] => {
  const findings: SystemCatalogFinding[] = [];
  const registeredTables = catalog.systems.flatMap((system) => system.tables);
  const sourceTables = fileSystem.tableNames();

  for (const system of catalog.systems) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(system.id)) {
      findings.push({
        subject: system.id,
        issue: "system id must use kebab-case",
      });
    }
    if (system.lifecycle === "retired" && system.tables.length > 0) {
      findings.push({
        subject: system.id,
        issue: "retired systems must not own active schema tables",
      });
    }
    for (const table of system.tables) {
      if (!/^[a-z][A-Za-z0-9]*$/.test(table)) {
        findings.push({
          subject: `${system.id}:${table}`,
          issue: "table ownership must name a camelCase table",
        });
      }
    }
    for (const entrypoint of system.canonicalEntrypoints) {
      if (!fileSystem.exists(entrypoint)) {
        findings.push({
          subject: system.id,
          issue: `canonical entrypoint does not exist: ${entrypoint}`,
        });
      }
    }
    const decisionPath = pathBeforeFragment(system.decisionRef);
    if (!fileSystem.isFile(decisionPath)) {
      findings.push({
        subject: system.id,
        issue: `system decision does not resolve to a file: ${system.decisionRef}`,
      });
    }
  }

  for (const table of sourceTables) {
    if (!registeredTables.includes(table)) {
      findings.push({
        subject: table,
        issue:
          "schema table has no canonical system owner; extend an existing system or record an introduction decision",
      });
    }
  }
  for (const table of registeredTables) {
    if (!sourceTables.includes(table)) {
      findings.push({
        subject: table,
        issue:
          "catalog owns a table that has no hand-authored Confect table file",
      });
    }
  }
  for (const table of duplicates(registeredTables)) {
    findings.push({
      subject: table,
      issue: "schema table has more than one canonical system owner",
    });
  }

  return findings;
};

export const checkSystemCatalog = (
  root = ROOT,
): readonly SystemCatalogFinding[] => {
  const raw = JSON.parse(
    readFileSync(join(root, CATALOG_PATH), "utf8"),
  ) as unknown;
  const catalog = parseSystemCatalog(raw);
  return validateSystemCatalog(catalog, repoFileSystem(root));
};

const main = (): void => {
  try {
    const failures = checkSystemCatalog();
    if (failures.length > 0) {
      console.error("x canonical system catalog invalid:");
      for (const failure of failures) {
        console.error(`  - ${failure.subject}: ${failure.issue}`);
      }
      process.exitCode = 1;
      return;
    }

    const catalog = parseSystemCatalog(
      JSON.parse(readFileSync(join(ROOT, CATALOG_PATH), "utf8")) as unknown,
    );
    const tableCount = catalog.systems.reduce(
      (count, system) => count + system.tables.length,
      0,
    );
    console.log(
      `ok system catalog - ${String(catalog.systems.length)} canonical systems own ${String(tableCount)} schema tables`,
    );
  } catch (error: unknown) {
    console.error(
      `x canonical system catalog invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
