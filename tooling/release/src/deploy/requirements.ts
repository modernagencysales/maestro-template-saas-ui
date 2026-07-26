import type {
  PromotionApproverClass,
  PromotionWorkflowCensus,
} from "./contract.js";

export type PromotionEnvironment =
  "fake" | "local" | "dev" | "preview" | "staging" | "production";

export type PromotionRequirement =
  | "authenticated-dev-deployment"
  | "exact-staged-artifact"
  | "hosted-e2e"
  | "human-approval"
  | "immutable-artifact"
  | "local-deterministic-gates"
  | "local-visible-app"
  | "migration-readiness"
  | "operator-receipt"
  | "preview-smoke"
  | "privacy-no-network"
  | "provider-posture"
  | "rollback-readiness"
  | "workflow-census"
  | "workflow-compatibility";

export type PromotionEvidenceClass =
  | "behavioral-local"
  | "hosted-preview"
  | "hosted-staging"
  | "mechanical"
  | "production-approval"
  | "provider-dev";

export type PromotionRequirementEvidence = {
  readonly requirement: PromotionRequirement;
  readonly evidenceClass: PromotionEvidenceClass;
  readonly outcome: "pass" | "fail";
  readonly environment: PromotionEnvironment;
  readonly targetId: string;
  readonly commitSha: string;
  readonly artifactHash: string;
  readonly fingerprint: string;
  readonly observedAt: number;
  readonly expiresAt: number;
};

export type PromotionReadinessInput = {
  readonly fromEnvironment: PromotionEnvironment;
  readonly toEnvironment: PromotionEnvironment;
  readonly targetId: string;
  readonly commitSha: string;
  readonly artifactHash: string;
  readonly approverClass: PromotionApproverClass;
  readonly evidence: readonly PromotionRequirementEvidence[];
  readonly workflowCensus?: PromotionWorkflowCensus;
};

export type PromotionRequirementFindingCode =
  | "unsupported-transition"
  | "invalid-clock"
  | "invalid-evidence"
  | "missing-evidence"
  | "unexpected-evidence"
  | "duplicate-evidence"
  | "reordered-evidence"
  | "evidence-class-mismatch"
  | "evidence-binding-mismatch"
  | "evidence-failed"
  | "future-evidence"
  | "stale-evidence"
  | "approval-mismatch"
  | "census-mismatch";

export type PromotionRequirementFinding = {
  readonly code: PromotionRequirementFindingCode;
  readonly requirement?: PromotionRequirement;
  readonly detail: string;
  readonly remediation: string;
};

export type PromotionReadinessResult =
  | {
      readonly kind: "ready";
      readonly transition: string;
      readonly evidence: readonly PromotionRequirementEvidence[];
    }
  | {
      readonly kind: "blocked";
      readonly transition: string;
      readonly findings: readonly PromotionRequirementFinding[];
    };

export type PromotionRequirementsDependencies = {
  readonly nowMs: () => number;
};

type RequirementSpec = {
  readonly requirement: PromotionRequirement;
  readonly evidenceClass: PromotionEvidenceClass;
};

const transitionRequirements: Readonly<
  Record<string, readonly RequirementSpec[]>
> = {
  "fake->local": [
    {
      requirement: "local-deterministic-gates",
      evidenceClass: "behavioral-local",
    },
    { requirement: "local-visible-app", evidenceClass: "behavioral-local" },
  ],
  "local->dev": [
    {
      requirement: "authenticated-dev-deployment",
      evidenceClass: "provider-dev",
    },
    { requirement: "provider-posture", evidenceClass: "provider-dev" },
  ],
  "dev->preview": [
    { requirement: "immutable-artifact", evidenceClass: "mechanical" },
    { requirement: "preview-smoke", evidenceClass: "hosted-preview" },
  ],
  "preview->staging": [
    { requirement: "hosted-e2e", evidenceClass: "hosted-staging" },
    { requirement: "migration-readiness", evidenceClass: "mechanical" },
    { requirement: "operator-receipt", evidenceClass: "hosted-staging" },
    { requirement: "privacy-no-network", evidenceClass: "mechanical" },
    { requirement: "provider-posture", evidenceClass: "hosted-staging" },
    { requirement: "workflow-census", evidenceClass: "hosted-staging" },
    { requirement: "workflow-compatibility", evidenceClass: "mechanical" },
  ],
  "staging->production": [
    { requirement: "exact-staged-artifact", evidenceClass: "hosted-staging" },
    { requirement: "hosted-e2e", evidenceClass: "hosted-staging" },
    { requirement: "human-approval", evidenceClass: "production-approval" },
    { requirement: "migration-readiness", evidenceClass: "mechanical" },
    { requirement: "operator-receipt", evidenceClass: "hosted-staging" },
    { requirement: "privacy-no-network", evidenceClass: "mechanical" },
    { requirement: "provider-posture", evidenceClass: "hosted-staging" },
    { requirement: "rollback-readiness", evidenceClass: "mechanical" },
    { requirement: "workflow-census", evidenceClass: "hosted-staging" },
    { requirement: "workflow-compatibility", evidenceClass: "mechanical" },
  ],
};

