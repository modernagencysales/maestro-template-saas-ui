import {
  convexToJson,
  getConvexSize,
  jsonToConvex,
  type JSONValue,
  type Value,
} from "convex/values";
import * as Schema from "effect/Schema";

import { sha256Hex } from "../../shared/sha256";

export const MAX_WORKFLOW_ARTIFACT_BYTES = 880_000;
export const MAX_STORED_WORKFLOW_ARTIFACT_BYTES = 880_000;

export const WorkflowArtifactSensitivity = Schema.Literals([
  "internal",
  "confidential",
  "restricted",
]);
export type WorkflowArtifactSensitivity = Schema.Schema.Type<
  typeof WorkflowArtifactSensitivity
>;
export const WorkflowArtifactKind = Schema.Literals([
  "workflow-input",
  "capability-result",
  "event-value",
  "workflow-result",
]);
export type WorkflowArtifactKind = Schema.Schema.Type<
  typeof WorkflowArtifactKind
>;

export type WorkflowArtifactRun = {
  readonly workspaceId: string;
  readonly workflowRunId: string;
  readonly workflowId: string;
  readonly workflowVersion: number;
  readonly lifecycleGeneration: number;
  readonly lifecycleExecution?:
    "active" | "terminal" | "canceled" | null | undefined;
  readonly cleanupState?:
    | "not-requested"
    | "requested"
    | "in-progress"
    | "product-cleaned"
    | null
    | undefined;
  readonly parentRetentionUntil?: number | null | undefined;
  readonly childRetentionUntil?: number | null | undefined;
  readonly evidenceRetentionUntil?: number | null | undefined;
};

export type WorkflowArtifactDraft = {
  readonly workspaceId: string;
  readonly workflowRunId: string;
  readonly workflowId: string;
  readonly workflowVersion: number;
  readonly lifecycleGeneration: number;
  readonly referenceKey: string;
  readonly kind: WorkflowArtifactKind;
  readonly sensitivity: WorkflowArtifactSensitivity;
  readonly content: Value;
  readonly referenceUntil: number;
  readonly retentionUntil: number;
  readonly createdAt: number;
};

export type WorkflowArtifactRow = WorkflowArtifactDraft & {
  readonly contentHash: string;
  readonly measuredBytes: number;
  readonly appendOnly: true;
};

export type StoredWorkflowArtifactRow = Omit<WorkflowArtifactRow, "content"> & {
  readonly contentJson: string;
};

export class WorkflowArtifactContractError extends Error {
  readonly reason: string;

  constructor({ reason }: { readonly reason: string }) {
    super(reason);
    this.name = "WorkflowArtifactContractError";
    this.reason = reason;
  }
}

export const prepareWorkflowArtifact = (
  run: WorkflowArtifactRun,
  draft: WorkflowArtifactDraft,
): WorkflowArtifactRow => {
  assertOwnership(run, draft);
  assertNonEmpty(draft.referenceKey, "artifact reference key");
  assertTimestamp(draft.createdAt, "artifact creation time");
  assertTimestamp(draft.referenceUntil, "artifact reference retention");
  assertTimestamp(draft.retentionUntil, "artifact retention");
  if (draft.referenceUntil < maximumRunRetention(run)) {
    fail("artifact reference retention is shorter than the owning run");
  }
  if (draft.retentionUntil < draft.referenceUntil) {
    fail("artifact retention is shorter than reference retention");
  }
  const measuredBytes = getConvexSize(draft.content);
  if (measuredBytes > MAX_WORKFLOW_ARTIFACT_BYTES) {
    fail("artifact content exceeds the bounded artifact storage limit");
  }
  return {
    ...draft,
    contentHash: sha256Hex(canonicalConvexValue(draft.content)),
    measuredBytes,
    appendOnly: true,
  };
};

export const resolveWorkflowArtifactReference = <
  Row extends WorkflowArtifactRow & { readonly _id: string },
