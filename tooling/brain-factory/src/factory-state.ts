export interface LaneCompletionResult {
  readonly integrationHeadSha?: string;
  readonly status?: string;
}

export const completedTaskIdsForControlHead = (input: {
  readonly controlHead: string;
  readonly isAncestor: (ancestor: string, descendant: string) => boolean;
  readonly resultFor: (taskId: string) => LaneCompletionResult | undefined;
  readonly taskIds: readonly string[];
}): ReadonlySet<string> => {
  const completed = new Set<string>();

  for (const taskId of input.taskIds) {
    const result = input.resultFor(taskId);
    if (!new Set(["integrated", "accepted"]).has(result?.status ?? "")) {
      continue;
    }

    const integrationHeadSha = result?.integrationHeadSha?.trim();
    if (!integrationHeadSha) {
      throw new Error(
        `${taskId}: ${result?.status} evidence has no integrationHeadSha; ` +
          "refusing to launch dependents",
      );
    }
    if (!input.isAncestor(integrationHeadSha, input.controlHead)) {
      throw new Error(
        `${taskId}: integration head ${integrationHeadSha} is not an ancestor ` +
          `of control HEAD ${input.controlHead}; merge the integration before dispatch`,
      );
    }

    completed.add(taskId);
  }

  return completed;
};

export interface IntegrationAttemptState {
  readonly existingArtifacts: readonly string[];
  readonly headSha?: string;
  readonly status?: string;
}

export const integrationIdForWave = (
  manifestTranche: string,
  wave: number,
): string => (wave === 1 ? manifestTranche : `${manifestTranche}-w${wave}`);

export const nextIntegrationId = (input: {
  readonly controlHead: string;
  readonly isAncestor: (ancestor: string, descendant: string) => boolean;
  readonly manifestTranche: string;
  readonly stateFor: (integrationId: string) => IntegrationAttemptState;
}): string => {
  for (let wave = 1; wave <= 1_000; wave += 1) {
    const integrationId = integrationIdForWave(input.manifestTranche, wave);
    const state = input.stateFor(integrationId);
    if (state.existingArtifacts.length === 0) return integrationId;

    if (state.status !== "passed") {
      throw new Error(
        `${integrationId}: latest integration attempt is unresolved ` +
          `(status ${state.status ?? "missing"}); existing state: ` +
          state.existingArtifacts.join(", "),
      );
    }

    const headSha = state.headSha?.trim();
    if (!headSha) {
      throw new Error(
        `${integrationId}: passed integration evidence has no headSha`,
      );
    }
    if (!input.isAncestor(headSha, input.controlHead)) {
      throw new Error(
        `${integrationId}: passed integration head ${headSha} is not an ` +
          `ancestor of control HEAD ${input.controlHead}; merge it before ` +
          "starting another wave",
      );
    }
  }

  throw new Error(`${input.manifestTranche}: integration wave limit exceeded`);
};

export type ControllerTaskStatus =
  | "pending"
  | "preparing"
  | "running"
  | "failed"
  | "terminal"
  | "lane_green"
  | "integrated"
  | "accepted"
  | "unknown";

export type ControllerTaskStage =
  | "pending"
  | "preparing"
  | "running"
  | "recoverable"
  | "terminal"
  | "lane_green"
  | "false_green"
  | "integrated"
  | "accepted"
  | "unknown";

export type ControllerCandidateAdmission =
  "admissible" | "rejected" | "unknown";

export interface ControllerTaskObservation {
  readonly admission?: ControllerCandidateAdmission;
  readonly baseSha?: string;
  readonly findingSha256?: string;
  readonly headSha?: string;
  readonly ownershipId?: string;
  readonly runId?: string;
  readonly status: ControllerTaskStatus;
  readonly taskId: string;
}

export interface ControllerTaskState extends ControllerTaskObservation {
  readonly stage: ControllerTaskStage;
}

export type ControllerWaveInspection =
  "running" | "succeeded" | "failed" | "unknown" | "ambiguous";

export type ControllerWaveIdentity = "exact" | "drifted" | "unknown";

export type ControllerWaveStage =
  "running" | "promotable" | "recoverable" | "owner_rework" | "unknown";

export interface ControllerWaveObservation {
  readonly findingSha256?: string;
  readonly headSha?: string;
  readonly identity: ControllerWaveIdentity;
  readonly inspection: ControllerWaveInspection;
  readonly integrationId: string;
  readonly ownershipId?: string;
  readonly ownerTaskIds?: readonly string[];
  readonly resultSha256?: string;
  readonly runId?: string;
  readonly selectionFileSha256?: string;
  readonly selectionPayloadSha256?: string;
}

