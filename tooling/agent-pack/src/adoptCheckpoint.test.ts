import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  compileAdoptionCheckpoint,
  type AdoptionCheckpointInput,
} from "./adoptCheckpoint.js";
import type { AdoptionExecutionResult } from "./adoptExecution.js";
import type { AdoptionReceipt } from "./adoptReceipt.js";

const checksum = (character: string): string =>
  `sha256:${character.repeat(64)}`;

const hash = (content: string): string =>
  `sha256:${createHash("sha256").update(content).digest("hex")}`;

const scenario = (): AdoptionCheckpointInput => {
  const operation = {
    path: "src/customer.ts",
    disposition: "port",
    sourceChecksum: checksum("b"),
    stagedChecksum: checksum("c"),
    rollbackChecksum: null,
    action: "stage-port",
  };
  const plan = {
    schemaVersion: 1,
    id: "adopt-existing-crm-execution",
    authorityFingerprint: checksum("a"),
    workPackageDigest: checksum("d"),
    sourceReadOnlyDuringExecution: true,
    phases: [
      { name: "stage", operations: [operation] },
      { name: "verify", operations: [operation] },
      {
        name: "cutover",
        strategy: "parallel-then-switch",
        steps: ["Validate staged import", "Switch reviewed traffic"],
        readinessEvidence: ["evidence/cutover.json"],
        operations: [],
      },
      { name: "post-cutover-deletion", operations: [] },
    ],
    rollback: {
      strategy: "Route traffic back to the source.",
      evidence: "evidence/rollback.json",
      restoresSource: true,
    },
    approvalEvidence: "evidence/approval.json",
  };
  const content = `${JSON.stringify(plan, null, 2)}\n`;
  const digest = hash(content);
  const executionPlan: NonNullable<AdoptionExecutionResult["artifact"]> = {
    path: "adoption/adopt-existing-crm.execution-plan.json",
    content,
    digest,
  };
  const receipt: AdoptionReceipt = {
    schemaVersion: 1,
    executionPlanDigest: digest,
    authorityFingerprint: checksum("a"),
    outcome: "completed",
    phases: {
      staged: [
        {
          path: operation.path,
          expectedChecksum: checksum("c"),
          observedChecksum: checksum("c"),
        },
      ],
      verified: [
        {
          path: operation.path,
          sourceChecksum: checksum("b"),
          observedSourceChecksum: checksum("b"),
          targetChecksum: checksum("c"),
          observedTargetChecksum: checksum("c"),
        },
      ],
      cutover: {
        completedSteps: ["Validate staged import", "Switch reviewed traffic"],
        readinessEvidence: [
          { path: "evidence/cutover.json", checksum: checksum("e") },
        ],
      },
      postCutoverDeletion: [],
    },
    rollback: {
      status: "available",
      strategy: "Route traffic back to the source.",
      evidencePath: "evidence/rollback.json",
      evidenceChecksum: checksum("f"),
      restoresSource: true,
    },
  };
  const cutoverIdentity = {
    adoptionId: "adopt-existing-crm",
    targetInstanceId: "customer-crm",
    targetRevision: checksum("1"),
    approvalEvidence: "evidence/approval.json",
  };
  return {
    executionPlan,
    reviewedExecutionPlanDigest: digest,
    authorityFingerprint: checksum("a"),
    receipt,
    cutoverIdentity,
    reviewedCutoverIdentity: { ...cutoverIdentity },
    acceptedReceiptDigests: [],
  };
};

