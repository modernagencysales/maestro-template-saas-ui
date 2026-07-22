import type { ContractReproofFinding } from "./contract-reproof.js";

export type IntegrationFindingOwnerKind = "task" | "integration";

export interface IntegrationFinding extends ContractReproofFinding {
  readonly ownerKind: IntegrationFindingOwnerKind;
}

export interface IntegrationFindingTaskSelection {
  readonly taskId: string;
  readonly fileLocks: readonly string[];
}

export interface ClassifiedIntegrationFindings {
  readonly findings: readonly IntegrationFinding[];
  readonly ownerKind: IntegrationFindingOwnerKind;
  readonly taskOwners: readonly string[];
}

const nonEmpty = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
};

const findingRecord = (value: unknown, index: number): IntegrationFinding => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`integration finding ${index + 1} must be an object`);
  }
  const finding = value as IntegrationFinding;
  nonEmpty(finding.id, `integration finding ${index + 1} id`);
  nonEmpty(finding.taskId, `${finding.id} taskId`);
  if (
    !new Set<IntegrationFindingOwnerKind>(["task", "integration"]).has(
      finding.ownerKind,
    )
  ) {
    throw new Error(`${finding.id}: unknown finding owner kind`);
  }
  if (
    !Array.isArray(finding.affectedPaths) ||
    finding.affectedPaths.length === 0
  ) {
    throw new Error(`${finding.id}: affectedPaths must not be empty`);
  }
  for (const path of finding.affectedPaths)
    nonEmpty(path, `${finding.id} affected path`);
  return finding;
};

export const classifyIntegrationFindings = (input: {
  readonly candidateHeadSha?: string;
  readonly findings: readonly unknown[];
  readonly integrationOwnedPaths: readonly string[];
  readonly selectedTasks: readonly IntegrationFindingTaskSelection[];
}): ClassifiedIntegrationFindings => {
  if (!Array.isArray(input.findings) || input.findings.length === 0) {
    throw new Error("integration rework requires findings");
  }
  const tasks = new Map(input.selectedTasks.map((task) => [task.taskId, task]));
  if (tasks.size !== input.selectedTasks.length) {
    throw new Error("duplicate selected task ownership");
  }
  const taskLockedPaths = new Set(
    input.selectedTasks.flatMap(({ fileLocks }) => fileLocks),
  );
  const integrationOwnedPaths = new Set(input.integrationOwnedPaths);
  for (const path of integrationOwnedPaths) {
    if (taskLockedPaths.has(path)) {
      throw new Error(`${path}: mixed task and integration ownership`);
    }
  }

  const findings = input.findings.map(findingRecord);
  if (new Set(findings.map(({ id }) => id)).size !== findings.length) {
    throw new Error("duplicate integration finding ID");
  }
  const ownerKinds = new Set(findings.map(({ ownerKind }) => ownerKind));
  if (ownerKinds.size !== 1)
    throw new Error("mixed integration finding ownership");

  const taskOwners = new Set<string>();
  for (const finding of findings) {
    if (!/^[0-9a-f]{40}$/.test(finding.candidateHeadSha)) {
      throw new Error(
        `${finding.id}: candidateHeadSha must be an exact Git SHA`,
      );
    }
    if (
      input.candidateHeadSha !== undefined &&
      finding.candidateHeadSha !== input.candidateHeadSha
    ) {
      throw new Error(`${finding.id}: candidate head mismatch`);
    }
    for (const [field, value] of [
      ["summary", finding.summary],
      ["details", finding.details],
      ["severity", finding.severity],
      ["expectedBehavior", finding.expectedBehavior],
      ["requiredRegressionProof", finding.requiredRegressionProof],
    ] as const) {
      nonEmpty(value, `${finding.id} ${field}`);
    }
    if (
      !Array.isArray(finding.priorEvidenceSha256) ||
      finding.priorEvidenceSha256.length === 0
    ) {
      throw new Error(`${finding.id}: priorEvidenceSha256 must not be empty`);
    }
    for (const digest of finding.priorEvidenceSha256) {
      if (!/^[0-9a-f]{64}$/.test(digest)) {
        throw new Error(`${finding.id}: prior evidence must be a SHA-256`);
      }
    }
    if (
      finding.changeExpectation !== "source_or_test_delta" &&
      finding.changeExpectation !== "evidence_only"
    ) {
      throw new Error(`${finding.id}: invalid changeExpectation`);
    }
    if (
      finding.changeExpectation === "evidence_only" &&
      !finding.evidenceOnlyRationale?.trim()
    ) {
      throw new Error(`${finding.id}: evidenceOnlyRationale is required`);
    }
    if (finding.ownerKind === "task") {
      const owner = tasks.get(finding.taskId);
      if (!owner)
        throw new Error(
          `${finding.id}: task ${finding.taskId} is not selected`,
        );
      const locks = new Set(owner.fileLocks);
      for (const path of finding.affectedPaths) {
        if (!locks.has(path))
          throw new Error(
            `${finding.id}: affected path is outside ${finding.taskId} locks`,
          );
      }
      taskOwners.add(finding.taskId);
      continue;
    }
    if (finding.taskId !== "integration") {
      throw new Error(
        `${finding.id}: integration finding must use integration owner`,
      );
    }
    for (const path of finding.affectedPaths) {
      if (!integrationOwnedPaths.has(path)) {
        throw new Error(
          `${finding.id}: affected path is outside integration ownership`,
        );
      }
    }
  }

  return {
    findings: [...findings].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    ownerKind: findings[0]?.ownerKind ?? "integration",
    taskOwners: [...taskOwners].sort(),
  };
};
