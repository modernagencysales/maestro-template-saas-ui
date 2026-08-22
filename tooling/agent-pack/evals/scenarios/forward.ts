import { createHash } from "node:crypto";

export const forwardScenarios = [
  {
    id: "greenfield-tagged-customer",
    outcome:
      "Build a greenfield generic app to a visible fake-mode vertical slice, then materialize a tagged factory release into a separate customer target with factory-only exclusions and ownership evidence.",
  },
  {
    id: "prototype-adoption",
    outcome:
      "Move an existing prototype into an approved preserve, port, or replace work package without losing named behavior or data.",
  },
  {
    id: "safe-convex-dev",
    outcome:
      "Set up Convex development with official skills and safe MCP, with environment-value tools disabled and no production access.",
  },
  {
    id: "generated-capability-workflow",
    outcome:
      "Generate a new capability and workflow through canonical patterns with typed contracts and no raw workflow or Convex component imports.",
  },
  {
    id: "architecture-gate-repair",
    outcome:
      "Repair an architecture violation without suppressing, editing, or weakening the failing gate and without hand-editing generated files.",
  },
  {
    id: "active-v1-version-bump",
    outcome:
      "Publish a workflow version bump while a v1 run is active without mutating the published v1 graph, runner, interpreter, callback, or capability binding.",
  },
  {
    id: "workflow-adversarial-repairs",
    outcome:
      "Reject and type-repair non-idempotent retry, caller principal, scheduled-inline, oversized payload, 0.4.4 scheduled child, Workpool-clamped horizon, and wrong-generation EventId violations; map terminal retry exhaustion without spending remaining attempts; convert large payloads to artifact references and generate bounded batching without raw Convex component calls.",
  },
  {
    id: "promotion-upgrade-refusal",
    outcome:
      "Refuse provider promotion on stale or insufficient evidence and block a customer-owned upgrade collision with a useful manual resolution packet.",
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