describe("accepted adoption checkpoints", () => {
  it("compiles one deterministic accepted packet without mutation", () => {
    const input = scenario();
    const before = structuredClone(input);
    const first = compileAdoptionCheckpoint(input);
    const second = compileAdoptionCheckpoint(input);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      mutationPosture: "dry-run",
      findings: [],
      artifact: {
        path: "adoption/adopt-existing-crm.accepted-checkpoint.json",
        digest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      },
    });
    const packet = JSON.parse(first.artifact?.content ?? "{}") as {
      readonly acceptance: string;
      readonly authorityFingerprint: string;
      readonly executionPlanDigest: string;
      readonly cutoverIdentity: { readonly targetInstanceId: string };
      readonly rollback: { readonly status: string };
    };
    expect(packet).toMatchObject({
      acceptance: "accepted",
      authorityFingerprint: checksum("a"),
      executionPlanDigest: input.reviewedExecutionPlanDigest,
      cutoverIdentity: { targetInstanceId: "customer-crm" },
      rollback: { status: "available" },
    });
    expect(input).toEqual(before);
  });

  it("rejects a valid rolled-back receipt", () => {
    const input = scenario();
    const receipt = {
      ...(input.receipt as AdoptionReceipt),
      outcome: "rolled-back" as const,
      rollback: {
        ...(input.receipt as AdoptionReceipt).rollback,
        status: "exercised" as const,
      },
    };

    expect(compileAdoptionCheckpoint({ ...input, receipt })).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({
          code: "ADOPTION_CHECKPOINT_OUTCOME_REJECTED",
        }),
      ]),
      artifact: null,
    });
  });

  it("rejects a stale authority fingerprint", () => {
    const input = scenario();

    expect(
      compileAdoptionCheckpoint({
        ...input,
        authorityFingerprint: checksum("9"),
      }),
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_CHECKPOINT_STALE" }),
      ]),
    });
  });

  it("rejects drifted phase evidence and plan identity", () => {
    const input = scenario();
    const receipt = input.receipt as AdoptionReceipt;
    const [stage] = receipt.phases.staged;
    if (stage === undefined) throw new Error("missing stage fixture");
    const driftedReceipt = {
      ...receipt,
      phases: {
        ...receipt.phases,
        staged: [{ ...stage, observedChecksum: checksum("0") }],
      },
    };
    const receiptResult = compileAdoptionCheckpoint({
      ...input,
      receipt: driftedReceipt,
    });
    const planResult = compileAdoptionCheckpoint({
      ...input,
      reviewedExecutionPlanDigest: checksum("0"),
    });

    expect(receiptResult).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({
          code: "ADOPTION_CHECKPOINT_RECEIPT_DRIFT",
        }),
      ]),
    });
    expect(planResult).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_CHECKPOINT_PLAN_DRIFT" }),
      ]),
    });
  });

  it("rejects unreviewed cutover identity", () => {
    const input = scenario();
    const candidates = [
      {
        ...input,
        cutoverIdentity: {
          ...input.cutoverIdentity,
          targetRevision: checksum("2"),
        },
      },
      {
        ...input,
        cutoverIdentity: {
          ...input.cutoverIdentity,
          inferredTarget: "forbidden",
        },
      },
    ];

    for (const candidate of candidates)
      expect(compileAdoptionCheckpoint(candidate)).toMatchObject({
        ok: false,
        findings: expect.arrayContaining([
          expect.objectContaining({
            code: "ADOPTION_CHECKPOINT_CUTOVER_IDENTITY_INVALID",
          }),
        ]),
      });
  });

  it("rejects a previously accepted receipt digest", () => {
    const input = scenario();
    const first = compileAdoptionCheckpoint(input);
    const packet = JSON.parse(first.artifact?.content ?? "{}") as {
      readonly receiptDigest: string;
    };

    expect(
      compileAdoptionCheckpoint({
        ...input,
        acceptedReceiptDigests: [packet.receiptDigest],
      }),
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({
          code: "ADOPTION_CHECKPOINT_RECEIPT_REPLAYED",
        }),
      ]),
    });
  });

  it("fails closed on malformed replay-ledger authority", () => {
    const input = scenario();

    expect(
      compileAdoptionCheckpoint({
        ...input,
        acceptedReceiptDigests: [checksum("4"), checksum("4")],
      }),
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({
          code: "ADOPTION_CHECKPOINT_REPLAY_LEDGER_INVALID",
        }),
      ]),
    });
  });
});
