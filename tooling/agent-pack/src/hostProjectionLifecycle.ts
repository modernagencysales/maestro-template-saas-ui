import { createHash, randomUUID } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import type { HostName } from "./hostInstall.js";
import { isDirectTemporaryPath } from "./temporaryPath.js";

const OFFICIAL_SKILLS = [
  "convex",
  "convex-create-component",
  "convex-migration-helper",
  "convex-performance-audit",
  "convex-quickstart",
  "convex-setup-auth",
] as const;

export type HostProjectionReceiptV1 = {
  readonly schemaVersion: 1;
  readonly host: HostName;
  readonly homeDir: string;
  readonly version: string;
  readonly transactionId: string;
  readonly sourceChecksum: string;
  readonly files: readonly {
    readonly path: string;
    readonly sourceSha256: string;
    readonly installedSha256: string;
  }[];
  readonly rollbackRoot?: string;
};

type Planned = {
  readonly source: string;
  readonly target: string;
  readonly sourceSha256: string;
};

type JournalUnsigned = {
  readonly schemaVersion: 1;
  readonly status: "ACTIVE" | "CLOSED";
  readonly closure: "committed" | "recovered" | null;
  readonly kind: "install" | "rollback";
  readonly host: HostName;
  readonly homeDir: string;
  readonly transactionId: string;
  readonly transactionRoot: string;
  readonly backupRoot: string;
  readonly currentReceiptDigest: string | null;
  readonly previous?: HostProjectionReceiptV1;
  readonly plannedFiles: readonly {
    readonly path: string;
    readonly sha256: string | null;
    readonly beforeSha256: string | null;
  }[];
};
type Journal = JournalUnsigned & { readonly journalDigest: string };

