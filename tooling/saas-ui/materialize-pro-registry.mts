import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  extname,
  join,
  normalize,
  relative,
  resolve,
} from "node:path";
import prettier from "prettier";
import { discoverRegistryItems } from "@saas-ui/registry/compiler";

type JsonRecord = Record<string, unknown>;
type FileRecord = Readonly<{
  path: string;
  source: string;
  sourceSha256: string;
  sha256: string;
}>;
type RegistryReceipt = Readonly<{
  schemaVersion: 1;
  sourceCommit: string;
  installed: readonly string[];
  files: readonly Readonly<{
    source: string;
    destination: string;
    sourceSha256: string;
    sha256: string;
    adapted: boolean;
  }>[];
}>;

export type RegistryMaterialization = Readonly<{
  installed: readonly string[];
  items: readonly Readonly<{ name: string; sourceConfig: string }>[];
  files: readonly FileRecord[];
  plannedHashes: Readonly<Record<string, string>>;
  externalDependencies: Readonly<Record<string, string>>;
  conflicts: readonly string[];
  unresolvedImports: readonly string[];
  receipt: RegistryReceipt;
}>;

export type RegistryProjectionComparison = Readonly<{
  sourceCommit: string;
  registryIds: readonly string[];
  items: readonly Readonly<{ name: string; sourceConfig: string }>[];
  files: readonly FileRecord[];
  differences: readonly string[];
}>;

type MaterializeOptions = Readonly<{ proRoot: string; targetRoot: string }>;
type SourceFile = Readonly<{
  source: string;
  destination: string;
  content: string;
  sourceSha256: string;
}>;
type PublicImportRequest = Readonly<{ specifier: string; from?: string }>;
type PublicCatalogItem = Readonly<{
  name: string;
  type?: string;
  dependencies?: readonly string[];
  files?: readonly Readonly<{ path: string; content: string; type?: string }>[];
}>;

const sourceExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
]);
const ignoredNames = new Set([
  "component.config.ts",
  "attributes.json",
  "package.json",
  "tsconfig.json",
  "vitest.config.ts",
]);
const knownVersions: Readonly<Record<string, string>> = {
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/modifiers": "^9.0.0",
  "@dnd-kit/sortable": "^10.0.0",
  "@dnd-kit/utilities": "^3.2.2",
  "@ark-ui/react": "5.30.0",
  "@saas-ui/assets": "^2.0.0-next.0",
  "@saas-ui/chakra-preset": "3.0.0-next.10",
  "@saas-ui/hooks": "3.0.0-next.4",
  "@tanstack/react-form": "^1.33.2",
  "framer-motion": "^12.23.24",
  "react-icons": "^5.5.0",
  "next-themes": "0.4.6",
  zod: "4.1.5",
};
const proSourceCommit = "ac3a40c8dc05e403f9d501a87c092646891d3c40";

export function verifyProSourceCommit(
  proRoot: string,
  expectedCommit = proSourceCommit,
): string {
  const actual = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: proRoot,
    encoding: "utf8",
  }).trim();
  if (actual !== expectedCommit)
    throw new Error(
      `Saas UI Pro checkout ${actual}; expected ${expectedCommit}`,
    );
  const status = execFileSync(
    "git",
    [
      "status",
      "--porcelain",
      "--ignored",
      "--untracked-files=all",
      "--",
      "packages/blocks",
      "packages/registry/public/public-catalog.json",
      "packages/react/package.json",
    ],
    { cwd: proRoot, encoding: "utf8" },
  ).trim();
  if (status)
    throw new Error(`Saas UI Pro working tree is not clean: ${proRoot}`);
  return actual;
}

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function packageName(specifier: string): string {
  if (specifier.startsWith("@"))
    return specifier.split("/").slice(0, 2).join("/");
  return specifier.split("/")[0] ?? specifier;
}

function importedSpecifiers(source: string): readonly string[] {
  return [
    ...[
      ...source.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g),
    ].flatMap((match) => (match[1] ? [match[1]] : [])),
    ...[...source.matchAll(/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g)].flatMap(
      (match) => (match[1] ? [match[1]] : []),
    ),
  ];
}

