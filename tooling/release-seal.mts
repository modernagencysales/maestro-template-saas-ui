#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { format as formatWithPrettier } from "prettier";
import {
  CUSTOMER_OWNERSHIP_RULES,
  buildCustomerOwnershipInventory,
  classifyCustomerSourcePath,
} from "./release/src/customerTarget/ownership.js";
import {
  composedExpectedHashes,
  composedReleasePaths,
} from "./release/src/customerTarget/createAdapter.archive.js";
import {
  resolveCustomerReleasePath,
  type CustomerReleasePath,
} from "./release/src/customerTarget/manifest.js";
import type { UpgradeOperationV1 } from "./release/src/upgrade/contract.js";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Args = {
  version: string;
  sourceCommit: string;
  check: boolean;
  squashSafe: boolean;
};
type Output = { path: string; bytes: Buffer };
type SealManifest = {
  readonly baseManifest: { readonly path: string };
  readonly release: Readonly<Record<string, Json>>;
  readonly blueprintManifest: { readonly path: string };
  readonly upgrade: Readonly<Record<string, Json>> & {
    readonly operations: readonly UpgradeOperationV1[];
  };
  readonly migrationHandoff: Readonly<Record<string, Json>>;
  readonly additionalPaths: unknown;
};
type PriorManifest = {
  readonly expectedHashes?: Readonly<Record<string, string>>;
  readonly paths?: readonly CustomerReleasePath[];
  readonly release: { readonly sourceCommit: string };
};
type BlueprintManifest = {
  readonly projectionSource: {
    readonly assets: readonly { readonly path: string }[];
  };
};
export type ReleaseReadinessPlan = Readonly<{
  version: string;
  sourceCommit: string;
  tag: string;
  releaseRoot: string;
  manifestPath: string;
  blueprintPath: string;
  publicDefaultAdvanceAllowed: boolean;
}>;
const CURRENT_PUBLIC_DEFAULT_VERSION = "0.2.0-alpha.2";
const root = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
const hash = (bytes: string | Buffer): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const json = async (value: Json): Promise<Buffer> =>
  Buffer.from(
    await formatWithPrettier(JSON.stringify(value), { parser: "json" }),
  );