export async function installVersionedHostProjection(input: {
  readonly host: HostName;
  readonly repoRoot: string;
  readonly homeDir: string;
  readonly version: string;
  readonly modifiedManagedFileResolution?: "backup-and-replace";
  readonly testFailAfterMutations?: number;
  readonly testLeaveInterrupted?: boolean;
}): Promise<HostProjectionReceiptV1> {
  await assertDisposableHome(input.homeDir, input.host);
  await recoverInterruptedHostProjection(input);
  if (!/^[0-9A-Za-z][0-9A-Za-z._-]*$/u.test(input.version))
    throw new Error("host projection version is invalid");
  const planned = await plan(input);
  const sourceChecksum = digest(
    Buffer.from(
      JSON.stringify(
        planned.map(({ target, sourceSha256 }) => ({
          path: relative(resolve(input.homeDir), target),
          sourceSha256,
        })),
      ),
    ),
  );
  const receiptPath = statePath(input.homeDir, input.host, "receipt.json");
  const previous = await readReceipt(receiptPath);
  if (
    previous &&
    (previous.host !== input.host ||
      previous.homeDir !== resolve(input.homeDir))
  )
    throw new Error("host projection receipt authority mismatch");
  for (const file of previous?.files ?? [])
    await assertManagedSkillTarget(input.homeDir, input.host, file.path);
  if (
    previous?.version === input.version &&
    previous.sourceChecksum === sourceChecksum &&
    (await allReceiptFilesMatch(previous))
  )
    return previous;
  if (
    previous?.version === input.version &&
    previous.sourceChecksum !== sourceChecksum
  )
    throw new Error("host projection version is immutable but source changed");
  const previousOwned = new Map(
    previous?.files.map((file) => [resolve(file.path), file]) ?? [],
  );
  for (const item of planned) {
    await assertManagedSkillTarget(input.homeDir, input.host, item.target);
    const bytes = await optionalRead(item.target);
    const owned = previousOwned.get(resolve(item.target));
    if (
      bytes !== undefined &&
      digest(bytes) !== item.sourceSha256 &&
      (!owned || digest(bytes) !== owned.installedSha256)
    ) {
      if (owned && input.modifiedManagedFileResolution === "backup-and-replace")
        continue;
      throw new Error(
        `managed or unmanaged host target differs: ${item.target}`,
      );
    }
  }
  for (const file of previous?.files ?? []) {
    await assertManagedSkillTarget(input.homeDir, input.host, file.path);
    const bytes = await optionalRead(file.path);
    if (
      bytes !== undefined &&
      digest(bytes) !== file.installedSha256 &&
      input.modifiedManagedFileResolution !== "backup-and-replace"
    )
      throw new Error(`managed host file was modified: ${file.path}`);
  }
  const transactionId = randomUUID();
  const transactionRoot = statePath(
    input.homeDir,
    input.host,
    join("transactions", transactionId),
  );
  const stageRoot = join(transactionRoot, "stage");
  const backupRoot = join(transactionRoot, "backup");
  await mkdir(stageRoot, { recursive: true });
  await mkdir(backupRoot, { recursive: true });
  for (const item of planned) {
    const staged = join(
      stageRoot,
      relative(resolve(input.homeDir), item.target),
    );
    await mkdir(dirname(staged), { recursive: true });
    await copyFile(item.source, staged);
  }
  for (const file of previous?.files ?? []) {
    const expectedPath = statePath(
      input.homeDir,
      input.host,
      join("current", relative(resolve(input.homeDir), file.path)),
    );
    const bytes = await readRegularFile(expectedPath);
    if (digest(bytes) !== file.installedSha256)
      throw new Error("stored prior projection checksum mismatch");
    const backup = join(
      backupRoot,
      relative(resolve(input.homeDir), file.path),
    );
    await mkdir(dirname(backup), { recursive: true });
    await writeFile(backup, bytes);
    const installed = await optionalRead(file.path);
    if (
      installed !== undefined &&
      digest(installed) !== file.installedSha256 &&
      input.modifiedManagedFileResolution === "backup-and-replace"
    ) {
      const preserved = join(
        transactionRoot,
        "user-preserved",
        relative(resolve(input.homeDir), file.path),
      );
      await mkdir(dirname(preserved), { recursive: true });
      await writeFile(preserved, installed);
    }
  }
  if (previous)
    await writeJson(join(transactionRoot, "previous.json"), previous);
  const journal = sealJournal({
    schemaVersion: 1,
    status: "ACTIVE",
    closure: null,
    kind: "install",
    host: input.host,
    homeDir: resolve(input.homeDir),
    transactionId,
    transactionRoot,
    backupRoot,
    currentReceiptDigest: previous ? receiptDigest(previous) : null,
    ...(previous ? { previous } : {}),
    plannedFiles: await Promise.all(
      [
        ...new Set([
          ...planned.map(({ target }) => target),
          ...(previous?.files.map(({ path }) => path) ?? []),
        ]),
      ].map(async (path) => ({
        path,
        sha256:
          planned.find(({ target }) => resolve(target) === resolve(path))
            ?.sourceSha256 ?? null,
        beforeSha256: await optionalDigest(path),
      })),
    ),
  });
  const journalPath = statePath(input.homeDir, input.host, "journal.json");
  await writeJson(journalPath, journal);
  let mutations = 0;
  try {
    for (const file of previous?.files ?? []) {
      if (
        !planned.some(({ target }) => resolve(target) === resolve(file.path))
      ) {
        await rm(file.path, { force: true });
        mutations += 1;
      }
    }
    for (const item of planned) {
      await mkdir(dirname(item.target), { recursive: true });
      await rm(item.target, { force: true });
      await rename(
        join(stageRoot, relative(resolve(input.homeDir), item.target)),
        item.target,
      );
      mutations += 1;
      if (
        input.testFailAfterMutations !== undefined &&
        mutations >= input.testFailAfterMutations
      )
        throw new Error("injected host projection failure");
    }
  } catch (error) {
    if (!input.testLeaveInterrupted)
      await recoverInterruptedHostProjection(input);
    throw error;
  }
  const receipt: HostProjectionReceiptV1 = {
    schemaVersion: 1,
    host: input.host,
    homeDir: resolve(input.homeDir),
    version: input.version,
    transactionId,
    sourceChecksum,
    files: planned.map((item) => ({
      path: item.target,
      sourceSha256: item.sourceSha256,
      installedSha256: item.sourceSha256,
    })),
    ...(previous ? { rollbackRoot: transactionRoot } : {}),
  };
  await writeJson(receiptPath, receipt);
  await replaceCurrentStore(receipt);
  await rm(stageRoot, { recursive: true, force: true });
  await closeJournal(journalPath, journal, "committed", receipt);
  return receipt;
}

