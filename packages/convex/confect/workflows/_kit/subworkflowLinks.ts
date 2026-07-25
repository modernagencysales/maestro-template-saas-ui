import * as Schema from "effect/Schema";

import { makePublicError } from "../../shared/errors";
import type {
  WorkflowReference as WorkflowReferenceType,
  WorkflowStepName as WorkflowStepNameType,
} from "./workflowReferences";
import {
  WorkflowPrincipal,
  type WorkflowPrincipal as WorkflowPrincipalType,
} from "./principal";

export type SubworkflowRunLinkProjection = {
  readonly workspaceId: string;
  readonly parentWorkflowId: string;
  readonly parentWorkflowVersion: number;
  readonly generation: number;
  readonly childWorkflow: WorkflowReferenceType;
  readonly childWorkflowVersion: number;
  readonly stepName: WorkflowStepNameType;
  readonly principal: WorkflowPrincipalType;
  readonly cancellation: "cascade";
  readonly cleanup: "cascade-async";
};

export type SubworkflowRunLinkOutcome =
  | { readonly kind: "succeeded"; readonly resultJson: string }
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
    projection.parentWorkflowId,
    projection.parentWorkflowVersion,
    projection.generation,
    projection.stepName,
    projection.childWorkflow,
    projection.childWorkflowVersion,
  ].join(":");

export const buildSubworkflowRunLinkRow = (
  projection: SubworkflowRunLinkProjection,
  occurredAt: number,
): SubworkflowRunLinkRow => {
  assertProjection(projection, occurredAt);
  return {
    workspaceId: projection.workspaceId,
    parentWorkflowId: projection.parentWorkflowId,
    childWorkflowId: null,
    parentKind: JSON.stringify({
      workflowVersion: projection.parentWorkflowVersion,
      generation: projection.generation,
      principal: projection.principal,
    }),
    childKind: JSON.stringify({
      workflow: projection.childWorkflow,
      workflowVersion: projection.childWorkflowVersion,
      principal: projection.principal,
      cancellation: projection.cancellation,
      cleanup: projection.cleanup,
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
  const expected = buildSubworkflowRunLinkRow(projection, row.createdAt);
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

const assertProjection = (
  projection: SubworkflowRunLinkProjection,
  occurredAt: number,
): void => {
  const decodedPrincipal = Schema.decodeUnknownEither(WorkflowPrincipal)(
    projection.principal,
  );
  if (
    projection.workspaceId.length === 0 ||
    projection.parentWorkflowId.length === 0 ||
    !Number.isInteger(projection.parentWorkflowVersion) ||
    projection.parentWorkflowVersion < 1 ||
    !Number.isInteger(projection.generation) ||
    projection.generation < 0 ||
    !Number.isInteger(projection.childWorkflowVersion) ||
    projection.childWorkflowVersion < 1 ||
    decodedPrincipal._tag === "Left" ||
    decodedPrincipal.right.workspaceId !== projection.workspaceId ||
    !Number.isFinite(occurredAt) ||
    occurredAt < 0
  ) {
    throw linkFailure("workflow run link projection is invalid");
  }
};

const linkFailure = (issue: string) =>
  makePublicError("VALIDATION_FAILED", `Subworkflow link ${issue}.`, { issue });
