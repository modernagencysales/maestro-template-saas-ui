import { createHash } from "node:crypto";

import type { IntegrationWaveTaskSnapshot } from "./integration-wave.js";
import type { ContractReproofFinding } from "./contract-reproof.js";
import { validateIntegrationWaveSupersessionReceipt } from "./integration-wave-supersession.js";

export const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const record = (
  value: unknown,
  label: string,
): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

export const parseRecord = (
  content: string,
  label: string,
): Record<string, unknown> => {
  if (!content) throw new Error(`${label} is missing`);
  return record(JSON.parse(content), label);
};

export const exactSha = (
  value: unknown,
  label: string,
  length: 40 | 64,
): string => {
  if (
    typeof value !== "string" ||
    !new RegExp(`^[0-9a-f]{${length}}$`).test(value)
  ) {
    throw new Error(`${label} must be an exact ${length}-character SHA`);
  }
  return value;
};

const requiredString = (
  value: Record<string, unknown>,
  field: string,
  context: string,
): string => {
  const candidate = value[field];
  if (typeof candidate !== "string" || !candidate.trim()) {
    throw new Error(`${context}: ${field} must be a non-empty string`);
  }
  return candidate.trim();
};

export const validateIntegrationReproofFindings = (input: {
  readonly candidateHeadSha: string;
  readonly evidenceContents: readonly string[];
  readonly findings: readonly unknown[];
  readonly integrationId: string;
  readonly reason: string;
  readonly selected: IntegrationWaveTaskSnapshot;
  readonly taskId: string;
}): readonly ContractReproofFinding[] => {
  const ownerLocks = new Set(input.selected.fileLocks);
  const evidenceSha256 = [
    ...new Set(input.evidenceContents.map(sha256)),
  ].sort();
  const findingValues =
    input.findings.length > 0
      ? input.findings
      : [
          {
            id: `${input.integrationId}-${input.taskId}-broad-gate-failure`,
            taskId: input.taskId,
            summary: "The authoritative broad integration gate failed.",
            details: input.reason,
            severity: "high",
            affectedPaths: input.selected.changedFiles,
            expectedBehavior:
              "The authoritative broad integration gate passes.",
            requiredRegressionProof:
              "Run rtk host-test-slot --class full pnpm verify successfully.",
            changeExpectation: "evidence_only",
            evidenceOnlyRationale:
              "A broad-gate-only failure may close with exact successful gate evidence.",
          },
        ];
  const findings = findingValues.map((value, index) => {
    const context = `failed integration finding ${index + 1}`;
    const finding = record(value, context);
    if (finding.taskId !== input.taskId) {
      throw new Error("failed integration finding owner mismatch");
    }
    const id = requiredString(finding, "id", context);
    if (
      !Array.isArray(finding.affectedPaths) ||
      finding.affectedPaths.length === 0
    ) {
      throw new Error(`${id}: affectedPaths must not be empty`);
    }
    const affectedPaths = finding.affectedPaths.map((path) => {
      if (typeof path !== "string" || !path.trim()) {
        throw new Error(`${id}: affectedPath must be a non-empty string`);
      }
      if (!ownerLocks.has(path)) {
        throw new Error(`${id}: affected path is outside selected owner locks`);
      }
      return path;
    });
    const changeExpectation = finding.changeExpectation;
    if (
      changeExpectation !== "source_or_test_delta" &&
      changeExpectation !== "evidence_only"
    ) {
      throw new Error(`${id}: invalid changeExpectation`);
    }
    const evidenceOnlyRationale =
      typeof finding.evidenceOnlyRationale === "string"
        ? finding.evidenceOnlyRationale.trim()
        : undefined;
    if (changeExpectation === "evidence_only" && !evidenceOnlyRationale) {
      throw new Error(`${id}: evidenceOnlyRationale is required`);
    }
    return {
      id,
      taskId: input.taskId,
      candidateHeadSha: exactSha(
        input.candidateHeadSha,
        `${id}: candidateHeadSha`,
        40,
      ),
      summary: requiredString(finding, "summary", id),
      details: requiredString(finding, "details", id),
      severity: requiredString(finding, "severity", id),
      affectedPaths,
      expectedBehavior: requiredString(finding, "expectedBehavior", id),
      requiredRegressionProof: requiredString(
        finding,
        "requiredRegressionProof",
        id,
      ),
      priorEvidenceSha256: evidenceSha256,
      changeExpectation,
      ...(evidenceOnlyRationale ? { evidenceOnlyRationale } : {}),
    } satisfies ContractReproofFinding;
  });
  if (new Set(findings.map(({ id }) => id)).size !== findings.length) {
    throw new Error("duplicate failed integration finding ID");
  }
  return findings;
};