export async function rollbackHostProjection(
  receipt: HostProjectionReceiptV1,
  options?: {
    readonly testFailAfterMutations?: number;
    readonly testLeaveInterrupted?: boolean;
  },
): Promise<HostProjectionReceiptV1> {
  await assertDisposableHome(receipt.homeDir, receipt.host);
  await recoverInterruptedHostProjection(receipt);
  const receiptPath = statePath(receipt.homeDir, receipt.host, "receipt.json");
  const current = await readReceipt(receiptPath);
  if (!current || receiptDigest(current) !== receiptDigest(receipt))
    throw new Error("rollback receipt does not match persisted authority");
  if (!receipt.rollbackRoot)
    throw new Error("host projection has no prior version to roll back");
  const transactionsRoot = statePath(
    receipt.homeDir,
    receipt.host,
    "transactions",
  );
  const rollbackRelative = relative(
    resolve(transactionsRoot),
    resolve(receipt.rollbackRoot),
  );
  if (
    rollbackRelative === "" ||
    rollbackRelative === ".." ||
    rollbackRelative.startsWith("../")
  )
    throw new Error("host projection rollback root escapes transaction state");
  await assertSafeTarget(
    receipt.homeDir,
    join(receipt.rollbackRoot, "previous.json"),
  );
  for (const file of receipt.files)
    await assertManagedSkillTarget(receipt.homeDir, receipt.host, file.path);
  if (!(await allReceiptFilesMatch(receipt)))
    throw new Error("current host projection was modified; rollback refused");
  const previous = await readReceipt(
    join(receipt.rollbackRoot, "previous.json"),
  );
  if (!previous) throw new Error("prior host projection receipt is missing");
  if (
    previous.host !== receipt.host ||
    previous.homeDir !== resolve(receipt.homeDir)
  )
    throw new Error("prior host projection receipt authority mismatch");
  for (const file of previous.files)
    await assertManagedSkillTarget(receipt.homeDir, receipt.host, file.path);
  const priorBackupRoot = join(receipt.rollbackRoot, "backup");
  const priorBytes = new Map<string, Buffer>();
  for (const file of previous.files) {
    const backup = join(
      priorBackupRoot,
      relative(resolve(receipt.homeDir), file.path),
    );
    const bytes = await readRegularFile(backup);
    if (digest(bytes) !== file.installedSha256)
      throw new Error("prior host projection backup checksum mismatch");
    priorBytes.set(file.path, bytes);
  }
  const transactionId = randomUUID();
  const transactionRoot = statePath(
    receipt.homeDir,
    receipt.host,
    join("transactions", transactionId),
  );
  const stageRoot = join(transactionRoot, "stage");
  const backupRoot = join(transactionRoot, "backup");
  await mkdir(stageRoot, { recursive: true });
  await mkdir(backupRoot, { recursive: true });
  for (const file of current.files) {
    const bytes = await readRegularFile(file.path);
    if (digest(bytes) !== file.installedSha256)
      throw new Error("current host projection checksum mismatch");
    const backup = join(
      backupRoot,
      relative(resolve(receipt.homeDir), file.path),
    );
    await mkdir(dirname(backup), { recursive: true });
    await writeFile(backup, bytes);
  }
  for (const file of previous.files) {
    const staged = join(
      stageRoot,
      relative(resolve(receipt.homeDir), file.path),
    );
    await mkdir(dirname(staged), { recursive: true });
    await writeFile(staged, priorBytes.get(file.path) as Buffer);
  }
  const journal = sealJournal({
    schemaVersion: 1,
    status: "ACTIVE",
    closure: null,
    kind: "rollback",
    host: receipt.host,
    homeDir: resolve(receipt.homeDir),
    transactionId,
    transactionRoot,
    backupRoot,
    currentReceiptDigest: receiptDigest(current),
    previous: current,
    plannedFiles: await Promise.all(
      [
        ...new Set(
          [...current.files, ...previous.files].map(({ path }) => path),
        ),
      ].map(async (path) => ({
        path,
        sha256:
          previous.files.find((file) => resolve(file.path) === resolve(path))
            ?.installedSha256 ?? null,
        beforeSha256: await optionalDigest(path),
      })),
    ),
  });
  const journalPath = statePath(receipt.homeDir, receipt.host, "journal.json");
  await writeJson(journalPath, journal);
  let mutations = 0;
  try {
    for (const file of current.files) {
      await rm(file.path, { force: true });
      mutations += 1;
      if (
        options?.testFailAfterMutations !== undefined &&
        mutations >= options.testFailAfterMutations
      )
        throw new Error("injected host rollback failure");
    }
    for (const file of previous.files) {
      await mkdir(dirname(file.path), { recursive: true });
      await rename(
        join(stageRoot, relative(resolve(receipt.homeDir), file.path)),
        file.path,
      );
      mutations += 1;
      if (
        options?.testFailAfterMutations !== undefined &&
        mutations >= options.testFailAfterMutations
      )
        throw new Error("injected host rollback failure");
    }
  } catch (error) {
    if (!options?.testLeaveInterrupted)
      await recoverInterruptedHostProjection(receipt);
    throw error;
  }
  await writeJson(receiptPath, previous);
  await replaceCurrentStore(previous);
  await rm(stageRoot, { recursive: true, force: true });
  await closeJournal(journalPath, journal, "committed", previous);
  return previous;
}

