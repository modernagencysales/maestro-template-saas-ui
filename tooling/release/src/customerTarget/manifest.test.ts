import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CustomerReleaseManifestError,
  assertMaterializableCustomerReleaseManifest,
  validateCustomerReleaseManifest,
} from "./manifest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const sourceCommit = "517b5bc28d1d633bef18f57610cff49800123788";
const fixturePath = resolve(repoRoot, "releases/v0.1.0-alpha.1/manifest.json");
const schemaFile = resolve(
  repoRoot,
  "schemas/maestro-customer-release-manifest.schema.json",
);

const readFixture = (): unknown =>
  JSON.parse(readFileSync(fixturePath, "utf8"));
const readSchema = (): unknown => JSON.parse(readFileSync(schemaFile, "utf8"));

const rewriteFixture = (
  status: string | undefined,
  includeReason: boolean,
): unknown => {
  let serialized = JSON.stringify(readFixture());
  serialized = serialized.replace(
    '"materializationStatus":"fixture-only"',
    status === undefined
      ? '"removedMaterializationStatus":null'
      : `"materializationStatus":${JSON.stringify(status)}`,
  );
  if (!includeReason) {
    serialized = serialized.replace(/"fixtureReason":"(?:[^"\\]|\\.)*",/, "");
  } else if (
    status === "fixture-only" &&
    !serialized.includes('"fixtureReason"')
  ) {
    serialized = serialized.replace(
      '"release":',
      '"fixtureReason":"Contract evidence fixture.","release":',
    );
  }
  return JSON.parse(serialized);
};

const shippedFiles = Object.freeze(
  (
    JSON.parse(readFileSync(fixturePath, "utf8")) as {
      readonly expectedHashes: Readonly<Record<string, string>>;
    }
  ).expectedHashes,
);

describe("customer release manifest", () => {
  it("validates the checked-in unpublished release fixture", () => {
    const manifest = validateCustomerReleaseManifest(
      readFixture(),
      shippedFiles,
    );

    expect(manifest.release).toEqual({
      version: "0.1.0-alpha.1",
      tag: "maestro-template-v0.1.0-alpha.1",
      sourceCommit,
      sourceChecksum:
        "sha256:144583e8a2b0b495776f1456f035dc3d815342309a3a5826480a4f4c5140a297",
    });
    expect(manifest.compatibility).toEqual({
      cli: ">=0.1.0-alpha.1 <0.2.0",
      agentPack: ">=0.1.0-alpha.1 <0.2.0",
    });
    expect(manifest).toMatchObject({
      materializationStatus: "fixture-only",
      fixtureReason: expect.stringContaining("has not been published"),
    });
    expect(() =>
      assertMaterializableCustomerReleaseManifest(manifest, {
        tag: manifest.release.tag,
        sourceCommit: manifest.release.sourceCommit,
        sourceChecksum: manifest.release.sourceChecksum,
      }),
    ).toThrow("Release manifest is fixture-only");
    expect(new Set(manifest.paths.map(({ ownership }) => ownership))).toEqual(
      new Set([
        "template-owned",
        "customer-extension",
        "generated",
        "local-only",
        "factory-only",
      ]),
    );
    expect(manifest.extensionSeams.map(({ path }) => path).sort()).toEqual([
      ".env.example",
      "README.md",
      "docs/template/client-intake-questionnaire.md",
      "project.config.json",
    ]);
  });

  it("declares a closed materialization posture in the schema artifact", () => {
    expect(readSchema()).toMatchObject({
      required: expect.arrayContaining(["materializationStatus"]),
      properties: {
        materializationStatus: {
          enum: ["fixture-only", "materializable"],
        },
        fixtureReason: { type: "string", minLength: 1 },
        paths: expect.objectContaining({
          items: expect.objectContaining({
            required: expect.arrayContaining(["match"]),
          }),
        }),
      },
      allOf: [
        expect.objectContaining({
          if: {
            required: ["materializationStatus"],
            properties: {
              materializationStatus: { const: "fixture-only" },
            },
          },
          then: expect.objectContaining({ required: ["fixtureReason"] }),
          else: { not: { required: ["fixtureReason"] } },
        }),
      ],
    });
  });

  it.each([
    [
      "missing",
      undefined,
      true,
      "materializationStatus must be fixture-only or materializable",
    ],
    [
      "unknown",
      "preview-ready",
      true,
      "materializationStatus must be fixture-only or materializable",
    ],
    [
      "fixture reason missing",
      "fixture-only",
      false,
      "manifest.fixtureReason must be a non-empty string",
    ],
  ])(
    "rejects %s materialization posture in the validator",
    (_, status, includeReason, finding) => {
      const fixture = rewriteFixture(status, includeReason);

      expect(() =>
        validateCustomerReleaseManifest(fixture, shippedFiles),
      ).toThrow(finding);
    },
  );

  it("requires an externally resolved exact binding for materialization", () => {
    const fixtureOnly = validateCustomerReleaseManifest(
      rewriteFixture("fixture-only", true),
      shippedFiles,
    );
    const manifest = validateCustomerReleaseManifest(
      rewriteFixture("materializable", false),
      shippedFiles,
    );

    expect(() =>
      assertMaterializableCustomerReleaseManifest(fixtureOnly, {
        tag: fixtureOnly.release.tag,
        sourceCommit: fixtureOnly.release.sourceCommit,
        sourceChecksum: fixtureOnly.release.sourceChecksum,
      }),
    ).toThrow("Release manifest is fixture-only");
    expect(() =>
      assertMaterializableCustomerReleaseManifest(manifest, undefined),
    ).toThrow("externally resolved tag binding");
    expect(() =>
      assertMaterializableCustomerReleaseManifest(manifest, {
        tag: "maestro-template-v0.1.0-alpha.1-wrong",
        sourceCommit: manifest.release.sourceCommit,
        sourceChecksum: manifest.release.sourceChecksum,
      }),
    ).toThrow("does not match the release manifest");
    expect(() =>
      assertMaterializableCustomerReleaseManifest(manifest, {
        tag: manifest.release.tag,
        sourceCommit: manifest.release.sourceCommit,
        sourceChecksum: manifest.release.sourceChecksum,
      }),
    ).not.toThrow();
  });

  it("fails self-protection when a shipped path is unclassified", () => {
    expect(() =>
      validateCustomerReleaseManifest(readFixture(), {
        ...shippedFiles,
        "unknown/unclassified.ts": `sha256:${"0".repeat(64)}`,
      }),
    ).toThrowError(CustomerReleaseManifestError);
    expect(() =>
      validateCustomerReleaseManifest(readFixture(), {
        ...shippedFiles,
        "unknown/unclassified.ts": `sha256:${"0".repeat(64)}`,
      }),
    ).toThrow("Unclassified shipped path: unknown/unclassified.ts");
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
