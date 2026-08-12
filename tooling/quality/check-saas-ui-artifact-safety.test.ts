import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { readRequiredStarterReceipt } from "./check-saas-ui-artifact-safety.mts";

describe("Saas UI starter receipt boundary", () => {
  it.each([
    ["missing receipt", undefined],
    ["invalid receipt", "{}"],
    [
      "uncovered paid source",
      JSON.stringify({
        schemaVersion: 1,
        sourceCommit: "b76cb4514b9ab47f7db87901cb9b593b4adc3129",
        files: [],
      }),
    ],
  ])("fails closed for %s", (_label, contents) => {
    const root = mkdtempSync(join(tmpdir(), "saas-ui-receipt-"));
    try {
      if (contents !== undefined) {
        mkdirSync(join(root, "docs/template"), { recursive: true });
        writeFileSync(
          join(root, "docs/template/saas-ui-starter-files.json"),
          contents,
        );
      }
      const errors: string[] = [];
      readRequiredStarterReceipt(root, errors, [
        "apps/web/src/theme/preset.ts",
      ]);
      expect(errors.length).toBeGreaterThan(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