export async function removeVersionedHostProjection(
  receipt: HostProjectionReceiptV1,
): Promise<{
  readonly removed: readonly string[];
  readonly preserved: readonly string[];
}> {
  await assertDisposableHome(receipt.homeDir, receipt.host);
  const receiptPath = statePath(receipt.homeDir, receipt.host, "receipt.json");
  const persisted = await readReceipt(receiptPath);
  if (!persisted || receiptDigest(persisted) !== receiptDigest(receipt))
    throw new Error("remove receipt does not match persisted authority");
  for (const file of receipt.files)
    await assertManagedSkillTarget(receipt.homeDir, receipt.host, file.path);
  await recoverInterruptedHostProjection(receipt);
  const authoritative = await readReceipt(receiptPath);
  if (!authoritative || receiptDigest(authoritative) !== receiptDigest(receipt))
    throw new Error("remove receipt does not match persisted authority");
  const removed: string[] = [];
  const preserved: string[] = [];
  for (const file of authoritative.files) {
    await assertManagedSkillTarget(receipt.homeDir, receipt.host, file.path);
    const bytes = await optionalRead(file.path);
    if (bytes === undefined || digest(bytes) === file.installedSha256) {
      await rm(file.path, { force: true });
      removed.push(file.path);
    } else preserved.push(file.path);
  }
  if (preserved.length === 0) {
    await rm(receiptPath, { force: true });
    await rm(statePath(receipt.homeDir, receipt.host, "current"), {
      recursive: true,
      force: true,
    });
    const journalPath = statePath(
      receipt.homeDir,
      receipt.host,
      "journal.json",
    );
    const journal = await readJournal(journalPath);
    if (journal)
      await closeJournal(journalPath, journal, "committed", undefined);
  }
  return { removed: removed.sort(), preserved: preserved.sort() };
}