export interface ControllerWaveState extends ControllerWaveObservation {
  readonly stage: ControllerWaveStage;
}

export interface ControllerGateQueueState {
  readonly capacity: number;
  readonly inUse: number;
  readonly waiting: number;
}

export type ControllerProviderErrorCategory =
  "unavailable" | "malformed" | "ambiguous" | "unauthorized" | "unknown";

export interface ControllerProviderError {
  readonly category: ControllerProviderErrorCategory;
  readonly provider: string;
}

export interface ControllerSnapshot {
  readonly schemaVersion: "maestro-brain-controller-snapshot/v1";
  readonly controlHeadSha: string;
  readonly manifestSha256: string;
  readonly planSha256: string;
  readonly tasks: readonly ControllerTaskState[];
  readonly waves: readonly ControllerWaveState[];
  readonly gateQueue: ControllerGateQueueState;
  readonly providerErrors: readonly ControllerProviderError[];
}

export interface ControllerSnapshotInput {
  readonly controlHeadSha: string;
  readonly manifestSha256: string;
  readonly planSha256: string;
  readonly tasks: readonly ControllerTaskObservation[];
  readonly waves: readonly ControllerWaveObservation[];
  readonly gateQueue: ControllerGateQueueState;
  readonly providerErrors: readonly ControllerProviderError[];
}

const exactHex = (value: string, length: 40 | 64): boolean =>
  new RegExp(`^[0-9a-f]{${length}}$`).test(value);

const requireGitSha = (value: string, label: string): void => {
  if (!exactHex(value, 40)) {
    throw new Error(`${label} must be an exact 40-character Git SHA`);
  }
};

const requireSha256 = (value: string, label: string): void => {
  if (!exactHex(value, 64)) {
    throw new Error(`${label} must be an exact 64-character SHA-256`);
  }
};

const requireIdentity = (value: string, label: string): void => {
  if (value.trim() !== value || value.length === 0) {
    throw new Error(`${label} must be a non-empty normalized string`);
  }
};

const validateOptionalTaskCoordinates = (
  input: ControllerTaskObservation,
): void => {
  if (input.baseSha !== undefined)
    requireGitSha(input.baseSha, `${input.taskId}.baseSha`);
  if (input.headSha !== undefined)
    requireGitSha(input.headSha, `${input.taskId}.headSha`);
  if (input.findingSha256 !== undefined)
    requireSha256(input.findingSha256, `${input.taskId}.findingSha256`);
  if (input.runId !== undefined)
    requireIdentity(input.runId, `${input.taskId}.runId`);
  if (input.ownershipId !== undefined)
    requireIdentity(input.ownershipId, `${input.taskId}.ownershipId`);
};

export const classifyControllerTask = (
  input: ControllerTaskObservation,
): ControllerTaskState => {
  requireIdentity(input.taskId, "taskId");
  validateOptionalTaskCoordinates(input);

  let stage: ControllerTaskStage;
  switch (input.status) {
    case "lane_green":
      stage = input.admission === "admissible" ? "lane_green" : "false_green";
      break;
    case "failed":
      stage =
        input.baseSha !== undefined &&
        input.headSha !== undefined &&
        input.findingSha256 !== undefined
          ? "recoverable"
          : "unknown";
      break;
    case "pending":
    case "preparing":
    case "running":
    case "terminal":
    case "integrated":
    case "accepted":
    case "unknown":
      stage = input.status;
      break;
  }

  return { ...input, stage };
};

