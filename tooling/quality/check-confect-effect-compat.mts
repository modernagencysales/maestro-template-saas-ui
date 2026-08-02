import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { isDirectRun } from "./src/direct-run.mts";

export type CompatibilityFinding = {
  readonly file: string;
  readonly message: string;
};

type PackageJson = {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
};

const packageFiles = [
  "package.json",
  "packages/convex/package.json",
  "apps/web/package.json",
  "apps/cli/package.json",
  "packages/editor-core/package.json",
  "packages/integrations/package.json",
  "packages/template-core/package.json",
  "tooling/confect-manifest/package.json",
  "tooling/effectified-api-proof/package.json",
] as const;

const readJson = (repoRoot: string, path: string): PackageJson =>
  JSON.parse(readFileSync(join(repoRoot, path), "utf8")) as PackageJson;

const dependencyEntries = (
  repoRoot: string,
  file: string,
): Readonly<Record<string, string>> => {
  if (!existsSync(join(repoRoot, file))) return {};
  const pkg = readJson(repoRoot, file);
  return { ...pkg.dependencies, ...pkg.devDependencies };
};

const walk = (repoRoot: string, dir: string): readonly string[] => {
  const fullDir = join(repoRoot, dir);
  if (!existsSync(fullDir)) return [];

  const out: string[] = [];
  for (const entry of readdirSync(fullDir)) {
    if (["node_modules", "dist", "_generated"].includes(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(join(repoRoot, path));
    if (stat.isDirectory()) out.push(...walk(repoRoot, path));
    if (stat.isFile()) out.push(path);
  }
  return out;
};

const readSource = (repoRoot: string, file: string): string =>
  readFileSync(join(repoRoot, file), "utf8");

const CONFECT_VERSION = "10.0.0-next.9";
const EFFECT_VERSION = "4.0.0-beta.102";

export const checkDependencyCohort = (
  repoRoot = process.cwd(),
): readonly CompatibilityFinding[] => {
  const findings: CompatibilityFinding[] = [];
  const observedConfect = new Set<string>();

  for (const file of packageFiles) {
    const deps = dependencyEntries(repoRoot, file);
    for (const [name, version] of Object.entries(deps)) {
      if (name.startsWith("@confect/")) {
        observedConfect.add(version);
        if (version !== CONFECT_VERSION) {
          findings.push({
            file,
            message: `${name} must be exactly ${CONFECT_VERSION}, found ${version}`,
          });
        }
      }
      if (name === "effect" && version !== EFFECT_VERSION) {
        findings.push({
          file,
          message: `effect must be exactly ${EFFECT_VERSION}, found ${version}`,
        });
      }
      if (
        [
          "@effect/platform-node",
          "@effect/platform-node-shared",
          "@effect/vitest",
        ].includes(name) &&
        version !== EFFECT_VERSION
      ) {
        findings.push({
          file,
          message: `${name} must be exactly ${EFFECT_VERSION}, found ${version}`,
        });
      }
      if (name === "@effect/language-service" && version !== "0.87.1") {
        findings.push({
          file,
          message: `${name} must be exactly 0.87.1, found ${version}`,
        });
      }
      if (name === "@effect/platform" || name === "@effect/cluster") {
        findings.push({
          file,
          message: `${name} must be removed for the Effect 4 cohort`,
        });
      }
    }
  }

  if (
    observedConfect.size > 1 ||
    [...observedConfect].some((version) => version !== CONFECT_VERSION)
  ) {
    findings.push({
      file: "package.json",
      message: `All @confect/* packages must be exactly ${CONFECT_VERSION}, found ${[...observedConfect].sort().join(", ")}`,
    });
  }

  const convexDeps = dependencyEntries(
    repoRoot,
    "packages/convex/package.json",
  );
  if (
    ("@confect/cli" in convexDeps || "@effect/platform-node" in convexDeps) &&
    convexDeps.ioredis !== "5.11.1"
  ) {
    findings.push({
      file: "packages/convex/package.json",
      message: `ioredis must be exactly 5.11.1 beside @confect/cli, found ${convexDeps.ioredis ?? "missing"}`,
    });
  }

  const cliDeps = dependencyEntries(repoRoot, "apps/cli/package.json");
  if ("@effect/platform-node" in cliDeps) {
    findings.push({
      file: "apps/cli/package.json",
      message: "@effect/platform-node must be pinned only in packages/convex",
    });
  }

  return findings;
};

export const checkPatchMapping = (
  repoRoot = process.cwd(),
): readonly CompatibilityFinding[] => {
  const file = "pnpm-workspace.yaml";
  if (!existsSync(join(repoRoot, file))) return [];
  return readSource(repoRoot, file).includes("@confect/cli@9.1.5")
    ? [
        {
          file,
          message: "The @confect/cli@9.1.5 patch mapping must be removed",
        },
      ]
    : [];
};

export const checkLockfileCohort = (
  repoRoot = process.cwd(),
): readonly CompatibilityFinding[] => {
  const file = "pnpm-lock.yaml";
  if (!existsSync(join(repoRoot, file))) return [];
  const lockfile = readSource(repoRoot, file);
  const findings: CompatibilityFinding[] = [];

  if (/^\s*['"]?effect@3\./mu.test(lockfile)) {
    findings.push({
      file,
      message: "The lockfile must not resolve an Effect 3 runtime",
    });
  }
  for (const removed of ["@effect/platform@", "@effect/cluster@"]) {
    if (lockfile.includes(removed)) {
      findings.push({
        file,
        message: `The lockfile must not resolve ${removed}`,
      });
    }
  }
  for (const companion of [
    "@effect/platform-node",
    "@effect/platform-node-shared",
    "@effect/vitest",
  ]) {
    const versions = [
      ...lockfile.matchAll(
        new RegExp(
          `(?:^|\\n)\\s*['"]?${companion.replace("/", "\\/")}@([^:('\\s"]+)`,
          "gu",
        ),
      ),
    ].map((match) => match[1]);
    if (versions.some((version) => version !== EFFECT_VERSION)) {
      findings.push({
        file,
        message: `${companion} must resolve to ${EFFECT_VERSION}, found ${[...new Set(versions)].sort().join(", ")}`,
      });
    }
  }

  return findings;
};

const authoredRoots = ["apps", "packages", "tooling", "examples"] as const;

export const checkNoStaleCompatibilityVocabulary = (
  repoRoot = process.cwd(),
): readonly CompatibilityFinding[] => {
  const findings: CompatibilityFinding[] = [];
  const activeSourceFiles = authoredRoots
    .flatMap((root) => walk(repoRoot, root))
    .filter((file) => /\.[cm]?[jt]sx?$/u.test(file))
    .filter((file) => !/\.test\.[cm]?[jt]sx?$/u.test(file))
    .filter(
      (file) => file !== "tooling/quality/check-confect-effect-compat.mts",
    );

  for (const file of activeSourceFiles) {
    if (file.endsWith("confect-v9-proof.ts")) {
      findings.push({
        file,
        message:
          "Use the version-neutral proof name for Confect/Effect compatibility.",
      });
    }
    if (
      /effect\/Either|decodeUnknownEither/u.test(readSource(repoRoot, file))
    ) {
      findings.push({
        file,
        message: "Active source uses a removed Effect/Confect API.",
      });
    }
  }

  const activeDocs = [
    ...walk(repoRoot, "docs/template"),
    ...(existsSync(join(repoRoot, "docs/rule-coverage.md"))
      ? ["docs/rule-coverage.md"]
      : []),
  ].filter((file) => /\.(?:md|json)$/u.test(file));
  const staleDocsPattern =
    /check:confect-v9|confect-v9-proof|Confect V9|Confect v9|\b9\.1\.5\b|\b3\.21\.4\b|effect\/Either|decodeUnknownEither/u;
  for (const file of activeDocs) {
    if (staleDocsPattern.test(readSource(repoRoot, file))) {
      findings.push({
        file,
        message:
          "Active documentation contains stale compatibility vocabulary.",
      });
    }
  }

  return findings;
};

export const checkNoVendoredSourceImports = (
  repoRoot = process.cwd(),
): readonly CompatibilityFinding[] =>
  authoredRoots
    .flatMap((root) => walk(repoRoot, root))
    .filter((file) => /\.[cm]?[jt]sx?$/u.test(file))
    .flatMap((file) => {
      const hasVendoredImport = readSource(repoRoot, file)
        .split("\n")
        .some((line) =>
          /^\s*import(?:\s+type)?(?:\s+[^"']+\s+from)?\s*["'][^"']*repos\//u.test(
            line,
          ),
        );
      return hasVendoredImport
        ? [{ file, message: "Application source must not import from repos/*" }]
        : [];
    });

export const checkNoAggregateConfectEntrypoints = (
  repoRoot = process.cwd(),
): readonly CompatibilityFinding[] =>
  ["spec.ts", "impl.ts", "nodeSpec.ts", "nodeImpl.ts"]
    .map((name) => `packages/convex/confect/${name}`)
    .filter((file) => existsSync(join(repoRoot, file)))
    .map((file) => ({
      file,
      message:
        "The current Confect authoring model removes root aggregate spec/impl entrypoints.",
    }));

export const checkNoEffectBarrelImports = (
  repoRoot = process.cwd(),
): readonly CompatibilityFinding[] =>
  walk(repoRoot, "packages/convex/confect")
    .filter((file) => file.endsWith(".ts"))
    .flatMap((file) => {
      const source = readSource(repoRoot, file);
      return /from\s+["']effect["']/.test(source)
        ? [
            {
              file,
              message:
                "Import Effect submodules, not the effect barrel, inside confect/.",
            },
          ]
        : [];
    });

export const checkLazySpecSchemas = (
  repoRoot = process.cwd(),
): readonly CompatibilityFinding[] =>
  walk(repoRoot, "packages/convex/confect")
    .filter((file) => file.endsWith(".spec.ts"))
    .flatMap((file) => {
      const source = readSource(repoRoot, file);
      const findings: CompatibilityFinding[] = [];
      if (/GroupSpec\.make(Node)?\(\s*["']/.test(source)) {
        findings.push({
          file,
          message:
            "GroupSpec.make does not take a name in the current Confect authoring model.",
        });
      }

      let inFunctionSpec = false;
      for (const line of source.split("\n")) {
        if (/FunctionSpec\.[A-Za-z]+\(\s*\{/.test(line)) {
          inFunctionSpec = true;
        }
        const schemaProperty = line.match(/^\s*(args|returns|error):\s*(.*)$/);
        if (
          inFunctionSpec &&
          schemaProperty &&
          !schemaProperty[2].trimStart().startsWith("() =>")
        ) {
          findings.push({
            file,
            message: `${schemaProperty[1]} schema must be wrapped in a () => thunk.`,
          });
        }
        if (inFunctionSpec && /^\s*\}\);/.test(line)) {
          inFunctionSpec = false;
        }
      }

      return findings;
    });

export const checkImplsUseDatabaseSchema = (
  repoRoot = process.cwd(),
): readonly CompatibilityFinding[] =>
  walk(repoRoot, "packages/convex/confect")
    .filter((file) => file.endsWith(".impl.ts"))
    .flatMap((file) => {
      const source = readSource(repoRoot, file);
      const findings: CompatibilityFinding[] = [];

      if (
        source.includes("FunctionImpl.make(api") ||
        source.includes("GroupImpl.make(api")
      ) {
        findings.push({
          file,
          message:
            "Impls must pass generated databaseSchema, not an aggregate api.",
        });
      }
      if (
        !/import\s+databaseSchema\s+from\s+["'][^"']*_generated\/schema["']/.test(
          source,
        )
      ) {
        findings.push({
          file,
          message: "Impls must import generated databaseSchema.",
        });
      }
      if (
        source.includes("FunctionImpl.make(") &&
        !/FunctionImpl\.make\(\s*databaseSchema/.test(source)
      ) {
        findings.push({
          file,
          message: "FunctionImpl.make must receive generated databaseSchema.",
        });
      }
      if (!/GroupImpl\.make\(\s*databaseSchema/.test(source)) {
        findings.push({
          file,
          message: "GroupImpl.make must receive generated databaseSchema.",
        });
      }
      if (!source.includes("GroupImpl.finalize")) {
        findings.push({
          file,
          message: "Impls must end with GroupImpl.finalize.",
        });
      }

      return findings;
    });

export const checkTableShape = (
  repoRoot = process.cwd(),
): readonly CompatibilityFinding[] =>
  walk(repoRoot, "packages/convex/confect/tables")
    .filter((file) => file.endsWith(".ts"))
    .flatMap((file) => {
      const source = readSource(repoRoot, file);
      const findings: CompatibilityFinding[] = [];

      if (!source.includes("export default Table.make(() =>")) {
        findings.push({
          file,
          message: "Tables must default-export Table.make(() => ...).",
        });
      }
      if (/Table\.make\(\s*["']/.test(source)) {
        findings.push({
          file,
          message: "Table.make no longer takes a table-name argument.",
        });
      }

      return findings;
    });

export const collectConfectEffectCompatibilityFindings = (
  repoRoot = process.cwd(),
): readonly CompatibilityFinding[] => [
  ...checkDependencyCohort(repoRoot),
  ...checkPatchMapping(repoRoot),
  ...checkLockfileCohort(repoRoot),
  ...checkNoStaleCompatibilityVocabulary(repoRoot),
  ...checkNoVendoredSourceImports(repoRoot),
  ...checkNoAggregateConfectEntrypoints(repoRoot),
  ...checkNoEffectBarrelImports(repoRoot),
  ...checkLazySpecSchemas(repoRoot),
  ...checkImplsUseDatabaseSchema(repoRoot),
  ...checkTableShape(repoRoot),
];

export const runConfectEffectCompatibilityCheck = (
  repoRoot = process.cwd(),
): void => {
  const findings = collectConfectEffectCompatibilityFindings(repoRoot);
  if (findings.length === 0) {
    console.log("check:confect-effect-compat ok");
    return;
  }

  for (const finding of findings) {
    console.error(`${finding.file}: ${finding.message}`);
  }
  process.exitCode = 1;
};

if (isDirectRun(import.meta.url)) runConfectEffectCompatibilityCheck();
