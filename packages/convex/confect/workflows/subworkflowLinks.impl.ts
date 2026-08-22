import { FunctionImpl, GroupImpl } from "@confect/server";
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import databaseSchema from "../_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "../_generated/services";
import { NotFound, ValidationFailed } from "../errors";
import {
  bindWorkflowAdmission,
  reserveWorkflowAdmission,
  transitionWorkflowAdmission,
} from "./_kit/ownership";
import {
  activateSubworkflowRunLinkState,
  buildSubworkflowRunLinkRow,
  childWorkflowRunIdFromLink,
  reconcileSubworkflowRunLinkState,
  sameSubworkflowRunLinkProjection,
  subworkflowRunLinkReservationFromLink,
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
        const childWorkflowRunId = childWorkflowRunIdFromLink(
          existing as SubworkflowRunLinkRow,
        );
        if (childWorkflowRunId === null) {
          return yield* new ValidationFailed({
            field: "projection",
            message:
              "Historical subworkflow links require lifecycle dual-read migration before replay.",
          });
        }
        return {
          linkId: existing._id,
          childWorkflowRunId:
            childWorkflowRunId as import("convex/values").GenericId<"workflowRuns">,
        };
      }
      const admissionLane =
        projection.principal.kind === "system" ? "system" : "user";
      const mutation = yield* MutationCtx;
      const reservationKey = subworkflowRunLinkIdempotencyKey(projection);
      yield* reserveWorkflowAdmission(mutation, reader, {
        workspaceId: projection.workspaceId,
        reservationKey,
        lane: admissionLane,
      }).pipe(
        Effect.catchTag("WorkflowAdmissionDenied", () =>
          Effect.fail(
            new ValidationFailed({
              field: "workflow",
              message: "Subworkflow admission capacity is unavailable.",
            }),
          ),
        ),
      );
      const writer = yield* DatabaseWriter;
      const childWorkflowRunId = yield* writer
        .table("workflowRuns")
        .insert({
          workspaceId: projection.workspaceId,
          workflowId: projection.childWorkflow,
          workflowVersion: projection.childWorkflowVersion,
          graphJson: projection.childGraphJson,
          status: "queued",
          idempotencyKey: subworkflowRunLinkIdempotencyKey(projection),
          startedByUserId:
            projection.principal.kind === "user"
              ? projection.principal.actorId
              : `system:${projection.principal.systemId}`,
          startedAt: occurredAt,
          completedAt: null,
          failedAt: null,
          trustReceiptId: null,
          workflowKind: "subworkflow",
          sourceRunKind: "workflowRun",
          sourceRunId: projection.parentWorkflowRunId,
          lifecycleGeneration: 0,
          principalSnapshot: projection.principal,
          policySnapshot: projection.policySnapshot,
        })
        .pipe(Effect.orDie);
      yield* bindWorkflowAdmission(
        mutation,
        projection.workspaceId,
        reservationKey,
        childWorkflowRunId,
      ).pipe(Effect.orDie);
      yield* writer
        .table("workflowRunEvents")
        .insert({
          workflowRunId: childWorkflowRunId,
          sequence: occurredAt,
          type: "workflow.admission.reserved.v1",
          nodeId: null,
          payloadJson: JSON.stringify({
            workspaceId: projection.workspaceId,
            admissionLane,
            startBindingHash: null,
          }),
          createdAt: occurredAt,
        })
        .pipe(Effect.orDie);
      const linkId = yield* writer
        .table("workflowRunLinks")
        .insert(
          buildSubworkflowRunLinkRow(
            projection as SubworkflowRunLinkProjection,
            occurredAt,
            childWorkflowRunId,
          ),
        )
        .pipe(Effect.orDie);
      return { linkId, childWorkflowRunId };
    }),
);