const git = (args: readonly string[]): Buffer =>
  execFileSync("git", ["-C", root, ...args], {
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
const text = (args: readonly string[]): string =>
  git(args).toString("utf8").trim();

export function buildReleaseReadinessPlan(input: {
  readonly version: string;
  readonly sourceCommit: string;
  readonly check: boolean;
  readonly currentPublicDefaultVersion: string;
  readonly publishedTagMaterializationVerified: boolean;
}): ReleaseReadinessPlan {
  if (!input.check && input.version === input.currentPublicDefaultVersion)
    throw new Error(`Refusing to overwrite immutable release ${input.version}`);
  const releaseRoot = `releases/v${input.version}`;
  return {
    version: input.version,
    sourceCommit: input.sourceCommit,
    tag: `maestro-template-v${input.version}`,
    releaseRoot,
    manifestPath: `${releaseRoot}/manifest.json`,
    blueprintPath: `${releaseRoot}/blueprints/saas-application.json`,
    publicDefaultAdvanceAllowed: input.publishedTagMaterializationVerified,
  };
}

export function validateReleaseSourceState(input: {
  readonly check: boolean;
  readonly sourceCommit: string;
  readonly headCommit: string;
  readonly sourceIsAncestor: boolean;
  readonly worktreeStatus: string;
  readonly squashSafe?: boolean;
  readonly releaseRoot?: string;
  readonly changedPaths?: readonly string[];
}): void {
  if (!input.check && input.headCommit !== input.sourceCommit) {
    assertSquashSafeChangeScope(input);
  }
  if (input.check && !input.sourceIsAncestor)
    throw new Error("Checked release source is not an ancestor of HEAD.");
  if (input.worktreeStatus !== "")
    throw new Error("Release sealing requires a clean source checkout.");
}

function assertSquashSafeChangeScope(input: {
  readonly squashSafe?: boolean;
  readonly sourceIsAncestor: boolean;
  readonly releaseRoot?: string;
  readonly changedPaths?: readonly string[];
}): void {
  if (!input.squashSafe || !input.sourceIsAncestor)
    throw new Error(
      "Write sealing requires HEAD to equal the frozen source commit.",
    );
  const releaseRoot = input.releaseRoot;
  const unrelated = input.changedPaths?.find(
    (path) =>
      path !== releaseRoot &&
      !path.startsWith(`${releaseRoot}/`) &&
      path !== "tooling/release-seal.mts" &&
      path !== "tooling/release-seal.test.mts" &&
      path !== "apps/cli/src/factory/createComposition.ts" &&
      path !== "apps/cli/src/factory/createRootIntegration.test.ts" &&
      path !== "apps/cli/src/factory/candidateComposition.test.ts" &&
      path !== "apps/cli/src/factory/customerCliRuntime.test.ts" &&
      path !==
        "tooling/generators/src/blueprints/saasFrontendFoundation.test.ts" &&
      path !== "tooling/generators/src/blueprints/saasFrontendFoundation.ts",
  );
  if (!releaseRoot || unrelated !== undefined)
    throw new Error(
      `Squash-safe sealing found an unrelated changed path: ${unrelated ?? "missing release root"}`,
    );
}

function parseArgs(argv: readonly string[]): Args {
  const tokens = argv.filter((token) => token !== "--squash-safe");
  let version: string | undefined;
  let sourceCommit: string | undefined;
  let check = false;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--check") check = true;
    else if (token === "--version") version = tokens[++index];
    else if (token === "--source-commit") sourceCommit = tokens[++index];
    else throw new Error(`Unknown release seal argument: ${token ?? ""}`);
  }
  if (!version || !/^[0-9A-Za-z][0-9A-Za-z.-]*$/u.test(version))
    throw new Error("release:seal requires a closed --version");
  if (!sourceCommit || !/^[0-9a-f]{40}$/u.test(sourceCommit))
    throw new Error("release:seal requires an exact --source-commit");
  return {
    version,
    sourceCommit,
    check,
    squashSafe: tokens.length !== argv.length,
  };
}

function assertSource(args: Args): void {
  if (text(["cat-file", "-t", args.sourceCommit]) !== "commit")
    throw new Error("Release source is not a commit.");
  const head = text(["rev-parse", "HEAD"]);
  const state = resolveReleaseSourceState(args, head);
  validateReleaseSourceState({
    check: args.check,
    sourceCommit: args.sourceCommit,
    headCommit: head,
    worktreeStatus: text(["status", "--porcelain", "--untracked-files=all"]),
    squashSafe: args.squashSafe,
    releaseRoot: `releases/v${args.version}`,
    ...state,
  });
  const tree = git(["ls-tree", "-rz", "--full-tree", "-r", args.sourceCommit]);
  for (const record of tree.toString("utf8").split("\0").filter(Boolean)) {
    const mode = record.slice(0, record.indexOf(" "));
    const separator = record.indexOf("\t");
    const path = separator < 0 ? "" : record.slice(separator + 1);
    if (
      mode === "120000" &&
      classifyCustomerSourcePath(path)?.action !== "omit"
    )
      throw new Error(
        `Materialized release source contains a symlink: ${path}`,
      );
  }
}

function resolveReleaseSourceState(args: Args, head: string) {
  let sourceIsAncestor = head === args.sourceCommit;
  if (args.check || args.squashSafe) {
    try {
      git(["merge-base", "--is-ancestor", args.sourceCommit, head]);
      sourceIsAncestor = true;
    } catch {
      sourceIsAncestor = false;
    }
  }
  return {
    sourceIsAncestor,
    changedPaths:
      args.squashSafe && head !== args.sourceCommit
        ? text(["diff", "--name-only", `${args.sourceCommit}..${head}`])
            .split("\n")
            .filter(Boolean)
        : [],
  };
}

function sourcePaths(commit: string): readonly string[] {
  return text(["ls-tree", "-r", "--name-only", commit])
    .split("\n")
    .filter(Boolean)
    .sort();
}
function blob(commit: string, path: string): Buffer {
  if (!safePath(path)) throw new Error(`Unsafe release path: ${path}`);
  return git(["show", `${commit}:${path}`]);
}
function hasBlob(commit: string, path: string): boolean {
  try {
    git(["cat-file", "-e", `${commit}:${path}`]);
    return true;
  } catch {
    return false;
  }
}

export function selectReleaseInputBytes(input: {
  readonly path: string;
  readonly source?: Buffer;
  readonly candidate?: Buffer;
}): Buffer {
  const bytes = input.source ?? input.candidate;
  if (!bytes) throw new Error(`Release input unavailable: ${input.path}`);
  return bytes;
}

function safePath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    path
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}
function slug(path: string): string {
  return path.replace(/[^a-zA-Z0-9]+/gu, "-").replace(/^-|-$/gu, "");
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// eslint-disable-next-line complexity -- AP-008 tracks splitting this pre-existing 16-complexity manifest validator; Task 6 changes adjacent release-seal rules.
export function resolvePriorManifest(
  manifestPath: string,
  visited = new Set<string>(),
): PriorManifest {
  const canonicalPath = realpathSync(manifestPath);
  const relativePath = relative(root, canonicalPath).split(sep).join("/");
  if (!safePath(relativePath))
    throw new Error("Prior manifest escapes repository.");
  if (visited.has(canonicalPath))
    throw new Error("Prior release manifest composition contains a cycle.");
  visited.add(canonicalPath);
  const value: unknown = JSON.parse(readFileSync(canonicalPath, "utf8"));
  if (!isRecord(value) || !isRecord(value.release))
    throw new Error("Prior release manifest is invalid.");
  if (value.kind !== "composed-customer-release") {
    if (
      typeof value.release.sourceCommit !== "string" ||
      !Array.isArray(value.paths)
    )
      throw new Error("Prior ownership manifest is incomplete.");
    return value as PriorManifest;
  }
  if (
    !isRecord(value.baseManifest) ||
    typeof value.baseManifest.path !== "string" ||
    typeof value.baseManifest.sha256 !== "string" ||
    typeof value.release.sourceCommit !== "string" ||
    !Array.isArray(value.additionalPaths) ||
    !isRecord(value.upgrade) ||
    !Array.isArray(value.upgrade.operations)
  )
    throw new Error("Prior composed release manifest is incomplete.");
  const basePath = resolve(canonicalPath, "..", value.baseManifest.path);
  const baseBytes = readFileSync(basePath);
  if (hash(baseBytes) !== value.baseManifest.sha256)
    throw new Error("Prior base manifest checksum does not match.");
  const base = resolvePriorManifest(basePath, visited);
  const additional = value.additionalPaths as readonly CustomerReleasePath[];
  const replaced = new Set(
    additional.map((entry) => `${entry.match}:${entry.path}`),
  );
  const inherited = (base.paths ?? []).filter(
    (entry) => !replaced.has(`${entry.match}:${entry.path}`),
  );
  const paths = composedReleasePaths(
    inherited,
    additional,
    value.upgrade.operations,
  );
  const expectedHashes = Object.fromEntries(
    Object.entries(
      composedExpectedHashes(
        base.expectedHashes,
        paths,
        value.upgrade.operations,
      ),
    ).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  return {
    release: { sourceCommit: value.release.sourceCommit },
    paths,
    expectedHashes,
  };
}
const REVIEWED_ADDITIONAL_PATHS: readonly CustomerReleasePath[] = [
  {
    path: "Justfile",
    match: "exact",
    ownership: "factory-only",
    action: "omit",
    upgrade: "remove",
  },
  ...[
    "apps/web/src/routes/build-pack.$packId.generating.tsx",
    "apps/web/src/routes/build-pack.$packId.index.tsx",
    "apps/web/src/routes/build-pack.$packId.tsx",
    "apps/web/src/routes/checkout.$reportId.tsx",
    "apps/web/src/routes/checkout.fake-hosted.$sessionId.tsx",
    "apps/web/src/routes/checkout.return.tsx",
    "apps/web/src/routes/evaluate.tsx",
    "apps/web/src/routes/library.tsx",
    "apps/web/src/routes/maestro.$packId.tsx",
    "apps/web/src/routes/privacy.tsx",
    "apps/web/src/routes/report.$evaluationId.tsx",
    "apps/web/src/routes/share.$token.tsx",
    "apps/web/src/routes/support.tsx",
    "apps/web/src/routes/terms.tsx",
    "apps/web/src/routes/verify-report.tsx",
  ].map((path) => ({
    path,
    match: "exact" as const,
    ownership: "factory-only" as const,
    action: "omit" as const,
    upgrade: "remove" as const,
  })),
  {
    path: "apps/web/src/features/public-funnel",
    match: "subtree",
    ownership: "factory-only",
    action: "omit",
    upgrade: "remove",
  },
  {
    path: "apps/web/src/providers/posthog.test.tsx",
    match: "exact",
    ownership: "factory-only",
    action: "omit",
    upgrade: "remove",
  },
  {
    path: ".factory/project.yaml",
    match: "exact",
    ownership: "template-owned",
    action: "copy",
    upgrade: "replace",
  },
  {
    path: "generated",
    match: "subtree",
    ownership: "generated",
    action: "generate",
    upgrade: "regenerate",
  },
  {
    path: "maestro-template.mjs",
    match: "exact",
    ownership: "template-owned",
    action: "copy",
    upgrade: "replace",
  },
  {
    path: "playwright.funnel.config.ts",
    match: "exact",
    ownership: "template-owned",
    action: "copy",
    upgrade: "replace",
  },
  {
    path: "tooling/acceptance",
    match: "subtree",
    ownership: "template-owned",
    action: "copy",
    upgrade: "replace",
  },
  {
    path: ".claude/settings.json",
    match: "exact",
    ownership: "generated",
    action: "generate",
    upgrade: "regenerate",
  },
  {
    path: "tooling/saas-ui",
    match: "subtree",
    ownership: "template-owned",
    action: "copy",
    upgrade: "replace",
  },
  ...[
    "apps/cli/src/factory/adopt.ts",
    "apps/cli/src/factory/adopt.test.ts",
    "apps/cli/src/factory/composition.ts",
    "apps/cli/src/factory/composition.test.ts",
    "apps/cli/src/factory/createRootIntegration.test.ts",
    "apps/cli/src/factory/mcpIntegration.test.ts",
    "apps/cli/src/factory/recipeCatalog.ts",
    "apps/cli/src/factory/supportBundleMcpNoNetwork.fixture.ts",
    "apps/cli/src/factory/upgrade.ts",
    "apps/cli/src/factory/upgrade.test.ts",
    "tooling/agent-pack/src/privacy/privacy.noNetwork.test.ts",
    "tooling/agent-pack/src/privacy/runtimeNetworkInterceptor.mjs",
  ].map((path): CustomerReleasePath => ({
    path,
    match: "exact",
    ownership: "factory-only",
    action: "omit",
    upgrade: "remove",
  })),
  {
    path: ".superpowers",
    match: "subtree",
    ownership: "factory-only",
    action: "omit",
    upgrade: "remove",
  },
  {
    path: ".woodpecker",
    match: "subtree",
    ownership: "factory-only",
    action: "omit",
    upgrade: "remove",
  },
  {
    path: "docs/superpowers",
    match: "subtree",
    ownership: "factory-only",
    action: "omit",
    upgrade: "remove",
  },
  {
    path: "tooling/ci",
    match: "subtree",
    ownership: "factory-only",
    action: "omit",
    upgrade: "remove",
  },
  {
    path: "tooling/workflow",
    match: "subtree",
    ownership: "factory-only",
    action: "omit",
    upgrade: "remove",
  },
  {
    path: "docs/agent",
    match: "subtree",
    ownership: "template-owned",
    action: "copy",
    upgrade: "replace",
  },
  {
    path: "docs/licenses/saas-ui",
    match: "subtree",
    ownership: "template-owned",
    action: "copy",
    upgrade: "replace",
  },
  {
    path: "patches",
    match: "subtree",
    ownership: "template-owned",
    action: "copy",
    upgrade: "replace",
  },
  {
    path: "tooling/app-map/INTEGRATION_REQUEST.md",
    match: "exact",
    ownership: "factory-only",
    action: "omit",
    upgrade: "remove",
  },
  {
    path: "tooling/app-map/src/mcp.test.ts",
    match: "exact",
    ownership: "factory-only",
    action: "omit",
    upgrade: "remove",
  },
  {
    path: "tooling/app-map",
    match: "subtree",
    ownership: "template-owned",
    action: "copy",
    upgrade: "replace",
  },
  {
    path: "tooling/release-seal.mts",
    match: "exact",
    ownership: "factory-only",
    action: "omit",
    upgrade: "remove",
  },
  {
    path: "tooling/release-seal.test.mts",
    match: "exact",
    ownership: "factory-only",
    action: "omit",
    upgrade: "remove",
  },
] as const;

// eslint-disable-next-line complexity -- AP-008 tracks splitting this pre-existing 12-complexity reviewed-exclusion validator; Task 6 changes adjacent release-seal rules.
export function parseReviewedFactoryOnlyExclusions(input: {
  readonly value: unknown;
  readonly sourcePaths: readonly string[];
  readonly protectedCustomerPaths: readonly string[];
}): readonly CustomerReleasePath[] {
  if (!Array.isArray(input.value))
    throw new Error("Release additionalPaths must be an array.");
  const source = new Set(input.sourcePaths);
  // eslint-disable-next-line complexity -- AP-008 tracks splitting this pre-existing 12-complexity exclusion schema check; Task 6 changes adjacent release-seal rules.
  const rules = input.value.map((raw, index): CustomerReleasePath => {
    if (
      !isRecord(raw) ||
      JSON.stringify(Object.keys(raw).sort()) !==
        JSON.stringify(
          ["action", "match", "ownership", "path", "upgrade"].sort(),
        ) ||
      typeof raw.path !== "string" ||
      !safePath(raw.path) ||
      (raw.match !== "exact" && raw.match !== "subtree") ||
      raw.ownership !== "factory-only" ||
      raw.action !== "omit" ||
      raw.upgrade !== "remove"
    ) {
      throw new Error(
        `Release factory-only exclusion ${String(index)} is invalid.`,
      );
    }
    const matchesSource =
      raw.match === "exact"
        ? source.has(raw.path)
        : input.sourcePaths.some(
            (path) => path === raw.path || path.startsWith(`${raw.path}/`),
          );
    if (!matchesSource)
      throw new Error(`Release exclusion has no source path: ${raw.path}`);
    return {
      path: raw.path,
      match: raw.match,
      ownership: "factory-only",
      action: "omit",
      upgrade: "remove",
    };
  });
  const identities = new Set<string>();
  for (const rule of rules) {
    const identity = `${rule.match}:${rule.path}`;
    if (identities.has(identity))
      throw new Error(`Duplicate release exclusion: ${identity}`);
    identities.add(identity);
  }
  for (const [index, left] of rules.entries()) {
    for (const right of rules.slice(index + 1)) {
      if (
        left.path === right.path ||
        left.path.startsWith(`${right.path}/`) ||
        right.path.startsWith(`${left.path}/`)
      ) {
        throw new Error(
          `Overlapping release exclusions: ${left.path}, ${right.path}`,
        );
      }
    }
  }
  for (const path of input.protectedCustomerPaths) {
    if (!safePath(path))
      throw new Error(`Protected customer path is unsafe: ${path}`);
    if (resolveCustomerReleasePath(rules, path))
      throw new Error(
        `Factory-only exclusion collides with customer-shipped path: ${path}`,
      );
  }
  return [...rules].sort((left, right) =>
    `${left.path}:${left.match}`.localeCompare(`${right.path}:${right.match}`),
  );
}

export function buildReviewedOwnershipInventory(input: {
  readonly sourcePaths: readonly string[];
  readonly exclusions: readonly CustomerReleasePath[];
  readonly overrides?: readonly CustomerReleasePath[];
}): readonly CustomerReleasePath[] {
  const excluded: CustomerReleasePath[] = [];
  const remaining: string[] = [];
  for (const path of input.sourcePaths) {
    const override = resolveCustomerReleasePath(input.overrides ?? [], path);
    if (override?.action !== undefined && override.action !== "omit") {
      remaining.push(path);
      continue;
    }
    const exclusion = resolveCustomerReleasePath(input.exclusions, path);
    if (exclusion) {
      excluded.push({ ...exclusion, path, match: "exact" });
    } else remaining.push(path);
  }
  return [...buildCustomerOwnershipInventory(remaining), ...excluded].sort(
    (left, right) => left.path.localeCompare(right.path),
  );
}

export function buildReviewedAdditionalPaths(input: {
  readonly value: unknown;
  readonly sourcePaths: readonly string[];
  readonly protectedCustomerPaths: readonly string[];
  readonly basePaths: readonly CustomerReleasePath[];
}): readonly CustomerReleasePath[] {
  if (!Array.isArray(input.value))
    throw new Error("Release additionalPaths must be an array.");
  const configuredFactoryRules = input.value.filter((raw) => {
    if (!isRecord(raw)) return true;
    const identity = `${String(raw.match)}:${String(raw.path)}`;
    const reviewed = REVIEWED_ADDITIONAL_PATHS.find(
      (rule) => `${rule.match}:${rule.path}` === identity,
    );
    if (reviewed !== undefined) {
      if (JSON.stringify(raw) !== JSON.stringify(reviewed))
        throw new Error(`Release additional path is not reviewed: ${identity}`);
      return false;
    }
    if (raw.ownership !== "factory-only")
      throw new Error(`Release additional path is not reviewed: ${identity}`);
    return true;
  });
  const configured = parseReviewedFactoryOnlyExclusions({
    value: configuredFactoryRules,
    sourcePaths: input.sourcePaths,
    protectedCustomerPaths: input.protectedCustomerPaths,
  });
  const rules = [
    ...new Map(
      [
        ...configured,
        ...REVIEWED_ADDITIONAL_PATHS,
        ...CUSTOMER_OWNERSHIP_RULES.filter(
          (entry) => entry.ownership === "factory-only",
        ),
      ].map((entry) => [`${entry.match}:${entry.path}`, entry] as const),
    ).values(),
  ]
    .filter((candidate) => {
      const inherited = input.basePaths.find(
        (entry) =>
          entry.path === candidate.path && entry.match === candidate.match,
      );
      if (inherited === undefined) return true;
      if (JSON.stringify(inherited) === JSON.stringify(candidate)) return false;
      if (candidate.ownership === "factory-only") {
        const matchesSource =
          candidate.match === "exact"
            ? input.sourcePaths.includes(candidate.path)
            : input.sourcePaths.some(
                (path) =>
                  path === candidate.path ||
                  path.startsWith(`${candidate.path}/`),
              );
        return (
          matchesSource ||
          (candidate.path === "Justfile" &&
            !input.sourcePaths.includes(candidate.path))
        );
      }
      throw new Error(
        `Release additional path conflicts with inherited authority: ${candidate.match}:${candidate.path}`,
      );
    })
    .sort((left, right) =>
      `${left.path}:${left.match}`.localeCompare(
        `${right.path}:${right.match}`,
      ),
    );
  const replacementIdentities = new Set(
    rules.map((entry) => `${entry.match}:${entry.path}`),
  );
  const effectiveRules = [
    ...input.basePaths.filter(
      (entry) => !replacementIdentities.has(`${entry.match}:${entry.path}`),
    ),
    ...rules,
  ];
  for (const path of input.sourcePaths) {
    if (!resolveCustomerReleasePath(effectiveRules, path))
      throw new Error(`Unclassified reviewed release source path: ${path}`);
  }
  return rules;
}

// eslint-disable-next-line complexity -- AP-008 tracks splitting this pre-existing 22-complexity release builder; Task 6 changes adjacent release-seal rules.
async function build(args: Args): Promise<readonly Output[]> {
  assertSource(args);
  const readiness = buildReleaseReadinessPlan({
    version: args.version,
    sourceCommit: args.sourceCommit,
    check: args.check,
    currentPublicDefaultVersion: CURRENT_PUBLIC_DEFAULT_VERSION,
    publishedTagMaterializationVerified: false,
  });
  const { releaseRoot, manifestPath } = readiness;
  const current = JSON.parse(
    readFileSync(join(root, manifestPath), "utf8"),
  ) as SealManifest;
  const priorPath = resolve(join(root, releaseRoot), current.baseManifest.path);
  const prior = resolvePriorManifest(priorPath);

  const { blueprintPath } = readiness;
  const blueprint = JSON.parse(
    readFileSync(join(root, blueprintPath), "utf8"),
  ) as BlueprintManifest;
  const { buildSaasApplicationTargetPlan } =
    await import("./generators/src/blueprints/saasApplication.js");
  const plan = buildSaasApplicationTargetPlan({
    name: "SaaS Application",
    firstOutcome: "Deliver the first customer outcome",
    patterns: ["records-example"],
  });
  const outputs: Output[] = [];
  const assets = [] as { path: string; sha256: string }[];
  const protectedCustomerSourcePaths: string[] = [];
  for (const entry of blueprint.projectionSource.assets) {
    if (!safePath(entry.path))
      throw new Error("Blueprint asset path is unsafe.");
    const target = `${releaseRoot}/blueprints/saas-application/${entry.path}`;
    const direct =
      entry.path.startsWith("base/") && entry.path.endsWith(".txt")
        ? entry.path.slice(5, -4)
        : undefined;
    if (direct) protectedCustomerSourcePaths.push(direct);
    const projected = direct
      ? plan.entries.find((candidate) => candidate.path === direct)
      : undefined;
    const bytes =
      projected !== undefined
        ? Buffer.from(projected.content)
        : direct && hasBlob(args.sourceCommit, direct)
          ? blob(args.sourceCommit, direct)
          : blob(args.sourceCommit, target);
    outputs.push({ path: target, bytes });
    assets.push({ path: entry.path, sha256: hash(bytes) });
  }
  if (!args.check) apply(outputs);
  else assertOutputs(outputs);

  const reviewedSourcePaths = sourcePaths(args.sourceCommit);
  const additionalPaths = buildReviewedAdditionalPaths({
    value: current.additionalPaths,
    sourcePaths: reviewedSourcePaths,
    protectedCustomerPaths: protectedCustomerSourcePaths,
    basePaths: prior.paths ?? [],
  });
  const exclusions = [
    ...new Map(
      [...(prior.paths ?? []), ...additionalPaths, ...CUSTOMER_OWNERSHIP_RULES]
        .filter((entry) => entry.ownership === "factory-only")
        .map((entry) => [`${entry.match}:${entry.path}`, entry] as const),
    ).values(),
  ];
  const inventory = buildReviewedOwnershipInventory({
    sourcePaths: reviewedSourcePaths,
    exclusions,
    overrides: additionalPaths,
  });
  const copiedSourcePaths = new Set(
    inventory.filter(({ action }) => action === "copy").map(({ path }) => path),
  );
  const blueprintValue = {
    schemaVersion: plan.schemaVersion,
    id: plan.id,
    provenance: plan.provenance,
    projectionSource: { sourceCommit: args.sourceCommit, assets },
    registrations: plan.registrations,
    parameterizedEntries: plan.parameterizedEntries,
    entries: plan.entries.map((entry) => {
      const value = Object.fromEntries(
        Object.entries(entry).filter(([key]) => key !== "content"),
      );
      return copiedSourcePaths.has(entry.path)
        ? { ...value, replaces: "copy" }
        : value;
    }),
  } as Json;
  const blueprintBytes = await json(blueprintValue);
  outputs.push({ path: blueprintPath, bytes: blueprintBytes });

  const currentTemplate = new Map(
    inventory
      .filter((entry) => entry.ownership === "template-owned")
      .map((entry) => [entry.path, hash(blob(args.sourceCommit, entry.path))]),
  );
  const priorHashes = new Map<string, string>();
  for (const [path, priorHash] of Object.entries(prior.expectedHashes ?? {})) {
    const ownership = resolveCustomerReleasePath(prior.paths ?? [], path);
    const removed = additionalPaths.some(
      (entry) =>
        entry.path === path &&
        entry.match === "exact" &&
        entry.ownership === "factory-only",
    );
    if (ownership?.ownership === "template-owned" || removed)
      priorHashes.set(path, priorHash);
  }
  const oldKinds = new Map(
    current.upgrade.operations
      .filter((operation) => operation.ownership === "template-owned")
      .map((operation) => [operation.path, operation]),
  );
  const managed = new Set([
    ...currentTemplate.keys(),
    ...priorHashes.keys(),
    ...oldKinds.keys(),
  ]);
  const operations = [...managed].sort().flatMap((path) => {
    const afterHash = currentTemplate.get(path);
    const beforeHash = priorHashes.get(path);
    if (afterHash === beforeHash) return [];
    const kind =
      beforeHash === undefined
        ? "add"
        : afterHash === undefined
          ? "delete"
          : "modify";
    return [
      {
        id: `upgrade-${kind}-${slug(path)}`,
        kind,
        path,
        ownership: "template-owned",
        ...(beforeHash === undefined ? {} : { beforeHash }),
        ...(afterHash === undefined ? {} : { afterHash }),
      },
    ];
  });
  const generated = current.upgrade.operations
    .filter((operation) => operation.ownership === "generated")
    .map((operation) => ({ ...operation }));
  const packageEntry = plan.entries.find(
    (entry) => entry.path === "package.json",
  );
  for (const operation of generated)
    if (operation.path === "package.json" && packageEntry)
      operation.afterHash = packageEntry.sha256;
  const allOperations = [...operations, ...generated].sort((a, b) =>
    a.path.localeCompare(b.path),
  );

  const { composeAppMap } = await import("./app-map/src/composition.js");
  const { buildAppMapImpact } = await import("./app-map/src/impact.js");
  const { APP_MAP_INPUT_MANIFEST_V1 } = await import("./app-map/src/schema.js");
  const generatedTemplateInstanceFacts = await json({
    schemaVersion: 1,
    kind: "release-blueprint-template-instance-facts",
    sourceRevision: args.sourceCommit,
    blueprint: {
      id: plan.id,
      provenance: plan.provenance,
      planDigest: plan.digest,
      manifestDigest: hash(blueprintBytes),
    },
    support: { state: "supported" },
  });
  const composed = await composeAppMap({
    repoRoot: root,
    revision: args.sourceCommit,
    generatedSourceOverrides: [
      {
        sourceId: "template-instance",
        sourcePath: "template-instance.json",
        bytes: generatedTemplateInstanceFacts.toString("utf8"),
        bytesDigest: hash(generatedTemplateInstanceFacts),
        generation: {
          kind: "release-blueprint-template-instance-facts",
          sourceRevision: args.sourceCommit,
          blueprintId: plan.id,
          blueprintProvenance: plan.provenance,
          blueprintPlanDigest: plan.digest,
          blueprintManifestDigest: hash(blueprintBytes),
        },
      },
    ],
  });
  if (!composed.ok) throw new Error(composed.message);
  const structural = allOperations
    .map((operation) => operation.path)
    .filter((path) =>
      APP_MAP_INPUT_MANIFEST_V1.requiredSources.some((entry) =>
        entry.source.digestContract === "sha256-file-bytes-v1"
          ? path === entry.source.path
          : path === entry.source.path ||
            path.startsWith(`${entry.source.path}/`),
      ),
    );
  const ownershipCovered = allOperations
    .map((operation) => operation.path)
    .filter((path) => !structural.includes(path));
  const baseRevision = prior.release.sourceCommit;
  const impact = buildAppMapImpact({
    schemaVersion: 1,
    baseRevision,
    mapInput: composed.input,
    changedPaths: structural,
  });
  if (!impact.ok) throw new Error("App Map impact generation failed.");
  const impactInputBytes = await json(composed.input as unknown as Json);
  const impactBytes = await json({
    schemaVersion: 1,
    kind: "reviewed-upgrade-impact-coverage",
    baseRevision,
    subjectRevision: args.sourceCommit,
    structuralPaths: structural.sort(),
    ownershipCoveredPaths: ownershipCovered.sort(),
    impact: impact.impact,
  } as unknown as Json);
  const impactInputPath = `${releaseRoot}/upgrade/app-map-input.json`;
  const impactPath = `${releaseRoot}/upgrade/app-map-impact.json`;
  outputs.push({ path: impactInputPath, bytes: impactInputBytes });
  outputs.push({ path: impactPath, bytes: impactBytes });

  const migrationPath = `${releaseRoot}/migrations/manifest.json`;
  const migrationBytes = selectReleaseInputBytes({
    path: migrationPath,
    source: hasBlob(args.sourceCommit, migrationPath)
      ? blob(args.sourceCommit, migrationPath)
      : undefined,
    candidate: existsSync(join(root, migrationPath))
      ? readFileSync(join(root, migrationPath))
      : undefined,
  });
  const manifestValue = {
    ...current,
    baseManifest: {
      path: current.baseManifest.path,
      sha256: hash(readFileSync(priorPath)),
    },
    release: {
      ...current.release,
      sourceCommit: args.sourceCommit,
      sourceChecksum: hash(git(["archive", "--format=tar", args.sourceCommit])),
    },
    blueprintManifest: {
      path: current.blueprintManifest.path,
      sha256: hash(blueprintBytes),
    },
    upgrade: { ...current.upgrade, operations: allOperations },
    upgradeImpact: {
      path: impactInputPath,
      sha256: hash(impactInputBytes),
      projection: { path: impactPath, sha256: hash(impactBytes) },
    },
    migrationHandoff: {
      ...current.migrationHandoff,
      path: migrationPath,
      sha256: hash(migrationBytes),
    },
    additionalPaths,
  } as Json;
  const manifestBytes = await json(manifestValue);
  outputs.push({ path: manifestPath, bytes: manifestBytes });

  const compositionPath = "apps/cli/src/factory/createComposition.ts";
  let composition = blob(args.sourceCommit, compositionPath).toString("utf8");
  composition = composition
    .replace(
      /const BASE_MANIFEST_PATH = "releases\/v[^/]+\/manifest\.json";/u,
      `const BASE_MANIFEST_PATH = "${manifestPath}";`,
    )
    .replace(
      /const BASE_MANIFEST_CHECKSUM =\n {2}"sha256:[0-9a-f]{64}";/u,
      `const BASE_MANIFEST_CHECKSUM =\n  "${hash(manifestBytes)}";`,
    )
    .replace(
      /const BASE_BLUEPRINT_CHECKSUM =\n {2}"sha256:[0-9a-f]{64}";/u,
      `const BASE_BLUEPRINT_CHECKSUM =\n  "${hash(blueprintBytes)}";`,
    )
    .replace(
      /const BASE_COMMIT = "[0-9a-f]{40}";/u,
      `const BASE_COMMIT = "${args.sourceCommit}";`,
    )
    .replace(
      /const BASE_TAG = "maestro-template-v[^"]+";/u,
      `const BASE_TAG = "${readiness.tag}";`,
    )
    .replace(
      /releases\/v[^/]+\/blueprints\/saas-application\.json/gu,
      `${releaseRoot}/blueprints/saas-application.json`,
    )
    .replace(
      /releases\/v[^/]+\/hardening\/saas-application\.json/u,
      `${releaseRoot}/hardening/saas-application.json`,
    );
  outputs.push({ path: compositionPath, bytes: Buffer.from(composition) });
  return outputs;
}

function assertOutputs(outputs: readonly Output[]): void {
  const drift = outputs
    .filter(
      ({ path, bytes }) =>
        !existsSync(join(root, path)) ||
        !readFileSync(join(root, path)).equals(bytes),
    )
    .map(({ path }) => path);
  if (drift.length > 0)
    throw new Error(`Release seal drift: ${drift.join(", ")}`);
}
function apply(outputs: readonly Output[]): void {
  for (const { path, bytes } of outputs) {
    const target = join(root, path);
    if (!safePath(path) || relative(root, target).startsWith(".."))
      throw new Error(`Release output escapes repository: ${path}`);
    if (
      existsSync(target) &&
      (!lstatSync(target).isFile() || lstatSync(target).isSymbolicLink())
    )
      throw new Error(`Release output is not a regular file: ${path}`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href;
if (isDirectRun) {
  build(parseArgs(process.argv.slice(2)))
    .then((outputs) => {
      const args = parseArgs(process.argv.slice(2));
      if (args.check) assertOutputs(outputs);
      else apply(outputs);
      process.stdout.write(
        `${args.check ? "verified" : "sealed"} ${args.version} from ${args.sourceCommit}\n`,
      );
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : "release seal failed"}\n`,
      );
      process.exitCode = 1;
    });
}
