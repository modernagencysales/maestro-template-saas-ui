import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  saasUiRegistryReceiptConfig,
  saasUiStarterReceiptConfig,
  saasUiRegistryStandardRuleOverrides,
} from "../../eslint.config.mjs";

const receiptPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "rules/__tests__/fixtures/saas-ui-registry-files.json",
);

describe("Saas UI registry ESLint overrides", () => {
  it("targets exactly receipt-listed files and only named upstream rules", () => {
    const config = saasUiRegistryReceiptConfig(receiptPath);
    expect(config).toEqual({
      files: [
        "apps/web/src/components/add-contact-drawer/add-contact-drawer.tsx",
      ],
      rules: saasUiRegistryStandardRuleOverrides,
    });
    expect(Object.keys(config.rules)).toEqual([
      "@typescript-eslint/ban-ts-comment",
      "@typescript-eslint/no-empty-object-type",
      "@typescript-eslint/no-explicit-any",
      "@typescript-eslint/no-non-null-assertion",
      "@typescript-eslint/no-unused-vars",
    ]);
  });

  it("does not match an adjacent unlisted custom file", () => {
    const config = saasUiRegistryReceiptConfig(receiptPath);
    expect(config.files).not.toContain(
      "apps/web/src/components/add-contact-drawer/custom-wrapper.tsx",
    );
    expect(config.files.some((file) => file.includes("**"))).toBe(false);
  });
});

describe("Saas UI starter ESLint overrides", () => {
  it("targets exactly receipt-listed starter files", () => {
    const receiptPath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../docs/template/saas-ui-starter-files.json",
    );
    const config = saasUiStarterReceiptConfig(receiptPath);
    expect(config.files.length).toBeGreaterThan(1);
    expect(config.files).toContain(
      "apps/web/src/features/common/layouts/app-layout.tsx",
    );
    expect(config.files).not.toContain(
      "apps/web/src/features/common/layouts/custom-layout.tsx",
    );
    expect(config.files.some((file) => file.includes("**"))).toBe(false);
  });
});

describe("Saas UI receipt integrity", () => {
  it("does not exempt a receipt path when its content hash is stale", () => {
    const root = mkdtempSync(join(tmpdir(), "saas-ui-receipt-integrity-"));
    const receiptPath = join(root, "docs/template/saas-ui-registry-files.json");
    const destination = "apps/web/src/components/paid.tsx";
    try {
      mkdirSync(dirname(join(root, destination)), { recursive: true });
      mkdirSync(dirname(receiptPath), { recursive: true });
      writeFileSync(join(root, destination), "current source\n");
      writeFileSync(
        receiptPath,
        JSON.stringify({
          schemaVersion: 1,
          sourceCommit: "ac3a40c8dc05e403f9d501a87c092646891d3c40",
          files: [
            {
              destination,
              sha256: createHash("sha256")
                .update("stale source\n")
                .digest("hex"),
            },
          ],
        }),
      );
      expect(saasUiRegistryReceiptConfig(receiptPath)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
