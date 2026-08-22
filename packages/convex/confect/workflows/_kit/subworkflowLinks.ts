import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";

import { makePublicError } from "../../shared/errors";
import {
  WorkflowReference,
  type WorkflowReference as WorkflowReferenceType,
  type WorkflowStepName as WorkflowStepNameType,
} from "./workflowReferences";
import {
  DurableWorkflowPrincipal,
  type DurableWorkflowPrincipal as WorkflowPrincipalType,
} from "./principal";
import {
  WorkflowPolicySnapshot,
  type WorkflowPolicySnapshot as WorkflowPolicySnapshotType,
} from "./policySnapshot";

export const MAX_SUBWORKFLOW_RESULT_BYTES = 64_000;

export type SubworkflowRunLinkProjection = {
  readonly workspaceId: string;
  readonly parentWorkflowRunId: string;
  readonly parentComponentWorkflowId: string;
  readonly parentWorkflowVersion: number;
  readonly generation: number;
  readonly childWorkflow: WorkflowReferenceType;
  readonly childWorkflowVersion: number;
  readonly childGraphJson: string;
  readonly childReleaseChecksum: string;
  readonly stepName: WorkflowStepNameType;
  readonly principal: WorkflowPrincipalType;
  readonly policySnapshot: WorkflowPolicySnapshotType;
};

export type SubworkflowRunLinkOutcome =
  | {
      readonly kind: "succeeded";
      readonly receipt: {
        readonly kind: "bounded-inline" | "artifact-reference";
        readonly measuredBytes: number;
        readonly contentHash: string;
        readonly artifactId?: string;
      };
    }
  | { readonly kind: "failed"; readonly error: string }
  | { readonly kind: "canceled" };

export type SubworkflowRunLinkRow = {
  readonly workspaceId: string;
  readonly parentWorkflowId: string;
  readonly childWorkflowId: string | null;
  readonly parentKind: string;
  readonly childKind: string;
  readonly relationKind: string;
  readonly relationId: string;
  readonly idempotencyKey: string;
  readonly status: "starting" | "running" | "succeeded" | "failed" | "canceled";
  readonly childResultJson: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
};

export const subworkflowRunLinkIdempotencyKey = (
  projection: SubworkflowRunLinkProjection,
): string =>
  [
    projection.parentWorkflowRunId,
    projection.parentWorkflowVersion,
    projection.generation,
    projection.stepName,
    projection.childWorkflow,
    projection.childWorkflowVersion,
  ].join(":");