const sha256 = /^sha256:[0-9a-f]{64}$/;
const commitSha = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

export const evaluatePromotionRequirements = (
  input: PromotionReadinessInput,
  dependencies: PromotionRequirementsDependencies,
): PromotionReadinessResult => {
  const transition = `${input.fromEnvironment}->${input.toEnvironment}`;
  const specs = transitionRequirements[transition];
  if (specs === undefined) {
    return blocked(transition, [
      finding(
        "unsupported-transition",
        undefined,
        `Promotion transition ${transition} is not an adjacent supported transition.`,
        "Plan each adjacent environment transition separately.",
      ),
    ]);
  }
  const now = dependencies.nowMs();
  if (!isTime(now)) {
    return blocked(transition, [
      finding(
        "invalid-clock",
        undefined,
        "Promotion requirements clock is invalid.",
        "Provide a finite nonnegative safe-integer verification clock.",
      ),
    ]);
  }
  const findings: PromotionRequirementFinding[] = [];
  const expectedRequirements = specs.map(({ requirement }) => requirement);
  const actualRequirements = input.evidence.map(
    ({ requirement }) => requirement,
  );
  if (new Set(actualRequirements).size !== actualRequirements.length) {
    findings.push(
      finding(
        "duplicate-evidence",
        undefined,
        "Promotion evidence contains duplicate requirement identities.",
        "Provide exactly one current evidence fact for each required identity.",
      ),
    );
  }
  if (
    actualRequirements.length === expectedRequirements.length &&
    actualRequirements.every((requirement) =>
      expectedRequirements.includes(requirement),
    ) &&
    actualRequirements.some(
      (requirement, index) => requirement !== expectedRequirements[index],
    )
  ) {
    findings.push(
      finding(
        "reordered-evidence",
        undefined,
        "Promotion evidence is not in canonical requirement order.",
        "Emit evidence in the transition requirement order.",
      ),
    );
  }
  for (const actual of actualRequirements) {
    if (!expectedRequirements.includes(actual)) {
      findings.push(
        finding(
          "unexpected-evidence",
          actual,
          `${actual} is not evidence for ${transition}.`,
          "Remove evidence that is not part of this exact transition.",
        ),
      );
    }
  }
  for (const spec of specs) {
    const matches = input.evidence.filter(
      ({ requirement }) => requirement === spec.requirement,
    );
    if (matches.length === 0) {
      findings.push(
        finding(
          "missing-evidence",
          spec.requirement,
          `${spec.requirement} evidence is missing.`,
          remediationFor(spec.requirement),
        ),
      );
      continue;
    }
    if (matches.length > 1) continue;
    const evidence = matches[0];
    if (evidence === undefined) continue;
    validateEvidence(input, spec, evidence, now, findings);
  }
  if (
    input.toEnvironment === "production" &&
    input.approverClass !== "release-controller" &&
    input.approverClass !== "emergency-controller"
  ) {
    findings.push(
      finding(
        "approval-mismatch",
        "human-approval",
        `${input.approverClass} cannot approve production promotion.`,
        "Obtain explicit release-controller or emergency-controller approval.",
      ),
    );
  }
  const censusSpec = specs.find(
    ({ requirement }) => requirement === "workflow-census",
  );
  if (censusSpec !== undefined) {
    const censusEvidence = input.evidence.find(
      ({ requirement }) => requirement === "workflow-census",
    );
    if (
      input.workflowCensus === undefined ||
      censusEvidence === undefined ||
      !isTime(input.workflowCensus.capturedAt) ||
      !isTime(input.workflowCensus.active) ||
      !isTime(input.workflowCensus.restartable) ||
      !sha256.test(input.workflowCensus.fingerprint) ||
      input.workflowCensus.fingerprint !== censusEvidence.fingerprint ||
      input.workflowCensus.capturedAt !== censusEvidence.observedAt
    ) {
      findings.push(
        finding(
          "census-mismatch",
          "workflow-census",
          "Active/restartable workflow census is absent or does not match its evidence fact.",
          "Capture the authorized target-environment census and bind its exact fingerprint and timestamp.",
        ),
      );
    }
  }
  if (findings.length > 0) return blocked(transition, findings);
  return Object.freeze({
    kind: "ready",
    transition,
    evidence: Object.freeze(
      input.evidence.map((evidence) => Object.freeze({ ...evidence })),
    ),
  });
};

