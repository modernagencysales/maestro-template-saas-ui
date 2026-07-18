import { createHash } from "node:crypto";

import type { BrainTaskContract } from "./manifest.js";

export const LEGACY_INTEGRATION_WAVE_SCHEMA =
  "maestro-brain-integration-wave-selection/v2" as const;
export const INTEGRATION_WAVE_SCHEMA =
  "maestro-brain-integration-wave-selection/v3" as const;

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

interface IntegrationWaveSelectionBase {
  readonly baseSha: string;
  readonly deferredTaskIds: readonly string[];
  readonly integrationId: string;
  readonly planSha256: string;
  readonly requestedTaskIds?: readonly string[];
  readonly selectedTasks: readonly IntegrationWaveTaskSnapshot[];
}

export interface IntegrationWaveSelectionV2 extends IntegrationWaveSelectionBase {
  readonly schemaVersion: typeof LEGACY_INTEGRATION_WAVE_SCHEMA;
  readonly selectionSha256: string;
}

export interface IntegrationWaveSelectionV3 extends IntegrationWaveSelectionBase {
  readonly schemaVersion: typeof INTEGRATION_WAVE_SCHEMA;
  readonly selectionPayloadSha256: string;
}

export type IntegrationWaveSelection =
  IntegrationWaveSelectionV2 | IntegrationWaveSelectionV3;

export type IntegrationWaveSelectionPayload = Omit<
  IntegrationWaveSelectionV3,
  "selectionPayloadSha256"
>;

export interface ReadIntegrationWaveSelectionResult {
  readonly selection: IntegrationWaveSelection;
  readonly selectionFileSha256: string;
  readonly selectionPayloadSha256: string;
  readonly legacy: boolean;
}

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const canonicalJsonString = (
  value: unknown,
  path: string,
  ancestors: Set<object>,
): string => {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${path}: canonical JSON numbers must be finite`);
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== "object") {
    throw new Error(`${path}: value is not JSON-safe`);
  }
  if (ancestors.has(value)) {
    throw new Error(`${path}: cyclic value is not JSON-safe`);
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        throw new Error(`${path}: canonical JSON requires a plain array`);
      }
      const allowedKeys = new Set<PropertyKey>(["length"]);
      for (let index = 0; index < value.length; index += 1) {
        allowedKeys.add(String(index));
      }
      if (Reflect.ownKeys(value).some((key) => !allowedKeys.has(key))) {
        throw new Error(`${path}: extra array properties are not JSON-safe`);
      }
      const result: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          throw new Error(`${path}: sparse arrays are not JSON-safe`);
        }
        const descriptor = Object.getOwnPropertyDescriptor(
          value,
          String(index),
        );
        if (
          !descriptor ||
          !("value" in descriptor) ||
          descriptor.enumerable !== true
        ) {
          throw new Error(
            `${path}[${index}]: array index must be an enumerable data property`,
          );
        }
        result.push(
          canonicalJsonString(descriptor.value, `${path}[${index}]`, ancestors),
        );
      }
      return `[${result.join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value) as object | null;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${path}: canonical JSON requires a plain object`);
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new Error(`${path}: symbol keys are not JSON-safe`);
    }
    const enumerableKeys = new Set(Object.keys(value));
    if (
      Object.getOwnPropertyNames(value).some((key) => !enumerableKeys.has(key))
    ) {
      throw new Error(
        `${path}: non-enumerable own properties are not JSON-safe`,
      );
    }
    const result: string[] = [];
    for (const key of Object.keys(value).sort()) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || descriptor.get || descriptor.set) {
        throw new Error(`${path}.${key}: accessors are not JSON-safe`);
      }
      result.push(
        `${JSON.stringify(key)}:${canonicalJsonString(
          descriptor.value,
          `${path}.${key}`,
          ancestors,
        )}`,
      );
    }
    return `{${result.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
};

export const canonicalSelectionPayload = (value: unknown): string =>
  canonicalJsonString(value, "selection", new Set());

export const selectionPayloadSha256 = (value: unknown): string =>
  sha256(canonicalSelectionPayload(value));

export const selectionFileSha256 = (content: string): string => sha256(content);

const sortedUnique = (values: readonly string[]): string[] =>
  [...new Set(values)].sort();

const isSha256 = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{64}$/.test(value);

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

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const assertNoAmbiguousSelectionHash = (value: object): void => {
  if (hasOwn(value, "selectionSha256") || hasOwn(value, "selection_sha256")) {
    throw new Error("ambiguous selection hash field is forbidden in v3");
  }
};

export const selectionPayload = (input: {
  readonly baseSha: string;
  readonly deferredTaskIds: readonly string[];
  readonly integrationId: string;
  readonly planSha256: string;
  readonly requestedTaskIds?: readonly string[];
  readonly selectedTasks: readonly IntegrationWaveTaskSnapshot[];
}): IntegrationWaveSelectionPayload => {
  assertNoAmbiguousSelectionHash(input);
  return {
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
      ...(hasOwn(task, "reproofRequestSha256")
        ? { reproofRequestSha256: task.reproofRequestSha256 }
        : {}),
      taskBlockHash: task.taskBlockHash,
      taskId: task.taskId,
      tranche: task.tranche,
    })),
  };
};

