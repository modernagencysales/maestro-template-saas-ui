import { createHash } from "node:crypto";
import { mkdir, open, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { RepositoryContext } from "../repoContext.js";
import type { VerificationExecFile } from "../verificationRunner.js";
import type {
  McpConfigurationHost,
  McpConfigurationReceipt,
  McpConfigurationStore,
} from "./configure.js";

const RECEIPT_SCHEMA_VERSION = 1;
const MAX_CONFIG_BYTES = 256 * 1024;
const BEGIN_CODEX = "# BEGIN MAESTRO MANAGED CONVEX MCP";
const END_CODEX = "# END MAESTRO MANAGED CONVEX MCP";
const CLAUDE_NOT_FOUND = "No MCP server found with name: convex";
const FORBIDDEN_FLAGS = [
  "--prod",
  "--dangerously-enable-production-deployments",
  "--cautiously-allow-production-pii",
] as const;

type LocalReceipt = {
  readonly schemaVersion: typeof RECEIPT_SCHEMA_VERSION;
  readonly receipt: McpConfigurationReceipt;
  readonly registrationSha256: string;
  readonly installedBytes: string;
};
type ClaudeReceipt = McpConfigurationReceipt & {
  readonly host: "claude-code";
  readonly installation: Extract<
    McpConfigurationReceipt["installation"],
    { readonly kind: "host-command" }
  >;
};
type CodexReceipt = McpConfigurationReceipt & {
  readonly host: "codex";
  readonly installation: Extract<
    McpConfigurationReceipt["installation"],
    { readonly kind: "managed-section" }
  >;
};

export type McpConfigurationFileSystem = {
  readonly readFile: (path: string) => Promise<string>;
  readonly writeFile: (path: string, content: string) => Promise<void>;
  readonly mkdir: (path: string) => Promise<void>;
  readonly remove: (path: string) => Promise<void>;
};

const nodeFileSystem: McpConfigurationFileSystem = {
  readFile: async (path) => readBounded(path),
  writeFile: (path, content) => writeFile(path, content, "utf8"),
  mkdir: (path) => mkdir(path, { recursive: true }).then(() => undefined),
  remove: (path) => rm(path).then(() => undefined),
};

export function createRepositoryLocalMcpConfigurationStore(input: {
  readonly execFile: VerificationExecFile;
  readonly fs?: McpConfigurationFileSystem;
}): McpConfigurationStore {
  const fs = input.fs ?? nodeFileSystem;
  return {
    apply: async (receipt) =>
      receipt.host === "claude-code"
        ? applyClaude(receipt, input.execFile, fs)
        : applyCodex(receipt, fs),
    remove: async (key) =>
      key.host === "claude-code"
        ? removeClaude(key, input.execFile, fs)
        : removeCodex(key, fs),
  };
}

export async function readInstalledConvexMcpInventory(input: {
  readonly execFile: VerificationExecFile;
  readonly repo: RepositoryContext;
  readonly timeoutMs?: number;
  readonly maxBufferBytes?: number;
}): Promise<readonly string[]> {
  const result = await input.execFile(
    "pnpm",
    ["exec", "convex", "mcp", "start", "--help"],
    {
      cwd: input.repo.sourceRoot,
      timeoutMs: input.timeoutMs ?? 10_000,
      maxBufferBytes: input.maxBufferBytes ?? MAX_CONFIG_BYTES,
    },
  );
  const match =
    result.exitCode === 0
      ? result.stdout.match(
          /--disable-tools <tool-names>[^\n]*\(options: ([A-Za-z, ]+)\)/,
        )
      : null;
  const tools = match?.[1]?.split(",").map((tool) => tool.trim()) ?? [];
  if (
    tools.length === 0 ||
    tools.some((tool) => tool.length === 0) ||
    new Set(tools).size !== tools.length
  ) {
    throw new Error("installed Convex MCP inventory unavailable");
  }
  return tools;
}

async function applyClaude(
  receipt: McpConfigurationReceipt,
  execFile: VerificationExecFile,
  fs: McpConfigurationFileSystem,
): Promise<{ readonly status: "created" | "unchanged" | "refused" }> {
  if (!validClaudeReceipt(receipt)) return { status: "refused" };
  const existingReceipt = await readLocalReceipt(fs, receiptPath(receipt));
  if (existingReceipt === null) return { status: "refused" };
  const inspected = await inspectClaude(execFile, receipt.repoRoot);
  if (existingReceipt !== undefined) {
    return receiptMatches(existingReceipt, receipt) &&
      inspected.kind === "present" &&
      hash(inspected.bytes) === existingReceipt.registrationSha256
      ? { status: "unchanged" }
      : { status: "refused" };
  }
  if (inspected.kind !== "absent") return { status: "refused" };
  const command = receipt.installation.command;
  const applied = await runHost(
    execFile,
    command.command,
    command.args,
    receipt.repoRoot,
  );
  if (!applied) return { status: "refused" };
  const installed = await inspectClaude(execFile, receipt.repoRoot);
  if (installed.kind !== "present") {
    await runHost(execFile, "claude", claudeRemoveArgs(), receipt.repoRoot);
    return { status: "refused" };
  }
  const localReceipt = createLocalReceipt(receipt, installed.bytes);
  try {
    await writeLocalReceipt(fs, localReceipt);
  } catch {
    await runHost(execFile, "claude", claudeRemoveArgs(), receipt.repoRoot);
    return { status: "refused" };
  }
  return { status: "created" };
}

async function removeClaude(
  key: ConfigurationKey,
  execFile: VerificationExecFile,
  fs: McpConfigurationFileSystem,
): Promise<{ readonly status: "removed" | "absent" | "refused" }> {
  const stored = await readLocalReceipt(fs, receiptPath(key));
  if (stored === null) return { status: "refused" };
  const inspected = await inspectClaude(execFile, key.repoRoot);
  if (stored === undefined) {
    return inspected.kind === "absent"
      ? { status: "absent" }
      : { status: "refused" };
  }
  if (
    !receiptKeyMatches(stored.receipt, key) ||
    !validClaudeReceipt(stored.receipt) ||
    inspected.kind !== "present" ||
    hash(inspected.bytes) !== stored.registrationSha256
  ) {
    return { status: "refused" };
  }
  if (!(await runHost(execFile, "claude", claudeRemoveArgs(), key.repoRoot))) {
    return { status: "refused" };
  }
  await fs.remove(receiptPath(key));
  return { status: "removed" };
}

async function applyCodex(
  receipt: McpConfigurationReceipt,
  fs: McpConfigurationFileSystem,
): Promise<{ readonly status: "created" | "unchanged" | "refused" }> {
  if (!validCodexReceipt(receipt)) return { status: "refused" };
  const configPath = codexConfigPath(receipt.repoRoot);
  const config = await optionalRead(fs, configPath);
  if (config === undefined || !config.includes("[mcp_servers.maestro]")) {
    return { status: "refused" };
  }
  const stored = await readLocalReceipt(fs, receiptPath(receipt));
  if (stored === null) return { status: "refused" };
  const managed = managedCodexBlocks(config);
  if (stored !== undefined) {
    return receiptMatches(stored, receipt) &&
      managed.length === 1 &&
      hash(managed[0] ?? "") === stored.registrationSha256
      ? { status: "unchanged" }
      : { status: "refused" };
  }
  if (managed.length > 0 || hasConvexSection(config))
    return { status: "refused" };
  const block = renderManagedCodexBlock(receipt.installation.content);
  const separator = config.endsWith("\n\n")
    ? ""
    : config.endsWith("\n")
      ? "\n"
      : "\n\n";
  const installedBytes = `${separator}${block}`;
  const localReceipt = createLocalReceipt(receipt, block, installedBytes);
  await fs.mkdir(dirname(receiptPath(receipt)));
  try {
    await fs.writeFile(configPath, `${config}${installedBytes}`);
    await fs.writeFile(
      receiptPath(receipt),
      `${JSON.stringify(localReceipt, null, 2)}\n`,
    );
  } catch {
    await fs.writeFile(configPath, config);
    return { status: "refused" };
  }
  return { status: "created" };
}

async function removeCodex(
  key: ConfigurationKey,
  fs: McpConfigurationFileSystem,
): Promise<{ readonly status: "removed" | "absent" | "refused" }> {
  const configPath = codexConfigPath(key.repoRoot);
  const config = await optionalRead(fs, configPath);
  const stored = await readLocalReceipt(fs, receiptPath(key));
  if (stored === null) return { status: "refused" };
  if (stored === undefined) {
    return config !== undefined &&
      (hasConvexSection(config) || managedCodexBlocks(config).length > 0)
      ? { status: "refused" }
      : { status: "absent" };
  }
  if (
    config === undefined ||
    !receiptKeyMatches(stored.receipt, key) ||
    !validCodexReceipt(stored.receipt) ||
    managedCodexBlocks(config).length !== 1 ||
    hash(managedCodexBlocks(config)[0] ?? "") !== stored.registrationSha256 ||
    !config.includes(stored.installedBytes)
  ) {
    return { status: "refused" };
  }
  await fs.writeFile(configPath, config.replace(stored.installedBytes, ""));
  await fs.remove(receiptPath(key));
  return { status: "removed" };
}

type ConfigurationKey = {
  readonly owner: "maestro-agent-pack";
  readonly scope: "local";
  readonly registration: "convex";
  readonly host: McpConfigurationHost;
  readonly repoRoot: string;
};

function validClaudeReceipt(
  receipt: McpConfigurationReceipt,
): receipt is ClaudeReceipt {
  if (
    receipt.host !== "claude-code" ||
    receipt.installation.kind !== "host-command" ||
    receipt.installation.command.command !== "claude" ||
    receipt.removal.command !== "claude"
  )
    return false;
  const args = receipt.installation.command.args;
  return (
    args.slice(0, 9).join("\0") ===
      [
        "mcp",
        "add",
        "--transport",
        "stdio",
        "--scope",
        "local",
        "convex",
        "--",
        "pnpm",
      ].join("\0") &&
    receipt.removal.args.join("\0") === claudeRemoveArgs().join("\0") &&
    safeConvexLaunch(args.slice(8))
  );
}

function validCodexReceipt(
  receipt: McpConfigurationReceipt,
): receipt is CodexReceipt {
  if (
    receipt.host !== "codex" ||
    receipt.installation.kind !== "managed-section" ||
    receipt.removal.command !== "codex" ||
    receipt.removal.args.join("\0") !== ["mcp", "remove", "convex"].join("\0")
  )
    return false;
  const content = receipt.installation.content;
  const lines = content.trimEnd().split("\n");
  if (
    lines.length !== 5 ||
    lines[0] !== "[mcp_servers.convex]" ||
    lines[1] !== 'command = "pnpm"' ||
    lines[4] !== "enabled = true" ||
    content.includes(BEGIN_CODEX) ||
    content.includes(END_CODEX) ||
    FORBIDDEN_FLAGS.some((flag) => content.includes(flag))
  )
    return false;
  try {
    const args = JSON.parse(lines[2]?.replace(/^args = /, "") ?? "") as unknown;
    const cwd = JSON.parse(lines[3]?.replace(/^cwd = /, "") ?? "") as unknown;
    return (
      Array.isArray(args) &&
      args.every((value): value is string => typeof value === "string") &&
      safeConvexLaunch(["pnpm", ...args]) &&
      cwd === receipt.repoRoot
    );
  } catch {
    return false;
  }
}

function safeConvexLaunch(args: readonly string[]): boolean {
  return (
    args.slice(0, 5).join("\0") ===
      ["pnpm", "exec", "convex", "mcp", "start"].join("\0") &&
    !FORBIDDEN_FLAGS.some((flag) => args.includes(flag)) &&
    args.includes("--deployment") &&
    args[args.indexOf("--deployment") + 1] === "dev" &&
    args.includes("--disable-tools")
  );
}

function claudeRemoveArgs(): readonly string[] {
  return ["mcp", "remove", "--scope", "local", "convex"];
}

async function inspectClaude(
  execFile: VerificationExecFile,
  cwd: string,
): Promise<
  | { readonly kind: "absent" | "unavailable" }
  | { readonly kind: "present"; readonly bytes: string }
> {
  const result = await execFile("claude", ["mcp", "get", "convex"], {
    cwd,
    timeoutMs: 10_000,
    maxBufferBytes: MAX_CONFIG_BYTES,
  });
  if (result.exitCode === 0 && result.stdout.length > 0) {
    return { kind: "present", bytes: result.stdout };
  }
  if (result.exitCode === 1 && result.stderr.trim() === CLAUDE_NOT_FOUND) {
    return { kind: "absent" };
  }
  return { kind: "unavailable" };
}

async function runHost(
  execFile: VerificationExecFile,
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<boolean> {
  const result = await execFile(command, args, {
    cwd,
    timeoutMs: 30_000,
    maxBufferBytes: MAX_CONFIG_BYTES,
  });
  return result.exitCode === 0;
}

function renderManagedCodexBlock(section: string): string {
  return `${BEGIN_CODEX}\n${section.trimEnd()}\n${END_CODEX}\n`;
}

function managedCodexBlocks(content: string): readonly string[] {
  const escapedBegin = escapeRegExp(BEGIN_CODEX);
  const escapedEnd = escapeRegExp(END_CODEX);
  return [
    ...content.matchAll(
      new RegExp(`${escapedBegin}\\n[\\s\\S]*?${escapedEnd}\\n`, "g"),
    ),
  ].map(([block]) => block);
}

function hasConvexSection(content: string): boolean {
  return /^\[mcp_servers\.convex\][ \t]*$/m.test(content);
}

function createLocalReceipt(
  receipt: McpConfigurationReceipt,
  registrationBytes: string,
  installedBytes: string = registrationBytes,
): LocalReceipt {
  return {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    receipt,
    registrationSha256: hash(registrationBytes),
    installedBytes,
  };
}

async function writeLocalReceipt(
  fs: McpConfigurationFileSystem,
  receipt: LocalReceipt,
): Promise<void> {
  const path = receiptPath(receipt.receipt);
  await fs.mkdir(dirname(path));
  await fs.writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`);
}

async function readLocalReceipt(
  fs: McpConfigurationFileSystem,
  path: string,
): Promise<LocalReceipt | null | undefined> {
  const text = await optionalRead(fs, path);
  if (text === undefined) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    return isLocalReceipt(value) ? value : null;
  } catch {
    return null;
  }
}

function isLocalReceipt(value: unknown): value is LocalReceipt {
  if (!isRecord(value) || !isRecord(value.receipt)) return false;
  return (
    value.schemaVersion === RECEIPT_SCHEMA_VERSION &&
    typeof value.registrationSha256 === "string" &&
    /^[a-f0-9]{64}$/.test(value.registrationSha256) &&
    typeof value.installedBytes === "string" &&
    typeof value.receipt.repoRoot === "string" &&
    (value.receipt.host === "claude-code" || value.receipt.host === "codex")
  );
}

function receiptMatches(
  stored: LocalReceipt,
  expected: McpConfigurationReceipt,
): boolean {
  return JSON.stringify(stored.receipt) === JSON.stringify(expected);
}

function receiptKeyMatches(
  receipt: McpConfigurationReceipt,
  key: ConfigurationKey,
): boolean {
  return (
    receipt.owner === key.owner &&
    receipt.scope === key.scope &&
    receipt.registration === key.registration &&
    receipt.host === key.host &&
    receipt.repoRoot === resolve(key.repoRoot)
  );
}

function receiptPath(input: {
  readonly repoRoot: string;
  readonly host: McpConfigurationHost;
}): string {
  return resolve(
    input.repoRoot,
    ".maestro",
    "mcp",
    `convex-${input.host}.receipt.json`,
  );
}

function codexConfigPath(repoRoot: string): string {
  return resolve(repoRoot, ".codex", "config.toml");
}

async function optionalRead(
  fs: McpConfigurationFileSystem,
  path: string,
): Promise<string | undefined> {
  try {
    return await fs.readFile(path);
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function readBounded(path: string): Promise<string> {
  const handle = await open(path, "r");
  try {
    const stats = await handle.stat();
    if (!stats.isFile() || stats.size > MAX_CONFIG_BYTES)
      throw new Error("MCP config too large");
    const buffer = Buffer.alloc(MAX_CONFIG_BYTES + 1);
    const { bytesRead } = await handle.read(buffer, 0, MAX_CONFIG_BYTES + 1, 0);
    if (bytesRead > MAX_CONFIG_BYTES) throw new Error("MCP config too large");
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
