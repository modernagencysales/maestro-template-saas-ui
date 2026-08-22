import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { describe, expect, it, vi } from "vitest";

vi.mock("../confect/workflows/_kit/ownership", async (importOriginal) => {
  const Effect = await import("effect/Effect");
  const original = await importOriginal<object>();
  return {
    ...original,
    bindWorkflowAdmission: () => Effect.void,
    reserveWorkflowAdmission: () => Effect.void,
    transitionWorkflowAdmission: () => Effect.void,
  };
});

import refs from "../confect/_generated/refs";
import { Id } from "../confect/_generated/id";
import databaseSchema from "../confect/_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../confect/_generated/services";
import { reserveWorkflowRun } from "../confect/workflows/_kit/ownership";
import {
  WorkflowReference,
  WorkflowStepName,
} from "../confect/workflows/_kit/workflowReferences";
import { testConfectLayer } from "./support/confect";
import { SeededTenancy, seedTenancy } from "./support/seedTenancy";
import * as currentSubworkflowLinks from "../convex/workflows/subworkflowLinksCurrent";

const now = 1_782_924_800_000;

describe("subworkflow product run linkage", () => {
  it("exports every current recovery function through the production module", () => {
    expect(Object.keys(currentSubworkflowLinks).sort()).toEqual([
      "persistUnresolvedReservation",
      "persistUnresolvedSuccess",
      "recoverReservation",
      "recoverUnresolvedSuccess",
      "reportReconciliationFailure",
      "resolveUnresolvedSuccess",
    ]);
  });

  it("reserves, activates, and reconciles one exact child idempotently", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(seedTenancy(now), SeededTenancy);
      const parentWorkflowRunId = yield* confect.run(
        Effect.gen(function* () {
          const writer = yield* DatabaseWriter;
          return yield* reserveWorkflowRun(writer, {
            workspaceId: seeded.workspaceId,
            workflowId: "workflow.parent",
            workflowVersion: 2,
            graphJson: '{"id":"workflow.parent"}',
            idempotencyKey: "subworkflow-parent",
            startedByUserId: seeded.memberUserId,
            startedAt: now,
          });
        }),
        Id("workflowRuns"),
      );
      const projection = {
        workspaceId: seeded.workspaceId,
        parentWorkflowRunId,
        parentComponentWorkflowId: "component-parent",
        parentWorkflowVersion: 2,
        generation: 0,
        childWorkflow: Schema.decodeSync(WorkflowReference)(
          "workflow.childReceipt.v3",
        ),
        childWorkflowVersion: 3,
        childGraphJson: '{"id":"workflow.childReceipt.v3"}',
        childReleaseChecksum: "b".repeat(64),
        stepName: Schema.decodeSync(WorkflowStepName)("child.v3"),
        principal: {
          version: 2 as const,
          kind: "user" as const,
          workspaceId: seeded.workspaceId,
          actorId: seeded.memberUserId,
          role: "editor" as const,
          authEpoch: 1,
          grants: ["workflow:run"],
          kickoffAt: now,
          provenance: "authenticated-workflow-start" as const,
        },
        policySnapshot: {
          version: 1 as const,
          kind: "none" as const,
          reason: "subworkflow persistence fixture",
        },
      };
      const first = yield* confect.mutation(
        refs.internal.workflows.subworkflowLinks.reserve,
        { projection, occurredAt: now },
      );
      const replay = yield* confect.mutation(
        refs.internal.workflows.subworkflowLinks.reserve,
        { projection, occurredAt: now + 1 },
      );
      const secondParentWorkflowRunId = yield* confect.run(
        Effect.gen(function* () {
          const writer = yield* DatabaseWriter;
          return yield* reserveWorkflowRun(writer, {
            workspaceId: seeded.workspaceId,
            workflowId: "workflow.parent",
            workflowVersion: 2,
            graphJson: '{"id":"workflow.parent"}',
            idempotencyKey: "subworkflow-parent-2",
            startedByUserId: seeded.memberUserId,
            startedAt: now,
          });
        }),
        Id("workflowRuns"),
      );
      const independent = yield* confect.mutation(
        refs.internal.workflows.subworkflowLinks.reserve,
        {
          projection: {
            ...projection,
            parentWorkflowRunId: secondParentWorkflowRunId,
          },
          occurredAt: now + 1,
        },
      );
      const reconciliationFailureReport = {
        workspaceId: seeded.workspaceId,
        linkId: independent.linkId,
        primaryOutcome: "canceled" as const,
        issue: "SUBWORKFLOW_LINK_RECONCILIATION_FAILED" as const,
        occurredAt: now + 2,
      };
      yield* confect.mutation(
        refs.internal.workflows.subworkflowLinks.reportReconciliationFailure,
        reconciliationFailureReport,
      );
      yield* confect.mutation(
        refs.internal.workflows.subworkflowLinks.reportReconciliationFailure,
        { ...reconciliationFailureReport, occurredAt: now + 3 },
      );
      const activation = {
        workspaceId: seeded.workspaceId,
        parentWorkflowRunId,
        parentComponentWorkflowId: "component-parent",
        childWorkflowRunId: first.childWorkflowRunId,
        childComponentWorkflowId: "component-child",
        generation: 0,
        linkId: first.linkId,
        occurredAt: now + 2,
      };
      yield* confect.mutation(
        refs.internal.workflows.subworkflowLinks.activate,
        activation,
      );
      yield* confect.mutation(
        refs.internal.workflows.subworkflowLinks.activate,
        { ...activation, occurredAt: now + 3 },
      );
      const outcome = {
        kind: "succeeded" as const,
        receipt: {
          kind: "bounded-inline" as const,
          measuredBytes: 31,
          contentHash: "a".repeat(64),
        },
      };
      yield* confect.mutation(
        refs.internal.workflows.subworkflowLinks.reconcile,
        {
          workspaceId: seeded.workspaceId,
          linkId: first.linkId,
          outcome,
          occurredAt: now + 4,
        },
      );
      yield* confect.mutation(
        refs.internal.workflows.subworkflowLinks.reconcile,
        {
          workspaceId: seeded.workspaceId,
          linkId: first.linkId,
          outcome,
          occurredAt: now + 5,
        },
      );
      return yield* confect.run(
        Effect.gen(function* () {
          const reader = yield* DatabaseReader;
          const link = yield* reader
            .table("workflowRunLinks")
            .get(first.linkId)
            .pipe(Effect.orDie);
          const child = yield* reader
            .table("workflowRuns")
            .get(first.childWorkflowRunId)
            .pipe(Effect.orDie);
          const reconciliationFailureEvents = yield* reader
            .table("workflowRunEvents")
            .index("by_run_type", (q) =>
              q
                .eq("workflowRunId", independent.childWorkflowRunId)
                .eq(
                  "type",
                  `subworkflow-link-reconciliation-failed:${independent.linkId}`,
                ),
            )
            .collect()
            .pipe(Effect.orDie);
          return JSON.stringify({
            first,
            replay,
            link,
            child,
            parentWorkflowRunId,
            independent,
            reconciliationFailureEvents,
          });
        }),
        Schema.String,
      );
    });

    const result = JSON.parse(
      await Effect.runPromise(program.pipe(Effect.provide(testConfectLayer()))),
    );
    expect(result.replay).toEqual(result.first);
    expect(result.independent).not.toEqual(result.first);
    expect(result.reconciliationFailureEvents).toHaveLength(1);
    expect(result.reconciliationFailureEvents[0]).toMatchObject({
      workflowRunId: result.independent.childWorkflowRunId,
      sequence: now + 2,
      type: `subworkflow-link-reconciliation-failed:${result.independent.linkId}`,
    });
    expect(
      JSON.parse(result.reconciliationFailureEvents[0].payloadJson),
    ).toEqual({
      issue: "SUBWORKFLOW_LINK_RECONCILIATION_FAILED",
      linkId: result.independent.linkId,
      primaryOutcome: "canceled",
    });
    expect(result.link).toMatchObject({
      parentWorkflowId: result.parentWorkflowRunId,
      childWorkflowId: "component-child",
      status: "succeeded",
    });
    expect(result.link.childResultJson).not.toContain("child-receipt");
    expect(result.child).toMatchObject({
      _id: result.first.childWorkflowRunId,
      componentWorkflowId: "component-child",
      status: "completed",
      sourceRunId: result.parentWorkflowRunId,
    });
  });
});
