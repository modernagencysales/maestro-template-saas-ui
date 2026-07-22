import { describe, expect, it } from "vitest";
import {
  classifyControllerTask,
  classifyControllerWave,
  completedTaskIdsForControlHead,
  integrationIdForWave,
  nextIntegrationId,
  normalizeControllerSnapshot,
  type ControllerSnapshotInput,
  type LaneCompletionResult,
} from "../src/factory-state.js";

const SHA_40_A = "a".repeat(40);
const SHA_40_B = "b".repeat(40);
const SHA_64_A = "a".repeat(64);
const SHA_64_B = "b".repeat(64);

const snapshotInput = (
  overrides: Partial<ControllerSnapshotInput> = {},
): ControllerSnapshotInput => ({
  controlHeadSha: SHA_40_A,
  gateQueue: { capacity: 2, inUse: 1, waiting: 0 },
  manifestSha256: SHA_64_A,
  planSha256: SHA_64_B,
  providerErrors: [],
  tasks: [],
  waves: [],
  ...overrides,
});

describe("brain factory control state", () => {
  it("normalizes tasks, waves, and provider errors into stable order", () => {
    const normalized = normalizeControllerSnapshot(
      snapshotInput({
        providerErrors: [
          { category: "unavailable", provider: "z-provider" },
          { category: "malformed", provider: "a-provider" },
        ],
        tasks: [
          { status: "pending", taskId: "S02-T01" },
          { status: "pending", taskId: "S01-T01" },
        ],
        waves: [
          {
            identity: "exact",
            inspection: "running",
            integrationId: "wave-z",
            runId: "run-z",
          },
          {
            identity: "exact",
            inspection: "failed",
            integrationId: "wave-a",
            ownershipId: "owner-a",
            runId: "run-a",
          },
        ],
      }),
    );

    expect(normalized).toEqual({
      schemaVersion: "maestro-brain-controller-snapshot/v1",
      controlHeadSha: SHA_40_A,
      manifestSha256: SHA_64_A,
      planSha256: SHA_64_B,
      tasks: [
        { stage: "pending", status: "pending", taskId: "S01-T01" },
        { stage: "pending", status: "pending", taskId: "S02-T01" },
      ],
      waves: [
        {
          identity: "exact",
          inspection: "failed",
          integrationId: "wave-a",
          ownershipId: "owner-a",
          runId: "run-a",
          stage: "recoverable",
        },
        {
          identity: "exact",
          inspection: "running",
          integrationId: "wave-z",
          runId: "run-z",
          stage: "running",
        },
      ],
      gateQueue: { capacity: 2, inUse: 1, waiting: 0 },
      providerErrors: [
        { category: "malformed", provider: "a-provider" },
        { category: "unavailable", provider: "z-provider" },
      ],
    });
  });

  it("classifies lane green only after exact candidate admission", () => {
    expect(
      classifyControllerTask({
        admission: "admissible",
        headSha: SHA_40_B,
        ownershipId: "task:S03-T03",
        runId: "run-green",
        status: "lane_green",
        taskId: "S03-T03",
      }),
    ).toMatchObject({ stage: "lane_green" });
  });

  it.each([undefined, "rejected", "unknown"] as const)(
    "fails closed for lane green with %s admission",
    (admission) => {
      expect(
        classifyControllerTask({
          ...(admission === undefined ? {} : { admission }),
          headSha: SHA_40_B,
          status: "lane_green",
          taskId: "S03-T03",
        }),
      ).toMatchObject({ stage: "false_green" });
    },
  );

  it("requires exact recovery coordinates before classifying a failed lane as recoverable", () => {
    expect(
      classifyControllerTask({
        baseSha: SHA_40_A,
        findingSha256: SHA_64_A,
        headSha: SHA_40_B,
        status: "failed",
        taskId: "S04-T01",
      }),
    ).toMatchObject({ stage: "recoverable" });
    expect(
      classifyControllerTask({
        baseSha: SHA_40_A,
        status: "failed",
        taskId: "S04-T01",
      }),
    ).toMatchObject({ stage: "unknown" });
  });

  it("classifies waves fail closed on identity drift or unavailable inspection", () => {
    expect(
      classifyControllerWave({
        identity: "exact",
        inspection: "succeeded",
        integrationId: "wave-1",
        runId: "run-1",
      }),
    ).toMatchObject({ stage: "promotable" });
    expect(
      classifyControllerWave({
        identity: "drifted",
        inspection: "succeeded",
        integrationId: "wave-1",
        runId: "run-1",
      }),
    ).toMatchObject({ stage: "unknown" });
    expect(
      classifyControllerWave({
        identity: "exact",
        inspection: "ambiguous",
        integrationId: "wave-1",
      }),
    ).toMatchObject({ stage: "unknown" });
  });

  it("classifies exact failed task findings as owner rework", () => {
    expect(
      classifyControllerWave({
        findingSha256: SHA_64_A,
        identity: "exact",
        inspection: "failed",
        integrationId: "wave-1",
        ownerTaskIds: ["S01-T01", "S02-T01"],
        resultSha256: SHA_64_B,
        runId: "run-1",
        selectionFileSha256: "c".repeat(64),
        selectionPayloadSha256: "d".repeat(64),
      }),
    ).toMatchObject({ stage: "owner_rework" });
  });

  it("fails closed when owner rework evidence is incomplete", () => {
    expect(
      classifyControllerWave({
        findingSha256: SHA_64_A,
        identity: "exact",
        inspection: "failed",
        integrationId: "wave-1",
        ownerTaskIds: ["S01-T01"],
        runId: "run-1",
      }),
    ).toMatchObject({ stage: "unknown" });
  });

  it.each([
    [
      "task",
      snapshotInput({
        tasks: [
          { status: "pending", taskId: "S01-T01" },
          { status: "running", taskId: "S01-T01" },
        ],
      }),
      "duplicate taskId S01-T01",
    ],
    [
      "wave",
      snapshotInput({
        waves: [
          {
            identity: "exact",
            inspection: "running",
            integrationId: "wave-1",
          },
          {
            identity: "exact",
            inspection: "failed",
            integrationId: "wave-1",
          },
        ],
      }),
      "duplicate integrationId wave-1",
    ],
    [
      "run",
      snapshotInput({
        tasks: [
          { runId: "shared-run", status: "running", taskId: "S01-T01" },
          { runId: "shared-run", status: "running", taskId: "S02-T01" },
        ],
      }),
      "duplicate runId shared-run",
    ],
    [
      "ownership",
      snapshotInput({
        tasks: [
          {
            ownershipId: "shared-owner",
            status: "running",
            taskId: "S01-T01",
          },
          {
            ownershipId: "shared-owner",
            status: "running",
            taskId: "S02-T01",
          },
        ],
      }),
      "duplicate ownershipId shared-owner",
    ],
  ] as const)("rejects duplicate %s identities", (_name, input, message) => {
    expect(() => normalizeControllerSnapshot(input)).toThrow(message);
  });

  it("rejects simultaneous active integration owners", () => {
    expect(() =>
      normalizeControllerSnapshot(
        snapshotInput({
          waves: [
            {
              identity: "exact",
              inspection: "running",
              integrationId: "wave-1",
              ownershipId: "owner-1",
            },
            {
              identity: "exact",
              inspection: "running",
              integrationId: "wave-2",
              ownershipId: "owner-2",
            },
          ],
        }),
      ),
    ).toThrow("multiple active integration owners: owner-1, owner-2");
  });

  it("rejects malformed hashes and impossible gate queue counts", () => {
    expect(() =>
      normalizeControllerSnapshot(
        snapshotInput({ controlHeadSha: "not-a-sha" }),
      ),
    ).toThrow("controlHeadSha must be an exact 40-character Git SHA");
    expect(() =>
      normalizeControllerSnapshot(
        snapshotInput({
          gateQueue: { capacity: 1, inUse: 2, waiting: 0 },
        }),
      ),
    ).toThrow("gateQueue.inUse cannot exceed capacity");
  });

  it("counts integrated evidence only when its head is on control HEAD", () => {
    const results = new Map<string, LaneCompletionResult>([
      [
        "S00-T02",
        {
          status: "integrated",
          integrationHeadSha: "integration-head",
        },
      ],
      [
        "S02-T01",
        {
          status: "accepted",
          integrationHeadSha: "accepted-head",
        },
      ],
      ["S01-T01", { status: "lane_green" }],
    ]);

    expect(
      completedTaskIdsForControlHead({
        controlHead: "control-head",
        isAncestor: (ancestor, descendant) =>
          ["integration-head", "accepted-head"].includes(ancestor) &&
          descendant === "control-head",
        resultFor: (taskId) => results.get(taskId),
        taskIds: ["S00-T02", "S01-T01", "S02-T01"],
      }),
    ).toEqual(new Set(["S00-T02", "S02-T01"]));
  });

  it("rejects completed evidence without an integration head", () => {
    expect(() =>
      completedTaskIdsForControlHead({
        controlHead: "control-head",
        isAncestor: () => true,
        resultFor: () => ({ status: "accepted" }),
        taskIds: ["S01-T01"],
      }),
    ).toThrow(
      "S01-T01: accepted evidence has no integrationHeadSha; refusing to launch dependents",
    );
  });

  it("rejects completed evidence not merged into control HEAD", () => {
    expect(() =>
      completedTaskIdsForControlHead({
        controlHead: "control-head",
        isAncestor: () => false,
        resultFor: () => ({
          status: "integrated",
          integrationHeadSha: "unmerged-head",
        }),
        taskIds: ["S08-T01"],
      }),
    ).toThrow(
      "S08-T01: integration head unmerged-head is not an ancestor of control HEAD control-head; merge the integration before dispatch",
    );
  });

  it("uses the manifest tranche for wave one and versions later waves", () => {
    expect(integrationIdForWave("D2-domain-bodies", 1)).toBe(
      "D2-domain-bodies",
    );
    expect(integrationIdForWave("D2-domain-bodies", 2)).toBe(
      "D2-domain-bodies-w2",
    );
  });

  it("selects the first wave when no integration state exists", () => {
    expect(
      nextIntegrationId({
        controlHead: "control-head",
        isAncestor: () => true,
        manifestTranche: "F0-foundation",
        stateFor: () => ({ existingArtifacts: [] }),
      }),
    ).toBe("F0-foundation");
  });

  it("advances deterministically through passed merged waves", () => {
    expect(
      nextIntegrationId({
        controlHead: "control-head",
        isAncestor: (ancestor) =>
          new Set(["wave-one-head", "wave-two-head"]).has(ancestor),
        manifestTranche: "C1-contract-spine",
        stateFor: (integrationId) =>
          integrationId === "C1-contract-spine"
            ? {
                existingArtifacts: ["wave one evidence"],
                headSha: "wave-one-head",
                status: "passed",
              }
            : integrationId === "C1-contract-spine-w2"
              ? {
                  existingArtifacts: ["wave two evidence"],
                  headSha: "wave-two-head",
                  status: "passed",
                }
              : { existingArtifacts: [] },
      }),
    ).toBe("C1-contract-spine-w3");
  });

  it("rejects an active or otherwise unresolved latest wave", () => {
    expect(() =>
      nextIntegrationId({
        controlHead: "control-head",
        isAncestor: () => true,
        manifestTranche: "C1-contract-spine",
        stateFor: () => ({
          existingArtifacts: ["run record", "worktree"],
          status: "ready_for_review",
        }),
      }),
    ).toThrow(
      "C1-contract-spine: latest integration attempt is unresolved (status ready_for_review); existing state: run record, worktree",
    );
  });

  it("rejects a passed wave without a recorded head", () => {
    expect(() =>
      nextIntegrationId({
        controlHead: "control-head",
        isAncestor: () => true,
        manifestTranche: "C1-contract-spine",
        stateFor: () => ({
          existingArtifacts: ["evidence"],
          status: "passed",
        }),
      }),
    ).toThrow("C1-contract-spine: passed integration evidence has no headSha");
  });

  it("rejects a passed wave that is not merged into control HEAD", () => {
    expect(() =>
      nextIntegrationId({
        controlHead: "control-head",
        isAncestor: () => false,
        manifestTranche: "F0-foundation",
        stateFor: () => ({
          existingArtifacts: ["evidence"],
          headSha: "unmerged-head",
          status: "passed",
        }),
      }),
    ).toThrow(
      "F0-foundation: passed integration head unmerged-head is not an ancestor of control HEAD control-head; merge it before starting another wave",
    );
  });
});
