import { describe, expect, it } from "vitest";
import { buildTemplateInstance } from "./customer-runtime";
import {
  createTemplateInstanceMigration,
  type TemplateInstanceMigrationProvider,
} from "./templateInstanceMigration";

const templateCoreModulePath: string =
  "../../../packages/template-core/src/templateInstance/index";
const templateCore = (await import(templateCoreModulePath)) as unknown as {
  readonly CURRENT_TEMPLATE_INSTANCE_VERSIONS: Readonly<{
    pack: string;
    cli: string;
    template: string;
    workflowSchema: number;
    compatibilitySet: number;
  }>;
  readonly TEMPLATE_INSTANCE_PROVENANCE: Readonly<Record<string, unknown>>;
  readonly templateInstanceSchemaProvider: TemplateInstanceMigrationProvider;
};
const {
  CURRENT_TEMPLATE_INSTANCE_VERSIONS,
  TEMPLATE_INSTANCE_PROVENANCE,
  templateInstanceSchemaProvider,
} = templateCore;
const { migrateTemplateInstance, serializeTemplateInstanceMigration } =
  createTemplateInstanceMigration(templateInstanceSchemaProvider);

describe("templateInstance generator migration", () => {
  it("builds new instances from exactly the canonical schema authority", () => {
    const result = migrateTemplateInstance(
      buildTemplateInstance({
        name: "Canonical App",
        generatedAt: "2026-07-25T12:00:00.000Z",
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected migration to succeed");
    expect(result.instance.schemaVersion).toBe(
      templateInstanceSchemaProvider.schemaVersion,
    );
    expect(result.instance.versions).toEqual(
      CURRENT_TEMPLATE_INSTANCE_VERSIONS,
    );
    expect(result.instance.provenance).toEqual(TEMPLATE_INSTANCE_PROVENANCE);
    expect(templateInstanceSchemaProvider.parse(result.instance)).toBe(
      result.instance,
    );
  });

  it("migrates the unversioned generator shape deterministically", () => {
    const legacy = {
      name: "Customer Ops",
      slug: "customer-ops",
      providerMode: "fake",
      upgradeCompatibility: {
        templateVersion: "unreleased",
        status: "not-checked",
      },
      customerExtension: {
        owner: "customer",
        featureFlags: ["keep-me"],
      },
    };

    const first = migrateTemplateInstance(legacy);
    const second = migrateTemplateInstance(legacy);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      fromSchemaVersion: 0,
      toSchemaVersion: 2,
      appliedMigrations: [
        "template-instance/0-to-1",
        "template-instance/1-to-2",
      ],
      resolution: {
        status: "compatible",
        code: "TEMPLATE_INSTANCE_COMPATIBLE",
      },
      instance: {
        schemaVersion: 2,
        versions: CURRENT_TEMPLATE_INSTANCE_VERSIONS,
        provenance: TEMPLATE_INSTANCE_PROVENANCE,
        customerExtension: legacy.customerExtension,
      },
    });
    if (!first.ok) throw new Error("expected migration to succeed");
    if (!second.ok) throw new Error("expected migration to succeed");
    expect(serializeTemplateInstanceMigration(first)).toBe(
      serializeTemplateInstanceMigration(second),
    );
    expect(JSON.parse(serializeTemplateInstanceMigration(first))).toEqual(
      first.instance,
    );
  });

  it("migrates exactly the previous tagged release and retains extensions", () => {
    const result = migrateTemplateInstance({
      schemaVersion: 1,
      release: {
        version: "0.1.0-alpha.1",
        tag: "maestro-template-v0.1.0-alpha.1",
        sourceCommit: "customer-pinned-commit",
      },
      compatibility: {
        cli: ">=0.1.0-alpha.1 <0.2.0",
        agentPack: ">=0.1.0-alpha.1 <0.2.0",
      },
      ownership: {
        manifest: "releases/v0.1.0-alpha.1/manifest.json",
      },
      "x-customer": {
        deploymentRing: "private-preview",
      },
    });

    expect(result).toMatchObject({
      ok: true,
      fromSchemaVersion: 1,
      appliedMigrations: ["template-instance/1-to-2"],
      instance: {
        release: {
          version: "0.1.0-alpha.1",
          tag: "maestro-template-v0.1.0-alpha.1",
          sourceCommit: "customer-pinned-commit",
        },
        support: {
          state: "deprecated",
          deprecationDate: "2026-07-25",
        },
        "x-customer": {
          deploymentRing: "private-preview",
        },
      },
    });
  });

  it.each([
    {
      name: "older or skipped",
      input: {
        schemaVersion: 1,
        release: {
          version: "0.1.0-alpha.0",
          tag: "maestro-template-v0.1.0-alpha.0",
        },
      },
      status: "unsupported",
      code: "TEMPLATE_INSTANCE_UNSUPPORTED_RELEASE_GAP",
    },
    {
      name: "newer",
      input: {
        schemaVersion: 3,
        versions: {
          ...CURRENT_TEMPLATE_INSTANCE_VERSIONS,
          template: "0.3.0-alpha.1",
          compatibilitySet: 2,
        },
        release: {
          version: "0.3.0-alpha.1",
          tag: "maestro-template-v0.3.0-alpha.1",
        },
      },
      status: "newer",
      code: "TEMPLATE_INSTANCE_NEWER_THAN_TOOL",
    },
  ])("refuses the $name path without composing migrations", (fixture) => {
    expect(migrateTemplateInstance(fixture.input)).toMatchObject({
      ok: false,
      fromSchemaVersion: fixture.input.schemaVersion,
      toSchemaVersion: 2,
      appliedMigrations: [],
      resolution: {
        status: fixture.status,
        code: fixture.code,
        safeToContinueReadOnly: true,
      },
      original: fixture.input,
    });
  });
});
