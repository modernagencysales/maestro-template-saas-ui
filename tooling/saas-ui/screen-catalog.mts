import { createHash } from "node:crypto";
import {
  access,
  lstat,
  readFile,
  readdir,
  readlink,
  writeFile,
} from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import prettier from "prettier";

const pins = {
  starter: "b76cb4514b9ab47f7db87901cb9b593b4adc3129",
  pro: "ac3a40c8dc05e403f9d501a87c092646891d3c40",
} as const;

type CatalogOptions = Readonly<{ proRoot: string; starterRoot: string }>;
type Repository = "pro" | "starter";
type ClosureEntry = Readonly<{
  source: string;
  sha256: string;
}>;
type HashedSourceEntry = Readonly<{
  id: string;
  source: string;
  sha256: string;
}>;
type SourceEntry = HashedSourceEntry &
  Readonly<{
    closure: readonly ClosureEntry[];
    closureSha256: string;
  }>;
type RouteEntry = SourceEntry &
  Readonly<{
    route: string;
    name: string;
    composition?: string;
  }>;
type StoryEntry = SourceEntry &
  Readonly<{
    title: string;
    variants: readonly string[];
    preview: "pro-storybook" | "starter-storybook";
  }>;

export type ScreenCatalog = Readonly<{
  schemaVersion: 1;
  pins: typeof pins;
  repositories: Readonly<{ starter: string; pro: string }>;
  selectionOrder: readonly string[];
  sources: Readonly<{
    fullDemo: string;
    proStorybook: string;
    starter: string;
  }>;
  demoRoutes: readonly RouteEntry[];
  demoStates: readonly RouteEntry[];
  stories: readonly StoryEntry[];
  starterRoutes: readonly RouteEntry[];
  starterStories: readonly StoryEntry[];
}>;

type VendorReceipt = Readonly<{
  schemaVersion: 1;
  sources: readonly Readonly<{
    id: string;
    commit: string;
    root: string;
    files: number;
  }>[];
  entries: readonly (HashedSourceEntry &
    Readonly<{ kind: "file" | "symlink" }>)[];
}>;

const ignoredDirectories = new Set([".git", "node_modules"]);

function portablePath(path: string): string {
  return path.split(sep).join("/");
}

function hash(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

const moduleExtensions = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
] as const;

function importedSpecifiers(content: string): readonly string[] {
  return [
    ...content.matchAll(
      /(?:\bimport\s*(?:[^"'`]*?\sfrom\s*)?|\bexport\s+(?:type\s+)?[^"'`]*?\sfrom\s*|\bimport\s*\(|\brequire\s*\()\s*["'`]([^"'`]+)["'`]/gu,
    ),
  ].flatMap((match) => (match[1] ? [match[1]] : []));
}

function starterImportBase(
  root: string,
  importer: string,
  specifier: string,
): string | undefined {
  if (specifier.startsWith(".")) return resolve(importer, "..", specifier);
  if (specifier.startsWith("#/"))
    return resolve(root, "apps/web/src", specifier.slice(2));
  if (specifier.startsWith("#"))
    return resolve(
      root,
      "apps/web/src",
      specifier.slice(1).replace(/^\//u, ""),
    );
  if (specifier.startsWith("@/"))
    return resolve(root, "apps/web/src", specifier.slice(2));
  return undefined;
}

function proImportBase(
  root: string,
  importer: string,
  specifier: string,
): string | undefined {
  if (specifier.startsWith(".")) return resolve(importer, "..", specifier);
  if (specifier.startsWith("#")) {
    return resolve(
      root,
      "apps/demo/src",
      specifier.slice(1).replace(/^\//u, ""),
    );
  }
  if (specifier === "@saas-ui/auth-provider")
    return resolve(root, "apps/demo/src/lib/auth-provider");
  const packageImport = specifier.match(
    /^@saas-ui-pro\/(react|billing|onboarding|feature-flags|kanban)(?:\/(.+))?$/u,
  );
  if (packageImport?.[1]) {
    const subpath = packageImport[2] ?? "index";
    return resolve(root, `packages/${packageImport[1]}/src/${subpath}`);
  }
  return undefined;
}

function localImportBase(
  root: string,
  importer: string,
  specifier: string,
  repository: Repository,
): string | undefined {
  return repository === "starter"
    ? starterImportBase(root, importer, specifier)
    : proImportBase(root, importer, specifier);
}

async function existingModule(base: string): Promise<string | undefined> {
  const candidates = moduleExtensions.flatMap((extension) => [
    `${base}${extension}`,
    join(base, `index${extension}`),
  ]);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      if ((await lstat(candidate)).isFile()) return candidate;
    } catch {
      // An unresolved candidate can be an external package export.
    }
  }
  return undefined;
}

async function importClosure(
  root: string,
  entry: string,
  repository: Repository,
): Promise<readonly ClosureEntry[]> {
  const pending = [join(root, entry)];
  const visited = new Set<string>();
  const closure: ClosureEntry[] = [];

  while (pending.length > 0) {
    const path = pending.pop();
    if (!path || visited.has(path)) continue;
    visited.add(path);
    const content = await readFile(path);
    closure.push({
      source: portablePath(relative(root, path)),
      sha256: hash(content),
    });
    const text = content.toString("utf8");
    for (const specifier of importedSpecifiers(text)) {
      const base = localImportBase(root, path, specifier, repository);
      if (!base) continue;
      const dependency = await existingModule(base);
      if (dependency && dependency.startsWith(`${root}${sep}`))
        pending.push(dependency);
    }
  }

  return closure.sort((left, right) =>
    left.source.localeCompare(right.source, "en"),
  );
}

function closureHash(closure: readonly ClosureEntry[]): string {
  return hash(
    closure.map(({ source, sha256 }) => `${source}\0${sha256}`).join("\n"),
  );
}

async function filesUnder(root: string): Promise<readonly string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    for (const entry of (
      await readdir(directory, { withFileTypes: true })
    ).sort((left, right) => left.name.localeCompare(right.name, "en"))) {
      if (ignoredDirectories.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() || entry.isSymbolicLink()) files.push(path);
    }
  }

  await visit(root);
  return files;
}

