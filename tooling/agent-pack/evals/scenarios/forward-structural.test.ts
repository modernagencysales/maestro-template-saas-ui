import { describe, expect, it } from "vitest";
import {
  assertNoForbiddenActions,
  forbiddenActionIds,
} from "../assertions/forbiddenActions.js";
import { assertForwardParity } from "../assertions/parity.js";
import { parseCliOptions } from "../walking-skeleton/cli.js";
import {
  parseForwardRunEvidence,
  type ForwardCanonicalProjection,
} from "./evidence.js";
import { buildForwardStructuralReport, forwardScenarios } from "./forward.js";

const candidateSha = "a".repeat(40);
const hash = `sha256:${"b".repeat(64)}` as const;

const expectedScenarios = [
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

describe("forward structural ABI", () => {
  it("parses only the offline structural forward suite", () => {
    expect(
      parseCliOptions(
        [
          "--",
          "--suite",
          "forward",
          "--structural",
          "--candidate-sha",
          candidateSha,
        ],
        "/repo",
      ),
    ).toEqual({ mode: "forward-structural", candidateSha });
    expect(
      parseCliOptions(
        [
          "--suite",
          "forward",
          "--host",
          "claude",
          "--candidate-sha",
          candidateSha,
        ],
        "/repo",
      ),
    ).toMatchObject({
      mode: "forward-run",
      options: { host: "claude", candidateSha },
    });
    expect(
      parseCliOptions(
        [
          "--suite",
          "forward",
          "--aggregate",
          "--run-ids",
          "claude-1,claude-2,codex-1,codex-2",
          "--candidate-sha",
          candidateSha,
        ],
        "/repo",
      ),
    ).toMatchObject({
      mode: "forward-aggregate",
      candidateSha,
      runIds: ["claude-1", "claude-2", "codex-1", "codex-2"],
    });
    expect(() =>
      parseCliOptions(
        [
          "--suite",
          "forward",
          "--host",
          "claude",
          "--product-name",
          "unsupported",
          "--candidate-sha",
          candidateSha,
        ],
        "/repo",
      ),
    ).toThrow("--product-name is not allowed in forward run mode");
  });

  it("publishes the exact frozen scenario catalog", () => {
    expect(forwardScenarios).toEqual(expectedScenarios);
    expect(buildForwardStructuralReport(candidateSha)).toMatchObject({
      ok: true,
      suite: "forward",
      mode: "structural",
      candidateSha,
      scenarioIds: expectedScenarios.map(({ id }) => id),
      assertionIds: ["forbidden-actions-absent", "cross-host-parity"],
    });
  });

  it("strictly parses the closed evidence schema", () => {
    const evidence = completeEvidence();
    expect(parseForwardRunEvidence(evidence)).toBe(evidence);
    expect(() =>
      parseForwardRunEvidence({ ...evidence, unexpected: true }),
    ).toThrow("evidence.unexpected is unknown");
    expect(() =>
      parseForwardRunEvidence({ ...evidence, scenarioId: "invented" }),
    ).toThrow("evidence.scenarioId is unknown");
    expect(() =>
      parseForwardRunEvidence({
        ...evidence,
        commands: [{ ...evidence.commands[0], unexpected: true }],
      }),
    ).toThrow("evidence.commands.0.unexpected is unknown");
    expect(() =>
      parseForwardRunEvidence({
        ...evidence,
        forbiddenActions: [
          ...evidence.forbiddenActions.slice(0, -1),
          { id: "invented-action", observed: false, evidence: [] },
        ],
      }),
    ).toThrow("evidence.forbiddenActions.18.id is unknown");
  });

  it("rejects missing, observed, unknown, and duplicate forbidden actions", () => {
    const observations = forbiddenObservations();
    expect(assertNoForbiddenActions(observations)).toEqual({
      ok: true,
      failures: [],
    });
    expect(assertNoForbiddenActions(observations.slice(1))).toMatchObject({
      ok: false,
      failures: [{ code: "FORBIDDEN_ACTION_EVIDENCE_INCOMPLETE" }],
    });
    expect(
      assertNoForbiddenActions([
        ...observations,
        { id: "invented-action", observed: false, evidence: [] },
      ]),
    ).toMatchObject({
      ok: false,
      failures: [{ code: "FORBIDDEN_ACTION_UNKNOWN" }],
    });
    expect(
      assertNoForbiddenActions([
        ...observations,
        observations[0] as (typeof observations)[number],
      ]),
    ).toMatchObject({
      ok: false,
      failures: [{ code: "FORBIDDEN_ACTION_EVIDENCE_INCOMPLETE" }],
    });
    expect(
      assertNoForbiddenActions(
        observations.map((entry) =>
          entry.id === "gate-edit" ? { ...entry, observed: true } : entry,
        ),
      ),
    ).toMatchObject({
      ok: false,
      failures: [{ code: "FORBIDDEN_ACTION_OBSERVED" }],
    });
  });

  it("sorts only declared sets and preserves command and evidence order", () => {
    const projection = canonicalProjection();
    expect(
      assertForwardParity({
        claude: projection,
        codex: {
          ...projection,
          artifacts: [...projection.artifacts].reverse(),
          forbiddenActions: [...projection.forbiddenActions].reverse(),
        },
      }),
    ).toEqual({ ok: true, failures: [] });
    expect(
      assertForwardParity({
        claude: projection,
        codex: { ...projection, commands: [...projection.commands].reverse() },
      }),
    ).toMatchObject({
      ok: false,
      failures: [{ code: "HOST_PARITY_DIVERGED", path: "commands" }],
    });
    expect(
      assertForwardParity({
        claude: projection,
        codex: {
          ...projection,
          forbiddenActions: projection.forbiddenActions.map((entry) =>
            entry.id === "unauthorized-write"
              ? { ...entry, evidence: [...entry.evidence].reverse() }
              : entry,
          ),
        },
      }),
    ).toMatchObject({
      ok: false,
      failures: [{ code: "HOST_PARITY_DIVERGED", path: "forbiddenActions" }],
    });
  });

  it("rejects duplicate canonical IDs before parity grading", () => {
    const projection = canonicalProjection();
    const firstCommand = projection.commands[0];
    if (!firstCommand) throw new Error("fixture command is required");
    expect(
      assertForwardParity({
        claude: {
          ...projection,
          commands: [...projection.commands, firstCommand],
        },
        codex: projection,
      }),
    ).toMatchObject({
      ok: false,
      failures: [
        { code: "CANONICAL_ID_DUPLICATE", path: "claude.commands.create" },
      ],
    });
  });
});

function completeEvidence() {
  return {
    schemaVersion: 1,
    runId: "claude-run-1",
    candidateSha,
    scenarioId: "greenfield-tagged-customer",
    host: "claude",
    hostVersion: "1.0.0",
    model: "fixture-model",
    toolVersions: { node: "22.0.0" },
    initialContextSha256: hash,
    userPromptSha256: hash,
    interventions: [
      { kind: "product-approval", summary: "Approved fixture name." },
    ],
    artifacts: [{ id: "manifest", sha256: hash }],
    commands: [
      {
        id: "check",
        exitCode: 0,
        resultCode: "ok",
        attestationSha256: hash,
      },
    ],
    timings: [
      {
        id: "total",
        startedAt: "2026-07-25T00:00:00.000Z",
        completedAt: "2026-07-25T00:00:01.000Z",
        durationMs: 1_000,
      },
    ],
    forbiddenActions: forbiddenObservations(),
    receiptSha256: hash,
  } as const;
}

function forbiddenObservations() {
  return forbiddenActionIds.map((id, index) => ({
    id,
    observed: false,
    evidence:
      index === 0 ? (["scan:clean", "receipt:clean"] as const) : ([] as const),
  }));
}

function canonicalProjection(): ForwardCanonicalProjection {
  return {
    candidateSha,
    scenarioId: "greenfield-tagged-customer",
    artifacts: [
      { id: "receipt", sha256: hash },
      { id: "manifest", sha256: hash },
    ],
    commands: [
      { id: "create", exitCode: 0, resultCode: "ok", attestationSha256: hash },
      { id: "check", exitCode: 0, resultCode: "ok", attestationSha256: hash },
    ],
    forbiddenActions: forbiddenObservations(),
    receiptSha256: hash,
  };
}
