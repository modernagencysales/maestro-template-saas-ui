import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import {
  assertMaterializableCustomerReleaseManifest,
  resolveCustomerReleasePath,
  type CustomerReleaseManifest,
  type CustomerReleasePath,
  type ResolvedCustomerReleaseBinding,
} from "./manifest";
import { validateCustomerTargetIntegrity } from "./integrity.js";

export class CustomerMaterializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerMaterializationError";
  }
}

export type CustomerMaterializationRequest = {
  readonly manifest: CustomerReleaseManifest;
  readonly sourceRoot: string;
  readonly targetRoot: string;
  readonly homeRoot: string;
  readonly factoryRoot: string;
  readonly sourceDirty: boolean;
  readonly sourceRevision: string;
  readonly generatedFiles: Readonly<Record<string, Buffer>>;
  readonly blueprintTargetPlan?: {
    readonly digest: string;
    readonly entries: readonly ({
      readonly path: string;
      readonly bytes: Buffer;
      readonly replaces?: "copy" | "generate";
    } & (
      | {
          readonly ownership: "generated";
          readonly action: "generate";
          readonly upgrade: "regenerate";
        }
      | {
          readonly ownership: "customer-extension";
          readonly action: "copy";
          readonly upgrade: "preserve";
        }
    ))[];
  };
  readonly resolvedRelease: ResolvedCustomerReleaseBinding;
};

export type CustomerTargetPreview = {
  readonly preflightFingerprint: string;
  readonly targetRoot: string;
  readonly stageRoot: string;
  readonly writes: readonly {
    readonly path: string;
    readonly action: "copy" | "generate";
    readonly sha256: string;
    readonly bytes: number;
  }[];
  readonly omissions: readonly string[];
  readonly collisions: readonly string[];
  readonly totalBytes: number;
};

type Journal = {
  readonly version: 1;
  readonly status: "staging" | "materialized";
  readonly targetRoot: string;
  readonly preflightFingerprint: string;
  readonly files: readonly { readonly path: string; readonly sha256: string }[];
};

const JOURNAL = ".maestro-create-journal.json";
const hash = (bytes: string | Buffer): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const inside = (root: string, path: string): boolean => {
  const child = relative(root, path);
  return child === "" || (!child.startsWith(`..${sep}`) && child !== "..");
};
const safeRelativePath = (path: string): boolean =>
  path.length > 0 &&
  !path.startsWith("/") &&
  !path.includes("\\") &&
  !path.split("/").includes("..");

const prospectiveRealPath = (path: string): string => {
  const absolute = resolve(path);
  let ancestor = absolute;
  while (!existsSync(ancestor)) {
    const parent = dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  return resolve(realpathSync(ancestor), relative(ancestor, absolute));
};

const containedPath = (root: string, path: string): string => {
  if (!safeRelativePath(path)) {
    throw new CustomerMaterializationError(
      `Unsafe materialization path: ${path}`,
    );
  }
  const destination = resolve(root, path);
  if (!inside(resolve(root), destination)) {
    throw new CustomerMaterializationError(
      `Path escapes materialization root: ${path}`,
    );
  }
  return destination;
};

const listFiles = (root: string, prefix = ""): string[] => {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return listFiles(resolve(root, entry.name), path);
    return [path];
  });
};

const listDirectories = (root: string, prefix = ""): string[] => {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return [];
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    return [path, ...listDirectories(resolve(root, entry.name), path)];
  });
};

const assertRoots = (request: CustomerMaterializationRequest): string => {
  const source = realpathSync(request.sourceRoot);
  const factory = realpathSync(request.factoryRoot);
  const home = realpathSync(request.homeRoot);
  const target = prospectiveRealPath(request.targetRoot);
  if (target === resolve("/") || target === home) {
    throw new CustomerMaterializationError("Target is a protected root");
  }
  if (
    target === source ||
    target === factory ||
    inside(source, target) ||
    inside(factory, target) ||
    inside(target, source) ||
    inside(target, factory)
  ) {
    throw new CustomerMaterializationError(
      "Target must be separate from the factory source",
    );
  }
  if (
    existsSync(request.targetRoot) &&
    lstatSync(request.targetRoot).isSymbolicLink()
  ) {
    throw new CustomerMaterializationError(
      "Symbolic link target is not allowed",
    );
  }
  if (
    existsSync(request.targetRoot) &&
    !lstatSync(request.targetRoot).isDirectory()
  ) {
    throw new CustomerMaterializationError(
      "Target exists and is not a directory",
    );
  }
  return target;
};