export const buildSubworkflowRunLinkRow = (
  projection: SubworkflowRunLinkProjection,
  occurredAt: number,
  childWorkflowRunId?: string,
): SubworkflowRunLinkRow => {
  assertProjection(projection, occurredAt);
  return {
    workspaceId: projection.workspaceId,
    parentWorkflowId: projection.parentWorkflowRunId,
    childWorkflowId: null,
    parentKind: JSON.stringify({
      schemaVersion: 2,
      workflowRunId: projection.parentWorkflowRunId,
      componentWorkflowId: projection.parentComponentWorkflowId,
      workflowVersion: projection.parentWorkflowVersion,
      generation: projection.generation,
      principal: projection.principal,
    }),
    childKind: JSON.stringify({
      schemaVersion: 2,
      workflow: projection.childWorkflow,
      workflowVersion: projection.childWorkflowVersion,
      graphJson: projection.childGraphJson,
      releaseChecksum: projection.childReleaseChecksum,
      principal: projection.principal,
      policySnapshot: projection.policySnapshot,
      ...(childWorkflowRunId ? { childWorkflowRunId } : {}),
    }),
    relationKind: "subworkflow",
    relationId: projection.stepName,
    idempotencyKey: subworkflowRunLinkIdempotencyKey(projection),
    status: "starting",
    childResultJson: null,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
};

export const sameSubworkflowRunLinkProjection = (
  row: SubworkflowRunLinkRow,
  projection: SubworkflowRunLinkProjection,
): boolean => {
  const childWorkflowRunId = childWorkflowRunIdFromLink(row);
  if (childWorkflowRunId === null) return false;
  const expected = buildSubworkflowRunLinkRow(
    projection,
    row.createdAt,
    childWorkflowRunId,
  );
  return (
    row.workspaceId === expected.workspaceId &&
    row.parentWorkflowId === expected.parentWorkflowId &&
    row.parentKind === expected.parentKind &&
    row.childKind === expected.childKind &&
    row.relationKind === expected.relationKind &&
    row.relationId === expected.relationId &&
    row.idempotencyKey === expected.idempotencyKey
  );
};

export const reconcileSubworkflowRunLinkState = <
  Row extends SubworkflowRunLinkRow,
>(
  row: Row,
  outcome: SubworkflowRunLinkOutcome,
  occurredAt: number,
): Row => {
  if (!Number.isFinite(occurredAt) || occurredAt < 0) {
    throw linkFailure("reconciliation time must be finite and nonnegative");
  }
  if (outcome.kind === "succeeded") assertReceipt(outcome.receipt);
  const status = outcome.kind;
  const childResultJson = JSON.stringify(outcome);
  if (
    row.status === "succeeded" ||
    row.status === "failed" ||
    row.status === "canceled"
  ) {
    if (row.status === status && row.childResultJson === childResultJson) {
      return row;
    }
    throw linkFailure("workflow run link is already reconciled");
  }
  return {
    ...row,
    status,
    childResultJson,
    updatedAt: occurredAt,
  };
};

export type SubworkflowRunLinkActivation = {
  readonly workspaceId: string;
  readonly parentWorkflowRunId: string;
  readonly parentComponentWorkflowId: string;
  readonly childComponentWorkflowId: string;
  readonly childWorkflowRunId: string;
  readonly generation: number;
};

export type DecodedSubworkflowRunLinkIdentity =
  | {
      readonly schemaVersion: 2;
      readonly parentWorkflowRunId: string;
      readonly parentComponentWorkflowId: string;
      readonly childWorkflowRunId: string | null;
    }
  | {
      readonly schemaVersion: 1;
      readonly historicalParentId: string;
      readonly historicalChildComponentId: string | null;
      readonly childWorkflowRunId: null;
    };

/**
 * Widened decoder for pre-v2 rows. New writes use product-run parent IDs;
 * lifecycle readers dual-read the historical component-ID index until a
 * bounded backfill can rewrite those rows.
 */
export const decodeSubworkflowRunLinkIdentity = (
  row: Pick<
    SubworkflowRunLinkRow,
    "parentWorkflowId" | "childWorkflowId" | "parentKind" | "childKind"
  >,
): DecodedSubworkflowRunLinkIdentity => {
  const childWorkflowRunId = childWorkflowRunIdFromLink(row);
  try {
    const value: unknown = JSON.parse(row.parentKind);
    if (
      typeof value === "object" &&
      value !== null &&
      "workflowRunId" in value &&
      typeof value.workflowRunId === "string" &&
      value.workflowRunId.length > 0
    ) {
      const parentComponentWorkflowId =
        "componentWorkflowId" in value &&
        typeof value.componentWorkflowId === "string" &&
        value.componentWorkflowId.length > 0
          ? value.componentWorkflowId
          : row.parentWorkflowId !== value.workflowRunId
            ? row.parentWorkflowId
            : null;
      if (parentComponentWorkflowId !== null) {
        return {
          schemaVersion: 2,
          parentWorkflowRunId: value.workflowRunId,
          parentComponentWorkflowId,
          childWorkflowRunId,
        };
      }
    }
  } catch {
    // Historical rows used a plain kind label.
  }
  return {
    schemaVersion: 1,
    historicalParentId: row.parentWorkflowId,
    historicalChildComponentId: row.childWorkflowId,
    childWorkflowRunId: null,
  };
};

export const activateSubworkflowRunLinkState = <
  Row extends SubworkflowRunLinkRow,
>(
  row: Row,
  activation: SubworkflowRunLinkActivation,
  occurredAt: number,
): Row => {
  const identity = decodeSubworkflowRunLinkIdentity(row);
  if (
    identity.schemaVersion !== 2 ||
    !Number.isFinite(occurredAt) ||
    occurredAt < 0 ||
    activation.workspaceId !== row.workspaceId ||
    activation.parentWorkflowRunId !== identity.parentWorkflowRunId ||
    activation.parentComponentWorkflowId !==
      identity.parentComponentWorkflowId ||
    activation.childWorkflowRunId !== identity.childWorkflowRunId ||
    activation.generation !== readParentGeneration(row.parentKind) ||
    activation.childComponentWorkflowId.length === 0
  ) {
    throw linkFailure("activation ownership mismatch");
  }
  if (row.childWorkflowId !== null) {
    if (row.childWorkflowId === activation.childComponentWorkflowId) return row;
    throw linkFailure("activation conflicts with the immutable child identity");
  }
  if (row.status !== "starting") {
    throw linkFailure("activation requires a starting workflow run link");
  }
  return {
    ...row,
    childWorkflowId: activation.childComponentWorkflowId,
    status: "running",
    updatedAt: occurredAt,
  };
};

export const childWorkflowRunIdFromLink = (
  row: Pick<SubworkflowRunLinkRow, "childKind">,
): string | null => {
  try {
    const value: unknown = JSON.parse(row.childKind);
    if (
      typeof value === "object" &&
      value !== null &&
      "childWorkflowRunId" in value &&
      typeof value.childWorkflowRunId === "string" &&
      value.childWorkflowRunId.length > 0
    ) {
      return value.childWorkflowRunId;
    }
  } catch {
    // Historical rows used a plain child-kind label and component identity.
  }
  return null;
};

export type SubworkflowRunLinkReservation = {
  readonly childWorkflowRunId: string;
  readonly workflow: WorkflowReferenceType;
  readonly workflowVersion: number;
  readonly graphJson: string;
  readonly releaseChecksum: string;
  readonly principal: WorkflowPrincipalType;
  readonly policySnapshot: WorkflowPolicySnapshotType;
};

export const subworkflowRunLinkReservationFromLink = (
  row: Pick<SubworkflowRunLinkRow, "childKind">,
): SubworkflowRunLinkReservation | null => {
  try {
    const value: unknown = JSON.parse(row.childKind);
    if (typeof value !== "object" || value === null) return null;
    const childWorkflowRunId = childWorkflowRunIdFromLink(row);
    const workflow =
      "workflow" in value
        ? Schema.decodeUnknownExit(WorkflowReference)(value.workflow)
        : null;
    const principal =
      "principal" in value
        ? Schema.decodeUnknownExit(DurableWorkflowPrincipal)(value.principal)
        : null;
    const policySnapshot =
      "policySnapshot" in value
        ? Schema.decodeUnknownExit(WorkflowPolicySnapshot)(value.policySnapshot)
        : null;
    if (
      childWorkflowRunId === null ||
      workflow === null ||
      Exit.isFailure(workflow) ||
      principal === null ||
      Exit.isFailure(principal) ||
      policySnapshot === null ||
      Exit.isFailure(policySnapshot) ||
      !("workflowVersion" in value) ||
      typeof value.workflowVersion !== "number" ||
      !Number.isInteger(value.workflowVersion) ||
      value.workflowVersion < 1 ||
      !("graphJson" in value) ||
      typeof value.graphJson !== "string" ||
      value.graphJson.length === 0 ||
      !("releaseChecksum" in value) ||
      typeof value.releaseChecksum !== "string" ||
      !/^[a-f0-9]{64}$/.test(value.releaseChecksum)
    ) {
      return null;
    }
    return {
      childWorkflowRunId,
      workflow: workflow.value,
      workflowVersion: value.workflowVersion,
      graphJson: value.graphJson,
      releaseChecksum: value.releaseChecksum,
      principal: principal.value,
      policySnapshot: policySnapshot.value,
    };
  } catch {
    return null;
  }
};

const assertProjection = (
  projection: SubworkflowRunLinkProjection,
  occurredAt: number,
): void => {
  const decodedPrincipal = Schema.decodeUnknownExit(DurableWorkflowPrincipal)(
    projection.principal,
  );
  const decodedPolicy = Schema.decodeUnknownExit(WorkflowPolicySnapshot)(
    projection.policySnapshot,
  );
  if (
    projection.workspaceId.length === 0 ||
    projection.parentWorkflowRunId.length === 0 ||
    projection.parentComponentWorkflowId.length === 0 ||
    !Number.isInteger(projection.parentWorkflowVersion) ||
    projection.parentWorkflowVersion < 1 ||
    !Number.isInteger(projection.generation) ||
    projection.generation < 0 ||
    !Number.isInteger(projection.childWorkflowVersion) ||
    projection.childWorkflowVersion < 1 ||
    projection.childGraphJson.length === 0 ||
    projection.childGraphJson.length > 256 << 10 ||
    !/^[a-f0-9]{64}$/.test(projection.childReleaseChecksum) ||
    Exit.isFailure(decodedPrincipal) ||
    Exit.isFailure(decodedPolicy) ||
    decodedPrincipal.value.workspaceId !== projection.workspaceId ||
    !Number.isFinite(occurredAt) ||
    occurredAt < 0
  ) {
    throw linkFailure("workflow run link projection is invalid");
  }
};

const assertReceipt = (
  receipt: Extract<SubworkflowRunLinkOutcome, { kind: "succeeded" }>["receipt"],
): void => {
  if (
    !Number.isFinite(receipt.measuredBytes) ||
    receipt.measuredBytes < 0 ||
    receipt.measuredBytes > MAX_SUBWORKFLOW_RESULT_BYTES ||
    !/^[a-f0-9]{64}$/.test(receipt.contentHash) ||
    (receipt.kind === "artifact-reference" &&
      (receipt.artifactId === undefined || receipt.artifactId.length === 0)) ||
    (receipt.kind === "bounded-inline" && receipt.artifactId !== undefined)
  ) {
    throw linkFailure("result receipt is invalid");
  }
};

const readParentGeneration = (parentKind: string): number => {
  try {
    const value: unknown = JSON.parse(parentKind);
    if (
      typeof value === "object" &&
      value !== null &&
      "generation" in value &&
      typeof value.generation === "number" &&
      Number.isInteger(value.generation) &&
      value.generation >= 0
    ) {
      return value.generation;
    }
  } catch {
    // The same opaque public failure covers malformed legacy rows.
  }
  throw linkFailure("activation ownership mismatch");
};

const linkFailure = (issue: string) =>
  makePublicError("VALIDATION_FAILED", `Subworkflow link ${issue}.`, { issue });
