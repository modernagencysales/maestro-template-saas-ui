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

const legacyCompatibility = {
  cli: ">=0.1.0-alpha.1 <0.2.0",
  agentPack: ">=0.1.0-alpha.1 <0.2.0",
} as const;

const currentV1 = () => ({
  schemaVersion: 1,
  release: {
    version: "0.2.0-alpha.1",
    tag: "maestro-template-v0.2.0-alpha.1",
    sourceCommit: "customer-pinned-commit",
  },
  compatibility: { ...legacyCompatibility },
  ownership: {
    manifest: "releases/v0.2.0-alpha.1/manifest.json",
  },
  personalization: { name: "Customer App" },
});

const previousV1 = () => ({
  ...currentV1(),
  release: {
    version: "0.1.0-alpha.1",
    tag: "maestro-template-v0.1.0-alpha.1",
    sourceCommit: "customer-pinned-commit",
  },
  ownership: {
    manifest: "releases/v0.1.0-alpha.1/manifest.json",
  },
});

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
    expect(templateInstanceSchemaProvider.parse(result.instance)).toEqual(
      result.instance,
    );
  });

  it("migrates only a positively identified closed legacy V0 shape", () => {
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
      "x-customer": { deploymentRing: "private-preview" },
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
        "x-customer": legacy["x-customer"],
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

  it("preserves explicit extension seams through the exact V1 to V2 migration", () => {
    const input = {
      ...currentV1(),
      customerExtension: { retained: true },
      "x-acme": { deploymentRing: "private-preview" },
    };
    const result = migrateTemplateInstance(input);

    expect(result).toMatchObject({
      ok: true,
      fromSchemaVersion: 1,
      appliedMigrations: ["template-instance/1-to-2"],
      resolution: { status: "compatible" },
      instance: {
        customerExtension: input.customerExtension,
        "x-acme": input["x-acme"],
      },
    });
  });

  it("normalizes the previous fixture while keeping its path planned-unavailable", () => {
    const input = {
      ...previousV1(),
      "x-customer": { deploymentRing: "private-preview" },
    };
    const result = migrateTemplateInstance(input);

    expect(result).toMatchObject({
      ok: true,
      fromSchemaVersion: 1,
      appliedMigrations: ["template-instance/1-to-2"],
      resolution: {
        status: "migratable",
        code: "TEMPLATE_INSTANCE_MIGRATION_PLANNED_UNAVAILABLE",
        basis: { axis: "templateTag", reason: "planned-unavailable" },
      },
      instance: {
        release: previousV1().release,
        support: {
          state: "planned",
          deprecationDate: null,
          releaseAvailability: "unavailable",
          releaseEvidence: "fixture-only",
        },
        "x-customer": input["x-customer"],
      },
    });
  });

  it.each([
    { name: "empty object", input: {}, code: "TEMPLATE_INSTANCE_MALFORMED" },
    {
      name: "missing legacy identity",
      input: { name: "No identity", slug: "no-identity", providerMode: "fake" },
      code: "TEMPLATE_INSTANCE_MALFORMED",
    },
    {
      name: "open legacy V0 authority",
      input: {
        name: "Open legacy",
        slug: "open-legacy",
        providerMode: "fake",
        upgradeCompatibility: {
          templateVersion: "unreleased",
          status: "not-checked",
          inferredRange: "anything",
        },
      },
      code: "TEMPLATE_INSTANCE_MALFORMED",
    },
    {
      name: "fractional schema",
      input: { ...currentV1(), schemaVersion: 1.5 },
      code: "TEMPLATE_INSTANCE_MALFORMED",
    },
    {
      name: "NaN schema",
      input: { ...currentV1(), schemaVersion: Number.NaN },
      code: "TEMPLATE_INSTANCE_MALFORMED",
    },
    {
      name: "infinite schema",
      input: { ...currentV1(), schemaVersion: Number.POSITIVE_INFINITY },
      code: "TEMPLATE_INSTANCE_MALFORMED",
    },
    {
      name: "unknown negative schema",
      input: { ...currentV1(), schemaVersion: -1 },
      code: "TEMPLATE_INSTANCE_UNSUPPORTED_AXIS",
    },
    {
      name: "future schema",
      input: { ...currentV1(), schemaVersion: 3 },
      code: "TEMPLATE_INSTANCE_NEWER_THAN_TOOL",
    },
  ])("rejects $name without mutating its input", ({ input, code }) => {
    const before = structuredClone(input);
    const result = migrateTemplateInstance(input);

    expect(result).toMatchObject({
      ok: false,
      toSchemaVersion: 2,
      appliedMigrations: [],
      resolution: { code, safeToContinueReadOnly: true },
      original: input,
    });
    if (result.ok) throw new Error("expected migration to fail");
    expect(result.original).toBe(input);
    expect(input).toEqual(before);
  });

  it.each([
    {
      name: "unknown top-level field",
      input: { ...currentV1(), accidentalExtension: { retained: false } },
      axis: "identity",
    },
    {
      name: "unknown nested compatibility field",
      input: {
        ...currentV1(),
        compatibility: { ...legacyCompatibility, hiddenRange: "anything" },
      },
      axis: "agentPackRange",
    },
    {
      name: "mismatched agent pack range",
      input: {
        ...currentV1(),
        compatibility: {
          ...legacyCompatibility,
          agentPack: ">=0.1.0-alpha.2 <0.2.0",
        },
      },
      axis: "agentPackRange",
    },
  ])("rejects $name before V1 to V2 replacement", ({ input, axis }) => {
    const before = structuredClone(input);
    const result = migrateTemplateInstance(input);

    expect(result).toMatchObject({
      ok: false,
      appliedMigrations: [],
      resolution: {
        status: "unsupported",
        basis: { axis },
      },
      original: input,
    });
    expect(input).toEqual(before);
  });
});