const assertEntry = (entry: CustomerReleasePath): void => {
  containedPath("/materialization-root", entry.path);
  const valid =
    (entry.ownership === "template-owned" &&
      entry.action === "copy" &&
      entry.upgrade === "replace") ||
    (entry.ownership === "customer-extension" &&
      entry.action === "copy" &&
      entry.upgrade === "preserve") ||
    (entry.ownership === "generated" &&
      entry.action === "generate" &&
      entry.upgrade === "regenerate") ||
    (entry.ownership === "local-only" &&
      entry.action === "omit" &&
      entry.upgrade === "preserve") ||
    (entry.ownership === "factory-only" &&
      entry.action === "omit" &&
      entry.upgrade === "remove");
  if (!valid)
    throw new CustomerMaterializationError(
      `Unknown ownership posture: ${entry.path}`,
    );
};

const operationBytes = (
  request: CustomerMaterializationRequest,
  entry: CustomerReleasePath,
): Buffer => {
  const blueprint = request.blueprintTargetPlan?.entries.find(
    ({ path }) => path === entry.path,
  );
  if (blueprint) return blueprint.bytes;
  if (entry.action === "generate") {
    const generated = request.generatedFiles[entry.path];
    if (!generated)
      throw new CustomerMaterializationError(
        `Missing generated bytes: ${entry.path}`,
      );
    return generated;
  }
  const sourceRoot = realpathSync(request.sourceRoot);
  const sourcePath = containedPath(sourceRoot, entry.path);
  const stat = lstatSync(sourcePath);
  if (stat.isSymbolicLink()) {
    throw new CustomerMaterializationError(
      `Symbolic link source is not allowed: ${entry.path}`,
    );
  }
  if (!stat.isFile() || !inside(sourceRoot, realpathSync(sourcePath))) {
    throw new CustomerMaterializationError(
      `Source path escapes or is not a file: ${entry.path}`,
    );
  }
  return readFileSync(sourcePath);
};

