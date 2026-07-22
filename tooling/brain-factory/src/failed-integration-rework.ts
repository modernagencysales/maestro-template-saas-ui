import {
  buildContractReproofFindingsRequest,
  type ContractReproofRequest,
} from "./contract-reproof.js";
import {
  FAILED_INTEGRATION_REWORK_ARCHIVE_SCHEMA,
  type FailedIntegrationReworkArchive,
} from "./failed-integration-rework-archive.js";
import {
  exactSha,
  parseRecord,
  record,
  sameRecord,
  sha256,
  validateFailedBroadGate,
  isTypeCoverageFindingId,
  validateLaneBindings,
  validateSupersession,
  validateTypeCoverageRegression,
  validateIntegrationReproofFindings,
} from "./failed-integration-rework-validation.js";
import { readIntegrationWaveSelection } from "./integration-wave.js";
import { classifyIntegrationFindings } from "./integration-finding.js";

interface FailedIntegrationReworkInput {
  readonly broadGateContent?: string;
  readonly controlClean: boolean;
  readonly controlHeadSha: string;
  readonly dependenciesIntegrated: boolean;
  readonly expectedSourceBranch: string;
  readonly gateContent: string;
  readonly integrationResultContent: string;
  readonly isAncestor: (ancestor: string, descendant: string) => boolean;
  readonly laneContent: string;
  readonly manifestTaskBlockHash: string;
  readonly planSha256: string;
  readonly priorEvidencePath: string;
  readonly promotionExists: boolean;
  readonly proofContent: string;
  readonly reason: string;
  readonly runRecordContent: string;
  readonly selectionContent: string;
  readonly selectionPath: string;
  readonly sourceBranch: string;
  readonly sourceBranchHeadSha: string;
  readonly sourceClean: boolean;
  readonly sourceWorktreeHeadSha: string;
  readonly supersessionContent: string;
  readonly taskId: string;
  readonly typeCoverageRegressionContent?: string;
}

export interface FailedIntegrationReworkPlan {
  readonly archive: FailedIntegrationReworkArchive;
  readonly archiveContent: string;
  readonly request: ContractReproofRequest;
}

