import { createHash } from "node:crypto";

export const CONTRACT_REPROOF_SCHEMA =
  "maestro-brain-contract-reproof/v1" as const;

export interface ContractReproofRequest {
  readonly controlHeadSha: string;
  readonly planSha256: string;
  readonly priorArchiveSha256: string;
  readonly priorIntegrationHeadSha: string;
  readonly priorIntegrationId: string;
  readonly priorIntegrationResultSha256: string;
  readonly priorLaneResultSha256: string;
  readonly priorEvidencePath: string;
  readonly reason: string;
  readonly requestSha256: string;
  readonly schemaVersion: typeof CONTRACT_REPROOF_SCHEMA;
  readonly taskBlockHash: string;
  readonly taskId: string;
}

type ReproofPayload = Omit<ContractReproofRequest, "requestSha256">;

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const exactSha = (value: string, label: string, length: 40 | 64): string => {
  if (!new RegExp(`^[0-9a-f]{${length}}$`).test(value)) {
    throw new Error(`${label} must be an exact ${length}-character SHA`);
  }
  return value;
};

const safeSegment = (value: string, label: string): string => {
  if (!/^[A-Za-z0-9._-]+$/.test(value) || value === "." || value === "..") {
    throw new Error(`${label} is not a safe segment`);
  }
  return value;
};

const payloadHash = (payload: ReproofPayload): string =>
  sha256(JSON.stringify(payload));

export const buildContractReproofRequest = (input: {
  readonly controlHeadSha: string;
  readonly planSha256: string;
  readonly priorArchiveSha256: string;
  readonly priorIntegrationHeadSha: string;
  readonly priorIntegrationId: string;
  readonly priorIntegrationResultSha256: string;
  readonly priorLaneResultSha256: string;
  readonly priorEvidencePath: string;
  readonly reason: string;
  readonly taskBlockHash: string;
  readonly taskId: string;
}): ContractReproofRequest => {
  const payload = {
    schemaVersion: CONTRACT_REPROOF_SCHEMA,
    taskId: safeSegment(input.taskId, "taskId"),
    reason: input.reason.trim(),
    controlHeadSha: exactSha(input.controlHeadSha, "controlHeadSha", 40),
    planSha256: exactSha(input.planSha256, "planSha256", 64),
    taskBlockHash: exactSha(input.taskBlockHash, "taskBlockHash", 64),
    priorIntegrationId: safeSegment(
      input.priorIntegrationId,
      "priorIntegrationId",
    ),
    priorIntegrationHeadSha: exactSha(
      input.priorIntegrationHeadSha,
      "priorIntegrationHeadSha",
      40,
    ),
    priorIntegrationResultSha256: exactSha(
      input.priorIntegrationResultSha256,
      "priorIntegrationResultSha256",
      64,
    ),
    priorLaneResultSha256: exactSha(
      input.priorLaneResultSha256,
      "priorLaneResultSha256",
      64,
    ),
    priorArchiveSha256: exactSha(
      input.priorArchiveSha256,
      "priorArchiveSha256",
      64,
    ),
    priorEvidencePath: input.priorEvidencePath,
  } satisfies ReproofPayload;
  if (!payload.reason) throw new Error("reproof reason must not be empty");
  if (!payload.priorEvidencePath) {
    throw new Error("priorEvidencePath must not be empty");
  }
  return { ...payload, requestSha256: payloadHash(payload) };
};

export const validateContractReproofRequest = (
  value: unknown,
  expected: {
    readonly controlHeadSha: string;
    readonly planSha256: string;
    readonly taskBlockHash: string;
    readonly taskId: string;
  },
): ContractReproofRequest => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("contract reproof request must be an object");
  }
  const request = value as unknown as ContractReproofRequest;
  const rebuilt = buildContractReproofRequest(request);
  if (request.schemaVersion !== CONTRACT_REPROOF_SCHEMA) {
    throw new Error("unexpected contract reproof schema");
  }
  if (request.requestSha256 !== rebuilt.requestSha256) {
    throw new Error("contract reproof request hash mismatch");
  }
  if (
    request.taskId !== expected.taskId ||
    request.controlHeadSha !== expected.controlHeadSha ||
    request.planSha256 !== expected.planSha256 ||
    request.taskBlockHash !== expected.taskBlockHash
  ) {
    throw new Error("contract reproof request does not bind current authority");
  }
  return request;
};