const validateEvidence = (
  input: PromotionReadinessInput,
  spec: RequirementSpec,
  evidence: PromotionRequirementEvidence,
  now: number,
  findings: PromotionRequirementFinding[],
): void => {
  if (
    !commitSha.test(evidence.commitSha) ||
    !sha256.test(evidence.artifactHash) ||
    !sha256.test(evidence.fingerprint) ||
    !isTime(evidence.observedAt) ||
    !isTime(evidence.expiresAt) ||
    evidence.expiresAt <= evidence.observedAt
  ) {
    findings.push(
      finding(
        "invalid-evidence",
        spec.requirement,
        `${spec.requirement} evidence has an invalid binding, fingerprint, or validity window.`,
        remediationFor(spec.requirement),
      ),
    );
    return;
  }
  if (evidence.evidenceClass !== spec.evidenceClass) {
    findings.push(
      finding(
        "evidence-class-mismatch",
        spec.requirement,
        `${evidence.evidenceClass} evidence cannot satisfy ${spec.evidenceClass} requirement ${spec.requirement}.`,
        remediationFor(spec.requirement),
      ),
    );
  }
  if (
    evidence.environment !== input.toEnvironment ||
    evidence.targetId !== input.targetId ||
    evidence.commitSha !== input.commitSha ||
    evidence.artifactHash !== input.artifactHash
  ) {
    findings.push(
      finding(
        "evidence-binding-mismatch",
        spec.requirement,
        `${spec.requirement} evidence is bound to a different environment, target, commit, or artifact.`,
        remediationFor(spec.requirement),
      ),
    );
  }
  if (evidence.outcome !== "pass") {
    findings.push(
      finding(
        "evidence-failed",
        spec.requirement,
        `${spec.requirement} has not passed.`,
        remediationFor(spec.requirement),
      ),
    );
  }
  if (evidence.observedAt > now) {
    findings.push(
      finding(
        "future-evidence",
        spec.requirement,
        `${spec.requirement} evidence is dated after the verification clock.`,
        remediationFor(spec.requirement),
      ),
    );
  }
  if (evidence.expiresAt <= now) {
    findings.push(
      finding(
        "stale-evidence",
        spec.requirement,
        `${spec.requirement} evidence is stale.`,
        remediationFor(spec.requirement),
      ),
    );
  }
};

const remediationFor = (requirement: PromotionRequirement): string =>
  `Produce current ${requirement} evidence for the exact target environment, commit, and artifact.`;

const finding = (
  code: PromotionRequirementFindingCode,
  requirement: PromotionRequirement | undefined,
  detail: string,
  remediation: string,
): PromotionRequirementFinding =>
  Object.freeze({
    code,
    ...(requirement === undefined ? {} : { requirement }),
    detail,
    remediation,
  });

const blocked = (
  transition: string,
  findings: readonly PromotionRequirementFinding[],
): PromotionReadinessResult =>
  Object.freeze({
    kind: "blocked",
    transition,
    findings: Object.freeze([...findings]),
  });

const isTime = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;
