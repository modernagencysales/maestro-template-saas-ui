import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import type { UpgradeManifestV1 } from "./contract.js";
import { planUpgrade } from "./plan.js";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const releaseManifest = JSON.parse(
  readFileSync(
    resolve(repoRoot, "releases/v0.2.0-alpha.1/manifest.json"),
    "utf8",
  ),
) as Record<string, unknown>;
const schema = JSON.parse(
  readFileSync(
    resolve(repoRoot, "schemas/maestro-release-upgrade.schema.json"),
    "utf8",
  ),
) as object;
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
});
const validate = ajv.compile(schema);
const upgradeManifest = releaseManifest.upgrade as UpgradeManifestV1;
const reviewedPriorFiles = upgradeManifest.operations.flatMap((operation) => {
  if (operation.beforeHash === undefined) return [];
  if (operation.kind === "move" && operation.fromPath === undefined)
    throw new Error(`move operation ${operation.id} needs fromPath`);
  return [
    {
      path: operation.kind === "move" ? operation.fromPath : operation.path,
      ownership: operation.ownership,
      hash: operation.beforeHash,
    },
  ];
});

describe("reviewed release upgrade manifest contract", () => {
  it("ships a schema-valid engine manifest for the one-prior transition", () => {
    expect(
      validate(releaseManifest.upgrade),
      ajv.errorsText(validate.errors),
    ).toBe(true);
    expect(releaseManifest.upgrade).toMatchObject({
      schemaVersion: 1,
      transition: {
        fromVersion: "0.1.0-alpha.1",
        toVersion: "0.2.0-alpha.1",
        immediatePriorVersion: "0.1.0-alpha.1",
      },
    });

    expect(
      planUpgrade({
        schemaVersion: 1,
        manifest: releaseManifest.upgrade,
        target: {
          version: "0.1.0-alpha.1",
          relation: "immediate-prior",
          commit: "a".repeat(40),
          clean: true,
          files: reviewedPriorFiles,
        },
      }),
    ).toMatchObject({
      ok: true,
      mode: "plan-only",
      writeAvailable: false,
    });
  });

  it.each([
    {
      id: "invalid-add",
      kind: "add",
      path: "template.ts",
      ownership: "template-owned",
      beforeHash: `sha256:${"a".repeat(64)}`,
      afterHash: `sha256:${"b".repeat(64)}`,
    },
    {
      id: "invalid-regenerate",
      kind: "regenerate",
      path: "generated.ts",
      ownership: "template-owned",
      beforeHash: `sha256:${"a".repeat(64)}`,
      afterHash: `sha256:${"b".repeat(64)}`,
    },
  ])(
    "rejects an operation outside the reviewed engine contract",
    (operation) => {
      const upgrade = structuredClone(releaseManifest.upgrade) as {
        operations: unknown[];
      };
      upgrade.operations = [operation];

      expect(validate(upgrade)).toBe(false);
    },
  );
});
