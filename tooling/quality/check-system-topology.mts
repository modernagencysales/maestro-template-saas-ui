import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseProductTopology,
  type ProductTopology,
} from "@maestro-template/template-core/productTopology";
import {
  parseSystemCatalog,
  type SystemCatalog,
} from "@maestro-template/template-core/systemCatalog";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const TOPOLOGY_PATH = "docs/template/product-topology.json";
const SYSTEM_CATALOG_PATH = "docs/template/system-catalog.json";
const PROVENANCE_PATH = "docs/template/generated/provenance";

export type ProductTopologyFinding = {
  readonly subject: string;
  readonly issue: string;
};

export type GeneratedResourceOwnership = {
  readonly path: string;
  readonly system: string;
  readonly disposition: "reuse" | "extend";
};

export type ProductTopologyFileSystem = {
  readonly exists: (path: string) => boolean;
  readonly discoveredPaths: () => readonly string[];
  readonly generatedOwnership: () => readonly GeneratedResourceOwnership[];
};

const filesIn = (
  root: string,
  directory: string,
  predicate: (name: string) => boolean,
): readonly string[] => {
  const fullPath = join(root, directory);
  if (!existsSync(fullPath)) return [];
  return readdirSync(fullPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => `${directory}/${entry.name}`);
};

const jsonFilesRecursively = (
  root: string,
  directory: string,
): readonly string[] => {
  const fullPath = join(root, directory);
  if (!existsSync(fullPath)) return [];
  return readdirSync(fullPath, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return jsonFilesRecursively(root, relativePath);
    return entry.isFile() && entry.name.endsWith(".json") ? [relativePath] : [];
  });
};

const discoverProductionPaths = (root: string): readonly string[] =>
  [
    ...filesIn(root, "packages/convex/confect/capabilities", (name) =>
      name.endsWith(".spec.ts"),
    ),
    ...filesIn(root, "packages/convex/confect/workflowContracts", (name) =>
      name.endsWith(".spec.ts"),
    ),
    ...filesIn(root, "packages/convex/confect/agents", (name) =>
      name.endsWith(".spec.ts"),
    ),
    ...filesIn(root, "packages/convex/confect/jobs", (name) =>
      name.endsWith(".spec.ts"),
    ),
    ...filesIn(root, "apps/web/src/routes", (name) =>
      /^_workspace\..+\.tsx$/.test(name),
    ),
    ...filesIn(
      root,
      "packages/integrations/src",
      (name) =>
        name.endsWith(".ts") &&
        !name.endsWith(".test.ts") &&
        name !== "index.ts",
    ),
    ...[
      "packages/notifications/src/index.ts",
      "packages/observability/src/index.ts",
      "packages/search/src/index.ts",
      "packages/storage/src/index.ts",
      "packages/convex/confect/workflows/runGraph.ts",
    ].filter((path) => existsSync(join(root, path))),
    ...filesIn(root, "packages/convex/confect/headless", (name) =>
      name.endsWith(".ts"),
    ),
    ...filesIn(root, "packages/convex/confect/manifest", (name) =>
      name.endsWith(".ts"),
    ),
  ].sort();

const readGeneratedOwnership = (
  root: string,
): readonly GeneratedResourceOwnership[] =>
  jsonFilesRecursively(root, PROVENANCE_PATH).flatMap((path) => {
    const value = JSON.parse(readFileSync(join(root, path), "utf8")) as {
      readonly ownership?: {
        readonly system?: unknown;
        readonly disposition?: unknown;
      };
      readonly generatedPaths?: readonly unknown[];
    };
    const system = value.ownership?.system;
    const disposition = value.ownership?.disposition;
    if (
      typeof system !== "string" ||
      (disposition !== "reuse" && disposition !== "extend") ||
      !Array.isArray(value.generatedPaths)
    ) {
      return [];
    }
    return value.generatedPaths.flatMap((generatedPath) =>
      typeof generatedPath === "string"
        ? [{ path: generatedPath, system, disposition }]
        : [],
    );
  });

