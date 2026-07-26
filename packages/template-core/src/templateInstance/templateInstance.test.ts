import { describe, expect, it } from "vitest";
import {
  CURRENT_TEMPLATE_INSTANCE_VERSIONS,
  TEMPLATE_INSTANCE_COMPATIBILITY,
  TEMPLATE_INSTANCE_PROVENANCE,
  TEMPLATE_INSTANCE_SCHEMA_VERSION,
  resolveTemplateInstanceCompatibility,
  templateInstanceSchemaProvider,
} from "./index";

describe("templateInstance compatibility authority", () => {
  it("pins one exact current/prior compatibility set from the alpha releases", () => {
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
      },
      previous: {
        templateVersion: "0.1.0-alpha.1",
        templateTag: "maestro-template-v0.1.0-alpha.1",
        packRange: ">=0.1.0-alpha.1 <0.2.0",
        cliRange: ">=0.1.0-alpha.1 <0.2.0",
        supportState: "deprecated",
        deprecationDate: "2026-07-25",
      },
    });
    expect(templateInstanceSchemaProvider.provenance).toEqual(
      TEMPLATE_INSTANCE_PROVENANCE,
    );
  });

  it.each([
    {
      name: "compatible",
      input: {
        schemaVersion: 2,
        versions: CURRENT_TEMPLATE_INSTANCE_VERSIONS,
        release: {
          version: "0.2.0-alpha.1",
          tag: "maestro-template-v0.2.0-alpha.1",
        },
      },
      expected: {
        status: "compatible",
        code: "TEMPLATE_INSTANCE_COMPATIBLE",
        target: {
          schemaVersion: 2,
          templateVersion: "0.2.0-alpha.1",
          templateTag: "maestro-template-v0.2.0-alpha.1",
          compatibilitySet: 1,
        },
        safeToContinueReadOnly: true,
        recovery: {
          kind: "none",
          action: "Continue with the current tool and template release.",
        },
      },
    },
    {
      name: "migratable",
      input: {
        schemaVersion: 1,
        release: {
          version: "0.1.0-alpha.1",
          tag: "maestro-template-v0.1.0-alpha.1",
        },
      },
      expected: {
        status: "migratable",
        code: "TEMPLATE_INSTANCE_MIGRATION_AVAILABLE",
        target: {
          schemaVersion: 1,
          templateVersion: "0.1.0-alpha.1",
          templateTag: "maestro-template-v0.1.0-alpha.1",
          compatibilitySet: null,
        },
        safeToContinueReadOnly: true,
        recovery: {
          kind: "migrate",
          action:
            "Preview the generated template-instance migration, then upgrade from maestro-template-v0.1.0-alpha.1 to maestro-template-v0.2.0-alpha.1.",
        },
      },
    },
    {
      name: "older or skipped",
      input: {
        schemaVersion: 1,
        release: {
          version: "0.1.0-alpha.0",
          tag: "maestro-template-v0.1.0-alpha.0",
        },
      },
      expected: {
        status: "unsupported",
        code: "TEMPLATE_INSTANCE_UNSUPPORTED_RELEASE_GAP",
        target: {
          schemaVersion: 1,
          templateVersion: "0.1.0-alpha.0",
          templateTag: "maestro-template-v0.1.0-alpha.0",
          compatibilitySet: null,
        },
        safeToContinueReadOnly: true,
        recovery: {
          kind: "restore-supported-tag",
          action:
            "Restore or recreate the target at maestro-template-v0.1.0-alpha.1 before using this tool.",
        },
      },
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
      expected: {
        status: "newer",
        code: "TEMPLATE_INSTANCE_NEWER_THAN_TOOL",
        target: {
          schemaVersion: 3,
          templateVersion: "0.3.0-alpha.1",
          templateTag: "maestro-template-v0.3.0-alpha.1",
          compatibilitySet: 2,
        },
        safeToContinueReadOnly: true,
        recovery: {
          kind: "use-supported-tool",
          action:
            "Use the pack and CLI published for maestro-template-v0.3.0-alpha.1, or inspect read-only with this tool.",
        },
      },
    },
  ])("returns the stable $name golden packet", ({ input, expected }) => {
    expect(resolveTemplateInstanceCompatibility(input)).toEqual({
      ...expected,
      lastSupported: {
        packVersion: "0.1.0-alpha.1",
        cliVersion: "0.1.0-alpha.1",
        templateVersion: "0.2.0-alpha.1",
        templateTag: "maestro-template-v0.2.0-alpha.1",
      },
      provenance: TEMPLATE_INSTANCE_PROVENANCE,
    });
  });

  it("validates the canonical envelope without discarding extension fields", () => {
    const instance = templateInstanceSchemaProvider.parse({
      schemaVersion: 2,
      versions: CURRENT_TEMPLATE_INSTANCE_VERSIONS,
      release: {
        version: "0.2.0-alpha.1",
        tag: "maestro-template-v0.2.0-alpha.1",
      },
      compatibility: TEMPLATE_INSTANCE_COMPATIBILITY,
      support: {
        state: "supported",
        deprecationDate: null,
      },
      provenance: TEMPLATE_INSTANCE_PROVENANCE,
      personalization: { name: "Acme Ops" },
      customerExtension: { retained: true },
    });

    expect(instance.customerExtension).toEqual({ retained: true });
    expect(templateInstanceSchemaProvider.resolve(instance).status).toBe(
      "compatible",
    );
  });
});
