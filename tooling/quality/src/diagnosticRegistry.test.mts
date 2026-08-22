import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
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

  it("provides complete diagnostic metadata without copied command bodies", async () => {
    const packageJson = JSON.parse(
      await readFile(
        fileURLToPath(new URL("../../../package.json", import.meta.url)),
        "utf8",
      ),
    ) as { readonly scripts: Readonly<Record<string, unknown>> };

    for (const [gateId, descriptor] of Object.entries(checkDescriptors)) {
      expect(descriptor).toMatchObject({
        gateId,
        argv: ["pnpm", descriptor.name.split(" ")[0]],
        rerun: ["pnpm", descriptor.name.split(" ")[0]],
      });
      expect(descriptor).not.toHaveProperty("canonicalScriptBody");
      const [, script] = descriptor.argv;
      expect(packageJson.scripts[script ?? ""]).toEqual(expect.any(String));
      expect((packageJson.scripts[script ?? ""] as string).trim()).not.toBe("");
      expect(descriptor.canonicalDoc).toMatch(/^docs\/.+\.md$/);
      expect(descriptor.repairHint).not.toMatch(
        /(?:disable|skip|bypass|weaken).{0,24}(?:gate|check|test)/i,
      );
      expect(descriptor.focusedPathPrefixes).toEqual(
        expect.arrayContaining(descriptor.requirements.map(({ file }) => file)),
      );
    }

    expect(
      diagnosticRegistryDescriptors.every((descriptor) =>
        Object.keys(descriptor).every((key) =>
          [
            "gateId",
            "posture",
            "evidenceClass",
            "canonicalDoc",
            "repairHint",
            "argv",
            "rerun",
            "focusedPathPrefixes",
            "defaultFocused",
            "prerequisiteCheck",
            "semanticRuleIds",
          ].includes(key),
        ),
      ),
    ).toBe(true);
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
      "product-contract",
    ]);
    const required = diagnosticRegistryDescriptors.filter(
      ({ posture }) => posture === "required",
    );
    expect(
      required.find(({ gateId }) => gateId === "product-contract"),
    ).toMatchObject({ evidenceClass: "static" });
    expect(
      required.find(({ gateId }) => gateId === "acceptance-required"),
    ).toMatchObject({ evidenceClass: "runtime" });
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
        "bash tooling/ci/install-gitleaks.sh",
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
