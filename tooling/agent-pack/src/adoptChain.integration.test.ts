import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { compileAdoptionCheckpoint } from "./adoptCheckpoint.js";
import { validateAdoptionAuthority } from "./adoptAuthority.js";
import type { AdoptionWorkPackage } from "./adopt.js";
import {
  compileAdoptionExecutionPlan,
  type AdoptionExecutionIntent,
} from "./adoptExecution.js";
import type { AdoptionReceipt } from "./adoptReceipt.js";
import { verifyAdoptionReceipt } from "./adoptReceiptVerifier.js";

const checksum = (character: string): string =>
  `sha256:${character.repeat(64)}`;

describe("customer adoption authority chain", () => {
  it("accepts one exact chain and rejects plan drift and receipt replay", () => {
    const fixture = JSON.parse(
      readFileSync(
        resolve(
          import.meta.dirname,
          "../__fixtures__/adoption/separate-target.json",
        ),
        "utf8",
      ),
    ) as AdoptionWorkPackage;
    const authorityInput = {
      mode: "separate-target",
      sourceReadOnly: true,
      source: {
        requestedRoot: "/workspace/legacy-crm",
        resolvedRoot: "/workspace/legacy-crm",
        worktreeRoot: "/workspace/legacy-crm",
        exists: true,
        empty: false,
        clean: true,
        revision: "1".repeat(40),
      },
      target: {
        requestedRoot: "/workspace/maestro-crm",
        resolvedRoot: "/workspace/maestro-crm",
        worktreeRoot: "/workspace/maestro-crm",
        exists: true,
        empty: true,
        clean: true,
        revision: "2".repeat(40),
      },
      baseline: {
        sourceRevision: "1".repeat(40),
        targetRevision: "2".repeat(40),
      },
      template: {
        requestedRoot: "/releases/maestro-v1",
        resolvedRoot: "/releases/maestro-v1",
        tag: "maestro-template-v1",
        commit: "3".repeat(40),
        archiveChecksum: checksum("1"),
        manifestChecksum: checksum("2"),
      },
      reviewedTemplate: {
        tag: "maestro-template-v1",
        commit: "3".repeat(40),
        archiveChecksum: checksum("1"),
        manifestChecksum: checksum("2"),
      },
      protectedRoots: [
        { label: "factory", resolvedRoot: "/factory" },
        { label: "home", resolvedRoot: "/home/operator" },
      ],
    } as const;
    const authority = validateAdoptionAuthority(authorityInput);
    expect(authority.ok).toBe(true);
    if (authority.authorityFingerprint === null)
      throw new Error("expected authority fingerprint");
    const workPackage: AdoptionWorkPackage = {
      ...fixture,
      authority: {
        ...fixture.authority,
        fingerprint: authority.authorityFingerprint,
      },
      approval: {
        ...fixture.approval,
        status: "approved",
        evidence: "evidence/adoption-approval.json",
      },
    };
    const before = structuredClone(workPackage);

    const intents: AdoptionExecutionIntent[] = [
      {
        path: "src/theme.css",
        disposition: "preserve",
        sourceChecksum: checksum("3"),
        stagedChecksum: null,
        rollbackChecksum: null,
      },
      {
        path: "src/customer.ts",
        disposition: "port",
        sourceChecksum: checksum("4"),
        stagedChecksum: checksum("5"),
        rollbackChecksum: null,
      },
      {
        path: "src/auth.ts",
        disposition: "replace",
        sourceChecksum: checksum("6"),
        stagedChecksum: checksum("7"),
        rollbackChecksum: checksum("6"),
      },
    ];
    const planResult = compileAdoptionExecutionPlan({
      workPackage,
      authority: authorityInput,
      intents,
    });
    expect(planResult.ok).toBe(true);
    if (planResult.artifact === null)
      throw new Error("expected execution plan");

    const receipt: AdoptionReceipt = {
      schemaVersion: 1,
      executionPlanDigest: planResult.artifact.digest,
      authorityFingerprint: authority.authorityFingerprint,
      outcome: "completed",
      phases: {
        staged: [
          {
            path: "src/auth.ts",
            expectedChecksum: checksum("7"),
            observedChecksum: checksum("7"),
          },
          {
            path: "src/customer.ts",
            expectedChecksum: checksum("5"),
            observedChecksum: checksum("5"),
          },
        ],
        verified: [
          {
            path: "src/auth.ts",
            sourceChecksum: checksum("6"),
            observedSourceChecksum: checksum("6"),
            targetChecksum: checksum("7"),
            observedTargetChecksum: checksum("7"),
          },
          {
            path: "src/customer.ts",
            sourceChecksum: checksum("4"),
            observedSourceChecksum: checksum("4"),
            targetChecksum: checksum("5"),
            observedTargetChecksum: checksum("5"),
          },
          {
            path: "src/theme.css",
            sourceChecksum: checksum("3"),
            observedSourceChecksum: checksum("3"),
            targetChecksum: null,
            observedTargetChecksum: null,
          },
        ],
        cutover: {
          completedSteps: workPackage.cutover.steps,
          readinessEvidence: workPackage.cutover.readinessEvidence.map(
            (path) => ({ path, checksum: checksum("8") }),
          ),
        },
        postCutoverDeletion: [],
      },
      rollback: {
        status: "available",
        strategy: workPackage.rollback.strategy,
        evidencePath: workPackage.rollback.evidence,
        evidenceChecksum: checksum("9"),
        restoresSource: workPackage.rollback.restoresSource,
      },
    };
    const receiptVerification = verifyAdoptionReceipt({
      executionPlan: planResult.artifact,
      reviewedExecutionPlanDigest: planResult.artifact.digest,
      authorityFingerprint: authority.authorityFingerprint,
      receipt,
    });
    expect(receiptVerification).toMatchObject({
      ok: true,
      findings: [],
      receiptDigest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    });

    const cutoverIdentity = {
      adoptionId: workPackage.id,
      targetInstanceId: "maestro-crm",
      targetRevision: checksum("a"),
      approvalEvidence: "evidence/adoption-approval.json",
    };
    const checkpointInput = {
      executionPlan: planResult.artifact,
      reviewedExecutionPlanDigest: planResult.artifact.digest,
      authorityFingerprint: authority.authorityFingerprint,
      receipt,
      cutoverIdentity,
      reviewedCutoverIdentity: { ...cutoverIdentity },
      acceptedReceiptDigests: [],
    };
    const checkpoint = compileAdoptionCheckpoint(checkpointInput);
    expect(checkpoint).toMatchObject({
      ok: true,
      findings: [],
      artifact: {
        path: "adoption/adopt-existing-crm.accepted-checkpoint.json",
      },
    });
    if (checkpoint.artifact === null) throw new Error("expected checkpoint");
    const packet = JSON.parse(checkpoint.artifact.content) as {
      readonly receiptDigest: string;
    };

    expect(
      compileAdoptionCheckpoint({
        ...checkpointInput,
        executionPlan: {
          ...planResult.artifact,
          content: `${planResult.artifact.content} `,
        },
      }),
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_CHECKPOINT_PLAN_DRIFT" }),
      ]),
      artifact: null,
    });
    expect(
      compileAdoptionCheckpoint({
        ...checkpointInput,
        acceptedReceiptDigests: [packet.receiptDigest],
      }),
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({
          code: "ADOPTION_CHECKPOINT_RECEIPT_REPLAYED",
        }),
      ]),
      artifact: null,
    });
    expect(workPackage).toEqual(before);
  });
});
