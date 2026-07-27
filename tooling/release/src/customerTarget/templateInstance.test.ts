import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ReleaseTemplateInstanceCompatibilityError,
  createReleaseTemplateInstanceConsumer,
  type ReleaseTemplateInstanceMigration,
  type ReleaseTemplateInstanceSchemaProvider,
} from "./templateInstance";

const templateCoreModulePath: string =
  "../../../../packages/template-core/src/templateInstance/index";
const generatorMigrationModulePath: string =
  "../../../generators/src/templateInstanceMigration";

const templateCore = (await import(templateCoreModulePath)) as unknown as {
  readonly templateInstanceSchemaProvider: ReleaseTemplateInstanceSchemaProvider;
};
const generatorMigration = (await import(
  generatorMigrationModulePath
)) as unknown as {
  readonly createTemplateInstanceMigration: (
    provider: ReleaseTemplateInstanceSchemaProvider,
  ) => ReleaseTemplateInstanceMigration;
};

const migration = generatorMigration.createTemplateInstanceMigration(
  templateCore.templateInstanceSchemaProvider,
);
const consumer = createReleaseTemplateInstanceConsumer(
  templateCore.templateInstanceSchemaProvider,
  migration,
);

const digest = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const digestBytes = (bytes: Buffer): string =>
  createHash("sha256").update(bytes).digest("hex");

describe("release templateInstance consumer", () => {
  it("normalizes the CP-5 current release instance through the canonical schema", () => {
    const serialized = consumer.prepare(
      JSON.stringify({
        schemaVersion: 1,
        release: {
          version: "0.2.0-alpha.1",
          tag: "maestro-template-v0.2.0-alpha.1",
          sourceCommit: "10516dfc7470d9cfa68b250550576298f76042f4",
          sourceChecksum:
            "sha256:56bdac01542086dd4d284f7e24ed272e5cec5870b46a47f351f113271dd8de69",
        },
        compatibility: {
          cli: ">=0.1.0-alpha.1 <0.2.0",
          agentPack: ">=0.1.0-alpha.1 <0.2.0",
        },
        personalization: { name: "Customer App" },
        "x-customer": { retained: true },
      }),
    );
    const instance =
      templateCore.templateInstanceSchemaProvider.parseText(serialized);

    expect(instance).toMatchObject({
      schemaVersion: 2,
      versions: {
        pack: "0.1.0-alpha.1",
        cli: "0.1.0-alpha.1",
        template: "0.2.0-alpha.1",
        workflowSchema: 2,
        compatibilitySet: 1,
      },
      support: { state: "supported", deprecationDate: null },
      provenance: {
        owner: "@maestro-template/template-core/templateInstance",
        schemaVersion: 2,
        compatibilitySet: 1,
      },
      "x-customer": { retained: true },
    });
  });

  it("rejects the planned-unavailable previous fixture path truthfully", () => {
    try {
      consumer.prepare(
        JSON.stringify({
          schemaVersion: 1,
          release: {
            version: "0.1.0-alpha.1",
            tag: "maestro-template-v0.1.0-alpha.1",
          },
          compatibility: {
            cli: ">=0.1.0-alpha.1 <0.2.0",
            agentPack: ">=0.1.0-alpha.1 <0.2.0",
          },
          ownership: {
            manifest: "releases/v0.1.0-alpha.1/manifest.json",
          },
        }),
      );
      throw new Error("expected previous fixture path to be unavailable");
    } catch (error) {
      expect(error).toBeInstanceOf(ReleaseTemplateInstanceCompatibilityError);
      expect(
        (error as ReleaseTemplateInstanceCompatibilityError).resolution,
      ).toMatchObject({
        status: "migratable",
        code: "TEMPLATE_INSTANCE_MIGRATION_PLANNED_UNAVAILABLE",
        basis: { axis: "templateTag", reason: "planned-unavailable" },
        recovery: { kind: "migration-planned" },
      });
      expect((error as Error).message).not.toMatch(/restore|previous tag/i);
    }
  });

  it("returns the stable resolution packet instead of composing skipped upgrades", () => {
    expect(() =>
      consumer.prepare(
        JSON.stringify({
          schemaVersion: 1,
          release: {
            version: "0.1.0-alpha.0",
            tag: "maestro-template-v0.1.0-alpha.0",
          },
          compatibility: {
            cli: ">=0.1.0-alpha.1 <0.2.0",
            agentPack: ">=0.1.0-alpha.1 <0.2.0",
          },
          ownership: { manifest: "unpublished-fixture" },
        }),
      ),
    ).toThrow(ReleaseTemplateInstanceCompatibilityError);

    try {
      consumer.prepare(
        JSON.stringify({
          schemaVersion: 1,
          release: {
            version: "0.1.0-alpha.0",
            tag: "maestro-template-v0.1.0-alpha.0",
          },
          compatibility: {
            cli: ">=0.1.0-alpha.1 <0.2.0",
            agentPack: ">=0.1.0-alpha.1 <0.2.0",
          },
          ownership: { manifest: "unpublished-fixture" },
        }),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ReleaseTemplateInstanceCompatibilityError);
      expect(
        (error as ReleaseTemplateInstanceCompatibilityError).resolution,
      ).toMatchObject({
        status: "unsupported",
        code: "TEMPLATE_INSTANCE_UNSUPPORTED_RELEASE_GAP",
        safeToContinueReadOnly: true,
        recovery: {
          kind: "inspect-only",
        },
      });
    }
  });

  it.each([
    ["{}", "TEMPLATE_INSTANCE_MALFORMED"],
    [
      JSON.stringify({
        schemaVersion: 1.5,
        release: {
          version: "0.2.0-alpha.1",
          tag: "maestro-template-v0.2.0-alpha.1",
        },
      }),
      "TEMPLATE_INSTANCE_MALFORMED",
    ],
  ])(
    "rejects malformed migration input without changing the source bytes",
    (raw, code) => {
      const original = raw;
      expect(() => consumer.prepare(raw)).toThrow(
        ReleaseTemplateInstanceCompatibilityError,
      );
      try {
        consumer.prepare(raw);
      } catch (error) {
        expect(
          (error as ReleaseTemplateInstanceCompatibilityError).resolution.code,
        ).toBe(code);
      }
      expect(raw).toBe(original);
    },
  );

  it("keeps released manifests immutable without freezing an unreleased seal", () => {
    const repositoryRoot = resolve(import.meta.dirname, "../../../..");
    expect(
      digest(resolve(repositoryRoot, "releases/v0.1.0-alpha.1/manifest.json")),
    ).toBe("0b55fd0895ecbcf6743860551ed52f165b4252c17ea94ad1687163a8ce6c6b93");
    const tag = "maestro-template-v0.2.0-alpha.1";
    const manifestPath = "releases/v0.2.0-alpha.1/manifest.json";
    let taggedManifest: Buffer | undefined;
    try {
      taggedManifest = execFileSync(
        "git",
        ["-C", repositoryRoot, "show", `${tag}:${manifestPath}`],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch {
      // The alpha remains resealable until its immutable release tag exists.
    }
    if (taggedManifest) {
      expect(digest(resolve(repositoryRoot, manifestPath))).toBe(
        digestBytes(taggedManifest),
      );
    } else {
      const manifest = JSON.parse(
        readFileSync(resolve(repositoryRoot, manifestPath), "utf8"),
      ) as { readonly release: { readonly tag: string } };
      expect(manifest.release.tag).toBe(tag);
    }
  });
});