export async function recoverInterruptedHostProjection(input: {
  readonly host: HostName;
  readonly homeDir: string;
}): Promise<void> {
  await assertDisposableHome(input.homeDir, input.host);
  const journalPath = statePath(input.homeDir, input.host, "journal.json");
  await assertSafeTarget(input.homeDir, journalPath);
  const journal = await readJournal(journalPath);
  if (!journal) return;
  assertJournalAuthority(journal, input);
  const transactionsRoot = statePath(input.homeDir, input.host, "transactions");
  const expectedTransactionRoot = join(transactionsRoot, journal.transactionId);
  if (
    resolve(journal.transactionRoot) !== resolve(expectedTransactionRoot) ||
    resolve(journal.backupRoot) !== resolve(expectedTransactionRoot, "backup")
  )
    throw new Error("host projection journal transaction path mismatch");
  const backupRelative = relative(
    resolve(transactionsRoot),
    resolve(journal.backupRoot),
  );
  if (
    backupRelative === "" ||
    backupRelative === ".." ||
    backupRelative.startsWith("../")
  )
    throw new Error("host projection journal backup escapes transaction state");
  await assertSymlinkFreePath(
    input.homeDir,
    journal.transactionRoot,
    "directory",
  );
  await assertSymlinkFreePath(input.homeDir, journal.backupRoot, "directory");
  const receiptPath = statePath(input.homeDir, input.host, "receipt.json");
  const authoritative = await readReceipt(receiptPath);
  if (journal.status === "CLOSED") {
    await validateClosedJournal(journal, authoritative);
    return;
  }
  if (
    journal.currentReceiptDigest !==
    (journal.previous ? receiptDigest(journal.previous) : null)
  )
    throw new Error("host projection journal receipt binding mismatch");

  await prevalidateActiveRecovery(journal, authoritative);
  if (
    authoritative &&
    (!journal.previous ||
      receiptDigest(authoritative) !== receiptDigest(journal.previous))
  ) {
    await replaceCurrentStore(authoritative);
    await closeJournal(journalPath, journal, "recovered", authoritative);
    return;
  }
  for (const file of journal.plannedFiles) {
    await rm(file.path, { force: true });
  }
  if (journal.previous) {
    for (const file of journal.previous.files) {
      const backup = join(
        journal.backupRoot,
        relative(resolve(input.homeDir), file.path),
      );
      const bytes = await readRegularFile(backup);
      await mkdir(dirname(file.path), { recursive: true });
      await writeFile(file.path, bytes);
    }
    await writeJson(receiptPath, journal.previous);
    await replaceCurrentStore(journal.previous);
  } else {
    await rm(receiptPath, { force: true });
  }
  await closeJournal(journalPath, journal, "recovered", journal.previous);
}

function assertJournalAuthority(
  journal: Journal,
  input: { readonly host: HostName; readonly homeDir: string },
): void {
  if (journal.host !== input.host || journal.homeDir !== resolve(input.homeDir))
    throw new Error("host projection journal authority mismatch");
}

async function prevalidateActiveRecovery(
  journal: Journal,
  authoritative: HostProjectionReceiptV1 | undefined,
): Promise<void> {
  const previousDigest = journal.previous
    ? receiptDigest(journal.previous)
    : undefined;
  if (journal.previous) {
    if (!authoritative)
      throw new Error("host projection journal receipt binding mismatch");
  } else if (authoritative?.transactionId !== journal.transactionId) {
    if (authoritative)
      throw new Error("clean-install journal conflicts with persisted receipt");
  }
  if (
    authoritative &&
    receiptDigest(authoritative) !== previousDigest &&
    authoritative.transactionId !== journal.transactionId
  )
    throw new Error("committed host projection receipt transaction mismatch");

  for (const file of journal.plannedFiles) {
    await assertManagedSkillTarget(journal.homeDir, journal.host, file.path);
    const actual = await optionalDigest(file.path);
    if (
      actual !== null &&
      actual !== file.beforeSha256 &&
      actual !== file.sha256
    )
      throw new Error("host projection recovery target checksum mismatch");
    const staged = join(
      journal.transactionRoot,
      "stage",
      relative(resolve(journal.homeDir), file.path),
    );
    await assertSymlinkFreePath(journal.homeDir, staged);
    const stagedDigest = await optionalDigest(staged);
    if (stagedDigest !== null && stagedDigest !== file.sha256)
      throw new Error("host projection recovery stage checksum mismatch");
  }
  if (journal.previous) {
    await validateProjectionStore(journal.previous);
    for (const file of journal.previous.files) {
      const backup = join(
        journal.backupRoot,
        relative(resolve(journal.homeDir), file.path),
      );
      await assertSymlinkFreePath(journal.homeDir, backup, "file");
      const bytes = await readRegularFile(backup);
      if (digest(bytes) !== file.installedSha256)
        throw new Error("host projection recovery backup checksum mismatch");
    }
  }
  if (authoritative && receiptDigest(authoritative) !== previousDigest) {
    for (const file of authoritative.files)
      await assertManagedSkillTarget(journal.homeDir, journal.host, file.path);
    if (!(await allReceiptFilesMatch(authoritative)))
      throw new Error("committed host projection receipt does not match files");
  }
}

