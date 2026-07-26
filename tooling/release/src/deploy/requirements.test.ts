import { describe, expect, it } from "vitest";

import {
  evaluatePromotionRequirements,
  type PromotionEvidenceClass,
  type PromotionEnvironment,
  type PromotionReadinessInput,
  type PromotionRequirement,
  type PromotionRequirementEvidence,
} from "./requirements.js";

const now = 3_000_000;
const commitSha = "a".repeat(40);
const artifactHash = `sha256:${"b".repeat(64)}`;
const fingerprint = (index: number) =>
  `sha256:${index.toString(16).padStart(64, "0")}`;

const specs = {
  "fake->local": [
    ["local-deterministic-gates", "behavioral-local"],
    ["local-visible-app", "behavioral-local"],
  ],
  "local->dev": [
    ["authenticated-dev-deployment", "provider-dev"],
    ["provider-posture", "provider-dev"],
  ],
  "dev->preview": [
    ["immutable-artifact", "mechanical"],
    ["preview-smoke", "hosted-preview"],
  ],
  "preview->staging": [
    ["hosted-e2e", "hosted-staging"],
    ["migration-readiness", "mechanical"],
    ["operator-receipt", "hosted-staging"],
    ["privacy-no-network", "mechanical"],
    ["provider-posture", "hosted-staging"],
    ["workflow-census", "hosted-staging"],
    ["workflow-compatibility", "mechanical"],
  ],
  "staging->production": [
    ["exact-staged-artifact", "hosted-staging"],
    ["hosted-e2e", "hosted-staging"],
    ["human-approval", "production-approval"],
    ["migration-readiness", "mechanical"],
    ["operator-receipt", "hosted-staging"],
    ["privacy-no-network", "mechanical"],
    ["provider-posture", "hosted-staging"],
    ["rollback-readiness", "mechanical"],
    ["workflow-census", "hosted-staging"],
    ["workflow-compatibility", "mechanical"],
  ],
} as const satisfies Readonly<
  Record<
    string,
    readonly (readonly [PromotionRequirement, PromotionEvidenceClass])[]
  >
>;

const input = (transition: keyof typeof specs): PromotionReadinessInput => {
  const [fromEnvironment, toEnvironment] = transition.split("->") as [
    PromotionEnvironment,
    PromotionEnvironment,
  ];
  const evidence = specs[transition].map(
    ([requirement, evidenceClass], index): PromotionRequirementEvidence => ({
      requirement,
      evidenceClass,
      outcome: "pass",
      environment: toEnvironment,
      targetId: "customer-app",
      commitSha,
      artifactHash,
      fingerprint: fingerprint(index + 1),
      observedAt: now - 100,
      expiresAt: now + 100,
    }),
  );
  const censusEvidence = evidence.find(
    ({ requirement }) => requirement === "workflow-census",
  );
  return {
    fromEnvironment,
    toEnvironment,
    targetId: "customer-app",
    commitSha,
    artifactHash,
    approverClass: "release-controller",
    evidence,
    ...(censusEvidence === undefined
      ? {}
      : {
          workflowCensus: {
            capturedAt: censusEvidence.observedAt,
            active: 2,
            restartable: 1,
            fingerprint: censusEvidence.fingerprint,
          },
        }),
  };
};

const evaluate = (value: PromotionReadinessInput, clock = now) =>
  evaluatePromotionRequirements(value, { nowMs: () => clock });

