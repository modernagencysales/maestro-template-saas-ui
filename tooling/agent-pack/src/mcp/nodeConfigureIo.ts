import { mkdir, open, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  MAX_CONFIG_BYTES,
  isLocalReceipt,
  isRecord,
  receiptPath,
  type LocalReceipt,
} from "./nodeConfigureShared.js";

export type McpConfigurationFileSystem = {
  readonly readFile: (path: string) => Promise<string>;
  readonly writeFile: (path: string, content: string) => Promise<void>;
  readonly mkdir: (path: string) => Promise<void>;
  readonly remove: (path: string) => Promise<void>;
};

export const nodeMcpConfigurationFileSystem: McpConfigurationFileSystem = {
  readFile: async (path) => readBounded(path),
  writeFile: (path, content) => writeFile(path, content, "utf8"),
  mkdir: (path) => mkdir(path, { recursive: true }).then(() => undefined),
  remove: (path) => rm(path).then(() => undefined),
};

export async function writeLocalReceipt(
  fs: McpConfigurationFileSystem,
  receipt: LocalReceipt,
): Promise<void> {
  const path = receiptPath(receipt.receipt);
  await fs.mkdir(dirname(path));
  await fs.writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`);
}

export async function readLocalReceipt(
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

export async function optionalRead(
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