const activate = FunctionImpl.make(
  databaseSchema,
  subworkflowLinks,
  "activate",
  (args) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const link = yield* reader
        .table("workflowRunLinks")
        .get(args.linkId)
        .pipe(Effect.orDie);
      const child = yield* reader
        .table("workflowRuns")
        .get(args.childWorkflowRunId)
        .pipe(Effect.orDie);
      const reservation =
        link === null
          ? null
          : subworkflowRunLinkReservationFromLink(
              link as SubworkflowRunLinkRow,
            );
      if (
        link === null ||
        child === null ||
        reservation === null ||
        child.workspaceId !== args.workspaceId ||
        child.sourceRunId !== args.parentWorkflowRunId ||
        child.workflowId !== reservation.workflow ||
        child.workflowVersion !== reservation.workflowVersion ||
        child.graphJson !== reservation.graphJson ||
        JSON.stringify(child.principalSnapshot) !==
          JSON.stringify(reservation.principal) ||
        JSON.stringify(child.policySnapshot) !==
          JSON.stringify(reservation.policySnapshot) ||
        (child.componentWorkflowId !== undefined &&
          child.componentWorkflowId !== args.childComponentWorkflowId)
      ) {
        return yield* new NotFound({
          resource: "workflowRunLinks",
          id: args.linkId,
        });
      }
      const next = yield* Effect.try({
        try: () =>
          activateSubworkflowRunLinkState(
            link as SubworkflowRunLinkRow,
            {
              workspaceId: args.workspaceId,
              parentWorkflowRunId: args.parentWorkflowRunId,
              parentComponentWorkflowId: args.parentComponentWorkflowId,
              childWorkflowRunId: args.childWorkflowRunId,
              childComponentWorkflowId: args.childComponentWorkflowId,
              generation: args.generation,
            },
            args.occurredAt,
          ),
        catch: () =>
          new ValidationFailed({
            field: "linkId",
            message: "Subworkflow activation ownership is unavailable.",
          }),
      });
      if (next !== link) {
        const writer = yield* DatabaseWriter;
        const mutation = yield* MutationCtx;
        yield* writer
          .table("workflowRunLinks")
          .patch(args.linkId, {
            childWorkflowId: next.childWorkflowId,
            status: next.status,
            updatedAt: next.updatedAt,
          })
          .pipe(Effect.orDie);
        yield* writer
          .table("workflowRuns")
          .patch(args.childWorkflowRunId, {
            componentWorkflowId: args.childComponentWorkflowId,
            status: "running",
          })
          .pipe(Effect.orDie);
        yield* transitionWorkflowAdmission(
          mutation,
          args.childWorkflowRunId,
          "running",
        ).pipe(Effect.orDie);
      }
      return {
        status: "running" as const,
        principal: reservation.principal,
        policySnapshot: reservation.policySnapshot,
      };
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
            normalizeOutcome(outcome),
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
        const mutation = yield* MutationCtx;
        yield* writer
          .table("workflowRunLinks")
          .patch(linkId, {
            status: next.status,
            childResultJson: next.childResultJson,
            updatedAt: next.updatedAt,
          })
          .pipe(Effect.orDie);
        const childWorkflowRunId = yield* resolveChildWorkflowRunId(
          reader,
          existing as SubworkflowRunLinkRow,
        );
        yield* writer
          .table("workflowRuns")
          .patch(childWorkflowRunId, {
            status:
              next.status === "succeeded"
                ? "completed"
                : next.status === "canceled"
                  ? "canceled"
                  : "failed",
            ...(next.status === "succeeded"
              ? { completedAt: occurredAt }
              : { failedAt: occurredAt }),
          })
          .pipe(Effect.orDie);
        yield* transitionWorkflowAdmission(
          mutation,
          childWorkflowRunId,
          next.status === "succeeded"
            ? "completed"
            : next.status === "canceled"
              ? "canceled"
              : "failed",
        ).pipe(Effect.orDie);
      }
      return { status: next.status as "succeeded" | "failed" | "canceled" };
    }),
);

