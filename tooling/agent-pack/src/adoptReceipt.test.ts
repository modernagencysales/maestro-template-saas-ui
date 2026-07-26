import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  validateAdoptionAuthority,
  type AdoptionAuthorityInput,
} from "./adoptAuthority.js";
import type { AdoptionWorkPackage } from "./adopt.js";
import {
  compileAdoptionExecutionPlan,
  type AdoptionExecutionIntent,
} from "./adoptExecution.js";
import { verifyAdoptionReceipt, type AdoptionReceipt } from "./adoptReceipt.js";

const checksum = (character: string): string =>
  `sha256:${character.repeat(64)}`;
const authority = (): AdoptionAuthorityInput => ({
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
  baseline: { sourceRevision: "1".repeat(40), targetRevision: "2".repeat(40) },
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
  protectedRoots: [{ label: "factory", resolvedRoot: "/factory" }],
});
const authorityFingerprint = (): string => {
  const value = validateAdoptionAuthority(authority()).authorityFingerprint;
  if (value === null) throw new Error("expected authority fingerprint");
  return value;
};

const planArtifact = () => {
  const fixture = JSON.parse(
    readFileSync(
      resolve(
        import.meta.dirname,
        "../__fixtures__/adoption/separate-target.json",
      ),
      "utf8",
    ),
  ) as AdoptionWorkPackage;
  const workPackage: AdoptionWorkPackage = {
    ...fixture,
    authority: { ...fixture.authority, fingerprint: authorityFingerprint() },
    approval: {
      ...fixture.approval,
      status: "approved",
      evidence: "evidence/adoption-approval.json",
    },
  };
  const intents: AdoptionExecutionIntent[] = [
    {
      path: "src/theme.css",
      disposition: "preserve",
      sourceChecksum: checksum("b"),
      stagedChecksum: null,
      rollbackChecksum: null,
    },
    {
      path: "src/customer.ts",
      disposition: "port",
      sourceChecksum: checksum("c"),
      stagedChecksum: checksum("d"),
      rollbackChecksum: null,
    },
    {
      path: "src/auth.ts",
      disposition: "replace",
      sourceChecksum: checksum("e"),
      stagedChecksum: checksum("f"),
      rollbackChecksum: checksum("e"),
    },
  ];
  const result = compileAdoptionExecutionPlan({
    workPackage,
    authority: authority(),
    intents,
  });
  if (result.artifact === null) throw new Error("expected execution plan");
  return result.artifact;
};

const validReceipt = (planDigest: string): AdoptionReceipt => ({
  schemaVersion: 1,
  executionPlanDigest: planDigest,
  authorityFingerprint: authorityFingerprint(),
  outcome: "completed",
  phases: {
    staged: [
      {
        path: "src/auth.ts",
        expectedChecksum: checksum("f"),
        observedChecksum: checksum("f"),
      },
      {
        path: "src/customer.ts",
        expectedChecksum: checksum("d"),
        observedChecksum: checksum("d"),
      },
    ],
    verified: [
      {
        path: "src/auth.ts",
        sourceChecksum: checksum("e"),
        observedSourceChecksum: checksum("e"),
        targetChecksum: checksum("f"),
        observedTargetChecksum: checksum("f"),
      },
      {
        path: "src/customer.ts",
        sourceChecksum: checksum("c"),
        observedSourceChecksum: checksum("c"),
        targetChecksum: checksum("d"),
        observedTargetChecksum: checksum("d"),
      },
      {
        path: "src/theme.css",
        sourceChecksum: checksum("b"),
        observedSourceChecksum: checksum("b"),
        targetChecksum: null,
        observedTargetChecksum: null,
      },
    ],
    cutover: {
      completedSteps: [
        "Validate staged import",
        "Approve tenant mapping",
        "Switch reviewed traffic",
      ],
      readinessEvidence: [
        {
          path: "evidence/cutover-readiness.json",
          checksum: checksum("7"),
        },
      ],
    },
    postCutoverDeletion: [],
  },
  rollback: {
    status: "available",
    strategy: "Route traffic to the source and discard the unapproved target.",
    evidencePath: "evidence/rollback-drill.json",
    evidenceChecksum: checksum("8"),
    restoresSource: true,
  },
});