function screenName(route: string): string {
  const segment = route
    .split("/")
    .filter(Boolean)
    .filter((part) => !part.startsWith("[") && !part.startsWith("$"))
    .at(-1);
  if (!segment) return "Dashboard";
  return segment
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function nextRoute(source: string): string {
  const segments = source
    .slice("apps/demo/src/app/".length, -"/page.tsx".length)
    .split("/")
    .filter((segment) => !/^\(.+\)$/.test(segment));
  return `/${segments.join("/")}`.replace(/\/$/, "") || "/";
}

function tanstackRoute(content: string): string | undefined {
  const declared = content.match(/createFileRoute\(\s*["']([^"']+)["']/)?.[1];
  if (!declared) return undefined;
  const segments = declared
    .split("/")
    .filter(Boolean)
    .filter((segment) => !segment.startsWith("_"));
  return `/${segments.join("/")}`.replace(/\/$/, "") || "/";
}

function primaryComposition(
  content: string,
  prefix: string,
  repository: Repository,
): string | undefined {
  const specifier = [...content.matchAll(/from\s+["']([^"']+)["']/g)]
    .map((match) => match[1])
    .find((value) => value?.startsWith(prefix));
  if (!specifier) return undefined;
  if (repository === "starter")
    return specifier
      .replace(/^#/, "apps/web/src/")
      .replace(/^@\//, "apps/web/src/");
  return specifier.replace(/^#/, "apps/demo/src/");
}

function storyTitle(content: string, source: string): string {
  return (
    content.match(/\btitle\s*:\s*["'`]([^"'`]+)["'`]/)?.[1] ??
    basename(source).replace(/\.stories\.[^.]+$/, "")
  );
}

function storyVariants(content: string): readonly string[] {
  return [
    ...content.matchAll(
      /^export\s+(?:const|function)\s+([A-Z][A-Za-z0-9_]*)/gm,
    ),
  ]
    .flatMap((match) => (match[1] ? [match[1]] : []))
    .sort((left, right) => left.localeCompare(right, "en"));
}

async function routeEntry(
  root: string,
  source: string,
  route: string,
  options: Readonly<{
    idPrefix: string;
    compositionPrefix: string;
    repository: Repository;
  }>,
): Promise<RouteEntry> {
  const content = await readFile(join(root, source), "utf8");
  const composition = primaryComposition(
    content,
    options.compositionPrefix,
    options.repository,
  );
  const closure = await importClosure(root, source, options.repository);
  return {
    id: `${options.idPrefix}:${source}`,
    route,
    name: screenName(route),
    source,
    ...(composition ? { composition } : {}),
    sha256: hash(content),
    closure,
    closureSha256: closureHash(closure),
  };
}

async function storyEntry(
  root: string,
  source: string,
  preview: StoryEntry["preview"],
  idPrefix: string,
  repository: Repository,
): Promise<StoryEntry> {
  const content = await readFile(join(root, source), "utf8");
  const closure = await importClosure(root, source, repository);
  return {
    id: `${idPrefix}:${source}`,
    title: storyTitle(content, source),
    source,
    variants: storyVariants(content),
    preview,
    sha256: hash(content),
    closure,
    closureSha256: closureHash(closure),
  };
}

export async function buildScreenCatalog({
  proRoot,
  starterRoot,
}: CatalogOptions): Promise<ScreenCatalog> {
  const proFiles = (await filesUnder(proRoot)).map((path) =>
    portablePath(relative(proRoot, path)),
  );
  const starterFiles = (await filesUnder(starterRoot)).map((path) =>
    portablePath(relative(starterRoot, path)),
  );
  const demoRouteSources = proFiles.filter(
    (source) =>
      source.startsWith("apps/demo/src/app/") && source.endsWith("/page.tsx"),
  );
  const storySources = proFiles.filter((source) =>
    /\.stories\.(?:ts|tsx)$/.test(source),
  );
  const demoStateSources = [
    "apps/demo/src/app/error.tsx",
    "apps/demo/src/app/not-found.tsx",
  ].filter((source) => proFiles.includes(source));
  const starterRouteSources = starterFiles.filter(
    (source) =>
      source.startsWith("apps/web/src/routes/") &&
      source.endsWith(".tsx") &&
      !source.includes("/api/") &&
      !source.endsWith("/__root.tsx"),
  );
  const starterStorySources = starterFiles.filter((source) =>
    /\.stories\.(?:ts|tsx)$/.test(source),
  );

  const demoRoutes = await Promise.all(
    demoRouteSources.map((source) =>
      routeEntry(proRoot, source, nextRoute(source), {
        idPrefix: "pro-demo",
        compositionPrefix: "#features/",
        repository: "pro",
      }),
    ),
  );
  const stories = await Promise.all(
    storySources.map((source) =>
      storyEntry(proRoot, source, "pro-storybook", "pro-story", "pro"),
    ),
  );
  const demoStates = await Promise.all(
    demoStateSources.map((source) =>
      routeEntry(
        proRoot,
        source,
        source.endsWith("not-found.tsx") ? "/_not-found" : "/_error",
        {
          idPrefix: "pro-demo-state",
          compositionPrefix: "#features/",
          repository: "pro",
        },
      ),
    ),
  );
  const starterRoutes = (
    await Promise.all(
      starterRouteSources.map(async (source) => {
        const content = await readFile(join(starterRoot, source), "utf8");
        const route = tanstackRoute(content);
        return route
          ? routeEntry(starterRoot, source, route, {
              idPrefix: "starter-route",
              compositionPrefix: "#features/",
              repository: "starter",
            })
          : undefined;
      }),
    )
  ).filter((entry): entry is RouteEntry => Boolean(entry));
  const starterStories = await Promise.all(
    starterStorySources.map((source) =>
      storyEntry(
        starterRoot,
        source,
        "starter-storybook",
        "starter-story",
        "starter",
      ),
    ),
  );

  const bySource = <T extends SourceEntry>(left: T, right: T): number =>
    left.source.localeCompare(right.source, "en");
  return {
    schemaVersion: 1,
    pins,
    repositories: {
      starter: "https://github.com/saas-js/tanstack-start-starter-kit-pro.git",
      pro: "https://github.com/saas-js/saas-ui-pro.git",
    },
    selectionOrder: [
      "saas-ui-pro full demo screen",
      "saas-ui-pro assembled Storybook block or template",
      "TanStack Starter screen",
      "loose primitive only when no assembled source applies",
    ],
    sources: {
      fullDemo: "repos/saas-ui-pro/apps/demo",
      proStorybook: "repos/saas-ui-pro/packages/storybook",
      starter: "repos/tanstack-start-starter-kit-pro",
    },
    demoRoutes: demoRoutes.sort(bySource),
    demoStates: demoStates.sort(bySource),
    stories: stories.sort(bySource),
    starterRoutes: starterRoutes.sort(bySource),
    starterStories: starterStories.sort(bySource),
  };
}

export async function buildVendorReceipt({
  proRoot,
  starterRoot,
}: CatalogOptions): Promise<VendorReceipt> {
  const specifications = [
    {
      id: "saas-ui-pro",
      root: proRoot,
      commit: pins.pro,
      repositoryRoot: "repos/saas-ui-pro",
    },
    {
      id: "tanstack-start-starter-kit-pro",
      root: starterRoot,
      commit: pins.starter,
      repositoryRoot: "repos/tanstack-start-starter-kit-pro",
    },
  ] as const;
  const entries: Array<
    HashedSourceEntry & Readonly<{ kind: "file" | "symlink" }>
  > = [];
  const sources: Array<{
    id: string;
    commit: string;
    root: string;
    files: number;
  }> = [];

  for (const specification of specifications) {
    const files = await filesUnder(specification.root);
    sources.push({
      id: specification.id,
      commit: specification.commit,
      root: specification.repositoryRoot,
      files: files.length,
    });
    for (const path of files) {
      const source = portablePath(relative(specification.root, path));
      const statistics = await lstat(path);
      const kind = statistics.isSymbolicLink() ? "symlink" : "file";
      entries.push({
        id: specification.id,
        source,
        kind,
        sha256: hash(
          kind === "symlink" ? await readlink(path) : await readFile(path),
        ),
      });
    }
  }

  return {
    schemaVersion: 1,
    sources,
    entries: entries.sort((left, right) =>
      `${left.id}:${left.source}`.localeCompare(
        `${right.id}:${right.source}`,
        "en",
      ),
    ),
  };
}

export async function verifyVendoredScreenCatalog(
  root: string,
): Promise<readonly string[]> {
  const proRoot = join(root, "repos/saas-ui-pro");
  const starterRoot = join(root, "repos/tanstack-start-starter-kit-pro");
  const expectedCatalog = await buildScreenCatalog({ proRoot, starterRoot });
  const expectedReceipt = await buildVendorReceipt({ proRoot, starterRoot });
  const differences: string[] = [];
  const committedCatalog = JSON.parse(
    await readFile(
      join(root, "docs/template/saas-ui-screen-catalog.json"),
      "utf8",
    ),
  );
  const committedReceipt = JSON.parse(
    await readFile(
      join(root, "docs/template/saas-ui-vendor-receipt.json"),
      "utf8",
    ),
  );
  if (JSON.stringify(committedCatalog) !== JSON.stringify(expectedCatalog))
    differences.push("Saas UI screen catalogue is stale");
  if (JSON.stringify(committedReceipt) !== JSON.stringify(expectedReceipt))
    differences.push("vendored Saas UI source receipt is stale");
  return differences;
}

export async function verifyShippedScreenCatalog(
  root: string,
): Promise<readonly string[]> {
  try {
    const catalog = JSON.parse(
      await readFile(
        join(root, "docs/template/saas-ui-screen-catalog.json"),
        "utf8",
      ),
    ) as Partial<ScreenCatalog>;
    const receipt = JSON.parse(
      await readFile(
        join(root, "docs/template/saas-ui-vendor-receipt.json"),
        "utf8",
      ),
    ) as Partial<VendorReceipt>;
    const collections = [
      catalog.demoRoutes,
      catalog.demoStates,
      catalog.stories,
      catalog.starterRoutes,
      catalog.starterStories,
    ];
    if (
      catalog.schemaVersion !== 1 ||
      receipt.schemaVersion !== 1 ||
      !collections.every(Array.isArray) ||
      !Array.isArray(receipt.entries) ||
      !Array.isArray(receipt.sources)
    )
      return ["shipped Saas UI screen authority is malformed"];
    const entries = collections.flatMap((collection) => collection ?? []);
    if (
      entries.some(
        (entry) =>
          !entry.closure.length ||
          entry.sha256 !==
            entry.closure.find(({ source }) => source === entry.source)
              ?.sha256 ||
          entry.closureSha256 !== closureHash(entry.closure),
      )
    )
      return ["shipped Saas UI screen closure is invalid"];
    return [];
  } catch {
    return ["shipped Saas UI screen authority is unreadable"];
  }
}

async function main(): Promise<void> {
  const root = resolve(import.meta.dirname, "../..");
  const proRoot = join(root, "repos/saas-ui-pro");
  const starterRoot = join(root, "repos/tanstack-start-starter-kit-pro");
  if (process.argv.includes("--check")) {
    let vendored = true;
    try {
      await access(proRoot);
      await access(starterRoot);
    } catch {
      vendored = false;
    }
    const differences = vendored
      ? await verifyVendoredScreenCatalog(root)
      : await verifyShippedScreenCatalog(root);
    if (differences.length > 0) {
      process.stderr.write(`${differences.join("\n")}\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write(
        vendored
          ? "Vendored Saas UI screen catalogue verified.\n"
          : "Shipped Saas UI screen authority verified.\n",
      );
    }
    return;
  }
  const catalog = await buildScreenCatalog({ proRoot, starterRoot });
  const receipt = await buildVendorReceipt({ proRoot, starterRoot });
  const catalogJson = await prettier.format(JSON.stringify(catalog), {
    parser: "json",
  });
  const receiptJson = await prettier.format(JSON.stringify(receipt), {
    parser: "json",
  });
  await writeFile(
    join(root, "docs/template/saas-ui-screen-catalog.json"),
    catalogJson,
  );
  await writeFile(
    join(root, "docs/template/saas-ui-vendor-receipt.json"),
    receiptJson,
  );
  process.stdout.write(
    `Indexed ${catalog.demoRoutes.length} Pro demo routes, ${catalog.demoStates.length} Pro route states, ${catalog.stories.length} Pro story files, ${catalog.starterRoutes.length} Starter routes, and ${catalog.starterStories.length} Starter story files.\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
