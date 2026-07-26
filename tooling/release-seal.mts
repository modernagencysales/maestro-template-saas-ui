#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCustomerOwnershipInventory,
  classifyCustomerSourcePath,
} from "./release/src/customerTarget/ownership.js";
import {
  resolveCustomerReleasePath,
  type CustomerReleasePath,
} from "./release/src/customerTarget/manifest.js";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Args = { version: string; sourceCommit: string; check: boolean };
type Output = { path: string; bytes: Buffer };
const root = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
const hash = (bytes: string | Buffer): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const json = (value: Json): Buffer =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const git = (args: readonly string[]): Buffer =>
  execFileSync("git", ["-C", root, ...args], {
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
const text = (args: readonly string[]): string =>
  git(args).toString("utf8").trim();

function parseArgs(argv: readonly string[]): Args {
  let version: string | undefined;
  let sourceCommit: string | undefined;
  let check = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--check") check = true;
    else if (token === "--version") version = argv[++index];
    else if (token === "--source-commit") sourceCommit = argv[++index];
    else throw new Error(`Unknown release seal argument: ${token ?? ""}`);
  }
  if (!version || !/^[0-9A-Za-z][0-9A-Za-z.-]*$/u.test(version))
    throw new Error("release:seal requires a closed --version");
  if (!sourceCommit || !/^[0-9a-f]{40}$/u.test(sourceCommit))
    throw new Error("release:seal requires an exact --source-commit");
  return { version, sourceCommit, check };
}

function assertSource(args: Args): void {
  if (text(["cat-file", "-t", args.sourceCommit]) !== "commit")
    throw new Error("Release source is not a commit.");
  const head = text(["rev-parse", "HEAD"]);
  if (!args.check && head !== args.sourceCommit)
    throw new Error(
      "Write sealing requires HEAD to equal the frozen source commit.",
    );
  if (args.check) {
    try {
      git(["merge-base", "--is-ancestor", args.sourceCommit, head]);
    } catch {
      throw new Error("Checked release source is not an ancestor of HEAD.");
    }
  }
  if (text(["status", "--porcelain", "--untracked-files=all"]) !== "")
    throw new Error("Release sealing requires a clean source checkout.");
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

export function parseReviewedFactoryOnlyExclusions(input: {
  readonly value: unknown;
  readonly sourcePaths: readonly string[];
  readonly protectedCustomerPaths: readonly string[];
}): readonly CustomerReleasePath[] {
  if (!Array.isArray(input.value))
    throw new Error("Release additionalPaths must be an array.");
  const source = new Set(input.sourcePaths);
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
}): readonly CustomerReleasePath[] {
  const excluded: CustomerReleasePath[] = [];
  const remaining: string[] = [];
  for (const path of input.sourcePaths) {
    const exclusion = resolveCustomerReleasePath(input.exclusions, path);
    if (exclusion) {
      excluded.push({ ...exclusion, path, match: "exact" });
    } else remaining.push(path);
  }
  return [...buildCustomerOwnershipInventory(remaining), ...excluded].sort(
    (left, right) => left.path.localeCompare(right.path),
  );
}

async function build(args: Args): Promise<readonly Output[]> {
  assertSource(args);
  const releaseRoot = `releases/v${args.version}`;
  const manifestPath = `${releaseRoot}/manifest.json`;
  const current = JSON.parse(
    readFileSync(join(root, manifestPath), "utf8"),
  ) as any;
  const priorPath = resolve(join(root, releaseRoot), current.baseManifest.path);
  const prior = JSON.parse(readFileSync(priorPath, "utf8")) as any;
  const priorRelative = relative(root, priorPath).split(sep).join("/");
  if (!safePath(priorRelative))
    throw new Error("Prior manifest escapes repository.");

  const blueprintPath = `${releaseRoot}/blueprints/saas-application.json`;
  const blueprint = JSON.parse(
    readFileSync(join(root, blueprintPath), "utf8"),
  ) as any;
  const outputs: Output[] = [];
  const assets = [] as { path: string; sha256: string }[];
  const protectedCustomerSourcePaths: string[] = [];
  for (const entry of blueprint.projectionSource.assets as { path: string }[]) {
    if (!safePath(entry.path))
      throw new Error("Blueprint asset path is unsafe.");
    const target = `${releaseRoot}/blueprints/saas-application/${entry.path}`;
    const direct =
      entry.path.startsWith("base/") && entry.path.endsWith(".txt")
        ? entry.path.slice(5, -4)
        : undefined;
    if (direct) protectedCustomerSourcePaths.push(direct);
    const bytes =
      direct && hasBlob(args.sourceCommit, direct)
        ? blob(args.sourceCommit, direct)
        : blob(args.sourceCommit, target);
    outputs.push({ path: target, bytes });
    assets.push({ path: entry.path, sha256: hash(bytes) });
  }
  if (!args.check) apply(outputs);
  else assertOutputs(outputs);

  const { buildSaasApplicationTargetPlan } =
    await import("./generators/src/blueprints/saasApplication.js");
  const plan = buildSaasApplicationTargetPlan();
  const blueprintValue = {
    schemaVersion: plan.schemaVersion,
    id: plan.id,
    provenance: plan.provenance,
    projectionSource: { sourceCommit: args.sourceCommit, assets },
    registrations: plan.registrations,
    entries: plan.entries.map(({ content: _content, ...entry }: any) => entry),
  } as Json;
  const blueprintBytes = json(blueprintValue);
  outputs.push({ path: blueprintPath, bytes: blueprintBytes });

  const reviewedSourcePaths = sourcePaths(args.sourceCommit);
  const exclusions = parseReviewedFactoryOnlyExclusions({
    value: current.additionalPaths,
    sourcePaths: reviewedSourcePaths,
    protectedCustomerPaths: protectedCustomerSourcePaths,
  });
  const inventory = buildReviewedOwnershipInventory({
    sourcePaths: reviewedSourcePaths,
    exclusions,
  });
  const currentTemplate = new Map(
    inventory
      .filter((entry) => entry.ownership === "template-owned")
      .map((entry) => [entry.path, hash(blob(args.sourceCommit, entry.path))]),
  );
  const priorHashes = new Map(
    Object.entries(prior.expectedHashes ?? {}) as [string, string][],
  );
  const oldKinds = new Map(
    (current.upgrade.operations as any[])
      .filter((operation) => operation.ownership === "template-owned")
      .map((operation) => [operation.path, operation]),
  );
  const managed = new Set([...currentTemplate.keys(), ...oldKinds.keys()]);
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
  const generated = (current.upgrade.operations as any[])
    .filter((operation) => operation.ownership === "generated")
    .map((operation) => ({ ...operation }));
  const packageEntry = plan.entries.find(
    (entry: any) => entry.path === "package.json",
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
  const composed = await composeAppMap({
    repoRoot: root,
    revision: args.sourceCommit,
  });
  if (!composed.ok) throw new Error(composed.message);
  const structural = allOperations
    .map((operation) => operation.path)
    .filter((path) =>
      APP_MAP_INPUT_MANIFEST_V1.requiredSources.some((entry: any) =>
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
  const impactInputBytes = json(composed.input as unknown as Json);
  const impactBytes = json({
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
  const migrationBytes = blob(args.sourceCommit, migrationPath);
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
  } as Json;
  const manifestBytes = json(manifestValue);
  outputs.push({ path: manifestPath, bytes: manifestBytes });

  const compositionPath = "apps/cli/src/factory/createComposition.ts";
  let composition = blob(args.sourceCommit, compositionPath).toString("utf8");
  composition = composition
    .replace(
      /const BASE_MANIFEST_CHECKSUM =\n  "sha256:[0-9a-f]{64}";/u,
      `const BASE_MANIFEST_CHECKSUM =\n  "${hash(manifestBytes)}";`,
    )
    .replace(
      /const BASE_BLUEPRINT_CHECKSUM =\n  "sha256:[0-9a-f]{64}";/u,
      `const BASE_BLUEPRINT_CHECKSUM =\n  "${hash(blueprintBytes)}";`,
    )
    .replace(
      /const BASE_COMMIT = "[0-9a-f]{40}";/u,
      `const BASE_COMMIT = "${args.sourceCommit}";`,
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
