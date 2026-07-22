import { createHash } from "node:crypto";

import { classifyIntegrationFindings } from "./integration-finding.js";
import { readIntegrationWaveSelection } from "./integration-wave.js";

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const exactDigest = (actual: string, expected: string, label: string): void => {
  if (!/^[0-9a-f]{64}$/.test(expected) || actual !== expected) {
    throw new Error(`${label} hash mismatch`);
  }
};

const record = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

export interface IntegrationOwnerReworkRoute {
  readonly commands: readonly (readonly string[])[];
  readonly findingSha256: string;
  readonly ownerTaskIds: readonly string[];
  readonly resultSha256: string;
  readonly selectionFileSha256: string;
  readonly selectionPayloadSha256: string;
}

export const planIntegrationOwnerReworkRoute = (input: {
  readonly expectedHeadSha?: string;
  readonly expectedIntegrationId: string;
  readonly expectedResultSha256: string;
  readonly expectedSelectionFileSha256: string;
  readonly expectedSelectionPayloadSha256: string;
  readonly integrationOwnedPaths: readonly string[];
  readonly integrationResultContent: string;
  readonly selectionContent: string;
  readonly stateRoot: string;
}): IntegrationOwnerReworkRoute => {
  const selectionRead = readIntegrationWaveSelection(input.selectionContent);
  const { selection } = selectionRead;
  if (selection.integrationId !== input.expectedIntegrationId) {
    throw new Error("integration route selection identity mismatch");
  }
  exactDigest(
    selectionRead.selectionFileSha256,
    input.expectedSelectionFileSha256,
    "selection file",
  );
  exactDigest(
    selectionRead.selectionPayloadSha256,
    input.expectedSelectionPayloadSha256,
    "selection payload",
  );
  const resultSha256 = sha256(input.integrationResultContent);
  exactDigest(resultSha256, input.expectedResultSha256, "integration result");
  const result = record(
    JSON.parse(input.integrationResultContent) as unknown,
    "integration result",
  );
  if (
    typeof result.headSha !== "string" ||
    !/^[0-9a-f]{40}$/.test(result.headSha) ||
    (input.expectedHeadSha !== undefined &&
      result.headSha !== input.expectedHeadSha)
  ) {
    throw new Error("integration route candidate head mismatch");
  }
  if (
    result.integrationId !== selection.integrationId ||
    result.baseSha !== selection.baseSha ||
    result.selectionFileSha256 !== selectionRead.selectionFileSha256 ||
    result.selectionPayloadSha256 !== selectionRead.selectionPayloadSha256 ||
    result.status !== "ready_for_review" ||
    result.reviewVerdict !== "rework" ||
    !Array.isArray(result.remainingFindings)
  ) {
    throw new Error("integration route result identity mismatch");
  }
  const classified = classifyIntegrationFindings({
    candidateHeadSha: result.headSha,
    findings: result.remainingFindings,
    integrationOwnedPaths: input.integrationOwnedPaths,
    selectedTasks: selection.selectedTasks,
  });
  if (classified.ownerKind !== "task") {
    throw new Error("integration-owned findings cannot route to task owners");
  }
  const findingSha256 = sha256(JSON.stringify(classified.findings));
  const reason = `route ${selection.integrationId} task-owned integration findings`;
  const evidence = [
    `integration-result-sha256:${resultSha256}`,
    `selection-file-sha256:${selectionRead.selectionFileSha256}`,
    `selection-payload-sha256:${selectionRead.selectionPayloadSha256}`,
    `findings-sha256:${findingSha256}`,
  ];
  const supersede = [
    "pnpm",
    "brain:factory:supersede-wave",
    "--",
    "--integration-id",
    selection.integrationId,
    "--reason",
    reason,
    "--owner-rework-result-sha256",
    resultSha256,
    ...evidence.flatMap((item) => ["--evidence", item]),
    "--state",
    input.stateRoot,
  ];
  const reopen = classified.taskOwners.map((taskId) => [
    "pnpm",
    "brain:factory:reopen",
    "--",
    "--task",
    taskId,
    "--reason",
    reason,
    "--failed-integration",
    selection.integrationId,
    "--launch",
    "--state",
    input.stateRoot,
  ]);
  return {
    commands: [supersede, ...reopen],
    findingSha256,
    ownerTaskIds: classified.taskOwners,
    resultSha256,
    selectionFileSha256: selectionRead.selectionFileSha256,
    selectionPayloadSha256: selectionRead.selectionPayloadSha256,
  };
};
