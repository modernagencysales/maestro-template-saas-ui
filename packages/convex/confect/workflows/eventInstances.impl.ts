import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type { EventId as ComponentEventId } from "@convex-dev/workflow";
import * as Schema from "effect/Schema";

import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import { NotFound, ValidationFailed } from "../errors";
import {
  allocateWorkflowEventInstance,
  reconcileWorkflowEventInstance,
  type WorkflowEventInstanceRow,
} from "./_kit/eventInstances";
import { ProductWorkflowEventId } from "./_kit/events";
import {
  WorkflowCapabilityReference,
  WorkflowEventReference,
} from "./_kit/workflowReferences";
import eventInstances from "./eventInstances.spec";

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
  GroupImpl.finalize,
);