const repoFileSystem = (root: string): ProductTopologyFileSystem => ({
  exists: (path) => existsSync(join(root, path)),
  discoveredPaths: () => discoverProductionPaths(root),
  generatedOwnership: () => readGeneratedOwnership(root),
});

export const validateSystemTopology = (
  systems: SystemCatalog,
  topology: ProductTopology,
  fileSystem: ProductTopologyFileSystem,
): readonly ProductTopologyFinding[] => {
  const findings: ProductTopologyFinding[] = [];
  const systemsById = new Map(
    systems.systems.map((system) => [system.id, system]),
  );
  const resourcesByPath = new Map(
    topology.resources.map((resource) => [resource.path, resource]),
  );
  const generatedByPath = new Map(
    fileSystem
      .generatedOwnership()
      .map((ownership) => [ownership.path, ownership]),
  );

  for (const resource of topology.resources) {
    if (!fileSystem.exists(resource.path)) {
      findings.push({
        subject: resource.id,
        issue: `registered topology path does not exist: ${resource.path}`,
      });
    }
    const owner = systemsById.get(resource.system);
    if (owner === undefined) {
      findings.push({
        subject: resource.id,
        issue: `unknown canonical system: ${resource.system}`,
      });
    } else if (
      owner.lifecycle !== "active" &&
      resource.lifecycle === "active"
    ) {
      findings.push({
        subject: resource.id,
        issue: `active resource cannot belong to ${owner.lifecycle} system ${owner.id}`,
      });
    }
    for (const dependency of resource.uses) {
      if (!systemsById.has(dependency)) {
        findings.push({
          subject: resource.id,
          issue: `unknown canonical system dependency: ${dependency}`,
        });
      }
    }
  }

  for (const ownership of fileSystem.generatedOwnership()) {
    const owner = systemsById.get(ownership.system);
    if (owner === undefined) {
      findings.push({
        subject: ownership.path,
        issue: `generated resource names unknown canonical system: ${ownership.system}`,
      });
      continue;
    }
    if (owner.lifecycle !== "active") {
      findings.push({
        subject: ownership.path,
        issue: `generated resource belongs to ${owner.lifecycle} system ${owner.id}`,
      });
    }
    const registered = resourcesByPath.get(ownership.path);
    if (registered !== undefined && registered.system !== ownership.system) {
      findings.push({
        subject: ownership.path,
        issue: `generated owner ${ownership.system} conflicts with topology owner ${registered.system}`,
      });
    }
  }

  for (const path of fileSystem.discoveredPaths()) {
    if (!resourcesByPath.has(path) && !generatedByPath.has(path)) {
      findings.push({
        subject: path,
        issue:
          "production resource has no canonical owner or generated ownership provenance",
      });
    }
  }

  return findings;
};

export const checkSystemTopology = (
  root = ROOT,
): readonly ProductTopologyFinding[] => {
  const systems = parseSystemCatalog(
    JSON.parse(
      readFileSync(join(root, SYSTEM_CATALOG_PATH), "utf8"),
    ) as unknown,
  );
  const topology = parseProductTopology(
    JSON.parse(readFileSync(join(root, TOPOLOGY_PATH), "utf8")) as unknown,
  );
  return validateSystemTopology(systems, topology, repoFileSystem(root));
};

const main = (): void => {
  try {
    const findings = checkSystemTopology();
    if (findings.length > 0) {
      console.error("x product system topology invalid:");
      for (const finding of findings) {
        console.error(`  - ${finding.subject}: ${finding.issue}`);
      }
      process.exitCode = 1;
      return;
    }

    const topology = parseProductTopology(
      JSON.parse(readFileSync(join(ROOT, TOPOLOGY_PATH), "utf8")) as unknown,
    );
    const kinds = [...new Set(topology.resources.map(({ kind }) => kind))];
    console.log(
      `ok system topology - ${String(topology.resources.length)} production resources across ${String(kinds.length)} kinds`,
    );
  } catch (error: unknown) {
    console.error(
      `x product system topology invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
