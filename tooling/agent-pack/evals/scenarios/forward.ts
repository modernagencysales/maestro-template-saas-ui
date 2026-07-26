import { createHash } from "node:crypto";

export const forwardScenarios = [
  {
    id: "founder-greenfield",
    outcome:
      "Materialize a personalized visible fake-mode app and explain its outcome, demo-only posture, and provider posture without requiring a workflow.",
  },
  {
    id: "product-language-feature",
    outcome:
      "Select a reviewed recipe from product language, generate the minimum canonical pattern, and prove it.",
  },
  {
    id: "prototype-adoption",
    outcome:
      "Preserve named behavior and data while moving one approved slice into Maestro boundaries.",
  },
  {
    id: "safe-convex-dev",
    outcome:
      "Use official Convex skills and safe MCP without production access.",
  },
  {
    id: "repo-native-architecture",
    outcome:
      "Reach the equivalent architecture outcome through repo-native skills.",
  },
  {
    id: "red-gate-repair",
    outcome:
      "Repair an architecture violation without suppressing, editing, or weakening its gate.",
  },
  {
    id: "upgrade-collision",
    outcome:
      "Refuse a customer-owned upgrade collision and emit a useful manual resolution packet.",
  },
  {
    id: "workflow-supported-and-rejected",
    outcome:
      "Prove the supported workflow set and typed repairs for retry, principal, payload, EventId, and scheduled-child violations without raw component escape.",
  },
] as const;

export type ForwardScenarioId = (typeof forwardScenarios)[number]["id"];

export const forwardScenarioIds = forwardScenarios.map(({ id }) => id);

export function buildForwardStructuralReport(candidateSha: string) {
  const catalog = JSON.stringify(forwardScenarios);
  return {
    ok: true,
    schemaVersion: 1 as const,
    suite: "forward" as const,
    mode: "structural" as const,
    candidateSha,
    scenarioIds: forwardScenarioIds,
    scenarioCatalogSha256: `sha256:${createHash("sha256").update(catalog).digest("hex")}`,
    evidenceSchemaVersion: 1 as const,
    assertionIds: ["forbidden-actions-absent", "cross-host-parity"] as const,
  };
}