export function previewCustomerTarget(
  request: CustomerMaterializationRequest,
): CustomerTargetPreview {
  assertMaterializableCustomerReleaseManifest(
    request.manifest,
    request.resolvedRelease,
  );
  const targetRoot = assertRoots(request);
  if (request.sourceDirty)
    throw new CustomerMaterializationError("Factory source is dirty");
  if (request.sourceRevision !== request.manifest.release.sourceCommit) {
    throw new CustomerMaterializationError(
      "Factory source revision does not match release",
    );
  }
  for (const entry of request.manifest.paths) assertEntry(entry);
  const sourcePaths = listFiles(request.sourceRoot).sort();
  const sourceEntries = sourcePaths.map((path): CustomerReleasePath => {
    const ownershipRule = resolveCustomerReleasePath(
      request.manifest.paths,
      path,
    );
    if (!ownershipRule) {
      throw new CustomerMaterializationError(`Unknown ownership: ${path}`);
    }
    return { ...ownershipRule, path, match: "exact" };
  });
  const generatedEntries = request.manifest.paths.filter(
    (entry) => entry.action === "generate" && entry.match === "exact",
  );
  const baseEntries = [
    ...sourceEntries.filter((entry) => entry.action === "copy"),
    ...generatedEntries,
  ];
  const blueprintEntries = (request.blueprintTargetPlan?.entries ?? []).map(
    (entry): CustomerReleasePath => ({ ...entry, match: "exact" }),
  );
  const baseByPath = new Map(baseEntries.map((entry) => [entry.path, entry]));
  for (const [index, entry] of blueprintEntries.entries()) {
    assertEntry(entry);
    const planEntry = request.blueprintTargetPlan?.entries[index];
    const base = baseByPath.get(entry.path);
    if (base && planEntry?.replaces !== base.action) {
      throw new CustomerMaterializationError(
        `Blueprint target plan overlaps release operation: ${entry.path}`,
      );
    }
    if (!base && planEntry?.replaces !== undefined) {
      throw new CustomerMaterializationError(
        `Blueprint replacement has no release operation: ${entry.path}`,
      );
    }
  }
  const replacementPaths = new Set(
    (request.blueprintTargetPlan?.entries ?? [])
      .filter(({ replaces }) => replaces !== undefined)
      .map(({ path }) => path),
  );
  const writes = [
    ...baseEntries.filter(({ path }) => !replacementPaths.has(path)),
    ...blueprintEntries,
  ]
    .map((entry) => {
      assertEntry(entry);
      if (entry.action === "omit") {
        throw new CustomerMaterializationError(
          `Omitted path reached write planning: ${entry.path}`,
        );
      }
      const bytes = operationBytes(request, entry);
      const sha256 = hash(bytes);
      if (
        entry.action === "copy" &&
        !request.blueprintTargetPlan?.entries.some(
          ({ path }) => path === entry.path,
        ) &&
        request.manifest.expectedHashes[entry.path] !== sha256
      ) {
        throw new CustomerMaterializationError(
          `Source hash mismatch: ${entry.path}`,
        );
      }
      return {
        path: entry.path,
        action: entry.action,
        sha256,
        bytes: bytes.length,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
  const targetFiles = Object.fromEntries(
    writes.map(({ path }) => {
      const ownershipRule =
        request.blueprintTargetPlan?.entries.find(
          (entry) => entry.path === path,
        ) ?? resolveCustomerReleasePath(request.manifest.paths, path);
      if (!ownershipRule) {
        throw new CustomerMaterializationError(
          `Unknown integrity operation: ${path}`,
        );
      }
      return [
        path,
        operationBytes(request, { ...ownershipRule, path, match: "exact" }),
      ];
    }),
  );
  const integrityFindings = validateCustomerTargetIntegrity(targetFiles);
  if (integrityFindings.length > 0) {
    throw new CustomerMaterializationError(
      `Customer target integrity failed: ${integrityFindings
        .map(({ code, path, reference }) => `${code}:${path}:${reference}`)
        .join(", ")}`,
    );
  }
  const omissions = [
    ...sourceEntries
      .filter(({ action }) => action === "omit")
      .map(({ path }) => path),
    ...request.manifest.paths
      .filter(({ action, match }) => action === "omit" && match === "exact")
      .map(({ path }) => path),
  ]
    .filter((path, index, values) => values.indexOf(path) === index)
    .sort();
  const collisions = listFiles(request.targetRoot).sort();
  const preflightFingerprint = hash(
    JSON.stringify({
      sourceRevision: request.sourceRevision,
      blueprintDigest: request.blueprintTargetPlan?.digest ?? null,
      targetRoot,
      writes: writes.map(({ path, sha256 }) => ({ path, sha256 })),
      collisions,
    }),
  );
  return {
    preflightFingerprint,
    targetRoot,
    stageRoot: resolve(
      dirname(targetRoot),
      `.maestro-stage-${preflightFingerprint.slice("sha256:".length)}`,
    ),
    writes,
    omissions,
    collisions,
    totalBytes: writes.reduce((total, entry) => total + entry.bytes, 0),
  };
}

const writeJournal = (root: string, journal: Journal): void => {
  const temporary = resolve(root, `${JOURNAL}.tmp`);
  writeFileSync(temporary, `${JSON.stringify(journal, null, 2)}\n`, {
    flag: "wx",
  });
  renameSync(temporary, resolve(root, JOURNAL));
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJournal = (root: string): Journal => {
  const value: unknown = JSON.parse(
    readFileSync(resolve(root, JOURNAL), "utf8"),
  );
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    (value.status !== "staging" && value.status !== "materialized") ||
    typeof value.targetRoot !== "string" ||
    typeof value.preflightFingerprint !== "string" ||
    !Array.isArray(value.files)
  ) {
    throw new CustomerMaterializationError("Invalid materialization journal");
  }
  const files = value.files.flatMap((file) => {
    if (
      !isRecord(file) ||
      typeof file.path !== "string" ||
      typeof file.sha256 !== "string" ||
      !safeRelativePath(file.path) ||
      !/^sha256:[0-9a-f]{64}$/.test(file.sha256)
    ) {
      throw new CustomerMaterializationError(
        "Invalid materialization journal file",
      );
    }
    return [{ path: file.path, sha256: file.sha256 }];
  });
  return {
    version: 1,
    status: value.status,
    targetRoot: value.targetRoot,
    preflightFingerprint: value.preflightFingerprint,
    files,
  };
};

const verifyJournalTree = (root: string, journal: Journal): void => {
  const expected = new Map(
    journal.files.map((file) => [file.path, file.sha256]),
  );
  const expectedDirectories = new Set<string>();
  for (const path of expected.keys()) {
    let directory = dirname(path);
    while (directory !== ".") {
      expectedDirectories.add(directory);
      directory = dirname(directory);
    }
  }
  for (const directory of listDirectories(root)) {
    if (!expectedDirectories.has(directory)) {
      throw new CustomerMaterializationError(
        `Unjournaled materialized directory: ${directory}`,
      );
    }
  }
  const actual = listFiles(root).filter((path) => path !== JOURNAL);
  for (const path of actual) {
    if (!expected.has(path))
      throw new CustomerMaterializationError(
        `Unjournaled materialized path: ${path}`,
      );
    if (hash(readFileSync(containedPath(root, path))) !== expected.get(path)) {
      throw new CustomerMaterializationError(`Rollback hash mismatch: ${path}`);
    }
  }
};

const removeJournalTree = (root: string): void => {
  const existing = listFiles(root).filter((path) => path !== JOURNAL);
  for (const path of existing) unlinkSync(containedPath(root, path));
  unlinkSync(resolve(root, JOURNAL));
  const directories = new Set<string>();
  for (const path of existing) {
    let directory = dirname(path);
    while (directory !== ".") {
      directories.add(directory);
      directory = dirname(directory);
    }
  }
  for (const directory of [...directories].sort(
    (a, b) => b.length - a.length,
  )) {
    rmdirSync(containedPath(root, directory));
  }
  rmdirSync(root);
};

export function recoverInterruptedCustomerTarget(
  _request: CustomerMaterializationRequest,
  preview: CustomerTargetPreview,
): { readonly recovered: boolean } {
  if (!existsSync(preview.stageRoot)) return { recovered: false };
  if (listFiles(preview.stageRoot).length === 0) {
    rmdirSync(preview.stageRoot);
    return { recovered: true };
  }
  const journal = readJournal(preview.stageRoot);
  if (
    journal.preflightFingerprint !== preview.preflightFingerprint ||
    journal.targetRoot !== preview.targetRoot
  ) {
    throw new CustomerMaterializationError(
      "Interrupted journal does not match preflight",
    );
  }
  verifyJournalTree(preview.stageRoot, journal);
  removeJournalTree(preview.stageRoot);
  return { recovered: true };
}

export function materializeCustomerTarget(
  request: CustomerMaterializationRequest,
  preview: CustomerTargetPreview,
  options: { readonly interruptAfterFiles?: number } = {},
): { readonly targetRoot: string; readonly files: number } {
  let current: CustomerTargetPreview;
  try {
    current = previewCustomerTarget(request);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "unknown preflight failure";
    throw new CustomerMaterializationError(`Preflight changed: ${detail}`);
  }
  if (current.preflightFingerprint !== preview.preflightFingerprint) {
    throw new CustomerMaterializationError("Preflight changed after preview");
  }
  if (current.collisions.length > 0) {
    throw new CustomerMaterializationError(
      `Target contains collisions: ${current.collisions.join(", ")}`,
    );
  }
  if (existsSync(preview.stageRoot)) {
    throw new CustomerMaterializationError(
      "Interrupted staging exists; recover it first",
    );
  }
  mkdirSync(preview.stageRoot);
  const staging: Journal = {
    version: 1,
    status: "staging",
    targetRoot: preview.targetRoot,
    preflightFingerprint: preview.preflightFingerprint,
    files: preview.writes.map(({ path, sha256 }) => ({ path, sha256 })),
  };
  writeJournal(preview.stageRoot, staging);
  for (const [index, write] of preview.writes.entries()) {
    const ownershipRule =
      request.blueprintTargetPlan?.entries.find(
        ({ path }) => path === write.path,
      ) ?? resolveCustomerReleasePath(request.manifest.paths, write.path);
    if (!ownershipRule) {
      throw new CustomerMaterializationError(
        `Unknown staged operation: ${write.path}`,
      );
    }
    const entry: CustomerReleasePath = {
      ...ownershipRule,
      path: write.path,
      match: "exact",
    };
    const bytes = operationBytes(request, entry);
    if (hash(bytes) !== write.sha256)
      throw new CustomerMaterializationError(
        `Preflight changed while staging: ${write.path}`,
      );
    const destination = containedPath(preview.stageRoot, write.path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, bytes, { flag: "wx" });
    if (hash(readFileSync(destination)) !== write.sha256) {
      throw new CustomerMaterializationError(
        `Staged hash mismatch: ${write.path}`,
      );
    }
    if (options.interruptAfterFiles === index + 1) {
      throw new CustomerMaterializationError("Materialization interrupted");
    }
  }
  writeJournal(preview.stageRoot, { ...staging, status: "materialized" });
  if (existsSync(preview.targetRoot)) rmdirSync(preview.targetRoot);
  renameSync(preview.stageRoot, preview.targetRoot);
  return { targetRoot: preview.targetRoot, files: preview.writes.length };
}

export function rollbackCustomerTarget(targetRoot: string): {
  readonly rolledBack: true;
} {
  const root = realpathSync(targetRoot);
  const journal = readJournal(root);
  if (journal.status !== "materialized" || journal.targetRoot !== root) {
    throw new CustomerMaterializationError(
      "Target is not a journaled materialization",
    );
  }
  verifyJournalTree(root, journal);
  if (
    journal.files.some(({ path }) => !existsSync(containedPath(root, path)))
  ) {
    throw new CustomerMaterializationError(
      "Rollback target is missing a journaled path",
    );
  }
  removeJournalTree(root);
  return { rolledBack: true };
}
