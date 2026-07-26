import { describe, expect, it } from "vitest";
import {
  CURRENT_TEMPLATE_INSTANCE_VERSIONS,
  TEMPLATE_INSTANCE_COMPATIBILITY,
  TEMPLATE_INSTANCE_EXTENSION_CONTRACT,
  TEMPLATE_INSTANCE_PROVENANCE,
  TEMPLATE_INSTANCE_SCHEMA_VERSION,
  resolveTemplateInstanceCompatibility,
  templateInstanceSchemaProvider,
  type TemplateInstanceCompatibilityInput,
} from "./index";

const currentRelease = {
  version: "0.2.0-alpha.1",
  tag: "maestro-template-v0.2.0-alpha.1",
} as const;

const previousRelease = {
  version: "0.1.0-alpha.1",
  tag: "maestro-template-v0.1.0-alpha.1",
} as const;

const currentSupport = {
  state: "supported",
  deprecationDate: null,
  releaseAvailability: "unavailable",
  releaseEvidence: "workspace-only",
} as const;

const currentInstance = () => ({
  schemaVersion: 2,
  versions: { ...CURRENT_TEMPLATE_INSTANCE_VERSIONS },
  release: { ...currentRelease },
  compatibility: structuredClone(TEMPLATE_INSTANCE_COMPATIBILITY),
  support: { ...currentSupport },
  provenance: { ...TEMPLATE_INSTANCE_PROVENANCE },
});

const legacyOne = (
  release: { readonly version: string; readonly tag: string } = currentRelease,
) => ({
  schemaVersion: 1,
  release: { ...release },
  compatibility: {
    cli: ">=0.1.0-alpha.1 <0.2.0",
    agentPack: ">=0.1.0-alpha.1 <0.2.0",
  },
  ownership: { manifest: `releases/v${release.version}/manifest.json` },
  personalization: { name: "Acme Ops" },
});

const decision = (input: TemplateInstanceCompatibilityInput) => {
  const resolution = resolveTemplateInstanceCompatibility(input);
  return {
    status: resolution.status,
    code: resolution.code,
    basis: resolution.basis,
    recovery: resolution.recovery,
  };
};