>(
  existing: Row | null,
  candidate:
    | WorkflowArtifactRow
    | {
        readonly workspaceId: string;
        readonly workflowRunId: string;
        readonly artifactId: string;
      },
): {
  readonly kind: "existing";
  readonly artifactId: string;
  readonly row: Row;
} | null => {
  if (existing === null) return null;
  if (
    existing.workspaceId !== candidate.workspaceId ||
    existing.workflowRunId !== candidate.workflowRunId
  ) {
    return null;
  }
  if ("artifactId" in candidate) {
    return existing._id === candidate.artifactId
      ? { kind: "existing", artifactId: existing._id, row: existing }
      : null;
  }
  if (
    existing.referenceKey !== candidate.referenceKey ||
    existing.contentHash !== candidate.contentHash ||
    existing.measuredBytes !== candidate.measuredBytes
  ) {
    fail("workflow artifact references are immutable");
  }
  return { kind: "existing", artifactId: existing._id, row: existing };
};

export const toStoredWorkflowArtifact = (
  row: WorkflowArtifactRow,
): StoredWorkflowArtifactRow => {
  const { content, ...metadata } = row;
  const stored = { ...metadata, contentJson: canonicalConvexValue(content) };
  assertStoredArtifactBudget(stored);
  return stored;
};

export const fromStoredWorkflowArtifact = (
  row: StoredWorkflowArtifactRow,
): WorkflowArtifactRow => {
  const { contentJson, ...metadata } = row;
  assertStoredArtifactBudget(row);
  let content: Value;
  try {
    content = jsonToConvex(JSON.parse(contentJson) as JSONValue);
  } catch {
    return fail("workflow artifact content is invalid");
  }
  const canonicalContent = canonicalConvexValue(content);
  const measuredBytes = getConvexSize(content);
  const contentHash = sha256Hex(canonicalContent);
  if (
    contentJson !== canonicalContent ||
    metadata.contentHash !== contentHash ||
    metadata.measuredBytes !== measuredBytes
  ) {
    fail("workflow artifact integrity check failed");
  }
  return {
    ...metadata,
    content,
  };
};

const assertStoredArtifactBudget = (row: StoredWorkflowArtifactRow): void => {
  const storedBytes = getConvexSize(row as unknown as Value);
  if (storedBytes > MAX_STORED_WORKFLOW_ARTIFACT_BYTES) {
    fail("stored workflow artifact exceeds the durable document limit");
  }
};

export const assertWorkflowArtifactDeletable = (
  run: WorkflowArtifactRun,
  artifact: WorkflowArtifactRow,
  now: number,
): void => {
  assertTimestamp(now, "artifact cleanup time");
  assertOwnership(run, artifact);
  if (
    (run.lifecycleExecution !== "terminal" &&
      run.lifecycleExecution !== "canceled") ||
    run.cleanupState !== "product-cleaned"
  ) {
    fail("artifact deletion requires completed product cleanup");
  }
  const retainedUntil = Math.max(
    artifact.referenceUntil,
    artifact.retentionUntil,
    maximumRunRetention(run),
  );
  if (now < retainedUntil) {
    fail("workflow artifact still has a retained reference");
  }
};

const assertOwnership = (
  run: WorkflowArtifactRun,
  artifact: Pick<
    WorkflowArtifactDraft,
    | "workspaceId"
    | "workflowRunId"
    | "workflowId"
    | "workflowVersion"
    | "lifecycleGeneration"
  >,
): void => {
  if (run.workspaceId !== artifact.workspaceId)
    fail("workspace ownership mismatch");
  if (run.workflowRunId !== artifact.workflowRunId)
    fail("run ownership mismatch");
  if (run.workflowId !== artifact.workflowId)
    fail("workflow ownership mismatch");
  if (run.workflowVersion !== artifact.workflowVersion)
    fail("version mismatch");
  if (run.lifecycleGeneration !== artifact.lifecycleGeneration) {
    fail("generation mismatch");
  }
};

const maximumRunRetention = (run: WorkflowArtifactRun): number =>
  Math.max(
    run.parentRetentionUntil ?? 0,
    run.childRetentionUntil ?? 0,
    run.evidenceRetentionUntil ?? 0,
  );

const canonicalConvexValue = (value: Value): string =>
  JSON.stringify(canonicalize(convexToJson(value)));

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
};

const assertTimestamp = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value < 0)
    fail(`${label} must be finite nonnegative`);
};

const assertNonEmpty = (value: string, label: string): void => {
  if (value.length === 0 || value.length > 160) fail(`${label} is invalid`);
};

const fail = (reason: string): never => {
  throw new WorkflowArtifactContractError({ reason });
};