async function validateClosedJournal(
  journal: Journal,
  authoritative: HostProjectionReceiptV1 | undefined,
): Promise<void> {
  const actualDigest = authoritative ? receiptDigest(authoritative) : null;
  if (journal.closure === null || journal.currentReceiptDigest !== actualDigest)
    throw new Error("closed host projection journal receipt binding mismatch");
  if (authoritative) {
    if (
      authoritative.host !== journal.host ||
      authoritative.homeDir !== journal.homeDir
    )
      throw new Error("closed host projection journal authority mismatch");
  }
}

async function closeJournal(
  path: string,
  journal: Journal,
  closure: "committed" | "recovered",
  receipt: HostProjectionReceiptV1 | undefined,
): Promise<void> {
  const { journalDigest: _discardedDigest, ...unsigned } = journal;
  void _discardedDigest;
  await writeJson(
    path,
    sealJournal({
      ...unsigned,
      status: "CLOSED",
      closure,
      currentReceiptDigest: receipt ? receiptDigest(receipt) : null,
    }),
  );
}

async function plan(input: {
  readonly host: HostName;
  readonly repoRoot: string;
  readonly homeDir: string;
}): Promise<readonly Planned[]> {
  const skillRoot =
    input.host === "claude-code"
      ? join(input.homeDir, ".claude/skills")
      : join(input.homeDir, ".codex/skills");
  const sources = [
    ...OFFICIAL_SKILLS.map((name) => ({
      name,
      root: join(input.repoRoot, "agent-pack/official-convex/skills", name),
    })),
    {
      name: "maestro",
      root: join(input.repoRoot, "agent-pack/skills/maestro"),
    },
    {
      name: "maestro-convex",
      root: join(
        input.repoRoot,
        "agent-pack/plugins/maestro-convex/skills/maestro-convex",
      ),
    },
  ];
  const planned: Planned[] = [];
  for (const source of sources) {
    for (const path of await regularFilesUnder(source.root)) {
      const bytes = await readRegularFile(path);
      planned.push({
        source: path,
        target: join(skillRoot, source.name, relative(source.root, path)),
        sourceSha256: digest(bytes),
      });
    }
  }
  return planned.sort((left, right) => left.target.localeCompare(right.target));
}

async function assertDisposableHome(
  homeDir: string,
  host: HostName,
): Promise<void> {
  const resolved = resolve(homeDir);
  const token = host === "claude-code" ? "claude" : "codex";
  if (
    !basename(resolved).startsWith(`maestro-${token}-`) ||
    !(await isDirectTemporaryPath(resolved))
  )
    throw new Error(
      "host lifecycle requires a direct disposable temporary home",
    );
}

async function assertSafeTarget(
  homeDir: string,
  target: string,
): Promise<void> {
  const home = resolve(homeDir);
  const rel = relative(home, resolve(target));
  if (rel === "" || rel === ".." || rel.startsWith("../"))
    throw new Error("host projection target escapes disposable home");
  let current = home;
  for (const part of rel.split(/[\\/]/u)) {
    current = join(current, part);
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink())
        throw new Error("host projection traverses symlink");
      if (current === resolve(target) && !entry.isFile())
        throw new Error("host projection target is not a regular file");
    } catch (error) {
      if (code(error) === "ENOENT") return;
      throw error;
    }
  }
}
async function assertSymlinkFreePath(
  homeDir: string,
  target: string,
  expected?: "file" | "directory",
): Promise<void> {
  const home = resolve(homeDir);
  const targetPath = resolve(target);
  const rel = relative(home, targetPath);
  if (rel === "" || rel === ".." || rel.startsWith("../"))
    throw new Error("host projection target escapes disposable home");
  let current = home;
  for (const part of rel.split(/[\\/]/u)) {
    current = join(current, part);
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink())
        throw new Error(`host projection traverses symlink: ${current}`);
      if (current === targetPath && expected === "file" && !entry.isFile())
        throw new Error("host projection target is not a regular file");
      if (
        current === targetPath &&
        expected === "directory" &&
        !entry.isDirectory()
      )
        throw new Error("host projection target is not a directory");
    } catch (error) {
      if (code(error) === "ENOENT") return;
      throw error;
    }
  }
}

function managedSkillRoot(homeDir: string, host: HostName): string {
  return join(
    homeDir,
    host === "claude-code" ? ".claude/skills" : ".codex/skills",
  );
}

