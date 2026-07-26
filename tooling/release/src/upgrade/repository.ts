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
  renameSync,
  rmSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { projectReviewedUpgradeImpact } from "@maestro-template/app-map-tooling/upgrade-impact";
import type {
  UpgradeManifestV1,
  UpgradePlanInputV1,
  UpgradePlanResult,
} from "./contract.js";
import { planUpgrade } from "./plan.js";
import { verifyAppliedUpgrade } from "./verify.js";

type SuccessfulPlan = Extract<UpgradePlanResult, { readonly ok: true }>;
type UpgradeJournal = {
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

export type TrustedRepositoryUpgradePlan = {
  readonly plan: SuccessfulPlan;
  readonly planInput: UpgradePlanInputV1;
  readonly releaseRoot: string;
  readonly releaseRootCommit: string;
  readonly releaseManifestPath: string;
  readonly releaseManifestHash: string;
  readonly baseManifestPath: string;
  readonly baseManifestHash: string;
  readonly sourceCommit: string;
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
const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8"));

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
  const targetRoot = resolve(input.targetRoot);
  const releaseRoot = resolve(input.releaseRoot);
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
    !record(release.baseManifest) ||
    typeof release.baseManifest.path !== "string" ||
    typeof release.baseManifest.sha256 !== "string" ||
    !record(release.upgrade) ||
    !record(release.upgradeImpact) ||
    typeof release.upgradeImpact.path !== "string" ||
    typeof release.upgradeImpact.sha256 !== "string"
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
  const manifest = release.upgrade as UpgradeManifestV1;
  if (!Array.isArray(manifest.operations) || manifest.operations.length === 0)
    throw new Error("Reviewed release upgrade has no file operations.");
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
  const impact = projectReviewedUpgradeImpact({
    schemaVersion: 1,
    authority: "reviewed-upgrade-plan",
    transitionId: plan.transitionId,
    manifestFingerprint: plan.manifestFingerprint,
    planFingerprint: plan.planFingerprint,
    targetCommit: plan.targetCommit,
    reviewedPaths,
    impactInput: {
      schemaVersion: 1,
      baseRevision: plan.targetCommit,
      mapInput: impactInput,
      changedPaths: reviewedPaths,
    },
  });
  if (!impact.ok) throw new Error(impact.diagnostic.code);
  return {
    plan,
    planInput,
    releaseRoot,
    releaseRootCommit,
    releaseManifestPath,
    releaseManifestHash: sha256(releaseSource),
    baseManifestPath: baseAbsolute,
    baseManifestHash,
    sourceCommit,
    impact: impact.value,
  };
};

const ensureParent = (path: string): void => {
  mkdirSync(dirname(path), { recursive: true });
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
      renameSync(backup, target);
    } else if (operation.kind === "add") {
      rmSync(destination, { recursive: true, force: true });
    }
  }
};

