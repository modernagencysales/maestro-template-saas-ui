import { describe, expect, it } from "vitest";
import { defineDiagnosticRegistryProjection } from "../../agent-pack/src/diagnostics.js";
import { checkDescriptors } from "./check-definitions.mts";
import {
  defineQualityDiagnosticRegistryProjection,
  diagnosticRegistryDescriptors,
} from "./diagnosticRegistry.mts";

describe("quality diagnostic registry", () => {
  it("projects the authoritative check descriptor membership one-to-one", () => {
    const gateIds = Object.keys(checkDescriptors);
    expect(diagnosticRegistryDescriptors.map(({ gateId }) => gateId)).toEqual(
      gateIds,
    );
    expect(new Set(gateIds).size).toBe(gateIds.length);
  });

  it("provides complete, exact metadata for every registered check", () => {
    for (const [gateId, descriptor] of Object.entries(checkDescriptors)) {
      expect(descriptor).toMatchObject({
        gateId,
        argv: ["pnpm", descriptor.name.split(" ")[0]],
        rerun: ["pnpm", descriptor.name.split(" ")[0]],
        canonicalScriptBody: expect.any(String),
      });
      expect(descriptor.canonicalScriptBody.trim()).not.toBe("");
      expect(descriptor.canonicalDoc).toMatch(/^docs\/.+\.md$/);
      expect(descriptor.repairHint).not.toMatch(
        /(?:disable|skip|bypass|weaken).{0,24}(?:gate|check|test)/i,
      );
      expect(descriptor.focusedPathPrefixes).toEqual(
        expect.arrayContaining(descriptor.requirements.map(({ file }) => file)),
      );
    }
  });

  it("classifies each gate by the evidence its invoked command proves", () => {
    const advisory = diagnosticRegistryDescriptors.filter(
      ({ posture }) => posture === "advisory",
    );
    expect(advisory.map(({ gateId }) => gateId)).toEqual([
      "taste",
      "contract-review",
    ]);
    expect(
      advisory.every(({ evidenceClass }) => evidenceClass === "advisory"),
    ).toBe(true);
    expect(
      diagnosticRegistryDescriptors
        .filter(({ evidenceClass }) => evidenceClass === "static")
        .map(({ gateId }) => gateId),
    ).toEqual([
      "ci-completeness",
      "config-drift",
      "deps",
      "knip",
      "route-tree",
      "types-coverage",
      "gates",
      "debt",
      "generators",
      "docs-freshness",
      "generated-files",
      "confect-contracts",
      "confect-compat",
      "schema-migration-notes",
      "layer-boundaries",
      "secret-canaries",
      "sbom-license",
      "headless-surface-contract",
      "posthog-readiness",
      "auth-demo-bypass",
      "workflow-graph-boundary",
      "append-only-tables",
      "app-map",
      "workflow-semantics",
      "recipes",
    ]);
    expect(
      diagnosticRegistryDescriptors
        .filter(({ posture }) => posture === "required")
        .every(({ evidenceClass }) => evidenceClass === "static"),
    ).toBe(true);
  });

  it("publishes a canonical non-empty default focused gate set", () => {
    expect(
      diagnosticRegistryDescriptors
        .filter(({ defaultFocused }) => defaultFocused === true)
        .map(({ gateId }) => gateId),
    ).toEqual([
      "gates",
      "secret-canaries",
      "headless-surface-contract",
      "append-only-tables",
      "workflow-semantics",
    ]);
  });

  it("publishes the real secret scanner prerequisite on its canonical gate", () => {
    expect(
      diagnosticRegistryDescriptors.find(
        ({ gateId }) => gateId === "secret-canaries",
      ),
    ).toMatchObject({
      prerequisiteCheck: ["gitleaks", "version"],
      repairHint: expect.stringContaining(
        "bash .buildkite/scripts/install-gitleaks.sh",
      ),
    });
  });

  it("passes the projection through the real Agent Pack registry contract", () => {
    const projected = defineQualityDiagnosticRegistryProjection(
      defineDiagnosticRegistryProjection,
    );
    expect(projected).toHaveLength(Object.keys(checkDescriptors).length);
    expect(
      projected.find(({ gateId }) => gateId === "workflow-semantics"),
    ).toMatchObject({
      canonicalDoc: "docs/template/generated/workflow-semantics.md",
      semanticRuleIds: [
        "WF-CONTRACT",
        "WF-DOC-PROJECTION",
        "WF-GRAPH-STALE",
        "WF-GRAPH-UNMAPPED",
      ],
    });
  });
});
