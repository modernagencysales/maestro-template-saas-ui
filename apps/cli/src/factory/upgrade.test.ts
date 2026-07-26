import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createUpgradeCliHandler } from "./upgrade";

const roots: string[] = [];
const temp = (): string => {
  const root = mkdtempSync(join(tmpdir(), "maestro-upgrade-cli-"));
  roots.push(root);
  return root;
};

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("upgrade migration lifecycle", () => {
  it("exposes the reviewed plan without claiming execution", async () => {
    const root = temp();
    const input = readFileSync(
      new URL(
        "../../../../tooling/release/__fixtures__/migration/clean.json",
        import.meta.url,
      ),
    );
    writeFileSync(join(root, "migration.json"), input);
    const result = await createUpgradeCliHandler().run(
      ["upgrade", "migration-plan", "--input", "migration.json"],
      root,
    );
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      mode: "plan-only",
      executionAvailable: false,
      fileUpgrade: { blocked: true, code: "MIGRATION_RECEIPT_REQUIRED" },
    });
  });

  it("verifies the no-migration bridge without write authority", async () => {
    const root = temp();
    mkdirSync(root, { recursive: true });
    writeFileSync(
      join(root, "verification.json"),
      JSON.stringify({
        schemaVersion: 1,
        fileUpgrade: {
          planFingerprint: `sha256:${"1".repeat(64)}`,
          dataMigrationRequired: false,
        },
      }),
    );
    const result = await createUpgradeCliHandler().run(
      ["upgrade", "migration-verify", "--input", "verification.json"],
      root,
    );
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      mode: "verify-only",
      writeAvailable: false,
      receiptVerified: false,
      migration: { required: false },
    });
  });
});
