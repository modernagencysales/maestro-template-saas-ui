import { FunctionImpl, GroupImpl } from "@confect/server";
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import { NotFound, ValidationFailed } from "../errors";
import {
  childWorkflowRunIdFromLink,
  type SubworkflowRunLinkRow,
} from "./_kit/subworkflowLinks";
import subworkflowLinksCurrent from "./subworkflowLinksCurrent.spec";

type Reader = Context.Service.Shape<typeof DatabaseReader>;

const loadLink = (
  reader: Reader,
  workspaceId: string,
  linkId: import("convex/values").GenericId<"workflowRunLinks">,
) =>
  reader
    .table("workflowRunLinks")
    .get(linkId)
    .pipe(
      Effect.orDie,
      Effect.flatMap((link) =>
        link !== null &&
        link.workspaceId === workspaceId &&
        link.relationKind === "subworkflow"
          ? Effect.succeed(
              link as SubworkflowRunLinkRow & { readonly _id: typeof linkId },
            )
          : Effect.fail(
              new NotFound({ resource: "workflowRunLinks", id: linkId }),
            ),
      ),
    );

const childRunId = (link: SubworkflowRunLinkRow) => {
  const id = childWorkflowRunIdFromLink(link);
  return id === null
    ? Effect.fail(
        new ValidationFailed({
          field: "linkId",
          message: "Authoritative child workflow run identity is unavailable.",
        }),
      )
    : Effect.succeed(id as import("convex/values").GenericId<"workflowRuns">);
};

const eventByType = (
  reader: Reader,
  workflowRunId: import("convex/values").GenericId<"workflowRuns">,
  type: string,
) =>
  reader
    .table("workflowRunEvents")
    .index("by_run_type", (q) =>
      q.eq("workflowRunId", workflowRunId).eq("type", type),
    )
    .first()
    .pipe(Effect.map(Option.getOrNull), Effect.orDie);

const recoverReservation = FunctionImpl.make(
  databaseSchema,
  subworkflowLinksCurrent,
  "recoverReservation",
  ({ workspaceId, idempotencyKey }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const link = yield* reader
        .table("workflowRunLinks")
        .index("by_workspace_and_idempotency", (q) =>
          q.eq("workspaceId", workspaceId).eq("idempotencyKey", idempotencyKey),
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (link === null || link.relationKind !== "subworkflow") {
        return yield* new NotFound({
          resource: "workflowRunLinks",
          id: idempotencyKey,
        });
      }
      return {
        linkId: link._id,
        childWorkflowRunId: yield* childRunId(link as SubworkflowRunLinkRow),
      };
    }),
);

const persistUnresolvedSuccess = FunctionImpl.make(
  databaseSchema,
  subworkflowLinksCurrent,
  "persistUnresolvedSuccess",
  (args) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const link = yield* loadLink(reader, args.workspaceId, args.linkId);
      const workflowRunId = yield* childRunId(link);
      const type = `subworkflow-success-unresolved:${args.linkId}`;
      const payloadJson = JSON.stringify({
        receipt: args.receipt,
        childResult: args.childResult,
      });
      const existing = yield* eventByType(reader, workflowRunId, type);
      if (existing !== null) {
        if (existing.payloadJson === payloadJson) return null;
        return yield* new ValidationFailed({
          field: "childResult",
          message:
            "Unresolved subworkflow success conflicts with its durable receipt.",
        });
      }
      const writer = yield* DatabaseWriter;
      yield* writer
        .table("workflowRunEvents")
        .insert({
          workflowRunId,
          sequence: args.occurredAt,
          type,
          nodeId: link.relationId,
          payloadJson,
          createdAt: args.occurredAt,
        })
        .pipe(Effect.orDie);
      return null;
    }),
);

