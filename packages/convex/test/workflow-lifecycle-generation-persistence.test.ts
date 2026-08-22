import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
import { describe, expect, it, vi } from "vitest";

const admissionSpies = vi.hoisted(() => ({ transition: vi.fn() }));
vi.mock("../confect/workflows/_kit/ownership", async (importOriginal) => {
  const Effect = await import("effect/Effect");
  const original = await importOriginal<object>();
  return {
    ...original,
    transitionWorkflowAdmission: (...args: unknown[]) => {
      admissionSpies.transition(...args);
      return Effect.void;
    },
  };
});

import databaseSchema from "../confect/_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../confect/_generated/services";
import { reserveWorkflowRun } from "../confect/workflows/_kit/ownership";
import {
  readWorkflowExecutionIdentity,
  recordObservedStageStarted,
} from "../confect/workflows/stageObservations.impl";
import { testConfectLayer } from "./support/confect";
import {
  lifecycleNow,
  seedLifecyclePersistence,
} from "./workflow-lifecycle-persistence.fixture";

describe("workflow lifecycle generation persistence", () => {
  it("moves a queued run to running on the first real stage dispatch", async () => {
    admissionSpies.transition.mockClear();
    const status = await Effect.runPromise(
      Effect.gen(function* () {
        const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
        return yield* confect.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const writer = yield* DatabaseWriter;
            const runId = yield* reserveWorkflowRun(writer, {
              workspaceId: "workspace-dispatch",
              workflowId: "workflow.queued",
              workflowVersion: 1,
              graphJson: '{"nodes":[]}',
              idempotencyKey: "queued-dispatch",
              startedByUserId: "fixture",
              startedAt: lifecycleNow,
            });
            yield* writer
              .table("workflowRuns")
              .patch(runId, { componentWorkflowId: "component-run-a" })
              .pipe(Effect.orDie);
            yield* recordObservedStageStarted(stageArgs(runId, 0));
            const run = yield* reader
              .table("workflowRuns")
              .get(runId)
              .pipe(Effect.orDie);
            return run?.status ?? "missing";
          }),
          Schema.String,
        );
      }).pipe(Effect.provide(testConfectLayer())),
    );
    expect(status).toBe("running");
    expect(admissionSpies.transition).toHaveBeenCalledTimes(1);
    expect(admissionSpies.transition.mock.calls[0]?.[2]).toBe("running");
  });

  it("permits only the unbound eager generation zero reservation", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
        const seeded = yield* seedLifecyclePersistence(confect);
        return yield* confect.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const writer = yield* DatabaseWriter;
            const runId = yield* reserveWorkflowRun(writer, {
              workspaceId: seeded.workspaceId,
              workflowId: "workflow.eager",
              workflowVersion: 1,
              graphJson: '{"nodes":[]}',
              idempotencyKey: "eager-unbound",
              startedByUserId: seeded.memberUserId,
              startedAt: lifecycleNow,
            });
            const eager = yield* readWorkflowExecutionIdentity(reader, {
              workspaceId: seeded.workspaceId,
              workflowRunId: runId,
              componentWorkflowId: "component-eager",
            });
            yield* writer
              .table("workflowRuns")
              .patch(runId, { componentWorkflowId: "component-bound" })
              .pipe(Effect.orDie);
            const queuedWrong = yield* Effect.exit(
              readWorkflowExecutionIdentity(reader, {
                workspaceId: seeded.workspaceId,
                workflowRunId: runId,
                componentWorkflowId: "component-wrong",
              }),
            );
            yield* writer
              .table("workflowRuns")
              .patch(runId, { lifecycleGeneration: 1 })
              .pipe(Effect.orDie);
            const restartedWrong = yield* Effect.exit(
              readWorkflowExecutionIdentity(reader, {
                workspaceId: seeded.workspaceId,
                workflowRunId: runId,
                componentWorkflowId: "component-wrong",
              }),
            );
            const restarted = yield* readWorkflowExecutionIdentity(reader, {
              workspaceId: seeded.workspaceId,
              workflowRunId: runId,
              componentWorkflowId: "component-bound",
            });
            return JSON.stringify({
              eager,
              queuedWrong: Exit.isFailure(queuedWrong),
              restarted,
              restartedWrong: Exit.isFailure(restartedWrong),
            });
          }),
          Schema.String,
        );
      }).pipe(Effect.provide(testConfectLayer())),
    );
    expect(JSON.parse(result)).toMatchObject({
      eager: { generation: 0 },
      queuedWrong: true,
      restarted: { generation: 1 },
      restartedWrong: true,
    });
  });

  it("retains the same stable stage independently across generations", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
        const seeded = yield* seedLifecyclePersistence(confect);
        return yield* confect.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const writer = yield* DatabaseWriter;
            yield* recordObservedStageStarted(stageArgs(seeded.runId, 0));
            yield* writer
              .table("workflowRuns")
              .patch(seeded.runId, { lifecycleGeneration: 1 })
              .pipe(Effect.orDie);
            yield* recordObservedStageStarted(stageArgs(seeded.runId, 1));
            const rows = yield* reader
              .table("workflowStageRuns")
              .index("by_run", (q) => q.eq("workflowRunId", seeded.runId))
              .collect()
              .pipe(Effect.orDie);
            return JSON.stringify(
              rows
                .filter((row) => row.stageKey === "review.v3")
                .map((row) => row.lifecycleGeneration)
                .sort(),
            );
          }),
          Schema.String,
        );
      }).pipe(Effect.provide(testConfectLayer())),
    );
    expect(JSON.parse(result)).toEqual([0, 1]);
  });
});

const stageArgs = (workflowRunId: string, lifecycleGeneration: number) => ({
  workflowRunId,
  componentWorkflowId: "component-run-a",
  nodeId: "review-node",
  label: "Review invoice",
  kind: "capability" as const,
  stageKey: "review.v3",
  lifecycleGeneration,
  externalEffect: true,
  observedAt: lifecycleNow + lifecycleGeneration,
  order: 1,
  status: "running" as const,
});
