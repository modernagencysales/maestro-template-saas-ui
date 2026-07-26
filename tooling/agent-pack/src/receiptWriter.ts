import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  rename,
  rm,
  type FileHandle,
} from "node:fs/promises";
import { resolve } from "node:path";
import type { VerificationReceiptWriter } from "./receiptExport.js";

export * from "./receiptExport.js";

export const VERIFICATION_RECEIPT_PATH =
  ".maestro/verification-receipt.json" as const;

export function createNodeVerificationReceiptWriter(input: {
  readonly maxBytes: number;
}): VerificationReceiptWriter {
  if (!Number.isSafeInteger(input.maxBytes) || input.maxBytes <= 0)
    throw new Error("Verification receipt limit must be a positive integer.");
  return {
    persist: async (repo, receipt) => {
      const bytes = `${JSON.stringify(receipt, null, 2)}\n`;
      if (Buffer.byteLength(bytes, "utf8") > input.maxBytes)
        throw new Error(
          "Verification receipt exceeds the bounded receipt limit.",
        );
      const directory = resolve(repo.targetRoot, ".maestro");
      await assertSafeDirectory(directory);
      const destination = resolve(repo.targetRoot, VERIFICATION_RECEIPT_PATH);
      const temporary = resolve(
        directory,
        `.verification-receipt.${process.pid}.${randomUUID()}.tmp`,
      );
      let handle: FileHandle | undefined;
      try {
        handle = await open(temporary, "wx", 0o600);
        await handle.writeFile(bytes, "utf8");
        await handle.sync();
        await handle.close();
        handle = undefined;
        await rename(temporary, destination);
      } catch {
        await handle?.close().catch(() => undefined);
        await rm(temporary, { force: true }).catch(() => undefined);
        throw new Error("Verification receipt could not be persisted safely.");
      }
    },
  };
}

async function assertSafeDirectory(path: string): Promise<void> {
  try {
    await mkdir(path, { mode: 0o700 });
  } catch (error) {
    if (errorCode(error) !== "EEXIST")
      throw new Error(
        "Verification receipt requires a safe receipt directory.",
      );
  }
  const status = await lstat(path).catch(() => undefined);
  if (status === undefined || !status.isDirectory() || status.isSymbolicLink())
    throw new Error("Verification receipt requires a safe receipt directory.");
}

function errorCode(error: unknown): unknown {
  return error !== null && typeof error === "object" && "code" in error
    ? error.code
    : undefined;
}
