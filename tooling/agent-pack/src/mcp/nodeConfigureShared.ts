import { createHash } from "node:crypto";
import { resolve } from "node:path";
import type {
  McpConfigurationHost,
  McpConfigurationReceipt,
} from "./configure.js";

export const RECEIPT_SCHEMA_VERSION = 1;
export const MAX_CONFIG_BYTES = 256 * 1024;
export const FORBIDDEN_FLAGS = [
  "--prod",
  "--dangerously-enable-production-deployments",
  "--cautiously-allow-production-pii",
] as const;

export type LocalReceipt = {
  readonly schemaVersion: typeof RECEIPT_SCHEMA_VERSION;
  readonly receipt: McpConfigurationReceipt;
  readonly registrationSha256: string;
  readonly installedBytes: string;
};

export type ConfigurationKey = {
  readonly owner: "maestro-agent-pack";
  readonly scope: "local";
  readonly registration: "convex";
  readonly host: McpConfigurationHost;
  readonly repoRoot: string;
};

export function safeConvexLaunch(args: readonly string[]): boolean {
  return (
    args.slice(0, 5).join("\0") ===
      ["pnpm", "exec", "convex", "mcp", "start"].join("\0") &&
    !FORBIDDEN_FLAGS.some((flag) => args.includes(flag)) &&
    args.includes("--deployment") &&
    args[args.indexOf("--deployment") + 1] === "dev" &&
    args.includes("--disable-tools")
  );
}

export function createLocalReceipt(
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

export function isLocalReceipt(value: unknown): value is LocalReceipt {
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

export function receiptMatches(
  stored: LocalReceipt,
  expected: McpConfigurationReceipt,
): boolean {
  return JSON.stringify(stored.receipt) === JSON.stringify(expected);
}

export function receiptKeyMatches(
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

export function receiptPath(input: {
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

export function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