function rewriteAliases(content: string): string {
  return content
    .replace(/#registry\/default\//g, "@/components/")
    .replace(/@\/registry\/default\//g, "@/components/")
    .replace(/#hooks\//g, "@/hooks/")
    .replace(/#components\//g, "@/components/")
    .replace(/#lib\//g, "@/lib/")
    .replace(/#utils\//g, "@/lib/")
    .replace(/(["'])((?:\.\.?\/|@\/|#)[^"']+)\.(?:tsx?|jsx?)(["'])/g, "$1$2$3");
}

function isSourceFile(name: string): boolean {
  return (
    sourceExtensions.has(extname(name)) &&
    !name.endsWith(".stories.tsx") &&
    !name.endsWith(".test.tsx") &&
    !name.endsWith(".test.ts")
  );
}

async function collectSourceFiles(
  root: string,
  destinationRoot: string,
): Promise<SourceFile[]> {
  const result: SourceFile[] = [];
  const visit = async (directory: string) => {
    for (const entry of (
      await readdir(directory, { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      if (entry.name === "node_modules" || ignoredNames.has(entry.name))
        continue;
      const source = join(directory, entry.name);
      if (entry.isDirectory()) await visit(source);
      else if (isSourceFile(entry.name)) {
        const sourceContent = await readFile(source, "utf8");
        result.push({
          source,
          destination: join(destinationRoot, relative(root, source)),
          content: rewriteAliases(sourceContent),
          sourceSha256: hash(sourceContent),
        });
      }
    }
  };
  await visit(root);
  return result;
}

export async function discoverComponentConfigs(
  blocksRoot: string,
): Promise<readonly string[]> {
  const result: string[] = [];
  const visit = async (directory: string) => {
    for (const entry of (
      await readdir(directory, { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      if (entry.name === "node_modules") continue;
      const source = join(directory, entry.name);
      if (entry.isDirectory()) await visit(source);
      else if (entry.name === "component.config.ts") result.push(source);
    }
  };
  await visit(resolve(blocksRoot));
  return result.sort((a, b) => a.localeCompare(b, "en"));
}

async function readCatalog(
  proRoot: string,
): Promise<readonly PublicCatalogItem[]> {
  const catalogPath = join(
    proRoot,
    "packages/registry/public/public-catalog.json",
  );
  const value = JSON.parse(await readFile(catalogPath, "utf8")) as unknown;
  if (!Array.isArray(value))
    throw new Error(`Pinned registry catalog is not an array: ${catalogPath}`);
  return value as PublicCatalogItem[];
}

export async function discoverInstallableItems(
  proRoot: string,
): Promise<readonly Readonly<{ name: string; sourceConfig: string }>[]> {
  const packagesRoot = join(proRoot, "packages");
  const { items } = await discoverRegistryItems({
    sourceRoots: [
      {
        basePath: packagesRoot,
        path: join(packagesRoot, "blocks"),
        style: "default",
        type: "registry:block",
      },
      {
        basePath: join(packagesRoot, "blocks"),
        path: join(packagesRoot, "blocks/hooks"),
        style: "default",
        type: "registry:hook",
      },
    ],
  });
  const discovered = items.flatMap((item) => {
    if (item.type === "registry:block" && !item.configPath) return [];
    const sourceConfig =
      item.configPath ?? join(item.sourceDirectory, `${item.name}.ts`);
    return [{ name: item.name, sourceConfig }];
  });
  const unique = discovered.filter(
    (item, index) =>
      discovered.findIndex(
        (candidate) =>
          candidate.name === item.name &&
          candidate.sourceConfig === item.sourceConfig,
      ) === index,
  );
  const duplicates = [
    ...new Set(
      unique
        .filter(
          ({ name }, index) =>
            unique.findIndex((item) => item.name === name) !== index,
        )
        .map(({ name }) => name),
    ),
  ].sort((left, right) => left.localeCompare(right, "en"));
  if (duplicates.length > 0)
    throw new Error(
      duplicates.map((name) => `duplicate registry root: ${name}`).join("\n"),
    );
  return unique.sort((left, right) =>
    left.name.localeCompare(right.name, "en"),
  );
}

function publicFileStem(path: string): string {
  return path.replace(/\.(?:tsx?|jsx?)$/, "");
}

function publicItemForImport(
  catalog: readonly PublicCatalogItem[],
  specifier: string,
): PublicCatalogItem | undefined {
  const suffix = specifier
    .replace(/^#registry\/default\//, "")
    .replace(/^@\/components\//, "");
  const normalizedSuffix = publicFileStem(suffix);
  return catalog.find((item) =>
    item.files?.some((file) => publicFileStem(file.path) === normalizedSuffix),
  );
}

function publicImportRequest(
  specifier: string,
  from: string | undefined,
): PublicImportRequest | undefined {
  if (
    specifier.startsWith("#registry/default/") ||
    specifier.startsWith("@/components/")
  )
    return { specifier };
  if (!from || !specifier.startsWith(".")) return undefined;
  const path = normalize(join(dirname(from), specifier)).replace(
    /\.(?:tsx?|jsx?)$/,
    "",
  );
  return { specifier: `@/components/${path}` };
}

async function collectPublicDependencies(
  catalog: readonly PublicCatalogItem[],
  roots: readonly SourceFile[],
  targetRoot: string,
): Promise<{ files: SourceFile[]; dependencies: Set<string> }> {
  const files: SourceFile[] = [];
  const dependencies = new Set<string>();
  const queue = roots
    .flatMap((file) => importedSpecifiers(file.content))
    .map((specifier) => publicImportRequest(specifier, undefined))
    .filter((request): request is PublicImportRequest => request !== undefined);
  const seen = new Set<string>();
  while (queue.length > 0) {
    const request = queue.shift();
    if (!request) break;
    const item = publicItemForImport(catalog, request.specifier);
    if (!item || seen.has(item.name)) continue;
    seen.add(item.name);
    for (const dependency of item.dependencies ?? [])
      dependencies.add(dependency);
    for (const file of item.files ?? []) {
      const destination = join(targetRoot, "src/components", file.path);
      const content = rewriteAliases(file.content);
      files.push({
        source: `registry:${item.name}/${file.path}`,
        destination,
        content,
        sourceSha256: hash(file.content),
      });
      queue.push(
        ...importedSpecifiers(content)
          .map((imported) => publicImportRequest(imported, file.path))
          .filter(
            (request): request is PublicImportRequest => request !== undefined,
          ),
      );
    }
  }
  return { files, dependencies };
}

async function readProDependencies(
  proRoot: string,
): Promise<Readonly<Record<string, string>>> {
  const packageFiles = [
    join(proRoot, "packages/blocks/package.json"),
    join(proRoot, "packages/react/package.json"),
  ];
  const versions: Record<string, string> = { ...knownVersions };
  for (const file of packageFiles) {
    if (!existsSync(file)) continue;
    const value = JSON.parse(await readFile(file, "utf8")) as JsonRecord;
    for (const section of ["dependencies", "devDependencies"]) {
      const dependencies = value[section];
      if (!dependencies || typeof dependencies !== "object") continue;
      for (const [name, version] of Object.entries(
        dependencies as JsonRecord,
      )) {
        if (typeof version === "string" && !version.startsWith("workspace:"))
          versions[name] ??= version;
      }
    }
  }
  return versions;
}

async function updatePackageManifest(
  targetRoot: string,
  dependencies: Readonly<Record<string, string>>,
): Promise<void> {
  const packagePath = join(targetRoot, "package.json");
  if (!existsSync(packagePath) || Object.keys(dependencies).length === 0)
    return;
  const manifest = JSON.parse(
    await readFile(packagePath, "utf8"),
  ) as JsonRecord;
  const current = { ...(manifest.dependencies as JsonRecord | undefined) };
  for (const [name, version] of Object.entries(dependencies))
    if (!(name in current)) current[name] = version;
  manifest.dependencies = Object.fromEntries(
    Object.entries(current).sort(([left], [right]) =>
      left.localeCompare(right, "en"),
    ),
  );
  await writeFile(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function localImportExists(targetRoot: string, specifier: string): boolean {
  const base = join(targetRoot, "src", specifier.slice(2));
  return [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ].some(existsSync);
}

async function writeFiles(
  files: readonly SourceFile[],
  targetRoot: string,
  protectedDestinations: ReadonlySet<string> = new Set(),
): Promise<{ hashes: Record<string, string>; records: FileRecord[] }> {
  const hashes: Record<string, string> = {};
  const records: FileRecord[] = [];
  for (const file of files) {
    await mkdir(dirname(file.destination), { recursive: true });
    const path = relative(targetRoot, file.destination).split("/").join("/");
    const contents =
      protectedDestinations.has(resolve(file.destination)) &&
      existsSync(file.destination)
        ? await readFile(file.destination, "utf8")
        : await prettier.format(file.content, { filepath: file.destination });
    await writeFile(file.destination, contents);
    const sha256 = hash(contents);
    hashes[path] = sha256;
    records.push({
      path,
      source: file.source,
      sourceSha256: file.sourceSha256,
      sha256,
    });
  }
  return {
    hashes,
    records: records.sort((left, right) =>
      left.path.localeCompare(right.path, "en"),
    ),
  };
}

function starterOwnedDestinations(
  projectRoot: string | undefined,
): Set<string> {
  if (!projectRoot) return new Set();
  const receiptPath = join(
    projectRoot,
    "docs/template/saas-ui-starter-files.json",
  );
  if (!existsSync(receiptPath)) return new Set();
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as {
    files?: readonly { destination?: string }[];
  };
  return new Set(
    (receipt.files ?? []).flatMap(({ destination }) =>
      destination ? [resolve(projectRoot, destination)] : [],
    ),
  );
}

function adaptedRegistryFiles(
  projectRoot: string | undefined,
): Map<string, { source: string; sourceSha256: string; sha256: string }> {
  if (!projectRoot) return new Map();
  const path = join(projectRoot, "docs/template/saas-ui-registry-files.json");
  if (!existsSync(path)) return new Map();
  const files =
    (
      JSON.parse(readFileSync(path, "utf8")) as {
        files?: readonly {
          source?: string;
          destination?: string;
          sourceSha256?: string;
          sha256?: string;
          adapted?: boolean;
        }[];
      }
    ).files ?? [];
  return new Map(
    files.flatMap((file) =>
      file.adapted &&
      file.source &&
      file.destination &&
      file.sourceSha256 &&
      file.sha256
        ? [
            [
              resolve(projectRoot, file.destination),
              {
                source: file.source,
                sourceSha256: file.sourceSha256,
                sha256: file.sha256,
              },
            ] as const,
          ]
        : [],
    ),
  );
}

function projectRootFor(targetRoot: string): string | undefined {
  let current = resolve(targetRoot);
  while (true) {
    if (existsSync(join(current, "docs/template/saas-ui-upstream.json")))
      return current;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function registryReceipt(
  projectRoot: string | undefined,
  proRoot: string,
  targetRoot: string,
  installed: readonly string[],
  records: readonly FileRecord[],
  adaptedFiles: ReadonlyMap<string, { sha256: string }>,
): RegistryReceipt {
  return {
    schemaVersion: 1,
    sourceCommit: proSourceCommit,
    installed,
    files: records.map(({ path, source, sourceSha256, sha256 }) => ({
      source: source.startsWith("registry:")
        ? source
        : relative(proRoot, source).split("/").join("/"),
      destination: projectRoot
        ? relative(projectRoot, join(targetRoot, path)).split("/").join("/")
        : path,
      sourceSha256,
      sha256: adaptedFiles.get(resolve(targetRoot, path))?.sha256 ?? sha256,
      adapted: adaptedFiles.has(resolve(targetRoot, path)),
    })),
  };
}

function validateRegistryReceipt(receipt: RegistryReceipt): void {
  if (receipt.schemaVersion !== 1 || receipt.sourceCommit !== proSourceCommit)
    throw new Error("Generated registry receipt has invalid authority");
  if (
    receipt.installed.length === 0 ||
    new Set(receipt.installed).size !== receipt.installed.length
  )
    throw new Error("Generated registry receipt has invalid installed ids");
  const destinations = receipt.files.map(({ destination }) => destination);
  if (
    destinations.length === 0 ||
    new Set(destinations).size !== destinations.length
  )
    throw new Error(
      "Generated registry receipt has duplicate or missing files",
    );
  if (
    destinations.some(
      (destination) =>
        destination.startsWith("/") || destination.includes(".."),
    )
  )
    throw new Error("Generated registry receipt has an unsafe destination");
}

async function writeRegistryReceipt(
  projectRoot: string | undefined,
  receipt: RegistryReceipt,
): Promise<void> {
  validateRegistryReceipt(receipt);
  if (!projectRoot) return;
  const receiptPath = join(
    projectRoot,
    "docs/template/saas-ui-registry-files.json",
  );
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  const persisted = JSON.parse(
    await readFile(receiptPath, "utf8"),
  ) as RegistryReceipt;
  if (JSON.stringify(persisted) !== JSON.stringify(receipt))
    throw new Error(
      "Persisted registry receipt differs from generated receipt",
    );
}

async function collectMaterializedSources(
  resolvedProRoot: string,
  resolvedTargetRoot: string,
  configPaths: readonly string[],
): Promise<SourceFile[]> {
  const sourceFiles: SourceFile[] = [];
  for (const config of configPaths) {
    const blockRoot = dirname(config);
    sourceFiles.push(
      ...(await collectSourceFiles(
        blockRoot,
        join(resolvedTargetRoot, "src/components", basename(blockRoot)),
      )),
    );
  }
  const hooksRoot = join(resolvedProRoot, "packages/blocks/hooks");
  if (existsSync(hooksRoot))
    sourceFiles.push(
      ...(await collectSourceFiles(
        hooksRoot,
        join(resolvedTargetRoot, "src/hooks"),
      )),
    );
  return sourceFiles;
}

async function resolveMaterializedDependencies(
  proRoot: string,
  targetRoot: string,
  sourceFiles: SourceFile[],
): Promise<{
  sourceFiles: SourceFile[];
  declarations: Readonly<Record<string, string>>;
}> {
  const catalog = await readCatalog(proRoot);
  const publicDependencies = await collectPublicDependencies(
    catalog,
    sourceFiles,
    targetRoot,
  );
  sourceFiles.push(...publicDependencies.files);
  const externalDependencies = externalDependencyNames(
    sourceFiles,
    publicDependencies.dependencies,
  );
  const versions = await readProDependencies(proRoot);
  return {
    sourceFiles,
    declarations: dependencyDeclarations(externalDependencies, versions),
  };
}

function externalDependencyNames(
  sourceFiles: readonly SourceFile[],
  initial: ReadonlySet<string>,
): Set<string> {
  const externalDependencies = new Set(initial);
  for (const file of sourceFiles) {
    for (const specifier of importedSpecifiers(file.content)) {
      if (
        specifier.startsWith(".") ||
        specifier.startsWith("@/") ||
        specifier.startsWith("#")
      )
        continue;
      const name = packageName(specifier);
      if (name !== "react" && name !== "react-dom")
        externalDependencies.add(name);
    }
  }
  return externalDependencies;
}

function dependencyDeclarations(
  externalDependencies: ReadonlySet<string>,
  versions: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const declarations: Record<string, string> = {};
  for (const name of [...externalDependencies].sort((left, right) =>
    left.localeCompare(right, "en"),
  )) {
    const version = versions[name];
    if (version && !version.startsWith("workspace:"))
      declarations[name] = version;
  }
  return declarations;
}

function unresolvedImports(
  sourceFiles: readonly SourceFile[],
  targetRoot: string,
): readonly string[] {
  const unresolved: string[] = [];
  for (const file of sourceFiles) {
    for (const specifier of importedSpecifiers(file.content)) {
      if (
        specifier.startsWith("@/") &&
        !localImportExists(targetRoot, specifier)
      )
        unresolved.push(
          `${relative(targetRoot, file.destination)} -> ${specifier}`,
        );
      if (specifier.startsWith("#"))
        unresolved.push(
          `${relative(targetRoot, file.destination)} -> ${specifier}`,
        );
    }
  }
  return [...new Set(unresolved)].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
}

async function updateRegistryManifest(
  projectRoot: string | undefined,
  installed: readonly string[],
): Promise<void> {
  if (!projectRoot) return;
  const manifestPath = join(projectRoot, "docs/template/saas-ui-upstream.json");
  const manifest = JSON.parse(
    await readFile(manifestPath, "utf8"),
  ) as JsonRecord;
  manifest.registry = { ...(manifest.registry as JsonRecord), installed };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

export async function snapshotMaterializedTarget(
  targetRoot: string,
): Promise<Readonly<Record<string, string>>> {
  const result: Record<string, string> = {};
  const visit = async (directory: string) => {
    for (const entry of (
      await readdir(directory, { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      if (entry.name === "node_modules") continue;
      const target = join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      else
        result[relative(targetRoot, target).split("/").join("/")] = hash(
          await readFile(target, "utf8"),
        );
    }
  };
  await visit(targetRoot);
  return result;
}

export async function materializeProRegistry({
  proRoot,
  targetRoot,
}: MaterializeOptions): Promise<RegistryMaterialization> {
  const resolvedProRoot = resolve(proRoot);
  const resolvedTargetRoot = resolve(targetRoot);
  verifyProSourceCommit(resolvedProRoot);
  const projectRoot = projectRootFor(resolvedTargetRoot);
  const configPaths = await discoverComponentConfigs(
    join(resolvedProRoot, "packages/blocks"),
  );
  if (configPaths.length === 0)
    throw new Error(
      `Pinned Pro registry has no component.config.ts files: ${resolvedProRoot}`,
    );
  const items = await discoverInstallableItems(resolvedProRoot);
  const installed = items
    .map(({ name }) => name)
    .sort((left, right) => left.localeCompare(right, "en"));
  const conflicts = [
    ...new Set(
      installed.filter((name, index) => installed.indexOf(name) !== index),
    ),
  ].map((name) => `duplicate registry root: ${name}`);
  if (conflicts.length > 0) throw new Error(conflicts.join("\n"));

  const sourceFiles = await collectMaterializedSources(
    resolvedProRoot,
    resolvedTargetRoot,
    configPaths,
  );
  const resolved = await resolveMaterializedDependencies(
    resolvedProRoot,
    resolvedTargetRoot,
    sourceFiles,
  );
  const { declarations } = resolved;
  const adaptedFiles = adaptedRegistryFiles(projectRoot);
  await updatePackageManifest(resolvedTargetRoot, declarations);

  const config = {
    system: "chakra",
    style: "default",
    rsc: false,
    tsx: true,
    aliases: {
      components: "@/components",
      ui: "@/components/ui",
      lib: "@/lib",
      utils: "@/lib/utils",
      hooks: "@/hooks",
      icons: "@/components/icons",
    },
    installed,
  };
  await mkdir(resolvedTargetRoot, { recursive: true });
  await writeFile(
    join(resolvedTargetRoot, "components.json"),
    `${JSON.stringify(config, null, 2)}\n`,
  );
  const written = await writeFiles(
    resolved.sourceFiles,
    resolvedTargetRoot,
    new Set([...starterOwnedDestinations(projectRoot), ...adaptedFiles.keys()]),
  );
  const uniqueUnresolved = unresolvedImports(
    resolved.sourceFiles,
    resolvedTargetRoot,
  );
  const receipt = registryReceipt(
    projectRoot,
    resolvedProRoot,
    resolvedTargetRoot,
    installed,
    written.records,
    adaptedFiles,
  );
  await writeRegistryReceipt(projectRoot, receipt);
  await updateRegistryManifest(projectRoot, installed);
  return {
    installed,
    items,
    files: written.records,
    plannedHashes: written.hashes,
    externalDependencies: declarations,
    conflicts,
    unresolvedImports: uniqueUnresolved,
    receipt,
  };
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
}

function difference(
  differences: string[],
  label: string,
  actual: unknown,
  expected: unknown,
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    differences.push(
      `${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
}

// eslint-disable-next-line complexity -- compares one pinned projection and its receipt atomically.
export async function compareProRegistryProjection({
  proRoot,
  targetRoot,
}: MaterializeOptions): Promise<RegistryProjectionComparison> {
  const resolvedProRoot = resolve(proRoot);
  const resolvedTargetRoot = resolve(targetRoot);
  const sourceCommit = verifyProSourceCommit(resolvedProRoot);
  const stagingRoot = await mkdtemp(join(tmpdir(), "saas-ui-pro-compare-"));

  try {
    const expected = await materializeProRegistry({
      proRoot: resolvedProRoot,
      targetRoot: join(stagingRoot, "apps/web"),
    });
    const differences: string[] = [];
    const components = JSON.parse(
      await readFile(join(resolvedTargetRoot, "components.json"), "utf8"),
    ) as JsonRecord;
    difference(
      differences,
      "components.json installed registry ids",
      stringArray(components.installed),
      expected.installed,
    );

    const projectRoot = projectRootFor(resolvedTargetRoot);
    if (!projectRoot)
      throw new Error(
        `Unable to locate docs/template/saas-ui-upstream.json for ${resolvedTargetRoot}`,
      );
    const manifest = JSON.parse(
      await readFile(
        join(projectRoot, "docs/template/saas-ui-upstream.json"),
        "utf8",
      ),
    ) as JsonRecord;
    const registry = (manifest.registry ?? {}) as JsonRecord;
    difference(
      differences,
      "upstream manifest installed registry ids",
      stringArray(registry.installed),
      expected.installed,
    );
    difference(
      differences,
      "upstream manifest Pro source commit",
      registry.sourceCommit,
      sourceCommit,
    );

    const receipt = JSON.parse(
      await readFile(
        join(projectRoot, "docs/template/saas-ui-registry-files.json"),
        "utf8",
      ),
    ) as RegistryReceipt;
    difference(
      differences,
      "registry receipt installed registry ids",
      receipt.installed,
      expected.installed,
    );
    difference(
      differences,
      "registry receipt Pro source commit",
      receipt.sourceCommit,
      sourceCommit,
    );
    const receiptFiles = new Map(
      receipt.files.map((file) => [file.destination, file]),
    );
    const targetPrefix = relative(projectRoot, resolvedTargetRoot)
      .split("/")
      .join("/");
    const expectedDestinations = expected.files.map(({ path }) =>
      [targetPrefix, path].filter(Boolean).join("/"),
    );
    difference(
      differences,
      "registry receipt destinations",
      [...receiptFiles.keys()].sort((left, right) =>
        left.localeCompare(right, "en"),
      ),
      expectedDestinations,
    );

    for (const file of expected.files) {
      const destination = [targetPrefix, file.path].filter(Boolean).join("/");
      const receiptFile = receiptFiles.get(destination);
      const expectedSource = file.source.startsWith("registry:")
        ? file.source
        : relative(resolvedProRoot, file.source).split("/").join("/");
      const adapted = receiptFile?.adapted === true;
      if (
        receiptFile?.source !== expectedSource ||
        receiptFile?.sourceSha256 !== file.sourceSha256 ||
        (!adapted && receiptFile?.sha256 !== file.sha256)
      )
        differences.push(
          `registry receipt projection mismatch: ${destination}`,
        );
      try {
        const actualHash = hash(
          await readFile(join(resolvedTargetRoot, file.path), "utf8"),
        );
        if (
          adapted
            ? actualHash !== receiptFile?.sha256
            : actualHash !== file.sha256
        )
          differences.push(`editable registry source drift: ${destination}`);
      } catch {
        differences.push(`editable registry source missing: ${destination}`);
      }
    }

    return {
      sourceCommit,
      registryIds: expected.installed,
      items: expected.items,
      files: expected.files,
      differences,
    };
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

async function main() {
  const proIndex = process.argv.indexOf("--pro-root");
  const proRoot = proIndex >= 0 ? process.argv[proIndex + 1] : undefined;
  if (!proRoot)
    throw new Error(
      "Usage: pnpm saas-ui:materialize -- --pro-root /absolute/path/to/saas-ui-pro",
    );
  const result = await materializeProRegistry({
    proRoot,
    targetRoot: resolve(process.cwd(), "apps/web"),
  });
  if (result.unresolvedImports.length > 0)
    throw new Error(
      `Unresolved local registry imports:\n${result.unresolvedImports.join("\n")}`,
    );
  console.log(
    `Materialized ${result.installed.length} Pro registry roots and ${result.files.length} files.`,
  );
}

if (process.argv[1]?.endsWith("materialize-pro-registry.mts")) await main();
