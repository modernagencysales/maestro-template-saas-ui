import type { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { Id } from "../confect/_generated/id";
import databaseSchema from "../confect/_generated/schema";
import { DatabaseWriter } from "../confect/_generated/services";
import { reserveWorkflowRun } from "../confect/workflows/_kit/ownership";
import { SeededTenancy, seedTenancy } from "./support/seedTenancy";

export const lifecycleNow = 1_782_924_800_000;

const SeededLifecycleRun = Schema.Struct({
  runId: Id("workflowRuns"),
});

export const seedLifecyclePersistence = (
  confect: TestConfect.TestConfect<typeof databaseSchema>,
) =>
  Effect.gen(function* () {
    const tenancy = yield* confect.run(
      seedTenancy(lifecycleNow),
      SeededTenancy,
    );
    const seeded = yield* confect.run(
      Effect.gen(function* () {
        const writer = yield* DatabaseWriter;
        const runId = yield* reserveWorkflowRun(writer, {
          workspaceId: tenancy.workspaceId,
          workflowId: "workflow.invoice-review",
          workflowVersion: 3,
          graphJson: '{"nodes":[]}',
          idempotencyKey: "invoice-review-run-1",
          startedByUserId: tenancy.memberUserId,
          startedAt: lifecycleNow,
        });
        yield* writer
          .table("workflowRuns")
          .patch(runId, {
            componentWorkflowId: "component-run-a",
            status: "running",
          })
          .pipe(Effect.orDie);
        yield* writer
          .table("workflowStageRuns")
          .insert({
            workflowRunId: runId,
            nodeId: "review-node",
            kind: "capability",
            label: "Review invoice",
            status: "succeeded",
            attempt: 1,
            startedAt: lifecycleNow + 1,
            completedAt: lifecycleNow + 2,
            errorJson: null,
            outputJson: '{"secret":"must-not-project"}',
            componentWorkflowId: "component-run-a",
            lifecycleGeneration: 0,
            externalEffect: true,
            stageKey: "review.v3",
            attemptNumber: 1,
            order: 0,
            summary: "must-not-project",
          })
          .pipe(Effect.orDie);
        yield* writer
          .table("workflowRuns")
          .insert({
            workspaceId: "workspace-foreign",
            workflowId: "workflow.invoice-review",
            workflowVersion: 3,
            graphJson: '{"secret":"foreign"}',
            status: "running",
            idempotencyKey: "foreign-run-1",
            startedByUserId: "foreign-user",
            startedAt: lifecycleNow,
            completedAt: null,
            failedAt: null,
            trustReceiptId: null,
          })
          .pipe(Effect.orDie);
        return { runId };
      }),
      SeededLifecycleRun,
    );
    return { ...tenancy, ...seeded };
  });

export const memberIdentity = {
  subject: "member-subject",
  email: "member@example.com",
};