export const applyRepositoryUpgrade = (input: {
  readonly trusted: TrustedRepositoryUpgradePlan;
  readonly targetRoot: string;
  readonly expectedPlanFingerprint: string;
  readonly write: boolean;
}): { readonly receiptPath: string; readonly receipt: UpgradeApplyReceipt } => {
  if (!input.write)
    throw new Error("Upgrade apply-safe requires explicit --write.");
  if (input.expectedPlanFingerprint !== input.trusted.plan.planFingerprint)
    throw new Error("Upgrade plan fingerprint is stale.");
  const targetRoot = resolve(input.targetRoot);
  if (
    gitText(targetRoot, ["rev-parse", "HEAD"]) !==
    input.trusted.plan.targetCommit
  )
    throw new Error("Target HEAD changed after planning.");
  if (
    gitText(targetRoot, ["status", "--porcelain", "--untracked-files=all"]) !==
    ""
  )
    throw new Error("Target became dirty after planning.");
  if (
    gitText(input.trusted.releaseRoot, ["rev-parse", "HEAD"]) !==
      input.trusted.releaseRootCommit ||
    gitText(input.trusted.releaseRoot, [
      "status",
      "--porcelain",
      "--untracked-files=all",
    ]) !== ""
  )
    throw new Error("Release authority checkout changed after planning.");

  const transactionRoot = mkdtempSync(
    join(dirname(targetRoot), `.${basename(targetRoot)}-maestro-upgrade-`),
  );
  const stageRoot = join(transactionRoot, "stage");
  const backupRoot = join(transactionRoot, "backup");
  mkdirSync(stageRoot);
  mkdirSync(backupRoot);
  const journal: UpgradeJournal = {
    schemaVersion: 1,
    kind: "maestro-upgrade-transaction",
    status: "prepared",
    planFingerprint: input.trusted.plan.planFingerprint,
    manifestFingerprint: input.trusted.plan.manifestFingerprint,
    preUpgradeCommit: input.trusted.plan.targetCommit,
    releaseRoot: input.trusted.releaseRoot,
    releaseRootCommit: input.trusted.releaseRootCommit,
    releaseManifestHash: input.trusted.releaseManifestHash,
    baseManifestHash: input.trusted.baseManifestHash,
    targetRoot,
    backupRoot,
    promotedPaths: input.trusted.plan.diff.map(({ path }) => path),
    planInput: input.trusted.planInput,
  };
  const journalPath = join(transactionRoot, "transaction.json");
  durableJson(journalPath, journal);
  try {
    for (const entry of input.trusted.plan.diff) {
      if (entry.kind === "delete") continue;
      const bytes = gitBlob(
        input.trusted.releaseRoot,
        input.trusted.sourceCommit,
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
    for (const entry of input.trusted.plan.diff) {
      const oldPath = entry.fromPath ?? entry.path;
      const oldTarget = noSymlinkPath(targetRoot, oldPath, {
        allowMissingLeaf: true,
      });
      if (existsSync(oldTarget)) {
        const backup = contained(backupRoot, oldPath);
        ensureParent(backup);
        renameSync(oldTarget, backup);
      }
      if (entry.kind !== "delete") {
        const destination = noSymlinkPath(targetRoot, entry.path, {
          allowMissingLeaf: true,
        });
        ensureParent(destination);
        renameSync(contained(stageRoot, entry.path), destination);
      }
    }
  } catch (error) {
    rollbackJournal(journal);
    throw error;
  }
  rmSync(stageRoot, { recursive: true, force: true });
  const receipt: UpgradeApplyReceipt = { ...journal, status: "applied" };
  const receiptPath = join(transactionRoot, "apply-receipt.json");
  durableJson(receiptPath, receipt);
  durableJson(journalPath, receipt);
  return { receiptPath, receipt };
};

export const rollbackRepositoryUpgrade = (receiptPath: string): string => {
  const journal = readJson(receiptPath) as UpgradeJournal;
  if (
    !record(journal) ||
    journal.kind !== "maestro-upgrade-transaction" ||
    (journal.status !== "prepared" && journal.status !== "applied")
  )
    throw new Error("Upgrade recovery journal is invalid.");
  rollbackJournal(journal);
  const rollbackPath = join(dirname(receiptPath), "rollback-receipt.json");
  durableJson(rollbackPath, {
    schemaVersion: 1,
    kind: "maestro-upgrade-rollback",
    planFingerprint: journal.planFingerprint,
    restoredCommit: journal.preUpgradeCommit,
    restoredPaths: journal.promotedPaths,
  });
  return rollbackPath;
};

export const verifyRepositoryUpgrade = (
  receiptPath: string,
): ReturnType<typeof verifyAppliedUpgrade> => {
  const receipt = readJson(receiptPath) as UpgradeApplyReceipt;
  const upgradedCommit = gitText(receipt.targetRoot, ["rev-parse", "HEAD"]);
  const clean =
    gitText(receipt.targetRoot, [
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
      const from = noSymlinkPath(receipt.targetRoot, entry.fromPath, {
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
    const absolute = noSymlinkPath(receipt.targetRoot, entry.path, {
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
