import { FunctionImpl, GroupImpl } from "@confect/server";
import {
  sendMaestroWorkflowEvent as sendComponentEvent,
  type MaestroWorkflowComponent as WorkflowComponent,
  type MaestroWorkflowEventId as ComponentEventId,
} from "./_kit/defineMaestroWorkflow";
import type { GenericId } from "convex/values";
import { componentsGeneric } from "convex/server";
import * as Effect from "effect/Effect";
import * as Clock from "effect/Clock";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import databaseSchema from "../_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "../_generated/services";
import { requireWorkspaceAccess } from "../capabilities/_kit/workspaceAccess";
import { NotFound, Unauthorized, ValidationFailed } from "../errors";
import {
  allocateWorkflowEventInstance,
  reconcileWorkflowEventInstance,
  sendWorkflowEventInstance,
  type WorkflowEventInstanceRow,
} from "./_kit/eventInstances";
import { ProductWorkflowEventId } from "./_kit/events";
import {
  WorkflowCapabilityReference,
  WorkflowEventReference,
} from "./_kit/workflowReferences";
import eventInstances from "./eventInstances.spec";
import {
  assertWorkflowPayloadBudget,
  redactWorkflowBoundaryFailure,
} from "./_kit/payloadBudget";

const workflowComponent = componentsGeneric()
  .workflow as unknown as WorkflowComponent;

const withConfectClock = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, Exclude<R, Clock.Clock>> =>
  // Confect provides Clock at runtime, but its current handler type omits it.
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const allocate = FunctionImpl.make(
  databaseSchema,
  eventInstances,
  "allocate",
  (args) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const existingDocs = yield* reader
        .table("workflowEventInstances")
        .index("by_logical_instance", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("workflowRunId", args.workflowRunId)
            .eq("eventDefinition", args.eventDefinition)
            .eq("eventInstanceKey", args.eventInstanceKey),
        )
        .collect()
        .pipe(Effect.orDie);
      const existing = existingDocs.map(toRuntimeRow);
      const result = yield* Effect.try({
        try: () =>
          allocateWorkflowEventInstance(existing, {
            ...args,
            componentEventId: args.componentEventId as ComponentEventId,
          }),
        catch: () =>
          new ValidationFailed({
            field: "eventInstance",
            message: "Workflow event is unavailable.",
          }),
      });
      if (result.rows === existing) return result.allocated;

      const writer = yield* DatabaseWriter;
      for (const doc of existingDocs) {
        const next = result.rows.find((row) => row.eventId === doc.eventId);
        if (
          next !== undefined &&
          (next.status !== doc.status || next.cleanup !== doc.cleanup)
        ) {
          yield* writer
            .table("workflowEventInstances")
            .patch(doc._id, {
              status: next.status,
              cleanup: next.cleanup,
              updatedAt: next.updatedAt,
            })
            .pipe(Effect.orDie);
        }
      }
      const alreadyPersisted = existing.some(
        (row) => row.eventId === result.allocated.eventId,
      );
      if (!alreadyPersisted) {
        const row = result.rows.find(
          (candidate) => candidate.eventId === result.allocated.eventId,
        );
        if (row === undefined) {
          return yield* new ValidationFailed({
            field: "eventInstance",
            message: "Workflow event allocation was not materialized.",
          });
        }
        yield* writer
          .table("workflowEventInstances")
          .insert(row)
          .pipe(Effect.orDie);
      }
      return result.allocated;
    }),
);

const reconcile = FunctionImpl.make(
  databaseSchema,
  eventInstances,
  "reconcile",
  (args) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const existing = yield* reader
        .table("workflowEventInstances")
        .index("by_product_event", (q) => q.eq("eventId", args.eventId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (existing === null || existing.workspaceId !== args.workspaceId) {
        return yield* new NotFound({
          resource: "workflowEventInstances",
          id: args.eventId,
        });
      }
      const [next] = yield* Effect.try({
        try: () =>
          reconcileWorkflowEventInstance([toRuntimeRow(existing)], args),
        catch: () =>
          new ValidationFailed({
            field: "eventInstance",
            message: "Workflow event is unavailable.",
          }),
      });
      if (next === undefined) {
        return yield* new NotFound({
          resource: "workflowEventInstances",
          id: args.eventId,
        });
      }
      if (
        next.status !== existing.status ||
        next.cleanup !== existing.cleanup
      ) {
        const writer = yield* DatabaseWriter;
        yield* writer
          .table("workflowEventInstances")
          .patch(existing._id, {
            status: next.status,
            cleanup: next.cleanup,
            updatedAt: next.updatedAt,
          })
          .pipe(Effect.orDie);
      }
      return { status: next.status, cleanup: next.cleanup };
    }),
);

