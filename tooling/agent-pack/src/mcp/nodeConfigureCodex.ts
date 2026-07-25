import { dirname, resolve } from "node:path";
import type { McpConfigurationReceipt } from "./configure.js";
import {
  optionalRead,
  readLocalReceipt,
  type McpConfigurationFileSystem,
} from "./nodeConfigureIo.js";
import {
  FORBIDDEN_FLAGS,
  createLocalReceipt,
  hash,
  receiptKeyMatches,
  receiptMatches,
  receiptPath,
  safeConvexLaunch,
  type ConfigurationKey,
} from "./nodeConfigureShared.js";

const BEGIN_CODEX = "# BEGIN MAESTRO MANAGED CONVEX MCP";
const END_CODEX = "# END MAESTRO MANAGED CONVEX MCP";
type CodexReceipt = McpConfigurationReceipt & {
  readonly host: "codex";
  readonly installation: Extract<
    McpConfigurationReceipt["installation"],
    { readonly kind: "managed-section" }
  >;
};

export async function applyCodex(
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

export async function removeCodex(
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
  )
    return { status: "refused" };
  await fs.writeFile(configPath, config.replace(stored.installedBytes, ""));
  await fs.remove(receiptPath(key));
  return { status: "removed" };
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

function codexConfigPath(repoRoot: string): string {
  return resolve(repoRoot, ".codex", "config.toml");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
