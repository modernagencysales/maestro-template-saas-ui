import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseDataResourceCatalog,
  renderDataResourceRuntime,
  type DataResourceCatalog,
} from "@maestro-template/template-core/dataResourceCatalog";
export { renderDataResourceRuntime } from "@maestro-template/template-core/dataResourceCatalog";
import {
  parseSystemCatalog,
  type SystemCatalog,
} from "@maestro-template/template-core/systemCatalog";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const DATA_RESOURCE_PATH = "docs/template/data-resources.json";
const SYSTEM_CATALOG_PATH = "docs/template/system-catalog.json";
const TABLES_PATH = "packages/convex/confect/tables";
const RUNTIME_PATH = "packages/convex/confect/ops/dataResources.generated.ts";

export type DataResourceFinding = {
  readonly subject: string;
  readonly issue: string;
};

export type DataResourceFileSystem = {
  readonly exists: (path: string) => boolean;
  readonly isFile: (path: string) => boolean;
  readonly tableNames: () => readonly string[];
  readonly runtimeSource: () => string;
};

const repoFileSystem = (root: string): DataResourceFileSystem => ({
  exists: (path) => existsSync(join(root, path)),
  isFile: (path) =>
    existsSync(join(root, path)) && statSync(join(root, path)).isFile(),
  tableNames: () =>
    readdirSync(join(root, TABLES_PATH), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .filter((entry) => !entry.name.endsWith(".test.ts"))
      .map((entry) => entry.name.slice(0, -3))
      .sort(),
  runtimeSource: () =>
    existsSync(join(root, RUNTIME_PATH))
      ? readFileSync(join(root, RUNTIME_PATH), "utf8")
      : "",
});

const pathBeforeFragment = (value: string): string =>
  value.split("#", 1)[0] ?? value;

export const validateDataResources = (
  systems: SystemCatalog,
  catalog: DataResourceCatalog,
  fileSystem: DataResourceFileSystem,
): readonly DataResourceFinding[] => {
  const findings: DataResourceFinding[] = [];
  const sourceTables = fileSystem.tableNames();
  const resourceIds = catalog.resources.map(({ id }) => id);

  for (const table of sourceTables) {
    if (!resourceIds.includes(table)) {
      findings.push({
        subject: table,
        issue: "schema table has no durable data-resource contract",
      });
    }
  }
  for (const resource of catalog.resources) {
    if (!sourceTables.includes(resource.id)) {
      findings.push({
        subject: resource.id,
        issue: "data-resource contract has no hand-authored schema table",
      });
    }

    const expectedSourcePath = `${TABLES_PATH}/${resource.id}.ts`;
    if (resource.sourcePath !== expectedSourcePath) {
      findings.push({
        subject: resource.id,
        issue: `source path must be ${expectedSourcePath}`,
      });
    } else if (!fileSystem.isFile(resource.sourcePath)) {
      findings.push({
        subject: resource.id,
        issue: `table source does not exist: ${resource.sourcePath}`,
      });
    }

    const system = systems.systems.find(({ id }) => id === resource.system);
    if (system === undefined) {
      findings.push({
        subject: resource.id,
        issue: `unknown canonical system owner: ${resource.system}`,
      });
    } else if (!system.tables.includes(resource.id)) {
      findings.push({
        subject: resource.id,
        issue: `system owner does not match ${SYSTEM_CATALOG_PATH}`,
      });
    }

    const unavailableBoundary = `docs/template/system-decisions/${resource.system}.md`;
    if (
      resource.writePosture === "external-unavailable" &&
      resource.writeAuthority !== unavailableBoundary
    ) {
      findings.push({
        subject: resource.id,
        issue: `external-unavailable write posture must point to ${unavailableBoundary}`,
      });
    }
    if (
      resource.writePosture === "implemented" &&
      resource.writeAuthority.startsWith("docs/template/system-decisions/")
    ) {
      findings.push({
        subject: resource.id,
        issue: "implemented write posture must point to shipped code authority",
      });
    }
    if (!fileSystem.exists(resource.writeAuthority)) {
      findings.push({
        subject: resource.id,
        issue: `write authority does not exist: ${resource.writeAuthority}`,
      });
    }
    const migrationPath = pathBeforeFragment(resource.migrationRef);
    if (!fileSystem.isFile(migrationPath)) {
      findings.push({
        subject: resource.id,
        issue: `migration reference does not exist: ${resource.migrationRef}`,
      });
    }
  }

  if (fileSystem.runtimeSource() !== renderDataResourceRuntime(catalog)) {
    findings.push({
      subject: RUNTIME_PATH,
      issue:
        "generated data-resource runtime is stale; run pnpm data-resources:generate",
    });
  }

  return findings;
};

const readCatalogs = (
  root: string,
): {
  readonly systems: SystemCatalog;
  readonly resources: DataResourceCatalog;
} => ({
  systems: parseSystemCatalog(
    JSON.parse(
      readFileSync(join(root, SYSTEM_CATALOG_PATH), "utf8"),
    ) as unknown,
  ),
  resources: parseDataResourceCatalog(
    JSON.parse(readFileSync(join(root, DATA_RESOURCE_PATH), "utf8")) as unknown,
  ),
});

export const checkDataResources = (
  root = ROOT,
): readonly DataResourceFinding[] => {
  const { systems, resources } = readCatalogs(root);
  return validateDataResources(systems, resources, repoFileSystem(root));
};

export const writeDataResourceRuntime = (root = ROOT): void => {
  const { resources } = readCatalogs(root);
  writeFileSync(join(root, RUNTIME_PATH), renderDataResourceRuntime(resources));
};

export const runDataResourceCheck = (): void => {
  try {
    if (process.argv.includes("--write")) {
      writeDataResourceRuntime();
      console.log(`wrote ${RUNTIME_PATH}`);
    }
    const findings = checkDataResources();
    if (findings.length > 0) {
      console.error("x durable data-resource catalog invalid:");
      for (const finding of findings) {
        console.error(`  - ${finding.subject}: ${finding.issue}`);
      }
      process.exitCode = 1;
      return;
    }

    const { resources } = readCatalogs(ROOT);
    const managed = resources.resources.filter(
      ({ workspaceLifecycle }) => workspaceLifecycle === "managed",
    ).length;
    console.log(
      `ok data resources - ${String(resources.resources.length)} tables classified, ${String(managed)} projected into workspace lifecycle plans`,
    );
  } catch (error: unknown) {
    console.error(
      `x durable data-resource catalog invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) runDataResourceCheck();