const persistUnresolvedReservation = FunctionImpl.make(
  databaseSchema,
  subworkflowLinksCurrent,
  "persistUnresolvedReservation",
  ({ workspaceId, linkId, idempotencyKey, occurredAt }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const link = yield* loadLink(reader, workspaceId, linkId);
      if (link.idempotencyKey !== idempotencyKey) {
        return yield* new ValidationFailed({
          field: "idempotencyKey",
          message: "Reservation recovery marker conflicts with link authority.",
        });
      }
      const workflowRunId = yield* childRunId(link);
      const type = `subworkflow-reservation-unresolved:${idempotencyKey}`;
      if ((yield* eventByType(reader, workflowRunId, type)) !== null)
        return null;
      const writer = yield* DatabaseWriter;
      yield* writer
        .table("workflowRunEvents")
        .insert({
          workflowRunId,
          sequence: occurredAt,
          type,
          nodeId: link.relationId,
          payloadJson: JSON.stringify({ idempotencyKey, linkId }),
          createdAt: occurredAt,
        })
        .pipe(Effect.orDie);
      return null;
    }),
);

const recoverUnresolvedSuccess = FunctionImpl.make(
  databaseSchema,
  subworkflowLinksCurrent,
  "recoverUnresolvedSuccess",
  ({ workspaceId, linkId }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const link = yield* loadLink(reader, workspaceId, linkId);
      const workflowRunId = yield* childRunId(link);
      const resolved = yield* eventByType(
        reader,
        workflowRunId,
        `subworkflow-success-resolved:${linkId}`,
      );
      if (resolved !== null) return null;
      const unresolved = yield* eventByType(
        reader,
        workflowRunId,
        `subworkflow-success-unresolved:${linkId}`,
      );
      if (unresolved === null) return null;
      return yield* Effect.try({
        try: () =>
          JSON.parse(unresolved.payloadJson) as {
            receipt: {
              kind: "bounded-inline" | "artifact-reference";
              measuredBytes: number;
              contentHash: string;
              artifactId?: string;
            };
            childResult: unknown;
          },
        catch: () =>
          new ValidationFailed({
            field: "linkId",
            message: "Unresolved subworkflow success receipt is invalid.",
          }),
      });
    }),
);

const resolveUnresolvedSuccess = FunctionImpl.make(
  databaseSchema,
  subworkflowLinksCurrent,
  "resolveUnresolvedSuccess",
  ({ workspaceId, linkId, occurredAt }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const link = yield* loadLink(reader, workspaceId, linkId);
      const workflowRunId = yield* childRunId(link);
      const type = `subworkflow-success-resolved:${linkId}`;
      if ((yield* eventByType(reader, workflowRunId, type)) !== null)
        return null;
      const writer = yield* DatabaseWriter;
      yield* writer
        .table("workflowRunEvents")
        .insert({
          workflowRunId,
          sequence: occurredAt,
          type,
          nodeId: link.relationId,
          payloadJson: JSON.stringify({ linkId }),
          createdAt: occurredAt,
        })
        .pipe(Effect.orDie);
      return null;
    }),
);

const reportReconciliationFailure = FunctionImpl.make(
  databaseSchema,
  subworkflowLinksCurrent,
  "reportReconciliationFailure",
  (args) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const link = yield* loadLink(reader, args.workspaceId, args.linkId);
      const workflowRunId = yield* childRunId(link);
      const type = `subworkflow-link-reconciliation-failed:${args.linkId}:${args.issue}`;
      const payloadJson = JSON.stringify({
        issue: args.issue,
        linkId: args.linkId,
        primaryOutcome: args.primaryOutcome,
      });
      const existing = yield* eventByType(reader, workflowRunId, type);
      if (existing !== null) {
        if (existing.payloadJson === payloadJson) return null;
        return yield* new ValidationFailed({
          field: "primaryOutcome",
          message:
            "Subworkflow reconciliation report conflicts with its durable record.",
        });
      }
      const writer = yield* DatabaseWriter;
      yield* writer
        .table("workflowRunEvents")
        .insert({
          workflowRunId,
          sequence: args.occurredAt,
          type,
          nodeId: link.relationId,
          payloadJson,
          createdAt: args.occurredAt,
        })
        .pipe(Effect.orDie);
      return null;
    }),
);

export default GroupImpl.make(databaseSchema, subworkflowLinksCurrent).pipe(
  Layer.provide(recoverReservation),
  Layer.provide(persistUnresolvedReservation),
  Layer.provide(persistUnresolvedSuccess),
  Layer.provide(recoverUnresolvedSuccess),
  Layer.provide(resolveUnresolvedSuccess),
  Layer.provide(reportReconciliationFailure),
  GroupImpl.finalize,
);
