import type { VerificationExecFile } from "../verificationRunner.js";
import type { McpConfigurationReceipt } from "./configure.js";
import {
  readLocalReceipt,
  writeLocalReceipt,
  type McpConfigurationFileSystem,
} from "./nodeConfigureIo.js";
import {
  MAX_CONFIG_BYTES,
  hash,
  receiptKeyMatches,
  receiptMatches,
  receiptPath,
  safeConvexLaunch,
  createLocalReceipt,
  type ConfigurationKey,
} from "./nodeConfigureShared.js";

const CLAUDE_NOT_FOUND = "No MCP server found with name: convex";
type ClaudeReceipt = McpConfigurationReceipt & {
  readonly host: "claude-code";
  readonly installation: Extract<
    McpConfigurationReceipt["installation"],
    { readonly kind: "host-command" }
  >;
};

export async function applyClaude(
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
  if (
    !(await runHost(execFile, command.command, command.args, receipt.repoRoot))
  ) {
    return { status: "refused" };
  }
  const installed = await inspectClaude(execFile, receipt.repoRoot);
  if (installed.kind !== "present") {
    await runHost(execFile, "claude", claudeRemoveArgs(), receipt.repoRoot);
    return { status: "refused" };
  }
  try {
    await writeLocalReceipt(fs, createLocalReceipt(receipt, installed.bytes));
  } catch {
    await runHost(execFile, "claude", claudeRemoveArgs(), receipt.repoRoot);
    return { status: "refused" };
  }
  return { status: "created" };
}

export async function removeClaude(
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
  )
    return { status: "refused" };
  if (!(await runHost(execFile, "claude", claudeRemoveArgs(), key.repoRoot))) {
    return { status: "refused" };
  }
  await fs.remove(receiptPath(key));
  return { status: "removed" };
}

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