describe("templateInstance compatibility authority", () => {
  it("pins exact current and planned-unavailable previous evidence", () => {
    expect(TEMPLATE_INSTANCE_SCHEMA_VERSION).toBe(2);
    expect(CURRENT_TEMPLATE_INSTANCE_VERSIONS).toEqual({
      pack: "0.1.0-alpha.1",
      cli: "0.1.0-alpha.1",
      template: "0.2.0-alpha.1",
      workflowSchema: 2,
      compatibilitySet: 1,
    });
    expect(TEMPLATE_INSTANCE_COMPATIBILITY).toEqual({
      current: {
        templateVersion: "0.2.0-alpha.1",
        templateTag: "maestro-template-v0.2.0-alpha.1",
        packRange: ">=0.1.0-alpha.1 <0.2.0",
        cliRange: ">=0.1.0-alpha.1 <0.2.0",
        supportState: "supported",
        deprecationDate: null,
        releaseAvailability: "unavailable",
        releaseEvidence: "workspace-only",
      },
      previous: {
        templateVersion: "0.1.0-alpha.1",
        templateTag: "maestro-template-v0.1.0-alpha.1",
        packRange: ">=0.1.0-alpha.1 <0.2.0",
        cliRange: ">=0.1.0-alpha.1 <0.2.0",
        supportState: "planned",
        deprecationDate: null,
        releaseAvailability: "unavailable",
        releaseEvidence: "fixture-only",
      },
    });
    expect(TEMPLATE_INSTANCE_EXTENSION_CONTRACT).toEqual({
      topLevel: [
        "blueprint",
        "customerExtension",
        "personalization",
        "ownership",
      ],
      namespacePrefix: "x-",
      legacyV0Projection: [
        "name",
        "slug",
        "packageScope",
        "workspaceName",
        "blueprint",
        "providerMode",
        "environments",
        "deploymentTargets",
        "modules",
        "requiredSecretNames",
        "redactionStatus",
        "sourcePosture",
        "providers",
        "releaseState",
        "upgradeCompatibility",
        "privatePackages",
        "intake",
        "generatedAt",
      ],
    });
  });

  it("returns the exact current compatible golden packet", () => {
    expect(resolveTemplateInstanceCompatibility(currentInstance())).toEqual({
      status: "compatible",
      code: "TEMPLATE_INSTANCE_COMPATIBLE",
      basis: { axis: "none", reason: "exact-match" },
      target: {
        schemaVersion: 2,
        packVersion: "0.1.0-alpha.1",
        cliVersion: "0.1.0-alpha.1",
        templateVersion: "0.2.0-alpha.1",
        templateTag: "maestro-template-v0.2.0-alpha.1",
        workflowSchema: 2,
        compatibilitySet: 1,
        agentPackRange: ">=0.1.0-alpha.1 <0.2.0",
        cliRange: ">=0.1.0-alpha.1 <0.2.0",
        supportState: "supported",
        releaseAvailability: "unavailable",
      },
      safeToContinueReadOnly: true,
      lastSupported: {
        packVersion: "0.1.0-alpha.1",
        cliVersion: "0.1.0-alpha.1",
        templateVersion: "0.2.0-alpha.1",
        templateTag: "maestro-template-v0.2.0-alpha.1",
        releaseAvailability: "unavailable",
      },
      recovery: {
        kind: "none",
        action: "Continue with the current tool and exact template instance.",
      },
      provenance: TEMPLATE_INSTANCE_PROVENANCE,
    });
  });

  it("returns the exact current V1 migration golden packet", () => {
    expect(resolveTemplateInstanceCompatibility(legacyOne())).toMatchObject({
      status: "migratable",
      code: "TEMPLATE_INSTANCE_MIGRATION_AVAILABLE",
      basis: { axis: "schemaVersion", reason: "migration-available" },
      recovery: {
        kind: "migrate",
        action:
          "Preview the pure template-instance schema migration; upgrade apply remains separately deferred.",
      },
    });
  });

  it("models the previous V1 path as planned and unavailable", () => {
    expect(
      resolveTemplateInstanceCompatibility(legacyOne(previousRelease)),
    ).toMatchObject({
      status: "migratable",
      code: "TEMPLATE_INSTANCE_MIGRATION_PLANNED_UNAVAILABLE",
      basis: { axis: "templateTag", reason: "planned-unavailable" },
      recovery: {
        kind: "migration-planned",
        action:
          "Preserve the target unchanged and inspect read-only; the previous-release path is planned but unavailable until a real Git tag is published and bound.",
      },
    });
  });

  it("does not describe an unknown release as a restorable tagged path", () => {
    const resolution = resolveTemplateInstanceCompatibility({
      ...legacyOne(),
      release: {
        version: "0.1.0-alpha.0",
        tag: "maestro-template-v0.1.0-alpha.0",
      },
    });

    expect(resolution).toMatchObject({
      status: "unsupported",
      code: "TEMPLATE_INSTANCE_UNSUPPORTED_RELEASE_GAP",
      basis: { axis: "templateTag", reason: "mismatch" },
      recovery: {
        kind: "inspect-only",
        action:
          "Preserve the target unchanged and inspect read-only; no published recovery tag is available.",
      },
    });
    expect(resolution.recovery.action).not.toMatch(/restore|previous tag/i);
  });

  it("returns the exact newer-schema golden decision", () => {
    expect(
      decision({
        ...currentInstance(),
        schemaVersion: 3,
      }),
    ).toEqual({
      status: "newer",
      code: "TEMPLATE_INSTANCE_NEWER_THAN_TOOL",
      basis: { axis: "schemaVersion", reason: "newer" },
      recovery: {
        kind: "use-supported-tool",
        action:
          "Use a tool that explicitly supports the target's declared axes, or inspect read-only with this tool.",
      },
    });
  });

  it.each([
    {
      axis: "schemaVersion",
      input: { ...currentInstance(), schemaVersion: 1.5 },
      expected: {
        status: "unsupported",
        code: "TEMPLATE_INSTANCE_MALFORMED",
        basis: { axis: "schemaVersion", reason: "malformed" },
      },
    },
    {
      axis: "templateTag",
      input: {
        ...currentInstance(),
        release: { ...currentRelease, tag: "maestro-template-v0.2.0-alpha.2" },
      },
      expected: {
        status: "unsupported",
        code: "TEMPLATE_INSTANCE_UNSUPPORTED_RELEASE_GAP",
        basis: { axis: "templateTag", reason: "mismatch" },
      },
    },
    {
      axis: "compatibilitySet",
      input: {
        ...currentInstance(),
        versions: {
          ...CURRENT_TEMPLATE_INSTANCE_VERSIONS,
          compatibilitySet: 2,
        },
      },
      expected: {
        status: "newer",
        code: "TEMPLATE_INSTANCE_NEWER_THAN_TOOL",
        basis: { axis: "compatibilitySet", reason: "newer" },
      },
    },
    {
      axis: "pack",
      input: {
        ...currentInstance(),
        versions: {
          ...CURRENT_TEMPLATE_INSTANCE_VERSIONS,
          pack: "0.1.0-alpha.2",
        },
      },
      expected: {
        status: "unsupported",
        code: "TEMPLATE_INSTANCE_UNSUPPORTED_AXIS",
        basis: { axis: "pack", reason: "mismatch" },
      },
    },
    {
      axis: "cli",
      input: {
        ...currentInstance(),
        versions: {
          ...CURRENT_TEMPLATE_INSTANCE_VERSIONS,
          cli: "0.1.0-alpha.2",
        },
      },
      expected: {
        status: "unsupported",
        code: "TEMPLATE_INSTANCE_UNSUPPORTED_AXIS",
        basis: { axis: "cli", reason: "mismatch" },
      },
    },
    {
      axis: "template",
      input: {
        ...currentInstance(),
        versions: {
          ...CURRENT_TEMPLATE_INSTANCE_VERSIONS,
          template: "0.2.0-alpha.2",
        },
      },
      expected: {
        status: "unsupported",
        code: "TEMPLATE_INSTANCE_UNSUPPORTED_AXIS",
        basis: { axis: "template", reason: "mismatch" },
      },
    },
    {
      axis: "workflowSchema",
      input: {
        ...currentInstance(),
        versions: { ...CURRENT_TEMPLATE_INSTANCE_VERSIONS, workflowSchema: 3 },
      },
      expected: {
        status: "newer",
        code: "TEMPLATE_INSTANCE_NEWER_THAN_TOOL",
        basis: { axis: "workflowSchema", reason: "newer" },
      },
    },
    {
      axis: "agentPackRange",
      input: {
        ...legacyOne(),
        compatibility: {
          cli: ">=0.1.0-alpha.1 <0.2.0",
          agentPack: ">=0.1.0-alpha.2 <0.2.0",
        },
      },
      expected: {
        status: "unsupported",
        code: "TEMPLATE_INSTANCE_UNSUPPORTED_AXIS",
        basis: { axis: "agentPackRange", reason: "mismatch" },
      },
    },
    {
      axis: "cliRange",
      input: {
        ...legacyOne(),
        compatibility: {
          cli: ">=0.1.0-alpha.2 <0.2.0",
          agentPack: ">=0.1.0-alpha.1 <0.2.0",
        },
      },
      expected: {
        status: "unsupported",
        code: "TEMPLATE_INSTANCE_UNSUPPORTED_AXIS",
        basis: { axis: "cliRange", reason: "mismatch" },
      },
    },
    {
      axis: "hostRange",
      input: {
        ...currentInstance(),
        compatibility: {
          ...TEMPLATE_INSTANCE_COMPATIBILITY,
          current: {
            ...TEMPLATE_INSTANCE_COMPATIBILITY.current,
            packRange: ">=0.1.0-alpha.2 <0.2.0",
          },
        },
      },
      expected: {
        status: "unsupported",
        code: "TEMPLATE_INSTANCE_UNSUPPORTED_AXIS",
        basis: { axis: "agentPackRange", reason: "mismatch" },
      },
    },
    {
      axis: "support",
      input: {
        ...currentInstance(),
        support: { ...currentSupport, state: "planned" },
      },
      expected: {
        status: "unsupported",
        code: "TEMPLATE_INSTANCE_UNSUPPORTED_AXIS",
        basis: { axis: "support", reason: "mismatch" },
      },
    },
    {
      axis: "provenance",
      input: {
        ...currentInstance(),
        provenance: { ...TEMPLATE_INSTANCE_PROVENANCE, schemaVersion: 1 },
      },
      expected: {
        status: "unsupported",
        code: "TEMPLATE_INSTANCE_UNSUPPORTED_AXIS",
        basis: { axis: "provenance", reason: "mismatch" },
      },
    },
  ])("returns the exact $axis mismatch golden", ({ input, expected }) => {
    expect(decision(input)).toEqual({
      ...expected,
      recovery:
        expected.status === "newer"
          ? {
              kind: "use-supported-tool",
              action:
                "Use a tool that explicitly supports the target's declared axes, or inspect read-only with this tool.",
            }
          : {
              kind: "inspect-only",
              action:
                "Preserve the target unchanged and inspect read-only; no published recovery tag is available.",
            },
    });
  });

  it("gives newer numeric axes precedence over ordinary combined mismatches", () => {
    expect(
      decision({
        ...currentInstance(),
        versions: {
          ...CURRENT_TEMPLATE_INSTANCE_VERSIONS,
          pack: "unknown-pack",
          workflowSchema: 3,
        },
      }),
    ).toEqual({
      status: "newer",
      code: "TEMPLATE_INSTANCE_NEWER_THAN_TOOL",
      basis: { axis: "workflowSchema", reason: "newer" },
      recovery: {
        kind: "use-supported-tool",
        action:
          "Use a tool that explicitly supports the target's declared axes, or inspect read-only with this tool.",
      },
    });
  });

  it("accepts authority objects regardless of key insertion order", () => {
    const reordered = {
      provenance: {
        compatibilitySet: 1,
        owner: "@maestro-template/template-core/templateInstance",
        schemaVersion: 2,
      },
      support: {
        releaseEvidence: "workspace-only",
        releaseAvailability: "unavailable",
        deprecationDate: null,
        state: "supported",
      },
      compatibility: {
        previous: {
          releaseEvidence: "fixture-only",
          releaseAvailability: "unavailable",
          deprecationDate: null,
          supportState: "planned",
          cliRange: ">=0.1.0-alpha.1 <0.2.0",
          packRange: ">=0.1.0-alpha.1 <0.2.0",
          templateTag: "maestro-template-v0.1.0-alpha.1",
          templateVersion: "0.1.0-alpha.1",
        },
        current: {
          releaseEvidence: "workspace-only",
          releaseAvailability: "unavailable",
          deprecationDate: null,
          supportState: "supported",
          cliRange: ">=0.1.0-alpha.1 <0.2.0",
          packRange: ">=0.1.0-alpha.1 <0.2.0",
          templateTag: "maestro-template-v0.2.0-alpha.1",
          templateVersion: "0.2.0-alpha.1",
        },
      },
      release: { tag: currentRelease.tag, version: currentRelease.version },
      versions: {
        compatibilitySet: 1,
        workflowSchema: 2,
        template: "0.2.0-alpha.1",
        cli: "0.1.0-alpha.1",
        pack: "0.1.0-alpha.1",
      },
      schemaVersion: 2,
      "x-customer": { z: true, a: true },
    };

    const canonical = templateInstanceSchemaProvider.parse(currentInstance());
    const parsed = templateInstanceSchemaProvider.parse(reordered);
    expect(parsed).toMatchObject({ "x-customer": { a: true, z: true } });
    expect(templateInstanceSchemaProvider.resolve(parsed).status).toBe(
      "compatible",
    );
    expect(templateInstanceSchemaProvider.serialize(parsed)).toBe(
      templateInstanceSchemaProvider.serialize({
        ...canonical,
        "x-customer": { a: true, z: true },
      }),
    );
  });

  it("preserves only explicit top-level and namespaced extension seams", () => {
    const parsed = templateInstanceSchemaProvider.parse({
      ...currentInstance(),
      personalization: { name: "Acme Ops" },
      customerExtension: { retained: true },
      "x-acme": { deploymentRing: "private-preview" },
    });

    expect(parsed).toMatchObject({
      personalization: { name: "Acme Ops" },
      customerExtension: { retained: true },
      "x-acme": { deploymentRing: "private-preview" },
    });
    expect(() =>
      templateInstanceSchemaProvider.parse({
        ...currentInstance(),
        accidentalExtension: { retained: false },
      }),
    ).toThrow(/unsupported top-level field accidentalExtension/);
  });

  it.each([
    ["versions", { extraAxis: true }],
    ["compatibility", { extraAxis: true }],
    ["support", { extraAxis: true }],
    ["provenance", { extraAxis: true }],
  ] as const)("rejects unknown nested %s authority fields", (field, extra) => {
    const input = currentInstance();
    const authority = input[field];
    expect(() =>
      templateInstanceSchemaProvider.parse({
        ...input,
        [field]: { ...authority, ...extra },
      }),
    ).toThrow(new RegExp(`${field} has unknown field extraAxis`));
  });
});
