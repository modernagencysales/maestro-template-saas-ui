import { createHash } from "node:crypto";

import {
  classifyIntegrationFindings,
  type IntegrationFinding,
} from "./integration-finding.js";
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
  readonly ownerRoutes: readonly IntegrationOwnerRoute[];
  readonly ownerTaskIds: readonly string[];
  readonly resultSha256: string;
  readonly selectionFileSha256: string;
  readonly selectionPayloadSha256: string;
}

export interface IntegrationOwnerRoute {
  readonly findingIds: readonly string[];
  readonly findings: readonly IntegrationFinding[];
  readonly findingSha256: string;
  readonly taskId: string;
}

export interface OwnerReworkRoutingReceipt {
  readonly schemaVersion: "maestro-brain-owner-rework-routing/v1";
  readonly findingSha256: string;
  readonly owners: Readonly<
    Record<
      string,
      {
        readonly findingsSha256: string;
        readonly requestSha256?: string;
        readonly runId?: string;
        readonly status: "pending" | "launched";
      }
    >
  >;
  readonly resultSha256: string;
  readonly selectionFileSha256: string;
  readonly selectionPayloadSha256: string;
  readonly status: "planned" | "superseded" | "complete";
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
  const ownerRoutes = classified.taskOwners.map((taskId) => {
    const findings = classified.findings.filter(
      (finding) => finding.taskId === taskId,
    );
    return {
      findingIds: findings.map(({ id }) => id),
      findings,
      findingSha256: sha256(JSON.stringify(findings)),
      taskId,
    };
  });
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
  const reopen = ownerRoutes.map(
    ({ findingSha256: ownerFindingSha256, taskId }) => [
      "pnpm",
      "brain:factory:reopen",
      "--",
      "--task",
      taskId,
      "--reason",
      reason,
      "--failed-integration",
      selection.integrationId,
      "--owner-findings-sha256",
      ownerFindingSha256,
      "--launch",
      "--state",
      input.stateRoot,
    ],
  );
  return {
    commands: [supersede, ...reopen],
    findingSha256,
    ownerRoutes,
    ownerTaskIds: classified.taskOwners,
    resultSha256,
    selectionFileSha256: selectionRead.selectionFileSha256,
    selectionPayloadSha256: selectionRead.selectionPayloadSha256,
  };
};

const initialRoutingReceipt = (
  route: IntegrationOwnerReworkRoute,
): OwnerReworkRoutingReceipt => ({
  schemaVersion: "maestro-brain-owner-rework-routing/v1",
  findingSha256: route.findingSha256,
  owners: Object.fromEntries(
    route.ownerRoutes.map((owner) => [
      owner.taskId,
      { findingsSha256: owner.findingSha256, status: "pending" as const },
    ]),
  ),
  resultSha256: route.resultSha256,
  selectionFileSha256: route.selectionFileSha256,
  selectionPayloadSha256: route.selectionPayloadSha256,
  status: "planned",
});

export const executeIntegrationOwnerReworkRoute = (
  route: IntegrationOwnerReworkRoute,
  operations: {
    readonly loadReceipt: () => OwnerReworkRoutingReceipt | undefined;
    readonly reopen: (owner: IntegrationOwnerRoute) => void;
    readonly reservationFor: (taskId: string) =>
      | {
          readonly findingsSha256: string;
          readonly requestSha256: string;
          readonly runId: string;
        }
      | undefined;
    readonly saveReceipt: (receipt: OwnerReworkRoutingReceipt) => void;
    readonly supersede: () => void;
  },
): OwnerReworkRoutingReceipt => {
  const expected = initialRoutingReceipt(route);
  let receipt = operations.loadReceipt() ?? expected;
  if (
    receipt.schemaVersion !== expected.schemaVersion ||
    receipt.findingSha256 !== expected.findingSha256 ||
    receipt.resultSha256 !== expected.resultSha256 ||
    receipt.selectionFileSha256 !== expected.selectionFileSha256 ||
    receipt.selectionPayloadSha256 !== expected.selectionPayloadSha256 ||
    JSON.stringify(Object.keys(receipt.owners).sort()) !==
      JSON.stringify(route.ownerTaskIds) ||
    route.ownerRoutes.some(
      (owner) =>
        receipt.owners[owner.taskId]?.findingsSha256 !== owner.findingSha256,
    )
  ) {
    throw new Error("owner rework routing receipt identity mismatch");
  }
  const persist = (value: OwnerReworkRoutingReceipt): void => {
    receipt = value;
    operations.saveReceipt(value);
  };
  if (!operations.loadReceipt()) persist(receipt);
  if (receipt.status === "planned") {
    operations.supersede();
    persist({ ...receipt, status: "superseded" });
  }
  for (const owner of route.ownerRoutes) {
    let reservation = operations.reservationFor(owner.taskId);
    if (receipt.owners[owner.taskId]?.status === "launched") {
      if (
        !reservation ||
        reservation.findingsSha256 !== owner.findingSha256 ||
        reservation.requestSha256 !==
          receipt.owners[owner.taskId]?.requestSha256 ||
        reservation.runId !== receipt.owners[owner.taskId]?.runId
      ) {
        throw new Error(`${owner.taskId}: launched owner evidence drift`);
      }
      continue;
    }
    if (!reservation) {
      operations.reopen(owner);
      reservation = operations.reservationFor(owner.taskId);
    }
    if (!reservation) {
      throw new Error(`${owner.taskId}: durable owner reservation is missing`);
    }
    if (
      reservation.findingsSha256 !== owner.findingSha256 ||
      !/^[0-9a-f]{64}$/.test(reservation.requestSha256) ||
      !reservation.runId.trim()
    ) {
      throw new Error(`${owner.taskId}: durable owner reservation is invalid`);
    }
    persist({
      ...receipt,
      owners: {
        ...receipt.owners,
        [owner.taskId]: {
          findingsSha256: owner.findingSha256,
          requestSha256: reservation.requestSha256,
          runId: reservation.runId,
          status: "launched",
        },
      },
    });
  }
  if (receipt.status !== "complete")
    persist({ ...receipt, status: "complete" });
  return receipt;
};