describe("promotion transition requirements", () => {
  it.each(Object.keys(specs) as (keyof typeof specs)[])(
    "accepts the exact current evidence set for %s",
    (transition) => {
      const value = input(transition);
      const result = evaluate(value);
      expect(result).toEqual({
        kind: "ready",
        transition,
        evidence: value.evidence,
      });
      expect(Object.isFrozen(result)).toBe(true);
      expect(result.kind === "ready" && Object.isFrozen(result.evidence)).toBe(
        true,
      );
    },
  );

  it("rejects skipped, reverse, and same-environment transitions", () => {
    for (const [fromEnvironment, toEnvironment] of [
      ["dev", "staging"],
      ["production", "staging"],
      ["preview", "preview"],
    ] as const) {
      expect(
        evaluate({
          ...input("dev->preview"),
          fromEnvironment,
          toEnvironment,
        }),
      ).toMatchObject({
        kind: "blocked",
        findings: [{ code: "unsupported-transition" }],
      });
    }
  });

  it("reports every missing production requirement with exact remediation", () => {
    const value = input("staging->production");
    const result = evaluate({ ...value, evidence: [] });
    expect(result).toMatchObject({ kind: "blocked" });
    if (result.kind !== "blocked") throw new Error("expected blocked result");
    expect(
      result.findings.filter(({ code }) => code === "missing-evidence"),
    ).toHaveLength(specs["staging->production"].length);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirement: "rollback-readiness",
          remediation:
            "Produce current rollback-readiness evidence for the exact target environment, commit, and artifact.",
        }),
        expect.objectContaining({ requirement: "human-approval" }),
        expect.objectContaining({ requirement: "workflow-census" }),
      ]),
    );
  });

  it("does not let mechanical or preview evidence substitute for hosted staging", () => {
    const value = input("preview->staging");
    for (const evidenceClass of ["mechanical", "hosted-preview"] as const) {
      const evidence = value.evidence.map((entry) =>
        entry.requirement === "hosted-e2e"
          ? { ...entry, evidenceClass }
          : entry,
      );
      expect(evaluate({ ...value, evidence })).toMatchObject({
        kind: "blocked",
        findings: [
          expect.objectContaining({
            code: "evidence-class-mismatch",
            requirement: "hosted-e2e",
          }),
        ],
      });
    }
  });

  it("rejects wrong environment, commit, and artifact bindings", () => {
    const value = input("staging->production");
    const evidence = value.evidence.map((entry) =>
      entry.requirement === "rollback-readiness"
        ? {
            ...entry,
            environment: "staging" as const,
            targetId: "other-app",
            commitSha: "0".repeat(40),
            artifactHash: `sha256:${"0".repeat(64)}`,
          }
        : entry,
    );
    expect(evaluate({ ...value, evidence })).toMatchObject({
      kind: "blocked",
      findings: [
        expect.objectContaining({
          code: "evidence-binding-mismatch",
          requirement: "rollback-readiness",
        }),
      ],
    });
  });

  it("rejects pending migration, stale evidence, and future evidence", () => {
    const value = input("preview->staging");
    const pending = value.evidence.map((entry) =>
      entry.requirement === "migration-readiness"
        ? { ...entry, outcome: "fail" as const }
        : entry,
    );
    expect(evaluate({ ...value, evidence: pending })).toMatchObject({
      kind: "blocked",
      findings: [
        expect.objectContaining({
          code: "evidence-failed",
          requirement: "migration-readiness",
        }),
      ],
    });

    const stale = value.evidence.map((entry) => ({
      ...entry,
      expiresAt: now,
    }));
    expect(evaluate({ ...value, evidence: stale })).toMatchObject({
      kind: "blocked",
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "stale-evidence" }),
      ]),
    });

    const future = value.evidence.map((entry) => ({
      ...entry,
      observedAt: now + 1,
      expiresAt: now + 2,
    }));
    expect(evaluate({ ...value, evidence: future })).toMatchObject({
      kind: "blocked",
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "future-evidence" }),
      ]),
    });
  });

  it("rejects missing or substituted active/restartable census", () => {
    const value = input("staging->production");
    const census = value.workflowCensus;
    if (census === undefined)
      throw new Error("production fixture needs census");
    const { workflowCensus, ...withoutCensus } = value;
    expect(workflowCensus).toBe(census);
    expect(evaluate(withoutCensus)).toMatchObject({
      kind: "blocked",
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "census-mismatch" }),
      ]),
    });
    expect(
      evaluate({
        ...value,
        workflowCensus: {
          ...census,
          fingerprint: `sha256:${"0".repeat(64)}`,
        },
      }),
    ).toMatchObject({
      kind: "blocked",
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "census-mismatch" }),
      ]),
    });
  });

  it("rejects missing production approval authority", () => {
    const value = input("staging->production");
    expect(
      evaluate({ ...value, approverClass: "security-controller" }),
    ).toMatchObject({
      kind: "blocked",
      findings: expect.arrayContaining([
        expect.objectContaining({
          code: "approval-mismatch",
          requirement: "human-approval",
        }),
      ]),
    });
  });

  it("rejects duplicate, reordered, and unexpected evidence identities", () => {
    const value = input("dev->preview");
    const firstEvidence = value.evidence[0];
    if (firstEvidence === undefined)
      throw new Error("preview fixture needs evidence");
    expect(
      evaluate({ ...value, evidence: [...value.evidence, firstEvidence] }),
    ).toMatchObject({
      kind: "blocked",
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "duplicate-evidence" }),
      ]),
    });
    expect(
      evaluate({ ...value, evidence: [...value.evidence].reverse() }),
    ).toMatchObject({
      kind: "blocked",
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "reordered-evidence" }),
      ]),
    });
    expect(
      evaluate({
        ...value,
        evidence: [
          ...value.evidence,
          {
            ...firstEvidence,
            requirement: "rollback-readiness",
          },
        ],
      }),
    ).toMatchObject({
      kind: "blocked",
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "unexpected-evidence" }),
      ]),
    });
  });

  it("uses one injected clock read and does not mutate caller evidence", () => {
    const value = input("preview->staging");
    const before = structuredClone(value.evidence);
    let reads = 0;
    const result = evaluatePromotionRequirements(value, {
      nowMs: () => {
        reads += 1;
        return now;
      },
    });
    expect(result.kind).toBe("ready");
    expect(reads).toBe(1);
    expect(value.evidence).toEqual(before);
  });
});