const reportReconciliationFailure = FunctionImpl.make(
  databaseSchema,
  subworkflowLinks,
  "reportReconciliationFailure",
  (args) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const link = yield* reader
        .table("workflowRunLinks")
        .get(args.linkId)
        .pipe(Effect.orDie);
      if (
        link === null ||
        link.workspaceId !== args.workspaceId ||
        link.relationKind !== "subworkflow"
      ) {
        return yield* new NotFound({
          resource: "workflowRunLinks",
          id: args.linkId,
        });
      }
      const childWorkflowRunId = yield* resolveChildWorkflowRunId(
        reader,
        link as SubworkflowRunLinkRow,
      );
      const type = `subworkflow-link-reconciliation-failed:${args.linkId}`;
      const payloadJson = JSON.stringify({
        issue: args.issue,
        linkId: args.linkId,
        primaryOutcome: args.primaryOutcome,
      });
      const existing = yield* reader
        .table("workflowRunEvents")
        .index("by_run_type", (q) =>
          q.eq("workflowRunId", childWorkflowRunId).eq("type", type),
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (existing !== null) {
        if (existing.payloadJson === payloadJson) return null;
        return yield* new ValidationFailed({
          field: "primaryOutcome",
          message:
            "Subworkflow reconciliation failure report conflicts with the durable record.",
        });
      }
      const writer = yield* DatabaseWriter;
      yield* writer
        .table("workflowRunEvents")
        .insert({
          workflowRunId: childWorkflowRunId,
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

export default GroupImpl.make(databaseSchema, subworkflowLinks).pipe(
  Layer.provide(reserve),
  Layer.provide(activate),
  Layer.provide(reportReconciliationFailure),
  Layer.provide(reconcile),
  GroupImpl.finalize,
);

const normalizeOutcome = (outcome: {
  readonly kind: "succeeded" | "failed" | "canceled";
  readonly receipt?: {
    readonly kind: "bounded-inline" | "artifact-reference";
    readonly measuredBytes: number;
    readonly contentHash: string;
    readonly artifactId?: string | undefined;
  };
  readonly error?: string;
}): import("./_kit/subworkflowLinks").SubworkflowRunLinkOutcome => {
  if (outcome.kind === "failed") {
    return { kind: "failed", error: outcome.error ?? "Child workflow failed." };
  }
  if (outcome.kind === "canceled") return { kind: "canceled" };
  const receipt = Option.getOrThrowWith(
    Option.fromNullishOr(outcome.receipt),
    () => new Error("Subworkflow receipt is unavailable."),
  );
  return {
    kind: "succeeded",
    receipt: {
      kind: receipt.kind,
      measuredBytes: receipt.measuredBytes,
      contentHash: receipt.contentHash,
      ...(receipt.artifactId ? { artifactId: receipt.artifactId } : {}),
    },
  };
};

const resolveChildWorkflowRunId = (
  reader: Context.Service.Shape<typeof DatabaseReader>,
  link: SubworkflowRunLinkRow,
) => {
  const childWorkflowRunId = childWorkflowRunIdFromLink(link);
  if (childWorkflowRunId !== null) {
    return Effect.succeed(
      childWorkflowRunId as import("convex/values").GenericId<"workflowRuns">,
    );
  }
  const childComponentWorkflowId = link.childWorkflowId;
  if (childComponentWorkflowId === null) {
    return Effect.fail(
      new ValidationFailed({
        field: "linkId",
        message: "Historical child workflow identity is unavailable.",
      }),
    );
  }
  return reader
    .table("workflowRuns")
    .index("by_workspace_component_workflow", (q) =>
      q
        .eq("workspaceId", link.workspaceId)
        .eq("componentWorkflowId", childComponentWorkflowId),
    )
    .first()
    .pipe(
      Effect.map(Option.getOrNull),
      Effect.orDie,
      Effect.flatMap((child) =>
        child
          ? Effect.succeed(child._id)
          : Effect.fail(
              new ValidationFailed({
                field: "linkId",
                message: "Historical child workflow identity is unavailable.",
              }),
            ),
      ),
    );
};
