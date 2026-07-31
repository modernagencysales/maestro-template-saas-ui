import { createHash } from "node:crypto";
import {
  mkdir,
  lstat,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { isDirectTemporaryPath } from "./temporaryPath.js";

export type HostName = "claude-code" | "codex";
export {
  installVersionedHostProjection,
  recoverInterruptedHostProjection,
  removeVersionedHostProjection,
  rollbackHostProjection,
} from "./hostProjectionLifecycle.js";
export type { HostProjectionReceiptV1 } from "./hostProjectionLifecycle.js";

export type HostInstallReceipt = {
  readonly host: HostName;
  readonly homeDir: string;
  readonly files: readonly {
    readonly path: string;
    readonly sha256: string;
  }[];
};

export type HostDiscovery = {
  readonly maestro: boolean;
  readonly maestroConvex: boolean;
  readonly officialConvexSkills: readonly string[];
  readonly mcpConfigured: boolean;
};

const OFFICIAL_SKILLS = [
  "convex",
  "convex-create-component",
  "convex-migration-helper",
  "convex-performance-audit",
  "convex-quickstart",
  "convex-setup-auth",
] as const;

export async function installHostProjection(input: {
  readonly host: HostName;
  readonly repoRoot: string;
  readonly homeDir: string;
}): Promise<HostInstallReceipt> {
  await assertDisposableHome(input.homeDir, input.host);
  const skillRoot = hostSkillRoot(input.homeDir, input.host);
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
  const planned: Array<{
    readonly source: string;
    readonly target: string;
    readonly sha256: string;
  }> = [];

  for (const source of sources) {
    for (const path of await filesUnder(source.root)) {
      const content = await readFile(path);
      planned.push({
        source: path,
        target: join(skillRoot, source.name, relative(source.root, path)),
        sha256: hash(content),
      });
    }
  }

  for (const file of planned) {
    await assertNoSymlinkPath(input.homeDir, file.target);
    const existing = await optionalRead(file.target);
    if (existing !== undefined && hash(existing) !== file.sha256) {
      throw new Error(
        `host file already exists with different content: ${file.target}`,
      );
    }
  }
  for (const file of planned) {
    await mkdir(dirname(file.target), { recursive: true });
    await writeFile(file.target, await readFile(file.source));
  }

  return {
    host: input.host,
    homeDir: resolve(input.homeDir),
    files: planned
      .map((file) => ({ path: file.target, sha256: file.sha256 }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  };
}

export async function discoverHostProjection(input: {
  readonly host: HostName;
  readonly homeDir: string;
}): Promise<HostDiscovery> {
  const skillRoot = hostSkillRoot(input.homeDir, input.host);
  const discovered = new Set<string>();
  for (const name of [...OFFICIAL_SKILLS, "maestro", "maestro-convex"]) {
    if (await exists(join(skillRoot, name, "SKILL.md"))) discovered.add(name);
  }
  return {
    maestro: discovered.has("maestro"),
    maestroConvex: discovered.has("maestro-convex"),
    officialConvexSkills: OFFICIAL_SKILLS.filter((name) =>
      discovered.has(name),
    ),
    mcpConfigured: await hasMcpConfiguration(input.homeDir, input.host),
  };
}

export async function removeHostProjection(
  receipt: HostInstallReceipt,
): Promise<{
  readonly removed: readonly string[];
  readonly refused: readonly string[];
}> {
  await assertDisposableHome(receipt.homeDir, receipt.host);
  const removed: string[] = [];
  const refused: string[] = [];
  const home = `${resolve(receipt.homeDir)}/`;

  for (const file of [...receipt.files].sort((left, right) =>
    right.path.localeCompare(left.path),
  )) {
    const target = resolve(file.path);
    if (!`${target}/`.startsWith(home)) {
      refused.push(file.path);
      continue;
    }
    await assertNoSymlinkPath(receipt.homeDir, target);
    const existing = await optionalRead(target);
    if (existing === undefined) {
      removed.push(file.path);
    } else if (hash(existing) !== file.sha256) {
      refused.push(file.path);
    } else {
      await rm(target);
      removed.push(file.path);
    }
  }
  return {
    removed: removed.sort(),
    refused: refused.sort(),
  };
}

function hostSkillRoot(homeDir: string, host: HostName): string {
  return host === "claude-code"
    ? join(homeDir, ".claude/skills")
    : join(homeDir, ".codex/skills");
}

async function assertDisposableHome(
  homeDir: string,
  host: HostName,
): Promise<void> {
  const resolved = resolve(homeDir);
  const expectedToken = host === "claude-code" ? "claude" : "codex";
  if (!basename(resolved).startsWith(`maestro-${expectedToken}-`)) {
    throw new Error("host installation requires a disposable temporary home");
  }
  const existing = resolve(resolved);
  if (
    !(await isDirectTemporaryPath(existing)) ||
    !basename(existing).startsWith(`maestro-${expectedToken}-`)
  ) {
    throw new Error("host installation requires a disposable temporary home");
  }
}

async function assertNoSymlinkPath(
  homeDir: string,
  target: string,
): Promise<void> {
  const home = resolve(homeDir);
  const targetPath = resolve(target);
  const relativeTarget = relative(home, targetPath);
  if (relativeTarget.startsWith("..") || relativeTarget === "") {
    throw new Error("host target must stay within the disposable home");
  }
  let current = home;
  for (const segment of relativeTarget.split(/[\\/]/)) {
    current = join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new Error(`host target traverses a symlink: ${current}`);
      }
    } catch (error) {
      if (errorCode(error) === "ENOENT") return;
      throw error;
    }
  }
}

async function hasMcpConfiguration(
  homeDir: string,
  host: HostName,
): Promise<boolean> {
  const candidates =
    host === "claude-code"
      ? [join(homeDir, ".mcp.json"), join(homeDir, ".claude/mcp.json")]
      : [join(homeDir, ".codex/config.toml")];
  for (const path of candidates) {
    const content = await optionalRead(path);
    if (content !== undefined && /mcp/i.test(content.toString("utf8")))
      return true;
  }
  return false;
}

async function filesUnder(root: string): Promise<readonly string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function optionalRead(path: string): Promise<Buffer | undefined> {
  try {
    await stat(path);
    return await readFile(path);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return undefined;
    throw error;
  }
}

async function exists(path: string): Promise<boolean> {
  return (await optionalRead(path)) !== undefined;
}

function hash(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function errorCode(error: unknown): unknown {
  if (error === null || typeof error !== "object") return undefined;
  return Object.fromEntries(Object.entries(error)).code;
}
