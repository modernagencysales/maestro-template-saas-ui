import { dirname, resolve } from "node:path";
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
