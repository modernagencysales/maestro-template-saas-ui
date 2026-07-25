import type { EventId as ComponentEventId } from "@convex-dev/workflow";
import * as Schema from "effect/Schema";

import { makePublicError } from "../../shared/errors";
import type {
  OwnedWorkflowEvent,
  ProductWorkflowEventId,
  WorkflowEventOwnership,
} from "./events";
import {
  WorkflowPrincipal,
  type WorkflowPrincipal as WorkflowPrincipalType,
} from "./principal";

export type WorkflowEventInstanceRow = WorkflowEventOwnership & {
  readonly componentWorkflowId: string;
  readonly eventId: ProductWorkflowEventId;
  readonly componentEventId: ComponentEventId;
  readonly status: "allocated" | "invalidated" | "canceled";
  readonly cleanup: "active" | "residual-inaccessible";
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type AllocateWorkflowEventInstanceInput = WorkflowEventOwnership & {
  readonly componentWorkflowId: string;
  readonly componentEventId: ComponentEventId;
  readonly occurredAt: number;
};

export type AllocateWorkflowEventInstanceResult = {
  readonly rows: readonly WorkflowEventInstanceRow[];
  readonly allocated: OwnedWorkflowEvent;
};

export const allocateWorkflowEventInstance = (
  rows: readonly WorkflowEventInstanceRow[],
  input: AllocateWorkflowEventInstanceInput,
): AllocateWorkflowEventInstanceResult => {
  assertAllocation(input);
  const exact = rows.find((row) => sameExactOwnership(row, input));
  if (exact !== undefined) {
    if (
      exact.status !== "allocated" ||
      exact.cleanup !== "active" ||
      exact.componentWorkflowId !== input.componentWorkflowId ||
      !samePrincipal(exact.principal, input.principal) ||
      exact.creatorCapability !== input.creatorCapability
    ) {
      throw unavailableEvent();
    }
    return { rows, allocated: toOwned(exact) };
  }

  const nextRows = rows.map((row) =>
    sameLogicalInstance(row, input) &&
    row.generation < input.generation &&
    row.status === "allocated"
      ? {
          ...row,
          status: "invalidated" as const,
          cleanup: "residual-inaccessible" as const,
          updatedAt: input.occurredAt,
        }
      : row,
  );
  if (
    nextRows.some(
      (row) =>
        sameLogicalInstance(row, input) && row.generation > input.generation,
    )
  ) {
    throw unavailableEvent();
  }

  const eventId =
    `workflow-event:${input.componentEventId}` as ProductWorkflowEventId;
  const allocated: WorkflowEventInstanceRow = {
    ...input,
    eventId,
    status: "allocated",
    cleanup: "active",
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
  };
  return { rows: [...nextRows, allocated], allocated: toOwned(allocated) };
};

export const reconcileWorkflowEventInstance = (
  rows: readonly WorkflowEventInstanceRow[],
  input: {
    readonly workspaceId: string;
    readonly eventId: ProductWorkflowEventId;
    readonly outcome: "canceled" | "cleanup";
    readonly occurredAt: number;
  },
): readonly WorkflowEventInstanceRow[] => {
  if (!Number.isFinite(input.occurredAt) || input.occurredAt < 0) {
    throw unavailableEvent();
  }
  let matched = false;
  const next = rows.map((row) => {
    if (row.eventId !== input.eventId) return row;
    if (row.workspaceId !== input.workspaceId) throw unavailableEvent();
    matched = true;
    if (
      (input.outcome === "canceled" && row.status === "canceled") ||
      (input.outcome === "cleanup" && row.cleanup === "residual-inaccessible")
    ) {
      return row;
    }
    return {
      ...row,
      status: input.outcome === "canceled" ? ("canceled" as const) : row.status,
      cleanup: "residual-inaccessible" as const,
      updatedAt: input.occurredAt,
    };
  });
  if (!matched) throw unavailableEvent();
  return next;
};

const sameExactOwnership = (
  row: WorkflowEventInstanceRow,
  input: WorkflowEventOwnership,
): boolean =>
  sameLogicalInstance(row, input) && row.generation === input.generation;

const sameLogicalInstance = (
  row: WorkflowEventInstanceRow,
  input: WorkflowEventOwnership,
): boolean =>
  row.workspaceId === input.workspaceId &&
  row.workflowRunId === input.workflowRunId &&
  row.eventDefinition === input.eventDefinition &&
  row.eventInstanceKey === input.eventInstanceKey;

const samePrincipal = (
  left: WorkflowPrincipalType,
  right: WorkflowPrincipalType,
): boolean => JSON.stringify(left) === JSON.stringify(right);

const assertAllocation = (input: AllocateWorkflowEventInstanceInput): void => {
  const principal = Schema.decodeUnknownEither(WorkflowPrincipal)(
    input.principal,
  );
  if (
    input.workspaceId.length === 0 ||
    input.workflowRunId.length === 0 ||
    input.componentWorkflowId.length === 0 ||
    !Number.isInteger(input.generation) ||
    input.generation < 0 ||
    input.eventInstanceKey.length === 0 ||
    typeof input.componentEventId !== "string" ||
    input.componentEventId.length === 0 ||
    input.creatorCapability.length === 0 ||
    !Number.isFinite(input.occurredAt) ||
    input.occurredAt < 0 ||
    principal._tag === "Left" ||
    principal.right.workspaceId !== input.workspaceId
  ) {
    throw unavailableEvent();
  }
};

const toOwned = (row: WorkflowEventInstanceRow): OwnedWorkflowEvent => ({
  workspaceId: row.workspaceId,
  workflowRunId: row.workflowRunId,
  generation: row.generation,
  eventDefinition: row.eventDefinition,
  eventInstanceKey: row.eventInstanceKey,
  principal: row.principal,
  creatorCapability: row.creatorCapability,
  eventId: row.eventId,
  componentEventId: row.componentEventId,
});

const unavailableEvent = () =>
  makePublicError("VALIDATION_FAILED", "Workflow event is unavailable.");
