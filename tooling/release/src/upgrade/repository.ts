import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { projectReviewedUpgradeImpact } from "@maestro-template/app-map-tooling/upgrade-impact";
import { buildAppMapImpact } from "@maestro-template/app-map-tooling/impact";
import type {
  UpgradeManifestV1,
  UpgradePlanInputV1,
  UpgradePlanResult,
} from "./contract.js";
import { planUpgrade } from "./plan.js";
import { verifyAppliedUpgrade } from "./verify.js";

type SuccessfulPlan = Extract<UpgradePlanResult, { readonly ok: true }>;
type UpgradeJournalUnsigned = {
  readonly schemaVersion: 1;
  readonly kind: "maestro-upgrade-transaction";
  readonly status: "prepared" | "applied";
  readonly planFingerprint: string;
  readonly manifestFingerprint: string;
  readonly preUpgradeCommit: string;
  readonly releaseRoot: string;
  readonly releaseRootCommit: string;
  readonly releaseManifestHash: string;
  readonly baseManifestHash: string;
  readonly targetRoot: string;
  readonly backupRoot: string;
  readonly promotedPaths: readonly string[];
  readonly planInput: UpgradePlanInputV1;
};

type UpgradeJournal = UpgradeJournalUnsigned & {
  readonly journalDigest: string;
};

export type TrustedRepositoryUpgradePlan = {
  readonly authorityFingerprint: string;
  readonly plan: SuccessfulPlan;
  readonly planInput: UpgradePlanInputV1;
  readonly targetRoot: string;
  readonly releaseRoot: string;
  readonly releaseRootCommit: string;
  readonly releaseManifestPath: string;
  readonly releaseManifestHash: string;
  readonly baseManifestPath: string;
  readonly baseManifestHash: string;
  readonly sourceCommit: string;
  readonly sourceTag: string;
  readonly sourceChecksum: string;
  readonly migration: {
    readonly required: boolean;
    readonly executionAvailable: false;
    readonly manifestPath: string;
    readonly manifestHash: string;
    readonly transitionId: string;
    readonly migrationId: string;
    readonly fileUpgradePlanFingerprint: string;
  };
  readonly impact: unknown;
};

export type UpgradeApplyReceipt = UpgradeJournal & {
  readonly status: "applied";
};

const sha256 = (bytes: string | Buffer): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const gitText = (root: string, args: readonly string[]): string =>
  execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
const gitBytes = (root: string, args: readonly string[]): Buffer =>
  execFileSync("git", ["-C", root, ...args]);
const exactCommit = (value: string): boolean =>
  /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u.test(value);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const onlyKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean => Object.keys(value).every((key) => keys.includes(key));
const digest = (value: unknown): value is string =>
  typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
const sortedUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort();
const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8"));

const canonicalRoot = (requested: string, label: string): string => {
  const resolved = resolve(requested);
  const canonical = realpathSync(resolved);
  const temporaryRoot = resolve(tmpdir());
  const relativeTemporaryPath = relative(temporaryRoot, resolved);
  const isDirectTemporaryPath =
    relativeTemporaryPath !== "" &&
    relativeTemporaryPath !== ".." &&
    !relativeTemporaryPath.startsWith(`..${sep}`) &&
    !isAbsolute(relativeTemporaryPath) &&
    canonical === resolve(realpathSync(temporaryRoot), relativeTemporaryPath);
  if (canonical !== resolved && !isDirectTemporaryPath)
    throw new Error(
      `${label} must be a canonical path with no symbolic-link root.`,
    );
  return resolved;
};

const sealJournal = (journal: UpgradeJournalUnsigned): UpgradeJournal => ({
  ...journal,
  journalDigest: sha256(JSON.stringify(journal)),
});

const unsignedJournal = (journal: UpgradeJournal): UpgradeJournalUnsigned => {
  const unsigned = { ...journal };
  delete (unsigned as { journalDigest?: string }).journalDigest;
  return unsigned;
};

const recomputeJournalDigest = (journal: UpgradeJournal): string =>
  sha256(JSON.stringify(unsignedJournal(journal)));

const contained = (root: string, path: string): string => {
  const absolute = resolve(root, path);
  const rel = relative(resolve(root), absolute);
  if (rel === ".." || rel.startsWith(`..${sep}`) || rel === "")
    throw new Error(`Upgrade path escapes or aliases its root: ${path}`);
  return absolute;
};