export const classifyControllerWave = (
  input: ControllerWaveObservation,
): ControllerWaveState => {
  requireIdentity(input.integrationId, "integrationId");
  if (input.headSha !== undefined)
    requireGitSha(input.headSha, `${input.integrationId}.headSha`);
  if (input.runId !== undefined)
    requireIdentity(input.runId, `${input.integrationId}.runId`);
  if (input.ownershipId !== undefined)
    requireIdentity(input.ownershipId, `${input.integrationId}.ownershipId`);
  if (input.findingSha256 !== undefined)
    requireSha256(input.findingSha256, `${input.integrationId}.findingSha256`);
  if (input.resultSha256 !== undefined)
    requireSha256(input.resultSha256, `${input.integrationId}.resultSha256`);
  if (input.selectionFileSha256 !== undefined)
    requireSha256(
      input.selectionFileSha256,
      `${input.integrationId}.selectionFileSha256`,
    );
  if (input.selectionPayloadSha256 !== undefined)
    requireSha256(
      input.selectionPayloadSha256,
      `${input.integrationId}.selectionPayloadSha256`,
    );
  if (input.ownerTaskIds !== undefined) {
    if (input.ownerTaskIds.length === 0)
      throw new Error(`${input.integrationId}.ownerTaskIds must not be empty`);
    for (const taskId of input.ownerTaskIds)
      requireIdentity(taskId, `${input.integrationId}.ownerTaskId`);
    if (new Set(input.ownerTaskIds).size !== input.ownerTaskIds.length)
      throw new Error(
        `${input.integrationId}.ownerTaskIds contains duplicates`,
      );
  }

  const hasOwnerEvidence =
    input.findingSha256 !== undefined ||
    input.ownerTaskIds !== undefined ||
    input.resultSha256 !== undefined ||
    input.selectionFileSha256 !== undefined ||
    input.selectionPayloadSha256 !== undefined;
  const completeOwnerEvidence =
    input.findingSha256 !== undefined &&
    input.ownerTaskIds !== undefined &&
    input.resultSha256 !== undefined &&
    input.selectionFileSha256 !== undefined &&
    input.selectionPayloadSha256 !== undefined;

  const stage: ControllerWaveStage =
    input.identity !== "exact"
      ? "unknown"
      : hasOwnerEvidence && !completeOwnerEvidence
        ? "unknown"
        : completeOwnerEvidence &&
            (input.inspection === "failed" || input.inspection === "succeeded")
          ? "owner_rework"
          : input.inspection === "succeeded"
            ? "promotable"
            : input.inspection === "failed"
              ? "recoverable"
              : input.inspection === "running"
                ? "running"
                : "unknown";

  return { ...input, stage };
};

const rejectDuplicates = (
  values: readonly (string | undefined)[],
  label: string,
): void => {
  const seen = new Set<string>();
  for (const value of values) {
    if (value === undefined) continue;
    if (seen.has(value)) throw new Error(`duplicate ${label} ${value}`);
    seen.add(value);
  }
};

const validateGateQueue = (gateQueue: ControllerGateQueueState): void => {
  for (const [name, value] of Object.entries(gateQueue)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`gateQueue.${name} must be a non-negative safe integer`);
    }
  }
  if (gateQueue.inUse > gateQueue.capacity) {
    throw new Error("gateQueue.inUse cannot exceed capacity");
  }
};

export const normalizeControllerSnapshot = (
  input: ControllerSnapshotInput,
): ControllerSnapshot => {
  requireGitSha(input.controlHeadSha, "controlHeadSha");
  requireSha256(input.manifestSha256, "manifestSha256");
  requireSha256(input.planSha256, "planSha256");
  validateGateQueue(input.gateQueue);

  rejectDuplicates(
    input.tasks.map(({ taskId }) => taskId),
    "taskId",
  );
  rejectDuplicates(
    input.waves.map(({ integrationId }) => integrationId),
    "integrationId",
  );
  const allObservations = [...input.tasks, ...input.waves];
  rejectDuplicates(
    allObservations.map(({ runId }) => runId),
    "runId",
  );
  rejectDuplicates(
    allObservations.map(({ ownershipId }) => ownershipId),
    "ownershipId",
  );

  const tasks = input.tasks
    .map(classifyControllerTask)
    .sort((left, right) => left.taskId.localeCompare(right.taskId));
  const waves = input.waves
    .map(classifyControllerWave)
    .sort((left, right) =>
      left.integrationId.localeCompare(right.integrationId),
    );
  const activeIntegrationOwners = waves
    .filter(({ stage }) => stage !== "unknown")
    .map(({ ownershipId }) => ownershipId)
    .filter((value): value is string => value !== undefined)
    .sort();
  if (activeIntegrationOwners.length > 1) {
    throw new Error(
      `multiple active integration owners: ${activeIntegrationOwners.join(", ")}`,
    );
  }

  const providerErrors = [...input.providerErrors]
    .map((error) => {
      requireIdentity(error.provider, "provider error provider");
      return { ...error };
    })
    .sort(
      (left, right) =>
        left.provider.localeCompare(right.provider) ||
        left.category.localeCompare(right.category),
    );

  return {
    schemaVersion: "maestro-brain-controller-snapshot/v1",
    controlHeadSha: input.controlHeadSha,
    manifestSha256: input.manifestSha256,
    planSha256: input.planSha256,
    tasks,
    waves,
    gateQueue: { ...input.gateQueue },
    providerErrors,
  };
};
