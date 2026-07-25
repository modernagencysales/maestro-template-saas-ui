import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CustomerReleaseManifestError,
  validateCustomerReleaseManifest,
} from "./manifest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const fixturePath = resolve(repoRoot, "releases/v0.1.0-alpha.1/manifest.json");

const readFixture = (): unknown =>
  JSON.parse(readFileSync(fixturePath, "utf8"));

const sha256 = (path: string): string =>
  `sha256:${createHash("sha256")
    .update(readFileSync(resolve(repoRoot, path)))
    .digest("hex")}`;

const shippedFiles = Object.freeze({
  "AGENTS.md": sha256("AGENTS.md"),
  "docs/template/client-intake-questionnaire.md": sha256(
    "docs/template/client-intake-questionnaire.md",
  ),
});

describe("customer release manifest", () => {
  it("validates the immutable golden tagged release", () => {
    const manifest = validateCustomerReleaseManifest(
      readFixture(),
      shippedFiles,
    );

    expect(manifest.release).toEqual({
      version: "0.1.0-alpha.1",
      tag: "maestro-template-v0.1.0-alpha.1",
      sourceCommit: "a6ec083e7f6a689fb39f19804fb117056b290c79",
      sourceChecksum:
        "sha256:7e6c9148442e12d073721a8dfa1ccfd9675cb757c588ae5ddf8c48f38485594e",
    });
    expect(manifest.compatibility).toEqual({
      cli: ">=0.1.0-alpha.1 <0.2.0",
      agentPack: ">=0.1.0-alpha.1 <0.2.0",
    });
    expect(new Set(manifest.paths.map(({ ownership }) => ownership))).toEqual(
      new Set([
        "template-owned",
        "customer-extension",
        "generated",
        "local-only",
        "factory-only",
      ]),
    );
    expect(manifest.extensionSeams).toEqual([
      {
        path: "docs/template/client-intake-questionnaire.md",
        description: "Customer-owned intake language and answers.",
      },
    ]);
  });

  it("fails self-protection when a shipped path is unclassified", () => {
    expect(() =>
      validateCustomerReleaseManifest(readFixture(), {
        ...shippedFiles,
        "apps/web/src/unclassified.ts": `sha256:${"0".repeat(64)}`,
      }),
    ).toThrowError(CustomerReleaseManifestError);
    expect(() =>
      validateCustomerReleaseManifest(readFixture(), {
        ...shippedFiles,
        "apps/web/src/unclassified.ts": `sha256:${"0".repeat(64)}`,
      }),
    ).toThrow("Unclassified shipped path: apps/web/src/unclassified.ts");
  });

  it("rejects copied hashes and extension seams that drift from ownership", () => {
    const valid = validateCustomerReleaseManifest(readFixture(), shippedFiles);
    const fixture = {
      ...valid,
      expectedHashes: {
        ...valid.expectedHashes,
        "AGENTS.md": `sha256:${"f".repeat(64)}`,
      },
      extensionSeams: [
        { path: "AGENTS.md", description: "Invalid template-owned seam." },
      ],
    };

    expect(() =>
      validateCustomerReleaseManifest(fixture, shippedFiles),
    ).toThrow("Hash mismatch for shipped path: AGENTS.md");
    expect(() =>
      validateCustomerReleaseManifest(fixture, shippedFiles),
    ).toThrow(
      "Extension seam must reference a customer-extension path: AGENTS.md",
    );
  });
});
