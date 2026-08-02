import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import refs from "../confect/_generated/refs";
import databaseSchema from "../confect/_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../confect/_generated/services";
import {
  appendWorkflowLifecycleAudit,
  loadOwnedWorkflowRun,
  persistWorkflowLifecycleState,
} from "../confect/workflows/lifecyclePersistence";
import { inspectWorkflowRestart } from "../confect/workflows/lifecycleInspection";
import { reconcileWorkflowCompletion } from "../confect/workflows/lifecycleReconciliation";
import { testConfectLayer } from "./support/confect";
import {
  lifecycleNow,
  memberIdentity,
  seedLifecyclePersistence,
} from "./workflow-lifecycle-persistence.fixture";

describe("workflow lifecycle persistent tenant adapters", () => {
  it("rejects a downstream external step without generation-scoped evidence", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* seedLifecyclePersistence(confect);
      return yield* confect.run(
        Effect.gen(function* () {
          const reader = yield* DatabaseReader;
          return yield* inspectWorkflowRestart(reader, {
            workspaceId: seeded.workspaceId,
            workflowRunId: seeded.runId,
            generation: 0,
            restartAnchor: "review.v3",
          }).pipe(
            Effect.flip,
            Effect.map((error) => error.message),
          );
        }),
        Schema.String,
      );
    });
    await expect(
      Effect.runPromise(program.pipe(Effect.provide(testConfectLayer()))),
    ).resolves.toContain("no generation-scoped restart reservation");
  });

  it("reconciles a bounded owned completion idempotently", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* seedLifecyclePersistence(confect);
      return yield* confect.run(
        Effect.gen(function* () {
          const reader = yield* DatabaseReader;
          const writer = yield* DatabaseWriter;
          const context = {
            workspaceId: seeded.workspaceId,
            workflowRunId: seeded.runId,
            workflowId: "workflow.invoice-review",
            workflowVersion: 3,
            generation: 0,
            generationAnchor: "workflow.invoice-review@v3:g0",
          };
          const input = {
            componentWorkflowId: "component-run-a",
            context,
            result: { kind: "failed" as const, error: "redacted" },
          };
          yield* reconcileWorkflowCompletion(reader, writer, input);
          yield* reconcileWorkflowCompletion(reader, writer, input);
          const row = yield* reader
            .table("workflowRuns")
            .get(seeded.runId)
            .pipe(Effect.orDie);
          return JSON.stringify({
            execution: row?.lifecycleExecution,
            quiescence: row?.priorGenerationQuiescence,
            status: row?.status,
          });
        }),
        Schema.String,
      );
    });
    await expect(
      Effect.runPromise(program.pipe(Effect.provide(testConfectLayer()))),
    ).resolves.toBe(
      JSON.stringify({
        execution: "terminal",
        quiescence: "pending",
        status: "failed",
      }),
    );
  });

  it("inspects downstream steps and generation-scoped effect horizons", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* seedLifecyclePersistence(confect);
      return yield* confect.run(
        Effect.gen(function* () {
          const reader = yield* DatabaseReader;
          const writer = yield* DatabaseWriter;
          yield* writer
            .table("workflowEffectReservations")
            .insert({
              workspaceId: seeded.workspaceId,
              workflowRunId: seeded.runId,
              workflowId: "workflow.invoice-review",
              workflowVersion: 3,
              generation: 0,
              stepName: "review.v3",
              logicalEffectKey: "invoice-review:review",
              capabilityRef: "capability.invoice.review",
              effectClass: "external",
              strategy: "durable-ledger-and-reconcile",
              state: "confirmed",
              reconciliationState: "confirmed",
              approvalCheck: "passed",
              quotaRateCheck: "passed",
              spendKillSwitchCheck: "passed",
              dedupeExpiresAt: lifecycleNow + 1_000,
              restartSafeUntil: lifecycleNow + 500,
              occurredAt: lifecycleNow,
              occurredAtDescending: -lifecycleNow,
              appendOnly: true,
            })
            .pipe(Effect.orDie);
          const inspection = yield* inspectWorkflowRestart(reader, {
            workspaceId: seeded.workspaceId,
            workflowRunId: seeded.runId,
            generation: 0,
            restartAnchor: "review.v3",
          });
          return JSON.stringify(inspection);
        }),
        Schema.String,
      );
    });
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(JSON.parse(result)).toEqual({
      discardedSteps: ["review.v3"],
      externalEffects: [
        expect.objectContaining({
          stepName: "review.v3",
          restartSafe: true,
        }),
      ],
    });
  });

  it("lists only tenant product projections without raw payloads", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* seedLifecyclePersistence(confect);
      const actor = confect.withIdentity(memberIdentity);
      const runs = yield* actor.query(refs.internal.workflows.lifecycle.list, {
        workspaceId: seeded.workspaceId,
        cursor: null,
        limit: 10,
      });
      const named = yield* actor.query(
        refs.internal.workflows.lifecycle.listByName,
        {
          workspaceId: seeded.workspaceId,
          workflowName: "workflow.invoice-review",
          cursor: null,
          limit: 10,
        },
      );
      const steps = yield* actor.query(
        refs.internal.workflows.lifecycle.listSteps,
        {
          workspaceId: seeded.workspaceId,
          workflowRunId: seeded.runId,
          cursor: null,
          limit: 10,
        },
      );
      return { named, runs, seeded, steps };
    });
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result.runs.page).toHaveLength(1);
    expect(result.named.page).toHaveLength(1);
    expect(result.steps.page).toEqual([
      expect.objectContaining({ stepName: "review.v3", errorCode: null }),
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /secret|graphJson|outputJson|summary|componentWorkflowId/,
    );
  });

  it("keeps ownership opaque and journals only redacted audit fields", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* seedLifecyclePersistence(confect);
      return yield* confect.run(
        Effect.gen(function* () {
          const reader = yield* DatabaseReader;
          const writer = yield* DatabaseWriter;
          const missing = yield* loadOwnedWorkflowRun(
            reader,
            "workspace-foreign",
            seeded.runId,
          );
          const owned = yield* loadOwnedWorkflowRun(
            reader,
            seeded.workspaceId,
            seeded.runId,
          );
          if (owned === null) throw new Error("owned lifecycle row missing");
          yield* persistWorkflowLifecycleState(writer, seeded.runId, {
            ...owned.state,
            execution: "canceled",
            priorGenerationQuiescence: "pending",
          });
          yield* appendWorkflowLifecycleAudit(writer, reader, {
            type: "workflow.cancel.requested",
            workspaceId: seeded.workspaceId,
            workflowRunId: seeded.runId,
            workflowId: owned.state.workflowId,
            workflowVersion: owned.state.workflowVersion,
            generation: owned.state.generation,
            actorId: seeded.memberUserId,
            authority: "operator",
            reasonCode: "operator-request",
            occurredAt: lifecycleNow + 10,
            discardedStepCount: 0,
            redacted: true,
          });
          const row = yield* reader
            .table("workflowRuns")
            .get(seeded.runId)
            .pipe(Effect.orDie);
          const event = yield* reader
            .table("workflowRunEvents")
            .index(
              "by_run_sequence",
              (q) => q.eq("workflowRunId", seeded.runId),
              "desc",
            )
            .first()
            .pipe(Effect.map(Option.getOrNull), Effect.orDie);
          return {
            eventPayload: event?.payloadJson ?? "",
            eventType: event?.type ?? "",
            execution: row?.lifecycleExecution ?? null,
            missing: missing === null ? null : missing.workflowRunId,
          };
        }),
        Schema.Struct({
          eventPayload: Schema.String,
          eventType: Schema.String,
          execution: Schema.NullOr(
            Schema.Literals(["active", "terminal", "canceled"]),
          ),
          missing: Schema.NullOr(Schema.String),
        }),
      );
    });
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result).toMatchObject({
      eventType: "workflow.cancel.requested",
      execution: "canceled",
      missing: null,
    });
    expect(JSON.parse(result.eventPayload)).toMatchObject({
      type: "workflow.cancel.requested",
      redacted: true,
    });
    expect(result.eventPayload).not.toMatch(/component|graph|payload|secret/);
  });
});
