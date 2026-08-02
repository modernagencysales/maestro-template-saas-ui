import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";

import { makePublicError } from "../../shared/errors";
import type { MaestroWorkflowEventId as ComponentEventId } from "./defineMaestroWorkflow";
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
  readonly status:
    "allocated" | "sent" | "consumed" | "invalidated" | "canceled";
  readonly deliveryKind: "none" | "value" | "error";
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
    (row.status === "allocated" || row.status === "sent")
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
    deliveryKind: "none",
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
    readonly outcome: "consumed" | "canceled" | "cleanup";
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
      (input.outcome === "consumed" && row.status !== "sent") ||
      (input.outcome === "canceled" && row.status === "consumed") ||
      (input.outcome === "cleanup" && row.status === "consumed")
    ) {
      throw unavailableEvent();
    }
    if (
      (input.outcome === "consumed" && row.status === "consumed") ||
      (input.outcome === "canceled" && row.status === "canceled") ||
      (input.outcome === "cleanup" && row.cleanup === "residual-inaccessible")
    ) {
      return row;
    }
    return {
      ...row,
      status:
        input.outcome === "consumed"
          ? ("consumed" as const)
          : input.outcome === "canceled"
            ? ("canceled" as const)
            : row.status,
      cleanup:
        input.outcome === "consumed"
          ? row.cleanup
          : ("residual-inaccessible" as const),
      updatedAt: input.occurredAt,
    };
  });
  if (!matched) throw unavailableEvent();
  return next;
};

export type WorkflowEventInstanceSelector =
  | { readonly kind: "id"; readonly eventId: ProductWorkflowEventId }
  | {
      readonly kind: "definition";
      readonly componentWorkflowId: string;
      readonly eventDefinition: WorkflowEventOwnership["eventDefinition"];
      readonly eventInstanceKey: string;
    };

export const sendWorkflowEventInstance = (
  rows: readonly WorkflowEventInstanceRow[],
  input: {
    readonly selector: WorkflowEventInstanceSelector;
    readonly delivery: { readonly kind: "value" | "error" };
    readonly occurredAt: number;
  },
): {
  readonly rows: readonly WorkflowEventInstanceRow[];
  readonly owned: OwnedWorkflowEvent;
} => {
  assertOccurredAt(input.occurredAt);
  const matches = rows.filter((row) =>
    input.selector.kind === "id"
      ? row.eventId === input.selector.eventId
      : row.componentWorkflowId === input.selector.componentWorkflowId &&
        row.eventDefinition === input.selector.eventDefinition &&
        row.eventInstanceKey === input.selector.eventInstanceKey,
  );
  if (matches.length !== 1 || matches[0]?.status !== "allocated") {
    throw unavailableEvent();
  }
  const matched = matches[0];
  const next = {
    ...matched,
    status: "sent" as const,
    deliveryKind: input.delivery.kind,
    updatedAt: input.occurredAt,
  };
  return {
    rows: rows.map((row) => (row.eventId === matched.eventId ? next : row)),
    owned: toOwned(matched),
  };
};

export const consumeWorkflowEventInstance = (
  rows: readonly WorkflowEventInstanceRow[],
  input: {
    readonly eventId: ProductWorkflowEventId;
    readonly occurredAt: number;
  },
): readonly WorkflowEventInstanceRow[] => {
  assertOccurredAt(input.occurredAt);
  let matched = false;
  const next = rows.map((row) => {
    if (row.eventId !== input.eventId) return row;
    if (row.status !== "sent") throw unavailableEvent();
    matched = true;
    return { ...row, status: "consumed" as const, updatedAt: input.occurredAt };
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
  const principal = Schema.decodeUnknownExit(WorkflowPrincipal)(
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
    Exit.isFailure(principal) ||
    principal.value.workspaceId !== input.workspaceId
  ) {
    throw unavailableEvent();
  }
};

const assertOccurredAt = (occurredAt: number): void => {
  if (!Number.isFinite(occurredAt) || occurredAt < 0) {
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
