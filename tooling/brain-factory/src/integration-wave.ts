import { createHash } from "node:crypto";

import type { BrainTaskContract } from "./manifest.js";

export const INTEGRATION_WAVE_SCHEMA =
  "maestro-brain-integration-wave-selection/v2" as const;

export const laneTrancheMatchesManifest = (
  laneTranche: unknown,
  manifestTranche: string,
): boolean => laneTranche === undefined || laneTranche === manifestTranche;

export interface IntegrationWaveCandidate {
  readonly changedFiles: readonly string[];
  readonly gateHeadSha: string;
  readonly gateSha256: string;
  readonly headSha: string;
  readonly laneResultSha256: string;
  readonly planSha256: string;
  readonly proofHeadSha: string;
  readonly proofSha256: string;
  readonly reproofRequestSha256?: string;
  readonly taskBlockHash: string;
  readonly taskId: string;
  readonly tranche: string;
}

export interface IntegrationWaveTaskSnapshot extends IntegrationWaveCandidate {
  readonly codeStartAfter: readonly string[];
  readonly fileLocks: readonly string[];
}

export interface IntegrationWaveSelection {
  readonly baseSha: string;
  readonly deferredTaskIds: readonly string[];
  readonly integrationId: string;
  readonly planSha256: string;
  readonly requestedTaskIds?: readonly string[];
  readonly schemaVersion: typeof INTEGRATION_WAVE_SCHEMA;
  readonly selectedTasks: readonly IntegrationWaveTaskSnapshot[];
  readonly selectionSha256: string;
}

const hashJson = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const sortedUnique = (values: readonly string[]): string[] =>
  [...new Set(values)].sort();

const earlierTaskSet = (
  left: readonly IntegrationWaveTaskSnapshot[],
  right: readonly IntegrationWaveTaskSnapshot[],
): boolean =>
  left.map((task) => task.taskId).join("\n") <
  right.map((task) => task.taskId).join("\n");

const maximumConflictFreeTasks = (
  tasks: readonly IntegrationWaveTaskSnapshot[],
): readonly IntegrationWaveTaskSnapshot[] => {
  const candidates = [...tasks].sort((left, right) =>
    left.taskId.localeCompare(right.taskId),
  );
  let best: readonly IntegrationWaveTaskSnapshot[] = [];

  const visit = (
    index: number,
    selected: IntegrationWaveTaskSnapshot[],
    locks: Set<string>,
  ): void => {
    if (selected.length + candidates.length - index < best.length) return;
    if (index === candidates.length) {
      if (
        selected.length > best.length ||
        (selected.length === best.length && earlierTaskSet(selected, best))
      ) {
        best = [...selected];
      }
      return;
    }
    const task = candidates[index];
    if (!task) return;
    if (!task.fileLocks.some((lock) => locks.has(lock))) {
      const added = task.fileLocks.filter((lock) => !locks.has(lock));
      for (const lock of added) locks.add(lock);
      selected.push(task);
      visit(index + 1, selected, locks);
      selected.pop();
      for (const lock of added) locks.delete(lock);
    }
    visit(index + 1, selected, locks);
  };

  visit(0, [], new Set());
  return best;
};

const selectionPayload = (input: {
  readonly baseSha: string;
  readonly deferredTaskIds: readonly string[];
  readonly integrationId: string;
  readonly planSha256: string;
  readonly requestedTaskIds?: readonly string[];
  readonly selectedTasks: readonly IntegrationWaveTaskSnapshot[];
}) => ({
  baseSha: input.baseSha,
  deferredTaskIds: [...input.deferredTaskIds],
  integrationId: input.integrationId,
  planSha256: input.planSha256,
  ...(input.requestedTaskIds === undefined
    ? {}
    : { requestedTaskIds: [...input.requestedTaskIds] }),
  schemaVersion: INTEGRATION_WAVE_SCHEMA,
  selectedTasks: input.selectedTasks.map((task) => ({
    changedFiles: [...task.changedFiles],
    codeStartAfter: [...task.codeStartAfter],
    fileLocks: [...task.fileLocks],
    gateHeadSha: task.gateHeadSha,
    gateSha256: task.gateSha256,
    headSha: task.headSha,
    laneResultSha256: task.laneResultSha256,
    planSha256: task.planSha256,
    proofHeadSha: task.proofHeadSha,
    proofSha256: task.proofSha256,
    ...(task.reproofRequestSha256
      ? { reproofRequestSha256: task.reproofRequestSha256 }
      : {}),
    taskBlockHash: task.taskBlockHash,
    taskId: task.taskId,
    tranche: task.tranche,
  })),
});

