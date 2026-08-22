import { lstat, mkdtemp, readFile, readdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { createVerificationReceipt } from "./receipt.js";
import { createNodeVerificationReceiptWriter } from "./receiptWriter.js";
import { createRepositoryContext } from "./repoContext.js";

const receipt = createVerificationReceipt({
  createdAt: "2026-07-25T12:00:00.000Z",
  command: { id: "verify", version: 1 },
  subject: { commit: "abc123", dirty: false },
  repositoryFingerprint: "repository_sha256:fixture",
  environmentFingerprint: "environment_sha256:fixture",
  providerPostureFingerprint: "providers_sha256:fixture",
  scope: { kind: "full", changedPaths: [], partial: false },
  gates: [],
});

describe("verification receipt writer", () => {
  it("keeps the explicit target-local receipt outside Git evidence", async () => {
    const rootIgnore = fileURLToPath(
      new URL("../../../.gitignore", import.meta.url),
    );
    expect(await readFile(rootIgnore, "utf8")).toContain(
      ".maestro/verification-receipt.json",
    );
  });
  it("atomically persists bounded canonical bytes with no journal residue", async () => {
    const targetRoot = await mkdtemp(join(tmpdir(), "maestro-receipt-"));
    const repo = createRepositoryContext({ cwd: targetRoot });
    const writer = createNodeVerificationReceiptWriter({ maxBytes: 64_000 });

    await writer.persist(repo, receipt);

    const path = join(targetRoot, ".maestro", "verification-receipt.json");
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(receipt);
    expect((await lstat(path)).mode & 0o777).toBe(0o600);
    expect(await readdir(join(targetRoot, ".maestro"))).toEqual([
      "verification-receipt.json",
    ]);
  });

  it("rejects an unbounded receipt and a symlinked receipt directory", async () => {
    const targetRoot = await mkdtemp(join(tmpdir(), "maestro-receipt-"));
    const outside = await mkdtemp(join(tmpdir(), "maestro-receipt-outside-"));
    const repo = createRepositoryContext({ cwd: targetRoot });
    await expect(
      createNodeVerificationReceiptWriter({ maxBytes: 8 }).persist(
        repo,
        receipt,
      ),
    ).rejects.toThrow("bounded receipt limit");
    await symlink(outside, join(targetRoot, ".maestro"));
    await expect(
      createNodeVerificationReceiptWriter({ maxBytes: 64_000 }).persist(
        repo,
        receipt,
      ),
    ).rejects.toThrow("safe receipt directory");
    expect(await readdir(outside)).toEqual([]);
  });
});