const noSymlinkPath = (
  root: string,
  path: string,
  options: { readonly allowMissingLeaf: boolean },
): string => {
  const absolute = contained(root, path);
  const rel = relative(resolve(root), absolute);
  let current = resolve(root);
  for (const [index, part] of rel.split(sep).entries()) {
    current = join(current, part);
    let stat: ReturnType<typeof lstatSync>;
    try {
      stat = lstatSync(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      if (options.allowMissingLeaf && index === rel.split(sep).length - 1)
        return absolute;
      if (options.allowMissingLeaf) continue;
      throw new Error(`Required upgrade path is missing: ${path}`);
    }
    if (stat.isSymbolicLink())
      throw new Error(`Upgrade path contains a symbolic link: ${path}`);
    if (
      index === rel.split(sep).length - 1 &&
      !stat.isFile() &&
      !stat.isDirectory()
    )
      throw new Error(
        `Upgrade path is not a regular file or directory: ${path}`,
      );
  }
  return absolute;
};

const gitBlob = (root: string, revision: string, path: string): Buffer => {
  const tree = gitText(root, ["ls-tree", revision, "--", path]);
  const mode = tree.split(/\s+/u)[0];
  if (mode !== "100644" && mode !== "100755")
    throw new Error(
      `Release source path is not a regular tracked blob: ${path}`,
    );
  return gitBytes(root, ["show", `${revision}:${path}`]);
};

const targetVersion = (root: string): string => {
  const path = noSymlinkPath(root, "template-instance.json", {
    allowMissingLeaf: false,
  });
  const candidate = readJson(path);
  if (
    !record(candidate) ||
    !record(candidate.release) ||
    typeof candidate.release.version !== "string"
  )
    throw new Error(
      "Target template-instance.json has no canonical release.version.",
    );
  return candidate.release.version;
};

const repositoryAuthorityFingerprint = (input: {
  readonly targetRoot: string;
  readonly releaseRoot: string;
  readonly releaseRootCommit: string;
  readonly releaseManifestHash: string;
  readonly baseManifestHash: string;
  readonly sourceCommit: string;
  readonly sourceTag: string;
  readonly sourceChecksum: string;
  readonly migrationManifestHash: string;
  readonly migrationRequired: boolean;
  readonly planFingerprint: string;
}): string => sha256(JSON.stringify(input));

const durableJson = (path: string, value: unknown): void => {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  const descriptor = openSync(temporary, "w", 0o600);
  try {
    writeSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temporary, path);
  const directory = openSync(dirname(path), "r");
  try {
    fsyncSync(directory);
  } finally {
    closeSync(directory);
  }
};

export const planRepositoryUpgrade = (input: {
  readonly targetRoot: string;
  readonly releaseRoot: string;
  readonly toVersion: string;
}): TrustedRepositoryUpgradePlan => {
  const targetRoot = canonicalRoot(input.targetRoot, "Upgrade target root");
  const releaseRoot = canonicalRoot(
    input.releaseRoot,
    "Release authority root",
  );
  if (
    gitText(releaseRoot, ["status", "--porcelain", "--untracked-files=all"]) !==
    ""
  )
    throw new Error("Release authority checkout must be clean.");
  const releaseRootCommit = gitText(releaseRoot, ["rev-parse", "HEAD"]);
  if (!exactCommit(releaseRootCommit))
    throw new Error("Release authority HEAD is invalid.");
  const releaseManifestRelative = `releases/v${input.toVersion}/manifest.json`;
  const releaseManifestPath = noSymlinkPath(
    releaseRoot,
    releaseManifestRelative,
    {
      allowMissingLeaf: false,
    },
  );
  const releaseSource = gitBlob(
    releaseRoot,
    releaseRootCommit,
    releaseManifestRelative,
  );
  const release = JSON.parse(releaseSource.toString("utf8")) as unknown;
  if (
    !record(release) ||
    !record(release.release) ||
    release.release.version !== input.toVersion ||
    typeof release.release.sourceCommit !== "string" ||
    !exactCommit(release.release.sourceCommit) ||
    typeof release.release.tag !== "string" ||
    typeof release.release.sourceChecksum !== "string" ||
    !digest(release.release.sourceChecksum) ||
    !record(release.baseManifest) ||
    typeof release.baseManifest.path !== "string" ||
    typeof release.baseManifest.sha256 !== "string" ||
    !record(release.upgrade) ||
    !record(release.migrationHandoff) ||
    typeof release.migrationHandoff.required !== "boolean" ||
    release.migrationHandoff.executionAvailable !== false ||
    typeof release.migrationHandoff.path !== "string" ||
    typeof release.migrationHandoff.sha256 !== "string" ||
    !digest(release.migrationHandoff.sha256) ||
    !record(release.upgradeImpact) ||
    typeof release.upgradeImpact.path !== "string" ||
    typeof release.upgradeImpact.sha256 !== "string" ||
    !record(release.upgradeImpact.projection) ||
    typeof release.upgradeImpact.projection.path !== "string" ||
    typeof release.upgradeImpact.projection.sha256 !== "string"
  )
    throw new Error(
      "Release manifest does not expose closed upgrade and impact authority.",
    );
  const baseAbsolute = resolve(
    dirname(releaseManifestPath),
    release.baseManifest.path,
  );
  const baseRelative = relative(releaseRoot, baseAbsolute);
  noSymlinkPath(releaseRoot, baseRelative, { allowMissingLeaf: false });
  const baseBytes = gitBlob(releaseRoot, releaseRootCommit, baseRelative);
  const baseManifestHash = sha256(baseBytes);
  if (baseManifestHash !== release.baseManifest.sha256)
    throw new Error("Pinned base release manifest bytes do not match.");
  const impactPath = String(release.upgradeImpact.path);
  noSymlinkPath(releaseRoot, impactPath, { allowMissingLeaf: false });
  const impactBytes = gitBlob(releaseRoot, releaseRootCommit, impactPath);
  if (sha256(impactBytes) !== release.upgradeImpact.sha256)
    throw new Error("Pinned App Map input bytes do not match.");
  const impactInput = JSON.parse(impactBytes.toString("utf8")) as unknown;
  const projectionPath = String(release.upgradeImpact.projection.path);
  noSymlinkPath(releaseRoot, projectionPath, { allowMissingLeaf: false });
  const projectionBytes = gitBlob(
    releaseRoot,
    releaseRootCommit,
    projectionPath,
  );
  if (sha256(projectionBytes) !== release.upgradeImpact.projection.sha256)
    throw new Error("Pinned App Map impact projection bytes do not match.");
  const projection = JSON.parse(projectionBytes.toString("utf8")) as unknown;
  const manifest = release.upgrade as UpgradeManifestV1;
  if (!Array.isArray(manifest.operations) || manifest.operations.length === 0)
    throw new Error("Reviewed release upgrade has no file operations.");
  const migrationManifestPath = String(release.migrationHandoff.path);
  noSymlinkPath(releaseRoot, migrationManifestPath, {
    allowMissingLeaf: false,
  });
  const migrationManifestBytes = gitBlob(
    releaseRoot,
    releaseRootCommit,
    migrationManifestPath,
  );
  const migrationManifestHash = sha256(migrationManifestBytes);
  if (migrationManifestHash !== release.migrationHandoff.sha256)
    throw new Error("Pinned migration handoff bytes do not match authority.");
  const migrationManifest = JSON.parse(
    migrationManifestBytes.toString("utf8"),
  ) as unknown;
  if (
    !record(migrationManifest) ||
    migrationManifest.schemaVersion !== 1 ||
    !record(migrationManifest.transition) ||
    migrationManifest.transition.id !== manifest.transition.id ||
    migrationManifest.transition.fromVersion !==
      manifest.transition.fromVersion ||
    migrationManifest.transition.toVersion !== manifest.transition.toVersion ||
    !record(migrationManifest.handoff) ||
    typeof migrationManifest.handoff.migrationId !== "string" ||
    !record(migrationManifest.receiptAuthority) ||
    migrationManifest.receiptAuthority.available !== false
  )
    throw new Error(
      "Pinned migration handoff does not match release authority.",
    );
  const sourceCommit = release.release.sourceCommit;
  let sourceMergeBase: string;
  try {
    sourceMergeBase = gitText(releaseRoot, [
      "merge-base",
      sourceCommit,
      releaseRootCommit,
    ]);
  } catch {
    throw new Error(
      "Release source commit is not reachable from release authority HEAD.",
    );
  }
  if (sourceMergeBase !== sourceCommit)
    throw new Error(
      "Release source commit is not an ancestor of release authority HEAD.",
    );
  const sourceChecksum = sha256(
    gitBytes(releaseRoot, ["archive", "--format=tar", sourceCommit]),
  );
  if (sourceChecksum !== release.release.sourceChecksum)
    throw new Error(
      "Release source archive checksum does not match authority.",
    );
  const commit = gitText(targetRoot, ["rev-parse", "HEAD"]);
  const clean =
    gitText(targetRoot, ["status", "--porcelain", "--untracked-files=all"]) ===
    "";
  const files = manifest.operations.flatMap((operation) => {
    const sourcePath =
      operation.kind === "move" ? operation.fromPath : operation.path;
    if (!sourcePath) return [];
    const absolute = noSymlinkPath(targetRoot, sourcePath, {
      allowMissingLeaf: true,
    });
    if (!existsSync(absolute)) return [];
    return [
      {
        path: sourcePath,
        ownership: operation.ownership,
        hash: sha256(readFileSync(absolute)),
      },
    ];
  });
  for (const operation of manifest.operations) {
    if (operation.kind !== "add" && operation.kind !== "move") continue;
    const absolute = noSymlinkPath(targetRoot, operation.path, {
      allowMissingLeaf: true,
    });
    if (
      existsSync(absolute) &&
      !files.some(({ path }) => path === operation.path)
    )
      files.push({
        path: operation.path,
        ownership: "customer-owned" as const,
        hash: sha256(readFileSync(absolute)),
      });
  }
  const planInput: UpgradePlanInputV1 = {
    schemaVersion: 1,
    manifest,
    target: {
      version: targetVersion(targetRoot),
      relation: "immediate-prior",
      commit,
      clean,
      files,
    },
  };
  const plan = planUpgrade(planInput);
  if (!plan.ok)
    throw new Error(
      `Upgrade plan blocked: ${plan.resolutions.map(({ code }) => code).join(",")}`,
    );
  const reviewedPaths = plan.diff.flatMap(({ path, fromPath }) =>
    fromPath ? [fromPath, path] : [path],
  );
  if (
    !record(projection) ||
    projection.schemaVersion !== 1 ||
    projection.kind !== "reviewed-upgrade-impact-coverage" ||
    !exactCommit(String(projection.baseRevision)) ||
    projection.subjectRevision !== sourceCommit ||
    !Array.isArray(projection.structuralPaths) ||
    !projection.structuralPaths.every((path) => typeof path === "string") ||
    !Array.isArray(projection.ownershipCoveredPaths) ||
    !projection.ownershipCoveredPaths.every(
      (path) => typeof path === "string",
    ) ||
    !record(projection.impact)
  )
    throw new Error("Pinned App Map impact coverage is invalid.");
  const structuralPaths = sortedUnique(projection.structuralPaths as string[]);
  const ownershipCoveredPaths = sortedUnique(
    projection.ownershipCoveredPaths as string[],
  );
  if (
    structuralPaths.some((path) => ownershipCoveredPaths.includes(path)) ||
    JSON.stringify(
      sortedUnique([...structuralPaths, ...ownershipCoveredPaths]),
    ) !== JSON.stringify(sortedUnique(reviewedPaths))
  )
    throw new Error(
      "Pinned App Map and ownership coverage do not close reviewed paths.",
    );
  const pinnedImpact = buildAppMapImpact({
    schemaVersion: 1,
    baseRevision: projection.baseRevision,
    mapInput: impactInput,
    changedPaths: structuralPaths,
  });
  if (
    !pinnedImpact.ok ||
    JSON.stringify(pinnedImpact.impact) !== JSON.stringify(projection.impact)
  )
    throw new Error(
      "Pinned App Map impact projection does not rebuild exactly.",
    );
  const impact = projectReviewedUpgradeImpact({
    schemaVersion: 1,
    authority: "reviewed-upgrade-plan",
    transitionId: plan.transitionId,
    manifestFingerprint: plan.manifestFingerprint,
    planFingerprint: plan.planFingerprint,
    targetCommit: plan.targetCommit,
    reviewedPaths: structuralPaths,
    impactInput: {
      schemaVersion: 1,
      baseRevision: plan.targetCommit,
      mapInput: impactInput,
      changedPaths: structuralPaths,
    },
  });
  if (!impact.ok) throw new Error(impact.diagnostic.code);
  const authority = {
    targetRoot,
    releaseRoot,
    releaseRootCommit,
    releaseManifestHash: sha256(releaseSource),
    baseManifestHash,
    sourceCommit,
    sourceTag: release.release.tag,
    sourceChecksum,
    migrationManifestHash,
    migrationRequired: release.migrationHandoff.required,
    planFingerprint: plan.planFingerprint,
  };
  return {
    authorityFingerprint: repositoryAuthorityFingerprint(authority),
    plan,
    planInput,
    targetRoot,
    releaseRoot,
    releaseRootCommit,
    releaseManifestPath,
    releaseManifestHash: authority.releaseManifestHash,
    baseManifestPath: baseAbsolute,
    baseManifestHash,
    sourceCommit,
    sourceTag: release.release.tag,
    sourceChecksum,
    migration: {
      required: release.migrationHandoff.required,
      executionAvailable: false,
      manifestPath: migrationManifestPath,
      manifestHash: migrationManifestHash,
      transitionId: manifest.transition.id,
      migrationId: migrationManifest.handoff.migrationId,
      fileUpgradePlanFingerprint: plan.planFingerprint,
    },
    impact: {
      graph: impact.value,
      pinned: projection.impact,
      ownershipCoveredPaths,
    },
  };
};

const ensureParent = (path: string): void => {
  mkdirSync(dirname(path), { recursive: true });
};

const fsyncDirectory = (path: string): void => {
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
};

const durableRename = (source: string, destination: string): void => {
  renameSync(source, destination);
  fsyncDirectory(dirname(source));
  if (dirname(destination) !== dirname(source))
    fsyncDirectory(dirname(destination));
};

const rollbackJournal = (journal: UpgradeJournal): void => {
  for (const operation of [
    ...journal.planInput.manifest.operations,
  ].reverse()) {
    const oldPath = operation.fromPath ?? operation.path;
    const backup = noSymlinkPath(journal.backupRoot, oldPath, {
      allowMissingLeaf: true,
    });
    const destination = noSymlinkPath(journal.targetRoot, operation.path, {
      allowMissingLeaf: true,
    });
    if (existsSync(backup)) {
      rmSync(destination, { recursive: true, force: true });
      const target = noSymlinkPath(journal.targetRoot, oldPath, {
        allowMissingLeaf: true,
      });
      ensureParent(target);
      durableRename(backup, target);
    } else if (operation.kind === "add") {
      if (existsSync(destination)) {
        rmSync(destination, { recursive: true, force: true });
        fsyncDirectory(dirname(destination));
      }
    }
  }
};

const fileHash = (path: string): string | undefined =>
  existsSync(path) ? sha256(readFileSync(path)) : undefined;

const validateRollbackState = (
  journal: UpgradeJournal,
  plan: SuccessfulPlan,
): void => {
  for (const entry of plan.diff) {
    const oldPath = entry.fromPath ?? entry.path;
    const backup = noSymlinkPath(journal.backupRoot, oldPath, {
      allowMissingLeaf: true,
    });
    const oldTarget = noSymlinkPath(journal.targetRoot, oldPath, {
      allowMissingLeaf: true,
    });
    const destination = noSymlinkPath(journal.targetRoot, entry.path, {
      allowMissingLeaf: true,
    });
    const backupHash = fileHash(backup);
    const oldHash = fileHash(oldTarget);
    const destinationHash = fileHash(destination);
    if (backupHash !== undefined && backupHash !== entry.beforeHash)
      throw new Error(
        `Upgrade recovery backup bytes are not reviewed: ${oldPath}`,
      );
    if (entry.kind === "add" && backupHash !== undefined)
      throw new Error(
        `Upgrade recovery has an unexpected add backup: ${entry.path}`,
      );

    if (journal.status === "applied") {
      if (entry.kind === "delete" && destinationHash !== undefined)
        throw new Error(
          `Upgrade recovery expected an applied deletion: ${entry.path}`,
        );
      if (entry.kind !== "delete" && destinationHash !== entry.afterHash)
        throw new Error(
          `Upgrade recovery applied bytes changed after apply: ${entry.path}`,
        );
      if (entry.kind === "move" && entry.fromPath && oldHash !== undefined)
        throw new Error(
          `Upgrade recovery move source unexpectedly exists: ${entry.fromPath}`,
        );
      continue;
    }

    if (backupHash === undefined) {
      if (entry.kind !== "add" && oldHash !== entry.beforeHash)
        throw new Error(
          `Upgrade recovery prepared source bytes are not reviewed: ${oldPath}`,
        );
      if (entry.kind === "move" && destinationHash !== undefined)
        throw new Error(
          `Upgrade recovery prepared move destination is unexpected: ${entry.path}`,
        );
      if (
        entry.kind === "add" &&
        destinationHash !== undefined &&
        destinationHash !== entry.afterHash
      )
        throw new Error(
          `Upgrade recovery prepared add bytes are not reviewed: ${entry.path}`,
        );
    } else if (
      entry.kind !== "delete" &&
      destinationHash !== undefined &&
      destinationHash !== entry.afterHash
    ) {
      throw new Error(
        `Upgrade recovery prepared destination bytes are not reviewed: ${entry.path}`,
      );
    }
  }
};

export const applyRepositoryUpgrade = (input: {
  readonly trusted: TrustedRepositoryUpgradePlan;
  readonly targetRoot: string;
  readonly expectedPlanFingerprint: string;
  readonly expectedAuthorityFingerprint: string;
  readonly write: boolean;
  readonly onMutationBoundary?: (
    boundary: "old-to-backup" | "stage-to-destination",
    path: string,
  ) => void;
}): { readonly receiptPath: string; readonly receipt: UpgradeApplyReceipt } => {
  if (!input.write)
    throw new Error("Upgrade apply-safe requires explicit --write.");
  if (input.expectedPlanFingerprint !== input.trusted.plan.planFingerprint)
    throw new Error("Upgrade plan fingerprint is stale.");
  if (input.expectedAuthorityFingerprint !== input.trusted.authorityFingerprint)
    throw new Error("Upgrade repository authority fingerprint is stale.");
  const targetRoot = canonicalRoot(input.targetRoot, "Upgrade target root");
  if (targetRoot !== input.trusted.targetRoot)
    throw new Error(
      "Upgrade apply target does not match the exact planned target root.",
    );
  const trusted = planRepositoryUpgrade({
    targetRoot,
    releaseRoot: input.trusted.releaseRoot,
    toVersion: input.trusted.planInput.manifest.transition.toVersion,
  });
  if (
    trusted.plan.planFingerprint !== input.expectedPlanFingerprint ||
    trusted.authorityFingerprint !== input.expectedAuthorityFingerprint ||
    trusted.releaseRootCommit !== input.trusted.releaseRootCommit ||
    trusted.releaseManifestHash !== input.trusted.releaseManifestHash ||
    trusted.baseManifestHash !== input.trusted.baseManifestHash ||
    trusted.sourceCommit !== input.trusted.sourceCommit ||
    trusted.sourceTag !== input.trusted.sourceTag ||
    trusted.sourceChecksum !== input.trusted.sourceChecksum
  )
    throw new Error("Upgrade authority changed after planning.");
  if (trusted.migration.required)
    throw new Error(
      "Upgrade apply requires an externally trusted, release-bound migration receipt and durable replay-consumption authority.",
    );
  let tagCommit: string;
  try {
    tagCommit = gitText(trusted.releaseRoot, [
      "rev-parse",
      "--verify",
      `refs/tags/${trusted.sourceTag}^{commit}`,
    ]);
  } catch {
    throw new Error(
      "Upgrade apply requires the external immutable release tag.",
    );
  }
  if (tagCommit !== trusted.sourceCommit)
    throw new Error(
      "Upgrade apply release tag does not match source authority.",
    );

  const transactionRoot = mkdtempSync(
    join(dirname(targetRoot), `.${basename(targetRoot)}-maestro-upgrade-`),
  );
  const stageRoot = join(transactionRoot, "stage");
  const backupRoot = join(transactionRoot, "backup");
  mkdirSync(stageRoot);
  mkdirSync(backupRoot);
  const journal = sealJournal({
    schemaVersion: 1,
    kind: "maestro-upgrade-transaction",
    status: "prepared",
    planFingerprint: trusted.plan.planFingerprint,
    manifestFingerprint: trusted.plan.manifestFingerprint,
    preUpgradeCommit: trusted.plan.targetCommit,
    releaseRoot: trusted.releaseRoot,
    releaseRootCommit: trusted.releaseRootCommit,
    releaseManifestHash: trusted.releaseManifestHash,
    baseManifestHash: trusted.baseManifestHash,
    targetRoot,
    backupRoot,
    promotedPaths: trusted.plan.diff.map(({ path }) => path),
    planInput: trusted.planInput,
  });
  const journalPath = join(transactionRoot, "transaction.json");
  durableJson(journalPath, journal);
  try {
    for (const entry of trusted.plan.diff) {
      if (entry.kind === "delete") continue;
      const bytes = gitBlob(
        trusted.releaseRoot,
        trusted.sourceCommit,
        entry.path,
      );
      if (sha256(bytes) !== entry.afterHash)
        throw new Error(
          `Release source bytes do not match after hash: ${entry.path}`,
        );
      const staged = contained(stageRoot, entry.path);
      ensureParent(staged);
      writeFileSync(staged, bytes);
    }
    for (const entry of trusted.plan.diff) {
      const oldPath = entry.fromPath ?? entry.path;
      const oldTarget = noSymlinkPath(targetRoot, oldPath, {
        allowMissingLeaf: true,
      });
      if (existsSync(oldTarget)) {
        const backup = contained(backupRoot, oldPath);
        ensureParent(backup);
        durableRename(oldTarget, backup);
        input.onMutationBoundary?.("old-to-backup", entry.path);
      }
      if (entry.kind !== "delete") {
        const destination = noSymlinkPath(targetRoot, entry.path, {
          allowMissingLeaf: true,
        });
        ensureParent(destination);
        durableRename(contained(stageRoot, entry.path), destination);
        input.onMutationBoundary?.("stage-to-destination", entry.path);
      }
    }
  } catch (error) {
    rollbackJournal(journal);
    throw error;
  }
  rmSync(stageRoot, { recursive: true, force: true });
  const receipt: UpgradeApplyReceipt = {
    ...sealJournal({ ...unsignedJournal(journal), status: "applied" }),
    status: "applied",
  };
  const receiptPath = join(transactionRoot, "apply-receipt.json");
  durableJson(receiptPath, receipt);
  durableJson(journalPath, receipt);
  return { receiptPath, receipt };
};

const parseRollbackJournal = (candidate: unknown): UpgradeJournal => {
  if (
    !record(candidate) ||
    !onlyKeys(candidate, [
      "schemaVersion",
      "kind",
      "status",
      "planFingerprint",
      "manifestFingerprint",
      "preUpgradeCommit",
      "releaseRoot",
      "releaseRootCommit",
      "releaseManifestHash",
      "baseManifestHash",
      "targetRoot",
      "backupRoot",
      "promotedPaths",
      "planInput",
      "journalDigest",
    ]) ||
    candidate.schemaVersion !== 1 ||
    candidate.kind !== "maestro-upgrade-transaction" ||
    (candidate.status !== "prepared" && candidate.status !== "applied") ||
    !digest(candidate.planFingerprint) ||
    !digest(candidate.manifestFingerprint) ||
    !exactCommit(String(candidate.preUpgradeCommit)) ||
    typeof candidate.releaseRoot !== "string" ||
    !exactCommit(String(candidate.releaseRootCommit)) ||
    !digest(candidate.releaseManifestHash) ||
    !digest(candidate.baseManifestHash) ||
    typeof candidate.targetRoot !== "string" ||
    typeof candidate.backupRoot !== "string" ||
    !Array.isArray(candidate.promotedPaths) ||
    !candidate.promotedPaths.every((path) => typeof path === "string") ||
    !record(candidate.planInput) ||
    !digest(candidate.journalDigest)
  )
    throw new Error("Upgrade recovery journal is invalid.");
  return candidate as UpgradeJournal;
};

const validateRollbackAuthority = (input: {
  readonly journal: UpgradeJournal;
  readonly receiptPath: string;
  readonly targetRoot: string;
  readonly expectedPlanFingerprint: string;
  readonly expectedJournalDigest: string;
}): SuccessfulPlan => {
  const { journal } = input;
  if (
    journal.journalDigest !== input.expectedJournalDigest ||
    recomputeJournalDigest(journal) !== input.expectedJournalDigest
  )
    throw new Error(
      "Upgrade recovery journal digest does not match reviewed evidence.",
    );
  if (journal.planFingerprint !== input.expectedPlanFingerprint)
    throw new Error(
      "Upgrade recovery plan fingerprint does not match reviewed evidence.",
    );

  const targetRoot = canonicalRoot(
    input.targetRoot,
    "Upgrade recovery target root",
  );
  if (input.targetRoot !== targetRoot || journal.targetRoot !== targetRoot)
    throw new Error(
      "Upgrade recovery target root does not match the explicit canonical target.",
    );
  const receiptPath = resolve(input.receiptPath);
  if (input.receiptPath !== receiptPath)
    throw new Error("Upgrade recovery journal path must be canonical.");
  const transactionRoot = dirname(receiptPath);
  if (
    dirname(transactionRoot) !== dirname(targetRoot) ||
    !basename(transactionRoot).startsWith(
      `.${basename(targetRoot)}-maestro-upgrade-`,
    ) ||
    (basename(receiptPath) !== "transaction.json" &&
      basename(receiptPath) !== "apply-receipt.json") ||
    journal.backupRoot !== join(transactionRoot, "backup")
  )
    throw new Error(
      "Upgrade recovery journal is not in the expected target transaction location.",
    );
  noSymlinkPath(dirname(targetRoot), basename(transactionRoot), {
    allowMissingLeaf: false,
  });
  noSymlinkPath(transactionRoot, basename(receiptPath), {
    allowMissingLeaf: false,
  });
  noSymlinkPath(transactionRoot, "backup", { allowMissingLeaf: false });

  const plan = planUpgrade(journal.planInput);
  if (
    !plan.ok ||
    plan.planFingerprint !== journal.planFingerprint ||
    plan.manifestFingerprint !== journal.manifestFingerprint ||
    plan.targetCommit !== journal.preUpgradeCommit ||
    JSON.stringify(plan.diff.map(({ path }) => path)) !==
      JSON.stringify(journal.promotedPaths)
  )
    throw new Error(
      "Upgrade recovery journal does not reproduce the closed reviewed plan.",
    );

  if (
    journal.releaseRoot !==
    canonicalRoot(journal.releaseRoot, "Upgrade recovery release root")
  )
    throw new Error("Upgrade recovery release root is not canonical.");
  const releaseManifestRelative = `releases/v${journal.planInput.manifest.transition.toVersion}/manifest.json`;
  const releaseBytes = gitBlob(
    journal.releaseRoot,
    journal.releaseRootCommit,
    releaseManifestRelative,
  );
  if (sha256(releaseBytes) !== journal.releaseManifestHash)
    throw new Error(
      "Upgrade recovery release manifest hash does not match authority.",
    );
  const release = JSON.parse(releaseBytes.toString("utf8")) as unknown;
  if (
    !record(release) ||
    !record(release.release) ||
    typeof release.release.tag !== "string" ||
    typeof release.release.sourceCommit !== "string" ||
    typeof release.release.sourceChecksum !== "string" ||
    !record(release.baseManifest) ||
    typeof release.baseManifest.path !== "string" ||
    !record(release.upgrade)
  )
    throw new Error("Upgrade recovery release authority is incomplete.");
  const releaseManifestPath = join(
    journal.releaseRoot,
    releaseManifestRelative,
  );
  const baseAbsolute = resolve(
    dirname(releaseManifestPath),
    release.baseManifest.path,
  );
  const baseRelative = relative(journal.releaseRoot, baseAbsolute);
  const baseBytes = gitBlob(
    journal.releaseRoot,
    journal.releaseRootCommit,
    baseRelative,
  );
  if (sha256(baseBytes) !== journal.baseManifestHash)
    throw new Error(
      "Upgrade recovery base manifest hash does not match authority.",
    );
  if (
    sha256(
      gitBytes(journal.releaseRoot, [
        "archive",
        "--format=tar",
        release.release.sourceCommit,
      ]),
    ) !== release.release.sourceChecksum
  )
    throw new Error(
      "Upgrade recovery source archive checksum does not match authority.",
    );
  const authorityPlan = planUpgrade({
    ...journal.planInput,
    manifest: release.upgrade,
  });
  if (
    !authorityPlan.ok ||
    authorityPlan.planFingerprint !== plan.planFingerprint ||
    authorityPlan.manifestFingerprint !== plan.manifestFingerprint
  )
    throw new Error("Upgrade recovery plan does not match release authority.");
  return plan;
};

export const rollbackRepositoryUpgrade = (input: {
  readonly receiptPath: string;
  readonly targetRoot: string;
  readonly expectedPlanFingerprint: string;
  readonly expectedJournalDigest: string;
  readonly write: boolean;
}): string => {
  if (!input.write)
    throw new Error("Upgrade rollback requires explicit --write.");
  const journal = parseRollbackJournal(readJson(input.receiptPath));
  const plan = validateRollbackAuthority({ ...input, journal });
  validateRollbackState(journal, plan);
  rollbackJournal(journal);
  const rollbackPath = join(
    dirname(input.receiptPath),
    "rollback-receipt.json",
  );
  durableJson(rollbackPath, {
    schemaVersion: 1,
    kind: "maestro-upgrade-rollback",
    planFingerprint: journal.planFingerprint,
    restoredCommit: journal.preUpgradeCommit,
    restoredPaths: journal.promotedPaths,
  });
  return rollbackPath;
};

export const verifyRepositoryUpgrade = (input: {
  readonly receiptPath: string;
  readonly targetRoot: string;
  readonly expectedPlanFingerprint: string;
  readonly expectedJournalDigest: string;
}): ReturnType<typeof verifyAppliedUpgrade> => {
  const receipt = parseRollbackJournal(readJson(input.receiptPath));
  if (receipt.status !== "applied") return verifyAppliedUpgrade({});
  validateRollbackAuthority({ ...input, journal: receipt });
  const upgradedCommit = gitText(input.targetRoot, ["rev-parse", "HEAD"]);
  const clean =
    gitText(input.targetRoot, [
      "status",
      "--porcelain",
      "--untracked-files=all",
    ]) === "";
  const plan = planUpgrade(receipt.planInput);
  if (!plan.ok) return verifyAppliedUpgrade({});
  const paths = plan.diff.flatMap((entry) => {
    const values: {
      path: string;
      state: "absent" | "present";
      hash?: string;
    }[] = [];
    if (entry.kind === "move" && entry.fromPath) {
      const from = noSymlinkPath(input.targetRoot, entry.fromPath, {
        allowMissingLeaf: true,
      });
      values.push(
        existsSync(from)
          ? {
              path: entry.fromPath,
              state: "present",
              hash: sha256(readFileSync(from)),
            }
          : { path: entry.fromPath, state: "absent" },
      );
    }
    const absolute = noSymlinkPath(input.targetRoot, entry.path, {
      allowMissingLeaf: true,
    });
    values.push(
      existsSync(absolute)
        ? {
            path: entry.path,
            state: "present",
            hash: sha256(readFileSync(absolute)),
          }
        : { path: entry.path, state: "absent" },
    );
    return values;
  });
  return verifyAppliedUpgrade({
    schemaVersion: 1,
    planInput: receipt.planInput,
    expectedPlanFingerprint: receipt.planFingerprint,
    observed: {
      preUpgradeCommit: receipt.preUpgradeCommit,
      upgradedCommit,
      clean,
      paths,
    },
  });
};