export const sameRecord = (
  actual: unknown,
  expected: Record<string, unknown>,
  label: string,
): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} drift`);
  }
};

export const validateLaneBindings = (input: {
  readonly gate: Record<string, unknown>;
  readonly gateContent: string;
  readonly lane: Record<string, unknown>;
  readonly laneContent: string;
  readonly proof: Record<string, unknown>;
  readonly proofContent: string;
  readonly selected: IntegrationWaveTaskSnapshot;
  readonly taskId: string;
}): void => {
  if (
    input.lane.status !== "lane_green" ||
    input.lane.taskId !== input.taskId ||
    input.selected.taskId !== input.taskId
  ) {
    throw new Error(`${input.taskId}: task owner mismatch`);
  }
  if (sha256(input.laneContent) !== input.selected.laneResultSha256) {
    throw new Error(`${input.taskId}: lane result digest drift`);
  }
  if (sha256(input.proofContent) !== input.selected.proofSha256) {
    throw new Error(`${input.taskId}: proof digest drift`);
  }
  if (sha256(input.gateContent) !== input.selected.gateSha256) {
    throw new Error(`${input.taskId}: gate digest drift`);
  }
  if (
    input.selected.headSha !== input.lane.headSha ||
    input.selected.proofHeadSha !== input.lane.headSha ||
    input.selected.gateHeadSha !== input.lane.headSha ||
    input.proof.headSha !== input.lane.headSha ||
    input.proof.reviewHeadSha !== input.lane.headSha ||
    input.gate.headSha !== input.lane.headSha ||
    input.gate.currentHeadSha !== input.lane.headSha
  ) {
    throw new Error(`${input.taskId}: lane proof/gate head drift`);
  }
  if (
    input.proof.planSha256 !== input.selected.planSha256 ||
    input.gate.planSha256 !== input.selected.planSha256 ||
    input.proof.taskBlockHash !== input.selected.taskBlockHash ||
    input.gate.taskBlockHash !== input.selected.taskBlockHash
  ) {
    throw new Error(`${input.taskId}: lane authority binding drift`);
  }
  if (
    input.proof.reviewVerdict !== "pass" ||
    input.gate.status !== "passed" ||
    input.gate.stage !== "final"
  ) {
    throw new Error(`${input.taskId}: lane proof/gate is not green`);
  }
};

export const validateFailedBroadGate = (input: {
  readonly broadGate: Record<string, unknown>;
  readonly candidateHeadSha: string;
}): void => {
  const { broadGate } = input;
  if (broadGate.status !== "failed") {
    throw new Error("failed integration broad gate is not failed");
  }
  if (broadGate.headSha !== input.candidateHeadSha) {
    throw new Error("failed integration broad gate candidate head drift");
  }
  if (broadGate.command !== "rtk host-test-slot --class full pnpm verify") {
    throw new Error("failed integration broad gate command drift");
  }
  if (!Array.isArray(broadGate.attempts) || broadGate.attempts.length === 0) {
    throw new Error("failed integration broad gate has no attempts");
  }
  for (const [index, value] of broadGate.attempts.entries()) {
    const attempt = record(value, `broad gate attempt ${index + 1}`);
    if (
      attempt.attempt !== index + 1 ||
      attempt.status !== "failed" ||
      attempt.headSha !== input.candidateHeadSha ||
      attempt.command !== broadGate.command ||
      typeof attempt.outputSha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(attempt.outputSha256)
    ) {
      throw new Error(`broad gate attempt ${index + 1} identity drift`);
    }
  }
};

const typeCoverageObservation = (
  value: unknown,
  expectedHeadSha: string,
  label: "base" | "candidate",
): { readonly covered: number; readonly total: number } => {
  const observation = record(value, `${label} type coverage`);
  if (
    observation.headSha !== expectedHeadSha ||
    !Number.isInteger(observation.exitCode) ||
    typeof observation.output !== "string"
  )
    throw new Error(`${label} type coverage identity drift`);
  const match = /\((\d+)\s*\/\s*(\d+)\)\s*([0-9]+(?:\.[0-9]+)?)%/.exec(
    observation.output,
  );
  if (!match?.[1] || !match[2] || !match[3])
    throw new Error(`${label} type coverage output is invalid`);
  const covered = Number(match[1]);
  const total = Number(match[2]);
  const displayed = Number(match[3]);
  if (
    !Number.isSafeInteger(covered) ||
    !Number.isSafeInteger(total) ||
    covered < 0 ||
    total <= 0 ||
    covered > total ||
    Math.abs((covered / total) * 100 - displayed) > 0.011
  )
    throw new Error(`${label} type coverage output is inconsistent`);
  return { covered, total };
};

export const validateTypeCoverageRegression = (input: {
  readonly baseSha: string;
  readonly candidateHeadSha: string;
  readonly content: string;
  readonly taskId: string;
}): void => {
  const evidence = parseRecord(input.content, "type coverage regression");
  if (
    evidence.schemaVersion !== "maestro-brain-type-coverage-regression/v1" ||
    evidence.taskId !== input.taskId ||
    evidence.command !== "rtk pnpm check:types-coverage"
  )
    throw new Error("type coverage regression identity drift");
  const base = typeCoverageObservation(evidence.base, input.baseSha, "base");
  const candidateRecord = record(evidence.candidate, "candidate type coverage");
  const candidate = typeCoverageObservation(
    candidateRecord,
    input.candidateHeadSha,
    "candidate",
  );
  if (
    candidateRecord.exitCode === 0 ||
    candidate.covered * base.total >= base.covered * candidate.total
  )
    throw new Error("candidate type coverage did not regress and fail");
};

export const isTypeCoverageFindingId = (value: string): boolean =>
  value.includes("type-coverage");

export const integrationResultBindsBroadGate = (
  integrationResult: Record<string, unknown>,
): boolean =>
  typeof integrationResult.broadGate === "object" &&
  integrationResult.broadGate !== null &&
  !Array.isArray(integrationResult.broadGate);

export const failedWaveSelectsTask = (
  selectedTaskIds: readonly string[],
  taskId: string,
): boolean => selectedTaskIds.includes(taskId);

export const supersessionBindsFailedAttempt = (
  runAttempts: readonly { readonly runId: string; readonly status: string }[],
  evidence: readonly string[],
): boolean =>
  runAttempts.some(
    ({ runId, status }) =>
      new Set(["failed", "owner_rework"]).has(status) &&
      evidence.includes(`run:${runId}:${status}`),
  );

export const validateSupersession = (input: {
  readonly broadGateContent?: string;
  readonly currentControlHead: string;
  readonly integrationResultContent: string;
  readonly isAncestor: (ancestor: string, descendant: string) => boolean;
  readonly integrationId: string;
  readonly runRecordContent: string;
  readonly selectionContent: string;
  readonly selectionPath: string;
  readonly supersession: Record<string, unknown>;
  readonly taskId: string;
}): void => {
  const validated = validateIntegrationWaveSupersessionReceipt({
    currentControlHead: input.currentControlHead,
    expectedIntegrationId: input.integrationId,
    isAncestor: input.isAncestor,
    receipt: input.supersession,
    runRecordContent: input.runRecordContent,
    selectionContent: input.selectionContent,
    selectionPath: input.selectionPath,
  });
  if (
    validated.runAttempts.length === 0 ||
    validated.runAttempts.some(
      ({ status }, index) =>
        status !== "failed" &&
        !(
          status === "owner_rework" &&
          index === validated.runAttempts.length - 1
        ),
    ) ||
    !failedWaveSelectsTask(validated.selectedTaskIds, input.taskId)
  ) {
    throw new Error("failed integration wave is not terminal failed");
  }
  const evidence = validated.evidence;
  const broadGateEvidence = evidence.filter((item) =>
    item.startsWith("broad-gate-sha256:"),
  );
  const integrationResultEvidence = evidence.filter((item) =>
    item.startsWith("integration-result-sha256:"),
  );
  if (
    (input.broadGateContent !== undefined &&
      broadGateEvidence.length > 0 &&
      !broadGateEvidence.includes(
        `broad-gate-sha256:${sha256(input.broadGateContent)}`,
      )) ||
    (input.broadGateContent === undefined && broadGateEvidence.length > 0) ||
    (integrationResultEvidence.length > 0 &&
      !integrationResultEvidence.includes(
        `integration-result-sha256:${sha256(input.integrationResultContent)}`,
      )) ||
    !supersessionBindsFailedAttempt(validated.runAttempts, evidence)
  ) {
    throw new Error("failed integration supersession evidence drift");
  }
};
