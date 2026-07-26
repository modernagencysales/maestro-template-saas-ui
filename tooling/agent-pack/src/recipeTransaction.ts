import { execFileSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import type { Stats } from "node:fs";
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
type OperationState =
  | "staged"
  | "backup-pending"
  | "backed-up"
  | "install-pending"
  | "installed"
  | "rolled-back";
type JournalOperation = {
  readonly path: string;
  readonly targetPath: string;
  readonly stagePath: string;
  readonly backupPath: string;
  readonly beforeSha256: string | null;
  readonly contentSha256: string;
  readonly state: OperationState;
};
type UnsignedJournal = {
  readonly schemaVersion: 1;
  readonly kind: "maestro-recipe-transaction-journal";
  readonly status:
    "staging" | "applying" | "rolling-back" | "rolled-back" | "applied";
  readonly targetRoot: string;
  readonly transactionRoot: string;
  readonly recipeId: string;
  readonly recipeSchemaVersion: number;
  readonly planFingerprint: string;
  readonly preflightFingerprint: string;
  readonly answersSha256: string;
  readonly operations: readonly JournalOperation[];
  readonly allowedCleanupDirectories: readonly string[];
  readonly missingPreimageDirectories: readonly string[];
  readonly actualCreatedDirectories: readonly string[];
  readonly pendingCleanupDirectory: string | null;
  readonly error?: string;
};
type Journal = UnsignedJournal & { readonly journalDigest: string };
type CrashPoint =
  | "after-backup-rename-before-journal"
  | "after-install-rename-before-journal"
  | "after-installed-journal";
type TransactionOptions = {
  readonly failAfterOperation?: number;
  readonly crashAt?: CrashPoint;
  readonly crashAtOperation?: number;
};
type RecoveryResult =
  | { readonly ok: true; readonly recoveredAttempts: number }
  | { readonly ok: false; readonly message: string };

class SimulatedProcessCrash extends Error {}

export function createNodeRecipeTransaction(options?: TransactionOptions) {
  return {
    apply: async (request: TransactionRequest) =>
      applyRecipeTransaction(request, options),
    recover: async (request: TransactionRequest) =>
      recoverRecipeTransaction(request),
  };
}

export function recoverRecipeTransaction(
  request: TransactionRequest,
): RecoveryResult {
  try {
    const authority = validateAuthority(request);
    const planRoot = planTransactionRoot(
      authority.targetRoot,
      authority.fingerprint,
    );
    if (!existsSync(planRoot)) return { ok: true, recoveredAttempts: 0 };
    assertDirectory(planRoot, "Recipe transaction plan root");
    const attempts = readdirSync(planRoot, { withFileTypes: true })
      .filter(
        (entry) => entry.isDirectory() && /^attempt-\d{4,}$/u.test(entry.name),
      )
      .map(({ name }) => name)
      .sort();
    const unexpected = readdirSync(planRoot, { withFileTypes: true }).filter(
      (entry) => !(entry.isDirectory() && /^attempt-\d{4,}$/u.test(entry.name)),
    );
    if (unexpected.length > 0)
      throw new Error(
        `Recipe transaction evidence contains an unexpected entry: ${unexpected[0]?.name ?? "unknown"}.`,
      );
    let recoveredAttempts = 0;
    for (const attempt of attempts) {
      const transactionRoot = containedPath(planRoot, attempt);
      const journalPath = join(transactionRoot, "transaction.json");
      let journal = readAuthenticatedJournal(journalPath);
      validateJournalAuthority(journal, request, authority, transactionRoot);
      if (
        (journal.status === "applied" || journal.status === "rolled-back") &&
        journal.pendingCleanupDirectory !== null
      )
        throw new Error(
          "Recipe transaction journal closure retains cleanup intent.",
        );
      if (journal.pendingCleanupDirectory !== null)
        journal = reconcilePendingCleanup(journalPath, journal);
      if (journal.status === "applied") {
        assertExactOutputs(journal);
        throw new Error(
          "Recipe transaction replay rejected: this exact reviewed plan was already applied.",
        );
      }
      if (journal.status === "rolled-back") {
        if (journal.operations.some(({ state }) => state !== "rolled-back"))
          throw new Error(
            "Recipe transaction journal has an invalid rolled-back closure.",
          );
        assertExactPreimages(journal);
        continue;
      }
      rollbackJournal(journalPath, journal);
      recoveredAttempts += 1;
    }
    return { ok: true, recoveredAttempts };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}

function applyRecipeTransaction(
  request: TransactionRequest,
  options?: TransactionOptions,
):
  | { readonly ok: true; readonly receipt: RecipeTransactionReceipt }
  | { readonly ok: false; readonly message: string } {
  try {
    const authority = validateAuthority(request);
    const recovery = recoverRecipeTransaction(request);
    if (!recovery.ok) throw new Error(recovery.message);
    validatePlannedOperations(authority.targetRoot, request.plan);
    const planRoot = planTransactionRoot(
      authority.targetRoot,
      authority.fingerprint,
    );
    const filesystemCreatedDirectories: string[] = [];
    ensureDirectory(
      authority.targetRoot,
      ".maestro/recipe-transactions",
      filesystemCreatedDirectories,
    );
    if (!existsSync(planRoot)) {
      mkdirSync(planRoot);
      fsyncDirectory(dirname(planRoot));
      filesystemCreatedDirectories.push(
        relative(authority.targetRoot, planRoot),
      );
    } else assertDirectory(planRoot, "Recipe transaction plan root");
    const attemptNumber = nextAttemptNumber(planRoot);
    const transactionRoot = containedPath(
      planRoot,
      `attempt-${String(attemptNumber).padStart(4, "0")}`,
    );
    mkdirSync(transactionRoot);
    fsyncDirectory(planRoot);
    filesystemCreatedDirectories.push(
      relative(authority.targetRoot, transactionRoot),
    );
    const stageRoot = join(transactionRoot, "stage");
    const backupRoot = join(transactionRoot, "backup");
    mkdirSync(stageRoot);
    mkdirSync(backupRoot);
    fsyncDirectory(transactionRoot);
    const journalPath = join(transactionRoot, "transaction.json");
    const receiptPath = join(transactionRoot, "receipt.json");
    const allowedCleanupDirectories = canonicalCleanupDirectories(
      request.plan.operations,
    );
    const missingPreimageDirectories = prepareCleanupDirectoryWitnesses(
      authority.targetRoot,
      transactionRoot,
      allowedCleanupDirectories,
    );
    const operations: JournalOperation[] = [];
    for (const operation of request.plan.operations) {
      const target = validateOperationTarget(
        authority.targetRoot,
        operation.path,
      );
      const staged = containedPath(stageRoot, operation.path);
      const backup = containedPath(backupRoot, operation.path);
      mkdirSync(dirname(staged), { recursive: true });
      durableFile(staged, operation.content);
      operations.push({
        path: operation.path,
        targetPath: relative(authority.targetRoot, target),
        stagePath: relative(authority.targetRoot, staged),
        backupPath: relative(authority.targetRoot, backup),
        beforeSha256: operation.beforeSha256,
        contentSha256: operation.contentSha256,
        state: "staged",
      });
    }
    let journal = signJournal({
      schemaVersion: 1,
      kind: "maestro-recipe-transaction-journal",
      status: "staging",
      targetRoot: authority.targetRoot,
      transactionRoot,
      recipeId: request.plan.recipeId,
      recipeSchemaVersion: request.plan.recipeSchemaVersion,
      planFingerprint: authority.fingerprint,
      preflightFingerprint: request.preflightFingerprint,
      answersSha256: request.answersSha256,
      operations,
      allowedCleanupDirectories,
      missingPreimageDirectories,
      actualCreatedDirectories: [],
      pendingCleanupDirectory: null,
    });
    durableJson(journalPath, journal);
    journal = transition(journalPath, journal, { status: "applying" });
    try {
      for (const [index, operation] of request.plan.operations.entries()) {
        const journalOperation = journal.operations[index];
        if (!journalOperation)
          throw new Error("Recipe journal operation is missing.");
        const target = containedPath(
          authority.targetRoot,
          journalOperation.targetPath,
        );
        const backup = containedPath(
          authority.targetRoot,
          journalOperation.backupPath,
        );
        const staged = containedPath(
          authority.targetRoot,
          journalOperation.stagePath,
        );
        if (operation.beforeSha256 !== null) {
          mkdirSync(dirname(backup), { recursive: true });
          journal = transitionOperation(
            journalPath,
            journal,
            index,
            "backup-pending",
          );
          renameSync(target, backup);
          fsyncDirectory(dirname(target));
          fsyncDirectory(dirname(backup));
          crash(options, "after-backup-rename-before-journal", index + 1);
          journal = transitionOperation(
            journalPath,
            journal,
            index,
            "backed-up",
          );
        }
        journal = ensureOperationParentJournaled(
          authority.targetRoot,
          dirname(target),
          journalPath,
          journal,
        );
        journal = transitionOperation(
          journalPath,
          journal,
          index,
          "install-pending",
        );
        renameSync(staged, target);
        fsyncDirectory(dirname(staged));
        fsyncDirectory(dirname(target));
        crash(options, "after-install-rename-before-journal", index + 1);
        journal = transitionOperation(journalPath, journal, index, "installed");
        crash(options, "after-installed-journal", index + 1);
        if (options?.failAfterOperation === index + 1)
          throw new Error(
            `Injected recipe transaction failure after operation ${index + 1}.`,
          );
      }
    } catch (error) {
      if (error instanceof SimulatedProcessCrash) throw error;
      rollbackJournal(journalPath, journal, message(error));
      return {
        ok: false,
        message: `Recipe transaction rolled back: ${message(error)} Journal: ${relative(authority.targetRoot, journalPath)}.`,
      };
    }
    journal = transition(journalPath, journal, { status: "applied" });
    const receipt: RecipeTransactionReceipt = {
      schemaVersion: 1,
      kind: "maestro-recipe-transaction",
      status: "applied",
      recipeId: request.plan.recipeId,
      recipeSchemaVersion: request.plan.recipeSchemaVersion,
      planFingerprint: authority.fingerprint,
      preflightFingerprint: request.preflightFingerprint,
      answersSha256: request.answersSha256,
      generatorVersions: request.plan.steps.map(
        ({ generatorVersion }) => generatorVersion,
      ),
      operationPaths: request.plan.operations.map(({ path }) => path),
      provenancePaths: request.plan.provenancePaths,
      candidateCommit: gitHead(authority.targetRoot),
      templateInstanceFingerprint: templateInstanceFingerprint(
        authority.targetRoot,
      ),
      journalPath: relative(authority.targetRoot, journalPath),
      receiptPath: relative(authority.targetRoot, receiptPath),
    };
    durableJson(receiptPath, receipt);
    return { ok: true, receipt };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}

function validatePlannedOperations(
  targetRoot: string,
  plan: RecipeExecutionPlan,
): void {
  for (const operation of plan.operations) {
    const target = validateOperationTarget(targetRoot, operation.path);
    if (hashIfRegularFile(target) !== operation.beforeSha256)
      throw new Error(
        `Recipe target drifted after preview: ${operation.path}.`,
      );
    if (sha256RecipeBytes(operation.content) !== operation.contentSha256)
      throw new Error(
        `Recipe operation content hash drifted: ${operation.path}.`,
      );
  }
}

function rollbackJournal(
  journalPath: string,
  original: Journal,
  error?: string,
): void {
  let journal = transition(journalPath, original, {
    status: "rolling-back",
    ...(error === undefined ? {} : { error }),
  });
  for (let index = journal.operations.length - 1; index >= 0; index -= 1) {
    const operation = journal.operations[index];
    if (!operation) continue;
    restoreOperation(journal, operation);
    journal = transitionOperation(journalPath, journal, index, "rolled-back");
  }
  assertExactPreimages(journal);
  cleanupCreatedDirectories(
    journal.targetRoot,
    journal.actualCreatedDirectories,
    journal.transactionRoot,
  );
  transition(journalPath, journal, { status: "rolled-back" });
}

function restoreOperation(journal: Journal, operation: JournalOperation): void {
  const target = containedPath(journal.targetRoot, operation.targetPath);
  const staged = containedPath(journal.targetRoot, operation.stagePath);
  const backup = containedPath(journal.targetRoot, operation.backupPath);
  const targetHash = hashIfRegularFile(target);
  const stageHash = hashIfRegularFile(staged);
  const backupHash = hashIfRegularFile(backup);
  if (stageHash !== null && stageHash !== operation.contentSha256)
    throw new Error(
      `Recipe recovery staged file was tampered: ${operation.path}.`,
    );
  if (operation.beforeSha256 === null) {
    if (backupHash !== null)
      throw new Error(
        `Recipe recovery found an impossible backup: ${operation.path}.`,
      );
    if (targetHash === operation.contentSha256) {
      rmSync(target);
      fsyncDirectory(dirname(target));
      return;
    }
    if (targetHash === null) return;
    throw new Error(`Recipe recovery target was tampered: ${operation.path}.`);
  }
  const before = operation.beforeSha256;
  if (targetHash === before && backupHash === null) return;
  if (backupHash === before && targetHash === operation.contentSha256) {
    rmSync(target);
    fsyncDirectory(dirname(target));
    renameSync(backup, target);
    fsyncDirectory(dirname(backup));
    fsyncDirectory(dirname(target));
    return;
  }
  if (backupHash === before && targetHash === null) {
    renameSync(backup, target);
    fsyncDirectory(dirname(backup));
    fsyncDirectory(dirname(target));
    return;
  }
  if (targetHash === operation.contentSha256 && backupHash === null)
    throw new Error(
      `Recipe recovery cannot restore a missing backup: ${operation.path}.`,
    );
  throw new Error(
    `Recipe recovery cannot mechanically prove the preimage: ${operation.path}.`,
  );
}

function assertExactPreimages(journal: Journal): void {
  for (const operation of journal.operations) {
    const target = containedPath(journal.targetRoot, operation.targetPath);
    const staged = containedPath(journal.targetRoot, operation.stagePath);
    const backup = containedPath(journal.targetRoot, operation.backupPath);
    const actual = hashIfRegularFile(target);
    if (actual !== operation.beforeSha256)
      throw new Error(
        `Recipe recovery preimage does not match: ${operation.path}.`,
      );
    if (hashIfRegularFile(backup) !== null)
      throw new Error(
        `Recipe recovery retained an unexpected backup: ${operation.path}.`,
      );
    const stageHash = hashIfRegularFile(staged);
    if (stageHash !== null && stageHash !== operation.contentSha256)
      throw new Error(
        `Recipe recovery staged file was tampered: ${operation.path}.`,
      );
  }
}

function assertExactOutputs(journal: Journal): void {
  if (journal.operations.some(({ state }) => state !== "installed"))
    throw new Error(
      "Recipe transaction journal has an invalid applied closure.",
    );
  for (const operation of journal.operations) {
    const target = containedPath(journal.targetRoot, operation.targetPath);
    const staged = containedPath(journal.targetRoot, operation.stagePath);
    const backup = containedPath(journal.targetRoot, operation.backupPath);
    if (hashIfRegularFile(target) !== operation.contentSha256)
      throw new Error(
        `Applied recipe transaction target does not match: ${operation.path}.`,
      );
    if (hashIfRegularFile(staged) !== null)
      throw new Error(
        `Applied recipe transaction retained staged output: ${operation.path}.`,
      );
    if (hashIfRegularFile(backup) !== operation.beforeSha256)
      throw new Error(
        `Applied recipe transaction backup does not match: ${operation.path}.`,
      );
  }
}

function validateAuthority(request: TransactionRequest): {
  targetRoot: string;
  fingerprint: string;
} {
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
  return { targetRoot, fingerprint };
}

function validateJournalAuthority(
  journal: Journal,
  request: TransactionRequest,
  authority: { targetRoot: string; fingerprint: string },
  transactionRoot: string,
): void {
  if (
    journal.targetRoot !== authority.targetRoot ||
    journal.transactionRoot !== transactionRoot ||
    journal.recipeId !== request.plan.recipeId ||
    journal.recipeSchemaVersion !== request.plan.recipeSchemaVersion ||
    journal.planFingerprint !== authority.fingerprint ||
    journal.preflightFingerprint !== request.preflightFingerprint ||
    journal.answersSha256 !== request.answersSha256
  )
    throw new Error(
      "Recipe transaction journal does not match the exact reviewed authority.",
    );
  if (journal.operations.length !== request.plan.operations.length)
    throw new Error(
      "Recipe transaction journal operation count does not match.",
    );
  const stageRoot = join(transactionRoot, "stage");
  const backupRoot = join(transactionRoot, "backup");
  for (const [index, planned] of request.plan.operations.entries()) {
    const actual = journal.operations[index];
    if (
      !actual ||
      actual.path !== planned.path ||
      actual.targetPath !== planned.path ||
      actual.stagePath !==
        relative(
          authority.targetRoot,
          containedPath(stageRoot, planned.path),
        ) ||
      actual.backupPath !==
        relative(
          authority.targetRoot,
          containedPath(backupRoot, planned.path),
        ) ||
      actual.beforeSha256 !== planned.beforeSha256 ||
      actual.contentSha256 !== planned.contentSha256
    )
      throw new Error(
        `Recipe transaction journal operation does not match: ${planned.path}.`,
      );
    validateOperationTarget(authority.targetRoot, actual.targetPath);
    validateOperationTarget(authority.targetRoot, actual.stagePath);
    validateOperationTarget(authority.targetRoot, actual.backupPath);
  }
  const expectedAllowedDirectories = canonicalCleanupDirectories(
    request.plan.operations,
  );
  if (
    JSON.stringify(journal.allowedCleanupDirectories) !==
    JSON.stringify(expectedAllowedDirectories)
  )
    throw new Error(
      "Recipe transaction journal cleanup allowlist does not match the reviewed plan.",
    );
  const missingPreimages = readCleanupDirectoryWitnesses(
    transactionRoot,
    expectedAllowedDirectories,
    "missing-preimage-witnesses",
  );
  if (
    JSON.stringify(journal.missingPreimageDirectories) !==
    JSON.stringify(missingPreimages)
  )
    throw new Error(
      "Recipe transaction journal missing-preimage authority does not match attempt evidence.",
    );
  const claimed = new Set(journal.actualCreatedDirectories);
  const canonicalClaim = missingPreimages.filter((path) => claimed.has(path));
  if (
    claimed.size !== journal.actualCreatedDirectories.length ||
    JSON.stringify(journal.actualCreatedDirectories) !==
      JSON.stringify(canonicalClaim)
  )
    throw new Error(
      "Recipe transaction journal cleanup directory authority is not a canonical reviewed subset.",
    );
  if (
    journal.pendingCleanupDirectory !== null &&
    (!missingPreimages.includes(journal.pendingCleanupDirectory) ||
      claimed.has(journal.pendingCleanupDirectory))
  )
    throw new Error(
      "Recipe transaction journal pending cleanup authority is invalid.",
    );
  const actuallyWitnessed = readCleanupDirectoryWitnesses(
    transactionRoot,
    missingPreimages,
    "actual-created-witnesses",
  );
  const journalOrPending = missingPreimages.filter(
    (path) => claimed.has(path) || journal.pendingCleanupDirectory === path,
  );
  if (
    JSON.stringify(actuallyWitnessed) !==
      JSON.stringify(journal.actualCreatedDirectories) &&
    JSON.stringify(actuallyWitnessed) !== JSON.stringify(journalOrPending)
  )
    throw new Error(
      "Recipe transaction journal cleanup directory authority does not match attempt evidence.",
    );
  for (const path of journal.actualCreatedDirectories)
    validateDirectoryPath(authority.targetRoot, path);
}

function readAuthenticatedJournal(path: string): Journal {
  const raw = readRegularFile(path).toString("utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Recipe transaction journal is not valid JSON.");
  }
  if (!isJournal(parsed))
    throw new Error("Recipe transaction journal schema is invalid.");
  const { journalDigest, ...unsigned } = parsed;
  if (journalDigest !== journalDigestFor(unsigned))
    throw new Error("Recipe transaction journal authentication failed.");
  return parsed;
}

function isJournal(value: unknown): value is Journal {
  if (typeof value !== "object" || value === null) return false;
  const journal = value as Partial<Journal>;
  return (
    journal.schemaVersion === 1 &&
    journal.kind === "maestro-recipe-transaction-journal" &&
    ["staging", "applying", "rolling-back", "rolled-back", "applied"].includes(
      journal.status ?? "",
    ) &&
    typeof journal.targetRoot === "string" &&
    typeof journal.transactionRoot === "string" &&
    typeof journal.recipeId === "string" &&
    typeof journal.recipeSchemaVersion === "number" &&
    typeof journal.planFingerprint === "string" &&
    typeof journal.preflightFingerprint === "string" &&
    typeof journal.answersSha256 === "string" &&
    Array.isArray(journal.operations) &&
    journal.operations.every(
      (operation) =>
        typeof operation === "object" &&
        operation !== null &&
        typeof operation.path === "string" &&
        typeof operation.targetPath === "string" &&
        typeof operation.stagePath === "string" &&
        typeof operation.backupPath === "string" &&
        (operation.beforeSha256 === null ||
          typeof operation.beforeSha256 === "string") &&
        typeof operation.contentSha256 === "string" &&
        [
          "staged",
          "backup-pending",
          "backed-up",
          "install-pending",
          "installed",
          "rolled-back",
        ].includes(operation.state),
    ) &&
    Array.isArray(journal.missingPreimageDirectories) &&
    journal.missingPreimageDirectories.every(
      (path) => typeof path === "string",
    ) &&
    Array.isArray(journal.actualCreatedDirectories) &&
    journal.actualCreatedDirectories.every(
      (path) => typeof path === "string",
    ) &&
    (journal.pendingCleanupDirectory === null ||
      typeof journal.pendingCleanupDirectory === "string") &&
    Array.isArray(journal.allowedCleanupDirectories) &&
    journal.allowedCleanupDirectories.every(
      (path) => typeof path === "string",
    ) &&
    typeof journal.journalDigest === "string"
  );
}

function signJournal(unsigned: UnsignedJournal): Journal {
  return { ...unsigned, journalDigest: journalDigestFor(unsigned) };
}
function journalDigestFor(unsigned: UnsignedJournal): string {
  return sha256RecipeBytes(JSON.stringify(unsigned));
}
function transition(
  path: string,
  journal: Journal,
  change: Partial<Pick<UnsignedJournal, "status" | "error">>,
): Journal {
  const unsigned = unsignedJournal(journal);
  const next = signJournal({ ...unsigned, ...change });
  durableJson(path, next);
  return next;
}
function transitionOperation(
  path: string,
  journal: Journal,
  index: number,
  state: OperationState,
): Journal {
  const operations = journal.operations.map((operation, operationIndex) =>
    operationIndex === index ? { ...operation, state } : operation,
  );
  const unsigned = unsignedJournal(journal);
  const next = signJournal({ ...unsigned, operations });
  durableJson(path, next);
  return next;
}

function transitionCleanup(
  path: string,
  journal: Journal,
  actualCreatedDirectories: readonly string[],
  pendingCleanupDirectory: string | null,
): Journal {
  const unsigned = unsignedJournal(journal);
  const next = signJournal({
    ...unsigned,
    actualCreatedDirectories,
    pendingCleanupDirectory,
  });
  durableJson(path, next);
  return next;
}

function reconcilePendingCleanup(path: string, journal: Journal): Journal {
  const witnessed = readCleanupDirectoryWitnesses(
    journal.transactionRoot,
    journal.missingPreimageDirectories,
    "actual-created-witnesses",
  );
  return transitionCleanup(path, journal, witnessed, null);
}

function canonicalCleanupDirectories(
  operations: readonly { readonly path: string }[],
): readonly string[] {
  const directories = new Set<string>();
  for (const operation of operations) {
    const parts = operation.path.split(/[\\/]/u);
    for (let length = 1; length < parts.length; length += 1)
      directories.add(parts.slice(0, length).join("/"));
  }
  return [...directories].sort((left, right) => {
    const depth = left.split("/").length - right.split("/").length;
    return depth === 0 ? left.localeCompare(right) : depth;
  });
}

function prepareCleanupDirectoryWitnesses(
  targetRoot: string,
  transactionRoot: string,
  allowedDirectories: readonly string[],
): readonly string[] {
  const witnessRoot = join(transactionRoot, "missing-preimage-witnesses");
  mkdirSync(witnessRoot);
  mkdirSync(join(transactionRoot, "actual-created-witnesses"));
  fsyncDirectory(transactionRoot);
  const created: string[] = [];
  for (const path of allowedDirectories) {
    const target = containedPath(targetRoot, path);
    const stats = lstatIfExists(target);
    if (stats !== null) {
      validateDirectoryPath(targetRoot, path);
      continue;
    }
    durableFile(
      join(witnessRoot, `${sha256RecipeBytes(path)}.json`),
      `${JSON.stringify({ path })}\n`,
    );
    created.push(path);
  }
  return created;
}

function readCleanupDirectoryWitnesses(
  transactionRoot: string,
  allowedDirectories: readonly string[],
  witnessDirectory: "missing-preimage-witnesses" | "actual-created-witnesses",
): readonly string[] {
  const witnessRoot = join(transactionRoot, witnessDirectory);
  assertDirectory(witnessRoot, "Recipe cleanup witness root");
  const witnessed = new Set<string>();
  for (const entry of readdirSync(witnessRoot, { withFileTypes: true })) {
    if (!entry.isFile() || entry.isSymbolicLink())
      throw new Error("Recipe cleanup witness is not a regular file.");
    const witnessPath = join(witnessRoot, entry.name);
    let parsed: unknown;
    try {
      parsed = JSON.parse(readRegularFile(witnessPath).toString("utf8"));
    } catch {
      throw new Error("Recipe cleanup witness is invalid.");
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Object.keys(parsed).length !== 1 ||
      !("path" in parsed) ||
      typeof parsed.path !== "string" ||
      entry.name !== `${sha256RecipeBytes(parsed.path)}.json` ||
      !allowedDirectories.includes(parsed.path) ||
      witnessed.has(parsed.path)
    )
      throw new Error("Recipe cleanup witness authority is invalid.");
    witnessed.add(parsed.path);
  }
  return allowedDirectories.filter((path) => witnessed.has(path));
}

function unsignedJournal(journal: Journal): UnsignedJournal {
  return {
    schemaVersion: journal.schemaVersion,
    kind: journal.kind,
    status: journal.status,
    targetRoot: journal.targetRoot,
    transactionRoot: journal.transactionRoot,
    recipeId: journal.recipeId,
    recipeSchemaVersion: journal.recipeSchemaVersion,
    planFingerprint: journal.planFingerprint,
    preflightFingerprint: journal.preflightFingerprint,
    answersSha256: journal.answersSha256,
    operations: journal.operations,
    allowedCleanupDirectories: journal.allowedCleanupDirectories,
    missingPreimageDirectories: journal.missingPreimageDirectories,
    actualCreatedDirectories: journal.actualCreatedDirectories,
    pendingCleanupDirectory: journal.pendingCleanupDirectory,
    ...(journal.error === undefined ? {} : { error: journal.error }),
  };
}

function crash(
  options: TransactionOptions | undefined,
  point: CrashPoint,
  operation: number,
): void {
  if (
    options?.crashAt === point &&
    (options.crashAtOperation ?? 1) === operation
  )
    throw new SimulatedProcessCrash(`Injected process crash: ${point}.`);
}
function planTransactionRoot(targetRoot: string, fingerprint: string): string {
  const transactionId = fingerprint.replace(/[^a-zA-Z0-9]/gu, "-");
  return containedPath(
    targetRoot,
    `.maestro/recipe-transactions/${transactionId}`,
  );
}
function nextAttemptNumber(planRoot: string): number {
  const numbers = readdirSync(planRoot, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && /^attempt-\d{4,}$/u.test(entry.name),
    )
    .map(({ name }) => Number(name.slice("attempt-".length)));
  return numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
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
    const stats = lstatIfExists(current);
    if (stats === null) continue;
    if (stats.isSymbolicLink())
      throw new Error(`Recipe path crosses a symlink: ${path}.`);
    if (current !== target && !stats.isDirectory())
      throw new Error(`Recipe path parent is not a directory: ${path}.`);
    if (current === target && !stats.isFile())
      throw new Error(`Recipe target is not a regular file: ${path}.`);
  }
  return target;
}
function validateDirectoryPath(root: string, path: string): string {
  const target = containedPath(root, path);
  let current = root;
  for (const part of path.split("/")) {
    current = join(current, part);
    const stats = lstatIfExists(current);
    if (stats === null) continue;
    if (stats.isSymbolicLink() || !stats.isDirectory())
      throw new Error(`Recipe journal directory path is unsafe: ${path}.`);
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
      fsyncDirectory(dirname(current));
      created.push(relative(root, current));
    }
  }
}
function ensureOperationParentJournaled(
  root: string,
  directory: string,
  journalPath: string,
  initial: Journal,
): Journal {
  const rel = relative(root, directory);
  let current = root;
  let journal = initial;
  for (const part of rel.split(/[\\/]/u).filter(Boolean)) {
    current = join(current, part);
    const relativeDirectory = relative(root, current).split(/[\\/]/u).join("/");
    const stats = lstatIfExists(current);
    if (stats !== null) {
      if (!stats.isDirectory() || stats.isSymbolicLink())
        throw new Error(`Recipe parent path is unsafe: ${relativeDirectory}.`);
      continue;
    }
    if (!journal.missingPreimageDirectories.includes(relativeDirectory))
      throw new Error(
        `Recipe directory creation lacks missing-preimage authority: ${relativeDirectory}.`,
      );
    journal = transitionCleanup(
      journalPath,
      journal,
      journal.actualCreatedDirectories,
      relativeDirectory,
    );
    mkdirSync(current);
    fsyncDirectory(dirname(current));
    fsyncDirectory(current);
    durableFile(
      join(
        journal.transactionRoot,
        "actual-created-witnesses",
        `${sha256RecipeBytes(relativeDirectory)}.json`,
      ),
      `${JSON.stringify({ path: relativeDirectory })}\n`,
    );
    const created = new Set([
      ...journal.actualCreatedDirectories,
      relativeDirectory,
    ]);
    journal = transitionCleanup(
      journalPath,
      journal,
      journal.missingPreimageDirectories.filter((path) => created.has(path)),
      null,
    );
  }
  return journal;
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
      rmdirSync(absolute);
      fsyncDirectory(dirname(absolute));
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
function assertDirectory(path: string, label: string): void {
  const stats = lstatSync(path);
  if (!stats.isDirectory() || stats.isSymbolicLink())
    throw new Error(`${label} is not a real directory.`);
}
function hashIfRegularFile(path: string): string | null {
  if (lstatIfExists(path) === null) return null;
  return sha256RecipeBytes(readRegularFile(path));
}
function lstatIfExists(path: string): Stats | null {
  try {
    return lstatSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
function readRegularFile(path: string): Buffer {
  const stats = lstatSync(path);
  if (!stats.isFile() || stats.isSymbolicLink())
    throw new Error(`Recipe path is not a regular file: ${path}.`);
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