async function assertManagedSkillTarget(
  homeDir: string,
  host: HostName,
  target: string,
): Promise<void> {
  const root = resolve(managedSkillRoot(homeDir, host));
  const rel = relative(root, resolve(target));
  if (rel === "" || rel === ".." || rel.startsWith("../"))
    throw new Error("host projection target is outside managed skill root");
  await assertSafeTarget(homeDir, target);
}

async function regularFilesUnder(root: string): Promise<readonly string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error("host source contains symlink");
    if (entry.isDirectory()) files.push(...(await regularFilesUnder(path)));
    else if (entry.isFile()) files.push(path);
    else throw new Error("host source contains non-regular entry");
  }
  return files;
}

async function readRegularFile(path: string): Promise<Buffer> {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink())
    throw new Error("host projection file is not regular");
  return readFile(path);
}

async function allReceiptFilesMatch(
  receipt: HostProjectionReceiptV1,
): Promise<boolean> {
  for (const file of receipt.files) {
    const bytes = await optionalRead(file.path);
    if (bytes === undefined || digest(bytes) !== file.installedSha256)
      return false;
  }
  return true;
}
async function optionalDigest(path: string): Promise<string | null> {
  const bytes = await optionalRead(path);
  return bytes === undefined ? null : digest(bytes);
}
async function validateProjectionStore(
  receipt: HostProjectionReceiptV1,
): Promise<void> {
  for (const file of receipt.files) {
    const path = statePath(
      receipt.homeDir,
      receipt.host,
      join("current", relative(resolve(receipt.homeDir), file.path)),
    );
    await assertSymlinkFreePath(receipt.homeDir, path, "file");
    const bytes = await readRegularFile(path);
    if (digest(bytes) !== file.installedSha256)
      throw new Error("stored host projection checksum mismatch");
  }
}