const legacySelectionPayload = (
  input: IntegrationWaveSelectionV2,
): Omit<IntegrationWaveSelectionV2, "selectionSha256"> => ({
  baseSha: input.baseSha,
  deferredTaskIds: [...input.deferredTaskIds],
  integrationId: input.integrationId,
  planSha256: input.planSha256,
  ...(input.requestedTaskIds === undefined
    ? {}
    : { requestedTaskIds: [...input.requestedTaskIds] }),
  schemaVersion: LEGACY_INTEGRATION_WAVE_SCHEMA,
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
    ...(hasOwn(task, "reproofRequestSha256")
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
}): IntegrationWaveSelectionV3 => {
  assertNoAmbiguousSelectionHash(input);
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
    if (
      hasOwn(candidate, "reproofRequestSha256") &&
      !isSha256(candidate.reproofRequestSha256)
    ) {
      throw new Error(
        `${candidate.taskId}: reproofRequestSha256 must be a 64-hex SHA-256`,
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
  return {
    ...payload,
    selectionPayloadSha256: selectionPayloadSha256(payload),
  };
};

const stringArrayValue = (value: unknown, label: string): readonly string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be a string array`);
  }
  return value;
};

const assertNormalizedStrings = (
  values: readonly string[],
  label: string,
): void => {
  const normalized = sortedUnique(values);
  if (
    normalized.length !== values.length ||
    normalized.some((value, index) => value !== values[index])
  ) {
    throw new Error(`${label} order is invalid`);
  }
};

const assertTaskSnapshot = (
  value: unknown,
  index: number,
  strictKeys: boolean,
): asserts value is IntegrationWaveTaskSnapshot => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`selectedTasks[${index}] must be an object`);
  }
  const task = value as Record<string, unknown>;
  const stringFields = [
    "gateHeadSha",
    "gateSha256",
    "headSha",
    "laneResultSha256",
    "planSha256",
    "proofHeadSha",
    "proofSha256",
    "taskBlockHash",
    "taskId",
    "tranche",
  ] as const;
  for (const field of stringFields) {
    if (typeof task[field] !== "string") {
      throw new Error(`selectedTasks[${index}].${field} must be a string`);
    }
  }
  for (const field of [
    "changedFiles",
    "codeStartAfter",
    "fileLocks",
  ] as const) {
    const values = stringArrayValue(
      task[field],
      `selectedTasks[${index}].${field}`,
    );
    if (strictKeys) assertNormalizedStrings(values, field);
  }
  if (
    hasOwn(task, "reproofRequestSha256") &&
    !isSha256(task.reproofRequestSha256)
  ) {
    throw new Error(
      `selectedTasks[${index}].reproofRequestSha256 must be a 64-hex SHA-256`,
    );
  }
  if (strictKeys) {
    const allowed = new Set([
      ...stringFields,
      "changedFiles",
      "codeStartAfter",
      "fileLocks",
      "reproofRequestSha256",
    ]);
    const unknown = Object.keys(task).filter((key) => !allowed.has(key));
    if (unknown.length > 0) {
      throw new Error(
        `selectedTasks[${index}] has unknown fields: ${unknown.sort().join(", ")}`,
      );
    }
  }
};

const validateSelectionShape = (
  value: IntegrationWaveSelection,
  strictKeys: boolean,
): void => {
  if (
    typeof value.baseSha !== "string" ||
    typeof value.integrationId !== "string" ||
    typeof value.planSha256 !== "string"
  ) {
    throw new Error("integration wave selection identity is invalid");
  }
  const deferredTaskIds = stringArrayValue(
    value.deferredTaskIds,
    "deferredTaskIds",
  );
  if (strictKeys) {
    assertNormalizedStrings(deferredTaskIds, "deferred task");
    if (deferredTaskIds.some((taskId) => !/^S\d{2}-T\d{2}$/.test(taskId))) {
      throw new Error("deferred task IDs are invalid");
    }
  }
  if (!Array.isArray(value.selectedTasks)) {
    throw new Error("selectedTasks must be an array");
  }
  value.selectedTasks.forEach((task, index) =>
    assertTaskSnapshot(task, index, strictKeys),
  );
  if (value.requestedTaskIds !== undefined) {
    stringArrayValue(value.requestedTaskIds, "requestedTaskIds");
  }
  if (strictKeys) {
    const allowed = new Set([
      "baseSha",
      "deferredTaskIds",
      "integrationId",
      "planSha256",
      "requestedTaskIds",
      "schemaVersion",
      "selectedTasks",
      "selectionPayloadSha256",
    ]);
    const unknown = Object.keys(value).filter((key) => !allowed.has(key));
    if (unknown.length > 0) {
      throw new Error(
        `integration wave v3 has unknown fields: ${unknown.sort().join(", ")}`,
      );
    }
  }
  if (value.selectedTasks.length === 0)
    throw new Error("integration wave has no tasks");
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

const validateV2Selection = (value: IntegrationWaveSelectionV2): void => {
  if (hasOwn(value, "selection_sha256")) {
    throw new Error("ambiguous selection hash field is forbidden in v2");
  }
  validateSelectionShape(value, false);
  if (
    sha256(JSON.stringify(legacySelectionPayload(value))) !==
    value.selectionSha256
  ) {
    throw new Error("integration wave selection payload hash mismatch");
  }
};

const validateV3Selection = (value: IntegrationWaveSelectionV3): void => {
  assertNoAmbiguousSelectionHash(value);
  validateSelectionShape(value, true);
  const payload = selectionPayload(value);
  if (selectionPayloadSha256(payload) !== value.selectionPayloadSha256) {
    throw new Error("integration wave selection payload hash mismatch");
  }
};

export const validateIntegrationWaveSelection = (
  value: IntegrationWaveSelection,
): void => {
  if (value.schemaVersion === INTEGRATION_WAVE_SCHEMA) {
    validateV3Selection(value);
    return;
  }
  if (value.schemaVersion === LEGACY_INTEGRATION_WAVE_SCHEMA) {
    validateV2Selection(value);
    return;
  }
  throw new Error("unexpected integration wave selection schema");
};

export const validateLaunchableIntegrationWaveSelection = (
  value: IntegrationWaveSelectionV3,
): void => {
  if (value.schemaVersion !== INTEGRATION_WAVE_SCHEMA) {
    throw new Error("unexpected integration wave selection schema");
  }
  validateV3Selection(value);
};

export const readIntegrationWaveSelection = (
  content: string,
): ReadIntegrationWaveSelectionResult => {
  const parsed = JSON.parse(content) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("integration wave selection must be an object");
  }
  const schemaVersion = (parsed as { readonly schemaVersion?: unknown })
    .schemaVersion;
  if (schemaVersion === INTEGRATION_WAVE_SCHEMA) {
    const selection = parsed as IntegrationWaveSelectionV3;
    validateLaunchableIntegrationWaveSelection(selection);
    return {
      legacy: false,
      selection,
      selectionFileSha256: selectionFileSha256(content),
      selectionPayloadSha256: selection.selectionPayloadSha256,
    };
  }
  if (schemaVersion === LEGACY_INTEGRATION_WAVE_SCHEMA) {
    const selection = parsed as IntegrationWaveSelectionV2;
    validateV2Selection(selection);
    return {
      legacy: true,
      selection,
      selectionFileSha256: selectionFileSha256(content),
      selectionPayloadSha256: selection.selectionSha256,
    };
  }
  throw new Error("unexpected integration wave selection schema");
};

export const integrationWaveId = (sequence: number): string => {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999_999) {
    throw new Error("integration wave sequence must be between 1 and 999999");
  }
  return `wave-${String(sequence).padStart(6, "0")}`;
};