const send = FunctionImpl.make(
  databaseSchema,
  eventInstances,
  "send",
  ({ selector, delivery, occurredAt }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const candidates =
        selector.kind === "id"
          ? yield* reader
              .table("workflowEventInstances")
              .index("by_product_event", (q) =>
                q.eq("eventId", selector.eventId),
              )
              .collect()
              .pipe(Effect.orDie)
          : yield* reader
              .table("workflowEventInstances")
              .index("by_component_definition_instance", (q) =>
                q
                  .eq("componentWorkflowId", selector.componentWorkflowId)
                  .eq("eventDefinition", selector.eventDefinition)
                  .eq("eventInstanceKey", selector.eventInstanceKey),
              )
              .collect()
              .pipe(Effect.orDie);
      const active = candidates.filter(
        (candidate) =>
          candidate.status === "allocated" && candidate.cleanup === "active",
      );
      if (active.length !== 1 || active[0] === undefined) {
        return yield* unavailableOwnedEvent(
          selector.kind === "id"
            ? selector.eventId
            : selector.componentWorkflowId,
        );
      }
      const existing = active[0];
      yield* withConfectClock(
        requireWorkspaceAccess(
          existing.workspaceId as GenericId<"workspaces">,
          "editor",
        ),
      ).pipe(
        Effect.mapError((error) =>
          error instanceof Unauthorized
            ? error
            : new NotFound({
                resource: "workflowEventInstances",
                id: existing.eventId,
              }),
        ),
      );
      const transition = yield* Effect.try({
        try: () =>
          sendWorkflowEventInstance(candidates.map(toRuntimeRow), {
            selector,
            delivery: { kind: delivery.kind },
            occurredAt,
          }),
        catch: () =>
          new NotFound({
            resource: "workflowEventInstances",
            id: existing.eventId,
          }),
      });
      const ctx = yield* MutationCtx;
      if (delivery.kind === "value") {
        yield* Effect.try({
          try: () =>
            assertWorkflowPayloadBudget({
              surface: "event-value",
              phase: "pre-component-send",
              nodeId: existing.eventDefinition,
              value: delivery.value,
            }),
          catch: () =>
            new ValidationFailed({
              field: "event",
              message: "Workflow event payload exceeds its budget.",
            }),
        });
      }
      const redactedError = redactWorkflowBoundaryFailure(delivery, {
        correlationId: existing.workflowRunId,
        nodeId: existing.eventDefinition,
      });
      yield* Effect.tryPromise({
        try: () =>
          delivery.kind === "value"
            ? sendComponentEvent(ctx, workflowComponent, {
                id: transition.owned.componentEventId,
                value: delivery.value,
              })
            : sendComponentEvent(ctx, workflowComponent, {
                id: transition.owned.componentEventId,
                error: redactedError.safeMessage,
              }),
        catch: () =>
          new ValidationFailed({
            field: "event",
            message: "Workflow event is unavailable.",
          }),
      });
      const next = transition.rows.find(
        (row) => row.eventId === transition.owned.eventId,
      );
      if (next === undefined) {
        return yield* unavailableOwnedEvent(existing.eventId);
      }
      const writer = yield* DatabaseWriter;
      yield* writer
        .table("workflowEventInstances")
        .patch(existing._id, {
          status: next.status,
          deliveryKind: next.deliveryKind,
          updatedAt: next.updatedAt,
        })
        .pipe(Effect.orDie);
      return { ...transition.owned, status: "sent" as const };
    }),
);

const unavailableOwnedEvent = (id: string) =>
  Effect.fail(new NotFound({ resource: "workflowEventInstances", id }));

const toRuntimeRow = (row: {
  readonly workspaceId: string;
  readonly workflowRunId: string;
  readonly componentWorkflowId: string;
  readonly generation: number;
  readonly eventDefinition: string;
  readonly eventInstanceKey: string;
  readonly eventId: string;
  readonly componentEventId: string;
  readonly principal: WorkflowEventInstanceRow["principal"];
  readonly creatorCapability: string;
  readonly status: WorkflowEventInstanceRow["status"];
  readonly deliveryKind: WorkflowEventInstanceRow["deliveryKind"];
  readonly cleanup: WorkflowEventInstanceRow["cleanup"];
  readonly createdAt: number;
  readonly updatedAt: number;
}): WorkflowEventInstanceRow => ({
  ...row,
  eventDefinition: Schema.decodeSync(WorkflowEventReference)(
    row.eventDefinition,
  ),
  eventId: Schema.decodeSync(ProductWorkflowEventId)(row.eventId),
  componentEventId: row.componentEventId as ComponentEventId,
  creatorCapability: Schema.decodeSync(WorkflowCapabilityReference)(
    row.creatorCapability,
  ),
});

export default GroupImpl.make(databaseSchema, eventInstances).pipe(
  Layer.provide(allocate),
  Layer.provide(reconcile),
  Layer.provide(send),
  GroupImpl.finalize,
);