export const planIntegrationWave = (input: {
  readonly baseSha: string;
  readonly candidates: readonly IntegrationWaveCandidate[];
  readonly completedTaskIds: ReadonlySet<string>;
  readonly integrationId: string;
  readonly planSha256: string;
  readonly requestedTaskIds?: readonly string[];
  readonly tasks: readonly BrainTaskContract[];
}): IntegrationWaveSelection => {
  const requestedTaskIds =
    input.requestedTaskIds === undefined
      ? undefined
      : sortedUnique(input.requestedTaskIds);
  const filteredRequest =
    requestedTaskIds !== undefined && requestedTaskIds.length > 0;
  if (
    requestedTaskIds !== undefined &&
    (requestedTaskIds.length !== input.requestedTaskIds?.length ||
      requestedTaskIds.some((taskId) => !/^S\d{2}-T\d{2}$/.test(taskId)))
  ) {
    throw new Error("integration wave requested task IDs are invalid");
  }
  const manifestTasks = new Map(input.tasks.map((task) => [task.taskId, task]));
  if (
    new Set(input.candidates.map((task) => task.taskId)).size !==
    input.candidates.length
  ) {
    throw new Error("integration wave has duplicate candidates");
  }
  const candidateIds = new Set(input.candidates.map((task) => task.taskId));
  if (
    filteredRequest &&
    JSON.stringify([...candidateIds].sort()) !==
      JSON.stringify(requestedTaskIds)
  ) {
    throw new Error("integration wave requested candidate set mismatch");
  }
  const snapshots = input.candidates.map((candidate) => {
    const task = manifestTasks.get(candidate.taskId);
    if (!task) throw new Error(`${candidate.taskId}: absent from manifest`);
    if (task.fileInventoryStatus !== "ready" || task.kind !== "product") {
      throw new Error(
        `${candidate.taskId}: task is not integration-ready product work`,
      );
    }
    if (candidate.tranche !== task.tranche) {
      throw new Error(`${candidate.taskId}: candidate tranche mismatch`);
    }
    if (
      candidate.planSha256 !== input.planSha256 ||
      candidate.taskBlockHash !== task.taskBlockHash
    ) {
      throw new Error(
        `${candidate.taskId}: candidate plan or task-block drift`,
      );
    }
    if (
      candidate.headSha !== candidate.proofHeadSha ||
      candidate.headSha !== candidate.gateHeadSha
    ) {
      throw new Error(
        `${candidate.taskId}: candidate proof/gate head mismatch`,
      );
    }
    for (const dependency of task.codeStartAfter) {
      if (candidateIds.has(dependency)) {
        throw new Error(
          `${candidate.taskId}: same-wave dependency ${dependency} is forbidden`,
        );
      }
      if (!input.completedTaskIds.has(dependency)) {
        throw new Error(
          `${candidate.taskId}: dependency ${dependency} is absent from the exact base`,
        );
      }
    }
    return {
      ...candidate,
      changedFiles: sortedUnique(candidate.changedFiles),
      codeStartAfter: [...task.codeStartAfter].sort(),
      fileLocks: [...task.fileLocks].sort(),
    } satisfies IntegrationWaveTaskSnapshot;
  });
  const selectedTasks = maximumConflictFreeTasks(snapshots);
  if (selectedTasks.length === 0)
    throw new Error("integration wave has no selectable tasks");
  const selectedIds = new Set(selectedTasks.map((task) => task.taskId));
  const deferredTaskIds = snapshots
    .map((task) => task.taskId)
    .filter((taskId) => !selectedIds.has(taskId))
    .sort();
  if (filteredRequest && deferredTaskIds.length > 0) {
    throw new Error(
      `requested integration tasks are not conflict-free: ${deferredTaskIds.join(", ")}`,
    );
  }
  const payload = selectionPayload({
    baseSha: input.baseSha,
    deferredTaskIds,
    integrationId: input.integrationId,
    planSha256: input.planSha256,
    ...(requestedTaskIds === undefined ? {} : { requestedTaskIds }),
    selectedTasks,
  });
  return { ...payload, selectionSha256: hashJson(payload) };
};

export const validateIntegrationWaveSelection = (
  value: IntegrationWaveSelection,
): void => {
  if (value.schemaVersion !== INTEGRATION_WAVE_SCHEMA) {
    throw new Error("unexpected integration wave selection schema");
  }
  if (value.selectedTasks.length === 0)
    throw new Error("integration wave has no tasks");
  const payload = selectionPayload(value);
  if (hashJson(payload) !== value.selectionSha256) {
    throw new Error("integration wave selection hash mismatch");
  }
  const ids = value.selectedTasks.map((task) => task.taskId);
  if (
    new Set(ids).size !== ids.length ||
    JSON.stringify(ids) !== JSON.stringify([...ids].sort())
  ) {
    throw new Error("integration wave selected task order is invalid");
  }
  if (value.requestedTaskIds !== undefined) {
    const requested = [...value.requestedTaskIds];
    if (
      requested.some((taskId) => !/^S\d{2}-T\d{2}$/.test(taskId)) ||
      new Set(requested).size !== requested.length ||
      JSON.stringify(requested) !== JSON.stringify([...requested].sort()) ||
      (requested.length > 0 &&
        JSON.stringify(requested) !== JSON.stringify(ids))
    ) {
      throw new Error("integration wave requested task filter is invalid");
    }
  }
  const locks = new Map<string, string>();
  for (const task of value.selectedTasks) {
    for (const lock of task.fileLocks) {
      const owner = locks.get(lock);
      if (owner)
        throw new Error(
          `${task.taskId}: file lock ${lock} conflicts with ${owner}`,
        );
      locks.set(lock, task.taskId);
    }
  }
};

export const integrationWaveId = (sequence: number): string => {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999_999) {
    throw new Error("integration wave sequence must be between 1 and 999999");
  }
  return `wave-${String(sequence).padStart(6, "0")}`;
};
