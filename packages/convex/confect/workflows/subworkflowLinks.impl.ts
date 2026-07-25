import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import { NotFound, ValidationFailed } from "../errors";
import {
  buildSubworkflowRunLinkRow,
  reconcileSubworkflowRunLinkState,
  sameSubworkflowRunLinkProjection,
  subworkflowRunLinkIdempotencyKey,
  type SubworkflowRunLinkProjection,
  type SubworkflowRunLinkRow,
} from "./_kit/subworkflowLinks";
import subworkflowLinks from "./subworkflowLinks.spec";

const reserve = FunctionImpl.make(
  databaseSchema,
  subworkflowLinks,
  "reserve",
  ({ projection, occurredAt }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const existing = yield* reader
        .table("workflowRunLinks")
        .index("by_workspace_and_idempotency", (q) =>
          q
            .eq("workspaceId", projection.workspaceId)
            .eq("idempotencyKey", subworkflowRunLinkIdempotencyKey(projection)),
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (existing !== null) {
        if (
          existing.relationKind !== "subworkflow" ||
          !sameSubworkflowRunLinkProjection(
            existing as SubworkflowRunLinkRow,
            projection as SubworkflowRunLinkProjection,
          )
        ) {
          return yield* new ValidationFailed({
            field: "projection",
            message:
              "Subworkflow link reservation conflicts with its immutable projection.",
          });
        }
        return { linkId: existing._id };
      }
      const writer = yield* DatabaseWriter;
      const linkId = yield* writer
        .table("workflowRunLinks")
        .insert(
          buildSubworkflowRunLinkRow(
            projection as SubworkflowRunLinkProjection,
            occurredAt,
          ),
        )
        .pipe(Effect.orDie);
      return { linkId };
    }),
);

const reconcile = FunctionImpl.make(
  databaseSchema,
  subworkflowLinks,
  "reconcile",
  ({ workspaceId, linkId, outcome, occurredAt }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const existing = yield* reader
        .table("workflowRunLinks")
        .get(linkId)
        .pipe(Effect.orDie);
      if (
        existing === null ||
        existing.workspaceId !== workspaceId ||
        existing.relationKind !== "subworkflow"
      ) {
        return yield* new NotFound({
          resource: "workflowRunLinks",
          id: linkId,
        });
      }
      const next = yield* Effect.try({
        try: () =>
          reconcileSubworkflowRunLinkState(
            existing as SubworkflowRunLinkRow,
            outcome,
            occurredAt,
          ),
        catch: () =>
          new ValidationFailed({
            field: "outcome",
            message:
              "Subworkflow link is already reconciled with another outcome.",
          }),
      });
      if (next !== existing) {
        const writer = yield* DatabaseWriter;
        yield* writer
          .table("workflowRunLinks")
          .patch(linkId, {
            status: next.status,
            childResultJson: next.childResultJson,
            updatedAt: next.updatedAt,
          })
          .pipe(Effect.orDie);
      }
      return { status: next.status as "succeeded" | "failed" | "canceled" };
    }),
);

export default GroupImpl.make(databaseSchema, subworkflowLinks).pipe(
  Layer.provide(reserve),
  Layer.provide(reconcile),
  GroupImpl.finalize,
);
