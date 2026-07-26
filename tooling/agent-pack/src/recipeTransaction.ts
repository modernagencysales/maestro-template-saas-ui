import { execFileSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { RepositoryContext } from "./repoContext.js";
import {
  fingerprintRecipePlan,
  sha256RecipeBytes,
  type RecipeExecutionPlan,
  type RecipeTransactionReceipt,
} from "./recipes.js";

type TransactionRequest = {
  readonly repo: RepositoryContext;
  readonly plan: RecipeExecutionPlan;
  readonly preflightFingerprint: string;
  readonly answersSha256: string;
};
type Journal = {
  readonly schemaVersion: 1;
  readonly kind: "maestro-recipe-transaction-journal";
  readonly status: "staging" | "applying" | "rolled-back" | "applied";
  readonly targetRoot: string;
  readonly planFingerprint: string;
  readonly preflightFingerprint: string;
  readonly operations: readonly {
    readonly path: string;
    readonly beforeSha256: string | null;
    readonly contentSha256: string;
  }[];
  readonly createdDirectories: readonly string[];
  readonly completedOperations: number;
  readonly error?: string;
};

export function createNodeRecipeTransaction(options?: {
  readonly failAfterOperation?: number;
}) {
  return {
    apply: async (request: TransactionRequest) =>
      applyRecipeTransaction(request, options),
  };
}

function applyRecipeTransaction(
  request: TransactionRequest,
  options?: { readonly failAfterOperation?: number },
):
  | { readonly ok: true; readonly receipt: RecipeTransactionReceipt }
  | { readonly ok: false; readonly message: string } {
  try {
    const targetRoot = canonicalTargetRoot(request.repo.targetRoot);
    if (targetRoot !== request.plan.targetRoot)
      throw new Error(
        "Recipe plan target root no longer matches the canonical target.",
      );
    const { fingerprint, ...unsigned } = request.plan;
    if (fingerprintRecipePlan(unsigned) !== fingerprint)
      throw new Error(
        "Recipe plan fingerprint does not reproduce the exact plan.",
      );
    const transactionId = fingerprint.replace(/[^a-zA-Z0-9]/gu, "-");
    const transactionRoot = containedPath(
      targetRoot,
      `.maestro/recipe-transactions/${transactionId}`,
    );
    if (existsSync(transactionRoot))
      throw new Error(
        "Recipe transaction already exists; replay and interrupted journals fail closed.",
      );
    const createdDirectories: string[] = [];
    ensureDirectory(
      targetRoot,
      ".maestro/recipe-transactions",
      createdDirectories,
    );
    mkdirSync(transactionRoot);
    createdDirectories.push(relative(targetRoot, transactionRoot));
    const stageRoot = join(transactionRoot, "stage");
    const backupRoot = join(transactionRoot, "backup");
    mkdirSync(stageRoot);
    mkdirSync(backupRoot);
    const journalPath = join(transactionRoot, "transaction.json");
    const receiptPath = join(transactionRoot, "receipt.json");
    for (const operation of request.plan.operations) {
      const target = validateOperationTarget(targetRoot, operation.path);
      const before = existsSync(target)
        ? sha256RecipeBytes(readRegularFile(target))
        : null;
      if (before !== operation.beforeSha256)
        throw new Error(
          `Recipe target drifted after preview: ${operation.path}.`,
        );
      if (sha256RecipeBytes(operation.content) !== operation.contentSha256)
        throw new Error(
          `Recipe operation content hash drifted: ${operation.path}.`,
        );
      const staged = containedPath(stageRoot, operation.path);
      mkdirSync(dirname(staged), { recursive: true });
      durableFile(staged, operation.content);
    }
    let journal: Journal = {
      schemaVersion: 1,
      kind: "maestro-recipe-transaction-journal",
      status: "staging",
      targetRoot,
      planFingerprint: fingerprint,
      preflightFingerprint: request.preflightFingerprint,
      operations: request.plan.operations.map(
        ({ path, beforeSha256, contentSha256 }) => ({
          path,
          beforeSha256,
          contentSha256,
        }),
      ),
      createdDirectories,
      completedOperations: 0,
    };
    durableJson(journalPath, journal);
    journal = { ...journal, status: "applying" };
    durableJson(journalPath, journal);
    try {
      for (const [index, operation] of request.plan.operations.entries()) {
        const target = containedPath(targetRoot, operation.path);
        const backup = containedPath(backupRoot, operation.path);
        let backupMoved = false;
        if (operation.beforeSha256 !== null) {
          mkdirSync(dirname(backup), { recursive: true });
          renameSync(target, backup);
          backupMoved = true;
          fsyncDirectory(dirname(target));
          fsyncDirectory(dirname(backup));
        }
        ensureOperationParent(targetRoot, dirname(target), createdDirectories);
        const staged = containedPath(stageRoot, operation.path);
        try {
          renameSync(staged, target);
        } catch (error) {
          if (backupMoved) renameSync(backup, target);
          throw error;
        }
        fsyncDirectory(dirname(target));
        journal = {
          ...journal,
          createdDirectories,
          completedOperations: index + 1,
        };
        durableJson(journalPath, journal);
        if (options?.failAfterOperation === index + 1)
          throw new Error(
            `Injected recipe transaction failure after operation ${index + 1}.`,
          );
      }
    } catch (error) {
      rollbackApplied(
        targetRoot,
        backupRoot,
        request.plan,
        journal.completedOperations,
      );
      cleanupCreatedDirectories(
        targetRoot,
        createdDirectories,
        transactionRoot,
      );
      journal = {
        ...journal,
        status: "rolled-back",
        error: message(error),
      };
      durableJson(journalPath, journal);
      return {
        ok: false,
        message: `Recipe transaction rolled back: ${message(error)} Journal: ${relative(targetRoot, journalPath)}.`,
      };
    }
    journal = { ...journal, status: "applied" };
    durableJson(journalPath, journal);
    const receipt: RecipeTransactionReceipt = {
      schemaVersion: 1,
      kind: "maestro-recipe-transaction",
      status: "applied",
      recipeId: request.plan.recipeId,
      recipeSchemaVersion: request.plan.recipeSchemaVersion,
      planFingerprint: fingerprint,
      preflightFingerprint: request.preflightFingerprint,
      answersSha256: request.answersSha256,
      generatorVersions: request.plan.steps.map(
        ({ generatorVersion }) => generatorVersion,
      ),
      operationPaths: request.plan.operations.map(({ path }) => path),
      provenancePaths: request.plan.provenancePaths,
      candidateCommit: gitHead(targetRoot),
      templateInstanceFingerprint: templateInstanceFingerprint(targetRoot),
      journalPath: relative(targetRoot, journalPath),
      receiptPath: relative(targetRoot, receiptPath),
    };
    durableJson(receiptPath, receipt);
    return { ok: true, receipt };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}

function rollbackApplied(
  targetRoot: string,
  backupRoot: string,
  plan: RecipeExecutionPlan,
  completed: number,
): void {
  for (const operation of [...plan.operations.slice(0, completed)].reverse()) {
    const target = containedPath(targetRoot, operation.path);
    if (operation.beforeSha256 === null) rmSync(target, { force: true });
    else {
      const backup = containedPath(backupRoot, operation.path);
      if (!existsSync(backup))
        throw new Error(
          `Recipe rollback backup is missing: ${operation.path}.`,
        );
      renameSync(backup, target);
      fsyncDirectory(dirname(target));
    }
  }
}

function canonicalTargetRoot(root: string): string {
  const resolved = resolve(root);
  const canonical = realpathSync(resolved);
  if (canonical !== resolved || !statSync(canonical).isDirectory())
    throw new Error(
      "Recipe target root must be an existing canonical directory.",
    );
  return canonical;
}
function validateOperationTarget(root: string, path: string): string {
  const target = containedPath(root, path);
  let current = root;
  for (const part of path.split("/")) {
    current = join(current, part);
    if (!existsSync(current)) continue;
    const stats = lstatSync(current);
    if (stats.isSymbolicLink())
      throw new Error(`Recipe path crosses a symlink: ${path}.`);
    if (current !== target && !stats.isDirectory())
      throw new Error(`Recipe path parent is not a directory: ${path}.`);
    if (current === target && !stats.isFile())
      throw new Error(`Recipe target is not a regular file: ${path}.`);
  }
  return target;
}
function containedPath(root: string, path: string): string {
  if (
    isAbsolute(path) ||
    path
      .split(/[\\/]/u)
      .some((part) => part === "" || part === "." || part === "..")
  )
    throw new Error(`Recipe path is not safe and relative: ${path}.`);
  const target = resolve(root, path);
  const rel = relative(root, target);
  if (rel.startsWith("..") || isAbsolute(rel))
    throw new Error(`Recipe path escapes the target: ${path}.`);
  return target;
}
function ensureDirectory(
  root: string,
  relativePath: string,
  created: string[],
): void {
  ensureOperationParent(root, containedPath(root, relativePath), created);
}
function ensureOperationParent(
  root: string,
  directory: string,
  created: string[],
): void {
  const rel = relative(root, directory);
  let current = root;
  for (const part of rel.split(/[\\/]/u).filter(Boolean)) {
    current = join(current, part);
    if (existsSync(current)) {
      const stats = lstatSync(current);
      if (!stats.isDirectory() || stats.isSymbolicLink())
        throw new Error(
          `Recipe parent path is unsafe: ${relative(root, current)}.`,
        );
    } else {
      mkdirSync(current);
      created.push(relative(root, current));
    }
  }
}
function cleanupCreatedDirectories(
  root: string,
  created: readonly string[],
  retainedRoot: string,
): void {
  for (const path of [...created].reverse()) {
    const absolute = containedPath(root, path);
    if (absolute === retainedRoot || retainedRoot.startsWith(`${absolute}/`))
      continue;
    try {
      rmSync(absolute, { recursive: false });
    } catch {
      // A nonempty directory contains pre-existing or retained evidence.
    }
  }
}
function durableFile(path: string, content: string): void {
  writeFileSync(path, content, { flag: "wx" });
  fsyncFile(path);
  fsyncDirectory(dirname(path));
}
function durableJson(path: string, value: unknown): void {
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    flag: "w",
  });
  fsyncFile(temporary);
  renameSync(temporary, path);
  fsyncDirectory(dirname(path));
}
function fsyncFile(path: string): void {
  const fd = openSync(path, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
function fsyncDirectory(path: string): void {
  const fd = openSync(path, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
function readRegularFile(path: string): Buffer {
  const stats = lstatSync(path);
  if (!stats.isFile() || stats.isSymbolicLink())
    throw new Error(`Recipe target is not a regular file: ${path}.`);
  return readFileSync(path);
}
function gitHead(root: string): string | null {
  try {
    const value = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return /^[0-9a-f]{40}$/u.test(value) ? value : null;
  } catch {
    return null;
  }
}
function templateInstanceFingerprint(root: string): string | null {
  const path = join(root, "template-instance.json");
  return existsSync(path) ? sha256RecipeBytes(readRegularFile(path)) : null;
}
const message = (error: unknown): string =>
  error instanceof Error ? error.message : "unknown recipe transaction failure";