const verify = (receipt: unknown, reviewedDigest?: string) => {
  const executionPlan = planArtifact();
  return verifyAdoptionReceipt({
    executionPlan,
    reviewedExecutionPlanDigest: reviewedDigest ?? executionPlan.digest,
    authorityFingerprint: authorityFingerprint(),
    receipt,
  });
};

describe("post-adoption receipt verification", () => {
  it("verifies exact phase and rollback evidence deterministically", () => {
    const plan = planArtifact();
    const receipt = validReceipt(plan.digest);
    const before = structuredClone(receipt);
    const first = verify(receipt);
    const second = verify(receipt);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      mutationPosture: "read-only",
      findings: [],
      receiptDigest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    });
    expect(receipt).toEqual(before);
  });

  it("rejects plan bytes not bound by the reviewed digest", () => {
    const plan = planArtifact();

    expect(verify(validReceipt(plan.digest), checksum("0"))).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_RECEIPT_PLAN_INVALID" }),
      ]),
    });
  });

  it("rejects authority fingerprint drift", () => {
    const plan = planArtifact();
    const receipt = {
      ...validReceipt(plan.digest),
      authorityFingerprint: checksum("9"),
    };

    expect(verify(receipt)).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({
          code: "ADOPTION_RECEIPT_AUTHORITY_MISMATCH",
        }),
      ]),
    });
  });

  it("fails closed on unknown, inherited, and malformed receipt fields", () => {
    const plan = planArtifact();
    const valid = validReceipt(plan.digest);
    const inherited = Object.create(valid) as unknown;
    const unknown = { ...valid, inferredSuccess: true };
    const malformed = { ...valid, phases: null };

    for (const receipt of [inherited, unknown, malformed])
      expect(verify(receipt)).toMatchObject({
        ok: false,
        findings: expect.arrayContaining([
          expect.objectContaining({ code: "ADOPTION_RECEIPT_SCHEMA_INVALID" }),
        ]),
        receiptDigest: null,
      });
  });

  it("rejects missing, duplicate, or byte-drifted stage evidence", () => {
    const plan = planArtifact();
    const valid = validReceipt(plan.digest);
    const [firstStage] = valid.phases.staged;
    if (firstStage === undefined) throw new Error("missing stage fixture");
    const candidates = [
      { ...valid, phases: { ...valid.phases, staged: [firstStage] } },
      {
        ...valid,
        phases: {
          ...valid.phases,
          staged: [firstStage, firstStage],
        },
      },
      {
        ...valid,
        phases: {
          ...valid.phases,
          staged: valid.phases.staged.map((item, index) =>
            index === 0 ? { ...item, observedChecksum: checksum("0") } : item,
          ),
        },
      },
    ];

    for (const receipt of candidates)
      expect(verify(receipt)).toMatchObject({
        ok: false,
        findings: expect.arrayContaining([
          expect.objectContaining({ code: "ADOPTION_RECEIPT_STAGE_INVALID" }),
        ]),
      });
  });

  it("rejects incomplete or drifted verification evidence", () => {
    const plan = planArtifact();
    const valid = validReceipt(plan.digest);
    const verified = valid.phases.verified
      .slice(1)
      .map((item, index) =>
        index === 0 ? { ...item, observedSourceChecksum: checksum("0") } : item,
      );

    expect(
      verify({ ...valid, phases: { ...valid.phases, verified } }),
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_RECEIPT_VERIFY_INVALID" }),
      ]),
    });
  });

  it("requires exact ordered cutover and readiness evidence", () => {
    const plan = planArtifact();
    const valid = validReceipt(plan.digest);
    const cutover = {
      ...valid.phases.cutover,
      completedSteps: [...valid.phases.cutover.completedSteps].reverse(),
      readinessEvidence: [],
    };

    expect(
      verify({ ...valid, phases: { ...valid.phases, cutover } }),
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_RECEIPT_CUTOVER_INVALID" }),
      ]),
    });
  });

  it("requires exercised source-restoring rollback for rolled-back outcomes", () => {
    const plan = planArtifact();
    const valid = validReceipt(plan.digest);
    const receipt = {
      ...valid,
      outcome: "rolled-back" as const,
      rollback: { ...valid.rollback, status: "available" as const },
    };

    expect(verify(receipt)).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_RECEIPT_ROLLBACK_INVALID" }),
      ]),
    });
  });
});