export const planFailedIntegrationRework = (
  input: FailedIntegrationReworkInput,
): FailedIntegrationReworkPlan => {
  if (!input.controlClean) throw new Error("control worktree is not clean");
  if (!input.sourceClean) throw new Error("source worktree is not clean");
  if (input.promotionExists)
    throw new Error("failed integration was already promoted");
  if (!input.dependenciesIntegrated) {
    throw new Error(`${input.taskId}: dependencies are not integrated`);
  }
  if (input.sourceBranch !== input.expectedSourceBranch) {
    throw new Error(`${input.taskId}: source branch drift`);
  }

  const selectionRead = readIntegrationWaveSelection(input.selectionContent);
  const { selection } = selectionRead;
  // A failed wave may contain multiple lanes. Rework is still scoped to the
  // lane owning the finding; retain the immutable wave identity while
  // selecting that one task's proof for the reproof request.
  const selected = selection.selectedTasks.find(
    (candidate) => candidate.taskId === input.taskId,
  );
  if (!selected || selected.taskId !== input.taskId) {
    throw new Error(`${input.taskId}: task owner mismatch`);
  }
  if (selected.taskBlockHash !== input.manifestTaskBlockHash) {
    throw new Error(`${input.taskId}: task-block drift`);
  }
  if (!input.isAncestor(selection.baseSha, input.controlHeadSha)) {
    throw new Error(
      "failed integration wave base is not an ancestor of control HEAD",
    );
  }

  const lane = parseRecord(input.laneContent, "lane result");
  const proof = parseRecord(input.proofContent, "lane proof");
  const gate = parseRecord(input.gateContent, "lane gate");
  validateLaneBindings({
    gate,
    gateContent: input.gateContent,
    lane,
    laneContent: input.laneContent,
    proof,
    proofContent: input.proofContent,
    selected,
    taskId: input.taskId,
  });
  if (
    input.sourceBranchHeadSha !== selected.headSha ||
    input.sourceWorktreeHeadSha !== selected.headSha
  ) {
    throw new Error(`${input.taskId}: source head drift`);
  }

  const integrationResult = parseRecord(
    input.integrationResultContent,
    "integration result",
  );
  const reviewOnly = input.broadGateContent === undefined;
  const allRemainingFindings = Array.isArray(
    integrationResult.remainingFindings,
  )
    ? integrationResult.remainingFindings
    : [];
  const structuredOwnership =
    allRemainingFindings.length > 0 &&
    allRemainingFindings.every(
      (finding) =>
        typeof finding === "object" &&
        finding !== null &&
        !Array.isArray(finding) &&
        Object.hasOwn(finding, "ownerKind"),
    );
  const remainingFindings = structuredOwnership
    ? classifyIntegrationFindings({
        candidateHeadSha: String(integrationResult.headSha ?? ""),
        findings: allRemainingFindings,
        integrationOwnedPaths: Array.isArray(integrationResult.generatedFiles)
          ? integrationResult.generatedFiles.filter(
              (path): path is string => typeof path === "string",
            )
          : [],
        selectedTasks: selection.selectedTasks,
      }).findings.filter((finding) => finding.taskId === input.taskId)
    : allRemainingFindings.filter(
        (finding) =>
          typeof finding === "object" &&
          finding !== null &&
          !Array.isArray(finding) &&
          (finding as Record<string, unknown>).taskId === input.taskId,
      );
  if (allRemainingFindings.length > 0 && remainingFindings.length === 0) {
    throw new Error("failed integration finding owner mismatch");
  }
  const semanticRework =
    integrationResult.status === (reviewOnly ? "ready_for_review" : "rework") &&
    integrationResult.reviewVerdict === "rework" &&
    allRemainingFindings.length > 0 &&
    remainingFindings.length > 0;
  const broadGateOnlyFailure =
    !reviewOnly &&
    integrationResult.status === "ready_for_review" &&
    integrationResult.reviewVerdict === "pass" &&
    remainingFindings.length === 0;
  if (
    integrationResult.schemaVersion !== "maestro-brain-integration-result/v3" ||
    (!semanticRework && !broadGateOnlyFailure)
  ) {
    throw new Error("failed integration result status is invalid");
  }
  const candidateHeadSha = exactSha(
    integrationResult.headSha,
    "failed integration candidate head",
    40,
  );
  if (
    integrationResult.integrationId !== selection.integrationId ||
    integrationResult.baseSha !== selection.baseSha ||
    integrationResult.selectionFileSha256 !==
      selectionRead.selectionFileSha256 ||
    integrationResult.selectionPayloadSha256 !==
      selectionRead.selectionPayloadSha256
  ) {
    throw new Error("failed integration result selection identity drift");
  }
  const findingIds: string[] = [];
  for (const findingValue of remainingFindings) {
    const finding = record(findingValue, "failed integration finding");
    if (finding.taskId !== input.taskId) {
      throw new Error("failed integration finding owner mismatch");
    }
    if (typeof finding.id !== "string" || !finding.id.trim()) {
      throw new Error("failed integration finding identity is missing");
    }
    findingIds.push(finding.id);
  }

  const evidenceContents = [
    input.selectionContent,
    input.integrationResultContent,
    input.laneContent,
    input.proofContent,
    input.gateContent,
    input.runRecordContent,
    input.supersessionContent,
    ...(input.broadGateContent === undefined ? [] : [input.broadGateContent]),
    ...(input.typeCoverageRegressionContent === undefined
      ? []
      : [input.typeCoverageRegressionContent]),
  ];
  const findings = validateIntegrationReproofFindings({
    candidateHeadSha,
    evidenceContents,
    findings: remainingFindings,
    integrationId: selection.integrationId,
    reason: input.reason,
    selected,
    taskId: input.taskId,
  });

  if (reviewOnly) {
    if (
      integrationResult.broadGate !== null &&
      integrationResult.broadGate !== undefined
    )
      throw new Error("review rework unexpectedly contains a broad gate");
  } else {
    const broadGate = parseRecord(input.broadGateContent, "broad gate receipt");
    validateFailedBroadGate({ broadGate, candidateHeadSha });
    if (broadGateOnlyFailure) {
      const embeddedBroadGate = record(
        integrationResult.broadGate,
        "integration broad gate",
      );
      const embeddedAttempts = Array.isArray(embeddedBroadGate.attempts)
        ? embeddedBroadGate.attempts
        : [];
      const currentAttempts = Array.isArray(broadGate.attempts)
        ? broadGate.attempts
        : [];
      if (embeddedAttempts.length > currentAttempts.length) {
        throw new Error("integration broad gate drift");
      }
      sameRecord(
        embeddedBroadGate,
        {
          ...broadGate,
          attempts: currentAttempts.slice(0, embeddedAttempts.length),
        },
        "integration broad gate",
      );
    } else {
      sameRecord(
        integrationResult.broadGate,
        broadGate,
        "integration broad gate",
      );
    }
  }
  if (findingIds.some(isTypeCoverageFindingId)) {
    if (reviewOnly)
      throw new Error("type coverage rework requires a failed broad gate");
    if (!input.typeCoverageRegressionContent)
      throw new Error("type coverage regression evidence is missing");
    validateTypeCoverageRegression({
      baseSha: selection.baseSha,
      candidateHeadSha,
      content: input.typeCoverageRegressionContent,
      taskId: input.taskId,
    });
  }

  const supersession = parseRecord(
    input.supersessionContent,
    "supersession receipt",
  );
  validateSupersession({
    ...(input.broadGateContent === undefined
      ? {}
      : { broadGateContent: input.broadGateContent }),
    currentControlHead: input.controlHeadSha,
    isAncestor: input.isAncestor,
    integrationId: selection.integrationId,
    integrationResultContent: input.integrationResultContent,
    runRecordContent: input.runRecordContent,
    selectionContent: input.selectionContent,
    selectionPath: input.selectionPath,
    supersession,
    taskId: input.taskId,
  });

  const archive: FailedIntegrationReworkArchive = {
    schemaVersion: FAILED_INTEGRATION_REWORK_ARCHIVE_SCHEMA,
    taskId: input.taskId,
    integrationId: selection.integrationId,
    candidateHeadSha,
    sourceBranch: input.sourceBranch,
    selectionContent: input.selectionContent,
    integrationResultContent: input.integrationResultContent,
    ...(input.broadGateContent === undefined
      ? {}
      : { broadGateContent: input.broadGateContent }),
    supersessionContent: input.supersessionContent,
    laneContent: input.laneContent,
    proofContent: input.proofContent,
    runRecordContent: input.runRecordContent,
    finalGateContent: input.gateContent,
    selectionPath: input.selectionPath,
    ...(input.typeCoverageRegressionContent
      ? {
          typeCoverageRegressionContent: input.typeCoverageRegressionContent,
        }
      : {}),
  };
  const archiveContent = `${JSON.stringify(archive, null, 2)}\n`;
  const request = buildContractReproofFindingsRequest({
    controlHeadSha: input.controlHeadSha,
    planSha256: input.planSha256,
    priorArchiveSha256: sha256(archiveContent),
    priorEvidencePath: input.priorEvidencePath,
    priorIntegrationHeadSha: selection.baseSha,
    priorIntegrationId: selection.integrationId,
    priorIntegrationResultSha256: sha256(input.integrationResultContent),
    priorLaneResultSha256: sha256(input.laneContent),
    reason: input.reason,
    taskBlockHash: input.manifestTaskBlockHash,
    taskId: input.taskId,
    findings,
  });
  return { archive, archiveContent, request };
};
