import { createHash, randomUUID } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { HostName } from "./hostInstall.js";

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

type Journal = {
  readonly schemaVersion: 1;
  readonly host: HostName;
  readonly homeDir: string;
  readonly backupRoot: string;
  readonly previous?: HostProjectionReceiptV1;
  readonly plannedPaths: readonly string[];
};

export async function installVersionedHostProjection(input: {
  readonly host: HostName;
  readonly repoRoot: string;
  readonly homeDir: string;
  readonly version: string;
  readonly modifiedManagedFileResolution?: "backup-and-replace";
  readonly testFailAfterMutations?: number;
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
    previous?.version === input.version &&
    previous.sourceChecksum === sourceChecksum &&
    (await allReceiptFilesMatch(previous))
  )
    return previous;
  const previousOwned = new Map(
    previous?.files.map((file) => [resolve(file.path), file]) ?? [],
  );
  for (const item of planned) {
    await assertSafeTarget(input.homeDir, item.target);
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
    await assertSafeTarget(input.homeDir, file.path);
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
  const journal: Journal = {
    schemaVersion: 1,
    host: input.host,
    homeDir: resolve(input.homeDir),
    backupRoot,
    ...(previous ? { previous } : {}),
    plannedPaths: planned.map(({ target }) => target),
  };
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
  await rm(journalPath, { force: true });
  await rm(stageRoot, { recursive: true, force: true });
  return receipt;
}

export async function rollbackHostProjection(
  receipt: HostProjectionReceiptV1,
): Promise<HostProjectionReceiptV1> {
  await assertDisposableHome(receipt.homeDir, receipt.host);
  await assertSafeTarget(
    receipt.homeDir,
    statePath(receipt.homeDir, receipt.host, "receipt.json"),
  );
  if (!receipt.rollbackRoot)
    throw new Error("host projection has no prior version to roll back");
  if (!(await allReceiptFilesMatch(receipt)))
    throw new Error("current host projection was modified; rollback refused");
  const previous = await readReceipt(
    join(receipt.rollbackRoot, "previous.json"),
  );
  if (!previous) throw new Error("prior host projection receipt is missing");
  const backupRoot = join(receipt.rollbackRoot, "backup");
  for (const file of receipt.files) await rm(file.path, { force: true });
  for (const file of previous.files) {
    const backup = join(
      backupRoot,
      relative(resolve(receipt.homeDir), file.path),
    );
    const bytes = await readRegularFile(backup);
    if (digest(bytes) !== file.installedSha256)
      throw new Error("prior host projection backup checksum mismatch");
    await mkdir(dirname(file.path), { recursive: true });
    await writeFile(file.path, bytes);
  }
  await writeJson(
    statePath(receipt.homeDir, receipt.host, "receipt.json"),
    previous,
  );
  await replaceCurrentStore(previous);
  return previous;
}

export async function removeVersionedHostProjection(
  receipt: HostProjectionReceiptV1,
): Promise<{
  readonly removed: readonly string[];
  readonly preserved: readonly string[];
}> {
  await assertDisposableHome(receipt.homeDir, receipt.host);
  await assertSafeTarget(
    receipt.homeDir,
    statePath(receipt.homeDir, receipt.host, "receipt.json"),
  );
  const removed: string[] = [];
  const preserved: string[] = [];
  for (const file of receipt.files) {
    await assertSafeTarget(receipt.homeDir, file.path);
    const bytes = await optionalRead(file.path);
    if (bytes === undefined || digest(bytes) === file.installedSha256) {
      await rm(file.path, { force: true });
      removed.push(file.path);
    } else preserved.push(file.path);
  }
  if (preserved.length === 0)
    await rm(statePath(receipt.homeDir, receipt.host, "receipt.json"), {
      force: true,
    });
  return { removed: removed.sort(), preserved: preserved.sort() };
}

export async function recoverInterruptedHostProjection(input: {
  readonly host: HostName;
  readonly homeDir: string;
}): Promise<void> {
  const journalPath = statePath(input.homeDir, input.host, "journal.json");
  await assertSafeTarget(input.homeDir, journalPath);
  const journal = await readJson<Journal>(journalPath);
  if (!journal) return;
  if (journal.host !== input.host || journal.homeDir !== resolve(input.homeDir))
    throw new Error("host projection journal authority mismatch");
  for (const path of journal.plannedPaths) {
    await assertSafeTarget(input.homeDir, path);
    await rm(path, { force: true });
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
    await writeJson(
      statePath(input.homeDir, input.host, "receipt.json"),
      journal.previous,
    );
    await replaceCurrentStore(journal.previous);
  }
  await rm(journalPath, { force: true });
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
  const canonical = await realpath(resolved);
  if (
    canonical !== resolved ||
    !basename(canonical).startsWith(`maestro-${token}-`) ||
    !`${canonical}/`.startsWith(`${await realpath(tmpdir())}/`)
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
  return readJson<HostProjectionReceiptV1>(path);
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

function code(error: unknown): unknown {
  return error && typeof error === "object"
    ? (error as NodeJS.ErrnoException).code
    : undefined;
}
