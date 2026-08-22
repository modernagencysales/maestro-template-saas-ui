import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import databaseSchema from "../confect/_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../confect/_generated/services";
import { reserveWorkflowRun } from "../confect/workflows/_kit/ownership";
import { inspectWorkflowRetention } from "../confect/workflows/lifecycleInspection";
import { testConfectLayer } from "./support/confect";
import {
  lifecycleNow,
  seedLifecyclePersistence,
} from "./workflow-lifecycle-persistence.fixture";

describe("workflow lifecycle retained descendants", () => {
  it("keeps historical component-id child links visible to retention and quiescence inspection", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* seedLifecyclePersistence(confect);
      return yield* confect.run(
        Effect.gen(function* () {
          const reader = yield* DatabaseReader;
          const writer = yield* DatabaseWriter;
          const childId = yield* reserveWorkflowRun(writer, {
            workspaceId: seeded.workspaceId,
            workflowId: "workflow.child",
            workflowVersion: 1,
            graphJson: '{"nodes":[]}',
            idempotencyKey: "retained-child",
            startedByUserId: seeded.memberUserId,
            startedAt: lifecycleNow,
          });
          yield* writer
            .table("workflowRuns")
            .patch(childId, {
              componentWorkflowId: "component-child",
              childRetentionUntil: lifecycleNow + 500,
              evidenceRetentionUntil: lifecycleNow + 700,
            })
            .pipe(Effect.orDie);
          const linkId = yield* writer
            .table("workflowRunLinks")
            .insert({
              workspaceId: seeded.workspaceId,
              parentWorkflowId: "component-run-a",
              childWorkflowId: "component-child",
              parentKind: "workflow",
              childKind: "workflow",
              relationKind: "subworkflow",
              relationId: "child.v1",
              idempotencyKey: "child-link",
              status: "running",
              childResultJson: null,
              createdAt: lifecycleNow,
              updatedAt: lifecycleNow,
            })
            .pipe(Effect.orDie);
          yield* writer
            .table("workflowRunEvidenceSnapshots")
            .insert({
              workflowRunId: seeded.runId,
              sourceIds: [],
              sourceTitles: [],
              evidenceHash: "evidence-hash",
              materiality: "required",
              snapshotJson: "{}",
              createdAt: lifecycleNow,
            })
            .pipe(Effect.orDie);
          const blocked = yield* inspectWorkflowRetention(reader, {
            workspaceId: seeded.workspaceId,
            workflowRunId: seeded.runId,
            componentWorkflowId: "component-run-a",
          });
          yield* writer
            .table("workflowRuns")
            .patch(seeded.runId, {
              evidenceRetentionUntil: lifecycleNow + 600,
            })
            .pipe(Effect.orDie);
          yield* writer
            .table("workflowRunLinks")
            .patch(linkId, { status: "succeeded" })
            .pipe(Effect.orDie);
          const retained = yield* inspectWorkflowRetention(reader, {
            workspaceId: seeded.workspaceId,
            workflowRunId: seeded.runId,
            componentWorkflowId: "component-run-a",
          });
          return JSON.stringify({ blocked, retained });
        }),
        Schema.String,
      );
    });
    const result = JSON.parse(
      await Effect.runPromise(program.pipe(Effect.provide(testConfectLayer()))),
    );
    expect(result.blocked).toMatchObject({
      activeChildCount: 1,
      retentionUnverifiable: true,
    });
    expect(result.retained).toMatchObject({
      childUntil: lifecycleNow + 700,
      evidenceUntil: lifecycleNow + 600,
      activeChildCount: 0,
      retentionUnverifiable: false,
    });
  });
});