async function replaceCurrentStore(
  receipt: HostProjectionReceiptV1,
): Promise<void> {
  const currentRoot = statePath(receipt.homeDir, receipt.host, "current");
  await rm(currentRoot, { recursive: true, force: true });
  for (const file of receipt.files) {
    const bytes = await readRegularFile(file.path);
    if (digest(bytes) !== file.installedSha256)
      throw new Error("installed projection checksum mismatch");
    const target = join(
      currentRoot,
      relative(resolve(receipt.homeDir), file.path),
    );
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
}

function statePath(homeDir: string, host: HostName, child: string): string {
  return join(
    homeDir,
    host === "claude-code" ? ".claude" : ".codex",
    ".maestro-projection",
    child,
  );
}

async function readReceipt(
  path: string,
): Promise<HostProjectionReceiptV1 | undefined> {
  const candidate = await readJson<unknown>(path);
  if (candidate === undefined) return undefined;
  return parseReceipt(candidate);
}

function parseReceipt(candidate: unknown): HostProjectionReceiptV1 {
  if (
    !isRecord(candidate) ||
    !onlyKeys(candidate, [
      "schemaVersion",
      "host",
      "homeDir",
      "version",
      "transactionId",
      "sourceChecksum",
      "files",
      "rollbackRoot",
    ]) ||
    candidate.schemaVersion !== 1 ||
    (candidate.host !== "claude-code" && candidate.host !== "codex") ||
    typeof candidate.homeDir !== "string" ||
    typeof candidate.version !== "string" ||
    !transactionIdentifier(candidate.transactionId) ||
    !checksum(candidate.sourceChecksum) ||
    !Array.isArray(candidate.files) ||
    (candidate.rollbackRoot !== undefined &&
      typeof candidate.rollbackRoot !== "string")
  )
    throw new Error("host projection receipt is invalid");
  const files = candidate.files.map((file) => {
    if (
      !isRecord(file) ||
      !onlyKeys(file, ["path", "sourceSha256", "installedSha256"]) ||
      typeof file.path !== "string" ||
      !checksum(file.sourceSha256) ||
      !checksum(file.installedSha256)
    )
      throw new Error("host projection receipt file is invalid");
    return {
      path: file.path,
      sourceSha256: file.sourceSha256,
      installedSha256: file.installedSha256,
    };
  });
  return {
    schemaVersion: 1,
    host: candidate.host,
    homeDir: candidate.homeDir,
    version: candidate.version,
    transactionId: candidate.transactionId,
    sourceChecksum: candidate.sourceChecksum,
    files,
    ...(candidate.rollbackRoot ? { rollbackRoot: candidate.rollbackRoot } : {}),
  };
}

async function readJournal(path: string): Promise<Journal | undefined> {
  const candidate = await readJson<unknown>(path);
  if (candidate === undefined) return undefined;
  if (
    !isRecord(candidate) ||
    !onlyKeys(candidate, [
      "schemaVersion",
      "status",
      "closure",
      "kind",
      "host",
      "homeDir",
      "transactionId",
      "transactionRoot",
      "backupRoot",
      "currentReceiptDigest",
      "previous",
      "plannedFiles",
      "journalDigest",
    ]) ||
    candidate.schemaVersion !== 1 ||
    (candidate.status !== "ACTIVE" && candidate.status !== "CLOSED") ||
    (candidate.closure !== null &&
      candidate.closure !== "committed" &&
      candidate.closure !== "recovered") ||
    (candidate.status === "ACTIVE" && candidate.closure !== null) ||
    (candidate.status === "CLOSED" && candidate.closure === null) ||
    (candidate.kind !== "install" && candidate.kind !== "rollback") ||
    (candidate.host !== "claude-code" && candidate.host !== "codex") ||
    typeof candidate.homeDir !== "string" ||
    !transactionIdentifier(candidate.transactionId) ||
    typeof candidate.transactionRoot !== "string" ||
    typeof candidate.backupRoot !== "string" ||
    (candidate.currentReceiptDigest !== null &&
      !checksum(candidate.currentReceiptDigest)) ||
    !Array.isArray(candidate.plannedFiles) ||
    !candidate.plannedFiles.every(
      (file) =>
        isRecord(file) &&
        onlyKeys(file, ["path", "sha256", "beforeSha256"]) &&
        typeof file.path === "string" &&
        (file.sha256 === null || checksum(file.sha256)) &&
        (file.beforeSha256 === null || checksum(file.beforeSha256)),
    ) ||
    !checksum(candidate.journalDigest)
  )
    throw new Error("host projection journal is invalid");
  const previous =
    candidate.previous === undefined
      ? undefined
      : parseReceipt(candidate.previous);
  const unsigned: JournalUnsigned = {
    schemaVersion: 1,
    status: candidate.status,
    closure: candidate.closure,
    kind: candidate.kind,
    host: candidate.host,
    homeDir: candidate.homeDir,
    transactionId: candidate.transactionId,
    transactionRoot: candidate.transactionRoot,
    backupRoot: candidate.backupRoot,
    currentReceiptDigest: candidate.currentReceiptDigest,
    ...(previous ? { previous } : {}),
    plannedFiles: (
      candidate.plannedFiles as Array<Record<string, unknown>>
    ).map((file) => ({
      path: file.path as string,
      sha256: file.sha256 as string | null,
      beforeSha256: file.beforeSha256 as string | null,
    })),
  };
  if (digestJson(unsigned) !== candidate.journalDigest)
    throw new Error("host projection journal digest mismatch");
  return { ...unsigned, journalDigest: candidate.journalDigest };
}

async function readJson<T>(path: string): Promise<T | undefined> {
  const bytes = await optionalRead(path);
  if (bytes === undefined) return undefined;
  return JSON.parse(bytes.toString("utf8")) as T;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temporary, path);
}

async function optionalRead(path: string): Promise<Buffer | undefined> {
  try {
    const info = await stat(path);
    if (!info.isFile())
      throw new Error("host projection path is not a regular file");
    return readFile(path);
  } catch (error) {
    if (code(error) === "ENOENT") return undefined;
    throw error;
  }
}

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonical(entry)]),
  );
}

function digestJson(value: unknown): string {
  return digest(Buffer.from(JSON.stringify(canonical(value))));
}

function receiptDigest(receipt: HostProjectionReceiptV1): string {
  return digestJson(receipt);
}

function sealJournal(journal: JournalUnsigned): Journal {
  return { ...journal, journalDigest: digestJson(journal) };
}

function checksum(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}

function transactionIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
      value,
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function onlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function code(error: unknown): unknown {
  return error && typeof error === "object"
    ? (error as NodeJS.ErrnoException).code
    : undefined;
}
