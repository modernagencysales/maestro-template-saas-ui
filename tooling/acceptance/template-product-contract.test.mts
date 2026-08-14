import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkTemplateProductContract,
  withMaterializedRecordsCustomer,
} from "./template-product-contract.mts";
import {
  runRequiredAcceptanceAdmission,
  runStructuralProductContractAdmission,
} from "./template-product-contract-admission.mts";

const repoRoot = new URL("../..", import.meta.url).pathname;

describe("template product contract adapter", () => {
  it("materializes a clean Records customer before invoking operations", async () => {
    await withMaterializedRecordsCustomer(repoRoot, async (targetRoot) => {
      expect(targetRoot).toContain("maestro-records-customer-");
      expect(
        JSON.parse(
          readFileSync(join(targetRoot, "template-instance.json"), "utf8"),
        ),
      ).toMatchObject({
        schemaVersion: 2,
        blueprint: { id: "saas-application" },
        ownership: {
          manifest: "releases/v0.2.0-alpha.1/manifest.json",
        },
        personalization: { name: "Records Customer" },
      });
    });
  }, 30_000);

  it("checks the seed contract through the materialized customer App Map", async () => {
    const findings = await checkTemplateProductContract({
      repoRoot,
      sourceRoot: "examples/saas-application/seed/source",
      allowFirstContract: true,
    });
    expect(findings).toEqual([]);
  }, 30_000);

  it("uses an explicitly supplied materialized customer for its App Map", async () => {
    await expect(
      checkTemplateProductContract({
        repoRoot,
        sourceRoot: "examples/saas-application/seed/source",
        allowFirstContract: true,
        targetRoot: "/definitely-not-a-materialized-customer",
      } as Parameters<typeof checkTemplateProductContract>[0]),
    ).rejects.toThrow();
  }, 30_000);
});

describe("template product contract admission", () => {
  it("validates a prepared generated customer structurally", async () => {
    await expect(
      runStructuralProductContractAdmission(),
    ).resolves.toBeUndefined();
  }, 900_000);

  it("executes required generated-customer behavior", async () => {
    await expect(runRequiredAcceptanceAdmission()).resolves.toBeUndefined();
  }, 900_000);
});
